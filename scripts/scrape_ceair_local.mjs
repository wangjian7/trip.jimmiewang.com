#!/usr/bin/env node
import { scrapeCeairWatch } from "./lib/ceair-scraper.mjs";
import { openLocalD1 } from "./lib/local-d1.mjs";
import { loadWatch, persistScrapeResult } from "./lib/scrape-persist.mjs";

function parseArgs(argv) {
  let watchId = null;
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
    if (arg === "--headed") {
      headless = false;
    }
  }

  return { watchId, headless };
}

async function main() {
  const { watchId, headless } = parseArgs(process.argv.slice(2));
  if (!watchId) {
    console.error("用法: node scripts/scrape_ceair_local.mjs --watch-id fw-sha-bne-20260930");
    process.exit(1);
  }

  const { db, dbPath } = openLocalD1();
  console.log(`使用本地 D1: ${dbPath}`);

  const watch = await loadWatch(db, watchId);
  console.log(`开始抓取: ${watch.label}`);
  console.log(`数据源: ${watch.source}`);

  const scrapeResult = await scrapeCeairWatch(watch, { headless });
  const persisted = await persistScrapeResult(db, watch, scrapeResult);

  console.log(persisted.message);
  console.log(
    JSON.stringify(
      {
        watchId,
        runId: persisted.runId,
        scrapeDate: persisted.scrapeDate,
        slot: persisted.slot,
        flightsFound: persisted.flightsFound ?? scrapeResult.flightsFound,
        minPriceCny: persisted.minPriceCny ?? scrapeResult.minPriceCny,
        skipped: persisted.skipped ?? false,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
