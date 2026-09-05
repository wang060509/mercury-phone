"use strict";

const assert = require("node:assert/strict");
const stageCatalogModule = require("../core/cinema-stage-catalog.js");
const contracts = require("../core/cinema-contracts.js");
const quietStation = require("./fixtures/quiet-station-stage.js");

const fixedClock = () => Date.parse("2026-08-20T09:30:00.000Z");
const character = {
  id: "character-lumi",
  displayName: "露弥",
  identity: "外向而细心的学生",
  summary: "乐观、坦率，但不会越过别人的边界。",
  stableTraits: ["乐观", "勇敢", "会照顾人"],
  values: ["诚实", "陪伴"],
  updatedAt: 17,
};
const profile = { id: "preset-default", name: "平衡演绎", description: "保持人物一致，留出共演空间。" };

assert.equal(contracts.SCHEMA_VERSION, 4, "Cinema closure metadata increments the durable state schema");

assert.equal(stageCatalogModule.PRODUCTION_STAGE_CATALOG.listStages().length, 1, "production catalog currently exposes one seed Stage");
const stage = contracts.getStage("aevoria-academy");
assert.equal(stage.title, "埃沃利亚学院");
assert.match(stage.summary, /综合魔法大学/);
assert.match(stage.summary, /血统或道德/);
assert.ok(stage.specializations.includes("社会魔法与公共治理"));
assert.equal(stage.materials[0].asset, "assets/cinema/aevoria-campus-map.webp");
assert.equal(contracts.getStage("missing-stage"), null, "Cinema contracts do not silently fall back to Aevoria");

const hydratedLegacyState = contracts.normalizeState({
  activeInstanceId: "legacy-active",
  instances: [{ id: "legacy-active", status: "intermission" }, { id: "legacy-unfocused", status: "active" }],
});
assert.equal(hydratedLegacyState.focusedInstanceId, "legacy-active", "legacy activeInstanceId hydrates as the initial focus");
assert.equal("activeInstanceId" in hydratedLegacyState, false, "normalized state no longer conflates focus with lifecycle");
assert.equal(hydratedLegacyState.instances.length, 2, "legacy hydration preserves every stored instance");

const malformedPendingState = contracts.normalizeState({
  focusedInstanceId: "malformed-pending",
  instances: [{ id: "malformed-pending", status: "active", pendingContinuation: { requestId: "request-without-segment" } }],
});
assert.equal(malformedPendingState.instances[0].pendingContinuation, null, "malformed legacy pending state is never made retryable by guessing fields");
assert.equal(malformedPendingState.instances[0].lastError.code, "CINEMA_PENDING_CONTINUATION_INVALID", "malformed pending recovery is explicit after hydration");
const missingPendingState = contracts.normalizeState({
  focusedInstanceId: "missing-pending",
  instances: [{
    id: "missing-pending",
    status: "active",
    segments: [{ id: "opening-only", role: "assistant", text: "Opening." }],
    pendingContinuation: { requestId: "request-missing", userSegmentId: "missing-user", generationProfileId: "profile-a" },
  }],
});
assert.equal(missingPendingState.instances[0].pendingContinuation.userSegmentId, "missing-user", "a diagnosable invalid identity is preserved verbatim");
assert.equal(missingPendingState.instances[0].lastError.code, "CINEMA_PENDING_CONTINUATION_INVALID");

const draft = contracts.createDraft({
  characterId: character.id,
  characterSnapshot: character,
  playerName: "米拉",
  playerRole: "跨地区交换生",
  playerSpecialization: "空间、交通与远行",
  characterSpecialization: "魔法工程与器物",
  relationshipStart: "青梅竹马",
  sharedHistory: "一起在北门交通厅等过很多次晚班车。",
  generationProfileId: profile.id,
  generationProfileSnapshot: profile,
}, fixedClock);
const originalCharacter = JSON.parse(JSON.stringify(character));
const variant = contracts.buildCharacterVariant(character, draft);
assert.deepEqual(character, originalCharacter, "building a one-instance Variant never mutates Archive data");
assert.equal(variant.coreProfileId, character.id);
assert.match(variant.stableCore, /乐观/);
assert.equal(variant.relationshipStart, "青梅竹马");

const instance = contracts.createInstanceFromDraft(draft, fixedClock);
assert.equal(instance.status, "active");
assert.deepEqual(instance.structureProvenance, { scenes: "runtime" }, "new runtime Instances carry explicit structure provenance");
assert.equal(instance.closureRecord, null);
assert.equal(instance.stageSnapshot.title, "埃沃利亚学院");
assert.equal(instance.scenarioSnapshot.title, "专业分流确认期");
assert.equal(instance.characterSnapshot.displayName, "露弥");
assert.notEqual(instance.characterSnapshot, character, "the performance owns an Archive snapshot");
assert.notEqual(instance.generationProfileSnapshot, profile, "the performance owns a Generation Profile snapshot");
assert.equal(instance.segments[0].role, "assistant");
assert.match(instance.segments[0].text, /北门交通厅/);

const prompt = contracts.buildSystemPrompt(instance);
assert.match(prompt, /小说正文，不是聊天消息/);
assert.match(prompt, /不得主动揭示隐藏主线/);
assert.match(prompt, /友情、恋爱、毕业与普通职业/);
assert.doesNotMatch(prompt, /好感度|任务进度|线索计数/);

const validClosure = contracts.normalizeClosureRecord({
  version: 1,
  initiatedAt: "2026-08-20T09:30:00.000Z",
  pendingDisposition: {
    kind: "abandoned-by-user",
    requestId: "request-closure",
    userSegmentId: "segment-user",
    startedAt: "2026-08-20T09:28:00.000Z",
    settledAt: "2026-08-20T09:30:00.000Z",
  },
});
assert.equal(validClosure.pendingDisposition.requestId, "request-closure");
assert.equal(Object.isFrozen(validClosure), true);
assert.equal(Object.isFrozen(validClosure.pendingDisposition), true);
assert.equal(contracts.normalizeClosureRecord({ version: 1, initiatedAt: "not-a-date", pendingDisposition: null }), null, "malformed closure records fail closed");
assert.equal(contracts.normalizeClosureRecord({ version: 1, initiatedAt: "2026-08-20T09:30:00.000Z", pendingDisposition: { kind: "abandoned-by-user", requestId: "missing-provenance" } }), null);

const closurePrompt = contracts.buildSystemPrompt({ ...instance, closureRecord: validClosure });
assert.doesNotMatch(closurePrompt, /request-closure|abandoned-by-user|closureRecord/, "closure provenance never enters narrative prompt assembly");

const request = { requestId: "request-1", instanceId: instance.id, userText: "我接过那本课程册。", systemPrompt: prompt, history: [] };
assert.equal(contracts.validateGenerationRequest(request), true);
assert.throws(() => contracts.validateGenerationRequest({ ...request, history: [{ role: "system", text: "bad" }] }), /invalid/i);
assert.throws(() => contracts.createInstanceFromDraft({ ...draft, characterSnapshot: null }, fixedClock), /Archive character/);

const credits = contracts.computeCredits({ ...instance, endedAt: "2026-08-20T10:10:00.000Z", status: "ended" }, fixedClock);
assert.equal(credits.characterName, "露弥");
assert.equal(credits.minutes, 40);
assert.match(credits.dateRange, /至/);

const quietCatalog = stageCatalogModule.createStageCatalog([stageCatalogModule.AEVORIA_STAGE, quietStation]);
const quietDraft = contracts.createDraft({
  stageId: quietStation.id,
  characterId: character.id,
  characterSnapshot: character,
  playerName: "Mira",
  relationshipStart: "多年好友",
  generationProfileId: profile.id,
  generationProfileSnapshot: profile,
}, fixedClock, quietCatalog);
assert.equal(quietDraft.playerSpecialization, "", "a Stage without specializations does not invent one");
assert.equal(quietDraft.characterSpecialization, "");
const quietInstance = contracts.createInstanceFromDraft(quietDraft, fixedClock, quietCatalog);
assert.equal(quietInstance.stageSnapshot.title, "The Quiet Station");
assert.equal(quietInstance.scenarioSnapshot.title, "Last Train");
assert.equal(quietInstance.player.specialization, "");
const quietPrompt = contracts.buildSystemPrompt(quietInstance);
assert.match(quietPrompt, /The Quiet Station/);
assert.match(quietPrompt, /Last Train/);
["学院", "专业", "分流", "埃沃利亚", "Vendar"].forEach((term) => assert.doesNotMatch(quietPrompt, new RegExp(term), `neutral generation context must not inherit ${term}`));

const mutableTemplate = JSON.parse(JSON.stringify(quietStation));
const mutableCatalog = {
  listStages: () => [mutableTemplate],
  getStage: (stageId) => stageId === mutableTemplate.id ? mutableTemplate : null,
  getScenario: (stageId, scenarioId) => stageId === mutableTemplate.id ? mutableTemplate.scenarios.find((item) => item.id === scenarioId) || null : null,
};
const mutableDraft = contracts.createDraft({ ...quietDraft, id: "mutable-draft" }, fixedClock, mutableCatalog);
const snapshotOne = contracts.createInstanceFromDraft(mutableDraft, fixedClock, mutableCatalog);
mutableTemplate.title = "Changed Template Title";
mutableTemplate.premise = "Changed Template Premise";
mutableTemplate.scenarios[0].title = "Changed Scenario";
mutableTemplate.scenarios[0].summary = "Changed Scenario Summary";
assert.equal(snapshotOne.stageSnapshot.title, "The Quiet Station", "editing a Stage template cannot rewrite an existing instance");
assert.equal(snapshotOne.stageSnapshot.premise, quietStation.premise);
assert.equal(snapshotOne.scenarioSnapshot.title, "Last Train", "editing a Scenario template cannot rewrite an existing instance");
assert.equal(snapshotOne.scenarioSnapshot.summary, quietStation.scenarios[0].summary);
const snapshotTwo = contracts.createInstanceFromDraft(contracts.createDraft({ ...quietDraft, id: "mutable-draft-2" }, fixedClock, mutableCatalog), fixedClock, mutableCatalog);
assert.equal(snapshotTwo.stageSnapshot.title, "Changed Template Title", "new instances receive the current template semantics");
assert.notEqual(snapshotOne.stageSnapshot, snapshotTwo.stageSnapshot, "instances own independent Stage snapshots");
assert.notEqual(snapshotOne.scenarioSnapshot, snapshotTwo.scenarioSnapshot, "instances own independent Scenario snapshots");

const legacyQuiet = JSON.parse(JSON.stringify(quietInstance));
delete legacyQuiet.stageSnapshot;
delete legacyQuiet.scenarioSnapshot;
const hydratedQuiet = contracts.normalizeInstance(legacyQuiet, quietCatalog);
assert.equal(hydratedQuiet.stageSnapshot.title, "The Quiet Station", "legacy instances receive a compatibility Stage snapshot");
assert.equal(hydratedQuiet.scenarioSnapshot.title, "Last Train");
assert.equal(hydratedQuiet.segments.length, quietInstance.segments.length, "legacy hydration preserves prose");
assert.equal(hydratedQuiet.status, quietInstance.status, "legacy hydration preserves lifecycle");
assert.deepEqual(hydratedQuiet.structureProvenance, { scenes: "runtime" }, "internally consistent persisted runtime structure is conservatively recoverable");

const ambiguousLegacy = contracts.normalizeInstance({
  id: "ambiguous-legacy",
  status: "active",
  scenes: [{ id: "scene-1", actNumber: 1, sceneNumber: 1, title: "Compatibility scene" }],
  currentSceneId: "scene-1",
  segments: [{ id: "segment-1", sceneId: "scene-1", role: "assistant", text: "Legacy prose." }],
}, quietCatalog);
assert.deepEqual(ambiguousLegacy.structureProvenance, { scenes: "compatibility-unknown" }, "the compatibility fallback fingerprint never becomes canonical structure");
const missingStructure = contracts.normalizeInstance({ id: "missing-structure", status: "active", segments: [] }, quietCatalog);
assert.deepEqual(missingStructure.structureProvenance, { scenes: "compatibility-unknown" });
const explicitUnknown = contracts.normalizeInstance({ ...quietInstance, structureProvenance: { scenes: "compatibility-unknown" } }, quietCatalog);
assert.deepEqual(explicitUnknown.structureProvenance, { scenes: "compatibility-unknown" }, "explicit conservative provenance is preserved");
const malformedProvenance = contracts.normalizeInstance({ ...quietInstance, structureProvenance: { scenes: "future-value" } }, quietCatalog);
assert.deepEqual(malformedProvenance.structureProvenance, { scenes: "runtime" }, "malformed provenance is ignored and only recoverable structure evidence is considered");

const unavailableLegacy = contracts.normalizeInstance({ ...legacyQuiet, stageId: "removed-stage", scenarioId: "removed-scenario" }, quietCatalog);
assert.equal(unavailableLegacy.stageSnapshot.title, "Unknown / unavailable Stage");
assert.equal(unavailableLegacy.stageSnapshot.unavailable, true);
assert.equal(unavailableLegacy.segments.length, quietInstance.segments.length, "missing templates never discard legacy prose");

console.log("cinema-contracts: assertions passed");
