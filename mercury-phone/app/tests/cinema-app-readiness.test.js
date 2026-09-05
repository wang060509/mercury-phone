"use strict";

const assert = require("node:assert/strict");
global.window = global;

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.className = "";
    this.textContent = "";
    this.style = { setProperty() {} };
    this.classList = {
      add: (...names) => { this.className = `${this.className} ${names.join(" ")}`.trim(); },
      remove: (...names) => { this.className = this.className.split(/\s+/).filter((name) => name && !names.includes(name)).join(" "); },
    };
  }
  append(...nodes) { this.children.push(...nodes.filter(Boolean)); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(name, listener) { this.listeners[name] = listener; }
}

global.document = { createElement: (tagName) => new FakeElement(tagName) };
global.MercuryCinemaStageCatalog = {
  PRODUCTION_STAGE_CATALOG: {
    listStages: () => [],
    getStage: () => null,
    getScenario: () => null,
  },
};

let archiveConstructions = 0;
let profileConstructions = 0;
let workflowConstructions = 0;
let closureWorkflowConstructions = 0;
global.MercuryArchiveContracts = { createArchiveStore() { archiveConstructions += 1; return { load: () => ({ characters: [] }) }; } };
global.MercuryGenerationProfileStore = class { constructor() { profileConstructions += 1; } };
global.MercuryCinemaGenerationWorkflow = class {
  constructor() { workflowConstructions += 1; }
  subscribe() { return () => {}; }
  snapshot() { return { phase: "idle", error: null }; }
};
global.MercuryCinemaClosureWorkflow = class {
  constructor() { closureWorkflowConstructions += 1; }
  subscribe() { return () => {}; }
  snapshot() { return { phase: "idle", operation: null, instanceId: null, error: null }; }
};

const { MercuryCinemaAppController } = require("../apps/cinema-app.js");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
  return { promise, resolve, reject };
}

function findText(node, value) {
  if (!node) return null;
  if (node.textContent === value) return node;
  for (const child of node.children || []) {
    const match = findText(child, value);
    if (match) return match;
  }
  return null;
}

function findClass(node, value) {
  if (!node) return null;
  if (String(node.className || "").split(/\s+/).includes(value)) return node;
  for (const child of node.children || []) {
    const match = findClass(child, value);
    if (match) return match;
  }
  return null;
}

function context() {
  return { services: { storage: {}, sharedStorage: {}, aiTransport: {} } };
}

async function settle() {
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

async function run() {
  const hydration = deferred();
  class DelayedStore {
    constructor() {
      this.ready = hydration.promise;
      this.state = { hasEntered: false, tutorialSeen: false, focusedInstanceId: null, draft: null, instances: [], readingSettings: {} };
    }
    snapshot() { return this.state; }
    focused() { return null; }
    subscribe() { return () => {}; }
  }
  global.MercuryCinemaStore = DelayedStore;

  const root = new FakeElement("main");
  const app = new MercuryCinemaAppController();
  app.render(root, context());
  assert.ok(findText(root, "RESTORING PROGRAMME"), "Cinema renders a loading gate before Repository hydration");
  assert.equal(findText(root, "CURTAIN"), null, "empty default state is not rendered before hydration");
  assert.equal(archiveConstructions, 0, "dependent stores are not created before Cinema is ready");
  assert.equal(profileConstructions, 0);
  assert.equal(workflowConstructions, 0);
  assert.equal(closureWorkflowConstructions, 0);

  hydration.resolve();
  await settle();
  assert.ok(findText(root, "CURTAIN"), "the hydrated Cinema route renders after readiness");
  assert.equal(archiveConstructions, 1);
  assert.equal(profileConstructions, 1);
  assert.equal(workflowConstructions, 1);
  assert.equal(closureWorkflowConstructions, 1);
  app.onUnmount();

  class FailedStore {
    constructor() { this.ready = Promise.reject(new Error("simulated safe-read failure")); }
  }
  global.MercuryCinemaStore = FailedStore;
  const failedRoot = new FakeElement("main");
  const failedApp = new MercuryCinemaAppController();
  failedApp.render(failedRoot, context());
  assert.ok(findText(failedRoot, "RESTORING PROGRAMME"));
  await settle();
  assert.ok(findText(failedRoot, "PROGRAMME UNAVAILABLE"), "read failure becomes explicit instead of rendering or overwriting empty state");
  assert.ok(findText(failedRoot, "simulated safe-read failure"));
  failedApp.onUnmount();

  const pendingInstance = {
    id: "pending-instance",
    status: "active",
    stageSnapshot: { id: "stage", title: "Quiet Stage", shortTitle: "Quiet" },
    scenarioSnapshot: { id: "scenario", title: "Opening" },
    scenes: [{ id: "scene-1", actNumber: 1, sceneNumber: 1, title: "Platform" }],
    currentSceneId: "scene-1",
    segments: [
      { id: "opening", sceneId: "scene-1", role: "assistant", text: "Opening prose." },
      { id: "pending-user", sceneId: "scene-1", role: "user", text: "Unfinished prose." },
    ],
    pendingContinuation: { requestId: "request-pending", userSegmentId: "pending-user", startedAt: "2026-08-20T08:00:00.000Z", generationProfileId: "profile-a" },
    lastError: null,
  };
  class PendingStore {
    constructor() {
      this.ready = Promise.resolve();
      this.state = { hasEntered: true, tutorialSeen: true, focusedInstanceId: pendingInstance.id, draft: null, instances: [pendingInstance], readingSettings: { fontScale: 1, lineHeight: "relaxed", theme: "paper", progressiveReveal: false, actCards: true } };
    }
    snapshot() { return this.state; }
    focused() { return pendingInstance; }
    subscribe() { return () => {}; }
  }
  global.MercuryCinemaStore = PendingStore;
  const pendingRoot = new FakeElement("main");
  const pendingApp = new MercuryCinemaAppController();
  pendingApp.render(pendingRoot, context(), { route: "active" });
  await settle();
  assert.ok(findText(pendingRoot, "重试续写"), "reload exposes durable pending continuation only as an explicit retry action");
  assert.ok(findText(pendingRoot, "上次续写在完成保存前中断。原始文字仍在，只有你明确重试时才会再次请求。"));
  assert.equal(findClass(pendingRoot, "cinema-composer"), null, "new prose cannot overwrite durable pending identity after reload");
  pendingApp.onUnmount();

  console.log("cinema-app-readiness: hydration, storage failure, and explicit pending recovery assertions passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
