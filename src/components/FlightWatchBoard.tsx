"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getCityDisplay } from "@/lib/airport-cities";
import {
  formatCny,
  formatObservedAt,
  formatTravelDate,
  listFlightWatches,
  type FlightWatch,
} from "@/lib/flight-watches";
import { splitFlightWatchesByArchive } from "../../shared/flight-watch-archive.mjs";

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
  const searchParams = useSearchParams();
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

  const { active, archived } = useMemo(
    () => splitFlightWatchesByArchive(watches),
    [watches],
  );
  const currentView = searchParams.get("view") === "archived" ? "archived" : "active";
  const visibleWatches = currentView === "archived" ? archived : active;

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
            长期关注的航线与价格观测。Mac Mini 每天 09:00 / 15:00 自动抓取东航官网价格。
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="inline-flex rounded-2xl border vv-border p-1 text-sm">
            <Link
              href="/flights/"
              className={`rounded-xl px-4 py-2 transition ${
                currentView === "active" ? "vv-btn-secondary" : "vv-muted hover:text-[color:var(--foreground)]"
              }`}
            >
              监控中 {active.length}
            </Link>
            <Link
              href="/flights/?view=archived"
              className={`rounded-xl px-4 py-2 transition ${
                currentView === "archived"
                  ? "vv-btn-secondary"
                  : "vv-muted hover:text-[color:var(--foreground)]"
              }`}
            >
              已归档 {archived.length}
            </Link>
          </div>
          <Link
            href="/flights/schedule/"
            className="vv-btn-secondary inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-medium"
          >
            定时任务
          </Link>
          <Link
            href="/flights/new/"
            className="vv-btn-primary inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-medium"
          >
            添加关注
          </Link>
        </div>
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
      ) : visibleWatches.length === 0 ? (
        <div className="vv-card rounded-[24px] border vv-border p-8 text-center">
          {currentView === "archived" ? (
            <>
              <p className="text-lg font-medium">还没有已归档的航班</p>
              <p className="vv-muted mt-2 text-sm">过了出发日的关注会自动移到这里。</p>
            </>
          ) : (
            <>
              <p className="text-lg font-medium">还没有监控中的航班</p>
              <p className="vv-muted mt-2 text-sm">
                例如：9/30 上海→布里斯班，主看 MU715。
              </p>
              <Link
                href="/flights/new/"
                className="vv-btn-secondary mt-6 inline-flex rounded-xl px-5 py-3 text-sm font-medium"
              >
                添加第一条关注
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {visibleWatches.map((watch) => (
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
                    {currentView === "archived" ? (
                      <span className="vv-badge-readonly rounded-full px-2.5 py-1 text-xs">
                        已归档
                      </span>
                    ) : null}
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
