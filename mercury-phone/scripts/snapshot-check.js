"use strict";
/**
 * snapshot-check.js — 正式 App 截图 & 结构验收工具
 *
 * 用法:
 *   npm run snap <page>
 *
 * 示例:
 *   npm run snap me
 *   npm run snap moments
 *
 * 流程:
 *   1. 自动启动/连接 Chrome headless (port 9222)
 *   2. 解锁 → 打开 app → 导航到目标页面
 *   3. 截图 + DOM 数据收集
 *   4. 生成 overlay + notes.md
 *
 * 新增页面: 在 NAVIGATION 中添加条目即可
 *   appId: 注册到 app engine 的应用 ID
 *   toolbarRoute: (可选) 底部 tab 名，工具会自动点击
 *   actions: 导航步骤 [{js, wait}, ...]
 *   checks: { "显示名": "JS表达式" }
 */

const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFileSync, spawn } = require("child_process");

const DEV_SERVER = "http://127.0.0.1:5500";
const CDP_PORT = 9222;
const WINDOW_SIZE = { w: 430, h: 906 };
const PROTOTYPE_DIR = path.resolve(__dirname, "..", "design-prototypes", "social-shell");

// ── 导航方案 ──────────────────────────────────────────
// 新增页面 = 在此添加一个条目
const NAVIGATION = {
  "generation-profile-detail": {
    url: `${DEV_SERVER}/`,
    actions: [
      { wait: 1500 },
      { js: `document.querySelector('.screen').dataset.systemState = 'home'`, wait: 500 },
      { js: `window.MercuryRuntime.appEngine.launch('archive', { route: 'presets' })`, wait: 1200 },
      { js: `document.querySelector('[aria-label="查看生成档案 默认预设"]')?.click()`, wait: 900 },
    ],
    checks: {
      "Detail rendered": "!!document.querySelector('.archive-generation-profile-detail')",
      "Hero": "!!document.querySelector('.generation-profile-detail-hero')",
      "Square sleeve": "document.querySelector('.generation-profile-detail-hero__sleeve')?.offsetWidth + '×' + document.querySelector('.generation-profile-detail-hero__sleeve')?.offsetHeight",
      "Independent disc": "!!document.querySelector('.generation-profile-detail-hero__disc')",
      "Runtime stats": "document.querySelectorAll('.generation-profile-detail-stat').length",
      "Track rows": "document.querySelectorAll('.generation-profile-detail-track').length",
      "Editor fields": "document.querySelectorAll('.archive-generation-profile-detail input, .archive-generation-profile-detail textarea, .archive-generation-profile-detail select').length",
      "Playback controls": "document.querySelectorAll('.generation-profile-playback').length",
      "Page scroll height": "document.querySelector('.archive-generation-profile-detail')?.scrollHeight",
      "Page client height": "document.querySelector('.archive-generation-profile-detail')?.clientHeight",
    },
    extraCaptures: [
      {
        fileName: "bottom.png",
        js: `(function(){const page=document.querySelector('.archive-generation-profile-detail');if(!page)return false;page.scrollTop=page.scrollHeight;return true})()`,
        wait: 500,
      },
    ],
    captureSelector: ".device",
  },
  moments: {
    url: "http://127.0.0.1:4174/moments.html",
    captureSelector: ".moments-screen",
    notesFile: "snapshot-notes.md",
    actions: [{ wait: 1200 }],
    checks: {
      "Page rendered": "!!document.querySelector('.moments-screen')",
      "Canvas": "document.querySelector('.moments-screen')?.offsetWidth + '×' + document.querySelector('.moments-screen')?.offsetHeight",
      "Title": "document.querySelector('.moments-toolbar h1')?.textContent",
      "Camera action": "document.querySelector('.moments-camera')?.getAttribute('aria-label')",
      "Profile": "document.querySelector('.moments-profile__copy h2')?.textContent",
      "Cards": "document.querySelectorAll('.moment-card').length",
      "Comment groups": "document.querySelectorAll('.moment-card__comments').length",
      "Real-person images": "document.querySelectorAll('img[src*=\"http\"], img[src*=\"data:\"]').length",
    },
  },
  presets: {
    url: `${DEV_SERVER}/`,
    actions: [
      { wait: 1500 },
      { js: `document.querySelector('.screen').dataset.systemState = 'home'`, wait: 600 },
      { js: `window.MercuryRuntime.appEngine.launch('mercury-chat')`, wait: 2000 },
      // 打开第一个联系人对话
      { js: `(function(){const b=document.querySelector('.mercury-chat-thread');return b?(b.click(),'clicked'):'no-thread:'+document.querySelectorAll('.mercury-chat-app').length})()`, wait: 1200 },
      // 打开对话设置（头部更多）
      { js: `(function(){const b=document.querySelector('.mercury-chat-header__more');return b?(b.click(),'clicked'):'no-more'})()`, wait: 1000 },
      // 玩法预设入口 → 预设列表
      { js: `(function(){const rows=[...document.querySelectorAll('.mercury-chat-settings-row')];const row=rows.find(r=>r.children[0]?.textContent==='玩法预设');return row?(row.click(),'clicked'):'no-row:'+rows.length})()`, wait: 1000 },
      // 新建玩法预设 → 编辑器
      { js: `(function(){const b=document.querySelector('.mercury-chat-preset-new');return b?(b.click(),'clicked'):'no-new'})()`, wait: 1000 },
    ],
    checks: {
      "list route": "!!document.querySelector('.mercury-chat-preset-picks') || !!document.querySelector('.mercury-chat-preset-editor')",
      "editor": "!!document.querySelector('.mercury-chat-preset-editor')",
      "卡片数": "document.querySelectorAll('.mercury-chat-preset-card').length",
      "必开 pill": "[...document.querySelectorAll('.mercury-chat-preset-required')].length",
      "关系起点卡": "!![...document.querySelectorAll('.mercury-chat-preset-card__title')].find(t=>t.textContent==='关系起点')",
      "预览": "(function(){var p=document.querySelector('.mercury-chat-preset-preview');return p?p.textContent.slice(0,40):'—'})()",
    },
    captureSelector: ".device",
  },
  me: {
    appId: "mercury-chat",
    toolbarRoute: "me",
    actions: [
      { wait: 2000 },
      { js: `document.querySelector('.screen').dataset.systemState = 'home'`, wait: 500 },
      { js: `window.MercuryRuntime.appEngine.launch('mercury-chat')`, wait: 2000 },
    ],
    checks: {
      "页面渲染": "!!document.querySelector('.mercury-chat-me')",
      "Hero 高度": "document.querySelector('.mercury-chat-me__hero')?.offsetHeight",
      "头像": "document.querySelector('.mercury-chat-me__avatar')?.offsetWidth + '×' + document.querySelector('.mercury-chat-me__avatar')?.offsetHeight",
      "名称": "document.querySelector('.mercury-chat-me__identity h2')?.textContent",
      "状态": "document.querySelector('.mercury-chat-me__identity p')?.textContent",
      "在线": "document.querySelector('.mercury-chat-me__presence')?.textContent?.trim()",
      "Features 数": "document.querySelectorAll('.mercury-chat-me__feature').length",
      "第 1 项": "document.querySelectorAll('.mercury-chat-me__feature strong')[0]?.textContent",
      "副标题": "document.querySelectorAll('.mercury-chat-me__feature small')[0]?.textContent",
      "第 2 项": "document.querySelectorAll('.mercury-chat-me__feature strong')[1]?.textContent",
      "overflowY": "window.getComputedStyle(document.querySelector('.mercury-chat-me__content')).overflowY",
      "scrollH": "document.querySelector('.mercury-chat-me__content')?.scrollHeight",
      "clientH": "document.querySelector('.mercury-chat-me__content')?.clientHeight",
      "当前 tab": "(function(){var e=document.querySelector('.mercury-chat-primary-nav__item[aria-current=\"page\"]');return e?e.getAttribute('data-tab'):null})()",
    },
  },
};

// ── CDP 工具 ──────────────────────────────────────────
let msgId = 0;

function cdp(ws, method, params) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    ws.send(JSON.stringify({ id, method, params: params || {} }));
    const handler = (raw) => {
      try {
        const r = JSON.parse(raw.toString());
        if (r.id === id) { ws.removeListener("message", handler); if (r.error) reject(new Error(r.error.message)); else resolve(r); }
      } catch (_) {}
    };
    ws.on("message", handler);
    setTimeout(() => { ws.removeListener("message", handler); reject(new Error(`Timeout: ${method}`)); }, 30000);
  });
}

function cdpeval(ws, expr) {
  return cdp(ws, "Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })
    .then(r => r.result?.result?.value);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Chrome 管理 ───────────────────────────────────────
function findTab() {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${CDP_PORT}/json`, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        const tab = JSON.parse(data).find(t => t.url?.includes("5500"))
          || JSON.parse(data).find(t => t.url?.startsWith("http") && !t.url?.includes("extensions"));
        if (tab) resolve(tab); else reject(new Error("No tab found"));
      });
    }).on("error", reject);
  });
}

function startSnapshotChrome(startUrl = DEV_SERVER) {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const profilePath = path.join(PROTOTYPE_DIR, ".snapshot-chrome-profile");
  const child = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    `--remote-debugging-port=${CDP_PORT}`,
    `--window-size=${WINDOW_SIZE.w},${WINDOW_SIZE.h}`,
    `--user-data-dir=${profilePath}`,
    startUrl,
  ], { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
  console.log("Chrome started");
}

function urlIsReachable(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(Boolean(response.statusCode && response.statusCode < 500));
    });
    request.on("error", () => resolve(false));
    request.setTimeout(1500, () => { request.destroy(); resolve(false); });
  });
}

async function ensurePrototypeServer(url) {
  if (!url || !url.includes("127.0.0.1:4174") || await urlIsReachable(url)) return;
  const child = spawn(process.execPath, ["serve.cjs"], {
    cwd: PROTOTYPE_DIR,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await sleep(250);
    if (await urlIsReachable(url)) return;
  }
  throw new Error(`Prototype server did not start: ${url}`);
}

// ── 主流程 ────────────────────────────────────────────
async function main() {
  const pageName = process.argv[2];
  if (!pageName || !NAVIGATION[pageName]) {
    console.log(`Usage: npm run snap <page>`);
    console.log(`Pages: ${Object.keys(NAVIGATION).join(", ")}`);
    process.exit(1);
  }

  const nav = NAVIGATION[pageName];
  const pageDir = path.join(PROTOTYPE_DIR, pageName);
  const capturePath = path.join(pageDir, "formal-capture.png");
  const currentPath = path.join(pageDir, "current.png");
  const notesPath = path.join(pageDir, nav.notesFile || "notes.md");

  if (!fs.existsSync(pageDir)) fs.mkdirSync(pageDir, { recursive: true });

  console.log(`\n╔═══════════════════════════════════════╗`);
  console.log(`║  Snapshot Check: ${pageName.padEnd(24)}║`);
  console.log(`╚═══════════════════════════════════════╝\n`);

  // Connect Chrome
  console.log("→ Chrome…");
  await ensurePrototypeServer(nav.url);
  try {
    await findTab();
  } catch (_) {
    startSnapshotChrome(nav.url || `${DEV_SERVER}/`);
    await sleep(3000);
  }

  let tab;
  for (let r = 0; r < 10; r++) { try { tab = await findTab(); break; } catch (_) {} await sleep(1000); }
  if (!tab) { console.error("Can't connect Chrome"); process.exit(1); }

  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(r => ws.on("open", r));
  await cdp(ws, "Page.enable");
  await cdp(ws, "Runtime.enable");
  await cdp(ws, "DOM.enable");
  console.log("  Connected\n");

  // Navigate
  console.log("→ Navigate…");
  if (nav.url) {
    await cdp(ws, "Page.navigate", { url: nav.url });
    await sleep(900);
  }
  for (const step of nav.actions) {
    if (step.js) await cdpeval(ws, step.js);
    if (step.wait) await sleep(step.wait);
  }
  if (nav.toolbarRoute) {
    const ok = await cdpeval(ws, `document.querySelector('[data-tab="${nav.toolbarRoute}"]')?.click()`);
    await sleep(1200);
    console.log(`  Tab [${nav.toolbarRoute}] clicked`);
  }
  console.log("  Done\n");

  // Checks
  console.log("→ Checks…");
  const results = {};
  for (const [label, expr] of Object.entries(nav.checks)) {
    try {
      const raw = await cdpeval(ws, expr);
      results[label] = raw === null || raw === undefined ? "—" : String(raw);
    } catch (e) {
      results[label] = `ERROR: ${e.message}`;
    }
  }

  console.log("  " + "─".repeat(68));
  console.log(`  │ ${"Check".padEnd(22)} │ ${"Value".padEnd(40)} │`);
  console.log("  " + "─".repeat(68));
  for (const [label, value] of Object.entries(results)) {
    console.log(`  │ ${label.padEnd(22)} │ ${String(value).substring(0, 40).padEnd(40)} │`);
  }
  console.log("  " + "─".repeat(68) + "\n");

  // Screenshot
  console.log("→ Screenshot…");
  let screenshotParams = { format: "png", fromSurface: true };
  if (nav.captureSelector) {
    const clip = await cdpeval(ws, `(function(){
      const node = document.querySelector(${JSON.stringify(nav.captureSelector)});
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return { x: rect.x + window.scrollX, y: rect.y + window.scrollY, width: rect.width, height: rect.height, scale: 1 };
    })()`);
    if (!clip) throw new Error(`Capture selector not found: ${nav.captureSelector}`);
    screenshotParams = { ...screenshotParams, clip, captureBeyondViewport: true };
  }
  const shot = await cdp(ws, "Page.captureScreenshot", screenshotParams);
  if (shot.result?.data) {
    const buf = Buffer.from(shot.result.data, "base64");
    fs.writeFileSync(capturePath, buf);
    fs.writeFileSync(currentPath, buf);
    console.log(`  ${path.relative(process.cwd(), capturePath)} (${buf.length} bytes)`);
  }

  for (const extra of nav.extraCaptures || []) {
    if (extra.js) await cdpeval(ws, extra.js);
    if (extra.wait) await sleep(extra.wait);
    const extraShot = await cdp(ws, "Page.captureScreenshot", screenshotParams);
    if (!extraShot.result?.data) continue;
    const extraPath = path.join(pageDir, extra.fileName);
    const extraBuffer = Buffer.from(extraShot.result.data, "base64");
    fs.writeFileSync(extraPath, extraBuffer);
    console.log(`  ${path.relative(process.cwd(), extraPath)} (${extraBuffer.length} bytes)`);
  }

  const layout = await cdp(ws, "Page.getLayoutMetrics");
  const cs = layout.result?.contentSize || {};
  console.log(`  Viewport: ${cs.width || "?"}×${cs.height || "?"}\n`);

  ws.close();

  const referencePath = path.join(pageDir, "reference.png");
  const overlayPath = path.join(pageDir, "overlay.png");
  if (fs.existsSync(referencePath) && fs.existsSync(currentPath)) {
    execFileSync("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-File", path.join(__dirname, "create-overlay.ps1"),
      "-ReferencePath", referencePath,
      "-CurrentPath", currentPath,
      "-OutputPath", overlayPath,
    ], { stdio: "ignore", windowsHide: true });
    console.log(`  ${path.relative(process.cwd(), overlayPath)}`);
  }

  // notes.md
  const ts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const lines = [`# ${pageName} — Snapshot Check ${ts}\n`];
  lines.push(`## Checks\n`);
  for (const [label, value] of Object.entries(results)) {
    lines.push(`| ${label} | \`${String(value).substring(0, 60)}\` |`);
  }
  lines.push(`\n## Files\n`);
  lines.push(`- \`current.png\` ✓ (${cs.width || "?"}×${cs.height || "?"})`);
  lines.push(`- \`reference.png\` ${fs.existsSync(path.join(pageDir, "reference.png")) ? "✓" : "—"}`);
  lines.push(`- Captured: ${ts}`);
  fs.writeFileSync(notesPath, lines.join("\n"));
  console.log("  notes.md updated\n");

  console.log("╔═══════════════════════════════════════╗");
  console.log("║  Done                                 ║");
  console.log("╚═══════════════════════════════════════╝");
  console.log(`  design-prototypes/social-shell/${pageName}/`);
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });
