"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatCny,
  formatDurationMinutes,
  getFlightWatchTrend,
  type FlightQuoteSummary,
  type FlightTrendPoint,
} from "@/lib/flight-watches";
import { FlightPriceTrendSection } from "@/components/FlightPriceTrend";

type FlightWatchFlightGroupsProps = {
  watchId: string;
  travelDate: string;
  latestQuotes: FlightQuoteSummary[];
  pinnedFlightNumbers?: string | null;
  refreshKey?: number;
};

type FlightGroup = {
  flightNumbers: string;
  quote: FlightQuoteSummary | null;
  points: FlightTrendPoint[];
  isPinned: boolean;
};

function Chevron() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-5 w-5 shrink-0 text-[color:var(--vv-on-surface-variant)] transition-transform group-open:rotate-180"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function matchesPinned(flightNumbers: string, pinned: string | null) {
  if (!pinned) return false;
  const tokens = flightNumbers.toUpperCase().split(/[\s,+]+/);
  return tokens.includes(pinned);
}

function QuoteDetailGrid({ quote }: { quote: FlightQuoteSummary }) {
  return (
    <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
      <div>
        <dt className="vv-muted text-xs">出发</dt>
        <dd className="mt-0.5 font-medium">{quote.departAt}</dd>
      </div>
      <div>
        <dt className="vv-muted text-xs">到达</dt>
        <dd className="mt-0.5 font-medium">{quote.arriveAt}</dd>
      </div>
      <div>
        <dt className="vv-muted text-xs">飞行时长</dt>
        <dd className="mt-0.5">{formatDurationMinutes(quote.durationMinutes)}</dd>
      </div>
      <div>
        <dt className="vv-muted text-xs">类型</dt>
        <dd className="mt-0.5">{quote.isDirect ? "直飞" : "中转"}</dd>
      </div>
      {quote.airlineName ? (
        <div>
          <dt className="vv-muted text-xs">航司</dt>
          <dd className="mt-0.5">{quote.airlineName}</dd>
        </div>
      ) : null}
      {quote.aircraft ? (
        <div>
          <dt className="vv-muted text-xs">机型</dt>
          <dd className="mt-0.5">{quote.aircraft}</dd>
        </div>
      ) : null}
      <div>
        <dt className="vv-muted text-xs">经济舱（最近）</dt>
        <dd className="mt-0.5 text-lg font-semibold">{formatCny(quote.priceEconomyCny)}</dd>
      </div>
      {quote.pricePremiumCny != null ? (
        <div>
          <dt className="vv-muted text-xs">超级经济舱</dt>
          <dd className="mt-0.5 font-medium">{formatCny(quote.pricePremiumCny)}</dd>
        </div>
      ) : null}
      {quote.priceBusinessCny != null ? (
        <div>
          <dt className="vv-muted text-xs">公务舱</dt>
          <dd className="mt-0.5 font-medium">{formatCny(quote.priceBusinessCny)}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function buildGroups(
  latestQuotes: FlightQuoteSummary[],
  trendFlights: Array<{ flightNumbers: string; points: FlightTrendPoint[] }>,
  pinned: string | null,
): FlightGroup[] {
  const map = new Map<string, FlightGroup>();

  for (const quote of latestQuotes) {
    map.set(quote.flightNumbers, {
      flightNumbers: quote.flightNumbers,
      quote,
      points: [],
      isPinned: matchesPinned(quote.flightNumbers, pinned),
    });
  }

  for (const flight of trendFlights) {
    const existing = map.get(flight.flightNumbers);
    if (existing) {
      existing.points = flight.points;
      continue;
    }
    map.set(flight.flightNumbers, {
      flightNumbers: flight.flightNumbers,
      quote: null,
      points: flight.points,
      isPinned: matchesPinned(flight.flightNumbers, pinned),
    });
  }

  return [...map.values()].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    const priceA = a.quote?.priceEconomyCny ?? a.points.at(-1)?.priceEconomyCny ?? Infinity;
    const priceB = b.quote?.priceEconomyCny ?? b.points.at(-1)?.priceEconomyCny ?? Infinity;
    if (priceA !== priceB) return priceA - priceB;
    return a.flightNumbers.localeCompare(b.flightNumbers);
  });
}

export function FlightWatchFlightGroups({
  watchId,
  travelDate,
  latestQuotes,
  pinnedFlightNumbers,
  refreshKey,
}: FlightWatchFlightGroupsProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendFlights, setTrendFlights] = useState<
    Array<{ flightNumbers: string; points: FlightTrendPoint[] }>
  >([]);

  const pinned = pinnedFlightNumbers?.trim().toUpperCase() ?? null;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getFlightWatchTrend(watchId);
        if (!cancelled) {
          setTrendFlights(data?.flights ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setTrendFlights([]);
          setError(err instanceof Error ? err.message : "加载价格曲线失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [watchId, refreshKey]);

  const groups = useMemo(
    () => buildGroups(latestQuotes, trendFlights, pinned),
    [latestQuotes, trendFlights, pinned],
  );

  if (groups.length === 0 && !loading) {
    return (
      <section className="vv-card rounded-[24px] border vv-border p-6">
        <h2 className="text-lg font-semibold">航班与价格</h2>
        <p className="vv-muted mt-3 text-sm">
          还没有航班数据。试抓一次或等 Mac Mini 定时抓取后，这里会按航班号分别展示明细与价格曲线。
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">航班与价格</h2>
        <p className="vv-muted text-sm">按航班号分组，展开查看明细与价格曲线</p>
      </div>

      {loading ? <p className="vv-muted text-sm">加载价格曲线…</p> : null}
      {error ? <p className="text-sm text-[color:var(--vv-error)]">{error}</p> : null}

      <div className="flex flex-col gap-3">
        {groups.map((group, index) => {
          const headerPrice =
            group.quote?.priceEconomyCny ??
            group.points.at(-1)?.priceEconomyCny ??
            null;
          const headerDepart = group.quote?.departAt;
          const headerArrive = group.quote?.arriveAt;
          const headerDuration = group.quote?.durationMinutes;
          const defaultOpen = groups.length === 1 || group.isPinned || index === 0;

          return (
            <details
              key={group.flightNumbers}
              open={defaultOpen}
              className="group vv-card overflow-hidden rounded-[20px] border vv-border"
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 sm:px-5 [&::-webkit-details-marker]:hidden">
                <Chevron />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold tracking-tight">
                      {group.flightNumbers}
                    </span>
                    {group.isPinned ? (
                      <span className="rounded-full bg-[color-mix(in_srgb,var(--vv-ocean)_14%,transparent)] px-2 py-0.5 text-xs font-medium text-[color:var(--vv-ocean)]">
                        主看
                      </span>
                    ) : null}
                    {group.points.length > 0 ? (
                      <span className="vv-muted text-xs">{group.points.length} 次观测</span>
                    ) : null}
                  </div>
                  {headerDepart && headerArrive ? (
                    <p className="vv-muted mt-0.5 text-sm">
                      {headerDepart} → {headerArrive}
                      {headerDuration != null
                        ? ` · ${formatDurationMinutes(headerDuration)}`
                        : ""}
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-xs text-[color:var(--vv-on-surface-variant)]">经济舱</p>
                  <p className="text-xl font-semibold">{formatCny(headerPrice)}</p>
                </div>
              </summary>

              <div className="flex flex-col gap-6 border-t vv-border px-4 py-5 sm:px-5">
                {group.quote ? (
                  <div>
                    <h3 className="mb-3 text-sm font-medium">航班明细（最近一次抓取）</h3>
                    <QuoteDetailGrid quote={group.quote} />
                  </div>
                ) : null}

                <div>
                  <h3 className="mb-3 text-sm font-medium">价格曲线</h3>
                  <FlightPriceTrendSection
                    flightNumbers={group.flightNumbers}
                    travelDate={travelDate}
                    points={group.points}
                    compact
                  />
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
