"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  TripDay,
  TripPhoto,
  TripPhotoTag,
  TripPlan,
  TripScheduleItem,
} from "@/lib/trips";
import { getTripFromCloud, saveTripToCloud } from "@/lib/cloud";

function storageKey(slug: string) {
  return `trip-plan:${slug}`;
}

function writeKeyStorageKey(slug: string) {
  return `trip-writekey:${slug}`;
}

function newId(prefix: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${id}`;
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function sha256Hex(text: string) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read blob"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

async function compressImageToJpegDataUrl(file: File) {
  const maxSize = 1600;
  const quality = 0.82;

  const bitmap = await (async () => {
    try {
      if (!("createImageBitmap" in window)) return null;
      return await createImageBitmap(file);
    } catch {
      return null;
    }
  })();

  const source = bitmap
    ? bitmap
    : await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        const url = URL.createObjectURL(file);
        el.onload = () => {
          URL.revokeObjectURL(url);
          resolve(el);
        };
        el.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Failed to load image"));
        };
        el.src = url;
      });

  const srcW = source instanceof ImageBitmap ? source.width : source.naturalWidth;
  const srcH = source instanceof ImageBitmap ? source.height : source.naturalHeight;
  const scale = Math.min(1, maxSize / Math.max(srcW, srcH));
  const dstW = Math.max(1, Math.round(srcW * scale));
  const dstH = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = dstW;
  canvas.height = dstH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.drawImage(source, 0, 0, dstW, dstH);
  if (source instanceof ImageBitmap) source.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) throw new Error("Failed to encode image");
  return readBlobAsDataUrl(blob);
}

export function TripEditor({ trip }: { trip: TripPlan }) {
  const key = useMemo(() => storageKey(trip.slug), [trip.slug]);
  const wkey = useMemo(() => writeKeyStorageKey(trip.slug), [trip.slug]);
  const defaultTrip = useMemo(() => trip, [trip]);
  const [plan, setPlan] = useState<TripPlan>(trip);
  const [activeDayId, setActiveDayId] = useState(trip.days[0]?.id ?? "");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [cloudInfo, setCloudInfo] = useState<string | null>(null);
  const [cloudUpdatedAt, setCloudUpdatedAt] = useState<string | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [writeKeyModalOpen, setWriteKeyModalOpen] = useState(false);
  const [writeKeyModalMode, setWriteKeyModalMode] = useState<
    "unlock" | "set" | "rotate"
  >("unlock");
  const [writeKeyInput, setWriteKeyInput] = useState("");
  const [writeKeyError, setWriteKeyError] = useState<string | null>(null);
  const [writeKeyValue, setWriteKeyValue] = useState<string | null>(null);
  const [photoModal, setPhotoModal] = useState<{
    dayId: string;
    photoId: string;
  } | null>(null);

  const readOnly = Boolean(plan.writeKeyHash) && !isUnlocked;

  const activeDay = useMemo(
    () => plan.days.find((d) => d.id === activeDayId) ?? plan.days[0],
    [activeDayId, plan.days],
  );

  useEffect(() => {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as TripPlan;
      if (!parsed?.slug || parsed.slug !== trip.slug) return;
      setPlan(parsed);
      setActiveDayId(parsed.days[0]?.id ?? "");
    } catch {}
  }, [key, trip.slug]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setCloudBusy(true);
        setCloudError(null);
        const data = await getTripFromCloud(trip.slug);
        if (cancelled) return;
        if (!data?.plan) {
          setCloudInfo("云端暂无数据");
          return;
        }
        setPlan(data.plan as TripPlan);
        setActiveDayId(
          (data.plan as TripPlan).days?.[0]?.id ?? (trip.days[0]?.id ?? ""),
        );
        setCloudUpdatedAt(data.updatedAt ?? null);
        setCloudInfo("已从云端拉取");
      } catch (e) {
        if (cancelled) return;
        setCloudError(e instanceof Error ? e.message : "云端拉取失败");
      } finally {
        if (!cancelled) setCloudBusy(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [trip.slug, trip.days]);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(plan));
      setStorageError(null);
    } catch {
      setStorageError(
        "本地存储空间可能不足（照片会占用较多空间）。建议减少照片数量，或先导出 JSON 做备份。",
      );
    }
  }, [key, plan]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const stored = localStorage.getItem(wkey);
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get("writeKey");
      const candidate = fromUrl || stored;
      setWriteKeyValue(candidate);

      if (!plan.writeKeyHash) {
        if (!cancelled) setIsUnlocked(true);
        if (candidate) localStorage.setItem(wkey, candidate);
        return;
      }

      if (!candidate) {
        if (!cancelled) setIsUnlocked(false);
        return;
      }

      try {
        const hash = await sha256Hex(candidate);
        if (!cancelled) setIsUnlocked(hash === plan.writeKeyHash);
        if (hash === plan.writeKeyHash) localStorage.setItem(wkey, candidate);
      } catch {
        if (!cancelled) setIsUnlocked(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [plan.writeKeyHash, wkey]);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [plan.title]);

  function updatePlan(patch: Partial<TripPlan>) {
    if (readOnly) return;
    setPlan((prev) => ({ ...prev, ...patch }));
  }

  function updateDay(dayId: string, patch: Partial<TripDay>) {
    if (readOnly) return;
    setPlan((prev) => ({
      ...prev,
      days: prev.days.map((d) => (d.id === dayId ? { ...d, ...patch } : d)),
    }));
  }

  function addPhotos(dayId: string, photos: TripPhoto[]) {
    if (readOnly) return;
    setPlan((prev) => ({
      ...prev,
      days: prev.days.map((d) =>
        d.id !== dayId
          ? d
          : { ...d, photos: [...(d.photos ?? []), ...photos] },
      ),
    }));
  }

  function updatePhoto(
    dayId: string,
    photoId: string,
    patch: Partial<TripPhoto>,
  ) {
    if (readOnly) return;
    setPlan((prev) => ({
      ...prev,
      days: prev.days.map((d) =>
        d.id !== dayId
          ? d
          : {
              ...d,
              photos: (d.photos ?? []).map((p) =>
                p.id === photoId ? { ...p, ...patch } : p,
              ),
            },
      ),
    }));
  }

  function removePhoto(dayId: string, photoId: string) {
    if (readOnly) return;
    setPlan((prev) => ({
      ...prev,
      days: prev.days.map((d) =>
        d.id !== dayId
          ? d
          : { ...d, photos: (d.photos ?? []).filter((p) => p.id !== photoId) },
      ),
    }));
  }

  function triggerPhotoUpload() {
    photoInputRef.current?.click();
  }

  async function handlePhotoFiles(dayId: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    const photos = await Promise.all(
      list.map(async (file) => ({
        id: newId("p"),
        dataUrl: await compressImageToJpegDataUrl(file),
        createdAt: new Date().toISOString(),
        tag: "other" as TripPhotoTag,
        caption: "",
      })),
    );
    addPhotos(dayId, photos);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  function updateScheduleItem(
    dayId: string,
    itemId: string,
    patch: Partial<TripScheduleItem>,
  ) {
    if (readOnly) return;
    setPlan((prev) => ({
      ...prev,
      days: prev.days.map((d) =>
        d.id !== dayId
          ? d
          : {
              ...d,
              schedule: d.schedule.map((i) =>
                i.id === itemId ? { ...i, ...patch } : i,
              ),
            },
      ),
    }));
  }

  function addScheduleItem(dayId: string) {
    if (readOnly) return;
    setPlan((prev) => ({
      ...prev,
      days: prev.days.map((d) =>
        d.id !== dayId
          ? d
          : {
              ...d,
              schedule: [
                ...d.schedule,
                { id: newId("s"), time: "", title: "", detail: "" },
              ],
            },
      ),
    }));
  }

  function removeScheduleItem(dayId: string, itemId: string) {
    if (readOnly) return;
    setPlan((prev) => ({
      ...prev,
      days: prev.days.map((d) =>
        d.id !== dayId
          ? d
          : { ...d, schedule: d.schedule.filter((i) => i.id !== itemId) },
      ),
    }));
  }

  async function copyJsonToClipboard() {
    const text = JSON.stringify(plan, null, 2);
    if (!navigator?.clipboard?.writeText) return;
    await navigator.clipboard.writeText(text);
  }

  async function copyWriteKeyToClipboard() {
    if (!writeKeyValue) return;
    if (!navigator?.clipboard?.writeText) return;
    await navigator.clipboard.writeText(writeKeyValue);
  }

  function openWriteKeyModal(mode: "unlock" | "set" | "rotate") {
    setWriteKeyModalMode(mode);
    setWriteKeyError(null);
    setWriteKeyInput("");
    setWriteKeyModalOpen(true);
  }

  async function submitWriteKey() {
    const value = writeKeyInput.trim();
    if (value.length < 6) {
      setWriteKeyError("口令至少 6 位。");
      return;
    }

    try {
      const hash = await sha256Hex(value);

      if (plan.writeKeyHash && hash !== plan.writeKeyHash) {
        setWriteKeyError("口令不匹配。");
        return;
      }

      if (!plan.writeKeyHash) {
        setPlan((prev) => ({ ...prev, writeKeyHash: hash }));
      }

      localStorage.setItem(wkey, value);
      setWriteKeyValue(value);
      setIsUnlocked(true);
      setWriteKeyModalOpen(false);
    } catch {
      setWriteKeyError("设置失败，请重试。");
    }
  }

  async function rotateWriteKey() {
    const value = writeKeyInput.trim();
    if (value.length < 6) {
      setWriteKeyError("口令至少 6 位。");
      return;
    }

    try {
      const hash = await sha256Hex(value);
      setPlan((prev) => ({ ...prev, writeKeyHash: hash }));
      localStorage.setItem(wkey, value);
      setWriteKeyValue(value);
      setIsUnlocked(true);
      setWriteKeyModalOpen(false);
    } catch {
      setWriteKeyError("更换失败，请重试。");
    }
  }

  async function pullFromCloud() {
    try {
      setCloudBusy(true);
      setCloudError(null);
      const data = await getTripFromCloud(plan.slug);
      if (!data?.plan) {
        setCloudInfo("云端暂无数据");
        return;
      }
      setPlan(data.plan as TripPlan);
      setActiveDayId((data.plan as TripPlan).days?.[0]?.id ?? activeDayId);
      setCloudUpdatedAt(data.updatedAt ?? null);
      setCloudInfo("已从云端拉取");
    } catch (e) {
      setCloudError(e instanceof Error ? e.message : "云端拉取失败");
    } finally {
      setCloudBusy(false);
    }
  }

  async function saveToCloud() {
    if (!plan.writeKeyHash) {
      setCloudError("请先设置编辑口令（writeKey），再保存到云端。");
      openWriteKeyModal("set");
      return;
    }
    if (!writeKeyValue) {
      setCloudError("需要编辑口令才能保存到云端。");
      openWriteKeyModal("unlock");
      return;
    }

    try {
      setCloudBusy(true);
      setCloudError(null);
      const res = await saveTripToCloud(plan.slug, writeKeyValue, plan);
      setCloudUpdatedAt(res.updatedAt ?? null);
      setCloudInfo("已保存到云端");
    } catch (e) {
      setCloudError(e instanceof Error ? e.message : "云端保存失败");
    } finally {
      setCloudBusy(false);
    }
  }

  function resetToDefault() {
    localStorage.removeItem(key);
    localStorage.removeItem(wkey);
    setPlan(defaultTrip);
    setActiveDayId(defaultTrip.days[0]?.id ?? "");
    setIsUnlocked(true);
    setWriteKeyValue(null);
  }

  function triggerImport() {
    fileInputRef.current?.click();
  }

  async function handleImportFile(file: File | null) {
    if (!file) return;
    const raw = await file.text();
    const parsed = JSON.parse(raw) as TripPlan;
    if (!parsed?.slug || parsed.slug !== trip.slug) return;
    setPlan(parsed);
    setActiveDayId(parsed.days[0]?.id ?? "");
  }

  return (
    <div className="flex-1 bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
        <header className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-1">
              <textarea
                ref={titleRef}
                value={plan.title}
                onChange={(e) => updatePlan({ title: e.target.value })}
                rows={1}
                className="w-full resize-none overflow-hidden bg-transparent text-2xl font-semibold tracking-tight outline-none sm:text-3xl"
                aria-label="Trip title"
                readOnly={readOnly}
              />
              <input
                value={plan.subtitle ?? ""}
                onChange={(e) => updatePlan({ subtitle: e.target.value })}
                className="w-full bg-transparent text-sm text-zinc-600 outline-none dark:text-zinc-400"
                placeholder="一句话备注（可选）"
                aria-label="Trip subtitle"
                readOnly={readOnly}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <div
                className={[
                  "inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium",
                  readOnly
                    ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
                ].join(" ")}
              >
                {readOnly ? "只读" : "可编辑"}
              </div>

              <button
                className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={pullFromCloud}
                type="button"
                disabled={cloudBusy}
              >
                云端拉取
              </button>
              <button
                className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={saveToCloud}
                type="button"
                disabled={cloudBusy}
              >
                云端保存
              </button>

              <button
                className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() =>
                  downloadJson(`${plan.slug}.json`, {
                    exportedAt: new Date().toISOString(),
                    plan,
                  })
                }
                type="button"
              >
                导出 JSON
              </button>
              <button
                className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={triggerImport}
                type="button"
              >
                导入 JSON
              </button>
              <button
                className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={copyJsonToClipboard}
                type="button"
              >
                复制到剪贴板
              </button>

              {!plan.writeKeyHash ? (
                <button
                  className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
                  onClick={() => openWriteKeyModal("set")}
                  type="button"
                >
                  设置口令
                </button>
              ) : readOnly ? (
                <button
                  className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-900 px-4 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white"
                  onClick={() => openWriteKeyModal("unlock")}
                  type="button"
                >
                  输入口令
                </button>
              ) : (
                <>
                  <button
                    className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={copyWriteKeyToClipboard}
                    type="button"
                    disabled={!writeKeyValue}
                  >
                    复制口令
                  </button>
                  <button
                    className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
                    onClick={() => openWriteKeyModal("rotate")}
                    type="button"
                  >
                    更换口令
                  </button>
                </>
              )}

              <button
                className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-900 px-4 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                onClick={resetToDefault}
                type="button"
              >
                恢复默认
              </button>
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                accept="application/json"
                aria-label="导入 JSON 文件"
                title="导入 JSON 文件"
                onChange={(e) => handleImportFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          {storageError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
              {storageError}
            </div>
          ) : null}

          {cloudError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-100">
              {cloudError}
            </div>
          ) : cloudInfo ? (
            <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
              {cloudInfo}
              {cloudUpdatedAt ? `（${cloudUpdatedAt}）` : ""}
            </div>
          ) : null}

          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            输入口令后即可修改内容；未输入口令时为只读。也可用“云端保存/拉取”同步，或用“导出/导入 JSON”分享备份。
          </p>
        </header>

        <div className="relative overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,0,0,0.06),transparent_55%),radial-gradient(circle_at_80%_40%,rgba(0,0,0,0.04),transparent_55%)] dark:bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_55%),radial-gradient(circle_at_80%_40%,rgba(255,255,255,0.06),transparent_55%)]" />

          <div className="relative border-b border-zinc-200 px-6 pb-5 pt-6 dark:border-zinc-800">
            <div className="text-xs font-medium tracking-wider text-zinc-500 dark:text-zinc-400">
              DAYS
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {plan.days.map((d) => {
                const active = d.id === activeDayId;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setActiveDayId(d.id)}
                    className={[
                      "rounded-full px-3 py-1.5 text-sm transition",
                      active
                        ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-950"
                        : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
                    ].join(" ")}
                  >
                    {d.dateLabel}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative grid grid-cols-1 md:grid-cols-[380px_1fr]">
            <div className="pointer-events-none absolute inset-y-0 left-[380px] hidden md:block">
              <div className="absolute inset-y-0 left-0 w-px bg-zinc-200 dark:bg-zinc-800" />
              <div className="absolute inset-y-0 left-0 w-10 -translate-x-1/2">
                <div className="absolute left-1/2 top-10 h-3 w-3 -translate-x-1/2 rounded-full border border-zinc-300 bg-zinc-100 shadow-sm dark:border-zinc-700 dark:bg-zinc-950" />
                <div className="absolute left-1/2 top-24 h-3 w-3 -translate-x-1/2 rounded-full border border-zinc-300 bg-zinc-100 shadow-sm dark:border-zinc-700 dark:bg-zinc-950" />
                <div className="absolute left-1/2 top-[9.5rem] h-3 w-3 -translate-x-1/2 rounded-full border border-zinc-300 bg-zinc-100 shadow-sm dark:border-zinc-700 dark:bg-zinc-950" />
                <div className="absolute left-1/2 top-52 h-3 w-3 -translate-x-1/2 rounded-full border border-zinc-300 bg-zinc-100 shadow-sm dark:border-zinc-700 dark:bg-zinc-950" />
                <div className="absolute left-1/2 top-[16.5rem] h-3 w-3 -translate-x-1/2 rounded-full border border-zinc-300 bg-zinc-100 shadow-sm dark:border-zinc-700 dark:bg-zinc-950" />
              </div>
            </div>

            <aside className="relative order-2 flex flex-col border-t border-zinc-200 dark:border-zinc-800 md:order-none md:border-t-0">
              {activeDay ? (
                <div className="flex flex-1 flex-col gap-6 px-6 pb-8 pt-6">
                  <div className="flex flex-col gap-3">
                    <div className="text-xs font-medium tracking-wider text-zinc-500 dark:text-zinc-400">
                      TODAY
                    </div>
                    <input
                      value={activeDay.city}
                      onChange={(e) =>
                        updateDay(activeDay.id, { city: e.target.value })
                      }
                      className="w-full bg-transparent text-xl font-semibold outline-none"
                      aria-label="City"
                      readOnly={readOnly}
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="text-xs font-medium tracking-wider text-zinc-500 dark:text-zinc-400">
                      LOGISTICS
                    </div>
                    <textarea
                      value={activeDay.flight ?? ""}
                      onChange={(e) =>
                        updateDay(activeDay.id, { flight: e.target.value })
                      }
                      className="min-h-16 w-full resize-none rounded-2xl border border-zinc-200 bg-white/70 p-4 text-sm leading-6 outline-none focus:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/50 dark:focus:border-zinc-700"
                      placeholder="航班/交通（可选）：航班号、起降时间、出发/到达航站楼、集合点…"
                      aria-label="Flight and transport"
                      readOnly={readOnly}
                    />
                    <textarea
                      value={activeDay.stay ?? ""}
                      onChange={(e) =>
                        updateDay(activeDay.id, { stay: e.target.value })
                      }
                      className="min-h-16 w-full resize-none rounded-2xl border border-zinc-200 bg-white/70 p-4 text-sm leading-6 outline-none focus:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/50 dark:focus:border-zinc-700"
                      placeholder="酒店/住宿（可选）：酒店名、地址、入住/退房时间、预订编号…"
                      aria-label="Hotel"
                      readOnly={readOnly}
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="text-xs font-medium tracking-wider text-zinc-500 dark:text-zinc-400">
                      NOTES
                    </div>
                    <textarea
                      value={activeDay.notes ?? ""}
                      onChange={(e) =>
                        updateDay(activeDay.id, { notes: e.target.value })
                      }
                      className="min-h-44 w-full resize-none rounded-2xl border border-zinc-200 bg-white/70 p-4 text-sm leading-6 outline-none focus:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/50 dark:focus:border-zinc-700"
                      placeholder="随手记：酒店地址、换钱、集合点、打车信息、图片/小红书素材…"
                      aria-label="Notes"
                      readOnly={readOnly}
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-end justify-between">
                      <div className="text-xs font-medium tracking-wider text-zinc-500 dark:text-zinc-400">
                        PHOTOS
                      </div>
                      <button
                        type="button"
                        className="inline-flex h-9 items-center justify-center rounded-full bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={triggerPhotoUpload}
                        disabled={readOnly}
                      >
                        上传
                      </button>
                      <input
                        ref={photoInputRef}
                        className="hidden"
                        type="file"
                        accept="image/*"
                        multiple
                        aria-label="上传照片"
                        title="上传照片"
                        onChange={(e) =>
                          handlePhotoFiles(activeDay.id, e.target.files)
                        }
                      />
                    </div>

                    {(activeDay.photos ?? []).length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                        这里可以放酒店/航班信息截图、以及游玩照片。上传后会保存在本地，并会跟随导出 JSON 一起分享。
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {(activeDay.photos ?? []).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="group relative aspect-square overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                            onClick={() =>
                              setPhotoModal({ dayId: activeDay.id, photoId: p.id })
                            }
                            aria-label="查看照片"
                            title="查看照片"
                          >
                            <img
                              src={p.dataUrl}
                              alt={p.caption?.trim() ? p.caption : "photo"}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                            {p.tag ? (
                              <div className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-medium tracking-wide text-white">
                                {p.tag.toUpperCase()}
                              </div>
                            ) : null}
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </aside>

            <section className="relative order-1 flex flex-col border-b border-zinc-200 px-6 pb-8 pt-6 dark:border-zinc-800 md:order-none md:border-b-0">
              <div className="flex flex-col gap-2">
                <div className="flex items-end justify-between">
                  <div className="text-xs font-medium tracking-wider text-zinc-500 dark:text-zinc-400">
                    ITINERARY
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-9 items-center justify-center rounded-full bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => activeDay && addScheduleItem(activeDay.id)}
                    disabled={readOnly}
                  >
                    新增一条
                  </button>
                </div>

                {activeDay ? (
                  <div className="mt-4 flex flex-col gap-3">
                    {activeDay.schedule.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                        还没有行程条目，点“新增一条”开始。
                      </div>
                    ) : (
                      activeDay.schedule.map((item) => (
                        <div
                          key={item.id}
                          className="group grid grid-cols-[92px_1fr] gap-3 rounded-2xl border border-zinc-200 bg-white/70 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/40"
                        >
                          <input
                            value={item.time ?? ""}
                            onChange={(e) =>
                              updateScheduleItem(activeDay.id, item.id, {
                                time: e.target.value,
                              })
                            }
                            className="w-full bg-transparent text-sm font-medium text-zinc-700 outline-none dark:text-zinc-200"
                            placeholder="时间"
                            aria-label="Time"
                            readOnly={readOnly}
                          />

                          <div className="flex min-w-0 flex-col gap-2">
                            <div className="flex items-start justify-between gap-3">
                              <input
                                value={item.title}
                                onChange={(e) =>
                                  updateScheduleItem(activeDay.id, item.id, {
                                    title: e.target.value,
                                  })
                                }
                                className="w-full min-w-0 bg-transparent text-base font-semibold outline-none"
                                placeholder="行程标题"
                                aria-label="Title"
                                readOnly={readOnly}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  removeScheduleItem(activeDay.id, item.id)
                                }
                                className="invisible inline-flex h-8 items-center justify-center rounded-full bg-zinc-100 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-200 group-hover:visible dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={readOnly}
                              >
                                删除
                              </button>
                            </div>
                            <textarea
                              value={item.detail ?? ""}
                              onChange={(e) =>
                                updateScheduleItem(activeDay.id, item.id, {
                                  detail: e.target.value,
                                })
                              }
                              className="min-h-20 w-full resize-none rounded-xl border border-zinc-200 bg-white/80 p-3 text-sm leading-6 outline-none focus:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/70 dark:focus:border-zinc-700"
                              placeholder="补充信息：地址/门票/集合点/注意事项"
                              aria-label="Detail"
                              readOnly={readOnly}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </div>

        <footer className="text-xs leading-6 text-zinc-500 dark:text-zinc-400">
          Powered by{" "}
          <a
            className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
            href="https://jimmiewang.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            jimmiewang.com
          </a>
        </footer>

        {writeKeyModalOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="编辑口令"
            onClick={() => setWriteKeyModalOpen(false)}
          >
            <div
              className="w-full max-w-lg overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {writeKeyModalMode === "unlock"
                    ? "输入编辑口令"
                    : writeKeyModalMode === "set"
                      ? "设置编辑口令"
                      : "更换编辑口令"}
                </div>
                <button
                  type="button"
                  className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-800"
                  onClick={() => setWriteKeyModalOpen(false)}
                >
                  关闭
                </button>
              </div>

              <div className="flex flex-col gap-4 p-5">
                <div className="flex flex-col gap-2">
                  <div className="text-xs font-medium tracking-wider text-zinc-500 dark:text-zinc-400">
                    WRITE KEY
                  </div>
                  <input
                    value={writeKeyInput}
                    onChange={(e) => setWriteKeyInput(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-700"
                    placeholder="建议用不易猜的短语/数字组合（至少 6 位）"
                    aria-label="Write key"
                  />
                  {writeKeyError ? (
                    <div className="text-sm text-rose-700 dark:text-rose-300">
                      {writeKeyError}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                  <div>
                    - 只读链接可以公开分享；要允许他人编辑，把口令单独发给同伴。
                  </div>
                  <div>
                    - 口令仅用于写入门槛，不是账号体系；泄露后任何人都能编辑。
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-800"
                    onClick={() => setWriteKeyModalOpen(false)}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white"
                    onClick={() =>
                      writeKeyModalMode === "rotate"
                        ? rotateWriteKey()
                        : submitWriteKey()
                    }
                  >
                    {writeKeyModalMode === "unlock"
                      ? "解锁"
                      : writeKeyModalMode === "set"
                        ? "设置"
                        : "更换"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {photoModal ? (
          (() => {
            const day = plan.days.find((d) => d.id === photoModal.dayId);
            const photo = day?.photos?.find((p) => p.id === photoModal.photoId);
            if (!day || !photo) return null;
            return (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                role="dialog"
                aria-modal="true"
                aria-label="照片详情"
                onClick={() => setPhotoModal(null)}
              >
                <div
                  className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      照片
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => {
                          removePhoto(day.id, photo.id);
                          setPhotoModal(null);
                        }}
                        disabled={readOnly}
                      >
                        删除
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-9 items-center justify-center rounded-full bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white"
                        onClick={() => setPhotoModal(null)}
                      >
                        关闭
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-0 md:grid-cols-[1.2fr_0.8fr]">
                    <div className="bg-zinc-950">
                      <img
                        src={photo.dataUrl}
                        alt={photo.caption?.trim() ? photo.caption : "photo"}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="flex flex-col gap-4 p-5">
                      <div className="flex flex-col gap-2">
                        <div className="text-xs font-medium tracking-wider text-zinc-500 dark:text-zinc-400">
                          TAG
                        </div>
                        <select
                          value={photo.tag ?? "other"}
                          onChange={(e) =>
                            updatePhoto(day.id, photo.id, {
                              tag: e.target.value as TripPhotoTag,
                            })
                          }
                          className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-700"
                          aria-label="Photo tag"
                          disabled={readOnly}
                        >
                          <option value="hotel">HOTEL</option>
                          <option value="flight">FLIGHT</option>
                          <option value="play">PLAY</option>
                          <option value="other">OTHER</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="text-xs font-medium tracking-wider text-zinc-500 dark:text-zinc-400">
                          CAPTION
                        </div>
                        <textarea
                          value={photo.caption ?? ""}
                          onChange={(e) =>
                            updatePhoto(day.id, photo.id, {
                              caption: e.target.value,
                            })
                          }
                          className="min-h-32 w-full resize-none rounded-2xl border border-zinc-200 bg-white p-4 text-sm leading-6 outline-none focus:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-700"
                          placeholder="一句话备注：比如酒店名称、票价、集合点、当天亮点…"
                          aria-label="Photo caption"
                          readOnly={readOnly}
                        />
                      </div>

                      <div className="text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                        上传的照片会压缩后保存到本地，并会跟随导出 JSON 一起分享；照片越多导出的 JSON 也会越大。
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()
        ) : null}
      </div>
    </div>
  );
}
