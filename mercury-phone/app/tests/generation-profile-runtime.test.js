"use strict";

const assert = require("node:assert/strict");
global.window = global;
require("../core/contracts.js");
require("../core/chat-contracts.js");
require("../core/chat-experience-contracts.js");
require("../core/runtime-core.js");
require("../core/worldbook-runtime.js");
require("../core/archive-contracts.js");
require("../core/relationship-records.js");
require("../core/preset-content.js");
require("../core/generation-profile-contracts.js");
require("../core/preset-assemble.js");
require("../system/generation-profile-store.js");
require("../apps/mercury-chat-data.js");
require("../system/conversation-store.js");
require("../use-cases/chat-generation-workflow.js");
require("../apps/mercury-chat-app.js");

class FakeElement {
  constructor(tagName) { this.tagName = tagName; this.children = []; this.dataset = {}; this.className = ""; this.style = {}; this.scrollHeight = 37; this.classList = { add: (name) => { this.className += ` ${name}`; } }; this.listeners = {}; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(name, value) { this[name] = String(value); }
  addEventListener(name, callback) { this.listeners[name] = callback; }
}
global.document = { createElement: (tagName) => new FakeElement(tagName) };

const gp = global.MercuryGenerationProfileContracts;
const values = new Map();
const writes = [];
const sharedStorage = {
  get(key, fallback) { return values.has(key) ? values.get(key) : fallback; },
  set(key, value) { writes.push(key); values.set(key, value); return value; },
};

values.set(gp.LEGACY_USER_PRESET_KEY, JSON.stringify([{
  id: "preset-runtime-legacy",
  name: "Legacy runtime preset",
  modules: { order: ["skeleton.preserve-role", "group.int.slow"], enabled: { "skeleton.preserve-role": true, "group.int.slow": true } },
  custom: { instructions: "Legacy selected Profile instruction." },
}]));
values.set(gp.ARCHIVE_STORAGE_KEY, {
  schemaVersion: 1,
  sourceAssets: [{ id: "asset-prompt", assetType: "prompt-source", filename: "legacy-prompt.json" }],
  runtimeProfiles: [],
  worlds: [],
  promptModules: [{ id: "module-global-old", sourceAssetId: "asset-prompt", title: "Old archive rule", content: "Legacy archive module instruction.", enabled: true, scope: "conversation", source: "imported" }],
  contactInstances: [],
});
values.set(global.MercuryChatExperienceContracts.STORAGE_KEY, {
  schemaVersion: 1,
  user: {},
  contacts: { "contact-a": global.MercuryChatExperienceContracts.DEFAULT_CONTACT },
  conversations: {
    "contact-a:default": {
      settings: { userPresetId: "preset-runtime-legacy" },
      resourceBindings: { presetId: "preset-runtime-legacy" },
    },
  },
});

const app = global.MercuryCreateChatDefinition().create();
app.render(new FakeElement("main"), { state: {}, i18n: { t: (key) => key }, services: { storage: sharedStorage, sharedStorage } });
app.ui.selectedContactId = "contact-a";
const selectedRuntime = app.buildRuntimeInput();
assert.equal(selectedRuntime.presetId, "preset-runtime-legacy");
assert.ok(selectedRuntime.compiledSystemText.includes("Legacy selected Profile instruction."));
assert.equal(selectedRuntime.compiledSystemText.includes("Legacy archive module instruction."), false, "legacy archive modules no longer form a parallel global runtime lane");
assert.deepEqual(Object.keys(selectedRuntime).sort(), ["appliedModuleIds", "compiledSystemText", "experienceSettings", "precedence", "presetId", "resourceTrace", "warnings"], "compileRuntime output protocol stays unchanged");
assert.deepEqual(selectedRuntime.appliedModuleIds, [], "Generation Profile instructions continue through the userPreset slot, not runtimeModules");

const migratedArchiveProfile = app.presetStore.listPersisted().find((profile) => profile.provenance?.sourceAssetId === "asset-prompt");
assert.ok(migratedArchiveProfile, "standalone legacy prompt source is available as a migrated Generation Profile");
const conversation = app.experienceFor("contact-a", "default");
conversation.settings.userPresetId = migratedArchiveProfile.id;
conversation.resourceBindings.presetId = migratedArchiveProfile.id;
const migratedRuntime = app.buildRuntimeInput();
assert.equal(migratedRuntime.presetId, migratedArchiveProfile.id);
assert.ok(migratedRuntime.compiledSystemText.includes("Legacy archive module instruction."), "migrated archive content becomes active only through explicit Profile selection");
assert.deepEqual(migratedRuntime.appliedModuleIds, []);
assert.equal(writes.includes(gp.STORAGE_KEY), true);
assert.equal(writes.includes(gp.LEGACY_USER_PRESET_KEY), false);

const overrideValues = new Map();
const overrideStorage = {
  get(key, fallback) { return overrideValues.has(key) ? overrideValues.get(key) : fallback; },
  set(key, value) { overrideValues.set(key, value); return value; },
};
overrideValues.set(gp.LEGACY_USER_PRESET_KEY, JSON.stringify([{
  id: "preset-default",
  name: "Former override",
  modules: { order: ["group.pro.initiative"], enabled: { "group.pro.initiative": true } },
  custom: { instructions: "Preserve the former default override." },
}]));
overrideValues.set(global.MercuryChatExperienceContracts.STORAGE_KEY, {
  schemaVersion: 1,
  user: {},
  contacts: { "contact-a": global.MercuryChatExperienceContracts.DEFAULT_CONTACT },
  conversations: { "contact-a:default": { settings: { userPresetId: "preset-default" }, resourceBindings: { presetId: "preset-default" } } },
});
const overrideApp = global.MercuryCreateChatDefinition().create();
overrideApp.render(new FakeElement("main"), { state: {}, i18n: { t: (key) => key }, services: { storage: overrideStorage, sharedStorage: overrideStorage } });
const overrideConversation = overrideApp.experienceFor("contact-a", "default");
assert.notEqual(overrideConversation.settings.userPresetId, "preset-default", "former user override receives a non-reserved Profile ID");
assert.equal(overrideConversation.resourceBindings.presetId, overrideConversation.settings.userPresetId, "both legacy session references are rewritten together");
const overrideRuntime = overrideApp.buildRuntimeInput();
assert.ok(overrideRuntime.compiledSystemText.includes("Preserve the former default override."), "ID remap preserves the former runtime behavior");
assert.equal(overrideApp.presetStore.get("preset-default").readOnly, true, "preset-default now always resolves to the code-owned read-only Profile");

console.log("generation-profile-runtime: assertions passed");
