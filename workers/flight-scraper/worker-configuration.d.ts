declare global {
  interface Env {
    DB: D1Database;
    BROWSER: Fetcher;
  }
}

export {};
