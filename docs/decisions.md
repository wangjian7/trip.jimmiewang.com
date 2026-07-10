# Decisions

本文件用于记录架构与技术选型决策。

## 使用规则
- 所有新决策必须以追加方式写入，不能覆盖历史决策。
- 每条决策建议包含：日期、背景、决策、影响、备选方案。
- 若某条旧决策失效，请新增一条后续决策说明替代关系。

## 决策模板

### 0001. 决策标题
- 日期: YYYY-MM-DD
- 状态: proposed | accepted | superseded
- 背景:
  - 待补充
- 决策:
  - 待补充
- 影响:
  - 待补充
- 备选方案:
  - 待补充

### 0002. trip.jimmiewang.com 持久化与照片存储优先使用 Cloudflare（D1 + R2 + Worker）
- 日期: 2026-05-16
- 状态: proposed
- 背景:
  - trip.jimmiewang.com 当前为纯静态站点：行程/文本/照片都保存在浏览器 localStorage，无法实现多人实时共享与跨设备一致。
  - 期望实现：任意同伴在同一链接下编辑并立即同步；支持上传酒店/航班截图与游玩照片。
  - 偏好尽量使用 Cloudflare 体系完成（部署、存储、鉴权与边缘性能）。
- 决策:
  - 前端继续保持 Cloudflare Pages 托管的静态站点（Next.js Static Export）。
  - 新增后端写入与读取能力，优先采用 Cloudflare：
    - D1: 存储 Trip/Day/Schedule/Notes 等结构化数据，以及照片元数据（tag/caption/关联 day）。
    - R2: 存储图片二进制对象（原图或压缩图），通过签名 URL 或受控公开 URL 提供访问。
    - Worker（或 Pages Functions）: 提供 API（读写 Trip、生成上传签名/直传凭证、提交照片元数据）。
  - 鉴权策略分阶段：
    - Phase 1（最简可用）: “有链接即可编辑”，但建议至少引入一个共享写入令牌（writeKey）作为写入门槛，并叠加基础限流，降低被刷/被改风险。
    - Phase 2（可选）: 若需要更强控制，再引入 Cloudflare Access / Turnstile / OAuth 之类方案。
- 影响:
  - 实现多人共享与跨设备一致；行程与照片不再依赖本地浏览器存储。
  - 需要设计数据模型与迁移方案（从前端 JSON 导入 D1），并补齐 API、CORS、限流与错误处理。
  - 图片将带来存储成本与体积控制问题，需要设定上传尺寸/格式/数量策略（前端压缩 + 后端限制）。
- 备选方案:
  - KV 仅存 JSON（不做 D1）：实现快，但并发写冲突处理困难，后续扩展性差。
  - Durable Objects 做协同编辑：更接近实时协作，但复杂度更高，先不做。
  - 继续 localStorage + JSON 导入导出：零后端成本，但无法做到“统一链接自动同步”。 

### 0003. 航班价格追踪：数据源采用东航官网页面抓取（放弃 OTA 与私有 API 直连）
- 日期: 2026-07-06
- 状态: accepted
- 背景:
  - 需求：9/30 上海→布里斯班（出发日固定）只看直飞，每天上午/下午各记录一次价格，观察同一航班（如 MU715）随观测时间的价格变化。
  - 2026-07-06 实测三个数据源：
    - 携程国内站（flights.ctrip.com）：页面框架能加载，但航班列表区域被反爬静默拦截，永远停留在 loading，不渲染数据。
    - Trip.com 国际站：航班数据能查到（显示 35 条结果），但弹滑块验证码拦截，无法全自动化。
    - 东航官网（ceair.com）：支持直接 URL 访问结果页 `https://www.ceair.com/zh/cny/shopping/oneway/SHA,PVG-BNE/2026-09-30`，无验证码、无登录，几秒内渲染完成；当日抓到 MU715 直飞经济舱 ¥7,040。
  - 东航内部 JSON 接口（`portal/v3/shopping/briefInfo` 等）直接 POST 会被拒（返回 `geeToken` 字段，接了极验风控），纯 fetch 直连不可行。
- 决策:
  - 数据源使用东航官网结果页，通过无头浏览器渲染后解析 DOM 提取航班号/时刻/舱位价格。
  - 不做携程/Trip.com 爬取；不做东航私有 API 签名逆向。
  - 价格口径以东航官网直销价（CNY）为准；与 OTA 展示价可能有差异，但趋势监控更干净稳定。
- 影响:
  - 抓取必须依赖浏览器渲染环境（Playwright/Puppeteer/Browser Rendering），不能用纯 HTTP 请求。
  - 只能覆盖东航系航班（MU715 直飞 + MU/QF 联运中转），无法比较全市场价格；对本需求（盯 MU715）足够。
- 备选方案:
  - 携程/Trip.com 爬取：数据全但反爬强（静默拦截/滑块验证码），需人机配合，放弃全自动路线。
  - 第三方航班 API（Amadeus/AviationStack）：无验证码适合定时任务，但价格与实际购票渠道有出入，暂不采用。
  - 反反爬（住宅代理+指纹伪装）：投入大、易失效，不值得为单条航线做。

### 0004. 航班价格追踪：三表时间序列模型 + Cloudflare Cron Triggers + Browser Rendering 定时抓取
- 日期: 2026-07-06
- 状态: proposed
- 背景:
  - 出发日固定（2026-09-30），要区分「出发日 travel_date」与「观测日 scrape_date + 时段 slot」两个时间维度，形成价格时间序列。
  - 本地 Mac 不常开机，定时任务需要跑在云端。
- 决策:
  - 数据模型三张表（计划放 `migrations/0002_flight_prices.sql`，与 trips 表同库 D1）：
    - `flight_watches`：监控配置（航线、固定出发日、只看直飞、关联 trip_slug）。
    - `flight_scrape_runs`：抓取批次（scrape_date + slot am/pm，UNIQUE 约束同一天同时段只记一次；含状态与本次最低价）。
    - `flight_quotes`：单航班报价（flight_fingerprint = 出发日|机场|航班号|起飞时刻，用于跨批次串联同一航班；价格存 CNY 整数元）。
  - 调度与执行全部放 Cloudflare：
    - Cron Triggers 定时（UTC 01:00/07:00 = 北京 09:00/15:00，每天两次）。
    - Browser Rendering 在 Worker 内跑无头浏览器渲染东航结果页（Workers Free 含每天 10 分钟，单次约 20–30 秒，两次/天用量约 1 分钟，免费额度足够）。
    - 解析结果直接写入同账号 D1；trip 网站后续加价格曲线页从 D1 读取。
- 影响:
  - 全链路不依赖本地机器；数据与现有行程数据同库，便于展示层复用 Pages Functions。
  - 已知风险：Browser Rendering 出口为 Cloudflare 数据中心 IP（多在海外），东航官网对数据中心 IP 是否放行需部署最小 Worker 实测；被拦则切换备选方案。
- 备选方案:
  - GitHub Actions 定时跑 Playwright + `wrangler d1 execute --remote` 写入：免费、不依赖本地，作为 CF IP 被拦时的首选备胎（代码基本可复用）。
  - 本地 Mac launchd 定时：环境最接近真实用户，但依赖开机，放弃作为主方案。
  - **2026-07-09 起**：生产抓取改 **Mac Mini launchd + `scrape:remote`**；Worker Cron 停用，代码保留。
  - **2026-07-10 起**：本地 dev 同样只用 **Playwright 脚本（`:8789` / `scrape:local`）**，不再用 Worker + Browser Run 试抓。
  - 国内轻量云主机跑 cron：最稳但需付费，仅在前两者都不可行时考虑。

### 0006. 航班抓取执行端：Mac Mini launchd 取代 Worker Cron
- 日期: 2026-07-09
- 状态: accepted
- 背景:
  - Browser Run 日配额约 600s，多航线监控下不够用；CF 数据中心 IP 抓东航不稳定。
  - Mac Mini 常开，0003 已验证本机 Playwright 可抓东航；`scrape_ceair_remote.mjs` 可写远端 D1。
  - 本地 dev 若走 Worker + Browser Run，与生产共用配额且与 Mac Mini 脚本路径不一致。
- 决策:
  - **生产抓取**：Mac Mini `launchd`（09:00 / 15:00）+ `npm run scrape:remote -- --all`。
  - **本地抓取**：`dev:api` / `scrape:local` → 同一套 `scripts/lib/ceair-scraper.mjs` 写本地 D1；**不启动** `workers/flight-scraper`。
  - **`trip-flight-scraper` Worker**：`wrangler.toml` 设 `crons = []` 并 deploy，**代码不删**；保留 `/health`、`/limits`、Phase 1/2 作历史备用。
  - Pages + D1 + 航班 API **不变**。
- 影响:
  - 本地与生产抓取统一为 Playwright 脚本；运维见 `operations.md` §1.0 / §1.7。
  - 不再消耗 Browser Run 日配额做定时抓。
  - 依赖 Mac Mini 常开、未睡眠；需 `wrangler login` 有效。
- 备选方案:
  - 恢复 Worker Cron（改回 crons 并 deploy）。
  - GitHub Actions + Playwright（0004 备胎，Mac Mini 不可用时）。

### 0005. 前端环境标识与功能开关（NEXT_PUBLIC_* 区分 dev / production 能力）
- 日期: 2026-07-08
- 状态: accepted
- 背景:
  - 本地开发与 Cloudflare Pages 生产的能力集不同：本地有 Playwright scrape 服务（8789）与 wrangler 本地 D1；生产有 Pages Functions + 远端 D1，航班抓取由 **Mac Mini** 写远端 D1（**不用 Worker**）。
  - 若不区分环境，生产详情页仍展示「试抓一次」，用户点击后返回 405，体验易误解为站点故障。
  - Next.js 采用 Static Export，客户端可读的环境变量必须在 `next build` 时通过 `NEXT_PUBLIC_*` 注入。
- 决策:
  - 引入两层前端环境配置（见 `src/lib/env.ts`、`.env.example`）：
    - `NEXT_PUBLIC_APP_ENV`：`development` | `production`，标识运行环境。
    - `NEXT_PUBLIC_SCRAPE_ENABLED`：是否展示本地 Playwright「试抓一次」入口（`true` 仅本地 dev）。
  - 本地：`npm run dev` 自动加载 `.env.development`（`APP_ENV=development`，`SCRAPE_ENABLED=true`）。
  - 生产：在 Cloudflare Pages **Build environment variables → Production** 设置 `NEXT_PUBLIC_APP_ENV=production`，不设或设 `NEXT_PUBLIC_SCRAPE_ENABLED=false`。
  - UI 按功能开关显隐能力，而非硬编码 `NODE_ENV`（Preview 与 Production build 的 `NODE_ENV` 均为 `production`，无法区分）。
- 影响:
  - 生产不再误展示不可用的试抓按钮；本地开发行为不变。
  - 新增能力（如 Cron 状态提示）可继续用 `NEXT_PUBLIC_*` 开关扩展，无需改构建架构。
  - 变更 `NEXT_PUBLIC_*` 后须重新触发 Pages 构建才会生效（变量在 build 时 bake 进静态 JS）。
- 备选方案:
  - 仅用 `process.env.NODE_ENV === 'development'`：实现简单，但无法区分 Pages Preview / Production。
  - 运行时 API 探测 scrape 端点：多一次请求且仍无法解决 UI 文案问题，不采用。
  - 生产也部署 scrape Pages Function：Playwright 无法在 Pages 边缘运行，不可行。

