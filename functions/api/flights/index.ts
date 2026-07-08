import { buildWatchId, rowToWatch, type FlightWatchRow } from "../../lib/flights";
import { json, type PagesFunction } from "../../lib/http";

type WatchListRow = FlightWatchRow & {
  last_status: string | null;
  last_scrape_date: string | null;
  last_slot: string | null;
  last_min_price_cny: number | null;
  last_observed_at: string | null;
};

function parseCreateBody(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;

  const originCode = String(data.originCode ?? "").trim().toUpperCase();
  const destCode = String(data.destCode ?? "").trim().toUpperCase();
  const travelDate = String(data.travelDate ?? "").trim();
  if (!originCode || !destCode || !/^\d{4}-\d{2}-\d{2}$/.test(travelDate)) {
    return null;
  }

  const label = String(data.label ?? "").trim();
  const tripSlug = data.tripSlug == null ? null : String(data.tripSlug).trim() || null;
  const directOnly = data.directOnly === false ? 0 : 1;
  const cabin = String(data.cabin ?? "economy").trim() || "economy";
  const adultCount = Number(data.adultCount ?? 1);
  const source = String(data.source ?? "ceair").trim() || "ceair";
  const sourceUrl =
    data.sourceUrl == null ? null : String(data.sourceUrl).trim() || null;
  const pinnedFlightNumbers =
    data.pinnedFlightNumbers == null
      ? null
      : String(data.pinnedFlightNumbers).trim().toUpperCase() || null;

  return {
    originCode,
    destCode,
    travelDate,
    label,
    tripSlug,
    directOnly,
    cabin,
    adultCount: Number.isFinite(adultCount) && adultCount > 0 ? adultCount : 1,
    source,
    sourceUrl,
    pinnedFlightNumbers,
  };
}

export const onRequestGet: PagesFunction = async ({ env }) => {
  if (!env?.DB) return json({ error: "db_not_bound" }, { status: 500 });

  try {
    const result = await env.DB.prepare(
      `SELECT
         w.*,
         r.status AS last_status,
         r.scrape_date AS last_scrape_date,
         r.slot AS last_slot,
         r.min_price_cny AS last_min_price_cny,
         r.finished_at AS last_observed_at
       FROM flight_watches w
       LEFT JOIN flight_scrape_runs r ON r.id = (
         SELECT id
         FROM flight_scrape_runs
         WHERE watch_id = w.id
         ORDER BY scrape_date DESC, slot DESC
         LIMIT 1
       )
       ORDER BY w.travel_date ASC, w.created_at DESC`,
    ).all<WatchListRow>();

    const watches = (result.results ?? []).map((row) => ({
      ...rowToWatch(row),
      latestRun: row.last_status
        ? {
            status: row.last_status,
            scrapeDate: row.last_scrape_date,
            slot: row.last_slot,
            minPriceCny: row.last_min_price_cny,
            observedAt: row.last_observed_at,
          }
        : null,
    }));

    return json({ watches }, { status: 200 });
  } catch {
    return json({ error: "db_query_failed" }, { status: 500 });
  }
};

export const onRequestPost: PagesFunction = async ({ env, request }) => {
  if (!env?.DB) return json({ error: "db_not_bound" }, { status: 500 });

  const parsed = parseCreateBody(await request.json().catch(() => null));
  if (!parsed) return json({ error: "invalid_body" }, { status: 400 });

  const id = buildWatchId(parsed.originCode, parsed.destCode, parsed.travelDate);
  const now = new Date().toISOString();
  const label =
    parsed.label ||
    `${parsed.travelDate.slice(5)} ${parsed.originCode}→${parsed.destCode}`;

  try {
    const existing = await env.DB.prepare("SELECT id FROM flight_watches WHERE id = ?1")
      .bind(id)
      .first<{ id: string }>();

    if (existing) {
      return json({ error: "watch_exists", id }, { status: 409 });
    }

    await env.DB.prepare(
      `INSERT INTO flight_watches (
         id, trip_slug, label, origin_code, dest_code, travel_date,
         direct_only, cabin, adult_count, source, source_url,
         pinned_flight_numbers, enabled, created_at, updated_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 1, ?13, ?14)`,
    )
      .bind(
        id,
        parsed.tripSlug,
        label,
        parsed.originCode,
        parsed.destCode,
        parsed.travelDate,
        parsed.directOnly,
        parsed.cabin,
        parsed.adultCount,
        parsed.source,
        parsed.sourceUrl,
        parsed.pinnedFlightNumbers,
        now,
        now,
      )
      .run();

    const row = await env.DB.prepare("SELECT * FROM flight_watches WHERE id = ?1")
      .bind(id)
      .first<FlightWatchRow>();

    if (!row) return json({ error: "db_query_failed" }, { status: 500 });

    return json({ watch: rowToWatch(row) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE constraint failed")) {
      return json({ error: "watch_exists", id }, { status: 409 });
    }
    return json({ error: "db_query_failed" }, { status: 500 });
  }
};
