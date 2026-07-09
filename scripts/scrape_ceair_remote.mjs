#!/usr/bin/env node
import { scrapeCeairWatch, buildCeairShoppingUrl } from "./lib/ceair-scraper.mjs";
import { createRemoteD1 } from "./lib/remote-d1.mjs";
import {
  failScrapeRun,
  loadEnabledWatches,
  loadWatch,
  persistScrapeResult,
} from "./lib/scrape-persist.mjs";

function parseArgs(argv) {
  let watchId = null;
  let all = false;
  let headless = true;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--watch-id" || arg === "--watchId") {
      watchId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg.startsWith("--watch-id=")) {
      watchId = arg.slice("--watch-id=".length);
      continue;
    }
    if (arg === "--all") {
      all = true;
    }
    if (arg === "--headed") {
      headless = false;
    }
  }

  return { watchId, all, headless };
}

async function scrapeOne(db, watch, headless) {
  const url =
    watch.source_url?.trim() ||
    (watch.source === "ceair"
      ? buildCeairShoppingUrl(watch.origin_code, watch.dest_code, watch.travel_date)
      : null);

  console.log(`开始抓取: ${watch.label} (${watch.id})`);

  try {
    const scrapeResult = await scrapeCeairWatch(watch, { headless });
    const persisted = await persistScrapeResult(db, watch, scrapeResult);
    console.log(persisted.message);
    return {
      watchId: watch.id,
      ok: true,
      skipped: persisted.skipped ?? false,
      runId: persisted.runId,
      flightsFound: persisted.flightsFound ?? scrapeResult.flightsFound,
      minPriceCny: persisted.minPriceCny ?? scrapeResult.minPriceCny,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failed = await failScrapeRun(db, watch, url ?? "", message);
    console.error(`抓取失败 ${watch.id}: ${message}`);
    return {
      watchId: watch.id,
      ok: false,
      skipped: failed.skipped ?? false,
      runId: failed.runId,
      error: message,
    };
  }
}

async function main() {
  const { watchId, all, headless } = parseArgs(process.argv.slice(2));
  if (!watchId && !all) {
    console.error("用法:");
    console.error("  node scripts/scrape_ceair_remote.mjs --watch-id fw-sha-bne-20260930");
    console.error("  node scripts/scrape_ceair_remote.mjs --all");
    process.exit(1);
  }

  const db = createRemoteD1();
  console.log("目标：远端 D1 trip-jimmiewang-com");

  const watches = watchId ? [await loadWatch(db, watchId)] : await loadEnabledWatches(db);
  if (watches.length === 0) {
    console.log("没有 enabled=1 的 flight_watches");
    return;
  }

  const results = [];
  for (const watch of watches) {
    results.push(await scrapeOne(db, watch, headless));
  }

  console.log(JSON.stringify({ ok: results.every((r) => r.ok || r.skipped), results }, null, 2));
  if (results.some((r) => !r.ok && !r.skipped)) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
