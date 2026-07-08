"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCityDisplay } from "@/lib/airport-cities";
import {
  formatCny,
  formatObservedAt,
  formatTravelDate,
  listFlightWatches,
  type FlightWatch,
} from "@/lib/flight-watches";

function runStatusLabel(watch: FlightWatch) {
  if (!watch.enabled) return "已停用";
  if (!watch.latestRun) return "待首次抓取";
  if (watch.latestRun.status === "failed") return "抓取失败";
  if (watch.latestRun.status === "running") return "抓取中";
  return "正常";
}

function runStatusClass(watch: FlightWatch) {
  if (!watch.enabled) return "vv-badge-readonly";
  if (!watch.latestRun || watch.latestRun.status === "failed") {
    return "bg-[color-mix(in_srgb,var(--vv-error)_16%,transparent)] text-[color:var(--vv-error)]";
  }
  return "vv-badge-editable";
}

export function FlightWatchBoard() {
  const [watches, setWatches] = useState<FlightWatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await listFlightWatches();
        if (!cancelled) setWatches(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "加载失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <Link href="/" className="vv-link text-sm">
            ← 返回 Trip Board
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Flight Tracking Board
          </h1>
          <p className="vv-muted max-w-2xl text-base leading-7">
            长期关注的航线与价格观测。后台定时抓取尚未接入，当前可先添加关注并查看配置。
          </p>
        </div>
        <Link
          href="/flights/new/"
          className="vv-btn-primary inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-medium"
        >
          添加关注
        </Link>
      </header>

      {loading ? (
        <p className="vv-muted text-sm">加载中…</p>
      ) : error ? (
        <div className="vv-card rounded-[24px] border vv-border p-6">
          <p className="text-sm text-[color:var(--vv-error)]">{error}</p>
          <p className="vv-muted mt-2 text-sm">
            本地开发请运行 <code className="font-mono">npm run dev:local</code>
            （或另开终端运行 <code className="font-mono">npm run dev:api</code>），然后刷新页面。
          </p>
        </div>
      ) : watches.length === 0 ? (
        <div className="vv-card rounded-[24px] border vv-border p-8 text-center">
          <p className="text-lg font-medium">还没有关注的航班</p>
          <p className="vv-muted mt-2 text-sm">
            例如：9/30 上海→布里斯班，主看 MU715。
          </p>
          <Link
            href="/flights/new/"
            className="vv-btn-secondary mt-6 inline-flex rounded-xl px-5 py-3 text-sm font-medium"
          >
            添加第一条关注
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {watches.map((watch) => (
            <Link
              key={watch.id}
              href={`/flights/detail/?id=${encodeURIComponent(watch.id)}`}
              className="vv-card group rounded-[24px] border vv-border p-6 transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${runStatusClass(watch)}`}>
                      {runStatusLabel(watch)}
                    </span>
                    {watch.pinnedFlightNumbers ? (
                      <span className="vv-pill rounded-full px-2.5 py-1 text-xs">
                        主看 {watch.pinnedFlightNumbers}
                      </span>
                    ) : null}
                    {watch.tripSlug ? (
                      <span className="vv-muted text-xs">行程 {watch.tripSlug}</span>
                    ) : null}
                  </div>
                  <h2 className="text-xl font-semibold">{watch.label}</h2>
                  <p className="vv-muted text-sm">
                    {formatTravelDate(watch.travelDate)} · {getCityDisplay(watch.originCode)} →{" "}
                    {getCityDisplay(watch.destCode)}
                    {watch.directOnly ? " · 直飞" : ""}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-1 sm:items-end">
                  <div className="text-2xl font-semibold">
                    {formatCny(watch.latestRun?.minPriceCny)}
                  </div>
                  <p className="vv-muted text-xs">
                    {watch.latestRun?.observedAt
                      ? `上次观测 ${formatObservedAt(watch.latestRun.observedAt)}`
                      : "等待首次抓取"}
                  </p>
                  <span className="vv-link mt-2 text-sm font-medium">
                    查看详情 →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
