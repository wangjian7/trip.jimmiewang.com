import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ceairMetroAirports = JSON.parse(
  fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../../shared/ceair-metro-airports.json"),
    "utf8",
  ),
);

export function ceairAirportSegment(code) {
  const normalized = code.trim().toUpperCase();
  const airports = ceairMetroAirports[normalized] ?? [normalized];
  return airports.join(",");
}

export function buildCeairUrlSegment(originCode, destCode) {
  return `${ceairAirportSegment(originCode)}-${ceairAirportSegment(destCode)}`;
}

export { ceairMetroAirports as CEAIR_METRO_AIRPORTS };
