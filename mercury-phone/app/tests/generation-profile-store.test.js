"use strict";

const assert = require("node:assert/strict");
global.window = global;
require("../core/preset-content.js");
require("../core/generation-profile-contracts.js");
require("../core/preset-assemble.js");
require("../system/generation-profile-store.js");
require("../system/system-services.js");

const contracts = global.MercuryGenerationProfileContracts;
const Store = global.MercuryGenerationProfileStore;
const assemble = global.MercuryPresetAssemble.assemblePresetInstructions;

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  const writes = [];
  return {
    values,
    writes,
    get(key, fallback) { return values.has(key) ? values.get(key) : fallback; },
    set(key, value) { writes.push(key); values.set(key, value); return value; },
  };
}

const legacyPresets = [
  {
    id: "preset-custom",
    name: "Custom pace",
    modules: {
      order: ["skeleton.preserve-role", "group.int.slow", "compat.block.primary", "compat.block.deferred"],
      enabled: { "skeleton.preserve-role": true, "group.int.slow": true, "compat.block.primary": true, "compat.block.deferred": false },
      texts: { "compat.block.primary": "Keep the reply concise.", "compat.block.deferred": "Preserve this assistant block." },
    },
    preferences: { address: "Mercury" },
    custom: { instructions: "Keep the ending open." },
    compatibility: {
      format: "external-chat-preset",
      blocks: [
        { id: "primary", name: "Primary", runtimeActive: true },
        { id: "deferred", name: "Deferred", runtimeActive: false },
      ],
      rawSource: { future: { keep: true } },
    },
    createdAt: 100,
  },
  {
    id: "preset-default",
    name: "User-overridden default",
    modules: { order: ["group.pro.initiative"], enabled: { "group.pro.initiative": true } },
    custom: { instructions: "This user object used to shadow the built-in." },
  },
];

const archiveState = {
  sourceAssets: [
    { id: "asset-standalone", assetType: "prompt-source", filename: "standalone.json" },
    { id: "asset-mixed", assetType: "mixed-source", filename: "mixed.json" },
  ],
  runtimeProfiles: [{ id: "role-1", sourceAssetId: "asset-mixed" }],
  worlds: [],
  promptModules: [
    { id: "module-a", sourceAssetId: "asset-standalone", title: "Standalone A", content: "Standalone instruction A.", enabled: true, scope: "conversation", source: "imported" },
    { id: "module-b", sourceAssetId: "asset-standalone", title: "Standalone B", content: "Standalone instruction B.", enabled: false, scope: "conversation", source: "imported" },
    { id: "module-mixed", sourceAssetId: "asset-mixed", title: "Mixed rule", content: "Mixed-source instruction.", enabled: true, scope: "conversation", source: "imported" },
    { id: "module-orphan", sourceAssetId: "", title: "Orphan rule", content: "Orphan instruction.", enabled: false, scope: "global", source: "imported" },
  ],
};

const migrated = contracts.migrateLegacySources({ legacyUserPresets: JSON.stringify(legacyPresets), archiveState, now: 500 });
assert.equal(migrated.schemaVersion, 1);
assert.equal(migrated.profiles.length, 4, "two legacy presets, one standalone source Profile, and one aggregate migration Profile are created");
assert.equal(migrated.migration.sources.archivePromptModules.inputCount, 4);
assert.equal(Object.keys(migrated.migration.remappedIds)[0], "preset-default");
assert.notEqual(migrated.migration.remappedIds["preset-default"], "preset-default");

const standalone = migrated.profiles.find((profile) => profile.provenance?.sourceAssetId === "asset-standalone");
assert.ok(standalone, "standalone prompt source becomes a Generation Profile");
assert.equal(standalone.instructionBlocks.length, 2, "multiple modules from one standalone source stay inside one Profile");
assert.deepEqual(standalone.instructionBlocks.map((block) => block.id), ["module-a", "module-b"]);

const aggregate = migrated.profiles.find((profile) => profile.name === "迁移指令");
assert.ok(aggregate, "mixed and ambiguous modules share one migration Profile");
assert.deepEqual(aggregate.instructionBlocks.map((block) => block.id), ["module-mixed", "module-orphan"]);
assert.equal(aggregate.instructionBlocks.find((block) => block.id === "module-orphan").runtimeEligible, false, "legacy global scope that was not injected remains inactive");
assert.ok(migrated.migration.warnings.some((warning) => warning.code === "legacy_archive_blocks_require_profile_selection"), "active archive modules are preserved but require explicit Profile selection");

const custom = migrated.profiles.find((profile) => profile.id === "preset-custom");
assert.ok(custom);
assert.deepEqual(custom.modules.order, ["skeleton.preserve-role", "group.int.slow"]);
assert.equal(custom.instructionBlocks.length, 3, "two carried blocks and custom instructions become Instruction Blocks");
assert.equal(custom.instructionBlocks.find((block) => block.legacyModuleId === "compat.block.primary").runtimeEligible, true);
assert.equal(custom.instructionBlocks.find((block) => block.legacyModuleId === "compat.block.deferred").runtimeEligible, false);
const customText = assemble(custom);
assert.ok(customText.includes("Keep the reply concise."));
assert.ok(customText.includes("Keep the ending open."));
assert.equal(customText.includes("Preserve this assistant block."), false);

const storage = memoryStorage({
  [contracts.LEGACY_USER_PRESET_KEY]: JSON.stringify(legacyPresets),
  [contracts.ARCHIVE_STORAGE_KEY]: archiveState,
});
const store = new Store({ storage, now: 500 });
assert.deepEqual(storage.writes, [contracts.STORAGE_KEY], "migration writes only the new shared key");
assert.equal(storage.values.get(contracts.LEGACY_USER_PRESET_KEY), JSON.stringify(legacyPresets), "legacy UserPreset source stays untouched");
assert.equal(storage.values.get(contracts.ARCHIVE_STORAGE_KEY), archiveState, "archive migration source stays untouched");
assert.equal(store.list()[0].id, "preset-default");
assert.equal(store.list()[0].readOnly, true);
assert.equal(store.listPersisted().some((profile) => profile.id === "preset-default"), false, "built-ins never enter persisted profiles");
assert.equal(store.get("missing"), null, "unknown IDs do not silently masquerade as the default");
assert.throws(() => store.add({ ...store.defaultProfile }), /read-only/);
assert.equal(store.remove("preset-default"), false);

const remixed = store.remix("preset-default", { id: "profile-default-remix", name: "Default Remix" });
assert.equal(remixed.id, "profile-default-remix");
assert.equal(remixed.readOnly, false);
assert.equal(remixed.remixOf, "preset-default");
assert.equal(storage.writes.includes(contracts.LEGACY_USER_PRESET_KEY), false, "CRUD never writes the old Chat key");

const beforeReloadCount = store.listPersisted().length;
const reloaded = new Store({ storage, now: 900 });
assert.equal(reloaded.listPersisted().length, beforeReloadCount, "existing generation-profiles.v1 prevents duplicate migration");
assert.equal(storage.writes.filter((key) => key === contracts.STORAGE_KEY).length, 2, "only migration and explicit Remix wrote the canonical store");

const withCover = reloaded.add({
  id: "profile-cover",
  name: "Cover",
  origin: "user",
  modules: { order: ["group.int.balanced"], enabled: { "group.int.balanced": true } },
  cover: { kind: "data-url", value: "data:image/png;base64,AA==" },
});
assert.equal(withCover.cover.value, "data:image/png;base64,AA==");
assert.equal(assemble(withCover).includes("data:image"), false, "cover assets never enter runtime instructions");

const firstImport = reloaded.importProfile({ id: "profile-import-collision", name: "First import", modules: { order: [], enabled: {} } });
const secondImport = reloaded.importProfile({ id: "profile-import-collision", name: "Second import", modules: { order: [], enabled: {} } });
assert.equal(firstImport.id, "profile-import-collision", "the first imported profile keeps its requested identity");
assert.equal(secondImport.id, "profile-import-collision-2", "a repeated import receives a new identity instead of overwriting data");
assert.equal(reloaded.get(firstImport.id).name, "First import", "the earlier imported profile remains intact after a collision");
const reservedImport = reloaded.importProfile({ id: "preset-default", name: "External default", modules: { order: [], enabled: {} } });
assert.notEqual(reservedImport.id, "preset-default", "an imported resource cannot replace the built-in Profile");

const upgradeStorage = memoryStorage({
  [contracts.STORAGE_KEY]: {
    schemaVersion: 1,
    profiles: [{
      id: "profile-old-relative",
      name: "Old relative import",
      origin: "imported",
      modules: { order: [], enabled: {} },
      instructionBlocks: [{ id: "block-relative", title: "Relative", content: "A relative system instruction.", enabled: false, runtimeEligible: false, legacyModuleId: "compat.block.relative" }],
      compatibility: {
        format: "external-chat-preset",
        blocks: [{ id: "relative", name: "Relative", content: "A relative system instruction.", enabled: true, role: "system", injection: { position: 0, depth: 4, order: 0 }, runtimeActive: false }],
        runtime: { activeCount: 0, preservedCount: 1 },
      },
    }],
    migration: null,
  },
});
const upgradedStore = new Store({ storage: upgradeStorage, now: 500 });
const upgradedProfile = upgradedStore.get("profile-old-relative");
assert.equal(upgradedProfile.compatibility.adapterRevision, contracts.COMPATIBILITY_ADAPTER_REVISION, "stored external Profiles receive the current compatibility revision");
assert.equal(upgradedProfile.compatibility.runtime.activeCount, 1, "stored relative system blocks are reclassified without reimporting the file");
assert.equal(upgradedProfile.instructionBlocks[0].enabled, true, "stored Instruction Block state is realigned to the preserved source setting");
assert.equal(upgradedProfile.instructionBlocks[0].runtimeEligible, true, "stored Instruction Block eligibility follows the upgraded relative-position rule");
assert.deepEqual(upgradeStorage.writes, [contracts.STORAGE_KEY], "the compatibility upgrade is persisted once to the canonical Store");

const failingValues = new Map([
  [contracts.LEGACY_USER_PRESET_KEY, JSON.stringify([legacyPresets[0]])],
  [contracts.ARCHIVE_STORAGE_KEY, archiveState],
]);
const failing = new Store({
  storage: {
    get(key, fallback) { return failingValues.has(key) ? failingValues.get(key) : fallback; },
    set() { throw new Error("Disk full"); },
  },
  now: 500,
});
assert.equal(failing.migratedInMemory, true);
assert.ok(failing.lastWriteError);
assert.ok(failing.get("preset-custom"), "failed persistence still provides the in-memory migration to Runtime");
assert.equal(failingValues.has(contracts.STORAGE_KEY), false);

class RawStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  key(index) { return [...this.values.keys()][index] ?? null; }
  get length() { return this.values.size; }
}
const rawBackend = new RawStorage();
const servicesHub = new global.MercurySystemServices({ storage: rawBackend });
const legacyChatStorage = servicesHub.createAppServices("mercury-chat").storage;
const archiveSharedStorage = servicesHub.createAppServices("archive").sharedStorage;
legacyChatStorage.set(contracts.LEGACY_USER_PRESET_KEY, JSON.stringify([legacyPresets[0]]));
const integrated = new Store({ storage: archiveSharedStorage, now: 500 });
assert.ok(integrated.get("preset-custom"), "real app/private-to-shared serialization shape migrates correctly");
assert.ok(rawBackend.getItem("mercury.app.shared.generation-profiles.v1"), "canonical shared physical key is written");
assert.ok(rawBackend.getItem("mercury.app.mercury-chat.mercury.apps.chats.userPresets"), "legacy physical key remains untouched");
assert.equal(rawBackend.getItem("mercury.app.shared.mercury.apps.chats.userPresets"), null);

console.log("generation-profile-store: assertions passed");
