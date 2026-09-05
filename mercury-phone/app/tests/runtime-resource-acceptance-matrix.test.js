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
require("../core/vector-memory-contracts.js");
require("../core/preset-content.js");
require("../core/generation-profile-contracts.js");
require("../core/preset-assemble.js");
require("../system/generation-profile-store.js");
require("../apps/mercury-chat-data.js");
require("../system/conversation-store.js");
require("../use-cases/chat-generation-workflow.js");
require("../apps/mercury-chat-app.js");

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.className = "";
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

const limits = global.MercuryChatContracts.RUNTIME_RESOURCE_LIMITS;
assert.equal(limits.roleProfileCharacters, 12000, "the role profile has a stable runtime admission budget");
assert.equal(limits.generationProfileCharacters, 16000, "the Generation Profile budget accommodates audited mature-profile sizes while remaining bounded");
assert.equal(limits.eventMemoryCharacters, 560, "event memory keeps the existing bounded runtime budget");

const archive = global.MercuryArchiveContracts;
const profile = archive.createRuntimeProfile({
  displayName: "Matrix Navigator",
  data: {
    identity: "ROLE_ACTIVE_IDENTITY",
    stableTraits: ["ROLE_ACTIVE_TRAIT"],
    voiceStyle: "ROLE_ACTIVE_VOICE",
    background: `ROLE_BACKGROUND_START ${"B".repeat(limits.roleProfileCharacters + 1200)} ROLE_BACKGROUND_TAIL`,
  },
});
profile.status = "ready";

const world = archive.createWorldProfile({ name: "Matrix Harbor", data: { entries: [] } });
world.relatedProfileIds = [profile.id];
for (let index = 0; index < 6; index += 1) {
  world.entries.push(archive.createWorldEntry({
    id: `world-active-${index}`,
    title: `Active world ${index}`,
    content: `WORLD_ACTIVE_${index} ${"W".repeat(1450)}`,
    visibility: "public",
    alwaysActive: true,
    priority: 100 - index,
  }));
}
world.entries.push(
  archive.createWorldEntry({ id: "world-disabled", title: "Disabled world", content: "WORLD_DISABLED_FACT", enabled: false, alwaysActive: true, priority: 1000 }),
  archive.createWorldEntry({ id: "world-other-timeline", title: "Other timeline", content: "WORLD_OTHER_TIMELINE_FACT", timelineId: "alternate", alwaysActive: true, priority: 1000 }),
);
profile.worldBindings = [world.id];

const archiveState = archive.createArchiveState();
archiveState.runtimeProfiles.push(profile);
archiveState.worlds.push(world);

const experienceContracts = global.MercuryChatExperienceContracts;
const experience = experienceContracts.normalize(null);
const contact = experienceContracts.contactFromProfile(profile);
experience.contacts[contact.id] = contact;
experience.conversations[`${contact.id}:default`] = {
  settings: { userPresetId: "profile-runtime-matrix", memoryHandling: "automatic" },
  resourceBindings: {
    runtimeProfileId: profile.id,
    worldVariantId: "default",
    worldBookMode: "explicit",
    worldBookIds: [world.id],
    presetId: "profile-runtime-matrix",
  },
};
archiveState.contactInstances.push({ id: "instance-matrix", runtimeProfileId: profile.id, chatContactId: contact.id, displayName: profile.displayName, relationshipState: "familiar", timelineId: "default", active: true });

const generationProfile = global.MercuryGenerationProfileContracts.normalizeProfile({
  id: "profile-runtime-matrix",
  name: "Runtime matrix",
  modules: { order: [], enabled: {} },
  instructionBlocks: [
    { id: "active", title: "Active", content: "PROFILE_ACTIVE_RULE", enabled: true, runtimeEligible: true, order: 0 },
    { id: "disabled", title: "Disabled", content: "PROFILE_DISABLED_RULE", enabled: false, runtimeEligible: true, order: 1 },
    { id: "preserved", title: "Preserved", content: "PROFILE_PRESERVED_RULE", enabled: true, runtimeEligible: false, order: 2 },
    { id: "bulk", title: "Bulk", content: `PROFILE_BULK_START ${"P".repeat(limits.generationProfileCharacters + 1200)} PROFILE_BULK_TAIL`, enabled: true, runtimeEligible: true, order: 3 },
  ],
});

const sharedValues = new Map([
  [archive.STORAGE_KEY, archiveState],
  [experienceContracts.STORAGE_KEY, experience],
  [global.MercuryGenerationProfileContracts.STORAGE_KEY, global.MercuryGenerationProfileContracts.normalizeStore({ schemaVersion: 1, profiles: [generationProfile], migration: null })],
]);
const sharedStorage = {
  get(key, fallback) { return sharedValues.has(key) ? sharedValues.get(key) : fallback; },
  set(key, value) { sharedValues.set(key, value); return value; },
};
const privateValues = new Map();
const privateStorage = {
  get(key, fallback) { return privateValues.has(key) ? privateValues.get(key) : fallback; },
  set(key, value) { privateValues.set(key, value); return value; },
};

function eventRecord(id, marker, options = {}) {
  const createdAt = options.createdAt || "2026-08-20T08:00:00.000Z";
  return {
    id,
    contactId: options.contactId || contact.id,
    worldVariantId: options.worldVariantId || "default",
    timelineId: options.timelineId || "default",
    kind: "shared_event",
    content: `${marker} obsidian lighthouse ${"M".repeat(260)}`,
    status: options.status || "confirmed",
    evidence: { sourceTurnIds: [`turn-${id}`], certainty: "explicit" },
    createdAt,
    updatedAt: createdAt,
    memory: {
      retention: options.retention || "durable",
      eventType: "shared-event",
      state: options.state || "active",
      importance: options.importance || 3,
      occurredAt: createdAt,
      expiresAt: null,
      supersededBy: options.state === "superseded" ? "replacement" : null,
    },
  };
}

global.MercuryRelationshipRecords.save(sharedStorage, {
  schemaVersion: 1,
  records: [
    eventRecord("current-1", "MEMORY_CURRENT_ONE", { importance: 5, createdAt: "2026-08-20T08:03:00.000Z" }),
    eventRecord("current-2", "MEMORY_CURRENT_TWO", { importance: 4, createdAt: "2026-08-20T08:02:00.000Z" }),
    eventRecord("current-3", "MEMORY_CURRENT_THREE", { importance: 3, createdAt: "2026-08-20T08:01:00.000Z" }),
    eventRecord("current-4", "MEMORY_FOURTH_OVER_BUDGET", { importance: 1 }),
    eventRecord("other-contact", "MEMORY_OTHER_CONTACT", { contactId: "contact-other", importance: 5 }),
    eventRecord("other-timeline", "MEMORY_OTHER_TIMELINE", { timelineId: "alternate", importance: 5 }),
    eventRecord("session-only", "MEMORY_SESSION_ONLY", { retention: "session", importance: 5 }),
    eventRecord("superseded", "MEMORY_SUPERSEDED", { state: "superseded", importance: 5 }),
    eventRecord("pending", "MEMORY_PENDING", { status: "pending", importance: 5 }),
  ],
});

async function main() {
  const app = global.MercuryCreateChatDefinition().create();
  app.render(new FakeElement("main"), { state: {}, i18n: { t: (key) => key }, services: { storage: privateStorage, sharedStorage } });
  app.openConversation(contact.id, "default");

  const query = "What happened at the obsidian lighthouse?";
  const memoryResolution = await app.recallMemoryForMessage({ content: query });
  assert.equal(memoryResolution.events.length, 3, "only the Top-3 current-scope durable events survive recall");
  assert.ok(memoryResolution.events.reduce((sum, event) => sum + event.content.length, 0) <= limits.eventMemoryCharacters, "recalled event content stays inside the runtime character budget");

  const request = app.buildAssistantRequest({ id: "matrix-message", text: query }, [], "matrix-request", memoryResolution);
  const trace = app.currentResourceRuntimeTrace();

  assert.match(request.systemPrompt, /ROLE_ACTIVE_IDENTITY/, "the bound role identity enters the actual request");
  assert.match(request.systemPrompt, /ROLE_ACTIVE_TRAIT/, "high-priority role behavior survives role admission");
  assert.match(request.systemPrompt, /ROLE_ACTIVE_VOICE/, "role voice survives before low-priority background overflow");
  assert.doesNotMatch(request.systemPrompt, /ROLE_BACKGROUND_TAIL/, "oversized low-priority role background cannot overflow the request");
  assert.equal(trace.assembly.roleProfile.truncated, true, "the request trace reports role truncation");
  assert.ok(trace.assembly.roleProfile.includedCharacters <= limits.roleProfileCharacters, "the admitted role text stays within its budget");

  assert.match(request.systemPrompt, /WORLD_ACTIVE_0/, "an eligible high-priority world entry enters the actual request");
  assert.doesNotMatch(request.systemPrompt, /WORLD_DISABLED_FACT/, "a disabled world entry stays outside the request");
  assert.doesNotMatch(request.systemPrompt, /WORLD_OTHER_TIMELINE_FACT/, "a world entry from another timeline stays outside the request");
  assert.ok(trace.assembly.worldBook.includedCharacters <= global.MercuryWorldBookRuntime.DEFAULT_LIMITS.maxCharacters, "world content stays inside the worldbook budget");
  assert.equal(trace.assembly.worldBook.truncated, true, "world budget pressure is visible in the unified trace");

  assert.match(request.systemPrompt, /PROFILE_ACTIVE_RULE/, "the selected Generation Profile enters the actual request");
  assert.doesNotMatch(request.systemPrompt, /PROFILE_DISABLED_RULE/, "a disabled Profile block stays outside the request");
  assert.doesNotMatch(request.systemPrompt, /PROFILE_PRESERVED_RULE/, "a preserved non-runtime Profile block stays outside the request");
  assert.doesNotMatch(request.systemPrompt, /PROFILE_BULK_TAIL/, "an oversized Profile cannot overflow the request");
  assert.equal(trace.assembly.generationProfile.truncated, true, "the request trace reports Generation Profile truncation");
  assert.ok(trace.assembly.generationProfile.includedCharacters <= limits.generationProfileCharacters, "the admitted Profile stays within its budget");

  assert.match(request.systemPrompt, /MEMORY_CURRENT_ONE/, "a current-scope durable event enters the actual request");
  assert.doesNotMatch(request.systemPrompt, /MEMORY_FOURTH_OVER_BUDGET/, "the fourth matching event stays outside the Top-3 budget");
  assert.doesNotMatch(request.systemPrompt, /MEMORY_OTHER_CONTACT|MEMORY_OTHER_TIMELINE|MEMORY_SESSION_ONLY|MEMORY_SUPERSEDED|MEMORY_PENDING/, "out-of-scope and inactive events stay outside the request");
  assert.equal(trace.assembly.eventMemory.includedCount, 3, "the unified trace reports the actual event count");
  assert.ok(trace.assembly.eventMemory.includedCharacters <= limits.eventMemoryCharacters, "the unified trace reports bounded event characters");
  assert.equal(trace.assembly.systemPromptCharacters, request.systemPrompt.length, "the trace accounts for the final system prompt sent to transport");
  assert.ok(request.systemPrompt.indexOf("PROFILE_ACTIVE_RULE") < request.systemPrompt.indexOf("ROLE_ACTIVE_IDENTITY"), "the established core → Profile → role precedence remains stable");

  app.experienceFor(contact.id, "default").settings.memoryHandling = "confirm";
  const disabledResolution = await app.recallMemoryForMessage({ content: query });
  assert.equal(disabledResolution.trace.mode, "disabled", "conversation memory settings disable automatic event recall before request assembly");
  const disabledRequest = app.buildAssistantRequest({ id: "matrix-message-disabled", text: query }, [], "matrix-request-disabled", disabledResolution);
  assert.doesNotMatch(disabledRequest.systemPrompt, /MEMORY_CURRENT_ONE/, "disabled event memory contributes no historical data to the request");
  assert.equal(app.currentResourceRuntimeTrace().assembly.eventMemory.includedCount, 0, "the disabled request trace reports zero admitted events");

  console.log("runtime-resource-acceptance-matrix: assertions passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
