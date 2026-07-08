#!/usr/bin/env node
import http from "node:http";
import { URL } from "node:url";
import { scrapeCeairWatch } from "./lib/ceair-scraper.mjs";
import { openLocalD1 } from "./lib/local-d1.mjs";
import { loadWatch, persistScrapeResult } from "./lib/scrape-persist.mjs";

const PORT = Number(process.env.SCRAPE_SERVER_PORT ?? 8789);

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function handleScrape(watchId) {
  const { db } = openLocalD1();
  const watch = await loadWatch(db, watchId);
  const scrapeResult = await scrapeCeairWatch(watch, { headless: true });
  const persisted = await persistScrapeResult(db, watch, scrapeResult);
  return {
    ok: true,
    watchId,
    runId: persisted.runId,
    scrapeDate: persisted.scrapeDate,
    slot: persisted.slot,
    flightsFound: persisted.flightsFound ?? scrapeResult.flightsFound,
    minPriceCny: persisted.minPriceCny ?? scrapeResult.minPriceCny,
    skipped: persisted.skipped ?? false,
    message: persisted.message,
  };
}

const server = http.createServer((req, res) => {
  void (async () => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      const match = url.pathname.match(/^\/scrape\/([^/]+)\/?$/);
      if (!match) {
        sendJson(res, 404, { error: "not_found" });
        return;
      }

      if (req.method !== "POST") {
        sendJson(res, 405, { error: "method_not_allowed" });
        return;
      }

      const watchId = decodeURIComponent(match[1]);
      console.log(`[scrape] start watch=${watchId}`);
      const result = await handleScrape(watchId);
      console.log(`[scrape] ok watch=${watchId} flights=${result.flightsFound}`);
      sendJson(res, 200, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[scrape] failed: ${message}`);
      sendJson(res, 500, {
        error: "scrape_failed",
        message,
      });
    }
  })();
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Scrape server listening on http://127.0.0.1:${PORT}`);
});
