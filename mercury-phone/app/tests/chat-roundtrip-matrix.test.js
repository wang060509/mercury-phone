"use strict";

const assert = require("node:assert/strict");
global.window = global;
require("../core/contracts.js");
require("../core/chat-contracts.js");
require("../core/chat-experience-contracts.js");
require("../core/conversation-transfer-contracts.js");
require("../core/resource-contracts.js");
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
require("../use-cases/resource-intake-workflow.js");
require("../use-cases/conversation-transfer-workflow.js");
require("../use-cases/chat-generation-workflow.js");
require("../apps/mercury-chat-app.js");

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.className = "";
    this.style = {};
    this.scrollHeight = 37;
    this.classList = { add: (name) => { this.className += ` ${name}`; } };
    this.listeners = {};
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(name, value) { this[name] = String(value); }
  addEventListener(name, callback) { this.listeners[name] = callback; }
}

global.document = { createElement: (tagName) => new FakeElement(tagName) };

function memoryStorage() {
  const values = new Map();
  return {
    values,
    get(key, fallback) { return values.has(key) ? values.get(key) : fallback; },
    set(key, value) { values.set(key, value); return value; },
    remove(key) { values.delete(key); },
  };
}

function assistant(id, text) {
  return {
    id,
    role: "assistant",
    parts: [{ id: `${id}:part`, text, order: 0, pauseAfter: "none", deliveryStatus: "delivered" }],
    status: "complete",
    createdAt: "2026-08-20T10:00:01.000Z",
    usage: null,
    unspokenAside: null,
    legacyMessageId: id,
  };
}

async function main() {
  const privateStorage = memoryStorage();
  const sharedStorage = memoryStorage();
  const capturedRequests = [];
  const aiTransport = {
    connectionStatus: () => ({ ready: true }),
    chat: async (request) => {
      capturedRequests.push(request);
      return { assistantTurn: assistant("matrix-assistant", "MATRIX_REPLY"), memoryCandidates: [], warnings: [] };
    },
  };
  const context = {
    state: {},
    i18n: { t: (key) => key },
    services: { storage: privateStorage, sharedStorage, aiTransport },
  };
  const app = global.MercuryCreateChatDefinition().create();
  app.render(new FakeElement("main"), context);

  const roleRaw = JSON.stringify({
    kind: "runtime-profile",
    displayName: "Matrix Keeper",
    identity: "MATRIX_ROLE_IDENTITY",
    stableTraits: ["MATRIX_ROLE_TRAIT"],
  });
  const role = app.importCharacterFromJson(roleRaw, { filename: "matrix-role.json" });
  assert.ok(role, "a role resource enters Chat through Resource Intake");
  assert.ok(role.runtimeProfileId, "the imported contact owns a durable runtime-profile binding");

  const worldRaw = JSON.stringify({
    name: "Matrix World",
    entries: [
      { comment: "Visible matrix fact", content: "MATRIX_WORLD_FACT", constant: true, enabled: true },
      { comment: "Disabled matrix fact", content: "MATRIX_DISABLED_WORLD_FACT", constant: true, enabled: false },
    ],
  });
  const worldStage = app.resourceIntake.inspect({ filename: "matrix-world.json", rawText: worldRaw });
  const worldResult = app.resourceIntake.commit(worldStage, { destination: "library" });
  assert.equal(worldResult.worlds.length, 1, "a standalone world resource enters the shared Archive without creating another contact");

  const profileRaw = JSON.stringify({ prompts: [{ role: "system", content: "MATRIX_PROFILE_RULE" }] });
  const profileStage = app.resourceIntake.inspect({ filename: "matrix-profile.json", rawText: profileRaw });
  const profileResult = app.resourceIntake.commit(profileStage, { destination: "library" });
  assert.ok(profileResult.profile?.id, "a Generation Profile enters its single shared Store through Resource Intake");

  app.openConversation(role.id, "default");
  app.setSessionWorldBookBindings([worldResult.worlds[0].id]);
  app.bindPresetToConversation(profileResult.profile.id);
  app.openConversation(role.id, "default");
  const assembled = app.buildAssistantRequest({ id: "matrix-preview", text: "Continue the matrix." }, [], "matrix-preview-request");
  assert.match(assembled.systemPrompt, /MATRIX_ROLE_IDENTITY/, "the imported role reaches the actual request prompt");
  assert.match(assembled.systemPrompt, /MATRIX_WORLD_FACT/, "the explicitly bound world reaches the actual request prompt");
  assert.doesNotMatch(assembled.systemPrompt, /MATRIX_DISABLED_WORLD_FACT/, "a disabled world entry remains outside the request");
  assert.match(assembled.systemPrompt, /MATRIX_PROFILE_RULE/, "the selected Generation Profile reaches the actual request prompt");
  assert.equal(app.currentResourceRuntimeTrace().binding.runtimeProfileId, role.runtimeProfileId, "the request trace identifies the imported role binding");
  assert.deepEqual(app.currentResourceRuntimeTrace().binding.worldBookIds, [worldResult.worlds[0].id], "the request trace identifies the explicit world binding");
  assert.equal(app.currentResourceRuntimeTrace().binding.presetId, profileResult.profile.id, "the request trace identifies the selected Generation Profile");

  const generation = app.generationWorkflow.start({
    kind: "send",
    userEntry: { id: "matrix-user", role: "user", text: "Continue the matrix.", createdAt: "2026-08-20T10:00:00.000Z", delivery: "queued", replyToId: null, quote: null },
  });
  assert.equal(generation.accepted, true, "the fully bound conversation passes generation admission");
  assert.equal(await generation.completion, true, "the assistant response completes through the generation workflow");
  assert.equal(capturedRequests.length, 1, "one user turn creates exactly one transport request");
  assert.match(capturedRequests[0].systemPrompt, /MATRIX_WORLD_FACT/, "the transport receives the same traced world context");
  assert.match(capturedRequests[0].systemPrompt, /MATRIX_PROFILE_RULE/, "the transport receives the same traced Generation Profile");
  const sourceKey = `conversation.${role.id}.v1`;
  assert.equal(privateStorage.values.get(sourceKey).entries.length, 2, "the completed user and assistant turns are durably saved in Chat-private storage");
  assert.equal(privateStorage.values.get(sourceKey).entries[0].delivery, "complete", "the queued user entry becomes complete only with the durable assistant reply");

  const portable = app.conversationTransfer.export(app.conversationTransferInput());
  const imported = app.importConversationFromJson(portable.text);
  assert.ok(imported, "the portable export returns through the same Chat import seam");
  assert.notEqual(imported.timelineId, "default", "re-import allocates a new independent timeline");
  assert.equal(imported.entryCount, 2, "the complete transcript survives the portable round trip");
  assert.deepEqual(imported.unresolvedBindings.worldBookIds, [], "a locally available world binding restores without degradation");
  assert.equal(imported.unresolvedBindings.presetId, null, "a locally available Generation Profile restores without degradation");
  const importedSession = imported.experience.conversations[`${role.id}:${imported.timelineId}`];
  assert.deepEqual(importedSession.resourceBindings.worldBookIds, [worldResult.worlds[0].id], "the imported timeline preserves its explicit world selection");
  assert.equal(importedSession.resourceBindings.presetId, profileResult.profile.id, "the imported timeline preserves its local Generation Profile selection");
  const importedRuntime = app.buildAssistantRequest({ id: "matrix-imported-preview", text: "Continue again." }, imported.conversation.entries, "matrix-imported-request");
  assert.match(importedRuntime.systemPrompt, /MATRIX_ROLE_IDENTITY/, "the re-imported timeline still resolves the local role");
  assert.match(importedRuntime.systemPrompt, /MATRIX_WORLD_FACT/, "the re-imported timeline still resolves the local world");
  assert.match(importedRuntime.systemPrompt, /MATRIX_PROFILE_RULE/, "the re-imported timeline still resolves the local Generation Profile");
  assert.equal(privateStorage.values.get(sourceKey).entries.length, 2, "round-trip import never mutates the source timeline");

  const reloaded = global.MercuryCreateChatDefinition().create();
  reloaded.render(new FakeElement("main"), { state: {}, i18n: { t: (key) => key }, services: { storage: privateStorage, sharedStorage } });
  reloaded.openConversation(role.id, imported.timelineId);
  assert.equal(reloaded.conversation.entries.length, 2, "a fresh app instance reloads the imported transcript");
  assert.deepEqual(reloaded.experienceFor(role.id, imported.timelineId).resourceBindings.worldBookIds, [worldResult.worlds[0].id], "reload preserves the imported world binding");
  assert.equal(reloaded.experienceFor(role.id, imported.timelineId).resourceBindings.presetId, profileResult.profile.id, "reload preserves the imported Generation Profile binding");
  const reloadedRuntime = reloaded.buildAssistantRequest({ id: "matrix-reload-preview", text: "Continue after reload." }, reloaded.conversation.entries, "matrix-reload-request");
  assert.match(reloadedRuntime.systemPrompt, /MATRIX_ROLE_IDENTITY/, "reload preserves role request assembly");
  assert.match(reloadedRuntime.systemPrompt, /MATRIX_WORLD_FACT/, "reload preserves world request assembly");
  assert.match(reloadedRuntime.systemPrompt, /MATRIX_PROFILE_RULE/, "reload preserves Generation Profile request assembly");

  console.log("chat-roundtrip-matrix: vertical closure assertions passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
