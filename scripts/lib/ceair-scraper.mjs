import { chromium } from "playwright";

const CEAIR_ORIGIN_AIRPORTS = {
  SHA: ["SHA", "PVG"],
  BJS: ["PEK", "PKX"],
};

export function buildCeairShoppingUrl(originCode, destCode, travelDate) {
  const originSegment = (CEAIR_ORIGIN_AIRPORTS[originCode] ?? [originCode]).join(",");
  const destSegment = (CEAIR_ORIGIN_AIRPORTS[destCode] ?? [destCode]).join(",");
  return `https://www.ceair.com/zh/cny/shopping/oneway/${originSegment}-${destSegment}/${travelDate}`;
}

function parsePriceCny(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d]/g, "");
  if (!digits) return null;
  return Number.parseInt(digits, 10);
}

function normalizeFlightNumbers(raw) {
  const primary = String(raw).trim().match(/^(MU|QF|FM)\s*(\d{3,4})$/i);
  if (primary) return `${primary[1].toUpperCase()}${primary[2]}`;

  const matches = [...String(raw).matchAll(/\b(MU|QF|FM)\s*(\d{3,4})\b/gi)];
  if (matches.length === 0) return null;
  const codes = matches.map(([, carrier, num]) => `${carrier.toUpperCase()}${num}`);
  return [...new Set(codes)].join("+");
}

function buildFingerprint(travelDate, originCode, destCode, flightNumbers, departAt) {
  return `${travelDate}|${originCode}|${destCode}|${flightNumbers}|${departAt}`;
}

function flightNumbersFromBlock(blockLines) {
  const codes = [];
  for (const line of blockLines) {
    const match = line.match(/^(MU|QF|FM)\s*(\d{3,4})$/i);
    if (match) codes.push(`${match[1].toUpperCase()}${match[2]}`);
  }
  if (codes.length === 0) return null;
  return [...new Set(codes)].join("+");
}

export function parseCeairFlightsFromText(text, watch) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks = [];
  let current = null;

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

  const flights = [];
  const seen = new Set();

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
      airlineName: /东航|东方航空|China Eastern/i.test(windowText)
        ? "中国东方航空"
        : null,
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

export async function scrapeCeairWatch(watch, options = {}) {
  const url =
    watch.source_url?.trim() ||
    (watch.source === "ceair"
      ? buildCeairShoppingUrl(watch.origin_code, watch.dest_code, watch.travel_date)
      : null);

  if (!url) {
    throw new Error(`watch ${watch.id} 缺少可用的 source_url`);
  }

  const headless = options.headless ?? true;
  const timeoutMs = options.timeoutMs ?? 90_000;

  const browser = await chromium.launch({ headless });
  try {
    const page = await browser.newPage({
      locale: "zh-CN",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });

    const agreeButton = page.getByText("同意", { exact: true });
    if ((await agreeButton.count()) > 0) {
      await agreeButton.first().click({ timeout: 5000 }).catch(() => {});
    }

    let text = "";
    const pollUntil = Date.now() + timeoutMs;
    while (Date.now() < pollUntil) {
      text = await page.evaluate(() => document.body.innerText);
      if (/MU\s?\d{3,4}/.test(text) && /[¥￥]/.test(text)) break;
      await page.waitForTimeout(1000);
    }

    if (!/MU\s?\d{3,4}/.test(text) || !/[¥￥]/.test(text)) {
      throw new Error(
        "东航页面未加载出航班列表（可能 cookie 未通过、网络慢或被反爬拦截）。可试 npm run scrape:local -- --watch-id=... --headed",
      );
    }

    const flights = parseCeairFlightsFromText(text, watch);

    if (flights.length === 0) {
      throw new Error("页面已打开，但未解析到航班价格，可能页面结构已变化。");
    }

    const directFlights = flights.filter((flight) => flight.isDirect === 1);
    const minDirect = directFlights
      .map((flight) => flight.priceEconomyCny)
      .filter((price) => price != null);
    const minPriceCny = minDirect.length > 0 ? Math.min(...minDirect) : null;

    return {
      url,
      flights,
      minPriceCny,
      flightsFound: flights.length,
    };
  } finally {
    await browser.close();
  }
}
