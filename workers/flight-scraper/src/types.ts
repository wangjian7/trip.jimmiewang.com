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

export type ParsedFlight = {
  flightFingerprint: string;
  flightNumbers: string;
  airlineName: string | null;
  isDirect: number;
  travelDate: string;
  departAt: string;
  arriveAt: string;
  durationMinutes: number | null;
  aircraft: string | null;
  priceEconomyCny: number | null;
  pricePremiumCny: number | null;
  priceBusinessCny: number | null;
};

export type ScrapeResult = {
  url: string;
  flights: ParsedFlight[];
  minPriceCny: number | null;
  flightsFound: number;
};

export type WatchScrapeOutcome = {
  watchId: string;
  ok: boolean;
  skipped?: boolean;
  runId?: string;
  flightsFound?: number;
  minPriceCny?: number | null;
  error?: string;
  message?: string;
};

export type ScrapeJobSummary = {
  ok: boolean;
  watchCount: number;
  results: WatchScrapeOutcome[];
  error?: string;
};
