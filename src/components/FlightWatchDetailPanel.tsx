"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getCityDisplay } from "@/lib/airport-cities";
import {
  deleteFlightWatch,
  formatTravelDate,
  getFlightWatch,
  scrapeFlightWatch,
  type FlightWatchDetail,
} from "@/lib/flight-watches";
import { FlightWatchFlightGroups } from "@/components/FlightWatchFlightGroups";
import { FlightPriceOverview } from "@/components/FlightPriceOverview";
import { scrapeEnabled } from "@/lib/env";
import { isFlightWatchArchived } from "../../shared/flight-watch-archive.mjs";

export function FlightWatchDetailPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const watchId = searchParams.get("id");

  const [detail, setDetail] = useState<FlightWatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeMessage, setScrapeMessage] = useState<string | null>(null);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [trendRefreshKey, setTrendRefreshKey] = useState(0);

  async function reloadDetail(id: string) {
    const data = await getFlightWatch(id);
    if (data) setDetail(data);
  }

  useEffect(() => {
    if (!watchId) return;

    const id = watchId;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getFlightWatch(id);
        if (!cancelled) {
          if (!data) setError("找不到这条航班关注。");
          else setDetail(data);
        }
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
  }, [watchId]);

  async function onScrape() {
    if (!watchId) return;

    setScraping(true);
    setScrapeMessage(null);
    setScrapeError(null);
    try {
      const result = await scrapeFlightWatch(watchId);
      setScrapeMessage(result.message);
      await reloadDetail(watchId);
      setTrendRefreshKey((value) => value + 1);
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : "试抓失败");
    } finally {
      setScraping(false);
    }
  }

  async function onDelete() {
    if (!watchId || !window.confirm("确定删除这条关注？历史价格也会一并删除。")) {
      return;
    }

    setDeleting(true);
    try {
      await deleteFlightWatch(watchId);
      router.push("/flights/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
      setDeleting(false);
    }
  }

  if (loading) {
    return <p className="vv-muted text-sm">加载中…</p>;
  }

  if (!watchId) {
    return (
      <div className="vv-card rounded-[24px] border vv-border p-6">
        <p className="text-sm text-[color:var(--vv-error)]">缺少关注 ID。</p>
        <Link href="/flights/" className="vv-link mt-4 inline-block text-sm">
          返回列表
        </Link>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="vv-card rounded-[24px] border vv-border p-6">
        <p className="text-sm text-[color:var(--vv-error)]">{error ?? "加载失败"}</p>
        <Link href="/flights/" className="vv-link mt-4 inline-block text-sm">
          返回列表
        </Link>
      </div>
    );
  }

  const { watch, latestRun, pinnedQuote, latestQuotes = [] } = detail;
  const archived = isFlightWatchArchived(watch.travelDate);
  const listHref = archived ? "/flights/?view=archived" : "/flights/";

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Link href={listHref} className="vv-link text-sm">
          ← 返回关注列表
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">{watch.label}</h1>
          {archived ? (
            <span className="vv-badge-readonly rounded-full px-2.5 py-1 text-xs">已归档</span>
          ) : null}
          {!watch.enabled ? (
            <span className="vv-badge-readonly rounded-full px-2.5 py-1 text-xs">已停用</span>
          ) : null}
        </div>
        <p className="vv-muted text-sm">
          {formatTravelDate(watch.travelDate)} · {getCityDisplay(watch.originCode)} →{" "}
          {getCityDisplay(watch.destCode)}
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FlightPriceOverview
          watch={watch}
          latestRun={latestRun}
          latestQuotes={latestQuotes}
          pinnedQuote={pinnedQuote}
          scrapeMessage={scrapeMessage}
          scrapeError={scrapeError}
        />

        <div className="vv-card rounded-[24px] border vv-border p-6">
          <h2 className="text-lg font-semibold">配置</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="vv-muted">数据源</dt>
              <dd>{watch.source}</dd>
            </div>
            <div>
              <dt className="vv-muted">舱位</dt>
              <dd>{watch.cabin}</dd>
            </div>
            <div>
              <dt className="vv-muted">筛选</dt>
              <dd>{watch.directOnly ? "只看直飞" : "含中转"}</dd>
            </div>
            {watch.tripSlug ? (
              <div>
                <dt className="vv-muted">关联行程</dt>
                <dd>
                  <Link href={`/trips/${watch.tripSlug}/`} className="vv-link">
                    {watch.tripSlug}
                  </Link>
                </dd>
              </div>
            ) : null}
          </dl>
          {watch.sourceUrl ? (
            <a
              href={watch.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="vv-link mt-4 inline-block text-sm"
            >
              在东航官网查看 →
            </a>
          ) : null}
        </div>
      </section>

      {archived ? (
        <div className="vv-card rounded-[24px] border vv-border p-5">
          <p className="text-sm font-medium">这条关注已归档</p>
          <p className="vv-muted mt-2 text-sm">
            已过出发日的航班不会再参与自动抓取，仍保留历史价格记录供回看。
          </p>
          <Link href="/flights/?view=archived" className="vv-link mt-3 inline-block text-sm">
            查看已归档列表 →
          </Link>
        </div>
      ) : null}

      {watchId ? (
        <FlightWatchFlightGroups
          watchId={watchId}
          travelDate={watch.travelDate}
          latestQuotes={latestQuotes}
          pinnedFlightNumbers={watch.pinnedFlightNumbers}
          refreshKey={trendRefreshKey}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {scrapeEnabled && !archived ? (
          <button
            type="button"
            disabled={scraping}
            onClick={() => void onScrape()}
            className="vv-btn-primary rounded-xl px-5 py-3 text-sm font-medium disabled:opacity-60"
          >
            {scraping ? "抓取中…" : "试抓一次"}
          </button>
        ) : archived ? (
          <p className="vv-muted text-sm">已归档航班不再支持手动试抓。</p>
        ) : (
          <p className="vv-muted text-sm">
            线上暂不支持手动试抓；Mac Mini 每天 09:00 / 15:00 自动更新，或在 Mac Mini 管理面板立即跑一次。
          </p>
        )}
        <button
          type="button"
          disabled={deleting}
          onClick={() => void onDelete()}
          className="vv-btn-danger rounded-xl px-5 py-3 text-sm font-medium disabled:opacity-60"
        >
          {deleting ? "删除中…" : "删除关注"}
        </button>
      </div>
    </div>
  );
}
