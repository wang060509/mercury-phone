"use strict";

const assert = require("node:assert/strict");
global.window = global;
require("../core/chat-experience-contracts.js");
require("../core/resource-contracts.js");
require("../core/archive-contracts.js");
require("../core/generation-profile-contracts.js");
const MercuryGenerationProfileStore = require("../system/generation-profile-store.js");
const MercuryResourceIntakeWorkflow = require("../use-cases/resource-intake-workflow.js");

function memoryStorage() {
  const values = new Map();
  return {
    values,
    get: (key, fallback = null) => values.has(key) ? values.get(key) : fallback,
    set: (key, value) => { values.set(key, value); return value; },
    remove: (key) => values.delete(key),
  };
}

function workflowFor(storage, options = {}) {
  const archiveStore = global.MercuryArchiveContracts.createArchiveStore(storage);
  const profileStore = new MercuryGenerationProfileStore({ storage, now: 1000 });
  return new MercuryResourceIntakeWorkflow({
    storage,
    archiveStore,
    profileStore,
    now: options.now || (() => 1000),
    random: options.random || (() => "fixed"),
  });
}

const storage = memoryStorage();
const workflow = workflowFor(storage);
const roleRaw = JSON.stringify({
  spec: "chara_card_v2",
  spec_version: "2.0",
  name: "Harbor Keeper",
  description: "Keeps the harbor archive.",
  data: {
    name: "Harbor Keeper",
    description: "Keeps the harbor archive.",
    character_book: {
      name: "Harbor Notes",
      entries: [{ id: "pier", keys: ["pier"], comment: "Pier", content: "The last ferry leaves at dusk.", constant: true }],
    },
  },
});
const stage = workflow.inspect({ filename: "keeper.json", mimeType: "application/json", rawText: roleRaw, fileSize: roleRaw.length });
assert.equal(stage.report.ok, true);
assert.equal(stage.report.resourceKind, "roleCard");
assert.equal(stage.sourceAsset.userConfirmed, false);

const committed = workflow.commit(stage, {
  destination: MercuryResourceIntakeWorkflow.DESTINATIONS.CHAT,
  contactDefaults: { avatar: "fallback.png", profileBackground: "background.png" },
});
assert.equal(committed.resourceKind, "roleCard");
assert.equal(committed.runtimeProfiles.length, 1);
assert.equal(committed.worlds.length, 1);
assert.equal(committed.sourceAsset.userConfirmed, true);
assert.equal(committed.contact.name, "Harbor Keeper");
assert.equal(committed.contact.runtimeProfileId, committed.runtimeProfiles[0].id);
assert.deepEqual(committed.contact.worldBookIds, [committed.worlds[0].id]);
assert.equal(committed.contact.persona.worldBindings.includes(committed.worlds[0].id), true);
assert.deepEqual(committed.outcome, {
  status: "committed",
  destination: "chat",
  resourceKind: "roleCard",
  sourceAssetId: committed.sourceAsset.id,
  filename: "keeper.json",
  contactId: committed.contact.id,
  runtimeProfileIds: [committed.runtimeProfiles[0].id],
  worldIds: [committed.worlds[0].id],
  generationProfileIds: [],
  displayName: "Harbor Keeper",
  sameNameContactCount: 1,
}, "commit returns a stable Mercury-owned outcome for visible success handling");
const archiveState = global.MercuryArchiveContracts.normalizeArchiveState(storage.get(global.MercuryArchiveContracts.STORAGE_KEY));
assert.equal(archiveState.sourceAssets.length, 1);
assert.equal(archiveState.contactInstances[0].chatContactId, committed.contact.id);
assert.equal(archiveState.worlds[0].relatedProfileIds.includes(committed.runtimeProfiles[0].id), true);
const chatState = global.MercuryChatExperienceContracts.normalize(storage.get(global.MercuryChatExperienceContracts.STORAGE_KEY));
assert.equal(chatState.contacts[committed.contact.id].runtimeProfileId, committed.runtimeProfiles[0].id);

const duplicate = workflow.commit(workflow.inspect({ filename: "keeper-copy.json", rawText: roleRaw }), {
  destination: MercuryResourceIntakeWorkflow.DESTINATIONS.CHAT,
});
assert.notEqual(duplicate.runtimeProfiles[0].id, committed.runtimeProfiles[0].id, "duplicate role imports allocate a new durable profile id");
assert.notEqual(duplicate.worlds[0].id, committed.worlds[0].id, "embedded worlds remain isolated on duplicate imports");
assert.notEqual(duplicate.contact.id, committed.contact.id, "duplicate role imports allocate a new contact id");
assert.equal(duplicate.outcome.filename, "keeper-copy.json", "duplicate outcomes keep the committed source asset filename");
assert.equal(duplicate.outcome.sameNameContactCount, 2, "duplicate outcomes expose the resulting same-name contact count");

const worldStorage = memoryStorage();
const worldWorkflow = workflowFor(worldStorage);
const worldStage = worldWorkflow.inspect({ filename: "harbor.json", rawText: JSON.stringify({ entries: [{ comment: "Pier", content: "Ferries leave at dusk.", key: ["ferry"] }] }) });
const worldCommit = worldWorkflow.commit(worldStage, { destination: "library" });
assert.equal(worldCommit.resourceKind, "worldBook");
assert.equal(worldCommit.worlds.length, 1);
assert.equal(worldCommit.contact, null);
assert.equal(worldStorage.values.has(global.MercuryChatExperienceContracts.STORAGE_KEY), false, "library import does not create chat state");

const presetStorage = memoryStorage();
const presetWorkflow = workflowFor(presetStorage);
const presetStage = presetWorkflow.inspect({ filename: "quiet.json", rawText: JSON.stringify({ prompts: [{ role: "system", content: "Keep the scene quiet." }] }) });
const presetCommit = presetWorkflow.commit(presetStage);
assert.equal(presetCommit.resourceKind, "preset");
assert.equal(presetCommit.profile.origin, "imported");
assert.equal(presetStorage.get(global.MercuryGenerationProfileContracts.STORAGE_KEY).profiles.length, 1);
assert.equal(presetCommit.outcome.contactId, null, "library-only outcomes never imply a Chat contact");

const unsupported = worldWorkflow.inspect({ filename: "shopping.json", rawText: JSON.stringify({ shopping: ["tea"] }) });
assert.throws(() => worldWorkflow.commit(unsupported, { destination: "chat" }), (error) => error.code === "RESOURCE_INTAKE_CHAT_REQUIRES_ROLE");
assert.throws(() => worldWorkflow.commit(unsupported, { destination: "library" }), (error) => error.code === "RESOURCE_INTAKE_UNSUPPORTED_RESOURCE");

// The Archive write succeeds, then Chat persistence fails. The workflow must
// restore every captured key so callers never observe a half-imported role.
const rollbackStorage = memoryStorage();
const rollbackWorkflow = workflowFor(rollbackStorage);
const archiveBefore = cloneValue(rollbackStorage.get(global.MercuryArchiveContracts.STORAGE_KEY, null));
const chatBefore = cloneValue(rollbackStorage.get(global.MercuryChatExperienceContracts.STORAGE_KEY, null));
const originalSet = rollbackStorage.set;
let failChatOnce = true;
rollbackStorage.set = (key, value) => {
  if (key === global.MercuryChatExperienceContracts.STORAGE_KEY && failChatOnce) {
    failChatOnce = false;
    throw new Error("Quota exceeded");
  }
  return originalSet(key, value);
};
const rollbackStage = rollbackWorkflow.inspect({ filename: "rollback.json", rawText: roleRaw });
assert.throws(() => rollbackWorkflow.commit(rollbackStage, { destination: "chat" }), (error) => error.code === "RESOURCE_INTAKE_COMMIT_FAILED");
assert.deepEqual(rollbackStorage.get(global.MercuryArchiveContracts.STORAGE_KEY, null), archiveBefore, "archive state rolls back after chat persistence fails");
assert.deepEqual(rollbackStorage.get(global.MercuryChatExperienceContracts.STORAGE_KEY, null), chatBefore, "chat state remains unchanged after failed import");
const retried = rollbackWorkflow.commit(rollbackStage, { destination: "chat" });
assert.equal(retried.contact.name, "Harbor Keeper", "the same inspected resource can be retried after storage recovers");

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

console.log("resource-intake-workflow: 35 assertions passed");
