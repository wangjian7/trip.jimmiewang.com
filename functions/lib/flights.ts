export type FlightWatchRow = {
  id: string;
  trip_slug: string | null;
  label: string;
  origin_code: string;
  dest_code: string;
  travel_date: string;
  direct_only: number;
  cabin: string;
  adult_count: number;
  source: string;
  source_url: string | null;
  pinned_flight_numbers: string | null;
  enabled: number;
  created_at: string;
  updated_at: string;
};

const CEAIR_ORIGIN_AIRPORTS: Record<string, string[]> = {
  SHA: ["SHA", "PVG"],
  BJS: ["PEK", "PKX"],
};

export function buildCeairShoppingUrl(
  originCode: string,
  destCode: string,
  travelDate: string,
) {
  const originSegment = (CEAIR_ORIGIN_AIRPORTS[originCode] ?? [originCode]).join(",");
  const destSegment = (CEAIR_ORIGIN_AIRPORTS[destCode] ?? [destCode]).join(",");
  return `https://www.ceair.com/zh/cny/shopping/oneway/${originSegment}-${destSegment}/${travelDate}`;
}

export function buildWatchId(originCode: string, destCode: string, travelDate: string) {
  const datePart = travelDate.replaceAll("-", "");
  return `fw-${originCode.toLowerCase()}-${destCode.toLowerCase()}-${datePart}`;
}

export function rowToWatch(row: FlightWatchRow) {
  const sourceUrl =
    row.source_url?.trim() ||
    (row.source === "ceair"
      ? buildCeairShoppingUrl(row.origin_code, row.dest_code, row.travel_date)
      : null);

  return {
    id: row.id,
    tripSlug: row.trip_slug,
    label: row.label,
    originCode: row.origin_code,
    destCode: row.dest_code,
    travelDate: row.travel_date,
    directOnly: row.direct_only === 1,
    cabin: row.cabin,
    adultCount: row.adult_count,
    source: row.source,
    sourceUrl,
    pinnedFlightNumbers: row.pinned_flight_numbers,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type FlightQuoteRow = {
  flight_fingerprint: string;
  flight_numbers: string;
  airline_name: string | null;
  is_direct: number;
  depart_at: string;
  arrive_at: string;
  duration_minutes: number | null;
  aircraft: string | null;
  price_economy_cny: number | null;
  price_premium_cny: number | null;
  price_business_cny: number | null;
  scraped_at: string;
};

export function rowToQuote(row: FlightQuoteRow) {
  return {
    flightFingerprint: row.flight_fingerprint,
    flightNumbers: row.flight_numbers,
    airlineName: row.airline_name,
    isDirect: row.is_direct === 1,
    departAt: row.depart_at,
    arriveAt: row.arrive_at,
    durationMinutes: row.duration_minutes,
    aircraft: row.aircraft,
    priceEconomyCny: row.price_economy_cny,
    pricePremiumCny: row.price_premium_cny,
    priceBusinessCny: row.price_business_cny,
    scrapedAt: row.scraped_at,
  };
}
