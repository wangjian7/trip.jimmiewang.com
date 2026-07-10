import ceairMetroAirports from "../../shared/ceair-metro-airports.json";

export function ceairAirportSegment(code: string) {
  const airports =
    (ceairMetroAirports as Record<string, string[]>)[code.trim().toUpperCase()] ?? [
      code.trim().toUpperCase(),
    ];
  return airports.join(",");
}

export function buildCeairUrlSegment(originCode: string, destCode: string) {
  return `${ceairAirportSegment(originCode)}-${ceairAirportSegment(destCode)}`;
}

/** @deprecated use shared JSON via ceairAirportSegment */
export const CEAIR_METRO_AIRPORTS = ceairMetroAirports as Record<string, string[]>;
