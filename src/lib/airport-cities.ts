import ceairMetroAirports from "../../shared/ceair-metro-airports.json";

export type AirportCity = {
  code: string;
  display: string;
  names: string[];
  hint?: string;
};

function ceairAirportSegment(code: string) {
  const normalized = code.trim().toUpperCase();
  const airports =
    (ceairMetroAirports as Record<string, string[]>)[normalized] ?? [normalized];
  return airports.join(",");
}

export const airportCities: AirportCity[] = [
  // —— 中国大陆 ——
  {
    code: "SHA",
    display: "上海",
    names: ["上海", "Shanghai", "SHA", "PVG", "浦东", "虹桥"],
    hint: "含浦东/虹桥",
  },
  {
    code: "BJS",
    display: "北京",
    names: ["北京", "Beijing", "BJS", "PEK", "PKX", "首都", "大兴"],
    hint: "含首都/大兴",
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
  // —— 港澳台 ——
  {
    code: "HKG",
    display: "香港",
    names: ["香港", "Hong Kong", "HKG", "HongKong", "赤鱲角"],
  },
  {
    code: "MFM",
    display: "澳门",
    names: ["澳门", "Macau", "Macao", "MFM"],
  },
  // —— 日本 ——
  {
    code: "TYO",
    display: "东京",
    names: ["东京", "Tokyo", "TYO", "NRT", "HND", "成田", "羽田"],
    hint: "含成田/羽田",
  },
  {
    code: "OSA",
    display: "大阪",
    names: ["大阪", "Osaka", "OSA", "KIX", "关西"],
    hint: "关西机场",
  },
  {
    code: "NGO",
    display: "名古屋",
    names: ["名古屋", "Nagoya", "NGO", "中部"],
  },
  {
    code: "FUK",
    display: "福冈",
    names: ["福冈", "Fukuoka", "FUK"],
  },
  {
    code: "CTS",
    display: "札幌",
    names: ["札幌", "Sapporo", "CTS", "新千岁"],
  },
  {
    code: "OKA",
    display: "冲绳",
    names: ["冲绳", "Okinawa", "OKA", "那霸", "Naha"],
  },
  // —— 美国 ——
  {
    code: "LAX",
    display: "洛杉矶",
    names: ["洛杉矶", "Los Angeles", "LAX", "LA"],
  },
  {
    code: "SFO",
    display: "旧金山",
    names: ["旧金山", "San Francisco", "SFO", "湾区"],
  },
  {
    code: "NYC",
    display: "纽约",
    names: ["纽约", "New York", "NYC", "JFK", "EWR", "肯尼迪", "纽瓦克"],
    hint: "含 JFK/纽瓦克",
  },
  {
    code: "ORD",
    display: "芝加哥",
    names: ["芝加哥", "Chicago", "ORD"],
  },
  {
    code: "SEA",
    display: "西雅图",
    names: ["西雅图", "Seattle", "SEA"],
  },
  {
    code: "BOS",
    display: "波士顿",
    names: ["波士顿", "Boston", "BOS"],
  },
  {
    code: "IAD",
    display: "华盛顿",
    names: ["华盛顿", "Washington", "IAD", "Washington DC", "DC", "杜勒斯"],
  },
  {
    code: "MIA",
    display: "迈阿密",
    names: ["迈阿密", "Miami", "MIA"],
  },
  {
    code: "DFW",
    display: "达拉斯",
    names: ["达拉斯", "Dallas", "DFW"],
  },
  {
    code: "IAH",
    display: "休斯顿",
    names: ["休斯顿", "Houston", "IAH"],
  },
  {
    code: "ATL",
    display: "亚特兰大",
    names: ["亚特兰大", "Atlanta", "ATL"],
  },
  {
    code: "LAS",
    display: "拉斯维加斯",
    names: ["拉斯维加斯", "Las Vegas", "LAS"],
  },
  {
    code: "HNL",
    display: "檀香山",
    names: ["檀香山", "Honolulu", "HNL", "夏威夷", "Hawaii"],
  },
  {
    code: "DEN",
    display: "丹佛",
    names: ["丹佛", "Denver", "DEN"],
  },
  {
    code: "PHL",
    display: "费城",
    names: ["费城", "Philadelphia", "PHL"],
  },
  {
    code: "DTW",
    display: "底特律",
    names: ["底特律", "Detroit", "DTW"],
  },
  {
    code: "MSP",
    display: "明尼阿波利斯",
    names: ["明尼阿波利斯", "Minneapolis", "MSP"],
  },
  {
    code: "PDX",
    display: "波特兰",
    names: ["波特兰", "Portland", "PDX"],
  },
  // —— 欧洲 ——
  {
    code: "LON",
    display: "伦敦",
    names: ["伦敦", "London", "LON", "LHR", "LGW", "希思罗", "盖特威克"],
    hint: "含希思罗/盖特威克",
  },
  {
    code: "PAR",
    display: "巴黎",
    names: ["巴黎", "Paris", "PAR", "CDG", "ORY", "戴高乐"],
    hint: "含戴高乐/奥利",
  },
  {
    code: "FRA",
    display: "法兰克福",
    names: ["法兰克福", "Frankfurt", "FRA"],
  },
  {
    code: "MUC",
    display: "慕尼黑",
    names: ["慕尼黑", "Munich", "MUC"],
  },
  {
    code: "AMS",
    display: "阿姆斯特丹",
    names: ["阿姆斯特丹", "Amsterdam", "AMS"],
  },
  {
    code: "FCO",
    display: "罗马",
    names: ["罗马", "Rome", "FCO", "Fiumicino"],
  },
  {
    code: "MXP",
    display: "米兰",
    names: ["米兰", "Milan", "MXP", "Malpensa"],
  },
  {
    code: "MAD",
    display: "马德里",
    names: ["马德里", "Madrid", "MAD"],
  },
  {
    code: "BCN",
    display: "巴塞罗那",
    names: ["巴塞罗那", "Barcelona", "BCN"],
  },
  {
    code: "ZRH",
    display: "苏黎世",
    names: ["苏黎世", "Zurich", "ZRH"],
  },
  {
    code: "VIE",
    display: "维也纳",
    names: ["维也纳", "Vienna", "VIE"],
  },
  {
    code: "BRU",
    display: "布鲁塞尔",
    names: ["布鲁塞尔", "Brussels", "BRU"],
  },
  {
    code: "CPH",
    display: "哥本哈根",
    names: ["哥本哈根", "Copenhagen", "CPH"],
  },
  {
    code: "ARN",
    display: "斯德哥尔摩",
    names: ["斯德哥尔摩", "Stockholm", "ARN", "STO"],
  },
  {
    code: "HEL",
    display: "赫尔辛基",
    names: ["赫尔辛基", "Helsinki", "HEL"],
  },
  {
    code: "DUB",
    display: "都柏林",
    names: ["都柏林", "Dublin", "DUB"],
  },
  {
    code: "LIS",
    display: "里斯本",
    names: ["里斯本", "Lisbon", "LIS"],
  },
  {
    code: "ATH",
    display: "雅典",
    names: ["雅典", "Athens", "ATH"],
  },
  {
    code: "PRG",
    display: "布拉格",
    names: ["布拉格", "Prague", "PRG"],
  },
  {
    code: "WAW",
    display: "华沙",
    names: ["华沙", "Warsaw", "WAW"],
  },
  {
    code: "BUD",
    display: "布达佩斯",
    names: ["布达佩斯", "Budapest", "BUD"],
  },
  {
    code: "IST",
    display: "伊斯坦布尔",
    names: ["伊斯坦布尔", "Istanbul", "IST"],
  },
  {
    code: "GVA",
    display: "日内瓦",
    names: ["日内瓦", "Geneva", "GVA"],
  },
  {
    code: "MAN",
    display: "曼彻斯特",
    names: ["曼彻斯特", "Manchester", "MAN"],
  },
  {
    code: "EDI",
    display: "爱丁堡",
    names: ["爱丁堡", "Edinburgh", "EDI"],
  },
  // —— 澳大利亚 ——
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

export function searchCities(query: string, limit = 10) {
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
  return `https://www.ceair.com/zh/cny/shopping/oneway/${ceairAirportSegment(originCode)}-${ceairAirportSegment(destCode)}/${travelDate}`;
}
