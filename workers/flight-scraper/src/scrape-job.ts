import puppeteer from "@cloudflare/puppeteer";
import {
  buildScrapeResult,
  configurePage,
  resolveWatchUrl,
  scrapeCeairPageText,
} from "./ceair";
import { beginScrapeRun, failScrapeRun, loadEnabledWatches, persistScrapeResult } from "./persist";
import type { ScrapeJobSummary, WatchScrapeOutcome } from "./types";

const BROWSER_DAILY_LIMIT_SECONDS = 600;

async function safeCloseBrowser(browser: Awaited<ReturnType<typeof puppeteer.launch>>) {
  await browser.close().catch(() => {});
}

async function safeClosePage(page: Awaited<ReturnType<Awaited<ReturnType<typeof puppeteer.launch>>["newPage"]>>) {
  await page.close().catch(() => {});
}

async function checkBrowserQuota(env: Env): Promise<string | null> {
  try {
    const limits = await puppeteer.limits(env.BROWSER);
    if (limits.usedBrowserTimeSeconds >= BROWSER_DAILY_LIMIT_SECONDS) {
      return `Browser Run daily quota exhausted (~${Math.round(limits.usedBrowserTimeSeconds)}s used). Retry after UTC midnight reset.`;
    }
  } catch {
    // limits() unavailable in some dev modes
  }
  return null;
}

export async function runScrapeJob(
  env: Env,
  timestampMs: number,
  watchId?: string,
): Promise<ScrapeJobSummary> {
  const watches = await loadEnabledWatches(env.DB, watchId);
  if (watches.length === 0) {
    return {
      ok: false,
      watchCount: 0,
      results: [],
      error: watchId ? `找不到已启用的关注：${watchId}` : "没有 enabled=1 的 flight_watches",
    };
  }

  const quotaError = await checkBrowserQuota(env);
  if (quotaError) {
    return { ok: false, watchCount: watches.length, results: [], error: quotaError };
  }

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    browser = await puppeteer.launch(env.BROWSER);
  } catch (error) {
    return {
      ok: false,
      watchCount: watches.length,
      results: [],
      error: `Failed to launch browser: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const results: WatchScrapeOutcome[] = [];

  try {
    for (const watch of watches) {
      const url = resolveWatchUrl(watch);
      if (!url) {
        const fail = await failScrapeRun(
          env.DB,
          watch,
          "",
          `watch ${watch.id} 缺少可用的 source_url`,
          timestampMs,
        );
        results.push({
          watchId: watch.id,
          ok: false,
          runId: fail.runId,
          error: fail.message,
          skipped: fail.skipped,
        });
        continue;
      }

      let page: Awaited<ReturnType<typeof browser.newPage>> | undefined;
      const begun = await beginScrapeRun(env.DB, watch, url, timestampMs);
      if (begun.skipped) {
        results.push({
          watchId: watch.id,
          ok: true,
          skipped: true,
          runId: begun.runId,
          message: `今天${begun.slot === "am" ? "上午" : "下午"}已成功抓取过，跳过。`,
        });
        continue;
      }

      try {
        page = await browser.newPage();
        await configurePage(page);
        const snapshot = await scrapeCeairPageText(page, url);
        const scrapeResult = buildScrapeResult(watch, url, snapshot.text);
        const persisted = await persistScrapeResult(env.DB, watch, scrapeResult, timestampMs);

        results.push({
          watchId: watch.id,
          ok: !persisted.skipped,
          skipped: persisted.skipped,
          runId: persisted.runId,
          flightsFound: persisted.flightsFound,
          minPriceCny: persisted.minPriceCny,
          message: persisted.message,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const fail = await failScrapeRun(env.DB, watch, url, message, timestampMs);
        results.push({
          watchId: watch.id,
          ok: false,
          runId: fail.runId,
          error: message,
          skipped: fail.skipped,
          message: fail.message,
        });
      } finally {
        if (page) await safeClosePage(page);
      }
    }
  } finally {
    await safeCloseBrowser(browser);
  }

  const ok = results.some((result) => result.ok || result.skipped);
  return { ok, watchCount: watches.length, results };
}
