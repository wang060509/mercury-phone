"use strict";

const assert = require("node:assert/strict");
global.window = global;
require("../system/local-data-vault.js");
require("../system/system-services.js");

class FakeStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  key(index) { return [...this.values.keys()][index] ?? null; }
  get length() { return this.values.size; }
}

const events = [];
const hub = new global.MercurySystemServices({ storage: new FakeStorage() });
hub.subscribe((event) => events.push(event));
const chat = hub.createAppServices("mercury-chat");
const settings = hub.createAppServices("settings");

assert.equal(chat.sessionCredentials, null, "session credentials are not exposed through the Chat app facade");
assert.ok(settings.sessionCredentials, "Settings receives the session credential facade");
assert.equal(chat.localData, null, "local data governance is not exposed through the Chat facade");
assert.equal(typeof settings.localData.snapshot, "function", "Settings receives the local data diagnostic Interface");
assert.equal(typeof settings.localData.createBackup, "function", "Settings receives the local backup Interface");
assert.equal(hub.storageMode, "persistent");
settings.sessionCredentials.set({ baseUrl: "https://api.example.test/v1", apiKey: "session-key", model: "session-model" });
assert.deepEqual(settings.sessionCredentials.get(), { provider: "openai-compatible", baseUrl: "https://api.example.test/v1", apiKey: "session-key", model: "session-model" });
assert.equal(hub.storageBackend.getItem("mercury.app.settings.connection"), null, "session credentials do not enter durable app storage");
settings.sessionCredentials.clear();
assert.equal(settings.sessionCredentials.get(), null, "session credentials can be cleared independently");

chat.storage.set("draft", { text: "hello" });
settings.storage.set("draft", { text: "settings" });
assert.deepEqual(chat.storage.get("draft"), { text: "hello" });
assert.deepEqual(settings.storage.get("draft"), { text: "settings" });
assert.equal(chat.storage.get("missing", "fallback"), "fallback");

chat.sharedStorage.set("archive.v1", { runtimeProfiles: [{ id: "profile-1" }] });
assert.deepEqual(settings.sharedStorage.get("archive.v1"), { runtimeProfiles: [{ id: "profile-1" }] }, "shared storage crosses app boundaries explicitly");
assert.equal(settings.sharedStorage.get("missing", "fallback"), "fallback");

const legacyBackend = new FakeStorage();
const legacyHub = new global.MercurySystemServices({ storage: legacyBackend });
const legacyChat = legacyHub.createAppServices("mercury-chat");
const legacyArchive = legacyHub.createAppServices("archive");
const legacyPresetText = JSON.stringify([{ id: "preset-old" }]);
legacyChat.storage.set("mercury.apps.chats.userPresets", legacyPresetText);
assert.equal(legacyArchive.sharedStorage.get("mercury.apps.chats.userPresets"), legacyPresetText, "Generation Profile migration can read the former Chat-private preset value");
assert.equal(legacyBackend.getItem("mercury.app.shared.mercury.apps.chats.userPresets"), null, "legacy read-through does not create or write a shared legacy key");

assert.equal(chat.storage.clear(), 1);
assert.equal(chat.storage.get("draft"), null);
assert.deepEqual(settings.storage.get("draft"), { text: "settings" });

const notification = chat.notify({ title: "Lumi", body: "Here, quietly." });
assert.equal(notification.appId, "mercury-chat");
assert.match(notification.id, /^mercury-chat:notification:/);
assert.throws(() => chat.notify({ body: "missing title" }), /require a title/);

assert.equal(settings.theme.request("dark"), "dark");
assert.equal(chat.theme.get(), "dark");
assert.throws(() => chat.theme.request("pink"), /Unsupported theme/);

const activity = chat.dynamicIsland.set({ title: "Lumi", detail: "typing" });
assert.equal(activity.appId, "mercury-chat");
assert.equal(hub.getActivity("mercury-chat").detail, "typing");
assert.equal(chat.dynamicIsland.clear(), true);
assert.equal(hub.getActivity("mercury-chat"), null);
assert.equal(settings.dynamicIsland.clear(), false);

assert.equal(events.filter((event) => event.type === "notification:requested").length, 1);
assert.equal(events.filter((event) => event.type === "theme:requested").length, 1);
assert.equal(events.filter((event) => event.type.startsWith("island:")).length, 2);
assert.throws(() => hub.createAppServices("bad app id"), /Invalid app id/);
assert.throws(() => chat.storage.set("bad key!", 1), /Invalid storage key/);
assert.throws(() => chat.storage.set("undefined", undefined), /cannot persist undefined/);

const priorityHub = new global.MercurySystemServices({ storage: new FakeStorage() });
const lowPriority = priorityHub.createAppServices("mercury-chat").dynamicIsland.set({ title: "Contact A", priority: 10 });
const highPriority = priorityHub.createAppServices("timer").dynamicIsland.set({ title: "Timer", priority: 30 });
assert.equal(priorityHub.listActivities().length, 2);
assert.equal(priorityHub.getPreferredActivity(), highPriority);
priorityHub.createAppServices("timer").dynamicIsland.clear();
assert.equal(priorityHub.getPreferredActivity(), lowPriority);
const newest = priorityHub.createAppServices("music").dynamicIsland.set({ title: "Music", priority: 10 });
assert.equal(priorityHub.getPreferredActivity(), newest);
assert.ok(newest.sequence > lowPriority.sequence);

// launchApp bridge: delegates to the injected launcher and emits a request event.
const launchCalls = [];
const launchEvents = [];
const bridgeHub = new global.MercurySystemServices({
  storage: new FakeStorage(),
  launchBridge: (targetAppId, route) => { launchCalls.push({ targetAppId, route }); return targetAppId === "archive"; },
});
bridgeHub.subscribe((event) => launchEvents.push(event));
const chatServices = bridgeHub.createAppServices("mercury-chat");
assert.equal(chatServices.launchApp("archive", "home"), true);
assert.deepEqual(launchCalls, [{ targetAppId: "archive", route: "home" }]);
assert.equal(typeof chatServices.launchBridge, "undefined"); // bridge is not exposed on the app facade
assert.equal(chatServices.launchApp("settings", "ai-connection"), false);
assert.equal(launchCalls.length, 2);
assert.equal(launchCalls[1].targetAppId, "settings");
assert.equal(launchCalls[1].route, "ai-connection");
assert.equal(launchEvents.some((event) => event.type === "launch:requested" && event.targetAppId === "settings" && event.route === "ai-connection" && event.fromAppId === "mercury-chat"), true);

// Without a bridge installed, launchApp is a safe no-op.
const bareHub = new global.MercurySystemServices({ storage: new FakeStorage() });
assert.equal(bareHub.createAppServices("mercury-chat").launchApp("archive"), false);
assert.throws(() => bareHub.createAppServices("mercury-chat").launchApp("bad app id"), /Invalid app id/);

const volatileHub = new global.MercurySystemServices({ storage: new FakeStorage(), storageMode: "volatile", storageModeReason: "SecurityError" });
assert.equal(volatileHub.storageMode, "volatile", "the in-memory fallback mode remains explicit");
assert.equal(volatileHub.localDataVault.modeReason, "SecurityError");

console.log("system-services: local data facade assertions passed");
