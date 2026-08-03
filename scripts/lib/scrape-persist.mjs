import * as localD1 from "./local-d1.mjs";
import { isFlightWatchArchived } from "../../shared/flight-watch-archive.mjs";

async function resolveDb(db) {
  if (db?.kind === "remote") {
    const remote = await import("./remote-d1.mjs");
    return { dbGet: remote.dbGet, dbRun: remote.dbRun, dbAll: remote.dbAll };
  }
  return { dbGet: localD1.dbGet, dbRun: localD1.dbRun, dbAll: localD1.dbAll };
}

function beijingNowParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  const scrapeDate = `${parts.year}-${parts.month}-${parts.day}`;
  const hour = Number(parts.hour);
  const slot = hour < 12 ? "am" : "pm";
  return { scrapeDate, slot };
}

function makeRunId(watchId, scrapeDate, slot) {
  return `run-${watchId}-${scrapeDate}-${slot}`;
}

function makeQuoteId(runId, fingerprint) {
  return `quote-${runId}-${fingerprint.replaceAll("|", "-")}`;
}

export async function persistScrapeResult(db, watch, scrapeResult) {
  const { dbGet, dbRun } = await resolveDb(db);
  const now = new Date().toISOString();
  const { scrapeDate, slot } = beijingNowParts();
  const runId = makeRunId(watch.id, scrapeDate, slot);

  const existingRun = await dbGet(
    db,
    "SELECT id, status FROM flight_scrape_runs WHERE watch_id = ? AND scrape_date = ? AND slot = ?",
    [watch.id, scrapeDate, slot],
  );

  if (existingRun?.status === "success") {
    return {
      runId: existingRun.id,
      scrapeDate,
      slot,
      skipped: true,
      message: `今天${slot === "am" ? "上午" : "下午"}已成功抓取过，跳过重复写入。`,
    };
  }

  if (existingRun) {
    await dbRun(
      db,
      `UPDATE flight_scrape_runs
       SET status = 'running', started_at = ?, finished_at = NULL, error_message = NULL,
           requested_url = ?, flights_found = 0, min_price_cny = NULL
       WHERE id = ?`,
      [now, scrapeResult.url, existingRun.id],
    );
  } else {
    await dbRun(
      db,
      `INSERT INTO flight_scrape_runs (
         id, watch_id, scrape_date, slot, started_at, status, requested_url, flights_found
       ) VALUES (?, ?, ?, ?, ?, 'running', ?, 0)`,
      [runId, watch.id, scrapeDate, slot, now, scrapeResult.url],
    );
  }

  const activeRunId = existingRun?.id ?? runId;

  try {
    await dbRun(db, "DELETE FROM flight_quotes WHERE run_id = ?", [activeRunId]);

    for (const flight of scrapeResult.flights) {
      await dbRun(
        db,
        `INSERT INTO flight_quotes (
           id, run_id, watch_id, flight_fingerprint, flight_numbers, airline_name, is_direct,
           travel_date, depart_at, arrive_at, duration_minutes, aircraft,
           price_economy_cny, price_premium_cny, price_business_cny, scraped_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          makeQuoteId(activeRunId, flight.flightFingerprint),
          activeRunId,
          watch.id,
          flight.flightFingerprint,
          flight.flightNumbers,
          flight.airlineName,
          flight.isDirect,
          flight.travelDate,
          flight.departAt,
          flight.arriveAt,
          flight.durationMinutes,
          flight.aircraft,
          flight.priceEconomyCny,
          flight.pricePremiumCny,
          flight.priceBusinessCny,
          now,
        ],
      );
    }

    await dbRun(
      db,
      `UPDATE flight_scrape_runs
       SET status = 'success', finished_at = ?, flights_found = ?, min_price_cny = ?, error_message = NULL
       WHERE id = ?`,
      [now, scrapeResult.flightsFound, scrapeResult.minPriceCny, activeRunId],
    );

    return {
      runId: activeRunId,
      scrapeDate,
      slot,
      skipped: false,
      flightsFound: scrapeResult.flightsFound,
      minPriceCny: scrapeResult.minPriceCny,
      message: `抓取成功，写入 ${scrapeResult.flightsFound} 条航班报价。`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await dbRun(
      db,
      `UPDATE flight_scrape_runs
       SET status = 'failed', finished_at = ?, error_message = ?
       WHERE id = ?`,
      [now, message, activeRunId],
    );
    throw error;
  }
}

export async function loadWatch(db, watchId) {
  const { dbGet } = await resolveDb(db);
  const watch = await dbGet(db, "SELECT * FROM flight_watches WHERE id = ?", [watchId]);
  if (!watch) throw new Error(`找不到关注：${watchId}`);
  if (watch.enabled !== 1) throw new Error(`关注已停用：${watchId}`);
  if (isFlightWatchArchived(watch.travel_date)) {
    throw new Error(`关注已归档，不再抓取：${watchId}`);
  }
  return watch;
}

export async function loadEnabledWatches(db) {
  const { dbAll } = await resolveDb(db);
  const watches = await dbAll(
    db,
    "SELECT * FROM flight_watches WHERE enabled = 1 ORDER BY created_at ASC",
  );
  return watches.filter((watch) => !isFlightWatchArchived(watch.travel_date));
}

export async function failScrapeRun(db, watch, url, errorMessage) {
  const { dbGet, dbRun } = await resolveDb(db);
  const now = new Date().toISOString();
  const { scrapeDate, slot } = beijingNowParts();
  const runId = makeRunId(watch.id, scrapeDate, slot);

  const existingRun = await dbGet(
    db,
    "SELECT id, status FROM flight_scrape_runs WHERE watch_id = ? AND scrape_date = ? AND slot = ?",
    [watch.id, scrapeDate, slot],
  );

  if (existingRun?.status === "success") {
    return {
      runId: existingRun.id,
      scrapeDate,
      slot,
      skipped: true,
      message: `今天${slot === "am" ? "上午" : "下午"}已成功抓取过，跳过失败覆盖。`,
    };
  }

  const activeRunId = existingRun?.id ?? runId;

  if (existingRun) {
    await dbRun(
      db,
      `UPDATE flight_scrape_runs
       SET status = 'failed', finished_at = ?, error_message = ?, requested_url = ?
       WHERE id = ?`,
      [now, errorMessage, url, activeRunId],
    );
  } else {
    await dbRun(
      db,
      `INSERT INTO flight_scrape_runs (
         id, watch_id, scrape_date, slot, started_at, finished_at, status,
         requested_url, error_message, flights_found
       ) VALUES (?, ?, ?, ?, ?, ?, 'failed', ?, ?, 0)`,
      [activeRunId, watch.id, scrapeDate, slot, now, now, url, errorMessage],
    );
  }

  return { runId: activeRunId, scrapeDate, slot, skipped: false, message: errorMessage };
}
