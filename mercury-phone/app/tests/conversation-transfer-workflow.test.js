"use strict";

const assert = require("node:assert/strict");
global.window = global;
require("../core/chat-contracts.js");
require("../core/chat-experience-contracts.js");
require("../core/conversation-transfer-contracts.js");
require("../system/conversation-store.js");
const Workflow = require("../use-cases/conversation-transfer-workflow.js");

function memoryStorage(initial = {}, hooks = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    get(key, fallback) { hooks.get?.(key); return values.has(key) ? values.get(key) : fallback; },
    set(key, value) { hooks.set?.(key, value); values.set(key, value); return value; },
    remove(key) { hooks.remove?.(key); values.delete(key); },
  };
}

const chat = global.MercuryChatContracts;
const experienceContracts = global.MercuryChatExperienceContracts;
const transfer = global.MercuryConversationTransferContracts;
const sourceConversation = chat.migrateV1({
  schemaVersion: 1,
  id: "source:default",
  messages: [
    { id: "user-transfer", role: "user", content: "Keep this.", createdAt: "2026-08-19T03:00:00.000Z", delivery: "complete" },
    { id: "assistant-transfer", role: "assistant", content: "It will travel.", createdAt: "2026-08-19T03:00:01.000Z", delivery: "complete", generation: "complete" },
  ],
});
const portable = transfer.exportConversation({
  contact: { name: "Source" },
  exportedAt: "2026-08-19T03:10:00.000Z",
  conversation: sourceConversation,
  session: {
    settings: { timeFlow: "narrative", initiative: "high", relationshipPace: "slow", dramaticIntensity: "strong", unspokenAside: "often", contextScope: "deep", memoryHandling: "confirm", userPresetId: "preset-source" },
    resourceBindings: { runtimeProfileId: "role-source", worldVariantId: "variant-source", worldBookMode: "explicit", worldBookIds: ["world-ready", "world-missing"], presetId: "preset-source" },
    sceneContext: { id: "scene-source", title: "Imported scene", content: "The train has just stopped.", source: "local" },
  },
});
const stage = transfer.inspect(portable.text);

const currentExperience = experienceContracts.normalize(null);
currentExperience.contacts["contact-a"].runtimeProfileId = "role-target";
currentExperience.contacts["contact-a"].worldVariantId = "variant-target";
const existingConversation = chat.migrateV1({ schemaVersion: 1, id: "contact-a:default", messages: [{ id: "existing", role: "user", content: "Do not overwrite me.", createdAt: "2026-08-19T02:00:00.000Z" }] });
const conversationStorage = memoryStorage({
  "conversation.v1": existingConversation,
  "conversation.contact-a.imported-100-token.v1": sourceConversation,
});
const experienceStorage = memoryStorage({ [experienceContracts.STORAGE_KEY]: currentExperience });
const conversationStore = new global.MercuryConversationStore({ storage: conversationStorage });
const workflow = new Workflow({ conversationStorage, experienceStorage, conversationStore, now: () => 100, random: () => "token" });

assert.equal(workflow.inspect(portable.text).entryCount, 2, "workflow exposes the inspected transfer contract");
assert.equal(workflow.export({ contact: { name: "Source" }, conversation: sourceConversation, session: stage.session }).format, "portable", "workflow owns the export seam used by Chat");

const result = workflow.commit(stage, {
  contactId: "contact-a",
  experience: currentExperience,
  availableWorldBookIds: ["world-ready"],
  availablePresetIds: [],
});
assert.equal(result.timelineId, "imported-100-token-2", "a conflicting transfer id allocates a new timeline instead of overwriting");
assert.equal(result.conversation.id, "contact-a:imported-100-token-2");
assert.equal(result.conversation.entries.length, 2);
assert.equal(conversationStorage.values.get("conversation.v1").entries[0].id, "existing", "the active timeline remains unchanged");
assert.equal(conversationStorage.values.get("conversation.contact-a.imported-100-token-2.v1").entries[1].parts[0].text, "It will travel.");
assert.equal(experienceStorage.values.get(experienceContracts.STORAGE_KEY).conversations["contact-a:imported-100-token-2"].sceneContext.content, "The train has just stopped.", "the real private/shared storage split commits as one workflow");
const importedSession = result.experience.conversations["contact-a:imported-100-token-2"];
assert.equal(importedSession.settings.timeFlow, "narrative");
assert.equal(importedSession.settings.userPresetId, "preset-default", "an unavailable preset degrades to a working local default");
assert.equal(importedSession.resourceBindings.runtimeProfileId, "role-target", "the transcript is explicitly rebound to the selected local contact");
assert.equal(importedSession.resourceBindings.worldVariantId, "variant-target", "foreign memory scope is never adopted blindly");
assert.deepEqual(importedSession.resourceBindings.worldBookIds, ["world-ready"], "only locally available world resources are restored");
assert.equal(importedSession.sceneContext.content, "The train has just stopped.", "self-contained chat-local scene context remains portable");
assert.deepEqual(result.unresolvedBindings.worldBookIds, ["world-missing"]);
assert.equal(result.unresolvedBindings.presetId, "preset-source");
assert.equal(result.unresolvedBindings.runtimeProfileRebound, true);
assert.equal(importedSession.pinned, false, "local presentation and list state are not imported");

// A timeline can exist as shared session state before it has any transcript
// body (for example, a selected scene or a blank chat). Import allocation must
// treat that as occupied instead of overwriting its bindings.
const sessionOnlyExperience = experienceContracts.normalize(currentExperience);
sessionOnlyExperience.conversations["contact-a:imported-150-session"] = {
  settings: { ...experienceContracts.DEFAULT_CONVERSATION_SETTINGS },
  appearance: { ...experienceContracts.DEFAULT_APPEARANCE },
  resourceBindings: { ...experienceContracts.DEFAULT_RESOURCE_BINDINGS },
  sceneContext: { id: "scene-before-import", title: "Keep me", content: "Existing empty timeline state.", source: "local" },
  pinned: false,
  hidden: false,
  muted: false,
  unread: false,
  deleted: false,
};
const sessionOnlyConversationStorage = memoryStorage();
const sessionOnlyExperienceStorage = memoryStorage({ [experienceContracts.STORAGE_KEY]: sessionOnlyExperience });
const sessionOnlyStore = new global.MercuryConversationStore({ storage: sessionOnlyConversationStorage });
const sessionOnlyWorkflow = new Workflow({ conversationStorage: sessionOnlyConversationStorage, experienceStorage: sessionOnlyExperienceStorage, conversationStore: sessionOnlyStore, now: () => 150, random: () => "session" });
const sessionOnlyResult = sessionOnlyWorkflow.commit(stage, { contactId: "contact-a", experience: sessionOnlyExperience });
assert.equal(sessionOnlyResult.timelineId, "imported-150-session-2", "a session-only timeline is reserved even when no conversation body exists");
assert.equal(sessionOnlyExperienceStorage.values.get(experienceContracts.STORAGE_KEY).conversations["contact-a:imported-150-session"].sceneContext.id, "scene-before-import", "collision avoidance preserves the existing empty timeline state");

let failExperienceOnce = true;
const rollbackConversationStorage = memoryStorage();
const rollbackExperienceStorage = memoryStorage({ [experienceContracts.STORAGE_KEY]: currentExperience }, {
  set(key) {
    if (key === experienceContracts.STORAGE_KEY && failExperienceOnce) { failExperienceOnce = false; throw new Error("quota"); }
  },
});
const rollbackStore = new global.MercuryConversationStore({ storage: rollbackConversationStorage });
const rollbackWorkflow = new Workflow({ conversationStorage: rollbackConversationStorage, experienceStorage: rollbackExperienceStorage, conversationStore: rollbackStore, now: () => 200, random: () => "rollback" });
assert.throws(
  () => rollbackWorkflow.commit(stage, { contactId: "contact-a", experience: currentExperience }),
  (error) => error.code === "CONVERSATION_TRANSFER_COMMIT_FAILED",
);
assert.equal(rollbackConversationStorage.values.has("conversation.contact-a.imported-200-rollback.v1"), false, "a partially written transcript is removed when session persistence fails");
assert.deepEqual(rollbackExperienceStorage.values.get(experienceContracts.STORAGE_KEY), currentExperience, "failed import restores the previous experience state");

assert.throws(() => workflow.commit(stage, { contactId: "missing-contact" }), (error) => error.code === "CONVERSATION_TRANSFER_TARGET_MISSING");
assert.throws(() => workflow.commit({}, { contactId: "contact-a" }), (error) => error.code === "CONVERSATION_TRANSFER_INVALID_STAGE");

console.log("conversation-transfer-workflow: workflow assertions passed");
