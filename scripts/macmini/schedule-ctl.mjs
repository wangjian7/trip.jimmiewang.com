#!/usr/bin/env node
/**
 * Mac Mini launchd 航班抓取定时任务管理 CLI
 *
 *   node scripts/macmini/schedule-ctl.mjs status
 *   node scripts/macmini/schedule-ctl.mjs pause
 *   node scripts/macmini/schedule-ctl.mjs resume
 *   node scripts/macmini/schedule-ctl.mjs logs [--lines=50]
 *   node scripts/macmini/schedule-ctl.mjs run-once
 */
import os from "node:os";
import path from "node:path";
import {
  getLaunchdScheduleStatus,
  pauseLaunchdSchedule,
  resumeLaunchdSchedule,
  runLaunchdJobOnce,
} from "./launchd-lib.mjs";

const [command = "status", ...rest] = process.argv.slice(2);

function statusLabel(status) {
  const map = {
    active: "运行中（已加载且已启用）",
    paused: "已暂停（已加载但未启用）",
    unloaded: "未加载（plist 存在但未 bootstrap）",
    not_installed: "未安装",
  };
  return map[status] ?? status;
}

function printHuman(status) {
  console.log("航班抓取 launchd 定时任务");
  console.log("─".repeat(48));
  console.log(`标签:     ${status.label}`);
  console.log(`状态:     ${statusLabel(status.operationalStatus)}`);
  console.log(`已安装:   ${status.installed ? "是" : "否"}`);
  console.log(`已加载:   ${status.loaded ? "是" : "否"}`);
  console.log(`已启用:   ${status.enabled ? "是" : "否"}`);
  console.log(`时区:     ${status.timezone}`);
  console.log(
    `定时:     ${status.schedule.map((s) => `${s.localTime} ${s.label}`).join("、")}`,
  );
  console.log(
    `下次执行: ${status.nextRun.scrapeDate} ${status.nextRun.localTime} (${status.nextRun.label})`,
  );
  if (status.launchd.pid) {
    console.log(`PID:      ${status.launchd.pid}`);
  }
  if (status.launchd.lastStatus && status.launchd.lastStatus !== "-") {
    console.log(`上次退出: ${status.launchd.lastStatus}`);
  }
  if (status.launchd.state) {
    console.log(`launchd:  ${status.launchd.state}`);
  }
  console.log(`plist:    ${status.plistPath}`);
  console.log(`脚本:     ${status.runScriptPath}`);
  console.log(`日志目录: ${path.join(os.homedir(), "Library/Logs/trip-flight-scrape")}`);

  if (status.logs.length) {
    console.log("\n最近日志:");
    for (const log of status.logs.slice(0, 3)) {
      console.log(`  ${log.name}  (${log.mtime})`);
    }
  }

  console.log("\n操作:");
  console.log("  暂停: npm run macmini:schedule:pause");
  console.log("  恢复: npm run macmini:schedule:resume");
  console.log("  面板: npm run macmini:schedule:dashboard");
}

async function main() {
  if (command === "status" || command === "json") {
    const status = await getLaunchdScheduleStatus();
    if (command === "json" || rest.includes("--json")) {
      console.log(JSON.stringify(status, null, 2));
    } else {
      printHuman(status);
    }
    return;
  }

  if (command === "pause") {
    const status = await pauseLaunchdSchedule();
    console.log("已暂停定时任务（launchctl disable）");
    printHuman(status);
    return;
  }

  if (command === "resume") {
    const status = await resumeLaunchdSchedule();
    console.log("已恢复定时任务（launchctl enable）");
    printHuman(status);
    return;
  }

  if (command === "logs") {
    const status = await getLaunchdScheduleStatus();
    const linesArg = rest.find((a) => a.startsWith("--lines="));
    const lines = linesArg ? Number(linesArg.split("=")[1]) : 80;
    const latest = status.logs[0];
    if (!latest) {
      console.log("暂无日志文件");
      return;
    }
    console.log(`# ${latest.name}\n`);
    const full = status.latestLogTail.split("\n");
    console.log(full.slice(-lines).join("\n"));
    return;
  }

  if (command === "run-once") {
    console.log("手动触发一次抓取（可能需数分钟）…");
    const { stdout, stderr } = await runLaunchdJobOnce();
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    return;
  }

  console.error(`未知命令: ${command}`);
  console.error("用法: status | pause | resume | logs | run-once | json");
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
