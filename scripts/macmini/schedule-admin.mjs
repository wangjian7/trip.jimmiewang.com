#!/usr/bin/env node
/**
 * Mac Mini 本地 launchd 管理面板（仅监听 127.0.0.1）
 *
 *   npm run macmini:schedule:dashboard
 *   浏览器打开 http://127.0.0.1:8791/
 */
import http from "node:http";
import {
  getLaunchdScheduleStatus,
  pauseLaunchdSchedule,
  resumeLaunchdSchedule,
  runLaunchdJobOnce,
} from "./launchd-lib.mjs";

const PORT = Number(process.env.MACMINI_SCHEDULE_PORT || 8791);
const HOST = "127.0.0.1";

function htmlPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>航班抓取 · launchd 管理</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #f4f4f5;
      --card: #fff;
      --text: #18181b;
      --muted: #71717a;
      --border: #e4e4e7;
      --ok: #16a34a;
      --warn: #ca8a04;
      --bad: #dc2626;
      --btn: #2563eb;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #09090b;
        --card: #18181b;
        --text: #fafafa;
        --muted: #a1a1aa;
        --border: #3f3f46;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    .wrap { max-width: 720px; margin: 0 auto; padding: 24px 16px 48px; }
    h1 { font-size: 1.35rem; margin: 0 0 4px; }
    .sub { color: var(--muted); font-size: 0.9rem; margin-bottom: 20px; }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px 18px;
      margin-bottom: 16px;
    }
    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .badge.active { background: #dcfce7; color: var(--ok); }
    .badge.paused { background: #fef9c3; color: var(--warn); }
    .badge.unloaded, .badge.not_installed { background: #fee2e2; color: var(--bad); }
    @media (prefers-color-scheme: dark) {
      .badge.active { background: #14532d; color: #86efac; }
      .badge.paused { background: #713f12; color: #fde047; }
      .badge.unloaded, .badge.not_installed { background: #7f1d1d; color: #fca5a5; }
    }
    dl { display: grid; grid-template-columns: 120px 1fr; gap: 8px 12px; margin: 0; }
    dt { color: var(--muted); font-size: 0.9rem; }
    dd { margin: 0; font-size: 0.95rem; word-break: break-all; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px; }
    button {
      border: none;
      border-radius: 8px;
      padding: 10px 16px;
      font-size: 0.95rem;
      cursor: pointer;
      background: var(--btn);
      color: #fff;
    }
    button.secondary { background: transparent; color: var(--text); border: 1px solid var(--border); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    pre {
      background: #0a0a0a;
      color: #e4e4e7;
      padding: 12px;
      border-radius: 8px;
      overflow: auto;
      font-size: 0.78rem;
      max-height: 320px;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .msg { margin-top: 10px; font-size: 0.9rem; color: var(--muted); min-height: 1.2em; }
    .err { color: var(--bad); }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>航班抓取 · launchd</h1>
    <p class="sub">Mac Mini 本地管理 · 仅 127.0.0.1 · 与 trip 网站 D1 日程页互补</p>
    <div class="card" id="status-card">
      <p>加载中…</p>
    </div>
    <div class="card">
      <div class="actions">
        <button id="btn-pause" type="button">暂停定时</button>
        <button id="btn-resume" type="button">恢复定时</button>
        <button id="btn-refresh" type="button" class="secondary">刷新</button>
        <button id="btn-run" type="button" class="secondary">立即跑一次</button>
      </div>
      <p class="msg" id="msg"></p>
    </div>
    <div class="card">
      <h2 style="margin:0 0 10px;font-size:1rem;">最近日志</h2>
      <pre id="logs">—</pre>
    </div>
  </div>
  <script>
    const statusLabels = {
      active: "运行中",
      paused: "已暂停",
      unloaded: "未加载",
      not_installed: "未安装",
    };

    async function api(path, method = "GET") {
      const res = await fetch(path, { method });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      return data;
    }

    function renderStatus(s) {
      const badge = statusLabels[s.operationalStatus] || s.operationalStatus;
      document.getElementById("status-card").innerHTML = \`
        <p><span class="badge \${s.operationalStatus}">\${badge}</span></p>
        <dl style="margin-top:12px">
          <dt>标签</dt><dd>\${s.label}</dd>
          <dt>定时</dt><dd>\${s.schedule.map(x => x.localTime + " " + x.label).join("、")}（\${s.timezone}）</dd>
          <dt>下次执行</dt><dd>\${s.nextRun.scrapeDate} \${s.nextRun.localTime} \${s.nextRun.label}</dd>
          <dt>已加载</dt><dd>\${s.loaded ? "是" : "否"}</dd>
          <dt>已启用</dt><dd>\${s.enabled ? "是" : "否"}</dd>
          <dt>上次退出</dt><dd>\${s.launchd.lastStatus || "—"}</dd>
          <dt>plist</dt><dd>\${s.plistPath}</dd>
        </dl>
      \`;
      document.getElementById("logs").textContent = s.latestLogTail || "暂无日志";
      document.getElementById("btn-pause").disabled = !s.loaded || !s.enabled;
      document.getElementById("btn-resume").disabled = !s.installed || (s.loaded && s.enabled);
    }

    async function refresh() {
      const msg = document.getElementById("msg");
      msg.textContent = "";
      msg.className = "msg";
      try {
        const s = await api("/api/status");
        renderStatus(s);
      } catch (e) {
        msg.textContent = e.message;
        msg.className = "msg err";
      }
    }

    async function action(path, label) {
      const msg = document.getElementById("msg");
      msg.textContent = label + "…";
      msg.className = "msg";
      try {
        const s = await api(path, "POST");
        renderStatus(s);
        msg.textContent = "完成";
      } catch (e) {
        msg.textContent = e.message;
        msg.className = "msg err";
      }
    }

    document.getElementById("btn-pause").onclick = () => action("/api/pause", "暂停中");
    document.getElementById("btn-resume").onclick = () => action("/api/resume", "恢复中");
    document.getElementById("btn-refresh").onclick = refresh;
    document.getElementById("btn-run").onclick = async () => {
      const msg = document.getElementById("msg");
      msg.textContent = "抓取进行中（可能数分钟）…";
      try {
        await api("/api/run-once", "POST");
        msg.textContent = "手动抓取已完成，请刷新日志";
        await refresh();
      } catch (e) {
        msg.textContent = e.message;
        msg.className = "msg err";
      }
    };

    refresh();
    setInterval(refresh, 30000);
  </script>
</body>
</html>`;
}

function json(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${HOST}`);

  try {
    if (req.method === "GET" && url.pathname === "/") {
      const page = htmlPage();
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(page);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/status") {
      json(res, 200, await getLaunchdScheduleStatus());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/pause") {
      json(res, 200, await pauseLaunchdSchedule());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/resume") {
      json(res, 200, await resumeLaunchdSchedule());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/run-once") {
      const result = await runLaunchdJobOnce();
      json(res, 200, { ok: true, ...result });
      return;
    }

    json(res, 404, { error: "Not found" });
  } catch (err) {
    json(res, 500, { error: err.message || String(err) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`launchd 管理面板: http://${HOST}:${PORT}/`);
  console.log("仅本机可访问；远程请 SSH 端口转发");
});
