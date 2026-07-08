# Operations

本文件用于记录需要人工判断的操作步骤、脚本调用方式与踩坑记录。

## 使用规则
- 记录所有不适合只靠代码表达的操作流程。
- 优先写清楚前置条件、执行步骤、验证方式、常见失败点。
- 同一类操作应持续补充到同一章节，避免散落。

## 维护模板

### 操作项名称
- 场景:
  - 待补充
- 前置条件:
  - 待补充
- 执行步骤:
  - 待补充
- 验证方式:
  - 待补充
- 踩坑记录:
  - 待补充

## 已记录操作

### trip.jimmiewang.com：持久化行程与照片（D1 + R2 + Worker）初始化与接入
- 场景:
  - 将 trip.jimmiewang.com 从纯静态（localStorage）升级为“统一链接可共享、可同步编辑”，并支持上传与共享照片。
- 前置条件:
  - 已有 Cloudflare 账号与对应域名/Pages 项目（前端仍为静态站点）。
  - 明确数据与权限边界（至少需要决定：是否引入共享写入令牌 writeKey）。
- 执行步骤:
  - 创建存储资源:
    - 在 Cloudflare 创建 D1 数据库（用于 Trip 与照片元数据）。
    - 在 Cloudflare 创建 R2 bucket（用于照片对象存储）。
  - 设计数据模型:
    - D1 表建议拆分为：trips、days、schedule_items、photos（或 trips 表存 JSON + photos 表存元数据）。
    - 定义“公开读取 / 受控写入”的访问策略（例如写入携带 writeKey）。
  - 创建后端 API:
    - 使用 Cloudflare Worker（或 Pages Functions）提供 API：
      - Trip 读取/保存（按 slug 获取与更新）。
      - 照片上传流程：生成直传凭证或服务端转存到 R2；写入 photos 元数据到 D1。
      - 基础保护：限流（按 IP/令牌）、请求体大小限制、CORS 策略。
  - 前端接入:
    - 将当前导入/导出 JSON 作为兜底备份通道保留。
    - 增加“云端同步”入口：从 API 拉取最新 Trip、保存 Trip、上传照片并刷新照片墙。
- 验证方式:
  - 新开一个无痕窗口（或另一台设备）打开同一个 Trip 链接，应能看到相同内容与照片。
  - 同时编辑同一条内容时，应有明确的冲突策略（最简可接受为“后写覆盖”并提示更新时间）。
  - 大图片上传应能被拒绝或压缩后通过；上传失败不应破坏整个 Trip 保存。
- 踩坑记录:
  - 图片与 base64 一起塞进 D1/KV 会迅速放大存储与传输体积；照片应存 R2，仅在 DB 记录元信息与对象 key。
  - “完全公开可写”极易被恶意篡改或刷流量，至少要加 writeKey + 限流 + 基础校验。 

### 本地联调：Pages Functions + D1（local）
- 场景:
  - 在本地联调 Cloudflare Pages Functions（/functions）与 D1 绑定的 API。
- 前置条件:
  - 已创建 D1 数据库，并在 `wrangler.toml` 配置 `[[d1_databases]]` 绑定名为 `DB`。
  - 已有 migrations（例如 `migrations/0001_init.sql`）。
- 执行步骤:
  - 安装依赖：
    - `npm install`
  - 初始化本地 D1 表结构：
    - `npm run d1:migrate:local`
  - 构建静态站点产物：
    - `npm run build`
  - 用 wrangler 启动本地 Pages（含 Functions）：
    - `npx wrangler pages dev ./out --local --port 8788`
- 验证方式:
  - `GET http://localhost:8788/api/trips/<slug>` 返回 404 或 plan JSON。
  - `PUT http://localhost:8788/api/trips/<slug>` 携带 `x-write-key` 后能写入并返回 ok。

### 部署到 Cloudflare Pages（生产环境：Static Export + Pages Functions + D1 + R2）
- 场景:
  - 部署 trip.jimmiewang.com 到 Cloudflare Pages，并启用 Functions（/functions）访问 D1 与 R2，实现云端同步与照片上传。
- 前置条件:
  - 代码已推送到 GitHub（或你使用的 Git 托管平台）。
  - Cloudflare Pages 已连接对应仓库，并能选择到本项目（trip.jimmiewang.com）。
  - 远端 D1 已创建，并在 `wrangler.toml` 配置 `[[d1_databases]]` 绑定名为 `DB`。
  - 远端 R2 bucket 已创建，并在 `wrangler.toml` 配置 `[[r2_buckets]]` 绑定名为 `BUCKET`，bucket 为 `trip-photos`。
  - 远端 D1 已执行迁移（建表）：
    - `npm run d1:migrate:remote`
- 执行步骤:
  - 在 Cloudflare Pages 新建项目:
    - 选择仓库与分支。
    - Root directory（项目路径）选择 `trip.jimmiewang.com`。
  - 构建配置:
    - Build command: `npm run build`
    - Build output directory: `out`
    - Framework preset: 可选 `Next.js (Static HTML Export)`（如有）
  - Functions 配置:
    - Pages 会自动识别仓库中的 `/functions` 目录并部署 Functions。
    - 在 Pages 项目的 Settings → Functions → Bindings 中添加 D1 binding（Production）：
      - 选择 Environment: `Production`（若界面提供 Preview/Production 切换）
      - Variable name: `DB`
      - D1 database: `trip-jimmiewang-com`
    - 在同一页面添加 R2 binding（Production）：
      - 选择 Environment: `Production`
      - Variable name: `BUCKET`
      - R2 bucket: `trip-photos`
    - 若同时需要预览环境联调，建议也配置 Preview 环境的同名 `DB` 绑定（指向同一个或独立的 D1）。
    - 若同时需要预览环境联调，建议也配置 Preview 环境的同名 `BUCKET` 绑定。
  - 域名绑定（可选）:
    - 在 Pages 项目中添加自定义域名 `trip.jimmiewang.com`，并按提示完成 DNS 记录配置。
- 验证方式:
  - 访问 `https://<你的域名>/trips/au-2026-09-30/` 页面正常展示。
  - 访问 `https://<你的域名>/api/trips/au-2026-09-30`：
    - 初次应返回 404（云端还没保存）。
  - 页面点“设置口令”→“云端保存”，再 GET 同一 API 应返回 plan JSON。
  - 页面点“上传”后，`POST /api/photos` 应返回 `ok: true`，并且 R2 bucket 中能看到以 `slug/dayId/...` 组织的对象 key。
- 踩坑记录:
  - 本地 `--local` 使用的是本地 D1；线上必须在 Pages 里配置 D1 binding，否则 API 会报 DB 未绑定或查询失败。
  - 本地 `wrangler pages dev` 默认也会使用本地 R2 持久化；本地上传成功并不代表 Cloudflare 控制台的真实 bucket 已出现文件。
  - 如果只在本地迁移了 D1（local），线上仍会出现 `no such table: trips`，需要执行 `npm run d1:migrate:remote`。
  - 若浏览器控制台看到 `api/trips/...` 返回 500 且页面显示 `error code: 1101`，通常是 Functions 运行时异常：
    - 优先检查 Pages 项目是否已在 Production 环境配置 D1 binding（变量名必须为 `DB`）。
    - 其次确认远端 D1 已执行迁移并存在 `trips` 表。
  - 若浏览器控制台看到 `POST /api/photos` 返回 `500 {"error":"bucket_not_bound"}`，说明生产环境缺少 R2 binding：
    - 打开 Pages 项目 Settings → Functions → Bindings。
    - 在 Production 环境新增 `BUCKET` → `trip-photos`。
    - 保存后重新触发部署，再次测试上传。

### 本地开发：航班关注看板（Flight Tracking Board）
- 场景:
  - 本地开发 `/flights/` 关注列表、添加关注、详情页；数据读写本地 D1。
  - 前端需要 Next.js 热更新，API 需要 Pages Functions + D1，两者分开启动。
- 前置条件:
  - 已在项目根目录 `trip.jimmiewang.com/` 执行过 `npm install`。
  - `wrangler.toml` 已配置 D1 binding `DB`。
  - 本地 D1 已执行基础迁移与航班表迁移：
    - `npm run d1:migrate:local`（trips 表）
    - `npm run d1:migrate:local:flights`（flight_watches / flight_scrape_runs / flight_quotes）
- 执行步骤:
  - **推荐：两个终端分别控制前后端**
    - 终端 1（前端）：
      ```bash
      cd trip.jimmiewang.com
      npm run dev
      ```
      - 访问 http://localhost:3000/
      - 航班看板入口：http://localhost:3000/flights/
    - 终端 2（D1 API + 本地抓取服务）：
      ```bash
      cd trip.jimmiewang.com
      npm run dev:api
      ```
      - D1 API 监听 http://127.0.0.1:8788
      - 本地 scrape 服务监听 http://127.0.0.1:8789（Playwright 试抓）
      - 开发模式下 Next.js 会把 `/api/*` 代理到 8788；`/api/flights/:id/scrape/` 代理到 8789
  - **首次试抓前安装 Playwright 浏览器**
    ```bash
    npm run scrape:install
    ```
  - **命令行试抓（不经过页面按钮）**
    ```bash
    npm run scrape:local -- --watch-id fw-sha-bne-20260930
    ```
    - 可选 `--headed` 打开有头浏览器便于调试。
  - **页面试抓**
    - 打开某条关注详情页，点击 **「试抓一次」**。
    - 抓取结果写入 `flight_scrape_runs` + `flight_quotes`，页面自动刷新价格。
  - **可选：一条命令同时启动**
    ```bash
    npm run dev:local
    ```
    - 等价于 concurrently 跑 `dev:api` + `dev`，适合不想开两个终端时使用。
  - **改代码后如何重启**
    - 只改 `src/` 前端：重启终端 1 即可（多数情况热更新自动生效）。
    - 只改 `functions/` 或 D1 迁移：重启终端 2。
    - 改了 `next.config.ts`：必须重启终端 1。
- 验证方式:
  - API 直连：
    ```bash
    curl http://127.0.0.1:8788/api/flights/
    ```
    - 应返回 JSON：`{"watches":[...]}`（空数组也正常）。
  - 经 Next 代理（前端实际走的路径）：
    ```bash
    curl http://localhost:3000/api/flights/
    ```
    - 同样应返回 200 与 JSON。
  - 浏览器打开 http://localhost:3000/flights/ ，应能看到关注列表或空状态，不应出现「暂时无法加载关注列表」。
  - 添加关注：http://localhost:3000/flights/new/ ，保存后跳转到详情页。
  - 试抓一次：
    ```bash
    curl -X POST http://localhost:3000/api/flights/fw-sha-bne-20260930/scrape/
    ```
    - 或在详情页点「试抓一次」。
- 踩坑记录:
  - **只跑 `npm run dev` 不够**：没有 D1 API，页面会报「暂时无法加载关注列表」。
  - **8788 端口被占用**：重复执行 `npm run dev:api` 会报 `Address already in use`。
    - 查占用：`lsof -i :8788`
    - 释放端口：`lsof -ti :8788 | xargs kill`
    - 再重新 `npm run dev:api`
  - **trailing slash**：站点配置了 `trailingSlash: true`，API 请求路径应使用 `/api/flights/`（带末尾斜杠），避免 308 重定向影响 POST/PATCH。
  - **本地 D1 数据位置**：`.wrangler/state/v3/d1/` 下 SQLite 文件；`npm run dev` 单独运行不会读写该库。
  - **首次使用航班表**：若 API 报 `no such table: flight_watches`，补跑 `npm run d1:migrate:local:flights`。
  - **试抓按钮无响应 / 报 scrape 服务未启动**：确认终端 2 的 `npm run dev:api` 在跑（内含 8789 scrape 服务）。
  - **Playwright 报错**：先执行 `npm run scrape:install` 安装 Chromium。
  - **同一天同半天重复试抓**：会跳过重复写入（`flight_scrape_runs` UNIQUE 约束）；需强制重抓时可手动删当天对应 run 记录。
  - 表结构与字段说明见 `docs/表结构设计.md`；架构决策见 `docs/decisions.md` 0003 / 0004。
