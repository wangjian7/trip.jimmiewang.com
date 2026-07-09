import type { FlightWatchRow, ScrapeResult } from "./types";

export function beijingPartsFromTimestamp(timestampMs: number) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(timestampMs)).map((part) => [part.type, part.value]),
  );
  const scrapeDate = `${parts.year}-${parts.month}-${parts.day}`;
  const hour = Number(parts.hour);
  const slot = hour < 12 ? "am" : "pm";
  return { scrapeDate, slot: slot as "am" | "pm" };
}

function makeRunId(watchId: string, scrapeDate: string, slot: string) {
  return `run-${watchId}-${scrapeDate}-${slot}`;
}

function makeQuoteId(runId: string, fingerprint: string) {
  return `quote-${runId}-${fingerprint.replaceAll("|", "-")}`;
}

type ExistingRun = { id: string; status: string };

async function getExistingRun(
  db: D1Database,
  watchId: string,
  scrapeDate: string,
  slot: string,
) {
  return db
    .prepare(
      "SELECT id, status FROM flight_scrape_runs WHERE watch_id = ? AND scrape_date = ? AND slot = ?",
    )
    .bind(watchId, scrapeDate, slot)
    .first<ExistingRun>();
}

export async function beginScrapeRun(
  db: D1Database,
  watch: FlightWatchRow,
  url: string,
  timestampMs: number,
) {
  const now = new Date().toISOString();
  const { scrapeDate, slot } = beijingPartsFromTimestamp(timestampMs);
  const runId = makeRunId(watch.id, scrapeDate, slot);

  const existingRun = await getExistingRun(db, watch.id, scrapeDate, slot);
  if (existingRun?.status === "success") {
    return { runId: existingRun.id, scrapeDate, slot, skipped: true as const };
  }

  const activeRunId = existingRun?.id ?? runId;

  if (existingRun) {
    await db
      .prepare(
        `UPDATE flight_scrape_runs
         SET status = 'running', started_at = ?, finished_at = NULL, error_message = NULL,
             requested_url = ?, flights_found = 0, min_price_cny = NULL
         WHERE id = ?`,
      )
      .bind(now, url, activeRunId)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO flight_scrape_runs (
           id, watch_id, scrape_date, slot, started_at, status, requested_url, flights_found
         ) VALUES (?, ?, ?, ?, ?, 'running', ?, 0)`,
      )
      .bind(activeRunId, watch.id, scrapeDate, slot, now, url)
      .run();
  }

  return { runId: activeRunId, scrapeDate, slot, skipped: false as const };
}

export async function persistScrapeResult(
  db: D1Database,
  watch: FlightWatchRow,
  scrapeResult: ScrapeResult,
  timestampMs: number,
) {
  const now = new Date().toISOString();
  const { scrapeDate, slot } = beijingPartsFromTimestamp(timestampMs);
  const runId = makeRunId(watch.id, scrapeDate, slot);

  const existingRun = await getExistingRun(db, watch.id, scrapeDate, slot);
  if (existingRun?.status === "success") {
    return {
      runId: existingRun.id,
      scrapeDate,
      slot,
      skipped: true,
      message: `今天${slot === "am" ? "上午" : "下午"}已成功抓取过，跳过重复写入。`,
    };
  }

  const activeRunId = existingRun?.id ?? runId;

  if (existingRun) {
    await db
      .prepare(
        `UPDATE flight_scrape_runs
         SET status = 'running', started_at = ?, finished_at = NULL, error_message = NULL,
             requested_url = ?, flights_found = 0, min_price_cny = NULL
         WHERE id = ?`,
      )
      .bind(now, scrapeResult.url, activeRunId)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO flight_scrape_runs (
           id, watch_id, scrape_date, slot, started_at, status, requested_url, flights_found
         ) VALUES (?, ?, ?, ?, ?, 'running', ?, 0)`,
      )
      .bind(activeRunId, watch.id, scrapeDate, slot, now, scrapeResult.url)
      .run();
  }

  await db.prepare("DELETE FROM flight_quotes WHERE run_id = ?").bind(activeRunId).run();

  for (const flight of scrapeResult.flights) {
    await db
      .prepare(
        `INSERT INTO flight_quotes (
           id, run_id, watch_id, flight_fingerprint, flight_numbers, airline_name, is_direct,
           travel_date, depart_at, arrive_at, duration_minutes, aircraft,
           price_economy_cny, price_premium_cny, price_business_cny, scraped_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
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
      )
      .run();
  }

  await db
    .prepare(
      `UPDATE flight_scrape_runs
       SET status = 'success', finished_at = ?, flights_found = ?, min_price_cny = ?, error_message = NULL
       WHERE id = ?`,
    )
    .bind(now, scrapeResult.flightsFound, scrapeResult.minPriceCny, activeRunId)
    .run();

  return {
    runId: activeRunId,
    scrapeDate,
    slot,
    skipped: false,
    flightsFound: scrapeResult.flightsFound,
    minPriceCny: scrapeResult.minPriceCny,
    message: `抓取成功，写入 ${scrapeResult.flightsFound} 条航班报价。`,
  };
}

export async function failScrapeRun(
  db: D1Database,
  watch: FlightWatchRow,
  url: string,
  errorMessage: string,
  timestampMs: number,
) {
  const now = new Date().toISOString();
  const { scrapeDate, slot } = beijingPartsFromTimestamp(timestampMs);
  const runId = makeRunId(watch.id, scrapeDate, slot);

  const existingRun = await getExistingRun(db, watch.id, scrapeDate, slot);
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
    await db
      .prepare(
        `UPDATE flight_scrape_runs
         SET status = 'failed', finished_at = ?, error_message = ?, requested_url = ?
         WHERE id = ?`,
      )
      .bind(now, errorMessage, url, activeRunId)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO flight_scrape_runs (
           id, watch_id, scrape_date, slot, started_at, finished_at, status,
           requested_url, error_message, flights_found
         ) VALUES (?, ?, ?, ?, ?, ?, 'failed', ?, ?, 0)`,
      )
      .bind(activeRunId, watch.id, scrapeDate, slot, now, now, url, errorMessage)
      .run();
  }

  return { runId: activeRunId, scrapeDate, slot, skipped: false, message: errorMessage };
}

export async function loadEnabledWatches(db: D1Database, watchId?: string) {
  if (watchId) {
    const row = await db
      .prepare("SELECT * FROM flight_watches WHERE id = ? AND enabled = 1")
      .bind(watchId)
      .first<FlightWatchRow>();
    return row ? [row] : [];
  }

  const { results } = await db
    .prepare("SELECT * FROM flight_watches WHERE enabled = 1 ORDER BY created_at ASC")
    .all<FlightWatchRow>();
  return results ?? [];
}
