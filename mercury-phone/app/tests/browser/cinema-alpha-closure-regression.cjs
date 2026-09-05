"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");
const contracts = require("../../core/cinema-contracts.js");
const stageCatalog = require("../../core/cinema-stage-catalog.js");

const projectRoot = path.resolve(__dirname, "../../..");
const outputDirectory = path.join(projectRoot, "test-results", "cinema-alpha-closure");
const port = Number(process.env.MERCURY_CLOSURE_PORT || 4188);
const origin = `http://127.0.0.1:${port}`;
const url = `${origin}/?passcode=2468`;
const profileArgument = process.argv.find((argument) => argument.startsWith("--profile="));
const profile = profileArgument?.slice("--profile=".length) || "stress";
if (!["core", "stress"].includes(profile)) throw new Error(`Unsupported Cinema E2E profile: ${profile}`);
const stage = stageCatalog.PRODUCTION_STAGE_CATALOG.listStages()[0];
const scenario = stage.scenarios[0];
const startedAt = "2026-09-05T01:00:00.000Z";

fs.mkdirSync(outputDirectory, { recursive: true });

const clone = (value) => JSON.parse(JSON.stringify(value));

function character(id, displayName) {
  return contracts.normalizeCharacterSnapshot({
    id,
    displayName,
    identity: `${displayName}是一名安静而坚定的旅行者`,
    summary: "在陌生世界中寻找归途。",
    stableTraits: ["克制", "敏锐"],
    motivations: ["理解正在发生的事"],
    values: ["诚实"],
    boundaries: ["不接受被替代选择"],
    imageAssetId: "",
    avatarAssetId: "",
    coverAssetId: "",
  });
}

function archivedInstance(options = {}) {
  const id = options.id;
  const sceneId = `${id}-scene`;
  const createdAt = options.createdAt || startedAt;
  const worldId = options.worldId || stage.id;
  const worldTitle = options.worldTitle || stage.title;
  const reliable = options.reliable !== false;
  return contracts.normalizeInstance({
    id,
    title: options.title,
    status: options.status || "ended",
    stageId: worldId,
    stageSnapshot: worldId === stage.id
      ? contracts.createStageSnapshot(stage)
      : contracts.createStageSnapshot({ id: worldId, title: worldTitle, shortTitle: worldTitle, unavailable: true }),
    scenarioId: scenario.id,
    scenarioSnapshot: contracts.createScenarioSnapshot(scenario),
    characterSnapshot: options.character,
    player: { name: "你", role: "远行者", specialization: "空间、交通与远行" },
    variant: { sharedHistory: options.sharedHistory || "" },
    generationProfileId: "preset-default",
    generationProfileSnapshot: { id: "preset-default", name: "默认预设" },
    runtimeProfileHistory: [],
    scenes: [{ id: sceneId, actNumber: 1, sceneNumber: 1, title: "旧站台", createdAt }],
    structureProvenance: { scenes: reliable ? "runtime" : "compatibility-unknown" },
    currentSceneId: sceneId,
    segments: [
      { id: `${id}-opening`, sceneId, role: "assistant", text: `${options.title} 的开场仍被完整保存。`, status: "complete", createdAt, generationProfileId: "preset-default" },
      { id: `${id}-user`, sceneId, role: "user", text: "我把最后一页留在站台上。", status: "complete", createdAt, generationProfileId: "preset-default" },
    ],
    notes: { overview: "只记录已经发生的演出事实。" },
    closureRecord: options.status === "ended" || !options.status
      ? { version: 1, initiatedAt: createdAt, pendingDisposition: null }
      : null,
    createdAt,
    updatedAt: options.updatedAt || createdAt,
    endedAt: options.status === "ended" || !options.status ? options.endedAt || options.updatedAt || createdAt : "",
  }, stageCatalog.PRODUCTION_STAGE_CATALOG);
}

function cinemaFixture() {
  const lin = character("qa-character-lin", "林疏白");
  const ye = character("qa-character-ye", "叶知栖");
  const instances = [
    archivedInstance({ id: "qa-active", title: "北方长廊未完的信", status: "active", character: lin, updatedAt: "2026-09-04T08:00:00.000Z" }),
    archivedInstance({ id: "qa-paused", title: "潮汐停在旧灯塔", status: "intermission", character: ye, updatedAt: "2026-09-03T08:00:00.000Z" }),
    archivedInstance({ id: "qa-ended-a", title: "静默子午线", character: lin, endedAt: "2026-09-02T08:00:00.000Z" }),
    archivedInstance({ id: "qa-ended-b", title: "最后一班渡船", character: lin, endedAt: "2026-09-01T08:00:00.000Z" }),
    archivedInstance({ id: "qa-ended-legacy", title: "没有幕号的旧演出", character: ye, worldId: "archived-world", worldTitle: "无昼城", reliable: false, endedAt: "2026-08-31T08:00:00.000Z" }),
  ];
  return contracts.normalizeState({
    ...contracts.createState(),
    hasEntered: false,
    tutorialSeen: false,
    focusedInstanceId: "qa-active",
    instances,
  }, stageCatalog.PRODUCTION_STAGE_CATALOG);
}

function archiveFixture() {
  return {
    schemaVersion: 1,
    sourceAssets: [],
    runtimeProfiles: [{
      id: "qa-character-new",
      sourceAssetId: "qa-source",
      displayName: "林疏白",
      identity: "安静而坚定的旅行者",
      summary: "在陌生世界中寻找归途。",
      stableTraits: ["克制", "敏锐"],
      motivations: ["理解正在发生的事"],
      values: ["诚实"],
      boundaries: ["不接受被替代选择"],
      status: "ready",
      imageAssetId: "",
      avatarAssetId: "",
      coverAssetId: "",
    }],
    worlds: [],
    promptModules: [],
    contactInstances: [],
  };
}

async function reachable() {
  try { return (await fetch(origin)).ok; } catch (_error) { return false; }
}

async function ensureServer() {
  if (await reachable()) return null;
  const server = spawn(process.execPath, [path.join(projectRoot, "server/server.js")], {
    cwd: projectRoot,
    env: { ...process.env, MERCURY_PORT: String(port) },
    stdio: "ignore",
  });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await reachable()) return server;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  server.kill();
  throw new Error("Mercury Phone regression server did not start.");
}

async function installSeed(context, cinemaState = cinemaFixture()) {
  await context.addInitScript(({ expectedOrigin, archive, cinema }) => {
    if (location.origin !== expectedOrigin) return;
    if (sessionStorage.getItem("cinema-alpha-seeded") === "true") return;
    localStorage.setItem("mercury.app.settings.connection", JSON.stringify({
      provider: "openai-compatible",
      baseUrl: "http://fixture.invalid/v1",
      apiKey: "fixture-key",
      model: "fixture-model",
    }));
    localStorage.setItem("mercury.app.shared.archive.v1", JSON.stringify(archive));
    localStorage.removeItem("mercury.app.cinema.cinema.idb-authority.v1");
    localStorage.setItem("mercury.app.cinema.cinema.v1", JSON.stringify(cinema));
    sessionStorage.setItem("cinema-alpha-seeded", "true");
  }, { expectedOrigin: origin, archive: archiveFixture(), cinema: cinemaState });
}

async function openPhone(context, problems) {
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type())) problems.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  await page.goto(url, { waitUntil: "commit", timeout: 45000 });
  await page.waitForFunction(() => window.MercuryRuntime && window.MercuryEvents, null, { timeout: 45000 });
  await page.waitForTimeout(520);
  await page.evaluate(() => {
    const runtime = window.MercuryRuntime;
    if (runtime.stateMachine.state === "locked") runtime.stateMachine.dispatch(window.MercuryEvents.REQUEST_UNLOCK);
    if (runtime.stateMachine.state === "unlocking") runtime.stateMachine.dispatch(window.MercuryEvents.UNLOCK_SUCCESS);
  });
  await page.waitForFunction(() => window.MercuryRuntime.stateMachine.state === "home");
  return page;
}

async function launchCinema(page) {
  await page.getByRole("button", { name: "剧场", exact: true }).click();
  await page.waitForSelector(".cinema-screen");
  await page.waitForFunction(() => {
    const app = window.MercuryRuntime?.appEngine?.getInstance?.("cinema")?.app;
    return Boolean(app?.initialized && app.store?.isReady?.());
  });
  if (await page.locator(".cinema-curtain--entry").count()) {
    await page.getByRole("button", { name: "跳过动画", exact: true }).click();
    await page.waitForSelector(".cinema-home");
  }
  if (await page.getByRole("button", { name: "收好节目单", exact: true }).count()) {
    await page.getByRole("button", { name: "收好节目单", exact: true }).click();
  }
  await page.waitForSelector(".cinema-home");
}

async function snapshot(page, flush = true) {
  return page.evaluate(async (shouldFlush) => {
    const store = window.MercuryRuntime.appEngine.getInstance("cinema").app.store;
    if (shouldFlush) await store.flush();
    return store.snapshot();
  }, flush);
}

async function appRoute(page) {
  return page.evaluate(() => window.MercuryRuntime.appEngine.getInstance("cinema").app.route);
}

async function reloadToCinema(page) {
  await page.goto("about:blank", { waitUntil: "load", timeout: 30000 });
  await page.goto(url, { waitUntil: "commit", timeout: 45000 });
  await page.waitForFunction(() => window.MercuryRuntime && window.MercuryEvents, null, { timeout: 45000 });
  await page.waitForTimeout(520);
  await page.evaluate(() => {
    const runtime = window.MercuryRuntime;
    if (runtime.stateMachine.state === "locked") runtime.stateMachine.dispatch(window.MercuryEvents.REQUEST_UNLOCK);
    if (runtime.stateMachine.state === "unlocking") runtime.stateMachine.dispatch(window.MercuryEvents.UNLOCK_SUCCESS);
  });
  await page.waitForFunction(() => window.MercuryRuntime.stateMachine.state === "home");
  await launchCinema(page);
}

async function openProgramme(page) {
  await page.getByRole("button", { name: "节目单", exact: true }).click();
  await page.waitForSelector(".cinema-programme-hub");
}

async function openReadingMenuItem(page, label) {
  await page.getByRole("button", { name: "放映菜单", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(label) }).click();
}

async function waitForReading(page) {
  await page.waitForSelector(".cinema-reading");
  assert.equal(await appRoute(page), "reading");
}

async function continueFromProgramme(page, title) {
  const direct = page.locator(".cinema-programme-hub__continue");
  if (title && await page.getByRole("button", { name: `打开${title}节目`, exact: true }).count()) {
    await page.getByRole("button", { name: `打开${title}节目`, exact: true }).click();
    await page.locator(".cinema-programme-entry__continue").click();
  } else await direct.click();
  if (await page.locator(".cinema-curtain--resume").count()) {
    await page.getByRole("button", { name: "继续", exact: true }).click();
  }
  await waitForReading(page);
}

function assertLifecycleState(state, instanceId, expectedStatus) {
  const instance = state.instances.find((item) => item.id === instanceId);
  assert.ok(instance, `${instanceId} remains persisted`);
  assert.equal(instance.status, expectedStatus);
  return instance;
}

async function screenMetrics(page) {
  return page.evaluate(() => {
    const screen = document.querySelector(".cinema-screen");
    const visibleButtons = screen ? [...screen.querySelectorAll("button")].filter((button) => button.offsetParent !== null) : [];
    const clipped = screen ? [...screen.querySelectorAll("h1,h2,h3,p,span,strong,small,button")].filter((node) => {
      const style = getComputedStyle(node);
      if (style.textOverflow === "ellipsis") return false;
      return node.scrollWidth > node.clientWidth + 2;
    }).map((node) => node.textContent.trim().slice(0, 80)) : [];
    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      screen: screen ? { width: screen.getBoundingClientRect().width, height: screen.getBoundingClientRect().height } : null,
      route: window.MercuryRuntime.appEngine.getInstance("cinema").app.route,
      targets: visibleButtons.map((button) => {
        const rect = button.getBoundingClientRect();
        return { label: button.getAttribute("aria-label") || button.textContent.trim().replace(/\s+/g, " "), width: Math.round(rect.width), height: Math.round(rect.height), bottom: Math.round(rect.bottom) };
      }),
      clipped,
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
  });
}

async function runAuthoritativeLifecycle(browser) {
  const problems = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await installSeed(context);
  await context.route("**/assets/cinema/aevoria-campus-map.webp", (route) => route.abort());
  const generatedRequests = [];
  await context.route("**/api/cinema", async (route) => {
    const payload = JSON.parse(route.request().postData() || "{}");
    generatedRequests.push(payload.request);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, requestId: payload.request.requestId, text: "风沿着长廊尽头转过来，𠮷字形的旧标记在灯下显出细微刻痕。林疏白没有替你作决定，只把未拆封的课程册放在窗边，等你说出下一步。" }),
    });
  });
  const page = await openPhone(context, problems);
  await launchCinema(page);
  assert.equal((await page.locator(".cinema-home").innerText()).includes("北方长廊未完的信"), false, "Home remains a stable foyer without Performance metadata");

  await openProgramme(page);
  assert.equal(await page.locator(".cinema-programme-hub__life-row").count(), 1, "every non-primary unfinished Performance remains reachable");
  await page.locator(".cinema-programme-hub__start").click();
  await page.waitForSelector(".cinema-world-library[data-mode='prepare']");
  await page.waitForFunction(() => document.querySelector(".cinema-world-plane")?.dataset.fallback === "true");
  assert.equal(await page.locator(".cinema-world-plane").getAttribute("data-fallback"), "true", "World Library uses its deterministic no-image fallback");
  await page.getByRole("button", { name: /查看.*世界档案/ }).click();
  await page.waitForSelector(".cinema-paper-screen");
  await page.getByRole("button", { name: "选择这一场", exact: true }).click();
  await page.waitForSelector(".cinema-cast-index");
  let state = await snapshot(page);
  const preexistingCount = state.instances.length;
  assert.ok(state.draft?.stageId, "World choice creates only a preparation Draft");
  assert.equal(state.instances.length, 5, "preparation does not create an Instance");

  await reloadToCinema(page);
  await openProgramme(page);
  const draftResume = page.getByRole("button", { name: /继续准备这场人生/ });
  assert.equal(await draftResume.count(), 1, "reload exposes the durable Draft recovery path");
  await draftResume.click();
  await page.waitForSelector(".cinema-cast-index");
  state = await snapshot(page);
  assert.equal(state.instances.length, preexistingCount);
  assert.ok(state.draft?.stageId);

  await page.getByRole("button", { name: "选择角色林疏白", exact: true }).click();
  await page.waitForSelector(".cinema-adaptation");
  assert.equal(await page.locator(".cinema-adaptation img").count(), 0, "Adaptation does not require Character imagery");
  await page.getByRole("button", { name: "确认适配", exact: true }).click();
  await page.waitForSelector(".cinema-before-curtain");
  assert.equal((await snapshot(page)).instances.length, preexistingCount, "Before the Curtain is still draft-only");
  await page.getByRole("button", { name: "开幕", exact: true }).click();
  await waitForReading(page);
  state = await snapshot(page);
  assert.equal(state.instances.length, preexistingCount + 1, "openCurtain is the single Instance creation boundary");
  assert.equal(state.draft, null);
  const created = state.instances.find((item) => !cinemaFixture().instances.some((seeded) => seeded.id === item.id));
  assert.ok(created);
  assertLifecycleState(state, created.id, "active");

  await reloadToCinema(page);
  await openProgramme(page);
  await continueFromProgramme(page, created.title);
  assert.ok((await page.locator(".cinema-reading").innerText()).includes(scenario.opening.slice(0, 24)), "active Reading reload restores persisted narrative");

  const beforeSegments = (await snapshot(page)).instances.find((item) => item.id === created.id).segments.length;
  const area = page.getByRole("textbox", { name: "写下接下来发生的事或你的行动" });
  await area.fill("我沿着北门长廊向他走去，先问那本课程册是否属于我。 Mixed note 01.");
  await page.getByRole("button", { name: "将这段文字写入故事", exact: true }).click();
  await page.waitForFunction(({ id, count }) => {
    const app = window.MercuryRuntime.appEngine.getInstance("cinema").app;
    const instance = app.store.get(id);
    return app.workflow.snapshot().phase === "idle" && !instance.pendingContinuation && instance.segments.length === count + 2;
  }, { id: created.id, count: beforeSegments });
  state = await snapshot(page);
  const generated = assertLifecycleState(state, created.id, "active");
  assert.equal(generated.segments.length, beforeSegments + 2);
  assert.equal(generatedRequests.length, 1, "one submit produces one provider request");

  await openReadingMenuItem(page, "中场休息");
  await page.waitForSelector(".cinema-intermission");
  state = await snapshot(page);
  assertLifecycleState(state, created.id, "intermission");
  await reloadToCinema(page);
  await openProgramme(page);
  await continueFromProgramme(page, created.title);
  state = await snapshot(page);
  assertLifecycleState(state, created.id, "active");

  await openReadingMenuItem(page, "中场休息");
  await page.waitForSelector(".cinema-intermission");
  await page.locator(".cinema-intermission__primary").click();
  await page.getByRole("button", { name: "继续", exact: true }).click();
  await waitForReading(page);
  state = await snapshot(page);
  assertLifecycleState(state, created.id, "active");

  await openReadingMenuItem(page, "结束本场演出");
  await page.getByRole("button", { name: "确认谢幕", exact: true }).click();
  await page.waitForSelector(".cinema-credits", { timeout: 20000 });
  state = await snapshot(page);
  const ended = assertLifecycleState(state, created.id, "ended");
  assert.ok(ended.closureRecord?.initiatedAt);
  assert.equal(ended.pendingContinuation, null);
  await page.screenshot({ path: path.join(outputDirectory, "authoritative-credits-390x844.png") });

  const immutableBefore = clone(ended);
  await reloadToCinema(page);
  await openProgramme(page);
  assert.equal(await page.getByRole("button", { name: `阅读${created.title}归档`, exact: true }).count(), 1, "Credits reload returns to a truthful Programme archive entry");
  await page.getByRole("button", { name: `阅读${created.title}归档`, exact: true }).click();
  await page.waitForSelector(".cinema-history-reader");
  assert.equal(await page.getByText("继续演出", { exact: true }).count(), 0, "History exposes no continuation action");
  assert.deepEqual((await snapshot(page)).instances.find((item) => item.id === created.id), immutableBefore, "History navigation is immutable");
  await page.screenshot({ path: path.join(outputDirectory, "authoritative-history-390x844.png") });
  await page.getByRole("button", { name: "返回节目单", exact: true }).first().click();
  await page.getByRole("button", { name: "查看全部往期", exact: true }).click();
  await page.waitForSelector(".cinema-programme-archive");
  assert.ok(await page.locator(".cinema-programme-archive__group").count() >= 2, "Archive groups ended Performances by stable Character x World identity");
  await page.locator(`[data-instance-id='${created.id}']`).click();
  await page.waitForSelector(".cinema-history-reader");
  assert.equal(await page.getByRole("button", { name: "返回往期索引", exact: true }).count(), 1);

  await reloadToCinema(page);
  await openProgramme(page);
  assert.equal(await page.getByRole("button", { name: `阅读${created.title}归档`, exact: true }).count(), 1, "ended History remains reachable after reload");
  await page.getByRole("button", { name: "查看全部往期", exact: true }).click();
  await page.waitForSelector(".cinema-programme-archive");
  await page.screenshot({ path: path.join(outputDirectory, "authoritative-archive-390x844.png") });
  await page.locator("[data-instance-id='qa-ended-legacy']").click();
  await page.waitForSelector(".cinema-history-reader[data-structure-provenance='compatibility-unknown']");
  assert.equal(await page.locator(".cinema-history-section__structure").count(), 0, "compatibility Scene arrays do not become canonical History structure");
  assert.equal((await page.locator(".cinema-history-reader").innerText()).includes("第一幕"), false);

  const expectedNoImageFailures = problems.filter((problem) => problem === "error: Failed to load resource: net::ERR_FAILED");
  const unexpectedProblems = problems.filter((problem) => problem !== "error: Failed to load resource: net::ERR_FAILED");
  const report = {
    createdInstanceId: created.id,
    generatedRequests: generatedRequests.length,
    seededUnfinished: 2,
    seededEnded: 3,
    finalEnded: (await snapshot(page)).instances.filter((item) => item.status === "ended").length,
    archiveGroups: await page.evaluate(() => window.MercuryCinemaProgrammeArchiveProjection.buildCinemaProgrammeArchiveProjection(window.MercuryRuntime.appEngine.getInstance("cinema").app.store.snapshot()).groups.length),
    expectedNoImageFailures: expectedNoImageFailures.length,
    problems: unexpectedProblems,
  };
  assert.ok(expectedNoImageFailures.length >= 1, "the no-image run actually blocks the optional World visual");
  assert.deepEqual(unexpectedProblems, []);
  await context.close();
  return report;
}

async function runPendingReload(browser) {
  const problems = [];
  const initial = contracts.normalizeState({
    ...contracts.createState(),
    hasEntered: true,
    tutorialSeen: true,
    focusedInstanceId: "qa-pending-active",
    instances: [archivedInstance({ id: "qa-pending-active", title: "等待回应的长廊", status: "active", character: character("qa-pending-character", "闻雪") })],
  }, stageCatalog.PRODUCTION_STAGE_CATALOG);
  const initialUserSegments = initial.instances[0].segments.filter((segment) => segment.role === "user").length;
  const initialAssistantSegments = initial.instances[0].segments.filter((segment) => segment.role === "assistant").length;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await installSeed(context, initial);
  let responseMode = "delayed";
  let requests = 0;
  await context.route("**/api/cinema", async (route) => {
    requests += 1;
    const payload = JSON.parse(route.request().postData() || "{}");
    if (responseMode === "delayed") await new Promise((resolve) => setTimeout(resolve, 1400));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, requestId: payload.request.requestId, text: "明确恢复后，演出才继续写下这一段。" }) }).catch(() => {});
  });

  let page = await openPhone(context, problems);
  await launchCinema(page);
  await openProgramme(page);
  await continueFromProgramme(page, "等待回应的长廊");
  await page.getByRole("textbox", { name: "写下接下来发生的事或你的行动" }).fill("这句话必须先持久化，再等待回应。");
  await page.getByRole("button", { name: "将这段文字写入故事", exact: true }).click();
  await page.waitForFunction(() => {
    const app = window.MercuryRuntime.appEngine.getInstance("cinema").app;
    return Boolean(app.store.focused()?.pendingContinuation);
  });
  const durablePending = await snapshot(page);
  const firstPending = durablePending.instances[0].pendingContinuation;
  assert.ok(firstPending?.requestId);
  await page.close();
  await new Promise((resolve) => setTimeout(resolve, 1550));
  responseMode = "success";

  page = await openPhone(context, problems);
  await launchCinema(page);
  await openProgramme(page);
  await continueFromProgramme(page, "等待回应的长廊");
  assert.equal(await page.getByRole("button", { name: "重试续写", exact: true }).count(), 1);
  assert.equal(await page.locator(".cinema-composer").count(), 0);
  assert.equal(requests, 1, "reload never auto-resends durable pending work");
  await page.getByRole("button", { name: "重试续写", exact: true }).click();
  await page.waitForFunction(() => {
    const app = window.MercuryRuntime.appEngine.getInstance("cinema").app;
    return app.workflow.snapshot().phase === "idle" && !app.store.focused()?.pendingContinuation;
  });
  let state = await snapshot(page);
  assert.equal(requests, 2);
  assert.equal(state.instances[0].segments.filter((segment) => segment.role === "user").length, initialUserSegments + 1);
  assert.equal(state.instances[0].segments.filter((segment) => segment.role === "assistant").length, initialAssistantSegments + 1);

  responseMode = "delayed";
  await page.getByRole("textbox", { name: "写下接下来发生的事或你的行动" }).fill("这段没有收到回应，但必须留在归档里。");
  await page.getByRole("button", { name: "将这段文字写入故事", exact: true }).click();
  await page.waitForFunction(() => Boolean(window.MercuryRuntime.appEngine.getInstance("cinema").app.store.focused()?.pendingContinuation));
  state = await snapshot(page);
  const abandonedRequest = state.instances[0].pendingContinuation.requestId;
  const abandonedUserSegment = state.instances[0].pendingContinuation.userSegmentId;
  await page.close();
  await new Promise((resolve) => setTimeout(resolve, 1550));
  responseMode = "success";

  page = await openPhone(context, problems);
  await launchCinema(page);
  await openProgramme(page);
  await continueFromProgramme(page, "等待回应的长廊");
  await openReadingMenuItem(page, "结束本场演出");
  await page.getByRole("button", { name: "放弃这次待续写并谢幕", exact: true }).click();
  await page.getByRole("button", { name: "确认放弃并谢幕", exact: true }).click();
  await page.waitForSelector(".cinema-credits", { timeout: 20000 });
  state = await snapshot(page);
  const ended = state.instances[0];
  assert.equal(ended.status, "ended");
  assert.equal(ended.pendingContinuation, null);
  assert.equal(ended.closureRecord.pendingDisposition.requestId, abandonedRequest);
  assert.equal(ended.closureRecord.pendingDisposition.userSegmentId, abandonedUserSegment);
  assert.ok(ended.segments.some((segment) => segment.id === abandonedUserSegment && segment.role === "user"));
  await page.getByRole("button", { name: "阅读完整节目册", exact: true }).click();
  await page.waitForSelector(`[data-segment-id='${abandonedUserSegment}'][data-abandoned-pending='true']`);
  assert.ok((await page.locator(`[data-segment-id='${abandonedUserSegment}']`).innerText()).includes("这段没有收到回应"));
  assert.deepEqual(problems, []);
  await context.close();
  return { firstPendingRequestId: firstPending.requestId, explicitRecoveryRequests: 2, abandonedRequestId: abandonedRequest, unansweredSegmentPreserved: true };
}

async function runDurableEndingReload(browser) {
  const problems = [];
  const initial = contracts.normalizeState({
    ...contracts.createState(),
    hasEntered: true,
    tutorialSeen: true,
    focusedInstanceId: "qa-ending-reload",
    instances: [archivedInstance({ id: "qa-ending-reload", title: "重载以后继续谢幕", status: "active", character: character("qa-ending-character", "周岚") })],
  }, stageCatalog.PRODUCTION_STAGE_CATALOG);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await installSeed(context, initial);
  let page = await openPhone(context, problems);
  await launchCinema(page);
  await page.evaluate(async () => {
    const app = window.MercuryRuntime.appEngine.getInstance("cinema").app;
    await app.closureWorkflow.beginEnding("qa-ending-reload");
    await app.store.flush();
  });
  assertLifecycleState(await snapshot(page), "qa-ending-reload", "ending");
  await page.close();

  page = await openPhone(context, problems);
  await launchCinema(page);
  await openProgramme(page);
  assert.ok((await page.locator(".cinema-programme-hub").innerText()).includes("继续谢幕"));
  await page.locator(".cinema-programme-hub__continue").click();
  await page.waitForSelector(".cinema-credits", { timeout: 20000 });
  const ended = assertLifecycleState(await snapshot(page), "qa-ending-reload", "ended");
  assert.ok(ended.closureRecord?.initiatedAt);
  assert.deepEqual(problems, []);
  await context.close();
  return { durableBeforeReload: "ending", recoveredSurface: "Credits", durableAfterReload: "ended" };
}

async function runClosurePersistenceFailure(browser) {
  const problems = [];
  const initial = contracts.normalizeState({
    ...contracts.createState(),
    hasEntered: true,
    tutorialSeen: true,
    focusedInstanceId: "qa-failure-active",
    instances: [archivedInstance({ id: "qa-failure-active", title: "不能伪装成功的谢幕", status: "active", character: character("qa-failure-character", "许渡") })],
  }, stageCatalog.PRODUCTION_STAGE_CATALOG);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await installSeed(context, initial);
  let page = await openPhone(context, problems);
  await launchCinema(page);
  await openProgramme(page);
  await continueFromProgramme(page, "不能伪装成功的谢幕");
  await snapshot(page);
  await page.evaluate(() => {
    const app = window.MercuryRuntime.appEngine.getInstance("cinema").app;
    app.store.repository.save = async () => { throw Object.assign(new Error("injected closure save failure"), { code: "QA_SAVE_FAILURE" }); };
  });
  await openReadingMenuItem(page, "结束本场演出");
  await page.getByRole("button", { name: "确认谢幕", exact: true }).click();
  await page.waitForSelector(".cinema-closure-failure");
  assert.equal(await page.locator(".cinema-credits").count(), 0, "Credits never appears before durable ended persistence");
  assert.ok((await page.locator(".cinema-closure-failure").innerText()).includes("谢幕尚未保存"));
  await page.close();

  page = await openPhone(context, problems);
  await launchCinema(page);
  await openProgramme(page);
  await continueFromProgramme(page, "不能伪装成功的谢幕");
  const recovered = await snapshot(page);
  assertLifecycleState(recovered, "qa-failure-active", "active");
  assert.equal(recovered.instances[0].closureRecord, null);
  assert.deepEqual(problems, []);
  await context.close();
  return { creditsBeforeDurableEnd: false, recoveredStatus: "active", closureRecordAfterReload: null };
}

async function runViewport(browser, viewport) {
  const problems = [];
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await installSeed(context);
  const page = await openPhone(context, problems);
  await launchCinema(page);
  const home = await screenMetrics(page);
  await openProgramme(page);
  const programme = await screenMetrics(page);
  await page.getByRole("button", { name: "查看全部往期", exact: true }).click();
  await page.waitForSelector(".cinema-programme-archive");
  const archive = await screenMetrics(page);
  for (const [name, metrics] of Object.entries({ home, programme, archive })) {
    assert.equal(metrics.documentWidth, viewport.width, `${name} has no page-level horizontal overflow at ${viewport.width}`);
    assert.equal(metrics.screen.width, Math.min(390, viewport.width), `${name} respects the Mercury device maximum width at ${viewport.width}`);
    assert.equal(metrics.clipped.length, 0, `${name} has no clipped labelled content at ${viewport.width}: ${metrics.clipped.join(" | ")}`);
    assert.ok(metrics.targets.every((target) => target.width >= 44 && target.height >= 44), `${name} keeps >=44px visible targets at ${viewport.width}`);
  }
  assert.deepEqual(problems, []);
  await context.close();
  return { viewport, home, programme, archive };
}

async function main() {
  const server = await ensureServer();
  let browser;
  try {
    const browserTarget = process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : { channel: process.env.MERCURY_BROWSER_CHANNEL || "chrome" };
    browser = await chromium.launch({ ...browserTarget, headless: true });
    const report = {
      generatedAt: new Date().toISOString(),
      origin,
      profile,
      authoritativeLifecycle: await runAuthoritativeLifecycle(browser),
      pendingReload: await runPendingReload(browser),
      endingReload: await runDurableEndingReload(browser),
      persistenceFailure: await runClosurePersistenceFailure(browser),
      viewports: [],
    };
    if (profile === "stress") {
      for (const viewport of [{ width: 360, height: 780 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
        report.viewports.push(await runViewport(browser, viewport));
      }
    }
    const reportPath = path.join(outputDirectory, `regression-report-${profile}.json`);
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      profile,
      lifecycle: report.authoritativeLifecycle,
      pending: report.pendingReload,
      endingReload: report.endingReload,
      persistenceFailure: report.persistenceFailure,
      viewports: report.viewports.map((entry) => entry.viewport),
      report: reportPath,
    }, null, 2)}\n`);
  } finally {
    await browser?.close();
    server?.kill();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
