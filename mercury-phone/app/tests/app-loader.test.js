"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

global.window = global;
require("../system/app-loader.js");

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

class FakeAppEngine {
  constructor(definitions = []) {
    this.definitions = new Map(definitions.map((definition) => [definition.id, definition]));
    this.registrations = [];
  }

  getDefinition(appId) { return this.definitions.get(appId) || null; }

  register(definition) {
    if (this.definitions.has(definition.id)) throw new Error(`App already registered: ${definition.id}`);
    this.definitions.set(definition.id, definition);
    this.registrations.push(definition.id);
    return definition;
  }
}

const definition = (id) => ({ id, name: id, render() {} });

async function main() {
  const eagerEngine = new FakeAppEngine([definition("settings")]);
  const eagerAssets = { loadStyle: async () => assert.fail("eager apps do not load styles"), loadScript: async () => assert.fail("eager apps do not load scripts") };
  const eagerActivations = [];
  const eagerLoader = new global.MercuryAppLoader({
    appEngine: eagerEngine,
    assetAdapter: eagerAssets,
    activate: (appId, payload) => { eagerActivations.push({ appId, payload }); return true; },
  });
  assert.deepEqual(eagerLoader.snapshot("settings"), { known: true, status: "ready", attempt: 0, error: null });
  assert.deepEqual(await eagerLoader.launch("settings", { route: "ai-connection" }), { appId: "settings", status: "active" });
  assert.deepEqual(eagerActivations, [{ appId: "settings", payload: { route: "ai-connection" } }]);

  const orderedCalls = [];
  const archiveEngine = new FakeAppEngine();
  const archiveLoader = new global.MercuryAppLoader({
    appEngine: archiveEngine,
    assetAdapter: {
      loadStyle: async (href) => { orderedCalls.push(`style:${href}`); },
      loadScript: async (src) => { orderedCalls.push(`script:${src}`); },
    },
    manifests: [{ id: "archive", styles: ["styles/archive-app.css"], scripts: ["apps/archive-app.js"], createDefinition: () => definition("archive") }],
    activate: () => true,
  });
  const events = [];
  archiveLoader.subscribe((event) => events.push(event.type));
  assert.deepEqual(archiveLoader.snapshot("archive"), { known: true, status: "idle", attempt: 0, error: null });
  assert.deepEqual(await archiveLoader.launch("archive"), { appId: "archive", status: "active" });
  assert.deepEqual(orderedCalls, ["style:styles/archive-app.css", "script:apps/archive-app.js"]);
  assert.deepEqual(archiveEngine.registrations, ["archive"]);
  assert.deepEqual(events, ["loading", "ready", "active"]);

  const styleGate = deferred();
  const dedupeCalls = [];
  const dedupeActivations = [];
  const dedupeEngine = new FakeAppEngine([definition("settings")]);
  const dedupeLoader = new global.MercuryAppLoader({
    appEngine: dedupeEngine,
    assetAdapter: {
      loadStyle: (href) => { dedupeCalls.push(`style:${href}`); return styleGate.promise; },
      loadScript: async (src) => { dedupeCalls.push(`script:${src}`); },
    },
    manifests: [{ id: "archive", styles: ["archive.css"], scripts: ["archive.js"], createDefinition: () => definition("archive") }],
    activate: (appId) => { dedupeActivations.push(appId); return true; },
  });
  const firstArchiveLaunch = dedupeLoader.launch("archive");
  const secondArchiveLaunch = dedupeLoader.launch("archive");
  assert.equal(dedupeCalls.filter((call) => call === "style:archive.css").length, 1, "concurrent launches share one asset attempt");
  assert.deepEqual(await dedupeLoader.launch("settings"), { appId: "settings", status: "active" });
  styleGate.resolve();
  assert.deepEqual(await firstArchiveLaunch, { appId: "archive", status: "superseded" });
  assert.deepEqual(await secondArchiveLaunch, { appId: "archive", status: "superseded" });
  assert.equal(dedupeCalls.filter((call) => call === "script:archive.js").length, 1);
  assert.deepEqual(dedupeActivations, ["settings"], "a slow app never steals focus from a newer launch intent");
  assert.deepEqual(dedupeEngine.registrations, ["archive"]);

  let scriptAttempts = 0;
  const retryEngine = new FakeAppEngine();
  const retryLoader = new global.MercuryAppLoader({
    appEngine: retryEngine,
    assetAdapter: {
      loadStyle: async () => {},
      loadScript: async () => {
        scriptAttempts += 1;
        if (scriptAttempts === 1) throw new Error("offline");
      },
    },
    manifests: [{ id: "archive", scripts: ["archive.js"], createDefinition: () => definition("archive") }],
    activate: () => true,
  });
  await assert.rejects(() => retryLoader.launch("archive"), (error) => error.code === "APP_ASSET_LOAD_FAILED" && error.appId === "archive");
  assert.equal(retryLoader.snapshot("archive").status, "error");
  assert.equal(retryLoader.snapshot("archive").attempt, 1);
  assert.equal(retryEngine.registrations.length, 0, "a partial load never registers or activates the app");
  assert.deepEqual(await retryLoader.launch("archive"), { appId: "archive", status: "active" });
  assert.equal(scriptAttempts, 2, "the next launch retries a failed asset attempt");
  assert.equal(retryLoader.snapshot("archive").status, "ready");
  assert.equal(retryLoader.snapshot("archive").attempt, 2);

  const rejectedLoader = new global.MercuryAppLoader({ appEngine: new FakeAppEngine([definition("settings")]), activate: () => false });
  assert.deepEqual(await rejectedLoader.launch("settings"), { appId: "settings", status: "rejected" });
  assert.deepEqual(rejectedLoader.snapshot("missing"), { known: false, status: "unknown", attempt: 0, error: null });
  await assert.rejects(() => rejectedLoader.launch("missing"), (error) => error.code === "APP_NOT_FOUND");

  const mismatchLoader = new global.MercuryAppLoader({
    appEngine: new FakeAppEngine(),
    assetAdapter: { loadStyle: async () => {}, loadScript: async () => {} },
    manifests: [{ id: "archive", scripts: ["archive.js"], createDefinition: () => definition("wrong-id") }],
    activate: () => true,
  });
  await assert.rejects(() => mismatchLoader.launch("archive"), (error) => error.code === "APP_DEFINITION_INVALID");

  class FakeNode {
    constructor(tagName) {
      this.tagName = tagName;
      this.attributes = new Map();
      this.removed = false;
      this.onload = null;
      this.onerror = null;
      this.async = true;
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) || null; }
    remove() { this.removed = true; }
  }
  const appended = [];
  const fakeDocument = {
    createElement: (tagName) => new FakeNode(tagName),
    querySelectorAll: () => [],
    head: { append: (node) => appended.push(node) },
  };
  const domAdapter = new global.MercuryDomAssetAdapter({ document: fakeDocument });
  const failedScript = domAdapter.loadScript("apps/archive-app.js");
  assert.equal(appended[0].tagName, "script");
  assert.equal(appended[0].getAttribute("src"), "apps/archive-app.js", "relative paths stay compatible with direct-file launches");
  assert.equal(appended[0].async, false, "classic scripts preserve manifest order");
  appended[0].onerror();
  await assert.rejects(() => failedScript, (error) => error.code === "ASSET_LOAD_FAILED");
  assert.equal(appended[0].removed, true);
  const retriedScript = domAdapter.loadScript("apps/archive-app.js");
  assert.equal(appended.length, 2, "failed DOM assets are removed from the cache and can retry");
  appended[1].onload();
  await retriedScript;

  const stylePromise = domAdapter.loadStyle("styles/archive-app.css");
  assert.equal(appended[2].tagName, "link");
  assert.equal(appended[2].getAttribute("rel"), "stylesheet");
  assert.equal(appended[2].getAttribute("href"), "styles/archive-app.css");
  appended[2].onload();
  await stylePromise;

  const root = path.resolve(__dirname, "..");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const mainSource = fs.readFileSync(path.join(root, "main.js"), "utf8");
  assert.match(html, /<script src="system\/app-loader\.js"><\/script>/);
  assert.doesNotMatch(html, /<link rel="stylesheet" href="styles\/archive-app\.css"/);
  assert.doesNotMatch(html, /<script src="apps\/archive-app\.js"><\/script>/);
  assert.match(mainSource, /styles\/archive-app\.css/);
  assert.match(mainSource, /apps\/archive-app\.js/);
  assert.match(mainSource, /system\/cinema-repository\.js/);
  assert.ok(mainSource.indexOf("system/cinema-repository.js") < mainSource.indexOf("system/cinema-store.js"), "Cinema Repository loads before the Store that consumes its Interface");
  assert.doesNotMatch(mainSource, /appEngine\.register\(window\.MercuryCreateArchiveDefinition\(\)\)/);

  console.log("app-loader: launch boundary and retry assertions passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
