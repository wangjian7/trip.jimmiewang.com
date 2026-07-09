import { rowToWatch, type FlightWatchRow } from "../../lib/flights";
import { beijingScheduleContext, type ScheduleSlotId } from "../../lib/schedule";
import { json, type PagesFunction } from "../../lib/http";

type RunRow = {
  id: string;
  watch_id: string;
  scrape_date: string;
  slot: string;
  status: string;
  min_price_cny: number | null;
  finished_at: string | null;
  error_message: string | null;
  flights_found: number;
  started_at: string;
};

type RecentRunRow = RunRow & {
  label: string;
};

function slotRunPayload(run: RunRow | undefined) {
  if (!run) return null;
  return {
    runId: run.id,
    status: run.status,
    minPriceCny: run.min_price_cny,
    observedAt: run.finished_at,
    errorMessage: run.error_message,
    flightsFound: run.flights_found,
  };
}

function slotState(
  enabled: boolean,
  slot: ScheduleSlotId,
  run: RunRow | undefined,
  ctx: ReturnType<typeof beijingScheduleContext>,
): "disabled" | "pending" | "success" | "failed" | "running" | "missed" {
  if (!enabled) return "disabled";
  if (run?.status === "success") return "success";
  if (run?.status === "failed") return "failed";
  if (run?.status === "running") return "running";
  if (ctx.todayPassedSlots.includes(slot)) return "missed";
  return "pending";
}

export const onRequestGet: PagesFunction = async ({ env }) => {
  if (!env?.DB) return json({ error: "db_not_bound" }, { status: 500 });

  const ctx = beijingScheduleContext();

  try {
    const watchesResult = await env.DB.prepare(
      `SELECT * FROM flight_watches ORDER BY enabled DESC, travel_date ASC, created_at DESC`,
    ).all<FlightWatchRow>();

    const runsToday = await env.DB.prepare(
      `SELECT id, watch_id, scrape_date, slot, status, min_price_cny, finished_at,
              error_message, flights_found, started_at
       FROM flight_scrape_runs
       WHERE scrape_date = ?1`,
    )
      .bind(ctx.today)
      .all<RunRow>();

    const recent = await env.DB.prepare(
      `SELECT r.id, r.watch_id, r.scrape_date, r.slot, r.status, r.min_price_cny,
              r.finished_at, r.error_message, r.flights_found, r.started_at, w.label
       FROM flight_scrape_runs r
       JOIN flight_watches w ON w.id = r.watch_id
       ORDER BY r.started_at DESC
       LIMIT 30`,
    ).all<RecentRunRow>();

    const runsByWatch = new Map<string, Map<string, RunRow>>();
    for (const run of runsToday.results ?? []) {
      if (!runsByWatch.has(run.watch_id)) runsByWatch.set(run.watch_id, new Map());
      runsByWatch.get(run.watch_id)!.set(run.slot, run);
    }

    const watches = (watchesResult.results ?? []).map((row) => {
      const watch = rowToWatch(row);
      const todayRuns = runsByWatch.get(row.id) ?? new Map<string, RunRow>();
      const amRun = todayRuns.get("am");
      const pmRun = todayRuns.get("pm");

      return {
        ...watch,
        schedule: {
          am: {
            state: slotState(watch.enabled, "am", amRun, ctx),
            run: slotRunPayload(amRun),
          },
          pm: {
            state: slotState(watch.enabled, "pm", pmRun, ctx),
            run: slotRunPayload(pmRun),
          },
        },
      };
    });

    return json(
      {
        scheduler: {
          name: "Mac Mini launchd",
          executor: "npm run scrape:remote -- --all",
          timezone: ctx.timezone,
          slots: ctx.slots,
          enabledWatchCount: watches.filter((w) => w.enabled).length,
        },
        today: ctx.today,
        now: ctx.nowIso,
        nextRun: ctx.nextRun,
        watches,
        recentRuns: (recent.results ?? []).map((run) => ({
          runId: run.id,
          watchId: run.watch_id,
          label: run.label,
          scrapeDate: run.scrape_date,
          slot: run.slot,
          status: run.status,
          minPriceCny: run.min_price_cny,
          observedAt: run.finished_at,
          errorMessage: run.error_message,
          flightsFound: run.flights_found,
        })),
      },
      { status: 200 },
    );
  } catch {
    return json({ error: "db_query_failed" }, { status: 500 });
  }
};
