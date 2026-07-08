import { rowToWatch, type FlightWatchRow } from "../../../lib/flights";
import { json, type PagesFunction } from "../../../lib/http";

type TrendRow = {
  scrape_date: string;
  slot: string;
  price_economy_cny: number | null;
  scraped_at: string;
  flight_numbers: string;
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

    const watch = rowToWatch(row);
    let rows: TrendRow[] = [];

    if (row.pinned_flight_numbers) {
      const result = await env.DB.prepare(
        `SELECT r.scrape_date, r.slot, q.price_economy_cny, q.scraped_at, q.flight_numbers
         FROM flight_quotes q
         JOIN flight_scrape_runs r ON r.id = q.run_id
         WHERE q.watch_id = ?1
           AND q.flight_numbers = ?2
           AND r.status = 'success'
         ORDER BY q.scraped_at ASC`,
      )
        .bind(id, row.pinned_flight_numbers)
        .all<TrendRow>();
      rows = result.results ?? [];
    } else {
      const result = await env.DB.prepare(
        `SELECT r.scrape_date, r.slot,
                MIN(q.price_economy_cny) AS price_economy_cny,
                MAX(q.scraped_at) AS scraped_at,
                MIN(q.flight_numbers) AS flight_numbers
         FROM flight_scrape_runs r
         JOIN flight_quotes q ON q.run_id = r.id
         WHERE r.watch_id = ?1
           AND r.status = 'success'
           AND q.price_economy_cny IS NOT NULL
           AND (?2 = 0 OR q.is_direct = 1)
         GROUP BY r.id
         ORDER BY scraped_at ASC`,
      )
        .bind(id, row.direct_only)
        .all<TrendRow>();
      rows = result.results ?? [];
    }

    let previous: number | null = null;
    const points = rows.map((entry) => {
      const price = entry.price_economy_cny;
      const deltaCny =
        price != null && previous != null ? price - previous : null;
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

    const label = row.pinned_flight_numbers
      ? row.pinned_flight_numbers
      : row.direct_only
        ? "直飞最低价"
        : "航线最低价";

    return json(
      {
        flightNumbers: row.pinned_flight_numbers,
        label,
        travelDate: row.travel_date,
        points,
      },
      { status: 200 },
    );
  } catch {
    return json({ error: "db_query_failed" }, { status: 500 });
  }
};
