"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  buildCeairShoppingUrl,
  buildDefaultLabel,
  getCityDisplay,
} from "@/lib/airport-cities";
import { createFlightWatch } from "@/lib/flight-watches";
import { trips } from "@/lib/trips";
import { CityAutocomplete } from "@/components/CityAutocomplete";

export function FlightWatchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetTripSlug = searchParams.get("trip");

  const presetTrip = useMemo(
    () => trips.find((trip) => trip.slug === presetTripSlug) ?? null,
    [presetTripSlug],
  );

  const [originInput, setOriginInput] = useState(
    presetTripSlug === "au-2026-09-30" ? "上海" : "",
  );
  const [originCode, setOriginCode] = useState<string | null>(
    presetTripSlug === "au-2026-09-30" ? "SHA" : null,
  );
  const [destInput, setDestInput] = useState(
    presetTripSlug === "au-2026-09-30" ? "布里斯班" : "",
  );
  const [destCode, setDestCode] = useState<string | null>(
    presetTripSlug === "au-2026-09-30" ? "BNE" : null,
  );
  const [travelDate, setTravelDate] = useState(presetTrip?.startDate ?? "");
  const [label, setLabel] = useState("");
  const [pinnedFlightNumbers, setPinnedFlightNumbers] = useState(
    presetTripSlug === "au-2026-09-30" ? "MU715" : "",
  );
  const [directOnly, setDirectOnly] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autoLabel =
    originCode && destCode && travelDate
      ? buildDefaultLabel(originCode, destCode, travelDate)
      : "";

  const previewUrl =
    originCode && destCode && travelDate
      ? buildCeairShoppingUrl(originCode, destCode, travelDate)
      : null;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!originCode || !destCode) {
      setError("请选择有效的出发和到达城市。");
      return;
    }
    if (!travelDate) {
      setError("请填写出发日期。");
      return;
    }

    setSubmitting(true);
    try {
      const watch = await createFlightWatch({
        label: label.trim() || autoLabel,
        originCode,
        destCode,
        travelDate,
        tripSlug: presetTripSlug,
        directOnly,
        pinnedFlightNumbers: pinnedFlightNumbers.trim() || null,
      });
      router.push(`/flights/detail/?id=${encodeURIComponent(watch.id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Link href="/flights/" className="vv-link text-sm">
          ← 返回关注列表
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">添加航班关注</h1>
        <p className="vv-muted max-w-2xl text-sm leading-6">
          最少填写出发城市、到达城市和出发日期。城市名会自动转换成东航使用的代码。
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="vv-card flex max-w-2xl flex-col gap-6 rounded-[24px] border vv-border p-6"
      >
        <CityAutocomplete
          label="出发城市"
          value={originInput}
          selectedCode={originCode}
          placeholder="例如：上海"
          onChange={(display, code) => {
            setOriginInput(display);
            setOriginCode(code);
          }}
        />

        <CityAutocomplete
          label="到达城市"
          value={destInput}
          selectedCode={destCode}
          placeholder="例如：布里斯班"
          onChange={(display, code) => {
            setDestInput(display);
            setDestCode(code);
          }}
        />

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">出发日期</span>
          <input
            type="date"
            required
            value={travelDate}
            onChange={(event) => setTravelDate(event.target.value)}
            className="rounded-xl border vv-border bg-[color:var(--vv-surface-lowest)] px-4 py-3 text-sm outline-none focus:border-[color:var(--vv-accent-2)]"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">标签（可选）</span>
          <input
            type="text"
            value={label}
            placeholder={autoLabel || "自动生成"}
            onChange={(event) => setLabel(event.target.value)}
            className="rounded-xl border vv-border bg-[color:var(--vv-surface-lowest)] px-4 py-3 text-sm outline-none focus:border-[color:var(--vv-accent-2)]"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">主关注航班号（可选）</span>
          <input
            type="text"
            value={pinnedFlightNumbers}
            placeholder="例如：MU715"
            onChange={(event) => setPinnedFlightNumbers(event.target.value.toUpperCase())}
            className="rounded-xl border vv-border bg-[color:var(--vv-surface-lowest)] px-4 py-3 text-sm outline-none focus:border-[color:var(--vv-accent-2)]"
          />
        </label>

        <label className="inline-flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={directOnly}
            onChange={(event) => setDirectOnly(event.target.checked)}
            className="size-4 rounded border vv-border"
          />
          只看直飞
        </label>

        {presetTrip ? (
          <p className="vv-muted text-xs">将关联行程：{presetTrip.title}</p>
        ) : null}

        {previewUrl ? (
          <div className="rounded-xl bg-[color:var(--vv-surface-low)] px-4 py-3 text-xs leading-6">
            <p className="vv-muted">预览航线</p>
            <p className="font-medium">
              {getCityDisplay(originCode!)} ({originCode}) → {getCityDisplay(destCode!)} ({destCode})
            </p>
            <a href={previewUrl} target="_blank" rel="noreferrer" className="vv-link break-all">
              {previewUrl}
            </a>
          </div>
        ) : null}

        {error ? <p className="text-sm text-[color:var(--vv-error)]">{error}</p> : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="vv-btn-primary rounded-xl px-5 py-3 text-sm font-medium disabled:opacity-60"
          >
            {submitting ? "保存中…" : "保存关注"}
          </button>
          <Link href="/flights/" className="vv-btn-ghost rounded-xl px-5 py-3 text-sm font-medium">
            取消
          </Link>
        </div>
      </form>
    </div>
  );
}
