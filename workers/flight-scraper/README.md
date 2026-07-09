# trip-flight-scraper

Cron Worker：Browser Rendering 抓取东航官网 → 写入 D1。

## 前置（Dashboard 一次性）

在 Cloudflare Dashboard 开通 **Browser Rendering**（Workers & Pages → Browser Rendering → Enable）。  
其余开发/部署均用 wrangler，无需在网站重复配置 D1 binding 或 Cron。

## 安装

```bash
cd workers/flight-scraper
npm install
```

## Phase 1：验证东航页面（CF IP 是否可用）

```bash
npm run dev
# 浏览器打开 http://127.0.0.1:8787/
# 或 curl http://127.0.0.1:8787/
```

期望 JSON：`{ "ok": true, "flightsFound": >0, "hasPrice": true }`

部署后：

```bash
npm run deploy
curl https://trip-flight-scraper.<你的子域>.workers.dev/
```

## 手动触发 Cron（本地）

```bash
npm run dev:scheduled
# 访问 http://127.0.0.1:8787/__scheduled?cron=0+1+*+*+*
```

## 日志

```bash
npm run tail
```
