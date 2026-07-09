"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCityDisplay } from "@/lib/airport-cities";
import {
  formatCny,
  formatObservedAt,
  formatTravelDate,
  getFlightSchedule,
  type FlightSchedulePayload,
  type ScheduleSlotState,
} from "@/lib/flight-watches";

function stateLabel(state: ScheduleSlotState) {
  switch (state) {
    case "success":
      return "已完成";
    case "failed":
      return "失败";
    case "running":
      return "进行中";
    case "pending":
      return "待执行";
    case "missed":
      return "未执行";
    case "disabled":
      return "—";
    default:
      return state;
  }
}

function stateClass(state: ScheduleSlotState) {
  switch (state) {
    case "success":
      return "vv-badge-editable";
    case "failed":
    case "missed":
      return "bg-[color-mix(in_srgb,var(--vv-error)_16%,transparent)] text-[color:var(--vv-error)]";
    case "running":
      return "bg-[color-mix(in_srgb,var(--vv-accent)_16%,transparent)] text-[color:var(--vv-accent)]";
    case "pending":
      return "vv-pill";
    default:
      return "vv-badge-readonly";
  }
}

function SlotCell({
  slotLabel,
  localTime,
  state,
  minPriceCny,
  observedAt,
  errorMessage,
}: {
  slotLabel: string;
  localTime: string;
  state: ScheduleSlotState;
  minPriceCny: number | null | undefined;
  observedAt: string | null | undefined;
  errorMessage?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border vv-border px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium">
          {slotLabel} {localTime}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${stateClass(state)}`}>
          {stateLabel(state)}
        </span>
      </div>
      {state === "success" ? (
        <p className="text-sm font-semibold">{formatCny(minPriceCny)}</p>
      ) : null}
      {observedAt ? (
        <p className="vv-muted text-[11px]">{formatObservedAt(observedAt)}</p>
      ) : errorMessage ? (
        <p className="text-[11px] text-[color:var(--vv-error)]">{errorMessage}</p>
      ) : state === "pending" ? (
        <p className="vv-muted text-[11px]">等待定时任务</p>
      ) : null}
    </div>
  );
}

export function FlightSchedulePanel() {
  const [data, setData] = useState<FlightSchedulePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const payload = await getFlightSchedule();
        if (!cancelled) setData(payload);
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
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link href="/flights/" className="vv-link">
            ← 航班看板
          </Link>
          <Link href="/" className="vv-link">
            Trip Board
          </Link>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">定时任务</h1>
          <p className="vv-muted max-w-3xl text-base leading-7">
            查看 Mac Mini 上 launchd 注册的抓取计划，以及每条关注在北京时间上午/下午场的执行结果。
          </p>
        </div>
      </header>

      {loading ? (
        <p className="vv-muted text-sm">加载中…</p>
      ) : error ? (
        <div className="vv-card rounded-[24px] border vv-border p-6">
          <p className="text-sm text-[color:var(--vv-error)]">{error}</p>
        </div>
      ) : data ? (
        <>
          <section className="vv-card grid grid-cols-1 gap-4 rounded-[24px] border vv-border p-6 md:grid-cols-3">
            <div>
              <p className="vv-muted text-xs uppercase tracking-wide">执行器</p>
              <p className="mt-1 font-medium">{data.scheduler.name}</p>
              <p className="vv-muted mt-1 font-mono text-xs">{data.scheduler.executor}</p>
            </div>
            <div>
              <p className="vv-muted text-xs uppercase tracking-wide">计划</p>
              <p className="mt-1 font-medium">
                每天 {data.scheduler.slots.map((s) => s.localTime).join(" / ")}（
                {data.scheduler.timezone}）
              </p>
              <p className="vv-muted mt-1 text-sm">
                已启用 {data.scheduler.enabledWatchCount} 条关注
              </p>
            </div>
            <div>
              <p className="vv-muted text-xs uppercase tracking-wide">下次执行</p>
              <p className="mt-1 font-medium">
                {data.nextRun.label} {data.nextRun.localTime}
              </p>
              <p className="vv-muted mt-1 text-sm">
                {data.nextRun.scrapeDate} · 观测日 {data.today}
              </p>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">关注的航线</h2>
            {data.watches.length === 0 ? (
              <div className="vv-card rounded-[24px] border vv-border p-6 text-center">
                <p className="vv-muted text-sm">还没有关注；添加后会自动纳入定时抓取。</p>
                <Link href="/flights/new/" className="vv-btn-secondary mt-4 inline-flex rounded-xl px-4 py-2 text-sm">
                  添加关注
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {data.watches.map((watch) => (
                  <article
                    key={watch.id}
                    className="vv-card rounded-[24px] border vv-border p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/flights/detail/?id=${encodeURIComponent(watch.id)}`}
                            className="text-lg font-semibold hover:underline"
                          >
                            {watch.label}
                          </Link>
                          {!watch.enabled ? (
                            <span className="vv-badge-readonly rounded-full px-2 py-0.5 text-xs">
                              已停用
                            </span>
                          ) : null}
                        </div>
                        <p className="vv-muted text-sm">
                          {formatTravelDate(watch.travelDate)} · {getCityDisplay(watch.originCode)} →{" "}
                          {getCityDisplay(watch.destCode)}
                        </p>
                      </div>
                      <div className="grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
                        <SlotCell
                          slotLabel="上午场"
                          localTime="09:00"
                          state={watch.schedule.am.state}
                          minPriceCny={watch.schedule.am.run?.minPriceCny}
                          observedAt={watch.schedule.am.run?.observedAt}
                          errorMessage={watch.schedule.am.run?.errorMessage}
                        />
                        <SlotCell
                          slotLabel="下午场"
                          localTime="15:00"
                          state={watch.schedule.pm.state}
                          minPriceCny={watch.schedule.pm.run?.minPriceCny}
                          observedAt={watch.schedule.pm.run?.observedAt}
                          errorMessage={watch.schedule.pm.run?.errorMessage}
                        />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">最近执行记录</h2>
            {data.recentRuns.length === 0 ? (
              <p className="vv-muted text-sm">尚无抓取记录。</p>
            ) : (
              <div className="overflow-x-auto rounded-[24px] border vv-border">
                <table className="min-w-full text-left text-sm">
                  <thead className="vv-muted border-b vv-border text-xs uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 font-medium">时间</th>
                      <th className="px-4 py-3 font-medium">关注</th>
                      <th className="px-4 py-3 font-medium">场次</th>
                      <th className="px-4 py-3 font-medium">状态</th>
                      <th className="px-4 py-3 font-medium">最低价</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentRuns.map((run) => (
                      <tr key={run.runId} className="border-b vv-border last:border-b-0">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatObservedAt(run.observedAt)}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/flights/detail/?id=${encodeURIComponent(run.watchId)}`}
                            className="vv-link"
                          >
                            {run.label}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          {run.scrapeDate} · {run.slot === "am" ? "上午" : "下午"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              run.status === "success"
                                ? "vv-badge-editable"
                                : run.status === "failed"
                                  ? "bg-[color-mix(in_srgb,var(--vv-error)_16%,transparent)] text-[color:var(--vv-error)]"
                                  : "vv-pill"
                            }`}
                          >
                            {run.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium">{formatCny(run.minPriceCny)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
