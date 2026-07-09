export type FlightWatchLatestRun = {
  status: string;
  scrapeDate: string | null;
  slot: string | null;
  minPriceCny: number | null;
  observedAt: string | null;
};

export type FlightWatch = {
  id: string;
  tripSlug: string | null;
  label: string;
  originCode: string;
  destCode: string;
  travelDate: string;
  directOnly: boolean;
  cabin: string;
  adultCount: number;
  source: string;
  sourceUrl: string | null;
  pinnedFlightNumbers: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  latestRun?: FlightWatchLatestRun | null;
};

export type FlightWatchDetail = {
  watch: FlightWatch;
  latestRun: {
    id: string;
    status: string;
    scrapeDate: string;
    slot: string;
    minPriceCny: number | null;
    observedAt: string | null;
    requestedUrl: string | null;
    errorMessage: string | null;
    flightsFound: number;
  } | null;
  pinnedQuote: {
    flightNumbers: string;
    priceEconomyCny: number | null;
    scrapedAt: string;
    departAt: string;
    arriveAt: string;
  } | null;
  latestQuotes: FlightQuoteSummary[];
};

export type FlightQuoteSummary = {
  flightFingerprint: string;
  flightNumbers: string;
  airlineName: string | null;
  isDirect: boolean;
  departAt: string;
  arriveAt: string;
  durationMinutes: number | null;
  aircraft: string | null;
  priceEconomyCny: number | null;
  pricePremiumCny: number | null;
  priceBusinessCny: number | null;
  scrapedAt: string;
};

export type CreateFlightWatchInput = {
  label?: string;
  originCode: string;
  destCode: string;
  travelDate: string;
  tripSlug?: string | null;
  directOnly?: boolean;
  cabin?: string;
  adultCount?: number;
  pinnedFlightNumbers?: string | null;
};

async function readErrorCode(res: Response) {
  try {
    const parsed = (await res.json()) as { error?: string };
    return parsed.error ?? "";
  } catch {
    return "";
  }
}

function toUserFacingError(action: "list" | "get" | "create" | "update" | "delete", code: string) {
  if (code === "watch_exists") return "这条航线关注已存在。";
  if (code === "db_not_bound") {
    return "本地 API 未连接 D1。请另开终端运行 npm run dev:api，或使用 npm run dev:local。";
  }
  if (action === "list") return "暂时无法加载关注列表。";
  if (action === "get") return "找不到这条航班关注。";
  if (action === "create") return "添加关注失败，请检查输入。";
  if (action === "update") return "更新关注失败。";
  return "删除关注失败。";
}

export type ScheduleSlotState =
  | "disabled"
  | "pending"
  | "success"
  | "failed"
  | "running"
  | "missed";

export type FlightSchedulePayload = {
  scheduler: {
    name: string;
    executor: string;
    timezone: string;
    slots: Array<{ slot: "am" | "pm"; localTime: string; label: string }>;
    enabledWatchCount: number;
  };
  today: string;
  now: string;
  nextRun: {
    slot: "am" | "pm";
    localTime: string;
    label: string;
    scrapeDate: string;
  };
  watches: Array<
    FlightWatch & {
      schedule: {
        am: {
          state: ScheduleSlotState;
          run: {
            runId: string;
            status: string;
            minPriceCny: number | null;
            observedAt: string | null;
            errorMessage: string | null;
            flightsFound: number;
          } | null;
        };
        pm: {
          state: ScheduleSlotState;
          run: {
            runId: string;
            status: string;
            minPriceCny: number | null;
            observedAt: string | null;
            errorMessage: string | null;
            flightsFound: number;
          } | null;
        };
      };
    }
  >;
  recentRuns: Array<{
    runId: string;
    watchId: string;
    label: string;
    scrapeDate: string;
    slot: string;
    status: string;
    minPriceCny: number | null;
    observedAt: string | null;
    errorMessage: string | null;
    flightsFound: number;
  }>;
};

export async function getFlightSchedule() {
  const res = await fetch("/api/flights/schedule/", { method: "GET" });
  if (!res.ok) {
    const code = await readErrorCode(res);
    if (code === "db_not_bound") {
      throw new Error("本地 API 未连接 D1。请另开终端运行 npm run dev:api。");
    }
    throw new Error("暂时无法加载定时任务。");
  }
  return (await res.json()) as FlightSchedulePayload;
}

export async function listFlightWatches() {
  const res = await fetch("/api/flights/", { method: "GET" });
  if (!res.ok) {
    const code = await readErrorCode(res);
    throw new Error(toUserFacingError("list", code));
  }
  const data = (await res.json()) as { watches: FlightWatch[] };
  return data.watches;
}

export async function getFlightWatch(id: string) {
  const res = await fetch(`/api/flights/${encodeURIComponent(id)}/`, { method: "GET" });
  if (res.status === 404) return null;
  if (!res.ok) {
    const code = await readErrorCode(res);
    throw new Error(toUserFacingError("get", code));
  }
  return (await res.json()) as FlightWatchDetail;
}

export async function createFlightWatch(input: CreateFlightWatchInput) {
  const res = await fetch("/api/flights/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const code = await readErrorCode(res);
    throw new Error(toUserFacingError("create", code));
  }
  const data = (await res.json()) as { watch: FlightWatch };
  return data.watch;
}

export async function updateFlightWatch(
  id: string,
  patch: Partial<Pick<FlightWatch, "label" | "enabled" | "pinnedFlightNumbers">>,
) {
  const res = await fetch(`/api/flights/${encodeURIComponent(id)}/`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const code = await readErrorCode(res);
    throw new Error(toUserFacingError("update", code));
  }
  const data = (await res.json()) as { watch: FlightWatch };
  return data.watch;
}

export async function deleteFlightWatch(id: string) {
  const res = await fetch(`/api/flights/${encodeURIComponent(id)}/`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const code = await readErrorCode(res);
    throw new Error(toUserFacingError("delete", code));
  }
}

export type FlightWatchTrend = {
  travelDate: string;
  flights: FlightFlightTrend[];
};

export type FlightFlightTrend = {
  flightNumbers: string;
  points: FlightTrendPoint[];
};

export type FlightTrendPoint = {
  scrapeDate: string;
  slot: string;
  scrapedAt: string;
  priceEconomyCny: number | null;
  flightNumbers: string;
  deltaCny: number | null;
};

export async function getFlightWatchTrend(id: string) {
  const res = await fetch(`/api/flights/${encodeURIComponent(id)}/trend/`, {
    method: "GET",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const code = await readErrorCode(res);
    if (code === "db_not_bound") {
      throw new Error("本地 API 未连接 D1。请确认 npm run dev:api 正在运行。");
    }
    throw new Error("暂时无法加载价格曲线。");
  }
  return (await res.json()) as FlightWatchTrend;
}

export type ScrapeFlightWatchResult = {
  ok: boolean;
  watchId: string;
  runId: string;
  scrapeDate: string;
  slot: string;
  flightsFound: number;
  minPriceCny: number | null;
  skipped: boolean;
  message: string;
};

export async function scrapeFlightWatch(id: string) {
  const res = await fetch(`/api/flights/${encodeURIComponent(id)}/scrape/`, {
    method: "POST",
  });
  if (!res.ok) {
    let message = "试抓失败。";
    try {
      const parsed = (await res.json()) as { message?: string; error?: string };
      if (parsed.message) message = parsed.message;
      else if (parsed.error === "scrape_failed") {
        message = "抓取失败，请查看终端 2 的 [scrape] 日志。";
      }
    } catch {
      if (res.status === 404 || res.status === 502 || res.status === 500) {
        message = "无法连接 scrape 服务。请确认 npm run dev:api 正在运行，并查看终端 2 日志。";
      }
    }
    throw new Error(message);
  }
  return (await res.json()) as ScrapeFlightWatchResult;
}

export function formatCny(price: number | null | undefined) {
  if (price == null) return "—";
  return `¥${price.toLocaleString("zh-CN")}`;
}

export function formatObservedAt(iso: string | null | undefined) {
  if (!iso) return "尚未观测";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTravelDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDurationMinutes(minutes: number | null | undefined) {
  if (minutes == null) return "—";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} 分钟`;
  if (mins === 0) return `${hours} 小时`;
  return `${hours} 小时 ${mins} 分`;
}
