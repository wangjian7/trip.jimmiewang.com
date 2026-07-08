type D1PreparedStatement = {
  bind: (...args: unknown[]) => D1PreparedStatement;
  first: <T = unknown>() => Promise<T | null>;
  all: <T = unknown>() => Promise<{ results: T[] }>;
  run: () => Promise<unknown>;
};

export type D1Database = {
  prepare: (query: string) => D1PreparedStatement;
};

export type PagesEnv = {
  DB: D1Database;
};

export type PagesFunctionContext = {
  env: PagesEnv;
  params: Record<string, string>;
  request: Request;
};

export type PagesFunction = (context: PagesFunctionContext) => Response | Promise<Response>;

export function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init,
  });
}
