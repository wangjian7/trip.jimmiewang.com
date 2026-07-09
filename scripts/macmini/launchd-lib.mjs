import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import {
  guiDomain,
  LAUNCHD_LABEL,
  launchdTarget,
  logDir,
  plistPath,
  runScriptPath,
  SCHEDULE_SLOTS,
} from "./config.mjs";

const execFileAsync = promisify(execFile);

async function launchctl(args) {
  const { stdout, stderr } = await execFileAsync("launchctl", args, {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  return `${stdout}${stderr}`.trim();
}

function beijingNextRun(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((p) => [p.type, p.value]),
  );
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const nowMin = Number(parts.hour) * 60 + Number(parts.minute);
  if (nowMin < 9 * 60) {
    return { scrapeDate: today, slot: "am", localTime: "09:00", label: "上午场" };
  }
  if (nowMin < 15 * 60) {
    return { scrapeDate: today, slot: "pm", localTime: "15:00", label: "下午场" };
  }
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tParts = Object.fromEntries(
    formatter.formatToParts(tomorrow).map((p) => [p.type, p.value]),
  );
  return {
    scrapeDate: `${tParts.year}-${tParts.month}-${tParts.day}`,
    slot: "am",
    localTime: "09:00",
    label: "上午场",
  };
}

function parseLaunchctlPrint(text) {
  const lines = text.split("\n");
  const info = {
    state: "",
    runs: "",
    lastExitCode: "",
    path: "",
    disabled: false,
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("state =")) info.state = trimmed.split("=")[1]?.trim() ?? "";
    if (trimmed.startsWith("runs =")) info.runs = trimmed.split("=")[1]?.trim() ?? "";
    if (trimmed.startsWith("last exit code =")) {
      info.lastExitCode = trimmed.split("=")[1]?.trim() ?? "";
    }
    if (trimmed.startsWith("path =")) info.path = trimmed.split("=")[1]?.trim() ?? "";
    if (/disabled\s*=\s*true/i.test(trimmed)) info.disabled = true;
  }

  return info;
}

function listRow(stdout) {
  for (const line of stdout.split("\n")) {
    if (!line.includes(LAUNCHD_LABEL)) continue;
    const cols = line.trim().split(/\s+/);
    if (cols.length >= 3) {
      return { pid: cols[0], lastStatus: cols[1], label: cols[2] };
    }
  }
  return null;
}

function recentLogFiles(limit = 5) {
  const dir = logDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.startsWith("scrape-") && name.endsWith(".log"))
    .map((name) => ({ name, mtime: fs.statSync(path.join(dir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit)
    .map(({ name, mtime }) => ({ name, mtime: new Date(mtime).toISOString() }));
}

function tailLog(name, lines = 40) {
  const file = path.join(logDir(), name);
  if (!fs.existsSync(file)) return "";
  const content = fs.readFileSync(file, "utf8");
  return content.split("\n").slice(-lines).join("\n");
}

export async function getLaunchdScheduleStatus() {
  const target = launchdTarget();
  const plist = plistPath();
  const installed = fs.existsSync(plist);

  let loaded = false;
  let enabled = installed;
  let printText = "";
  let parsed = {
    state: "",
    runs: "",
    lastExitCode: "",
    path: "",
    disabled: false,
  };
  let row = null;

  if (installed) {
    try {
      printText = await launchctl(["print", target]);
      loaded = true;
      parsed = parseLaunchctlPrint(printText);
      enabled = !parsed.disabled;
    } catch {
      loaded = false;
      enabled = false;
    }

    try {
      const listOut = await launchctl(["list"]);
      row = listRow(listOut);
    } catch {
      row = null;
    }
  }

  const logs = recentLogFiles();
  const latestLog = logs[0]?.name ?? null;

  let operationalStatus = "not_installed";
  if (installed && loaded && enabled) operationalStatus = "active";
  else if (installed && loaded && !enabled) operationalStatus = "paused";
  else if (installed && !loaded) operationalStatus = "unloaded";

  return {
    label: LAUNCHD_LABEL,
    target,
    plistPath: plist,
    runScriptPath: runScriptPath(),
    installed,
    loaded,
    enabled,
    operationalStatus,
    schedule: SCHEDULE_SLOTS,
    timezone: "Asia/Shanghai",
    nextRun: beijingNextRun(),
    launchd: {
      pid: row?.pid ?? null,
      lastStatus: row?.lastStatus ?? (parsed.lastExitCode || null),
      state: parsed.state,
      runs: parsed.runs,
      path: parsed.path,
    },
    logs: logs.map((item) => ({
      ...item,
      tail: tailLog(item.name, 25),
    })),
    latestLogTail: latestLog ? tailLog(latestLog, 50) : "",
    printExcerpt: printText
      ? printText.split("\n").slice(0, 30).join("\n")
      : "",
  };
}

export async function pauseLaunchdSchedule() {
  const target = launchdTarget();
  if (!fs.existsSync(plistPath())) {
    throw new Error("launchd 任务未安装，请先运行 ./scripts/macmini/install-launchd.sh");
  }
  await launchctl(["disable", target]);
  return getLaunchdScheduleStatus();
}

export async function resumeLaunchdSchedule() {
  const target = launchdTarget();
  const plist = plistPath();
  if (!fs.existsSync(plist)) {
    throw new Error("launchd 任务未安装，请先运行 ./scripts/macmini/install-launchd.sh");
  }

  try {
    await launchctl(["print", target]);
  } catch {
    await launchctl(["bootstrap", guiDomain(), plist]);
  }

  await launchctl(["enable", target]);
  return getLaunchdScheduleStatus();
}

export async function runLaunchdJobOnce() {
  const script = runScriptPath();
  if (!fs.existsSync(script)) {
    throw new Error(`找不到脚本：${script}`);
  }
  const { stdout, stderr } = await execFileAsync("/bin/zsh", [script], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  return { stdout, stderr };
}
