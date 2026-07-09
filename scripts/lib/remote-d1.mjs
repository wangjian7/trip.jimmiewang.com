import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const REMOTE_DB = "trip-jimmiewang-com";

function cleanEnv(env = process.env) {
  return {
    ...env,
    http_proxy: undefined,
    https_proxy: undefined,
    HTTP_PROXY: undefined,
    HTTPS_PROXY: undefined,
    ALL_PROXY: undefined,
  };
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function bindSql(sql, params = []) {
  let index = 0;
  return sql.replace(/\?/g, () => sqlLiteral(params[index++]));
}

async function execRemote(sql) {
  const command = sql.trim().replace(/\s+/g, " ");
  const { stdout } = await execFileAsync(
    "npx",
    ["wrangler", "d1", "execute", REMOTE_DB, "--remote", "--json", `--command=${command}`],
    {
      cwd: PROJECT_ROOT,
      env: cleanEnv(),
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  const parsed = JSON.parse(stdout);
  const batch = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!batch?.success) {
    throw new Error(`D1 remote execute failed: ${stdout}`);
  }
  return batch;
}

export function createRemoteD1() {
  return { kind: "remote" };
}

export async function dbGet(_db, sql, params = []) {
  const batch = await execRemote(bindSql(sql, params));
  return batch.results?.[0] ?? null;
}

export async function dbAll(_db, sql, params = []) {
  const batch = await execRemote(bindSql(sql, params));
  return batch.results ?? [];
}

export async function dbRun(_db, sql, params = []) {
  const batch = await execRemote(bindSql(sql, params));
  return {
    changes: batch.meta?.changes ?? 0,
    lastInsertRowid: batch.meta?.last_row_id ?? 0,
  };
}
