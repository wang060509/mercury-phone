"use strict";

const assert = require("node:assert/strict");
const contracts = require("../core/cinema-contracts.js");
global.MercuryCinemaContracts = contracts;
const compiler = require("../use-cases/cinema-context-compiler.js");

function segment(ordinal, role, text) {
  return { id: `segment-${ordinal}`, sceneId: ordinal > 60 ? "scene-b" : "scene-a", role, text, status: "complete", createdAt: "2026-01-01T00:00:00.000Z", generationProfileId: "profile-a" };
}

const instance = contracts.normalizeInstance({
  id: "cinema-a",
  status: "active",
  stageSnapshot: { id: "stage", title: "Frozen Stage", premise: "Core stage premise." },
  scenarioSnapshot: { id: "scenario", title: "Opening Scenario", summary: "Opening situation only." },
  characterSnapshot: { id: "character", displayName: "River", summary: "Calm.", stableTraits: ["steady"] },
  player: { name: "Mira", role: "student", specialization: "history" },
  variant: { stableCore: "steady", worldIdentity: "archivist", relationshipStart: "friends", sharedHistory: "Old classmates." },
  generationProfileId: "profile-b",
  generationProfileSnapshot: { id: "profile-b", description: "Use careful prose." },
  scenes: [
    { id: "scene-a", actNumber: 1, sceneNumber: 1, title: "Old Courtyard", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "scene-b", actNumber: 2, sceneNumber: 1, title: "Library After Rain", createdAt: "2026-01-01T01:00:00.000Z" },
  ],
  currentSceneId: "scene-b",
  notes: {
    summary: { text: "River made an early promise to protect the silver key.", coveredThroughOrdinal: 50 },
    importantFacts: [{ description: "The silver key opens the sealed archive.", evidenceOrdinals: [2] }],
    commitments: [{ who: "River", what: "protect the silver key", status: "open", evidenceOrdinals: [3] }],
  },
  segments: [
    ...Array.from({ length: 65 }, (_, ordinal) => segment(ordinal, ordinal % 2 ? "user" : "assistant", ordinal === 3 ? "River promises to protect the silver key." : `old prose ${ordinal}`)),
    segment(65, "user", "What about that promise?"),
  ],
});

const compiled = compiler.compile({ instance, requestId: "request-a", currentUserSegmentId: "segment-65", textBudget: 9000 });

assert.equal(compiled.request.userText, "What about that promise?");
assert.equal(compiled.request.history.some((entry) => entry.text.includes("What about that promise?")), false, "current user turn is not duplicated in history");
assert.match(compiled.request.systemPrompt, /开场情境：Opening Scenario/);
assert.match(compiled.request.systemPrompt, /当前实际场景：Library After Rain/);
assert.doesNotMatch(compiled.request.systemPrompt, /当前场景：Opening Scenario/, "Scenario is no longer mislabeled as current Scene");
assert.match(compiled.request.systemPrompt, /silver key opens/);
assert.match(compiled.request.systemPrompt, /protect the silver key/);
assert.equal(compiled.request.history.some((entry) => entry.text.includes("old prose 49")), false, "covered prose is not replayed after summary coverage");
assert.equal(compiled.request.history.some((entry) => entry.text.includes("old prose 51")), true, "uncovered prose after coverage remains available");
assert.equal(compiled.request.generationProfileId, "profile-b", "compiler uses the currently active runtime profile");

const compatibilityInstance = contracts.normalizeInstance({
  ...instance,
  id: "cinema-compatibility-structure",
  scenes: [{ id: "scene-1", actNumber: 1, sceneNumber: 1, title: "Compatibility Placeholder" }],
  currentSceneId: "scene-1",
  structureProvenance: { scenes: "compatibility-unknown" },
  segments: [segment(65, "user", "Continue without inventing structure.")].map((entry) => ({ ...entry, sceneId: "scene-1" })),
});
const compatibility = compiler.compile({ instance: compatibilityInstance, requestId: "request-compatibility", currentUserSegmentId: "segment-65", textBudget: 9000 });
assert.match(compatibility.request.systemPrompt, /没有可靠的 Act\/Scene 结构标注/);
assert.doesNotMatch(compatibility.request.systemPrompt, /Compatibility Placeholder/);
assert.doesNotMatch(compatibility.request.systemPrompt, /Act 1, Scene 1/, "compatibility placeholder structure never becomes generation truth");

const tinyTurnInstance = contracts.normalizeInstance({
  ...instance,
  id: "cinema-tiny-turns",
  notes: { summary: { text: "", coveredThroughOrdinal: -1 } },
  segments: Array.from({ length: 121 }, (_, ordinal) => segment(ordinal, ordinal % 2 ? "user" : "assistant", `tiny ${ordinal}`)),
});
const tinyTurns = compiler.compile({ instance: tinyTurnInstance, requestId: "request-tiny", currentUserSegmentId: "segment-120", textBudget: 8000 });
assert.equal(tinyTurns.request.history.length, 30, "many short uncovered segments are capped by the GenerationRequest history contract");
assert.match(tinyTurns.request.history[0].text, /ordinal 90/, "history admission keeps the latest contiguous suffix deterministically");
assert.ok(tinyTurns.budget.actual <= tinyTurns.budget.total, "ordinary compiled context stays inside the deterministic text budget");

const delayedInstance = contracts.normalizeInstance({
  ...instance,
  id: "cinema-delayed-relevance",
  notes: {
    summary: { text: "The group crossed the city and reached the observatory.", coveredThroughOrdinal: 100 },
    importantFacts: [
      { description: "The plain blue button belongs to Ilya's missing coat.", evidenceOrdinals: [2] },
      { description: "The brass token opens the north cabinet.", evidenceOrdinals: [12] },
      { description: "The brass token does not open the north cabinet; the earlier belief was false.", evidenceOrdinals: [80] },
    ],
  },
  segments: Array.from({ length: 121 }, (_, ordinal) => segment(ordinal, ordinal % 2 ? "user" : "assistant", ordinal === 2
    ? "A plain blue button rolled under the bench."
    : ordinal === 3
      ? "A faint chalk crescent marked the west sill."
      : `later prose ${ordinal}`)),
});
const delayed = compiler.compile({ instance: delayedInstance, requestId: "request-delayed", currentUserSegmentId: "segment-120", textBudget: 9000 });
assert.match(delayed.request.systemPrompt, /plain blue button/, "an early fact explicitly retained in structured continuity remains available after 100 turns");
assert.match(delayed.request.systemPrompt, /earlier belief was false/, "a later explicit correction remains available");
assert.match(delayed.request.systemPrompt, /较大的明确更正或状态变化为准/, "conflicting continuity records are not presented as equally authoritative");
assert.doesNotMatch(delayed.request.systemPrompt, /faint chalk crescent/, "an unextracted covered detail is not falsely guaranteed to generation context");
assert.equal(delayedInstance.segments[3].text, "A faint chalk crescent marked the west sill.", "the unextracted detail still survives in durable raw story");

const pressuredInstance = contracts.normalizeInstance({
  ...delayedInstance,
  id: "cinema-budget-pressure",
  notes: {
    summary: { text: "S".repeat(6000), coveredThroughOrdinal: 100 },
    importantFacts: Array.from({ length: 180 }, (_, ordinal) => ({ description: `fact-${ordinal}-${"F".repeat(180)}`, evidenceOrdinals: [ordinal] })),
    commitments: Array.from({ length: 80 }, (_, ordinal) => ({ who: "River", what: `promise-${ordinal}-${"P".repeat(160)}`, status: "open", evidenceOrdinals: [ordinal] })),
  },
});
const pressured = compiler.compile({ instance: pressuredInstance, requestId: "request-pressure", currentUserSegmentId: "segment-120", textBudget: 8000 });
const pressuredAgain = compiler.compile({ instance: pressuredInstance, requestId: "request-pressure", currentUserSegmentId: "segment-120", textBudget: 8000 });
assert.equal(pressured.budget.continuityTruncated, true, "oversized Layer B is trimmed predictably instead of invalidating the request");
assert.ok(pressured.budget.recent >= 0 && pressured.budget.continuity >= 0, "budget arithmetic never becomes negative");
assert.ok(pressured.budget.actual <= pressured.budget.total, "Layer B pressure does not pierce the total budget when required layers fit");
assert.equal(pressured.request.userText, "later prose 120", "Layer D remains represented under continuity pressure");
assert.match(pressured.request.systemPrompt, /Frozen Stage/, "required Layer A identity is retained under continuity pressure");
assert.deepEqual(pressuredAgain, pressured, "the same state and budget compile deterministically");

const requiredPressureInstance = contracts.normalizeInstance({
  ...instance,
  id: "cinema-required-pressure",
  generationProfileSnapshot: { id: "profile-required", description: `REQUIRED_PROFILE_${"R".repeat(10000)}` },
  generationProfileId: "profile-required",
});
const requiredPressure = compiler.compile({ instance: requiredPressureInstance, requestId: "request-required-pressure", currentUserSegmentId: "segment-65", textBudget: 8000 });
assert.ok(requiredPressure.budget.requiredOverflow > 0, "required Layer A and Layer D pressure is reported instead of hidden in negative arithmetic");
assert.equal(requiredPressure.request.history.length, 0, "Layer C yields completely when required layers alone exceed the configured budget");
assert.match(requiredPressure.request.systemPrompt, /REQUIRED_PROFILE_/);
assert.equal(requiredPressure.request.userText, "What about that promise?", "Layer D is still represented when required context exceeds the soft budget");

const oversizedFrozen = contracts.normalizeInstance({
  ...instance,
  id: "cinema-oversized-frozen",
  generationProfileSnapshot: { id: "profile-huge", description: "X".repeat(40000) },
  generationProfileId: "profile-huge",
});
assert.throws(
  () => compiler.compile({ instance: oversizedFrozen, requestId: "request-huge-a", currentUserSegmentId: "segment-65", textBudget: 8000 }),
  (error) => error.code === "CINEMA_FROZEN_TRUTH_TOO_LARGE",
  "Layer A above the hard request limit fails explicitly and is never silently truncated",
);

console.log("cinema-context-compiler: long-story, correction, delayed relevance, and budget-pressure assertions passed");
