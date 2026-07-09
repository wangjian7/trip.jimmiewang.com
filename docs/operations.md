# Operations

本文件用于记录需要人工判断的操作步骤、脚本调用方式与踩坑记录。

## 使用规则

- 记录所有不适合只靠代码表达的操作流程。
- 优先写清楚前置条件、执行步骤、验证方式、常见失败点。
- 同一类操作应持续补充到对应大类章节，避免散落。

## 文档结构

| 章节 | 内容 |
|------|------|
| [一、本地开发](#一本地开发) | 依赖安装、本地 D1、Next.js / Pages Functions / 航班看板 / Worker dev / **Mac Mini 抓取** |
| [二、生产部署](#二生产部署) | Pages、D1 迁移、Worker deploy、环境变量、首次接入 |
| [三、运维](#三运维) | Browser Run 配额检查、手工触发 Worker、Cron 观察、日志、Dashboard、常见故障 |

## 维护模板

### 操作项名称
- 场景:
- 前置条件:
- 执行步骤:
- 验证方式:
- 踩坑记录:

---

## 一、本地开发

### 1.1 依赖安装

项目根目录与 Worker 子目录各有独立 `package.json`，**`npm install` 要做两次**：

```bash
# 根目录：Next.js、Pages 用 wrangler、本地 Playwright 试抓
cd trip.jimmiewang.com
npm install

# Worker 子目录：@cloudflare/puppeteer、Worker 专用 wrangler
cd trip.jimmiewang.com/workers/flight-scraper
npm install
```

或从根目录：`npm run worker:scraper:install`

说明：`npm install` 只装本机依赖，不会在 Cloudflare 上创建 Worker。

---

### 1.2 本地环境变量（前端）

- 文件：`.env.development`（gitignore，可参考 `.env.example`）
- 常用变量：
  - `NEXT_PUBLIC_APP_ENV=development`
  - `NEXT_PUBLIC_SCRAPE_ENABLED=true`（显示「试抓一次」按钮）
- 生产变量在 Dashboard 配置，见 [2.4 Pages 前端环境变量](#24-pages-前端环境变量next_public_)

---

### 1.3 本地 D1 迁移

```bash
cd trip.jimmiewang.com
npm run d1:migrate:local              # trips 表（0001）
npm run d1:migrate:local:flights      # 航班三表（0002）
```

- 本地 D1 数据：`.wrangler/state/v3/d1/` 下 SQLite 文件
- 远端迁移见 [2.3 D1 表结构部署到远端](#23-d1-表结构部署到远端)

---

### 1.4 本地联调：Pages Functions + D1

- 场景：联调 `/functions` 与本地 D1 API（不含 Next 热更新）
- 步骤：
  ```bash
  cd trip.jimmiewang.com
  npm install
  npm run d1:migrate:local
  npm run build
  npx wrangler pages dev ./out --local --persist-to=./.wrangler/state --port 8788
  ```
- 验证：
  - `GET http://localhost:8788/api/trips/<slug>` → 404 或 plan JSON
  - `PUT` 携带 `x-write-key` 后能写入

---

### 1.5 本地开发：网站 + 航班关注看板

- 场景：`/flights/` 列表、添加、详情；Next 热更新 + 本地 D1 API + Playwright 试抓
- 前置：已 `npm install`、已跑 [1.3](#13-本地-d1-迁移) 本地 D1 迁移

**推荐：两个终端**

| 终端 | 命令 | 地址 |
|------|------|------|
| 1 前端 | `npm run dev` | http://localhost:3000 |
| 2 API + 试抓 | `npm run dev:api` | API :8788，scrape :8789 |

或一条命令：`npm run dev:local`

**试抓（仅本地，写本地 D1）**

```bash
npm run scrape:install    # 首次安装 Chromium
npm run scrape:local -- --watch-id fw-sha-bne-20260930
```

详情页「试抓一次」需终端 2 的 `dev:api` 在跑。

**改代码后重启**

- 只改 `src/`：多数情况热更新，否则重启终端 1
- 改 `functions/` 或 D1 迁移：重启终端 2
- 改 `next.config.ts`：必须重启终端 1

**验证**

```bash
curl http://127.0.0.1:8788/api/flights/
curl http://localhost:3000/api/flights/
```

**踩坑**

- 只跑 `npm run dev` → 无 D1 API，页面报「暂时无法加载关注列表」
- 8788/8789 占用：`lsof -ti :8788,:8789 | xargs kill`
- API 路径须带 trailing slash：`/api/flights/`
- 无 `flight_watches` 表 → 补跑 `d1:migrate:local:flights`
- 表结构见 `docs/表结构设计.md`；决策见 `docs/decisions.md` 0003 / 0004

---

### 1.6 本地开发：flight-scraper Worker（可选，易不稳定）

- 场景：本地调试 Worker 代码；**模拟 Cron 抓东航并写远端 D1**；或 Phase 1 探测页面
- 目录：`workers/flight-scraper/`（勿与根目录 `npm run dev` 混淆）
- 原则：东航抓取仍走 **CF Browser Run**（不是本机 Chrome）；与生产 **共用 D1 + Browser Run 日配额**

**前置条件**

- 已在 `workers/flight-scraper/` 执行过 `npm install`
- `npx wrangler whoami` 已登录
- 先查 [3.2 Browser Run 日配额](#32-检查-browser-run-日配额)（`usedBrowserTimeSeconds` 未接近 600）
- 若开系统代理，命令前加 `env -u http_proxy -u https_proxy ...`；curl localhost 时设 `no_proxy=127.0.0.1,localhost`

**端口对照（避免冲突）**

| 端口 | 用途 |
|------|------|
| **8787** | Worker `dev` / `dev:remote` |
| **8790** | Worker `dev:scheduled`（模拟 Cron） |
| 8788 | 根目录 `npm run dev:api` → Pages Functions |
| 8789 | 根目录 `npm run dev:api` → 本地 Playwright scrape |

若同时跑网站联调（`dev:api`）和 Worker，**不要关 8789**；Worker 已固定用 8787 / 8790。

**方式 A：普通 HTTP 调试（8787）**

| 目的 | 目录 | 命令 |
|------|------|------|
| Worker dev（remote 绑定） | `workers/flight-scraper/` | `npm run dev:remote` |
| 从根目录 | `trip.jimmiewang.com/` | `npm run worker:scraper:dev` |

```bash
cd trip.jimmiewang.com/workers/flight-scraper
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY npm run dev:remote
```

另开终端验证（不耗 Browser 配额）：

```bash
export no_proxy=127.0.0.1,localhost
env -u http_proxy -u https_proxy curl http://127.0.0.1:8787/health
env -u http_proxy -u https_proxy curl http://127.0.0.1:8787/limits
```

**方式 B：模拟 Cron，抓 enabled watches 并写远端 D1（8790，推荐测 Phase 2）**

1. **终端 1** — 启动 scheduled dev（保持运行，看到 `Ready on http://localhost:8790` 即成功）：

```bash
cd trip.jimmiewang.com/workers/flight-scraper
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY npm run dev:scheduled
```

2. **终端 2** — 触发一次 Cron（等价 `scheduled()`）：

```bash
export no_proxy=127.0.0.1,localhost,*
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
  curl -m 180 http://127.0.0.1:8790/__scheduled
```

或在浏览器打开：`http://localhost:8790/__scheduled`

**说明：** `curl /__scheduled` **常常长时间无输出**（30s～2min 都正常）——wrangler 会等 `scheduled()` 里的抓取跑完才返回。期间请看 **终端 1** 是否出现 `scheduled` / `scrape_job_done` 日志，不要连点 curl。

3. **看终端 1 日志**，应有 `event: "scheduled"`、`event: "scrape_job_done"`（抓取约 1–2 分钟）。

4. **验证是否写入远端 D1**：

```bash
curl https://trip.jimmiewang.com/api/flights/fw-sha-bne-20260930/

cd trip.jimmiewang.com
npx wrangler d1 execute trip-jimmiewang-com --remote --command \
  "SELECT status, scrape_date, slot, flights_found, min_price_cny, error_message FROM flight_scrape_runs WHERE watch_id='fw-sha-bne-20260930';"
```

详情页：[https://trip.jimmiewang.com/flights/detail/?id=fw-sha-bne-20260930](https://trip.jimmiewang.com/flights/detail/?id=fw-sha-bne-20260930)

**方式 C：仅 HTTP 探测东航页面（不写 D1）**

```bash
# dev:remote 在 8787 跑着时
curl -m 180 "http://127.0.0.1:8787/?url=https://www.ceair.com/zh/cny/shopping/oneway/SHA,PVG-BNE/2026-09-30"
```

**踩坑**

- `curl /__scheduled` **一直无输出**：正常在等抓取结束；须 `no_proxy` + `env -u http_proxy`；加 `-m 180` 避免无限挂；**以终端 1 日志为准**
- `curl /__scheduled` 超过 3min 仍无日志：Browser Run 配额可能用尽（查 `/limits`）；`Ctrl+C` 后等 UTC 0:00 或北京 15:00 生产 Cron
- `Address already in use 8789`：`dev:api` 占用了 8789；用 **`dev:scheduled`（8790）**，勿改回默认端口
- `cd: no such file or directory: trip.jimmiewang.com/...`：人已在 `flight-scraper/` 里时，直接 `npm run dev:scheduled`，不要重复 `cd`
- 开 WARP 才能连 CF，但 WARP 可能拖慢/阻断东航 → 与生产 deploy 行为不一致
- `http_proxy` 会导致 curl localhost 无响应 → `no_proxy` + `env -u ...`
- 反复 curl `/` 或 `/__scheduled` → Browser Run 429 / 配额用尽；`/health`、`/limits` **不消耗**配额
- 本地 `--remote` 与生产 **共用** Browser Run 日配额；完整抓取优先等生产 Cron（北京 09:00 / 15:00），见 [3.3](#33-手工触发-worker生产推荐)
- 8787 / 8790 占用：`lsof -ti :8787,:8790 | xargs kill`

---

### 1.7 Mac Mini 定时抓取（写远端 D1，可替代 Worker + Browser Run）

- 场景：常开 Mac Mini 上用 **本机 Playwright** 抓东航，直接写 **线上 D1**；绕过 Browser Run 600s/日配额与 CF 数据中心 IP 限制
- 与 Worker 关系：**二选一**。Mac Mini 作主抓取时 **Worker Cron 已停用**（`wrangler.toml` → `crons = []`）
- 前端 / Pages API：**不用改**，仍读同库 D1

**架构**

```
Mac Mini launchd（09:00 / 15:00 本地时区）
  → scripts/macmini/run-scrape.sh
  → npm run scrape:remote -- --all
  → Playwright + wrangler d1 execute --remote
  → 远端 D1 flight_scrape_runs / flight_quotes
       ↓
trip.jimmiewang.com /api/flights（不变）
```

**1. 一次性部署（Mac Mini 上）**

```bash
# 代码目录（按你实际路径改）
cd ~/nextcloud/jimmiewang/trip.jimmiewang.com

npm install
npm run scrape:install          # Playwright Chromium
npx wrangler login              # 写远端 D1 凭据

# 手工试跑一次（写线上 D1）
env -u http_proxy -u https_proxy npm run scrape:remote -- --watch-id=fw-sha-bne-20260930

# 验证
curl https://trip.jimmiewang.com/api/flights/fw-sha-bne-20260930/
```

抓取全部 `enabled=1` 的关注：`npm run scrape:remote -- --all`

**2. 安装 Cron（macOS 用 launchd，不用 crontab）**

Mac 上推荐 **launchd LaunchAgents**（睡眠/唤醒、日志更稳）。模板在 `scripts/macmini/`。

```bash
cd trip.jimmiewang.com
chmod +x scripts/macmini/install-launchd.sh
./scripts/macmini/install-launchd.sh
```

- 默认 **本地时间 09:00、15:00** 各跑一次（请把 Mac 系统时区设为 **亚洲/上海**）
- 日志：`~/Library/Logs/trip-flight-scrape/scrape-*.log`
- **手动触发一次**（不等定时）：
  ```bash
  ~/nextcloud/jimmiewang/trip.jimmiewang.com/scripts/macmini/run-scrape.sh
  ```
- 查看任务状态：
  ```bash
  launchctl print gui/$(id -u)/com.jimmiewang.trip-flight-scrape
  ```
- 卸载：
  ```bash
  launchctl bootout gui/$(id -u)/com.jimmiewang.trip-flight-scrape
  rm ~/Library/LaunchAgents/com.jimmiewang.trip-flight-scrape.plist
  ```

若代码不在 `~/nextcloud/jimmiewang/...`，安装前设置：

```bash
export TRIP_REPO=/你的/实际/路径/trip.jimmiewang.com
./scripts/macmini/install-launchd.sh
```

**3. 代码更新后**

Mac Mini 上 `git pull`（或 Nextcloud 同步）后 **无需 reinstall launchd**；下次定时会跑新脚本。改了 plist 才需重跑 `install-launchd.sh`。

**4. npm 脚本对照**

| 命令 | 写哪 | 用途 |
|------|------|------|
| `npm run scrape:local -- --watch-id=...` | 本地 D1 | 开发联调 |
| `npm run scrape:remote -- --watch-id=...` | **远端 D1** | Mac Mini / 手工补抓 |
| `npm run scrape:remote -- --all` | **远端 D1** | launchd 定时任务 |

**5. Worker Cron 状态（2026-07-09 已停用）**

`workers/flight-scraper/wrangler.toml` 已为 `crons = []` 并 deploy。恢复 Cron：

```bash
# wrangler.toml → crons = ["0 1 * * *", "0 7 * * *"]
cd trip.jimmiewang.com/workers/flight-scraper && npm run deploy
```

**踩坑**

- Mac Mini 须 **常开且未睡眠**（系统设置 → 节能 → 防止自动睡眠，或仅显示器睡眠）
- `wrangler login` 过期 → 定时任务 D1 写入失败，看 `~/Library/Logs/trip-flight-scrape/`
- 代理环境：`run-scrape.sh` 已 `env -u http_proxy`；Playwright 抓 ceair 一般 **不需要** WARP
- 决策背景见 `docs/decisions.md` 0004 备选方案（GitHub Actions / launchd）

---

## 二、生产部署

### 2.1 架构速览

| 组件 | 部署方式 | 说明 |
|------|----------|------|
| **Pages** `trip-jimmiewang-com` | `git push` → 自动构建 | 静态站 + Pages Functions（/api/trips、/api/flights、/api/photos） |
| **Worker** `trip-flight-scraper` | **`wrangler deploy` 单独发布** | **Cron 已停用**；代码保留作备用探测；**生产抓取改 Mac Mini**（§1.7） |
| **D1** `trip-jimmiewang-com` | `wrangler d1 execute --remote` | Pages 与 Worker 共用 |

`git push` **不会** deploy Worker。

---

### 2.2 部署 Cloudflare Pages（前端 + Functions）

- 场景：trip.jimmiewang.com 静态站 + Functions + D1 + R2
- 前置：仓库已连接 Pages；远端 D1/R2 已建；远端 D1 已迁移（[2.3](#23-d1-表结构部署到远端)）

**Pages 项目配置**

- Root directory：`trip.jimmiewang.com`
- Build command：`npm run build`
- Output directory：`out`

**Functions Bindings（Production）**

| Variable | 资源 |
|----------|------|
| `DB` | D1 `trip-jimmiewang-com` |
| `BUCKET` | R2 `trip-photos` |

**代码变更发布**：push 到 GitHub → Pages 自动构建（或 Dashboard Retry deployment）

**验证**

- `https://trip.jimmiewang.com/trips/au-2026-09-30/`
- `https://trip.jimmiewang.com/api/flights/` → JSON，非 `no such table`

**踩坑**

- 只跑本地 D1 迁移、未跑远端 → 线上 `no such table`
- 500 / error 1101 → 检查 Production D1 binding 名必须为 `DB`
- `bucket_not_bound` → Production 补 `BUCKET` → `trip-photos` 并 redeploy

---

### 2.3 D1 表结构部署到远端

```bash
cd trip.jimmiewang.com
npm run d1:migrate:remote                                    # 0001 trips
npx wrangler d1 execute DB --remote --file=./migrations/0002_flight_prices.sql   # 0002 航班
```

验证：

```bash
npx wrangler d1 execute trip-jimmiewang-com --remote --command \
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
curl https://trip.jimmiewang.com/api/flights/
```

可选备份：`npx wrangler d1 export trip-jimmiewang-com --remote --output backup-$(date +%F).sql`

---

### 2.4 Pages 前端环境变量（NEXT_PUBLIC_*）

Dashboard → **Workers 和 Pages** → `trip-jimmiewang-com` → **Settings** → **Environment variables** → **Production**：

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_APP_ENV` | `production` |
| `NEXT_PUBLIC_SCRAPE_ENABLED` | `false` |

保存后 **Retry deployment**（变量在 `next build` 时 bake 进 JS）。

本地对照：`.env.development`；决策见 `docs/decisions.md` 0005。

---

### 2.5 flight-scraper Worker 部署

- 场景：Phase 1/2 探测与抓取代码（决策 0004）；**2026-07-09 起 Cron 已停用**，生产抓取改 [Mac Mini §1.7](#17-mac-mini-定时抓取写远端-d1可替代-worker--browser-run)
- 原则：代码保留、可 `deploy`；`wrangler.toml` 里 `crons = []` 即不注册定时
- 配置：`workers/flight-scraper/wrangler.toml`（D1 + `[browser]`；`[triggers] crons = []`）

**每次 Worker 代码变更后发布**

```bash
cd trip.jimmiewang.com/workers/flight-scraper
npm install   # 依赖有变时
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY npm run deploy
```

或根目录：`npm run worker:scraper:deploy`

**deploy 会做什么**

- 上传 Worker bundle
- 绑定 D1（`DB`）、Browser Run（`BROWSER`）
- **同步 Cron 注册表**（当前 `crons = []` → Dashboard 无定时触发）

**恢复 Cron（一般不需要）**：`wrangler.toml` 改回 `crons = ["0 1 * * *", "0 7 * * *"]` 后 deploy

**当前生产 URL**：`https://trip-flight-scraper.wangjian7.workers.dev`

**部署后验证**

```bash
curl https://trip-flight-scraper.wangjian7.workers.dev/health
```

**与 Pages 发布顺序**：无硬性依赖；若改 D1 表结构，先 [2.3](#23-d1-表结构部署到远端) 再 deploy Worker。

**Phase 2（代码已实现，Cron 已停）**：`scheduled()` / `/scrape` 逻辑保留；生产由 Mac Mini `npm run scrape:remote` 写 D1。

---

### 2.6 首次接入：D1 + R2 + Pages Functions（历史参考）

- 场景：从纯静态 localStorage 升级为云端同步 + 照片
- 步骤概要：
  - 创建 D1、R2 bucket
  - Pages Functions 提供 Trip/照片 API（writeKey + 限流）
  - 照片存 R2，元数据存 D1
- 踩坑：图片勿塞 D1；公开可写须加 writeKey

---

## 三、运维

### 3.1 Worker 触发机制（Cron / 手工 / wrangler）

**生产 URL**：`https://trip-flight-scraper.wangjian7.workers.dev`

| 触发方式 | 请求路径 | Worker 执行位置 | Browser Run | 消耗配额 |
|----------|----------|-----------------|-------------|----------|
| **Cron 定时** | ~~已停用~~ | — | — | — |
| **Mac Mini launchd** | 本地 09:00 / 15:00 | Mac Mini | 本机 Playwright | **否（推荐）** |
| **curl 生产 `/scrape`** | → `fetch()` 后台 | CF 边缘 | CF | 是（备用，慎用） |
| **curl `/health`** | → `fetch()` 健康检查 | CF 边缘 | 否 | **否** |
| **curl 本地 `:8787/`** | wrangler 代理 → CF 远端预览 | CF 远端预览 | CF | 是 |

要点：

- Dashboard → `trip-flight-scraper` → **Triggers** 可**查看** Cron，通常**不能**一键立即运行
- 生产 `workers.dev` **不经过本机 WARP**
- 手工探测前先看 [3.2 Browser Run 日配额](#32-检查-browser-run-日配额)；勿连点 `/`（Free 约 10 分钟/天）

---

### 3.2 检查 Browser Run 日配额

- 场景：手工 curl `/` 探测东航前；或返回 `quota exhausted` / 429；或 Dashboard 里会话异常增多
- 前置条件：Worker 已 [deploy](#25-flight-scraper-worker-部署) 到生产

**执行步骤**

```bash
# 不启动浏览器，不消耗配额
curl https://trip-flight-scraper.wangjian7.workers.dev/limits
```

关注 JSON 里 `limits` 字段：

| 字段 | 含义 | 够用？ |
|------|------|--------|
| `usedBrowserTimeSeconds` | 当日已用浏览器时长（秒） | Free 档约 **600s/天（≈10 分钟）**；`< 600` 且单次探测需 1–2 分钟时通常够 Cron + 偶尔手工测 |
| `allowedBrowserAcquisitions` | 当前是否允许再 launch | `0` → 速率限制，稍等再试 |
| `activeSessions` | 未关闭的会话 | 非空且长期存在 → 可能 `browser.close()` 未执行，会持续扣配额 |
| `timeUntilNextAllowedBrowserAcquisition` | 距下次可 launch 的等待（ms） | `> 0` 时先等 |

**验证方式**

- `usedBrowserTimeSeconds` 明显低于 600（例如 `< 500`）→ 可以 [3.3](#33-手工触发-worker生产推荐) 手工 curl `/` **一次**
- `GET /` 若配额已用尽，Worker 会在 launch 前直接返回（约百毫秒），例如：
  ```json
  {
    "ok": false,
    "elapsedMs": 136,
    "error": "Browser Run daily quota exhausted (~643s used). Retry after UTC midnight reset."
  }
  ```
  此时 **再 curl `/` 无意义**，不会启动浏览器，也测不出东航。
- 配额用尽时 **Cron 同样无法 launch**，D1 里可能 **没有任何 `flight_scrape_runs` 行** → 线上 API `latestRun: null`（不是 bug，是还没成功抓过）

**配额重置**

- 按 **UTC 0:00** 日切重置 → 北京时间 **早上 08:00**
- Cron 每天 2 次（北京 09:00 / 15:00）在配额内通常足够；调试阶段勿反复 curl `/`

**踩坑**

- 本地 `wrangler dev --remote` 与生产 **共用同一 Browser Run 日配额**
- `/health`、`/limits` **不消耗**配额；只有 `launch()` 才计
- Dashboard → **计算 → 浏览器运行** 可看会话时长与「浏览器空闲」，但**无页面内容**；诊断看 curl JSON 的 `pageUrl` / `pageTitle` / `preview` 或 [3.4](#34-观察日志与-cron) `wrangler tail`

---

### 3.3 手工触发 Worker（生产，推荐）

**先查 [3.2](#32-检查-browser-run-日配额)**，确认 `usedBrowserTimeSeconds` 未接近 600。

```bash
# 健康检查（不消耗 Browser Run）
curl https://trip-flight-scraper.wangjian7.workers.dev/health

# 查看 Browser Run 日配额（不启动浏览器）
curl https://trip-flight-scraper.wangjian7.workers.dev/limits

# 生产：触发抓取（写 D1）。完整任务请等 Cron（北京 09:00 / 15:00）
curl "https://trip-flight-scraper.wangjian7.workers.dev/scrape?watchId=fw-sha-bne-20260930"

# 本地模拟 Cron：见 [1.6 方式 B](#16-本地开发flight-scraper-worker可选易不稳定)

# Phase 1 仅探测页面，不写 D1
curl -m 180 "https://trip-flight-scraper.wangjian7.workers.dev/?url=https://www.ceair.com/..."
```

**验证抓取结果**

```bash
# API（详情页同源数据）
curl https://trip.jimmiewang.com/api/flights/fw-sha-bne-20260930/

# 或直接查 D1
cd trip.jimmiewang.com
npx wrangler d1 execute trip-jimmiewang-com --remote --command \
  "SELECT id, status, scrape_date, slot, flights_found, min_price_cny, error_message FROM flight_scrape_runs ORDER BY started_at DESC LIMIT 5;"
```

---

### 3.4 观察日志与 Cron

```bash
cd trip.jimmiewang.com/workers/flight-scraper
npm run tail
# 或：npm run worker:scraper:tail
```

- Cron 时间：**UTC 01:00 / 07:00**（北京 **09:00 / 15:00**）
- Dashboard：Workers 和 Pages → **trip-flight-scraper** → Triggers

**查 D1 抓取结果（Phase 2 后有数据）**

```bash
npx wrangler d1 execute trip-jimmiewang-com --remote --command \
  "SELECT scrape_date, slot, status, min_price_cny FROM flight_scrape_runs ORDER BY scrape_date DESC LIMIT 5;"
```

---

### 3.5 停用 Cron

`wrangler.toml` 设 `crons = []` 后 `npm run deploy`，或在 Dashboard Triggers 页删除。

---

### 3.6 常见故障速查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| 本地航班列表加载失败 | 只跑了 `npm run dev` | 另开终端 `npm run dev:api` |
| 线上无价格 | Worker Cron 已停 / Mac Mini 未跑 | 查 [§1.7](#17-mac-mini-定时抓取写远端-d1可替代-worker--browser-run) launchd 与 `scrape-*.log` |
| 线上试抓按钮无效 | 生产无 scrape API | 正常；用 Mac Mini `scrape:remote` 或本地 dev |
| `no such table` 线上 | 未跑远端 D1 迁移 | [2.3](#23-d1-表结构部署到远端) |
| `quota exhausted` / `usedBrowserTimeSeconds` ≥ 600 | Browser Run **日配额用尽** | 见 [3.2](#32-检查-browser-run-日配额)；等 UTC 0:00（北京 08:00）重置；勿连点 `/` |
| Worker 429 | Browser Run 配额/速率 | 先查 [3.2](#32-检查-browser-run-日配额)；勿连点 `/`；Cron 每天 2 次足够 |
| Target closed（~40–50s，`preview` 空） | **Browser Run 会话被平台提前回收**，或东航在 CF IP 下未渲染完 | 调大代码 timeout **通常无效**；看 `elapsedMs`、`pageUrl`、`preview`；[3.2](#32-检查-browser-run-日配额) 确认有配额后 **deploy 后 curl 生产 URL 一次** |
| wrangler dev 崩溃 | 代理/连 CF 超时 | 去代理 + WARP；或直接 deploy |
| curl localhost 无反应 | `http_proxy` 劫持 localhost | `no_proxy` + `env -u http_proxy ...` |
| push 后 Worker 未更新 | Pages 与 Worker 分离 | 单独 `npm run deploy` |
| 东航 CF IP 被拦 | 数据中心 IP | 见 `docs/decisions.md` 0004 备胎 |

---

### 3.7 当前进度（2026-07-09）

- Pages + 远端 D1 + 航班 API：已上线
- **生产航班抓取**：**Mac Mini launchd** + `npm run scrape:remote`（§1.7）
- `trip-flight-scraper` Worker：**Cron 已停用**，代码保留（`/health`、`/limits`、Phase 1/2 备用）
- 本地「试抓一次」：`npm run dev:api` 8789（写本地 D1）
