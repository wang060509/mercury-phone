"use strict";

const assert = require("node:assert/strict");
global.window = global;
require("../core/resource-contracts.js");
require("../core/archive-contracts.js");
const archive = global.MercuryArchiveContracts;

const mixedText = JSON.stringify({
  name: "Neutral Character",
  personality: ["steady", "observant"],
  world: { name: "Neutral Setting", entries: [{ type: "place", title: "A quiet room", content: "A room with a window." }] },
  rules: "Respond with short paragraphs.",
  display: "<section data-kind='sample'>Do not render</section>",
});
const classified = archive.classifySourceText({ rawText: mixedText, filename: "neutral-source.json" });
assert.equal(classified.parseStatus, "parsed");
assert.equal(classified.assetType, "mixed-source");
assert.deepEqual(new Set(classified.detectedBlocks.map((block) => block.blockType)), new Set(["character", "world", "prompt-module", "format-extension"]));
assert.equal(classified.filename, "neutral-source.json");
assert.equal(classified.detectedBlocks.every((block) => block.preview.length <= 180), true);
assert.equal(classified.detectedBlocks.some((block) => block.preview.includes("<section")), false);

const invalid = archive.classifySourceText({ rawText: "<script>globalThis.didRun = true</script>", filename: "neutral.txt" });
assert.equal(invalid.parseStatus, "invalid-json");
assert.equal(invalid.detectedBlocks[0].blockType, "format-extension");
assert.equal(global.didRun, undefined);

const rawText = "{\n  \"name\": \"Keep exactly\",\n  \"rules\": \"<b>plain text</b>\"\n}";
const asset = archive.createSourceAsset({ rawText, filename: "neutral.json", mimeType: "application/json" });
assert.equal(asset.rawText, rawText);
assert.equal(asset.userConfirmed, false);
assert.equal(archive.normalizeArchiveState({ sourceAssets: [asset] }).sourceAssets[0].rawText, rawText);

const values = new Map();
const storage = { get: (key, fallback) => values.has(key) ? values.get(key) : fallback, set: (key, value) => values.set(key, value) };
const store = archive.createArchiveStore(storage);
const imported = store.confirmImport({ ...asset, detectedBlocks: asset.detectedBlocks.map((block) => ({ ...block, blockType: block.blockType === "character" ? "character" : block.blockType })) });
assert.equal(imported.sourceAsset.userConfirmed, true);
assert.equal(store.load().sourceAssets[0].rawText, rawText);
assert.equal(store.load().runtimeProfiles.length, 1);
const sourceBeforeProfileEdit = store.load().sourceAssets[0].rawText;
const profile = store.load().runtimeProfiles[0];
store.updateRuntimeProfile({ ...profile, summary: "Edited runtime only", status: "ready" });
assert.equal(store.load().sourceAssets[0].rawText, sourceBeforeProfileEdit);
const contact = store.createContactInstance(profile.id);
assert.equal(contact.runtimeProfileId, profile.id);
assert.equal(store.load().runtimeProfiles[0].summary, "Edited runtime only");
assert.equal(store.load().contactInstances.length, 1);
store.deleteCharacter(profile.id);
assert.equal(store.load().runtimeProfiles.length, 0);
assert.equal(store.load().contactInstances.length, 0);
assert.equal(store.load().sourceAssets.length, 1);

const repairWrites = [];
const repairValues = new Map();
const repairStorage = {
  get: (key, fallback) => repairValues.has(key) ? repairValues.get(key) : fallback,
  set: (key, value) => { repairWrites.push(key); repairValues.set(key, value); return value; },
};
const repairStore = archive.createArchiveStore(repairStorage);
const repairRaw = JSON.stringify({
  spec: "chara_card_v2",
  spec_version: "2.0",
  name: "Repair Owner",
  description: "```yaml\nCharacter:\n  identity:\n    - Archive owns this repair\n  personality:\n    default:\n      traits:\n        - Reserved\n</info>",
});
const repairAsset = archive.createSourceAsset({ id: "repair-source", filename: "repair.json", rawText: repairRaw, userConfirmed: true });
const repairProfile = archive.createRuntimeProfile({ sourceAssetId: repairAsset.id, displayName: "Repair Owner", data: { identity: "Imported character" } });
repairProfile.id = "repair-profile";
repairStore.save({ sourceAssets: [repairAsset], runtimeProfiles: [repairProfile] });
repairWrites.length = 0;
const repaired = repairStore.repairImportedRoleProfiles({ resourceContracts: global.MercuryResourceContracts, runtimeProfileIds: [repairProfile.id] });
assert.equal(repaired.changed, true);
assert.equal(repaired.repairs[0].profile.identity, "Archive owns this repair");
assert.deepEqual(repaired.repairs[0].profile.stableTraits, ["Reserved"]);
assert.deepEqual(repairWrites, [archive.STORAGE_KEY], "Archive Store owns the canonical repair write");
repairWrites.length = 0;
assert.equal(repairStore.repairImportedRoleProfiles({ resourceContracts: global.MercuryResourceContracts, runtimeProfileIds: [repairProfile.id] }).changed, false);
assert.deepEqual(repairWrites, [], "an idempotent repair does not rewrite Archive state");

const manualWorld = store.createManualWorld();
const entry = store.updateWorldEntry(manualWorld.id, { title: "Neutral place", type: "place", content: "Plain content." });
assert.equal(entry.title, "Neutral place");
assert.equal(store.load().worlds[0].entries.length, 1);
assert.equal(entry.enabled, true);
assert.equal(store.updateWorldEntry(manualWorld.id, { ...entry, enabled: false }).enabled, false);

const knowledgeBook = store.createManualWorld({
  name: "Expression notes",
  summary: "Voice and phrase reference.",
  foundations: ["Keep sentences short"],
  tags: ["voice", "reference"],
  coverKey: "quill",
  favorite: true,
  entries: [{ title: "Greeting", type: "rule", content: "Use a calm greeting." }],
});
assert.equal(knowledgeBook.resourceKind, "knowledge-book");
assert.equal(knowledgeBook.coverKey, "quill");
assert.deepEqual(knowledgeBook.tags, ["voice", "reference"]);
assert.equal(Boolean(knowledgeBook.createdAt), true);
const copiedKnowledgeBook = store.duplicateWorld(knowledgeBook.id);
assert.equal(copiedKnowledgeBook.name, "Expression notes copy");
assert.equal(copiedKnowledgeBook.sourceAssetId === knowledgeBook.sourceAssetId, false);
assert.equal(copiedKnowledgeBook.entries[0].id === knowledgeBook.entries[0].id, false);
assert.equal(copiedKnowledgeBook.favorite, false);
const changedKnowledgeBook = store.updateWorld({ ...knowledgeBook, summary: "Edited voice and phrase reference.", updatedAt: "2000-01-01T00:00:00.000Z" });
assert.equal(changedKnowledgeBook.updatedAt === "2000-01-01T00:00:00.000Z", false);
assert.equal(Boolean(store.touchWorld(knowledgeBook.id).lastOpenedAt), true);

const cinemaAu = archive.classifySourceText({ rawText: JSON.stringify({ resourceKind: "cinema-au", name: "Parallel script", entries: [{ title: "Scene" }] }), filename: "cinema-au.json" });
assert.equal(cinemaAu.detectedBlocks.some((block) => block.blockType === "world"), false);
assert.equal(cinemaAu.detectedBlocks.some((block) => block.blockType === "character"), false);

const promptModule = { id: "module-1", title: "Conversation rule", content: "Keep replies concise.", category: "behavior", scope: "conversation", enabled: false };
values.set(archive.STORAGE_KEY, archive.normalizeArchiveState({ ...store.load(), promptModules: [promptModule] }));
assert.equal(store.load().promptModules[0].enabled, false);
store.save({ ...store.load(), promptModules: [{ ...promptModule, enabled: true }] });
assert.equal(store.load().promptModules[0].enabled, false, "legacy prompt modules are preserved read-only");
assert.equal(typeof store.updatePromptModule, "undefined");

const brokenSet = { get: () => null, set: () => { throw new Error("Disk full"); } };
const brokenStore = archive.createArchiveStore(brokenSet);
try { brokenStore.save({}); assert.fail("Should have thrown"); } catch (err) {
  assert.equal(err.code, archive.ARCHIVE_STORAGE_WRITE_FAILED);
  assert.equal(err.message.includes("write"), true);
}
try { brokenStore.createManualCharacter(); assert.fail("Should have thrown"); } catch (err) {
  assert.equal(err.code, archive.ARCHIVE_STORAGE_WRITE_FAILED);
}

const expandedProfile = archive.createRuntimeProfile({
  data: {
    name: "Archive Detail",
    background: "A deliberate history.",
    relationshipSummary: "A slow trust arc.",
    openingMessage: "The room is quiet.",
    alternateGreetings: ["Another opening"],
    exampleDialogues: ["Example exchange"],
    scenePresentation: "Rain beyond the window.",
    creatorNotes: "Keep this private to the archive.",
    tags: ["calm", "watchful"],
  },
});
assert.equal(expandedProfile.background, "A deliberate history.");
assert.deepEqual(expandedProfile.alternateGreetings, ["Another opening"]);
assert.deepEqual(expandedProfile.tags, ["calm", "watchful"]);
const expandedExport = archive.serializeForExport(expandedProfile);
assert.equal(expandedExport.openingMessage, "The room is quiet.");
assert.deepEqual(expandedExport.exampleDialogues, ["Example exchange"]);

assert.equal(typeof store.createManualPreset, "undefined");
assert.equal(typeof archive.createManualPreset, "undefined");

console.log("archive-contracts: 57 assertions passed");
