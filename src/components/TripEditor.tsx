"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  TripDay,
  TripFlight,
  TripHotel,
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

function toHttpUrl(raw: string) {
  const u = raw.trim();
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return `https://${u}`;
}

function normalizeTripPlan(plan: TripPlan): TripPlan {
  return {
    ...plan,
    days: plan.days.map((d) => {
      const flights: TripFlight[] = Array.isArray(d.flights) ? d.flights : [];
      const hotels: TripHotel[] = Array.isArray(d.hotels) ? d.hotels : [];

      const shouldMigrateFlight = flights.length === 0 && Boolean(d.flight?.trim());
      const shouldMigrateHotel = hotels.length === 0 && Boolean(d.stay?.trim());

      return {
        ...d,
        flight: shouldMigrateFlight ? undefined : d.flight,
        stay: shouldMigrateHotel ? undefined : d.stay,
        flights: shouldMigrateFlight
          ? [
              {
                id: `f-migrated-${d.id}`,
                flightNo: d.flight ?? "",
                departAt: "",
                arriveAt: "",
                price: "",
                hasLayover: false,
              },
            ]
          : flights,
        hotels: shouldMigrateHotel
          ? [
              {
                id: `h-migrated-${d.id}`,
                name: d.stay ?? "",
                url: "",
                address: "",
                price: "",
              },
            ]
          : hotels,
      };
    }),
  };
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
  const readStoredPlan = useCallback((): TripPlan | null => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as TripPlan;
      if (!parsed?.slug || parsed.slug !== trip.slug) return null;
      return parsed;
    } catch {
      return null;
    }
  }, [key, trip.slug]);

  const [plan, setPlan] = useState<TripPlan>(() => normalizeTripPlan(trip));
  const [activeDayId, setActiveDayId] = useState(trip.days[0]?.id ?? "");
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
  const [overviewOpen, setOverviewOpen] = useState(false);

  const readOnly = Boolean(plan.writeKeyHash) && !isUnlocked;

  const activeDay = useMemo(
    () => plan.days.find((d) => d.id === activeDayId) ?? plan.days[0],
    [activeDayId, plan.days],
  );
  const isSydneyTheme = useMemo(() => {
    const city = (activeDay?.city ?? "").toLowerCase();
    return city.includes("悉尼") || city.includes("sydney");
  }, [activeDay?.city]);

  useEffect(() => {
    document.body.classList.toggle("print-mode", overviewOpen);
    return () => {
      document.body.classList.remove("print-mode");
    };
  }, [overviewOpen]);

  const persistPlan = useCallback(
    (nextPlan: TripPlan) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key, JSON.stringify(nextPlan));
      setStorageError(null);
    } catch {
      setStorageError(
          "本地存储空间可能不足（照片会占用较多空间）。建议减少照片数量，或先用“云端保存”做备份。",
      );
    }
    },
    [key],
  );

  const setPlanAndPersist = useCallback(
    (updater: TripPlan | ((prev: TripPlan) => TripPlan)) => {
      setPlan((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        if (typeof queueMicrotask === "function") {
          queueMicrotask(() => persistPlan(next));
        } else {
          Promise.resolve().then(() => persistPlan(next));
        }
        return next;
      });
    },
    [persistPlan],
  );

  useEffect(() => {
    const stored = readStoredPlan();
    if (!stored) return;
    const normalized = normalizeTripPlan(stored);
    const nextDayId = normalized.days[0]?.id ?? "";
    if (typeof queueMicrotask === "function") {
      queueMicrotask(() => {
        setPlanAndPersist(normalized);
        setActiveDayId(nextDayId);
      });
    } else {
      Promise.resolve().then(() => {
        setPlanAndPersist(normalized);
        setActiveDayId(nextDayId);
      });
    }
  }, [readStoredPlan, setPlanAndPersist]);

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
        const normalized = normalizeTripPlan(data.plan as TripPlan);
        setPlanAndPersist(normalized);
        setActiveDayId(
          normalized.days?.[0]?.id ?? (trip.days[0]?.id ?? ""),
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
  }, [trip.slug, trip.days, setPlanAndPersist]);

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
    setPlanAndPersist((prev) => ({ ...prev, ...patch }));
  }

  function updateDay(dayId: string, patch: Partial<TripDay>) {
    if (readOnly) return;
    setPlanAndPersist((prev) => ({
      ...prev,
      days: prev.days.map((d) => (d.id === dayId ? { ...d, ...patch } : d)),
    }));
  }

  function addFlight(dayId: string) {
    if (readOnly) return;
    setPlanAndPersist((prev) => ({
      ...prev,
      days: prev.days.map((d) =>
        d.id !== dayId
          ? d
          : {
              ...d,
              flight: undefined,
              flights: [
                ...(d.flights ?? []),
                {
                  id: newId("f"),
                  flightNo: "",
                  departAt: "",
                  arriveAt: "",
                  price: "",
                  hasLayover: false,
                },
              ],
            },
      ),
    }));
  }

  function updateFlight(
    dayId: string,
    flightId: string,
    patch: Partial<TripFlight>,
  ) {
    if (readOnly) return;
    setPlanAndPersist((prev) => ({
      ...prev,
      days: prev.days.map((d) =>
        d.id !== dayId
          ? d
          : {
              ...d,
              flight: undefined,
              flights: (d.flights ?? []).map((f) =>
                f.id === flightId ? { ...f, ...patch } : f,
              ),
            },
      ),
    }));
  }

  function removeFlight(dayId: string, flightId: string) {
    if (readOnly) return;
    setPlanAndPersist((prev) => ({
      ...prev,
      days: prev.days.map((d) =>
        d.id !== dayId
          ? d
          : {
              ...d,
              flight: undefined,
              flights: (d.flights ?? []).filter((f) => f.id !== flightId),
            },
      ),
    }));
  }

  function addHotel(dayId: string) {
    if (readOnly) return;
    setPlanAndPersist((prev) => ({
      ...prev,
      days: prev.days.map((d) =>
        d.id !== dayId
          ? d
          : {
              ...d,
              stay: undefined,
              hotels: [
                ...(d.hotels ?? []),
                {
                  id: newId("h"),
                  name: "",
                  url: "",
                  address: "",
                  price: "",
                },
              ],
            },
      ),
    }));
  }

  function updateHotel(
    dayId: string,
    hotelId: string,
    patch: Partial<TripHotel>,
  ) {
    if (readOnly) return;
    setPlanAndPersist((prev) => ({
      ...prev,
      days: prev.days.map((d) =>
        d.id !== dayId
          ? d
          : {
              ...d,
              stay: undefined,
              hotels: (d.hotels ?? []).map((h) =>
                h.id === hotelId ? { ...h, ...patch } : h,
              ),
            },
      ),
    }));
  }

  function removeHotel(dayId: string, hotelId: string) {
    if (readOnly) return;
    setPlanAndPersist((prev) => ({
      ...prev,
      days: prev.days.map((d) =>
        d.id !== dayId
          ? d
          : {
              ...d,
              stay: undefined,
              hotels: (d.hotels ?? []).filter((h) => h.id !== hotelId),
            },
      ),
    }));
  }

  function addPhotos(dayId: string, photos: TripPhoto[]) {
    if (readOnly) return;
    setPlanAndPersist((prev) => ({
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
    setPlanAndPersist((prev) => ({
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
    setPlanAndPersist((prev) => ({
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
    setPlanAndPersist((prev) => ({
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
    setPlanAndPersist((prev) => ({
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
    setPlanAndPersist((prev) => ({
      ...prev,
      days: prev.days.map((d) =>
        d.id !== dayId
          ? d
          : { ...d, schedule: d.schedule.filter((i) => i.id !== itemId) },
      ),
    }));
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
        setPlanAndPersist((prev) => ({ ...prev, writeKeyHash: hash }));
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
      setPlanAndPersist((prev) => ({ ...prev, writeKeyHash: hash }));
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
      const normalized = normalizeTripPlan(data.plan as TripPlan);
      setPlanAndPersist(normalized);
      setActiveDayId(normalized.days?.[0]?.id ?? activeDayId);
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
    setPlanAndPersist(defaultTrip);
    setActiveDayId(defaultTrip.days[0]?.id ?? "");
    setIsUnlocked(true);
    setWriteKeyValue(null);
  }

  return (
    <div className="flex-1 bg-[color:var(--background)] text-[color:var(--foreground)]">
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
                className="vv-muted w-full bg-transparent text-sm outline-none"
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
                    ? "vv-badge-readonly"
                    : "vv-badge-editable",
                ].join(" ")}
              >
                {readOnly ? "只读" : "可编辑"}
              </div>

              <button
                className="vv-btn-ghost inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                onClick={pullFromCloud}
                type="button"
                disabled={cloudBusy}
              >
                云端拉取
              </button>
              <button
                className="vv-btn-ghost inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                onClick={saveToCloud}
                type="button"
                disabled={cloudBusy}
              >
                云端保存
              </button>

              <button
                className="vv-btn-ghost inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium shadow-sm"
                onClick={() => setOverviewOpen(true)}
                type="button"
              >
                一页展示
              </button>

              {!plan.writeKeyHash ? (
                <button
                  className="vv-btn-ghost inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium shadow-sm"
                  onClick={() => openWriteKeyModal("set")}
                  type="button"
                >
                  设置口令
                </button>
              ) : readOnly ? (
                <button
                  className="vv-btn-primary inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => openWriteKeyModal("unlock")}
                  type="button"
                >
                  编辑
                </button>
              ) : (
                <>
                  <button
                    className="vv-btn-ghost inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium shadow-sm"
                    onClick={() => openWriteKeyModal("rotate")}
                    type="button"
                  >
                    更换口令
                  </button>
                </>
              )}

              <button
                className="vv-btn-primary inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                onClick={resetToDefault}
                type="button"
              >
                恢复默认
              </button>
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
            <div className="vv-card rounded-2xl px-4 py-3 text-sm">
              {cloudInfo}
              {cloudUpdatedAt ? `（${cloudUpdatedAt}）` : ""}
            </div>
          ) : null}

          <p className="vv-muted text-sm">
            输入口令后即可修改内容；未输入口令时为只读。也可用“云端保存/拉取”进行同步。
          </p>
        </header>

        <div
          className="vv-panel relative overflow-hidden rounded-[28px]"
          data-vv-theme={isSydneyTheme ? "sydney" : "default"}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,0,0,0.06),transparent_55%),radial-gradient(circle_at_80%_40%,rgba(0,0,0,0.04),transparent_55%)] dark:bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_55%),radial-gradient(circle_at_80%_40%,rgba(255,255,255,0.06),transparent_55%)]" />

          <div className="vv-divider relative border-b px-6 pb-5 pt-6">
            <div className="vv-kicker text-xs font-medium tracking-wider">
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
                        ? "vv-day-active"
                        : "vv-pill",
                    ].join(" ")}
                  >
                    {d.dateLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {activeDay ? (
            <div className="vv-divider relative border-b px-6 pb-5 pt-6 md:hidden">
              <div className="vv-kicker text-xs font-medium tracking-wider">
                CITY
              </div>
              <input
                value={activeDay.city}
                onChange={(e) => updateDay(activeDay.id, { city: e.target.value })}
                className="mt-3 w-full bg-transparent text-xl font-semibold outline-none"
                aria-label="City"
                readOnly={readOnly}
              />
            </div>
          ) : null}

          <div className="relative grid grid-cols-1 md:grid-cols-[380px_1fr]">
            <div className="pointer-events-none absolute inset-y-0 left-[380px] hidden md:block">
              <div className="vv-timeline-line absolute inset-y-0 left-0 w-px" />
              <div className="absolute inset-y-0 left-0 w-10 -translate-x-1/2">
                <div className="vv-timeline-dot absolute left-1/2 top-10 h-3 w-3 -translate-x-1/2 rounded-full" />
                <div className="vv-timeline-dot absolute left-1/2 top-24 h-3 w-3 -translate-x-1/2 rounded-full" />
                <div className="vv-timeline-dot absolute left-1/2 top-[9.5rem] h-3 w-3 -translate-x-1/2 rounded-full" />
                <div className="vv-timeline-dot absolute left-1/2 top-52 h-3 w-3 -translate-x-1/2 rounded-full" />
                <div className="vv-timeline-dot absolute left-1/2 top-[16.5rem] h-3 w-3 -translate-x-1/2 rounded-full" />
              </div>
            </div>

            <aside className="vv-divider relative order-2 flex flex-col border-t md:order-none md:border-t-0">
              {activeDay ? (
                <div className="flex flex-1 flex-col gap-6 px-6 pb-8 pt-6">
                  <div className="hidden flex-col gap-3 md:flex">
                    <div className="vv-kicker text-xs font-medium tracking-wider">
                      CITY
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
                    <div className="flex items-end justify-between">
                      <div className="vv-kicker text-xs font-medium tracking-wider">
                        TRANSPORT
                      </div>
                      <button
                        type="button"
                        className="vv-btn-primary inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-medium shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => addFlight(activeDay.id)}
                        disabled={readOnly}
                      >
                        新增
                      </button>
                    </div>

                    {(activeDay.flights ?? []).length === 0 ? (
                      <div className="vv-empty rounded-2xl p-6 text-sm">
                        暂无交通记录，可新增航班/交通信息。
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {(activeDay.flights ?? []).map((f) => (
                          <div
                            key={f.id}
                            className="vv-card rounded-2xl p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="text-sm font-semibold">航班 / 交通</div>
                              <button
                                type="button"
                                className="vv-btn-secondary inline-flex h-8 items-center justify-center rounded-full px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={() => removeFlight(activeDay.id, f.id)}
                                disabled={readOnly}
                              >
                                删除
                              </button>
                            </div>

                            <div className="mt-3 grid grid-cols-1 gap-2">
                              <input
                                value={f.flightNo ?? ""}
                                onChange={(e) =>
                                  updateFlight(activeDay.id, f.id, {
                                    flightNo: e.target.value,
                                  })
                                }
                                className="vv-input h-11 w-full rounded-2xl px-4 text-sm outline-none"
                                placeholder="航班号 / 车次 / 交通方式"
                                aria-label="Flight number"
                                readOnly={readOnly}
                              />
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <input
                                  type="time"
                                  step={60}
                                  value={f.departAt ?? ""}
                                  onChange={(e) =>
                                    updateFlight(activeDay.id, f.id, {
                                      departAt: e.target.value,
                                    })
                                  }
                                  className="vv-input h-11 w-full rounded-2xl px-4 text-sm outline-none"
                                  placeholder="出发时间"
                                  aria-label="Departure time"
                                  readOnly={readOnly}
                                />
                                <input
                                  type="time"
                                  step={60}
                                  value={f.arriveAt ?? ""}
                                  onChange={(e) =>
                                    updateFlight(activeDay.id, f.id, {
                                      arriveAt: e.target.value,
                                    })
                                  }
                                  className="vv-input h-11 w-full rounded-2xl px-4 text-sm outline-none"
                                  placeholder="到达时间"
                                  aria-label="Arrival time"
                                  readOnly={readOnly}
                                />
                              </div>
                              <input
                                value={f.price ?? ""}
                                onChange={(e) =>
                                  updateFlight(activeDay.id, f.id, {
                                    price: e.target.value,
                                  })
                                }
                                className="vv-input h-11 w-full rounded-2xl px-4 text-sm outline-none"
                                placeholder="价格（可选）"
                                aria-label="Flight price"
                                readOnly={readOnly}
                              />

                              <label className="vv-muted flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  className="vv-checkbox h-4 w-4 rounded"
                                  checked={Boolean(f.hasLayover)}
                                  onChange={(e) =>
                                    updateFlight(activeDay.id, f.id, {
                                      hasLayover: e.target.checked,
                                    })
                                  }
                                  aria-label="Has layover"
                                  disabled={readOnly}
                                />
                                需要转机
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-end justify-between">
                      <div className="vv-kicker text-xs font-medium tracking-wider">
                        STAY
                      </div>
                      <button
                        type="button"
                        className="vv-btn-primary inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-medium shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => addHotel(activeDay.id)}
                        disabled={readOnly}
                      >
                        新增
                      </button>
                    </div>

                    {(activeDay.hotels ?? []).length === 0 ? (
                      <div className="vv-empty rounded-2xl p-6 text-sm">
                        暂无住宿记录，可新增酒店信息。
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {(activeDay.hotels ?? []).map((h) => (
                          <div
                            key={h.id}
                            className="vv-card rounded-2xl p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="text-sm font-semibold">酒店 / 住宿</div>
                              <button
                                type="button"
                                className="vv-btn-secondary inline-flex h-8 items-center justify-center rounded-full px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={() => removeHotel(activeDay.id, h.id)}
                                disabled={readOnly}
                              >
                                删除
                              </button>
                            </div>

                            <div className="mt-3 grid grid-cols-1 gap-2">
                              <div className="flex items-center gap-2">
                                <input
                                  value={h.name ?? ""}
                                  onChange={(e) =>
                                    updateHotel(activeDay.id, h.id, {
                                      name: e.target.value,
                                    })
                                  }
                                  className="vv-input h-11 w-full flex-1 rounded-2xl px-4 text-sm outline-none"
                                  placeholder="名称"
                                  aria-label="Hotel name"
                                  readOnly={readOnly}
                                />
                                {h.url?.trim() ? (
                                  <a
                                    className="vv-btn-ghost inline-flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-medium"
                                    href={toHttpUrl(h.url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    前往
                                  </a>
                                ) : null}
                              </div>
                              <input
                                value={h.url ?? ""}
                                onChange={(e) =>
                                  updateHotel(activeDay.id, h.id, {
                                    url: e.target.value,
                                  })
                                }
                                className="vv-input h-11 w-full rounded-2xl px-4 text-sm outline-none"
                                placeholder="酒店链接（可选）"
                                aria-label="Hotel url"
                                readOnly={readOnly}
                              />
                              <input
                                value={h.address ?? ""}
                                onChange={(e) =>
                                  updateHotel(activeDay.id, h.id, {
                                    address: e.target.value,
                                  })
                                }
                                className="vv-input h-11 w-full rounded-2xl px-4 text-sm outline-none"
                                placeholder="地址"
                                aria-label="Hotel address"
                                readOnly={readOnly}
                              />
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <input
                                  value={h.price ?? ""}
                                  onChange={(e) =>
                                    updateHotel(activeDay.id, h.id, {
                                      price: e.target.value,
                                    })
                                  }
                                  className="vv-input h-11 w-full rounded-2xl px-4 text-sm outline-none"
                                  placeholder="价格（可选）"
                                  aria-label="Hotel price"
                                  readOnly={readOnly}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="vv-kicker text-xs font-medium tracking-wider">
                      NOTES
                    </div>
                    <textarea
                      value={activeDay.notes ?? ""}
                      onChange={(e) =>
                        updateDay(activeDay.id, { notes: e.target.value })
                      }
                      className="vv-input min-h-44 w-full resize-none rounded-2xl p-4 text-sm leading-6 outline-none"
                      placeholder="随手记：酒店地址、换钱、集合点、打车信息、图片/小红书素材…"
                      aria-label="Notes"
                      readOnly={readOnly}
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-end justify-between">
                      <div className="vv-kicker text-xs font-medium tracking-wider">
                        PHOTOS
                      </div>
                      <button
                        type="button"
                        className="vv-btn-primary inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-medium shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
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
                      <div className="vv-empty rounded-2xl p-6 text-sm">
                        这里可以放酒店/航班信息截图、以及游玩照片。上传后会保存在本地浏览器。
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {(activeDay.photos ?? []).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="vv-card group relative aspect-square overflow-hidden rounded-2xl"
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

            <section className="vv-divider relative order-1 flex flex-col border-b px-6 pb-8 pt-6 md:order-none md:border-b-0">
              <div className="flex flex-col gap-2">
                <div className="flex items-end justify-between">
                  <div className="vv-kicker text-xs font-medium tracking-wider">
                    ITINERARY
                  </div>
                  <button
                    type="button"
                    className="vv-btn-primary inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-medium shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => activeDay && addScheduleItem(activeDay.id)}
                    disabled={readOnly}
                  >
                    新增一条
                  </button>
                </div>

                {activeDay ? (
                  <div className="mt-4 flex flex-col gap-3">
                    {activeDay.schedule.length === 0 ? (
                      <div className="vv-empty rounded-2xl p-6 text-sm">
                        还没有行程条目，点“新增一条”开始。
                      </div>
                    ) : (
                      activeDay.schedule.map((item) => (
                        <div
                          key={item.id}
                          className="vv-card group grid grid-cols-[92px_1fr] gap-3 rounded-2xl p-4"
                        >
                          <input
                            value={item.time ?? ""}
                            onChange={(e) =>
                              updateScheduleItem(activeDay.id, item.id, {
                                time: e.target.value,
                              })
                            }
                            className="vv-muted w-full bg-transparent text-sm font-medium outline-none"
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
                                className="vv-btn-secondary invisible inline-flex h-8 items-center justify-center rounded-full px-3 text-xs font-medium group-hover:visible disabled:cursor-not-allowed disabled:opacity-50"
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
                              className="vv-input min-h-20 w-full resize-none rounded-xl p-3 text-sm leading-6 outline-none"
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

        <footer className="vv-muted text-xs leading-6">
          Powered by{" "}
          <a
            className="vv-link font-medium"
            href="https://jimmiewang.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            jimmiewang.com
          </a>
        </footer>

        {overviewOpen ? (
          <div
            className="print-root fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="一页展示"
            onClick={() => setOverviewOpen(false)}
          >
            <div
              className="print-modal vv-panel w-full max-w-5xl overflow-hidden rounded-[28px]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="no-print vv-divider flex items-center justify-between gap-3 border-b px-5 py-4">
                <div className="text-sm font-semibold">一页展示（可打印 / 导出 PDF）</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="vv-btn-primary inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-medium shadow-sm"
                    onClick={() => window.print()}
                  >
                    打印 / PDF
                  </button>
                  <button
                    type="button"
                    className="vv-btn-ghost inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-medium"
                    onClick={() => setOverviewOpen(false)}
                  >
                    关闭
                  </button>
                </div>
              </div>

              <div className="print-scroll max-h-[80vh] overflow-auto p-6">
                <div className="flex flex-col gap-2">
                  <div className="text-2xl font-semibold tracking-tight">{plan.title}</div>
                  {plan.subtitle ? (
                    <div className="vv-muted text-sm">{plan.subtitle}</div>
                  ) : null}
                  <div className="vv-muted text-xs">{plan.slug}</div>
                </div>

                <div className="mt-6 flex flex-col gap-5">
                  {plan.days.map((d) => (
                    <section
                      key={d.id}
                      className="vv-card print-day rounded-3xl p-5"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <div className="text-lg font-semibold">{d.dateLabel}</div>
                        <div className="vv-muted text-sm font-medium">{d.city}</div>
                      </div>

                      {d.flights && d.flights.length > 0 ? (
                        <div className="mt-4">
                          <div className="vv-kicker text-xs font-medium tracking-wider">
                            TRANSPORT
                          </div>
                          <div className="mt-2 flex flex-col gap-2">
                            {d.flights.map((f) => (
                              <div
                                key={f.id}
                                className="vv-card rounded-2xl p-4 text-sm"
                              >
                                <div className="flex flex-wrap gap-x-4 gap-y-1">
                                  <div className="font-medium">{f.flightNo || "（未填写）"}</div>
                                  {f.hasLayover ? (
                                    <div className="vv-muted text-xs">需要转机</div>
                                  ) : null}
                                </div>
                                <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                                  <div>出发：{f.departAt || "-"}</div>
                                  <div>到达：{f.arriveAt || "-"}</div>
                                  <div className="sm:col-span-2">
                                    价格：{f.price || "-"}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {d.hotels && d.hotels.length > 0 ? (
                        <div className="mt-4">
                          <div className="vv-kicker text-xs font-medium tracking-wider">
                            STAY
                          </div>
                          <div className="mt-2 flex flex-col gap-2">
                            {d.hotels.map((h) => (
                              <div
                                key={h.id}
                                className="vv-card rounded-2xl p-4 text-sm"
                              >
                                <div className="font-medium">
                                  {h.name || "（未填写）"}
                                  {h.url?.trim() ? (
                                    <>
                                      {" "}
                                      <a
                                        className="vv-link text-sm font-medium"
                                        href={toHttpUrl(h.url)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        前往
                                      </a>
                                    </>
                                  ) : null}
                                </div>
                                <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                                  <div className="sm:col-span-2">
                                    地址：{h.address || "-"}
                                  </div>
                                  <div>价格：{h.price || "-"}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {d.schedule.length > 0 ? (
                        <div className="mt-4">
                          <div className="vv-kicker text-xs font-medium tracking-wider">
                            ITINERARY
                          </div>
                          <div className="mt-2 flex flex-col gap-2">
                            {d.schedule.map((s) => (
                              <div
                                key={s.id}
                                className="vv-card rounded-2xl p-4"
                              >
                                <div className="flex flex-wrap items-baseline justify-between gap-3">
                                  <div className="text-sm font-semibold">{s.title}</div>
                                  <div className="vv-muted text-xs font-medium">
                                    {s.time || ""}
                                  </div>
                                </div>
                                {s.detail ? (
                                  <div className="mt-2 whitespace-pre-wrap text-sm leading-6">
                                    {s.detail}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {d.notes ? (
                        <div className="mt-4">
                          <div className="vv-kicker text-xs font-medium tracking-wider">
                            NOTES
                          </div>
                          <div className="vv-card mt-2 whitespace-pre-wrap rounded-2xl p-4 text-sm leading-6">
                            {d.notes}
                          </div>
                        </div>
                      ) : null}
                    </section>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {writeKeyModalOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="编辑口令"
            onClick={() => setWriteKeyModalOpen(false)}
          >
            <div
              className="vv-panel w-full max-w-lg overflow-hidden rounded-[28px]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="vv-divider flex items-center justify-between gap-3 border-b px-5 py-4">
                <div className="text-sm font-semibold">
                  {writeKeyModalMode === "unlock"
                    ? "输入编辑口令"
                    : writeKeyModalMode === "set"
                      ? "设置编辑口令"
                      : "更换编辑口令"}
                </div>
                <button
                  type="button"
                  className="vv-btn-ghost inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-medium"
                  onClick={() => setWriteKeyModalOpen(false)}
                >
                  关闭
                </button>
              </div>

              <div className="flex flex-col gap-4 p-5">
                <div className="flex flex-col gap-2">
                  <div className="vv-kicker text-xs font-medium tracking-wider">
                    WRITE KEY
                  </div>
                  <input
                    value={writeKeyInput}
                    onChange={(e) => setWriteKeyInput(e.target.value)}
                    className="vv-input h-12 w-full rounded-2xl px-4 text-sm outline-none"
                    placeholder="建议用不易猜的短语/数字组合（至少 6 位）"
                    aria-label="Write key"
                  />
                  {writeKeyError ? (
                    <div className="text-sm text-rose-700 dark:text-rose-300">
                      {writeKeyError}
                    </div>
                  ) : null}
                </div>

                <div className="vv-muted flex flex-col gap-2 text-xs leading-6">
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
                    className="vv-btn-ghost inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium"
                    onClick={() => setWriteKeyModalOpen(false)}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="vv-btn-primary inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium shadow-sm"
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
                  className="vv-panel w-full max-w-3xl overflow-hidden rounded-[28px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="vv-divider flex items-center justify-between gap-3 border-b px-5 py-4">
                    <div className="text-sm font-semibold">照片</div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="vv-btn-danger inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
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
                        className="vv-btn-ghost inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-medium"
                        onClick={() => setPhotoModal(null)}
                      >
                        关闭
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-0 md:grid-cols-[1.2fr_0.8fr]">
                    <div className="bg-black">
                      <img
                        src={photo.dataUrl}
                        alt={photo.caption?.trim() ? photo.caption : "photo"}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="flex flex-col gap-4 p-5">
                      <div className="flex flex-col gap-2">
                        <div className="vv-kicker text-xs font-medium tracking-wider">
                          TAG
                        </div>
                        <select
                          value={photo.tag ?? "other"}
                          onChange={(e) =>
                            updatePhoto(day.id, photo.id, {
                              tag: e.target.value as TripPhotoTag,
                            })
                          }
                          className="vv-input h-11 w-full rounded-2xl px-4 text-sm outline-none"
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
                        <div className="vv-kicker text-xs font-medium tracking-wider">
                          CAPTION
                        </div>
                        <textarea
                          value={photo.caption ?? ""}
                          onChange={(e) =>
                            updatePhoto(day.id, photo.id, {
                              caption: e.target.value,
                            })
                          }
                          className="vv-input min-h-32 w-full resize-none rounded-2xl p-4 text-sm leading-6 outline-none"
                          placeholder="一句话备注：比如酒店名称、票价、集合点、当天亮点…"
                          aria-label="Photo caption"
                          readOnly={readOnly}
                        />
                      </div>

                      <div className="vv-muted text-xs leading-6">
                        上传的照片会压缩后保存到本地；照片越多占用的本地存储也会越大。
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
