import puppeteer from "@cloudflare/puppeteer";
import { configurePage, readPageSnapshot, scrapeCeairPageText } from "./ceair";
import { runScrapeJob } from "./scrape-job";

const TEST_URL =
  "https://www.ceair.com/zh/cny/shopping/oneway/SHA,PVG-BNE/2026-09-30";

type CeairProbeResult = {
  ok: boolean;
  url: string;
  pageUrl?: string;
  pageTitle?: string;
  flightsFound: number;
  hasPrice: boolean;
  preview: string;
  elapsedMs?: number;
  browserQuotaRemainingMs?: number | null;
  error?: string;
};

function buildProbeResult(
  base: Omit<CeairProbeResult, "flightsFound" | "hasPrice" | "preview"> & {
    text?: string;
    preview?: string;
    flightsFound?: number;
    hasPrice?: boolean;
    elapsedMs?: number;
    browserQuotaRemainingMs?: number | null;
  },
): CeairProbeResult {
  const text = base.text ?? "";
  const preview = base.preview ?? text.slice(0, 800);
  const flightsFound =
    base.flightsFound ?? (text.match(/\bMU\s?\d{3,4}\b/g) ?? []).length;

  return {
    ok: base.ok,
    url: base.url,
    pageUrl: base.pageUrl,
    pageTitle: base.pageTitle,
    flightsFound,
    hasPrice: base.hasPrice ?? /[¥￥]/.test(text || preview),
    preview,
    elapsedMs: base.elapsedMs,
    browserQuotaRemainingMs: base.browserQuotaRemainingMs,
    error: base.error,
  };
}

async function safeCloseBrowser(browser: Awaited<ReturnType<typeof puppeteer.launch>>) {
  await browser.close().catch(() => {});
}

async function probeCeairPage(env: Env, url: string): Promise<CeairProbeResult> {
  const startedAt = Date.now();
  let browserQuotaRemainingMs: number | null = null;

  const finish = (
    partial: Parameters<typeof buildProbeResult>[0],
  ): CeairProbeResult =>
    buildProbeResult({
      ...partial,
      elapsedMs: partial.elapsedMs ?? Date.now() - startedAt,
      browserQuotaRemainingMs,
    });

  try {
    const limits = await puppeteer.limits(env.BROWSER).catch(() => null);
    browserQuotaRemainingMs = limits?.remaining ?? null;
    const usedSeconds = limits?.usedBrowserTimeSeconds;
    if (usedSeconds != null && usedSeconds >= 600) {
      return finish({
        ok: false,
        url,
        preview: "",
        error: `Browser Run daily quota exhausted (~${Math.round(usedSeconds)}s used). Retry after UTC midnight reset.`,
      });
    }
  } catch {
    // limits() unavailable in some dev modes; continue.
  }

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    browser = await puppeteer.launch(env.BROWSER);
  } catch (error) {
    return finish({
      ok: false,
      url,
      preview: "",
      error: `Failed to launch browser: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  let page: Awaited<ReturnType<typeof browser.newPage>> | undefined;
  try {
    page = await browser.newPage();
    await configurePage(page);
    const snapshot = await scrapeCeairPageText(page, url);

    return finish({
      ok: true,
      url,
      pageUrl: snapshot.pageUrl,
      pageTitle: snapshot.pageTitle,
      text: snapshot.text,
    });
  } catch (error) {
    const snapshot = page ? await readPageSnapshot(page) : null;
    return finish({
      ok: false,
      url,
      pageUrl: snapshot?.pageUrl,
      pageTitle: snapshot?.pageTitle,
      text: snapshot?.text,
      preview: snapshot?.text.slice(0, 800) ?? "",
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (page) await page.close().catch(() => {});
    if (browser) await safeCloseBrowser(browser);
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "trip-flight-scraper",
        hint: "GET /scrape 抓取 enabled watches 并写 D1；GET / 仅探测页面；GET /limits 查配额。",
      });
    }

    if (url.pathname === "/limits") {
      try {
        const limits = await puppeteer.limits(env.BROWSER);
        return Response.json({ ok: true, limits });
      } catch (error) {
        return Response.json(
          {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          },
          { status: 502 },
        );
      }
    }

    if (url.pathname === "/scrape") {
      const watchId = url.searchParams.get("watchId")?.trim() || undefined;
      const sync = url.searchParams.get("sync") === "1";
      const timestampMs = Date.now();

      if (sync) {
        const summary = await runScrapeJob(env, timestampMs, watchId);
        console.log(JSON.stringify({ event: "scrape_job_done", ...summary }));
        return Response.json(summary, { status: summary.ok ? 200 : 502 });
      }

      ctx.waitUntil(
        (async () => {
          const summary = await runScrapeJob(env, timestampMs, watchId);
          console.log(JSON.stringify({ event: "scrape_job_done", ...summary }));
        })(),
      );

      return Response.json(
        {
          ok: true,
          status: "started",
          watchId: watchId ?? null,
          hint: "抓取在后台运行；用 wrangler tail 看 scrape_job_done，或查 D1 flight_scrape_runs。",
        },
        { status: 202 },
      );
    }

    const target = url.searchParams.get("url")?.trim() || TEST_URL;
    const result = await probeCeairPage(env, target);
    console.log(
      JSON.stringify({
        event: "probe_done",
        ok: result.ok,
        elapsedMs: result.elapsedMs,
        pageUrl: result.pageUrl,
        pageTitle: result.pageTitle,
        flightsFound: result.flightsFound,
        hasPrice: result.hasPrice,
        previewLen: result.preview.length,
        error: result.error,
      }),
    );
    return Response.json(result, { status: result.ok ? 200 : 502 });
  },

  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    console.log(
      JSON.stringify({
        event: "scheduled",
        cron: controller.cron,
        scheduledTime: new Date(controller.scheduledTime).toISOString(),
      }),
    );

    ctx.waitUntil(
      (async () => {
        const summary = await runScrapeJob(env, controller.scheduledTime);
        console.log(JSON.stringify({ event: "scrape_job_done", ...summary }));
        if (!summary.ok) controller.noRetry();
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
