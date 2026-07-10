import { json, type PagesFunction } from "../../../lib/http";

/** 本地 dev:api 时 scrape-server.mjs 固定监听此地址（Workers 无 process.env） */
const SCRAPE_SERVER = "http://127.0.0.1:8789";

function isLocalHost(request: Request) {
  const host = request.headers.get("host") ?? "";
  return (
    host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1:") ||
    host.endsWith(".localhost")
  );
}

export const onRequestPost: PagesFunction = async ({ params, request }) => {
  const id = String(params.id ?? "").trim();
  if (!id) return json({ error: "missing_id" }, { status: 400 });

  if (!isLocalHost(request)) {
    return json(
      {
        error: "scrape_not_available",
        message: "生产环境不支持网页试抓，请用 Mac Mini 执行 npm run scrape:remote。",
      },
      { status: 404 },
    );
  }

  const target = `${SCRAPE_SERVER}/scrape/${encodeURIComponent(id)}`;

  try {
    const upstream = await fetch(target, { method: "POST" });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch {
    return json(
      {
        error: "scrape_unreachable",
        message:
          "无法连接 scrape 服务（8789）。请运行 npm run dev:api 或 npm run dev:local，并查看终端 [scrape] 日志。",
      },
      { status: 502 },
    );
  }
};
