"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");

const projectRoot = path.resolve(__dirname, "../../..");
const productionMode = process.argv.includes("--production");
const port = Number(process.env.MERCURY_SMOKE_PORT || 4189);
const origin = `http://127.0.0.1:${port}`;

async function reachable() {
  try { return (await fetch(origin)).ok; } catch (_error) { return false; }
}

async function ensureServer() {
  if (await reachable()) return null;
  const server = spawn(process.execPath, [path.join(projectRoot, "server/server.js")], {
    cwd: projectRoot,
    env: {
      ...process.env,
      MERCURY_PORT: String(port),
      ...(productionMode ? { MERCURY_STATIC_ROOT: path.join(projectRoot, "dist") } : {}),
    },
    stdio: "ignore",
  });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await reachable()) return server;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  server.kill();
  throw new Error("Mercury Phone smoke server did not start.");
}

async function goHome(page, appId) {
  await page.evaluate((fromAppId) => window.MercuryRuntime.systemServices.homeBridge(fromAppId), appId);
  await page.waitForFunction(() => window.MercuryRuntime.stateMachine.state === "home");
}

async function assertTouchTargets(page, selector, label) {
  const targets = await page.locator(selector).evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }));
  assert.ok(targets.length > 0, `${label} must expose at least one target`);
  targets.forEach(({ width, height }) => {
    assert.ok(width >= 44 && height >= 44, `${label} must be at least 44px, received ${width}x${height}`);
  });
}

async function main() {
  const server = await ensureServer();
  let browser;
  try {
    const browserTarget = process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : { channel: process.env.MERCURY_BROWSER_CHANNEL || "chrome" };
    browser = await chromium.launch({ ...browserTarget, headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    const problems = [];
    page.on("console", (message) => {
      if (["warning", "error"].includes(message.type())) problems.push(`${message.type()}: ${message.text()}`);
    });
    page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
    await page.goto(`${origin}/?passcode=2468`, { waitUntil: "commit", timeout: 45000 });
    await page.waitForFunction(() => window.MercuryRuntime && window.MercuryEvents, null, { timeout: 45000 });
    await page.waitForTimeout(520);
    await page.evaluate(() => {
      const runtime = window.MercuryRuntime;
      if (runtime.stateMachine.state === "locked") runtime.stateMachine.dispatch(window.MercuryEvents.REQUEST_UNLOCK);
      if (runtime.stateMachine.state === "unlocking") runtime.stateMachine.dispatch(window.MercuryEvents.UNLOCK_SUCCESS);
    });
    await page.waitForFunction(() => window.MercuryRuntime.stateMachine.state === "home");

    await page.getByRole("button", { name: "Mercury Chat", exact: true }).click();
    await page.waitForSelector(".mercury-chat-app");
    assert.equal(await page.locator(".mercury-chat-app").getAttribute("aria-label"), "Mercury Chat");
    await assertTouchTargets(page, ".mercury-chat-list__search-button, .mercury-chat-list__add, .mercury-chat-thread__more", "Chat list controls");
    assert.doesNotMatch(await page.locator(".mercury-chat-thread time").first().innerText(), /^\d{1,2}:\d{2}$/, "older Chat previews must show a calendar date instead of a time-only label");
    await page.locator(".mercury-chat-thread__open").first().click();
    await page.waitForSelector(".mercury-chat-conversation");
    await assertTouchTargets(page, ".mercury-chat-header__back, .mercury-chat-header__search, .mercury-chat-header__settings, .mercury-chat-composer__attachments-trigger, .mercury-chat-composer__send", "Chat conversation controls");
    await page.locator(".mercury-chat-bubble").first().click();
    await page.waitForSelector(".mercury-chat-message__actions");
    await assertTouchTargets(page, ".mercury-chat-message__action", "Chat message actions");
    await goHome(page, "mercury-chat");

    await page.getByRole("button", { name: "档案馆", exact: true }).click();
    await page.waitForSelector(".mercury-archive-app");
    assert.ok((await page.locator(".mercury-archive-app").innerText()).includes("档案馆"));
    await assertTouchTargets(page, ".archive-home-hero__add, .archive-search, .archive-home-segments .archive-segment", "Archive home controls");
    assert.equal(await page.locator(".archive-section-link").count(), 0, "empty Archive Recent cannot expose a misleading character-only action");
    await goHome(page, "archive");

    await page.getByRole("button", { name: "剧场", exact: true }).click();
    await page.waitForSelector(".cinema-screen");
    await page.waitForFunction(() => Boolean(window.MercuryRuntime.appEngine.getInstance("cinema")?.app?.initialized));
    if (await page.locator(".cinema-curtain--entry").count()) {
      await page.getByRole("button", { name: "跳过动画", exact: true }).click();
    }
    await page.waitForTimeout(350);
    if (await page.getByRole("button", { name: "收好节目单", exact: true }).count()) {
      await page.getByRole("button", { name: "收好节目单", exact: true }).click();
    }
    await page.waitForSelector(".cinema-home");
    await assertTouchTargets(page, ".cinema-home__destination", "Cinema Home destinations");
    assert.equal(await page.evaluate(() => window.MercuryRuntime.appLoader.snapshot("cinema").status), "ready");
    assert.deepEqual(problems, []);
    await context.close();
    process.stdout.write(`${JSON.stringify({ ok: true, mode: productionMode ? "production" : "source", viewport: "390x844", apps: ["mercury-chat", "archive", "cinema"], problems }, null, 2)}\n`);
  } finally {
    await browser?.close();
    server?.kill();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
