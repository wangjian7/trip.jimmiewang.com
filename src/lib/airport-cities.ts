export type AirportCity = {
  code: string;
  display: string;
  names: string[];
  hint?: string;
  ceairAirports?: string[];
};

export const airportCities: AirportCity[] = [
  {
    code: "SHA",
    display: "上海",
    names: ["上海", "Shanghai", "SHA", "PVG", "浦东", "虹桥"],
    hint: "含浦东/虹桥",
    ceairAirports: ["SHA", "PVG"],
  },
  {
    code: "BJS",
    display: "北京",
    names: ["北京", "Beijing", "BJS", "PEK", "PKX", "首都", "大兴"],
    hint: "含首都/大兴",
    ceairAirports: ["PEK", "PKX"],
  },
  {
    code: "CAN",
    display: "广州",
    names: ["广州", "Guangzhou", "CAN"],
  },
  {
    code: "SZX",
    display: "深圳",
    names: ["深圳", "Shenzhen", "SZX"],
  },
  {
    code: "CTU",
    display: "成都",
    names: ["成都", "Chengdu", "CTU"],
  },
  {
    code: "HGH",
    display: "杭州",
    names: ["杭州", "Hangzhou", "HGH"],
  },
  {
    code: "NKG",
    display: "南京",
    names: ["南京", "Nanjing", "NKG"],
  },
  {
    code: "KMG",
    display: "昆明",
    names: ["昆明", "Kunming", "KMG"],
  },
  {
    code: "DLU",
    display: "大理",
    names: ["大理", "Dali", "DLU"],
  },
  {
    code: "BNE",
    display: "布里斯班",
    names: ["布里斯班", "Brisbane", "BNE"],
  },
  {
    code: "SYD",
    display: "悉尼",
    names: ["悉尼", "Sydney", "SYD"],
  },
  {
    code: "MEL",
    display: "墨尔本",
    names: ["墨尔本", "Melbourne", "MEL"],
  },
  {
    code: "OOL",
    display: "黄金海岸",
    names: ["黄金海岸", "Gold Coast", "OOL", "Coolangatta"],
  },
  {
    code: "CNS",
    display: "凯恩斯",
    names: ["凯恩斯", "Cairns", "CNS"],
  },
];

export function getCityByCode(code: string) {
  const normalized = code.trim().toUpperCase();
  return airportCities.find((city) => city.code === normalized) ?? null;
}

export function getCityDisplay(code: string) {
  return getCityByCode(code)?.display ?? code;
}

export function resolveCityInput(input: string) {
  const query = input.trim();
  if (!query) return null;

  const upper = query.toUpperCase();
  const exactCode = airportCities.find((city) => city.code === upper);
  if (exactCode) return exactCode;

  const lower = query.toLowerCase();
  return (
    airportCities.find((city) =>
      city.names.some((name) => name.toLowerCase() === lower),
    ) ??
    airportCities.find((city) =>
      city.names.some((name) => name.toLowerCase().includes(lower)),
    ) ??
    airportCities.find((city) => city.display.includes(query))
  );
}

export function searchCities(query: string, limit = 8) {
  const trimmed = query.trim();
  if (!trimmed) return airportCities.slice(0, limit);

  const lower = trimmed.toLowerCase();
  const scored = airportCities
    .map((city) => {
      let score = 0;
      if (city.code.toLowerCase() === lower) score += 100;
      if (city.display === trimmed) score += 90;
      if (city.names.some((name) => name.toLowerCase() === lower)) score += 80;
      if (city.display.includes(trimmed)) score += 40;
      if (city.names.some((name) => name.toLowerCase().includes(lower))) score += 20;
      return { city, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((item) => item.city);
}

export function buildDefaultLabel(
  originCode: string,
  destCode: string,
  travelDate: string,
) {
  const shortDate = travelDate.slice(5).replace("-", ".");
  return `${shortDate} ${getCityDisplay(originCode)}→${getCityDisplay(destCode)}`;
}

export function buildCeairShoppingUrl(
  originCode: string,
  destCode: string,
  travelDate: string,
) {
  const origin = getCityByCode(originCode);
  const dest = getCityByCode(destCode);
  const originSegment = (origin?.ceairAirports ?? [originCode]).join(",");
  const destSegment = (dest?.ceairAirports ?? [destCode]).join(",");
  return `https://www.ceair.com/zh/cny/shopping/oneway/${originSegment}-${destSegment}/${travelDate}`;
}
