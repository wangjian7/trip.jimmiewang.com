# Operations

本文件用于记录需要人工判断的操作步骤、脚本调用方式与踩坑记录。

## 使用规则

- 记录所有不适合只靠代码表达的操作流程。
- 优先写清楚前置条件、执行步骤、验证方式、常见失败点。
- 同一类操作应持续补充到对应大类章节，避免散落。

## 文档结构

| 章节 | 内容 |
|------|------|
| [一、本地开发](#一本地开发) | **[1.0 快速启动](#10-本地快速启动)**、Playwright 试抓、D1、航班看板、Mac Mini |
| [二、生产部署](#二生产部署) | Pages、D1 迁移、环境变量；Worker 部署见 [附录 A](#附录-aflight-scraper-worker-已废弃仅代码保留) |
| [三、运维](#三运维) | **生产日常操作速查**、Mac Mini launchd、常见故障 |

## 维护模板

### 操作项名称
- 场景:
- 前置条件:
- 执行步骤:
- 验证方式:
- 踩坑记录:

---

## 一、本地开发

### 1.0 本地快速启动

- 场景：日常改 trip 网站、行程页、航班看板，本机联调前端 + D1 API + **本机 Playwright 试抓**
- 目录：在 **`trip.jimmiewang.com`** 项目根下执行（路径按你本机实际位置，例如 `~/nextcloud/jimmiewang/trip.jimmiewang.com` 或 `~/trip.jimmiewang.com`）

**航班抓取：本地不用 Worker / Browser Run**

| 环境 | 怎么抓 | 写哪 | 明确不用 |
|------|--------|------|----------|
| **本地 dev** | `dev:api` 里 `[scrape]` → `scripts/scrape-server.mjs`（:8789）；或 CLI `npm run scrape:local` | 本地 D1 | ~~`workers/flight-scraper`~~、~~Browser Run~~ |
| **生产** | Mac Mini launchd → `npm run scrape:remote` | 远端 D1 | ~~Worker Cron~~ |

本地与 Mac Mini 共用 **`scripts/lib/ceair-scraper.mjs`**（Playwright）。`workers/flight-scraper/` **代码保留**，日常开发**无需**安装或启动 Worker，见 [附录 A](#附录-aflight-scraper-worker-已废弃仅代码保留)。

**首次启动前（若还没做过）**

```bash
cd trip.jimmiewang.com
npm install
npm run d1:migrate:local              # trips 表（0001）
npm run d1:migrate:local:flights      # 航班三表（0002）
npm run build                         # dev:api 依赖 out/ 静态产物
npm run scrape:install                # 首次试抓：安装 Playwright Chromium
```

环境变量见 [1.2](#12-本地环境变量前端)。**不必**为航班抓取安装 `workers/flight-scraper/`（除非改遗留 Worker 代码，见 [附录 A](#附录-aflight-scraper-worker-已废弃仅代码保留)）。

**推荐：一条命令（网站 + API + 试抓）**

```bash
cd trip.jimmiewang.com
npm run dev:local
```

| 服务 | 地址 |
|------|------|
| 网站（Next.js 热更新） | http://localhost:3000 |
| Pages Functions + 本地 D1 | http://localhost:8788 |
| 航班 Playwright 试抓（**非 Worker**） | http://localhost:8789 |

**或拆成两个终端**

| 终端 | 命令 | 用途 |
|------|------|------|
| 1 | `npm run dev` | 前端 |
| 2 | `npm run dev:api` | D1 API + 航班试抓 |

**验证**

```bash
curl http://127.0.0.1:8788/api/flights/
curl http://localhost:3000/trips/au-2026-09-30/
```

**踩坑**

- 只跑 `npm run dev`、没跑 `dev:api` → 航班列表等 API 失败
- 未 `npm run build` 就启 `dev:api` → wrangler 找不到 `out/`
- 8788/8789 占用：`lsof -ti :8788,:8789 | xargs kill`

**与生产环境的区别**

- **生产网站**：Cloudflare Pages 自动部署，`git push` 后构建，**不需要**本地 `npm run dev`
- **生产航班抓取**：Mac Mini launchd + `npm run macmini:schedule:dashboard`（本机 8791），见 [§1.7](#17-mac-mini-定时抓取生产写远端-d1) 与 [§3.0 A](#a-mac-mini手动抓取与-launchd-管理)

---

### 1.1 依赖安装

**根目录（日常必装）**

```bash
cd trip.jimmiewang.com
npm install
npm run scrape:install    # 航班试抓 / Mac Mini 同款 Playwright
```

**Worker 子目录（可选，仅改遗留 `workers/flight-scraper` 时）**

```bash
cd trip.jimmiewang.com/workers/flight-scraper
npm install
# 或根目录：npm run worker:scraper:install
```

说明：航班抓取走根目录 `scripts/`，**不依赖** Worker 子目录。`npm install` 只装本机依赖，不会在 Cloudflare 上创建 Worker。

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
- 启动方式：见 [1.0 本地快速启动](#10-本地快速启动)（`npm run dev:local` 或 `dev` + `dev:api`）

**试抓（仅本地，写本地 D1）**

```bash
npm run scrape:install    # 首次安装 Chromium
npm run scrape:local -- --watch-id fw-sha-bne-20260930
```

详情页「试抓一次」需 [1.0](#10-本地快速启动) 中 **dev:local**（或 `dev` + `dev:api`）在跑；仅开 `:8788` 静态站时现已通过 Functions 代理到 `:8789`。

若终端出现 `[scrape] failed: 东航页面未加载` → 东航反爬/网络问题，可改 CLI 试 headed：

```bash
npm run scrape:local -- --watch-id=fw-sha-cts-20260817 --headed
```

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

### 1.6 ~~flight-scraper Worker~~（已废弃，见附录 A）

> **2026-07 起**：本地开发与生产抓取均**不再使用** `trip-flight-scraper` Worker 与 Browser Run。  
> - 本地：§1.0 / §1.5（Playwright `:8789` 或 `scrape:local`）  
> - 生产：§1.7 / §3.0（Mac Mini `scrape:remote`）  
> - 遗留 Worker 文档：[附录 A](#附录-aflight-scraper-worker-已废弃仅代码保留)

---

### 1.7 Mac Mini 定时抓取（生产写远端 D1）

- 场景：常开 Mac Mini 上用 **本机 Playwright** 抓东航，直接写 **线上 D1**
- **当前唯一生产抓取路径**；`workers/flight-scraper` Worker Cron 与 Browser Run **均已停用**（代码保留，见 [附录 A](#附录-aflight-scraper-worker-已废弃仅代码保留)）
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
# 代码目录（Mac Mini 生产示例：~/trip.jimmiewang.com）
cd ~/trip.jimmiewang.com

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
- 查看任务状态：
  ```bash
  npm run macmini:schedule
  # 或 JSON：npm run macmini:schedule:json
  launchctl print gui/$(id -u)/com.jimmiewang.trip-flight-scrape
  ```
- **暂停 / 恢复**定时（不删 plist，随时可恢复）：
  ```bash
  npm run macmini:schedule:pause    # launchctl disable
  npm run macmini:schedule:resume   # launchctl enable（未加载时会自动 bootstrap）
  ```
- **本地管理面板**（仅 Mac Mini 本机 `127.0.0.1:8791`，可暂停/恢复/看日志）：
  ```bash
  npm run macmini:schedule:dashboard
  # 浏览器打开 http://127.0.0.1:8791/
  # 远程 SSH 端口转发：ssh -L 8791:127.0.0.1:8791 user@mac-mini
  ```
- 查看最近抓取日志：`npm run macmini:schedule:logs`
- 手动触发一次（不等定时）：
  ```bash
  npm run macmini:schedule:run
  # 或：~/trip.jimmiewang.com/scripts/macmini/run-scrape.sh
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
| `npm run macmini:schedule` | Mac Mini | 查看 launchd 定时任务状态 |
| `npm run macmini:schedule:pause` / `:resume` | Mac Mini | 暂停 / 恢复 launchd 定时 |
| `npm run macmini:schedule:dashboard` | Mac Mini | 本地 Web 管理面板（8791） |
| `npm run scrape:remote -- --all` | **远端 D1** | launchd 定时任务 |

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
| **Mac Mini launchd** | Mac Mini 本机 | **生产航班抓取**（§1.7）；写远端 D1 |
| **D1** `trip-jimmiewang-com` | `wrangler d1 execute --remote` | Pages 与 Mac Mini 抓取脚本共用 |
| ~~Worker~~ `trip-flight-scraper` | ~~`wrangler deploy`~~ | **已废弃**，不参与抓取；见 [附录 A](#附录-aflight-scraper-worker-已废弃仅代码保留) |

`git push` **不会** deploy Worker，也**不会**触发 Mac Mini 抓取（Mac Mini 须自行 `git pull`）。

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

### 2.5 ~~flight-scraper Worker 部署~~（已废弃）

> **不参与日常发布。** 航班抓取走 Mac Mini（§1.7）与本地 Playwright（§1.0）；若需维护遗留 Worker 代码，见 [附录 A](#附录-aflight-scraper-worker-已废弃仅代码保留)。

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

### 3.0 生产环境日常操作（速查）

生产环境分两块：**网站管「关注什么」**，**Mac Mini 管「什么时候抓、launchd 开不开」**。数据都在同一份远端 D1，两边无需重复配置。

| 要做的事 | 在哪操作 | 说明 |
|----------|----------|------|
| 新增 / 删除航班关注 | **trip.jimmiewang.com** | 写远端 D1 `flight_watches` |
| 看价格、抓取历史、定时执行结果 | **trip.jimmiewang.com** | `/flights/`、`/flights/schedule/` |
| 手动补抓、暂停/恢复 launchd、看 launchd 日志 | **Mac Mini** | 本地管理面板或 CLI |
| 改抓取脚本 | Mac Mini `git pull` | 一般 **不用** 重装 launchd |

---

#### A. Mac Mini：手动抓取与 launchd 管理

- 场景：不等 09:00 / 15:00 定时、临时暂停抓取、确认 launchd 是否在跑
- 前置条件：已完成 [§1.7](#17-mac-mini-定时抓取生产写远端-d1) 一次性部署；Mac 系统时区为 **亚洲/上海**；代码目录示例 **`~/trip.jimmiewang.com`**

**执行步骤**

1. SSH 登录 Mac Mini（或直接在 Mac Mini 本机操作）。
2. 进入仓库并拉最新代码（有脚本变更时）：
   ```bash
   cd ~/trip.jimmiewang.com
   git pull
   ```
3. **启动 launchd 管理面板**（保持终端不关）：
   ```bash
   npm run macmini:schedule:dashboard
   ```
4. 打开浏览器：
   - 本机：`http://127.0.0.1:8791/`
   - 远程 SSH 端口转发：
     ```bash
     ssh -L 8791:127.0.0.1:8791 wangjian@<mac-mini-host>
     # 本机浏览器同样打开 http://127.0.0.1:8791/
     ```

**面板常用操作**

| 按钮 / 功能 | 作用 |
|-------------|------|
| 查看状态 | launchd 是否加载、是否启用、下次 09:00 / 15:00 |
| **立即跑一次** | 执行 `run-scrape.sh` → `npm run scrape:remote -- --all`（抓全部 **enabled=1** 的关注） |
| **暂停定时** | `launchctl disable`，plist 保留，可随时恢复 |
| **恢复定时** | `launchctl enable`（未加载时自动 bootstrap） |
| 最近日志 | `~/Library/Logs/trip-flight-scrape/scrape-*.log` 尾部 |

**CLI 等价命令**（不启面板时）

```bash
cd ~/trip.jimmiewang.com
npm run macmini:schedule              # 查看状态
npm run macmini:schedule:pause        # 暂停定时
npm run macmini:schedule:resume       # 恢复定时
npm run macmini:schedule:run          # 立即跑一次（全部 enabled 关注）
npm run macmini:schedule:logs         # 最近日志
```

只抓 **单条** 关注（不等 `--all`）：

```bash
cd ~/trip.jimmiewang.com
env -u http_proxy -u https_proxy npm run scrape:remote -- --watch-id=<watch-id>
```

**验证方式**

- 网站 [定时任务页](https://trip.jimmiewang.com/flights/schedule/)：对应关注上午/下午场应出现新 run
- 或 API：`curl https://trip.jimmiewang.com/api/flights/<watch-id>/`
- Mac Mini 日志：`~/Library/Logs/trip-flight-scrape/scrape-*.log` 末尾应有 `done -> ...`

**与网站「定时任务」页的区别**

- **`/flights/schedule/`**（网站）：读 **D1** 里每条关注的抓取结果与计划状态，任意设备可访问
- **`:8791` 管理面板**（Mac Mini 本机）：管 **launchd 本身**（暂停/恢复/立即跑），仅本机或 SSH 转发可访问

**踩坑**

- 面板「立即跑一次」需数分钟，期间不要连点；以日志为准
- `run-scrape.sh` 会从脚本位置自动推断仓库路径；若 launchd 装于旧路径，可重跑 `install-launchd.sh` 或设 `TRIP_REPO`
- Mac Mini 须常开、勿深度睡眠，否则错过定时

---

#### B. trip.jimmiewang.com：增加新的航班关注

- 场景：新航线要纳入每天自动抓价
- 前置条件：生产 Pages 与远端 D1 已就绪（[§2.2](#22-部署-cloudflare-pages前端--functions)、[§2.3](#23-d1-表结构部署到远端)）

**执行步骤**

1. 打开 [Flight Tracking Board](https://trip.jimmiewang.com/flights/)。
2. 点击 **「添加关注」** → [添加页](https://trip.jimmiewang.com/flights/new/)。
3. 填写表单：
   - **必填**：出发城市、到达城市、出发日期（城市名会转成东航代码，如 上海 → SHA）
   - **可选**：标签、主看航班号（如 `MU715`）、仅直飞
4. 提交 → 自动跳转该关注的 **详情页**（URL 含 `watch-id`，如 `fw-sha-bne-20260930`）。

**新增之后会发生什么**

- 关注写入远端 D1，默认 **enabled=1**
- **Mac Mini 无需改配置**：launchd 定时任务跑 `scrape:remote -- --all` 时会自动包含新关注
- 首次价格：
  - **等定时**：下一个北京时间 **09:00** 或 **15:00**
  - **不等**：到 Mac Mini 管理面板点 **「立即跑一次」**，或 CLI：
    ```bash
    npm run scrape:remote -- --watch-id=<新 watch-id>
    ```

**查看与维护**

| 页面 | 地址 | 用途 |
|------|------|------|
| 关注列表 | `/flights/` | 所有关注、最近最低价 |
| 关注详情 | `/flights/detail/?id=<watch-id>` | 价格趋势、删除关注 |
| 定时任务 | `/flights/schedule/` | 各关注上午/下午场执行状态 |

**删除关注**：详情页 → **删除**（`flight_watches` 及关联价格历史一并删除；Mac Mini 下次 `--all` 不再抓该条）。

**踩坑**

- 生产环境 **没有**「试抓一次」按钮（`NEXT_PUBLIC_SCRAPE_ENABLED=false`）；补抓请用 Mac Mini
- 同航线同日期重复添加会提示「已存在」
- 网站只能看 D1 抓取结果，**不能**从网站暂停 Mac Mini 的 launchd → 须用 [§3.0 A](#a-mac-mini手动抓取与-launchd-管理)

---

### 3.1 ~~Worker / Browser Run 运维~~（已废弃，见附录 A）

> 生产补抓、定时抓取一律走 **Mac Mini**（[§3.0 A](#a-mac-mini手动抓取与-launchd-管理)）。  
> 遗留 Worker 触发、Browser Run 配额、本地 `wrangler dev` 等文档见 [附录 A](#附录-aflight-scraper-worker-已废弃仅代码保留)。

---

### 3.2 观察 Mac Mini 抓取日志

```bash
# Mac Mini 上
npm run macmini:schedule:logs
# 或
tail -f ~/Library/Logs/trip-flight-scrape/scrape-*.log
```

**查 D1 抓取结果**

```bash
npx wrangler d1 execute trip-jimmiewang-com --remote --command \
  "SELECT scrape_date, slot, status, min_price_cny FROM flight_scrape_runs ORDER BY scrape_date DESC LIMIT 5;"
```

网站 [定时任务页](https://trip.jimmiewang.com/flights/schedule/) 与 API `/api/flights/<id>/` 同源。

---

### 3.3 常见故障速查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| 本地航班列表加载失败 | 只跑了 `npm run dev` | 另开终端 `npm run dev:api` 或 `npm run dev:local` |
| 本地试抓失败 / 无法连接 scrape 服务 | 未启 `:8789` | 须 `dev:api` 或 `dev:local`；**不是** Worker |
| 本地试抓 ceair 页面加载失败 | 东航反爬 / 网络 | 看终端 `[scrape]` 日志；换网络或稍后重试 |
| 线上无价格 | Mac Mini launchd 未跑 / 暂停 | 查 [§1.7](#17-mac-mini-定时抓取生产写远端-d1) 与 `scrape-*.log` |
| 线上试抓按钮无效 | 生产无 scrape API | 正常；用 Mac Mini `scrape:remote` 或本地 dev |
| `no such table` 线上 | 未跑远端 D1 迁移 | [2.3](#23-d1-表结构部署到远端) |
| curl localhost 无反应 | `http_proxy` 劫持 localhost | `no_proxy` + `env -u http_proxy ...` |
| 东航页面在 CF IP 被拦 | 数据中心 IP（**仅遗留 Worker**） | 日常用 Mac Mini / 本地 Playwright；见 [附录 A](#附录-aflight-scraper-worker-已废弃仅代码保留) |

---

### 3.4 当前进度（2026-07-10）

- Pages + 远端 D1 + 航班 API：已上线
- **生产航班抓取**：**Mac Mini launchd** + `npm run scrape:remote`（§1.7）；日常操作见 [§3.0](#30-生产环境日常操作速查)
- **本地航班抓取**：`dev:local` / `dev:api` → `:8789` Playwright → **本地 D1**（**不用 Worker**）
- 网站 `/flights/schedule/`：查看 D1 抓取计划与结果；launchd 暂停/恢复见 Mac Mini `:8791` 面板
- `workers/flight-scraper`：**已废弃**，Cron 停、Browser Run 不用；代码保留于 [附录 A](#附录-aflight-scraper-worker-已废弃仅代码保留)

---

## 附录 A：flight-scraper Worker（已废弃，仅代码保留）

> **2026-07 起**：本地 dev 与生产均用 **`scripts/lib/ceair-scraper.mjs`（Playwright）**，不再走 `trip-flight-scraper` Worker 与 Cloudflare Browser Run。  
> 下列内容仅供维护遗留代码或排查历史问题时参考。

**生产 URL（仍部署，Cron 已空）**：`https://trip-flight-scraper.wangjian7.workers.dev`

### A.1 本地 Worker dev（一般不需要）

| 端口 | 用途 |
|------|------|
| 8787 | Worker `dev:remote` |
| 8790 | Worker `dev:scheduled`（模拟 Cron） |
| 8788 | 根目录 `dev:api` → Pages Functions |
| 8789 | 根目录 `dev:api` → **Playwright scrape（当前路径）** |

```bash
cd trip.jimmiewang.com/workers/flight-scraper
npm install
env -u http_proxy -u https_proxy npm run dev:remote    # :8787
# 或模拟 Cron：
env -u http_proxy -u https_proxy npm run dev:scheduled   # :8790
curl -m 180 http://127.0.0.1:8790/__scheduled
```

### A.2 Worker deploy

```bash
cd trip.jimmiewang.com/workers/flight-scraper
env -u http_proxy -u https_proxy npm run deploy
# wrangler.toml: crons = [] → 不注册定时
curl https://trip-flight-scraper.wangjian7.workers.dev/health
```

恢复 Cron（一般不需要）：`crons = ["0 1 * * *", "0 7 * * *"]` 后 deploy。

### A.3 Browser Run 配额（遗留 Worker 专用）

```bash
curl https://trip-flight-scraper.wangjian7.workers.dev/limits
```

Free 档约 **600s/天**；`/health`、`/limits` 不消耗配额。本地 `wrangler dev --remote` 与生产共用配额。

### A.4 手工 curl Worker（备用，不推荐）

```bash
curl "https://trip-flight-scraper.wangjian7.workers.dev/scrape?watchId=fw-sha-bne-20260930"
curl -m 180 "https://trip-flight-scraper.wangjian7.workers.dev/?url=https://www.ceair.com/..."
npm run worker:scraper:tail   # 根目录
```

**日常补抓请用**：Mac Mini `npm run scrape:remote -- --watch-id=...` 或本地 `npm run scrape:local`。
