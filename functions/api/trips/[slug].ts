type D1PreparedStatement = {
  bind: (...args: unknown[]) => D1PreparedStatement;
  first: <T = unknown>() => Promise<T | null>;
  run: () => Promise<unknown>;
};

type D1Database = {
  prepare: (query: string) => D1PreparedStatement;
};

type Env = {
  DB: D1Database;
};

type PagesFunction<Env = unknown> = (context: {
  env: Env;
  params: Record<string, string>;
  request: Request;
}) => Response | Promise<Response>;

async function sha256Hex(text: string) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init,
  });
}

function getWriteKey(request: Request) {
  const header = request.headers.get("x-write-key");
  if (header?.trim()) return header.trim();
  const url = new URL(request.url);
  const qp = url.searchParams.get("writeKey");
  if (qp?.trim()) return qp.trim();
  return null;
}

async function parsePlanFromRequest(request: Request) {
  const body = (await request.json().catch(() => null)) as unknown;
  if (!body) return null;
  if (typeof body === "object" && body && "plan" in body) {
    const plan = (body as { plan?: unknown }).plan;
    if (typeof plan === "object" && plan) return plan as Record<string, unknown>;
  }
  if (typeof body === "object") return body as Record<string, unknown>;
  return null;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const slug = String(params.slug ?? "");
  if (!slug) return json({ error: "missing_slug" }, { status: 400 });

  if (!env?.DB) return json({ error: "db_not_bound" }, { status: 500 });

  try {
    const row = await env.DB.prepare(
      "SELECT plan_json, write_key_hash, updated_at FROM trips WHERE slug = ?1",
    )
      .bind(slug)
      .first<{
        plan_json: string;
        write_key_hash: string | null;
        updated_at: string;
      }>();

    if (!row) return json({ error: "not_found" }, { status: 404 });

    const plan = JSON.parse(row.plan_json) as Record<string, unknown>;
    if (row.write_key_hash) plan.writeKeyHash = row.write_key_hash;

    return json({ plan, updatedAt: row.updated_at }, { status: 200 });
  } catch {
    return json({ error: "db_query_failed" }, { status: 500 });
  }
};

export const onRequestPut: PagesFunction<Env> = async ({ env, params, request }) => {
  const slug = String(params.slug ?? "");
  if (!slug) return json({ error: "missing_slug" }, { status: 400 });

  if (!env?.DB) return json({ error: "db_not_bound" }, { status: 500 });

  const writeKey = getWriteKey(request);
  if (!writeKey) return json({ error: "missing_write_key" }, { status: 401 });

  const writeKeyHash = await sha256Hex(writeKey);
  const plan = await parsePlanFromRequest(request);
  if (!plan) return json({ error: "invalid_body" }, { status: 400 });
  if (typeof plan.slug !== "string" || plan.slug !== slug) {
    return json({ error: "slug_mismatch" }, { status: 400 });
  }

  const now = new Date().toISOString();

  try {
    const existing = await env.DB.prepare(
      "SELECT write_key_hash FROM trips WHERE slug = ?1",
    )
      .bind(slug)
      .first<{ write_key_hash: string | null }>();

    if (existing?.write_key_hash && existing.write_key_hash !== writeKeyHash) {
      return json({ error: "invalid_write_key" }, { status: 403 });
    }

    plan.writeKeyHash = writeKeyHash;

    if (existing) {
      await env.DB.prepare(
        "UPDATE trips SET write_key_hash = ?1, plan_json = ?2, updated_at = ?3 WHERE slug = ?4",
      )
        .bind(writeKeyHash, JSON.stringify(plan), now, slug)
        .run();
    } else {
      await env.DB.prepare(
        "INSERT INTO trips (slug, write_key_hash, plan_json, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
      )
        .bind(slug, writeKeyHash, JSON.stringify(plan), now, now)
        .run();
    }
  } catch {
    return json({ error: "db_query_failed" }, { status: 500 });
  }

  return json({ ok: true, updatedAt: now }, { status: 200 });
};
