import os from "node:os";
import path from "node:path";

export const LAUNCHD_LABEL = "com.jimmiewang.trip-flight-scrape";

export function guiDomain() {
  return `gui/${process.getuid?.() ?? os.userInfo().username}`;
}

export function launchdTarget() {
  return `${guiDomain()}/${LAUNCHD_LABEL}`;
}

export function plistPath() {
  return path.join(os.homedir(), "Library/LaunchAgents", `${LAUNCHD_LABEL}.plist`);
}

export function logDir() {
  return path.join(os.homedir(), "Library/Logs/trip-flight-scrape");
}

export function repoRoot() {
  return process.env.TRIP_REPO?.trim() || path.resolve(import.meta.dirname, "../..");
}

export function runScriptPath() {
  return path.join(repoRoot(), "scripts/macmini/run-scrape.sh");
}

export const SCHEDULE_SLOTS = [
  { slot: "am", localTime: "09:00", label: "上午场" },
  { slot: "pm", localTime: "15:00", label: "下午场" },
];
