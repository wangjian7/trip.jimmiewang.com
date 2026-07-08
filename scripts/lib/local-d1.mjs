import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const WRANGLER_D1_DIR = path.join(
  process.cwd(),
  ".wrangler/state/v3/d1/miniflare-D1DatabaseObject",
);

export function findLocalD1SqlitePath() {
  if (!fs.existsSync(WRANGLER_D1_DIR)) {
    throw new Error(
      `本地 D1 目录不存在：${WRANGLER_D1_DIR}。请先运行 npm run d1:migrate:local:flights`,
    );
  }

  const files = fs
    .readdirSync(WRANGLER_D1_DIR)
    .filter((name) => name.endsWith(".sqlite"));

  if (files.length === 0) {
    throw new Error("未找到本地 D1 sqlite 文件，请先运行 npm run dev:api 或迁移。");
  }

  if (files.length > 1) {
    files.sort((a, b) => {
      const aStat = fs.statSync(path.join(WRANGLER_D1_DIR, a));
      const bStat = fs.statSync(path.join(WRANGLER_D1_DIR, b));
      return bStat.mtimeMs - aStat.mtimeMs;
    });
  }

  return path.join(WRANGLER_D1_DIR, files[0]);
}

export function openLocalD1() {
  const dbPath = findLocalD1SqlitePath();
  const db = new DatabaseSync(dbPath);
  return { db, dbPath };
}

export function dbGet(db, sql, params = []) {
  return db.prepare(sql).get(...params) ?? null;
}

export function dbAll(db, sql, params = []) {
  return db.prepare(sql).all(...params);
}

export function dbRun(db, sql, params = []) {
  const result = db.prepare(sql).run(...params);
  return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
}
