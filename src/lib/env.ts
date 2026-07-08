export const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? "production";

export const isDev = appEnv === "development";

export const isProduction = appEnv === "production";

/** 本地 Playwright scrape 服务（8789）；生产由 Cron Worker 负责。 */
export const scrapeEnabled = process.env.NEXT_PUBLIC_SCRAPE_ENABLED === "true";
