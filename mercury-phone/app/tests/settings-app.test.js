"use strict";

const assert = require("node:assert/strict");
global.window = global;
require("../core/ai-transport.js");
require("../apps/settings-app.js");

const config = global.MercurySettingsConfig;
const normalized = config.normalizeConnection({ baseUrl: " https://api.example.com/v1/ ", apiKey: "secret", model: " custom-model ", stream: false, lastTest: "success" });
assert.equal(normalized.provider, "openai-compatible");
assert.equal(normalized.baseUrl, "https://api.example.com/v1/");
assert.equal(normalized.apiKey, "secret");
assert.equal(normalized.model, "custom-model");
assert.equal(normalized.stream, false);
assert.equal(normalized.lastTest, "success");
assert.equal(config.normalizeConnection(null).model, "gpt-4.1-mini");
assert.equal(config.normalizeConnection({ lastTest: "unknown" }).lastTest, "idle");
const definition = global.MercuryCreateSettingsDefinition();
assert.equal(definition.id, "settings");
assert.equal(definition.nameKey, "apps.settings");
assert.deepEqual(definition.capabilities, ["storage", "network"]);
assert.notEqual(definition.create(), definition.create());

class FakeElement {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.className = "";
    this.classList = { add: (...names) => { this.className = [this.className, ...names].filter(Boolean).join(" "); } };
    this.scrollTop = 0;
    this.hidden = false;
    this.textContent = "";
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
}

global.document = { createElement: (tag) => new FakeElement(tag) };
function findNode(node, predicate) {
  if (predicate(node)) return node;
  for (const child of node.children || []) {
    const match = findNode(child, predicate);
    if (match) return match;
  }
  return null;
}

const stored = new Map([["connection", { baseUrl: "https://old.example.com/v1", apiKey: "old-key", model: "gpt-4.1-mini", stream: true, lastTest: "error" }]]);
let sessionConnection = null;
let testConnectionImpl = async () => ({ ok: true, probe: { status: "success" } });
let dataSnapshotCalls = 0;
let backupCalls = 0;
const dataSnapshot = Object.freeze({
  status: "healthy",
  mode: "persistent",
  writable: true,
  usage: 4096,
  quota: 65536,
  persisted: false,
  backup: Object.freeze({ includedRecords: 7, includedBytes: 1024, excludedPresentRecords: 1 }),
  sources: Object.freeze([]),
  warnings: Object.freeze([]),
});
const settingsServices = {
  storage: { get: (key, fallback) => stored.get(key) ?? fallback, set: (key, value) => stored.set(key, value) },
  sessionCredentials: {
    get: () => sessionConnection,
    set: (value) => { sessionConnection = { ...value }; return sessionConnection; },
    clear: () => { sessionConnection = null; },
  },
  aiTransport: { testConnection: (options) => testConnectionImpl(options) },
  localData: {
    snapshot: async () => { dataSnapshotCalls += 1; return dataSnapshot; },
    createBackup: () => { backupCalls += 1; return { format: "mercury-phone-backup", version: 1, createdAt: "2026-08-19T12:00:00.000Z", datasets: [] }; },
  },
};
const root = new FakeElement("section");
const instance = definition.create();
instance.render(root, {
  i18n: { t: (key) => key },
  services: settingsServices,
});
assert.match(root.className, /settings-app/);
assert.equal(root.dataset.route, "home");
assert.equal(root.children.length, 2);
assert.equal(instance.connection.stream, false, "stored stream capability is normalized to the implemented transport");
assert.equal(stored.get("connection").stream, false, "normalized connection is persisted without a streaming capability");
const homeScroll = root.children[0];
const summary = homeScroll.children[1];
assert.equal(summary.tag, "section");
assert.equal(summary.getAttribute("aria-label"), "Mercury");
assert.equal(summary.listeners.has("click"), false);
assert.equal(summary.children.length, 2);
assert.equal(summary.children[1].children[1].textContent, "Here, quietly.");
const aiConnectionRow = findNode(root, (node) => node.textContent === "settings.rows.aiConnection")?.children?.length === 0
  ? findNode(root, (node) => node.children?.some((child) => child.textContent === "settings.rows.aiConnection"))
  : null;
assert.ok(aiConnectionRow);
aiConnectionRow.listeners.get("click")();
assert.equal(root.dataset.route, "ai-connection");
assert.ok(findNode(root, (node) => node.textContent === "settings.ai.providerName"));
assert.ok(findNode(root, (node) => node.textContent === "settings.ai.compatibilityNote"));
const streamSwitch = findNode(root, (node) => node.getAttribute?.("aria-label") === "settings.ai.nonStreaming");
assert.ok(streamSwitch);
assert.equal(streamSwitch.getAttribute("aria-checked"), "false");
assert.equal(streamSwitch.disabled, true, "streaming stays disabled until incremental transport is implemented");
const connectionForm = findNode(root, (node) => node.tag === "form");
assert.ok(connectionForm);
assert.equal(connectionForm.children.length, 4);
assert.ok(findNode(connectionForm, (node) => node.textContent === "settings.ai.defaultModel"));
assert.equal(findNode(root, (node) => String(node.className).includes("settings-test-result--idle")) !== null, true);
const baseUrlInput = findNode(connectionForm, (node) => node.name === "baseUrl");
const apiKeyInput = findNode(connectionForm, (node) => node.name === "apiKey");
const modelInput = findNode(connectionForm, (node) => node.name === "model");
assert.ok(baseUrlInput);
assert.ok(apiKeyInput);
assert.ok(modelInput);
assert.equal(apiKeyInput.value, "");
assert.equal(stored.get("connection").apiKey, "");
baseUrlInput.value = "https://api.example.com/v1";
apiKeyInput.value = "secret";
modelInput.value = "provider-model";
connectionForm.listeners.get("input")();
assert.equal(stored.get("connection").baseUrl, "https://api.example.com/v1");
assert.equal(stored.get("connection").model, "provider-model");
assert.equal(stored.get("connection").apiKey, "");
assert.equal(sessionConnection.apiKey, "secret", "non-durable API key remains available in the current tab session");
assert.equal(stored.get("connection").lastTest, "idle");
const rememberKeySwitch = findNode(connectionForm, (node) => node.getAttribute?.("aria-label") === "settings.ai.rememberKey");
assert.equal(rememberKeySwitch.getAttribute("aria-checked"), "false");
rememberKeySwitch.listeners.get("click")();
assert.equal(rememberKeySwitch.getAttribute("aria-checked"), "true");
assert.equal(stored.get("connection").apiKey, "secret");
rememberKeySwitch.listeners.get("click")();
assert.equal(stored.get("connection").apiKey, "");
assert.equal(apiKeyInput.value, "secret");
assert.equal(sessionConnection.apiKey, "secret", "turning off durable storage keeps the current session credential alive");
const sessionRoot = new FakeElement("section");
const sessionInstance = definition.create();
sessionInstance.render(sessionRoot, { i18n: { t: (key) => key }, services: settingsServices }, { route: "ai-connection" });
assert.equal(findNode(sessionRoot, (node) => node.name === "apiKey").value, "secret", "a remounted Settings app restores the session-only API key");
assert.equal(stored.get("connection").apiKey, "", "restoring the session key does not make it durable");
sessionInstance.onUnmount();
const revealButton = findNode(connectionForm, (node) => node.className === "settings-field__reveal");
assert.equal(revealButton.getAttribute("aria-pressed"), "false");
revealButton.listeners.get("click")();
assert.equal(apiKeyInput.type, "text");
assert.equal(revealButton.getAttribute("aria-pressed"), "true");
assert.equal(revealButton.children[0].src, "assets/icons/iconoir/eye-closed.svg");
assert.equal(revealButton.getAttribute("aria-label"), "settings.ai.hideKey");
revealButton.listeners.get("click")();
assert.equal(apiKeyInput.type, "password");
assert.equal(revealButton.children[0].src, "assets/icons/iconoir/eye.svg");
const backButton = findNode(root, (node) => node.className === "settings-back");
backButton.listeners.get("click")();
assert.equal(root.dataset.route, "home");
const usageRow = findNode(root, (node) => node.children?.some((child) => child.textContent === "settings.rows.usageCosts"));
assert.ok(usageRow);
usageRow.listeners.get("click")();
assert.equal(root.dataset.route, "usage-costs");
assert.ok(findNode(root, (node) => node.textContent === "settings.usage.emptyTitle"));
assert.ok(findNode(root, (node) => node.textContent === "settings.usage.truthNote"));
findNode(root, (node) => node.className === "settings-back").listeners.get("click")();
assert.equal(root.dataset.route, "home");
const dataRow = findNode(root, (node) => node.children?.some((child) => child.textContent === "settings.rows.dataPrivacy"));
assert.ok(dataRow, "Data & Privacy remains in the existing Settings information architecture");
dataRow.listeners.get("click")();
assert.equal(root.dataset.route, "data-privacy");
assert.ok(findNode(root, (node) => node.textContent === "settings.data.status.loading"));
findNode(root, (node) => node.className === "settings-back").listeners.get("click")();
assert.equal(root.dataset.route, "home");
findNode(root, (node) => node.children?.some((child) => child.textContent === "settings.rows.aiConnection")).listeners.get("click")();
assert.equal(root.dataset.route, "ai-connection");
const testButton = findNode(root, (node) => node.className === "settings-test-button");
(async () => {
  testConnectionImpl = async () => { throw Object.assign(new Error("The API key was rejected or lacks permission."), { code: "UPSTREAM_AUTH", retryable: false }); };
  await testButton.listeners.get("click")();
  const authResult = findNode(root, (node) => String(node.className).includes("settings-test-result--error"));
  assert.equal(authResult.textContent, "The API key was rejected or lacks permission.");
  assert.equal(instance.connection.lastTest, "error");

  testConnectionImpl = async () => { throw new Error("Local API request failed (502)."); };
  await testButton.listeners.get("click")();
  const invalidResult = findNode(root, (node) => String(node.className).includes("settings-test-result--error"));
  assert.equal(invalidResult.textContent, "Local API request failed (502).");

  testConnectionImpl = async () => { throw Object.assign(new Error("aborted"), { name: "AbortError" }); };
  await testButton.listeners.get("click")();
  const timeoutResult = findNode(root, (node) => String(node.className).includes("settings-test-result--error"));
  assert.equal(timeoutResult.textContent, "settings.ai.timeout");

  findNode(root, (node) => node.className === "settings-back").listeners.get("click")();
  findNode(root, (node) => node.children?.some((child) => child.textContent === "settings.rows.dataPrivacy")).listeners.get("click")();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(root.dataset.route, "data-privacy");
  assert.ok(findNode(root, (node) => node.textContent === "settings.data.status.healthy"));
  assert.ok(findNode(root, (node) => node.textContent === "4.0 KiB / 64.0 KiB"));
  const backupButton = findNode(root, (node) => node.textContent === "settings.data.download");
  assert.ok(backupButton);
  await backupButton.listeners.get("click")();
  assert.equal(backupCalls, 1, "the Settings action crosses the Local Data Vault Interface");
  assert.equal(dataSnapshotCalls, 1, "navigation reuses one diagnostic snapshot instead of probing on every paint");

  instance.onMount();
  assert.equal(root.dataset.lifecycle, "mounted");
  instance.onPause();
  assert.equal(root.dataset.lifecycle, "paused");
  instance.onResume();
  assert.equal(root.dataset.lifecycle, "resumed");
  instance.onUnmount();

  // Deep link: render with a payload opens straight into a secondary route.
  const deepRoot = new FakeElement("section");
  const deepInstance = definition.create();
  deepInstance.render(deepRoot, {
    i18n: { t: (key) => key },
    services: { storage: { get: (key, fallback) => stored.get(key) ?? fallback, set: (key, value) => stored.set(key, value) } },
  }, { route: "ai-connection" });
  assert.equal(deepRoot.dataset.route, "ai-connection");
  assert.ok(findNode(deepRoot, (node) => node.textContent === "settings.ai.providerName"));

  // Resuming with a deep-link payload switches route on an already-open instance.
  deepInstance.onPause();
  deepInstance.onResume(null, { route: "usage-costs" });
  assert.equal(deepRoot.dataset.route, "usage-costs");
  assert.ok(findNode(deepRoot, (node) => node.textContent === "settings.usage.emptyTitle"));

  // Invalid/unknown payload falls back to home.
  const fallbackRoot = new FakeElement("section");
  const fallbackInstance = definition.create();
  fallbackInstance.render(fallbackRoot, {
    i18n: { t: (key) => key },
    services: { storage: { get: (key, fallback) => stored.get(key) ?? fallback, set: (key, value) => stored.set(key, value) } },
  }, { route: "not-a-page" });
  assert.equal(fallbackRoot.dataset.route, "home");
  deepInstance.onUnmount();
  fallbackInstance.onUnmount();
  console.log("settings-app: 82 assertions passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
