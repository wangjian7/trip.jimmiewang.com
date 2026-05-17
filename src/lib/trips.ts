export type TripScheduleItem = {
  id: string;
  time?: string;
  title: string;
  detail?: string;
};

export type TripPhotoTag = "hotel" | "flight" | "play" | "other";

export type TripPhoto = {
  id: string;
  r2Key?: string;
  dataUrl?: string;
  createdAt: string;
  tag?: TripPhotoTag;
  caption?: string;
};

export type TripFlight = {
  id: string;
  flightNo?: string;
  departAt?: string;
  arriveAt?: string;
  price?: string;
  hasLayover?: boolean;
};

export type TripHotel = {
  id: string;
  name?: string;
  url?: string;
  address?: string;
  price?: string;
};

export type TripDay = {
  id: string;
  dateLabel: string;
  city: string;
  flight?: string;
  stay?: string;
  flights?: TripFlight[];
  hotels?: TripHotel[];
  notes?: string;
  photos?: TripPhoto[];
  schedule: TripScheduleItem[];
};

export type TripPlan = {
  slug: string;
  title: string;
  subtitle?: string;
  startDate: string;
  endDate: string;
  writeKeyHash?: string;
  days: TripDay[];
};

export const trips: TripPlan[] = [
  {
    slug: "au-2026-09-30",
    title: "澳洲海岸线：黄金海岸 → 凯恩斯 → 悉尼",
    subtitle: "2026 9/30–10/9（可按实际航班调整）",
    startDate: "2026-09-30",
    endDate: "2026-10-09",
    days: [
      {
        id: "d-0930",
        dateLabel: "9/30（晚）",
        city: "上海 → 黄金海岸",
        flight: "上海出发 → 黄金海岸（航班号/时间待定）",
        stay: "机上 / 抵达后酒店待定",
        notes: "重点：护照/签证、转换插头、电话卡、行李重量。",
        schedule: [
          { id: "s-0930-1", time: "20:00", title: "出发去机场" },
          { id: "s-0930-2", time: "23:00", title: "起飞（以上海时间为准）" },
        ],
      },
      {
        id: "d-1001",
        dateLabel: "10/1",
        city: "黄金海岸",
        stay: "黄金海岸（连住）",
        notes: "第一天适应时差，海边散步+补给。",
        schedule: [
          { id: "s-1001-1", time: "上午", title: "抵达 & 入住/寄存行李" },
          { id: "s-1001-2", time: "下午", title: "海滩/海边步道" },
          { id: "s-1001-3", time: "晚上", title: "附近餐厅简单吃" },
        ],
      },
      {
        id: "d-1002",
        dateLabel: "10/2",
        city: "黄金海岸",
        stay: "黄金海岸（连住）",
        notes: "可选主题乐园/观景台，按体力决定。",
        schedule: [
          { id: "s-1002-1", time: "上午", title: "咖啡 + 轻松行程" },
          { id: "s-1002-2", time: "下午", title: "可选：主题乐园/冲浪课/观景台" },
          { id: "s-1002-3", time: "晚上", title: "整理行李，准备转场" },
        ],
      },
      {
        id: "d-1003",
        dateLabel: "10/3",
        city: "黄金海岸 → 凯恩斯",
        flight: "黄金海岸 → 凯恩斯（航班号/时间待定）",
        stay: "凯恩斯（连住）",
        notes: "转场日，优先把交通和入住跑顺。",
        schedule: [
          { id: "s-1003-1", time: "上午", title: "退房 & 去机场" },
          { id: "s-1003-2", time: "中午", title: "飞往凯恩斯" },
          { id: "s-1003-3", time: "下午", title: "入住 & 海边散步" },
        ],
      },
      {
        id: "d-1004",
        dateLabel: "10/4",
        city: "凯恩斯",
        stay: "凯恩斯（连住）",
        notes: "可选：大堡礁一日游/外海浮潜。",
        schedule: [
          { id: "s-1004-1", time: "早上", title: "出发去码头集合" },
          { id: "s-1004-2", time: "全天", title: "大堡礁出海（可选）" },
          { id: "s-1004-3", time: "晚上", title: "海鲜/夜市" },
        ],
      },
      {
        id: "d-1005",
        dateLabel: "10/5",
        city: "凯恩斯",
        stay: "凯恩斯（连住）",
        notes: "可选：雨林/库兰达小火车，或纯休整。",
        schedule: [
          { id: "s-1005-1", time: "上午", title: "可选：库兰达雨林方向" },
          { id: "s-1005-2", time: "下午", title: "咖啡+补给，拍照素材" },
          { id: "s-1005-3", time: "晚上", title: "提前订好悉尼住宿/交通" },
        ],
      },
      {
        id: "d-1006",
        dateLabel: "10/6",
        city: "凯恩斯 → 悉尼",
        flight: "凯恩斯 → 悉尼（航班号/时间待定）",
        stay: "悉尼（连住）",
        notes: "转场日，悉尼建议住交通方便的位置。",
        schedule: [
          { id: "s-1006-1", time: "上午", title: "退房 & 去机场" },
          { id: "s-1006-2", time: "中午", title: "飞往悉尼" },
          { id: "s-1006-3", time: "下午", title: "入住 & 附近熟悉环境" },
        ],
      },
      {
        id: "d-1007",
        dateLabel: "10/7",
        city: "悉尼",
        stay: "悉尼（连住）",
        notes: "歌剧院/海港大桥一线，走路就能出片。",
        schedule: [
          { id: "s-1007-1", time: "上午", title: "环形码头 → 歌剧院" },
          { id: "s-1007-2", time: "下午", title: "海港大桥周边散步/看日落" },
          { id: "s-1007-3", time: "晚上", title: "达令港/市区晚餐" },
        ],
      },
      {
        id: "d-1008",
        dateLabel: "10/8",
        city: "悉尼",
        flight: "备选：10/8 晚 航班回上海（航班号/时间待定）",
        stay: "悉尼（连住）",
        notes: "返程备选：10/8 晚回上海，或 10/9 白天回。",
        schedule: [
          { id: "s-1008-1", time: "上午", title: "自由活动：海滩/市集/购物" },
          { id: "s-1008-2", time: "下午", title: "整理行李 & 预留去机场时间" },
          { id: "s-1008-3", time: "晚上", title: "备选：夜航回上海" },
        ],
      },
      {
        id: "d-1009",
        dateLabel: "10/9",
        city: "悉尼 → 上海",
        flight: "10/9 白天 航班回上海（航班号/时间待定）",
        stay: "返程",
        notes: "如果 10/8 没走，这一天走白天航班。",
        schedule: [{ id: "s-1009-1", time: "白天", title: "返程航班" }],
      },
    ],
  },
  {
    slug: "dali-06-18",
    title: "云南大理：6/18–6/22",
    subtitle: "苍山洱海慢游 5 天",
    startDate: "2026-06-18",
    endDate: "2026-06-22",
    days: [
      {
        id: "d-0618",
        dateLabel: "6/18",
        city: "出发 → 大理",
        flight: "前往大理（航班/高铁待定）",
        stay: "大理古城 / 洱海周边",
        notes: "到达日以入住和熟悉周边为主，晚点到也能轻松衔接。",
        schedule: [
          { id: "s-0618-1", time: "上午", title: "出发前往大理" },
          { id: "s-0618-2", time: "下午", title: "抵达 & 入住" },
          { id: "s-0618-3", time: "晚上", title: "古城散步 + 晚餐" },
        ],
      },
      {
        id: "d-0619",
        dateLabel: "6/19",
        city: "大理",
        stay: "大理古城 / 洱海周边",
        notes: "适合先走古城和周边轻松路线，把节奏放慢。",
        schedule: [
          { id: "s-0619-1", time: "上午", title: "大理古城慢逛" },
          { id: "s-0619-2", time: "下午", title: "三塔 / 周边咖啡馆" },
          { id: "s-0619-3", time: "晚上", title: "古城夜景 + 晚餐" },
        ],
      },
      {
        id: "d-0620",
        dateLabel: "6/20",
        city: "大理",
        stay: "洱海周边",
        notes: "这一天可以重点放在洱海沿线，适合拍照和轻松停靠。",
        schedule: [
          { id: "s-0620-1", time: "上午", title: "环洱海 / 海边停靠" },
          { id: "s-0620-2", time: "下午", title: "双廊 / 喜洲方向" },
          { id: "s-0620-3", time: "晚上", title: "日落 + 晚餐" },
        ],
      },
      {
        id: "d-0621",
        dateLabel: "6/21",
        city: "大理",
        stay: "大理",
        notes: "可以安排半天山景或保留成自由活动日。",
        schedule: [
          { id: "s-0621-1", time: "上午", title: "可选：苍山方向" },
          { id: "s-0621-2", time: "下午", title: "自由活动 / 补拍素材" },
          { id: "s-0621-3", time: "晚上", title: "整理返程安排" },
        ],
      },
      {
        id: "d-0622",
        dateLabel: "6/22",
        city: "大理 → 返程",
        flight: "返程（航班/高铁待定）",
        stay: "返程",
        notes: "预留足够去机场/车站的时间，轻装收尾。",
        schedule: [
          { id: "s-0622-1", time: "上午", title: "早餐 & 收拾行李" },
          { id: "s-0622-2", time: "下午", title: "返程" },
        ],
      },
    ],
  },
];

export function getTripSlugs() {
  return trips.map((t) => t.slug);
}

export function getTripBySlug(slug: string) {
  return trips.find((t) => t.slug === slug);
}
