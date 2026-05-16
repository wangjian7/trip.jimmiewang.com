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

