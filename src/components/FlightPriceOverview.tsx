import {
  formatCny,
  formatObservedAt,
  type FlightQuoteSummary,
  type FlightWatchDetail,
} from "@/lib/flight-watches";

export type LatestQuoteSummary = {
  flightNumbers: string[];
  count: number;
  minQuote: FlightQuoteSummary;
  maxQuote: FlightQuoteSummary;
  allSamePrice: boolean;
};

export function summarizeLatestQuotes(
  quotes: FlightQuoteSummary[],
): LatestQuoteSummary | null {
  const priced = quotes.filter((quote) => quote.priceEconomyCny != null);
  if (priced.length === 0) return null;

  let minQuote = priced[0];
  let maxQuote = priced[0];

  for (const quote of priced) {
    if ((quote.priceEconomyCny as number) < (minQuote.priceEconomyCny as number)) {
      minQuote = quote;
    }
    if ((quote.priceEconomyCny as number) > (maxQuote.priceEconomyCny as number)) {
      maxQuote = quote;
    }
  }

  return {
    flightNumbers: priced.map((quote) => quote.flightNumbers),
    count: priced.length,
    minQuote,
    maxQuote,
    allSamePrice: minQuote.priceEconomyCny === maxQuote.priceEconomyCny,
  };
}

function formatTimeRange(departAt: string, arriveAt: string) {
  return `${departAt} → ${arriveAt}`;
}

type FlightPriceOverviewProps = {
  watch: FlightWatchDetail["watch"];
  latestRun: FlightWatchDetail["latestRun"];
  latestQuotes: FlightQuoteSummary[];
  pinnedQuote: FlightWatchDetail["pinnedQuote"];
  scrapeMessage?: string | null;
  scrapeError?: string | null;
};

export function FlightPriceOverview({
  watch,
  latestRun,
  latestQuotes,
  pinnedQuote,
  scrapeMessage,
  scrapeError,
}: FlightPriceOverviewProps) {
  const summary = summarizeLatestQuotes(latestQuotes);
  const pinned = watch.pinnedFlightNumbers?.trim().toUpperCase() ?? null;

  return (
    <div className="vv-card rounded-[24px] border vv-border p-6 lg:col-span-2">
      <h2 className="text-lg font-semibold">价格概览</h2>

      {!latestRun ? (
        <p className="vv-muted mt-4 text-sm">
          尚未有抓取记录。Mac Mini 每天 09:00 / 15:00 自动更新。
        </p>
      ) : latestRun.status === "failed" ? (
        <p className="mt-4 text-sm text-[color:var(--vv-error)]">
          最近抓取失败：{latestRun.errorMessage ?? "未知错误"}
        </p>
      ) : summary ? (
        <div className="mt-4 flex flex-col gap-5">
          <div>
            <p className="vv-muted text-xs">
              航班号（最近一次抓取 · {summary.count} 个）
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {summary.flightNumbers.map((flightNumbers) => {
                const isPinned =
                  pinned != null &&
                  flightNumbers.toUpperCase().split(/[\s,+]+/).includes(pinned);
                return (
                  <span
                    key={flightNumbers}
                    className={`rounded-full px-3 py-1 text-sm font-medium ${
                      isPinned
                        ? "bg-[color-mix(in_srgb,var(--vv-ocean)_14%,transparent)] text-[color:var(--vv-ocean)]"
                        : "bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)]"
                    }`}
                  >
                    {flightNumbers}
                    {isPinned ? " · 主看" : ""}
                  </span>
                );
              })}
            </div>
          </div>

          <div
            className={`grid grid-cols-1 gap-4 ${summary.count > 1 ? "sm:grid-cols-2" : ""}`}
          >
            <div className="rounded-2xl border vv-border px-4 py-3">
              <p className="vv-muted text-xs">
                {summary.count > 1 ? "最低经济舱" : "经济舱（最近一次）"}
              </p>
              <p className="mt-1 text-3xl font-semibold">
                {formatCny(summary.minQuote.priceEconomyCny)}
              </p>
              <p className="mt-2 text-sm font-medium">{summary.minQuote.flightNumbers}</p>
              <p className="vv-muted text-sm">
                {formatTimeRange(summary.minQuote.departAt, summary.minQuote.arriveAt)}
              </p>
            </div>

            {summary.count > 1 ? (
            <div className="rounded-2xl border vv-border px-4 py-3">
              <p className="vv-muted text-xs">
                {summary.allSamePrice && summary.count > 1 ? "最高经济舱（同价）" : "最高经济舱"}
              </p>
              <p className="mt-1 text-3xl font-semibold">
                {formatCny(summary.maxQuote.priceEconomyCny)}
              </p>
              <p className="mt-2 text-sm font-medium">{summary.maxQuote.flightNumbers}</p>
              <p className="vv-muted text-sm">
                {formatTimeRange(summary.maxQuote.departAt, summary.maxQuote.arriveAt)}
              </p>
            </div>
            ) : null}
          </div>

          {pinned && pinnedQuote ? (
            <div className="rounded-2xl border border-[color-mix(in_srgb,var(--vv-ocean)_24%,var(--vv-outline-variant))] bg-[color-mix(in_srgb,var(--vv-ocean)_6%,transparent)] px-4 py-3">
              <p className="vv-muted text-xs">主看 {pinned}</p>
              <p className="mt-1 text-2xl font-semibold">
                {formatCny(pinnedQuote.priceEconomyCny)}
              </p>
              <p className="vv-muted mt-1 text-sm">
                {formatTimeRange(pinnedQuote.departAt, pinnedQuote.arriveAt)}
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4">
          <p className="vv-muted text-xs">直飞最低价（最近一次抓取）</p>
          <p className="mt-1 text-3xl font-semibold">{formatCny(latestRun.minPriceCny)}</p>
          {latestRun.flightsFound > 0 ? (
            <p className="vv-muted mt-2 text-sm">共 {latestRun.flightsFound} 个航班，明细加载中或暂无报价。</p>
          ) : null}
        </div>
      )}

      {latestRun?.observedAt ? (
        <p className="vv-muted mt-4 text-sm">
          上次观测 {formatObservedAt(latestRun.observedAt)}（
          {latestRun.slot === "am" ? "上午场" : "下午场"}）
        </p>
      ) : null}
      {scrapeMessage ? <p className="vv-muted mt-2 text-sm">{scrapeMessage}</p> : null}
      {scrapeError ? (
        <p className="mt-2 text-sm text-[color:var(--vv-error)]">{scrapeError}</p>
      ) : null}
    </div>
  );
}
