# trip.jimmiewang.com

一个用于和同伴共享旅游行程的静态站点（Next.js 静态导出 + Cloudflare Pages）。

## 本地开发

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 数据与编辑说明

- 行程默认数据在 `src/lib/trips.ts`
- 行程页支持浏览器端编辑，并保存到 `localStorage`
- 支持 writeKey（共享编辑口令）：设置后默认只读，输入口令后才能编辑，用于避免链接被随意篡改
- 支持上传照片（会压缩后保存到本地；照片越多导出的 JSON 也会越大）
- 支持云端同步（文本/结构化数据）：使用 Cloudflare Pages Functions + D1，通过“云端拉取 / 云端保存”按钮进行同步
- 想把同一份行程同步给其他人：在行程页使用“导出 JSON / 导入 JSON / 复制到剪贴板”

## Cloudflare Pages 部署（静态）

本项目已启用 Next.js 静态导出（`next.config.ts` 中 `output: "export"`）。

在 Cloudflare Pages 中配置：

- **Build command**: `npm run build`
- **Build output directory**: `out`

如果后续要实现“大家实时共同编辑并自动同步”，需要引入 Cloudflare 的持久化能力（例如 D1/KV + Worker），静态导出模式将不再满足。
