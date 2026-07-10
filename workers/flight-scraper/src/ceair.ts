import type { FlightWatchRow, ParsedFlight, ScrapeResult } from "./types";
import ceairMetroAirports from "../../../shared/ceair-metro-airports.json";

function ceairAirportSegment(code: string) {
  const normalized = code.trim().toUpperCase();
  const airports =
    (ceairMetroAirports as Record<string, string[]>)[normalized] ?? [normalized];
  return airports.join(",");
}

export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export const NAV_TIMEOUT_MS = 60_000;
export const FLIGHTS_WAIT_MS = 90_000;

export type Page = Awaited<
  ReturnType<Awaited<ReturnType<typeof import("@cloudflare/puppeteer").default.launch>>["newPage"]>
>;

export type PageSnapshot = {
  pageUrl: string;
  pageTitle: string;
  text: string;
  readError?: string;
};

export function buildCeairShoppingUrl(
  originCode: string,
  destCode: string,
  travelDate: string,
) {
  return `https://www.ceair.com/zh/cny/shopping/oneway/${ceairAirportSegment(originCode)}-${ceairAirportSegment(destCode)}/${travelDate}`;
}

export function resolveWatchUrl(watch: FlightWatchRow) {
  const url = watch.source_url?.trim();
  if (url) return url;
  if (watch.source === "ceair") {
    return buildCeairShoppingUrl(watch.origin_code, watch.dest_code, watch.travel_date);
  }
  return null;
}

function parsePriceCny(raw: string) {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  return Number.parseInt(digits, 10);
}

function buildFingerprint(
  travelDate: string,
  originCode: string,
  destCode: string,
  flightNumbers: string,
  departAt: string,
) {
  return `${travelDate}|${originCode}|${destCode}|${flightNumbers}|${departAt}`;
}

function flightNumbersFromBlock(blockLines: string[]) {
  const codes: string[] = [];
  for (const line of blockLines) {
    const match = line.match(/^(MU|QF|FM)\s*(\d{3,4})$/i);
    if (match) codes.push(`${match[1].toUpperCase()}${match[2]}`);
  }
  if (codes.length === 0) return null;
  return [...new Set(codes)].join("+");
}

export function flightListReady(text: string) {
  return /MU\s?\d{3,4}/.test(text) && /[¥￥]/.test(text);
}

export function parseCeairFlightsFromText(text: string, watch: FlightWatchRow): ParsedFlight[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks: Array<{ header: string; lines: string[] }> = [];
  let current: { header: string; lines: string[] } | null = null;

  for (const line of lines) {
    const primaryFlight = line.match(/^(MU|QF|FM)\s*(\d{3,4})$/i);
    if (primaryFlight) {
      if (current) blocks.push(current);
      current = { header: line, lines: [line] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) blocks.push(current);

  const flights: ParsedFlight[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    const windowText = block.lines.join(" ");
    const flightNumbers = flightNumbersFromBlock(block.lines);
    if (!flightNumbers) continue;

    const isDirect = /直达|直飞/.test(windowText);
    const hasTransferHint = /中转|经停/.test(windowText) || flightNumbers.includes("+");
    const isDirectFlight = isDirect && !hasTransferHint;

    if (watch.direct_only && !isDirectFlight) continue;

    const timeMatches = [...windowText.matchAll(/(\d{1,2}:\d{2})(?:\+1)?/g)].map(
      (match) => match[1],
    );
    const departAt = timeMatches[0] ?? "";
    const arriveAt = timeMatches[1] ?? "";
    if (!departAt) continue;

    const priceMatches = [...windowText.matchAll(/[¥￥]\s*([\d,]+)/g)].map((match) =>
      parsePriceCny(match[1]),
    );
    const economy = priceMatches[0] ?? null;
    const business = priceMatches[2] ?? priceMatches[1] ?? null;

    const fingerprint = buildFingerprint(
      watch.travel_date,
      watch.origin_code,
      watch.dest_code,
      flightNumbers,
      departAt,
    );
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    const durationMatch = windowText.match(/(\d+)h\s*(\d+)m|(\d+)小时(\d+)分/);
    const durationMinutes = durationMatch
      ? Number(durationMatch[1] ?? durationMatch[3]) * 60 +
        Number(durationMatch[2] ?? durationMatch[4] ?? 0)
      : null;

    const aircraftMatch = windowText.match(/空客\d+[^(]*\([^)]*\)|波音\d+[^(]*\([^)]*\)|A\d{3}/);

    flights.push({
      flightFingerprint: fingerprint,
      flightNumbers,
      airlineName: /东航|东方航空|China Eastern/i.test(windowText) ? "中国东方航空" : null,
      isDirect: isDirectFlight ? 1 : 0,
      travelDate: watch.travel_date,
      departAt,
      arriveAt: arriveAt || departAt,
      durationMinutes,
      aircraft: aircraftMatch?.[0] ?? null,
      priceEconomyCny: economy,
      pricePremiumCny: null,
      priceBusinessCny: business !== economy ? business : null,
    });
  }

  return flights;
}

export async function readPageSnapshot(page: Page): Promise<PageSnapshot> {
  try {
    return await page.evaluate(() => ({
      pageUrl: location.href,
      pageTitle: document.title,
      text: document.body?.innerText ?? "",
    }));
  } catch (error) {
    return {
      pageUrl: page.url(),
      pageTitle: "",
      text: "",
      readError: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function configurePage(page: Page) {
  await page.setUserAgent(USER_AGENT);
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const type = req.resourceType();
    if (type === "image" || type === "font" || type === "media") {
      req.abort();
    } else {
      req.continue();
    }
  });
}

export async function scrapeCeairPageText(page: Page, url: string): Promise<PageSnapshot> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });

  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button, a, span, div")];
    const agree = buttons.find((el) => el.textContent?.trim() === "同意");
    if (agree instanceof HTMLElement) agree.click();
  });

  let snapshot = await readPageSnapshot(page);
  const pollUntil = Date.now() + FLIGHTS_WAIT_MS;
  while (Date.now() < pollUntil) {
    snapshot = await readPageSnapshot(page);
    if (flightListReady(snapshot.text)) return snapshot;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (snapshot.readError && !snapshot.text) {
    throw new Error(`Browser session ended: ${snapshot.readError}`);
  }
  if (!flightListReady(snapshot.text)) {
    throw new Error(
      snapshot.text
        ? `Timed out waiting for MU+price (${FLIGHTS_WAIT_MS / 1000}s). pageUrl=${snapshot.pageUrl}`
        : `Empty page —东航可能未渲染或 CF IP 被拦. pageUrl=${snapshot.pageUrl} pageTitle=${snapshot.pageTitle}`,
    );
  }

  return snapshot;
}

export function buildScrapeResult(
  watch: FlightWatchRow,
  url: string,
  text: string,
): ScrapeResult {
  const flights = parseCeairFlightsFromText(text, watch);
  if (flights.length === 0) {
    throw new Error("页面已打开，但未解析到航班价格，可能页面结构已变化。");
  }

  const directFlights = flights.filter((flight) => flight.isDirect === 1);
  const minDirect = directFlights
    .map((flight) => flight.priceEconomyCny)
    .filter((price): price is number => price != null);
  const minPriceCny = minDirect.length > 0 ? Math.min(...minDirect) : null;

  return {
    url,
    flights,
    minPriceCny,
    flightsFound: flights.length,
  };
}
