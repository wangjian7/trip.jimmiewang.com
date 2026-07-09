import type { FlightWatchRow } from "../../../lib/flights";
import { json, type PagesFunction } from "../../../lib/http";

type TrendRow = {
  scrape_date: string;
  slot: string;
  price_economy_cny: number | null;
  scraped_at: string;
  flight_numbers: string;
};

function buildPoints(rows: TrendRow[]) {
  let previous: number | null = null;
  return rows.map((entry) => {
    const price = entry.price_economy_cny;
    const deltaCny = price != null && previous != null ? price - previous : null;
    if (price != null) previous = price;

    return {
      scrapeDate: entry.scrape_date,
      slot: entry.slot,
      scrapedAt: entry.scraped_at,
      priceEconomyCny: price,
      flightNumbers: entry.flight_numbers,
      deltaCny,
    };
  });
}

export const onRequestGet: PagesFunction = async ({ env, params }) => {
  const id = String(params.id ?? "");
  if (!id) return json({ error: "missing_id" }, { status: 400 });
  if (!env?.DB) return json({ error: "db_not_bound" }, { status: 500 });

  try {
    const row = await env.DB.prepare("SELECT * FROM flight_watches WHERE id = ?1")
      .bind(id)
      .first<FlightWatchRow>();

    if (!row) return json({ error: "not_found" }, { status: 404 });

    const result = await env.DB.prepare(
      `SELECT r.scrape_date, r.slot, q.price_economy_cny, q.scraped_at, q.flight_numbers
       FROM flight_quotes q
       JOIN flight_scrape_runs r ON r.id = q.run_id
       WHERE q.watch_id = ?1
         AND r.status = 'success'
         AND q.price_economy_cny IS NOT NULL
         AND (?2 = 0 OR q.is_direct = 1)
       ORDER BY q.flight_numbers ASC, q.scraped_at ASC`,
    )
      .bind(id, row.direct_only)
      .all<TrendRow>();

    const grouped = new Map<string, TrendRow[]>();
    for (const entry of result.results ?? []) {
      const bucket = grouped.get(entry.flight_numbers) ?? [];
      bucket.push(entry);
      grouped.set(entry.flight_numbers, bucket);
    }

    const flights = [...grouped.entries()]
      .map(([flightNumbers, rows]) => ({
        flightNumbers,
        points: buildPoints(rows),
      }))
      .sort((a, b) => a.flightNumbers.localeCompare(b.flightNumbers));

    return json(
      {
        travelDate: row.travel_date,
        flights,
      },
      { status: 200 },
    );
  } catch {
    return json({ error: "db_query_failed" }, { status: 500 });
  }
};
