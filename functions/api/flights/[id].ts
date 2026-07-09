import { rowToQuote, rowToWatch, type FlightQuoteRow, type FlightWatchRow } from "../../lib/flights";
import { json, type PagesFunction } from "../../lib/http";

type LatestRunRow = {
  id: string;
  status: string;
  scrape_date: string;
  slot: string;
  min_price_cny: number | null;
  finished_at: string | null;
  requested_url: string | null;
  error_message: string | null;
  flights_found: number;
};

export const onRequestGet: PagesFunction = async ({ env, params }) => {
  const id = String(params.id ?? "");
  if (!id) return json({ error: "missing_id" }, { status: 400 });
  if (!env?.DB) return json({ error: "db_not_bound" }, { status: 500 });

  try {
    const row = await env.DB.prepare("SELECT * FROM flight_watches WHERE id = ?1")
      .bind(id)
      .first<FlightWatchRow>();

    if (!row) return json({ error: "not_found" }, { status: 404 });

    const latestRun = await env.DB.prepare(
      `SELECT id, status, scrape_date, slot, min_price_cny, finished_at,
              requested_url, error_message, flights_found
       FROM flight_scrape_runs
       WHERE watch_id = ?1
       ORDER BY scrape_date DESC, slot DESC
       LIMIT 1`,
    )
      .bind(id)
      .first<LatestRunRow>();

    const pinnedQuote = row.pinned_flight_numbers
      ? await env.DB.prepare(
          `SELECT q.flight_numbers, q.price_economy_cny, q.scraped_at, q.depart_at, q.arrive_at
           FROM flight_quotes q
           WHERE q.watch_id = ?1 AND q.flight_numbers = ?2
           ORDER BY q.scraped_at DESC
           LIMIT 1`,
        )
          .bind(id, row.pinned_flight_numbers)
          .first<{
            flight_numbers: string;
            price_economy_cny: number | null;
            scraped_at: string;
            depart_at: string;
            arrive_at: string;
          }>()
      : null;

    let latestQuotes: ReturnType<typeof rowToQuote>[] = [];
    if (latestRun?.status === "success") {
      const quotesResult = await env.DB.prepare(
        `SELECT flight_fingerprint, flight_numbers, airline_name, is_direct,
                depart_at, arrive_at, duration_minutes, aircraft,
                price_economy_cny, price_premium_cny, price_business_cny, scraped_at
         FROM flight_quotes
         WHERE run_id = ?1
         ORDER BY price_economy_cny ASC, depart_at ASC`,
      )
        .bind(latestRun.id)
        .all<FlightQuoteRow>();
      latestQuotes = (quotesResult.results ?? []).map(rowToQuote);
    }

    return json(
      {
        watch: rowToWatch(row),
        latestRun: latestRun
          ? {
              id: latestRun.id,
              status: latestRun.status,
              scrapeDate: latestRun.scrape_date,
              slot: latestRun.slot,
              minPriceCny: latestRun.min_price_cny,
              observedAt: latestRun.finished_at,
              requestedUrl: latestRun.requested_url,
              errorMessage: latestRun.error_message,
              flightsFound: latestRun.flights_found,
            }
          : null,
        pinnedQuote: pinnedQuote
          ? {
              flightNumbers: pinnedQuote.flight_numbers,
              priceEconomyCny: pinnedQuote.price_economy_cny,
              scrapedAt: pinnedQuote.scraped_at,
              departAt: pinnedQuote.depart_at,
              arriveAt: pinnedQuote.arrive_at,
            }
          : null,
        latestQuotes,
      },
      { status: 200 },
    );
  } catch {
    return json({ error: "db_query_failed" }, { status: 500 });
  }
};

export const onRequestPatch: PagesFunction = async ({ env, params, request }) => {
  const id = String(params.id ?? "");
  if (!id) return json({ error: "missing_id" }, { status: 400 });
  if (!env?.DB) return json({ error: "db_not_bound" }, { status: 500 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return json({ error: "invalid_body" }, { status: 400 });

  const updates: string[] = [];
  const values: unknown[] = [];

  if ("label" in body) {
    const label = String(body.label ?? "").trim();
    if (!label) return json({ error: "invalid_label" }, { status: 400 });
    updates.push("label = ?");
    values.push(label);
  }

  if ("enabled" in body) {
    updates.push("enabled = ?");
    values.push(body.enabled === false ? 0 : 1);
  }

  if ("pinnedFlightNumbers" in body) {
    const pinned =
      body.pinnedFlightNumbers == null
        ? null
        : String(body.pinnedFlightNumbers).trim().toUpperCase() || null;
    updates.push("pinned_flight_numbers = ?");
    values.push(pinned);
  }

  if (updates.length === 0) return json({ error: "nothing_to_update" }, { status: 400 });

  const now = new Date().toISOString();
  updates.push("updated_at = ?");
  values.push(now);
  values.push(id);

  try {
    const existing = await env.DB.prepare("SELECT id FROM flight_watches WHERE id = ?1")
      .bind(id)
      .first<{ id: string }>();
    if (!existing) return json({ error: "not_found" }, { status: 404 });

    await env.DB.prepare(
      `UPDATE flight_watches SET ${updates.join(", ")} WHERE id = ?`,
    )
      .bind(...values)
      .run();

    const row = await env.DB.prepare("SELECT * FROM flight_watches WHERE id = ?1")
      .bind(id)
      .first<FlightWatchRow>();

    return json({ watch: row ? rowToWatch(row) : null }, { status: 200 });
  } catch {
    return json({ error: "db_query_failed" }, { status: 500 });
  }
};

export const onRequestDelete: PagesFunction = async ({ env, params }) => {
  const id = String(params.id ?? "");
  if (!id) return json({ error: "missing_id" }, { status: 400 });
  if (!env?.DB) return json({ error: "db_not_bound" }, { status: 500 });

  try {
    const existing = await env.DB.prepare("SELECT id FROM flight_watches WHERE id = ?1")
      .bind(id)
      .first<{ id: string }>();
    if (!existing) return json({ error: "not_found" }, { status: 404 });

    await env.DB.prepare("DELETE FROM flight_quotes WHERE watch_id = ?1").bind(id).run();
    await env.DB.prepare("DELETE FROM flight_scrape_runs WHERE watch_id = ?1").bind(id).run();
    await env.DB.prepare("DELETE FROM flight_watches WHERE id = ?1").bind(id).run();

    return json({ ok: true }, { status: 200 });
  } catch {
    return json({ error: "db_query_failed" }, { status: 500 });
  }
};
