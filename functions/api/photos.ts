type D1PreparedStatement = {
  bind: (...args: unknown[]) => D1PreparedStatement;
  first: <T = unknown>() => Promise<T | null>;
};

type D1Database = {
  prepare: (query: string) => D1PreparedStatement;
};

type R2ObjectBody = {
  body: ReadableStream | null;
  httpMetadata?: {
    contentType?: string;
    contentDisposition?: string;
    cacheControl?: string;
  };
  size: number;
  etag: string;
  uploaded: Date;
};

type R2PutOptions = {
  httpMetadata?: {
    contentType?: string;
    contentDisposition?: string;
    cacheControl?: string;
  };
};

type R2Bucket = {
  get: (key: string) => Promise<R2ObjectBody | null>;
  put: (key: string, value: ArrayBuffer, options?: R2PutOptions) => Promise<void>;
  delete: (key: string) => Promise<void>;
};

type Env = {
  DB: D1Database;
  BUCKET: R2Bucket;
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

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "unknown";
}

async function validateWriteKey(env: Env, slug: string, writeKey: string) {
  const existing = await env.DB.prepare(
    "SELECT write_key_hash FROM trips WHERE slug = ?1",
  )
    .bind(slug)
    .first<{ write_key_hash: string | null }>();

  if (!existing) return { ok: false as const, error: "trip_not_initialized" };
  if (!existing.write_key_hash) return { ok: false as const, error: "trip_missing_write_key" };

  const writeKeyHash = await sha256Hex(writeKey);
  if (existing.write_key_hash !== writeKeyHash) {
    return { ok: false as const, error: "invalid_write_key" };
  }

  return { ok: true as const };
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const key = url.searchParams.get("key")?.trim();
  if (!key) return json({ error: "missing_key" }, { status: 400 });
  if (!env?.BUCKET) return json({ error: "bucket_not_bound" }, { status: 500 });

  const object = await env.BUCKET.get(key);
  if (!object?.body) return json({ error: "not_found" }, { status: 404 });

  return new Response(object.body, {
    status: 200,
    headers: {
      "content-type": object.httpMetadata?.contentType || "application/octet-stream",
      "cache-control": object.httpMetadata?.cacheControl || "public, max-age=31536000, immutable",
      etag: object.etag,
      "content-disposition": object.httpMetadata?.contentDisposition || "inline",
    },
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  if (!env?.DB) return json({ error: "db_not_bound" }, { status: 500 });
  if (!env?.BUCKET) return json({ error: "bucket_not_bound" }, { status: 500 });

  const writeKey = getWriteKey(request);
  if (!writeKey) return json({ error: "missing_write_key" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  if (!form) return json({ error: "invalid_form_data" }, { status: 400 });

  const slug = String(form.get("slug") ?? "").trim();
  const dayId = String(form.get("dayId") ?? "").trim();
  const file = form.get("file");

  if (!slug) return json({ error: "missing_slug" }, { status: 400 });
  if (!dayId) return json({ error: "missing_day_id" }, { status: 400 });
  if (!(file instanceof File)) return json({ error: "missing_file" }, { status: 400 });

  const validation = await validateWriteKey(env, slug, writeKey);
  if (!validation.ok) {
    const status =
      validation.error === "trip_not_initialized"
        ? 409
        : validation.error === "invalid_write_key"
          ? 403
          : 400;
    return json({ error: validation.error }, { status });
  }

  const ext = file.type === "image/png" ? "png" : "jpg";
  const contentType = file.type?.trim() || (ext === "png" ? "image/png" : "image/jpeg");
  const key = [
    sanitizeSegment(slug),
    sanitizeSegment(dayId),
    `${Date.now()}-${crypto.randomUUID()}.${ext}`,
  ].join("/");

  await env.BUCKET.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType,
      contentDisposition: "inline",
      cacheControl: "public, max-age=31536000, immutable",
    },
  });

  return json(
    {
      ok: true,
      key,
      url: `/api/photos?key=${encodeURIComponent(key)}`,
    },
    { status: 200 },
  );
};

export const onRequestDelete: PagesFunction<Env> = async ({ env, request }) => {
  if (!env?.DB) return json({ error: "db_not_bound" }, { status: 500 });
  if (!env?.BUCKET) return json({ error: "bucket_not_bound" }, { status: 500 });

  const writeKey = getWriteKey(request);
  if (!writeKey) return json({ error: "missing_write_key" }, { status: 401 });

  const url = new URL(request.url);
  const slug = url.searchParams.get("slug")?.trim() || "";
  const key = url.searchParams.get("key")?.trim() || "";
  if (!slug) return json({ error: "missing_slug" }, { status: 400 });
  if (!key) return json({ error: "missing_key" }, { status: 400 });

  const validation = await validateWriteKey(env, slug, writeKey);
  if (!validation.ok) {
    const status =
      validation.error === "trip_not_initialized"
        ? 409
        : validation.error === "invalid_write_key"
          ? 403
          : 400;
    return json({ error: validation.error }, { status });
  }

  await env.BUCKET.delete(key);
  return json({ ok: true }, { status: 200 });
};
