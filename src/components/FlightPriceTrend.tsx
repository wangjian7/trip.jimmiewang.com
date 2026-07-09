"use client";

import { useMemo } from "react";
import {
  formatCny,
  formatObservedAt,
  type FlightTrendPoint,
} from "@/lib/flight-watches";

function formatDelta(delta: number | null | undefined) {
  if (delta == null) return "—";
  if (delta === 0) return "持平";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toLocaleString("zh-CN")}`;
}

function pivotDaily(points: FlightTrendPoint[]) {
  const map = new Map<string, { am: number | null; pm: number | null }>();

  for (const point of points) {
    const row = map.get(point.scrapeDate) ?? { am: null, pm: null };
    if (point.slot === "am") row.am = point.priceEconomyCny;
    if (point.slot === "pm") row.pm = point.priceEconomyCny;
    map.set(point.scrapeDate, row);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([scrapeDate, prices]) => ({ scrapeDate, ...prices }));
}

function PriceTrendChart({ points }: { points: FlightTrendPoint[] }) {
  const pricedPoints = points.filter((point) => point.priceEconomyCny != null);
  if (pricedPoints.length === 0) return null;

  const width = 640;
  const height = 220;
  const padding = { top: 20, right: 20, bottom: 36, left: 56 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const prices = pricedPoints.map((point) => point.priceEconomyCny as number);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceSpan = Math.max(maxPrice - minPrice, 1);

  const coords = pricedPoints.map((point, index) => {
    const x =
      pricedPoints.length === 1
        ? padding.left + innerWidth / 2
        : padding.left + (index / (pricedPoints.length - 1)) * innerWidth;
    const y =
      padding.top +
      innerHeight -
      (((point.priceEconomyCny as number) - minPrice) / priceSpan) * innerHeight;
    return { x, y, point };
  });

  const polyline = coords.map(({ x, y }) => `${x},${y}`).join(" ");

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full min-w-[280px]"
        role="img"
        aria-label="价格曲线"
      >
        <line
          x1={padding.left}
          y1={padding.top + innerHeight}
          x2={width - padding.right}
          y2={padding.top + innerHeight}
          stroke="var(--vv-outline-variant)"
        />
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + innerHeight}
          stroke="var(--vv-outline-variant)"
        />
        <text
          x={padding.left - 8}
          y={padding.top + 4}
          textAnchor="end"
          className="fill-[color:var(--vv-on-surface-variant)] text-[10px]"
        >
          {formatCny(maxPrice)}
        </text>
        <text
          x={padding.left - 8}
          y={padding.top + innerHeight}
          textAnchor="end"
          className="fill-[color:var(--vv-on-surface-variant)] text-[10px]"
        >
          {formatCny(minPrice)}
        </text>
        {coords.length > 1 ? (
          <polyline
            fill="none"
            stroke="var(--vv-ocean)"
            strokeWidth="2.5"
            points={polyline}
          />
        ) : null}
        {coords.map(({ x, y, point }) => (
          <g key={`${point.scrapeDate}-${point.slot}-${point.scrapedAt}`}>
            <circle cx={x} cy={y} r="4.5" fill="var(--vv-ocean)" />
            <title>
              {point.scrapeDate} {point.slot === "am" ? "上午" : "下午"} ·{" "}
              {formatCny(point.priceEconomyCny)}
            </title>
          </g>
        ))}
      </svg>
    </div>
  );
}

type FlightPriceTrendSectionProps = {
  flightNumbers: string;
  travelDate: string;
  points: FlightTrendPoint[];
  compact?: boolean;
};

export function FlightPriceTrendSection({
  flightNumbers,
  travelDate,
  points,
  compact = false,
}: FlightPriceTrendSectionProps) {
  const dailyRows = useMemo(() => pivotDaily(points), [points]);

  if (points.length === 0) {
    return (
      <p className="vv-muted text-sm">
        还没有 {flightNumbers} 的观测数据；再多抓几次后会显示价格曲线。
      </p>
    );
  }

  return (
    <div className={`flex flex-col ${compact ? "gap-4" : "gap-6"}`}>
      <p className="vv-muted text-sm">
        出发日 {travelDate} ·{" "}
        <span className="font-medium text-[color:var(--foreground)]">{flightNumbers}</span>{" "}
        经济舱价格（按观测时间）
      </p>

      <PriceTrendChart points={points} />

      {points.length === 1 ? (
        <p className="vv-muted text-xs">目前只有 1 个观测点；再多抓几次后会连成完整曲线。</p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b vv-border text-xs text-[color:var(--vv-on-surface-variant)]">
              <th className="px-3 py-2 font-medium">观测时间</th>
              <th className="px-3 py-2 font-medium">价格</th>
              <th className="px-3 py-2 font-medium">较上次</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr
                key={`${point.scrapeDate}-${point.slot}-${point.scrapedAt}`}
                className="border-b vv-border"
              >
                <td className="px-3 py-2">
                  {point.scrapeDate.slice(5).replace("-", "/")}{" "}
                  {point.slot === "am" ? "上午" : "下午"}
                  <div className="vv-muted text-xs">{formatObservedAt(point.scrapedAt)}</div>
                </td>
                <td className="px-3 py-2 font-medium">{formatCny(point.priceEconomyCny)}</td>
                <td
                  className={`px-3 py-2 ${
                    point.deltaCny == null
                      ? "vv-muted"
                      : point.deltaCny > 0
                        ? "text-[color:var(--vv-error)]"
                        : point.deltaCny < 0
                          ? "text-[color:#177a63]"
                          : "vv-muted"
                  }`}
                >
                  {formatDelta(point.deltaCny)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dailyRows.length > 0 ? (
        <div className="overflow-x-auto">
          <h3 className="mb-2 text-sm font-medium">按观测日汇总</h3>
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b vv-border text-xs text-[color:var(--vv-on-surface-variant)]">
                <th className="px-3 py-2 font-medium">观测日</th>
                <th className="px-3 py-2 font-medium">上午</th>
                <th className="px-3 py-2 font-medium">下午</th>
              </tr>
            </thead>
            <tbody>
              {dailyRows.map((row) => (
                <tr key={row.scrapeDate} className="border-b vv-border">
                  <td className="px-3 py-2">{row.scrapeDate.slice(5).replace("-", "/")}</td>
                  <td className="px-3 py-2">{formatCny(row.am)}</td>
                  <td className="px-3 py-2">{formatCny(row.pm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
