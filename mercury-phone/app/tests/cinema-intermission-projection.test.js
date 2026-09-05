"use strict";

const assert = require("node:assert/strict");
const { buildCinemaIntermissionProjection } = require("../core/cinema-intermission-projection.js");

function instance(overrides = {}) {
  return {
    id: "performance-intermission",
    title: "北方长廊",
    status: "intermission",
    structureProvenance: { scenes: "runtime" },
    scenes: [{ id: "scene-4", actNumber: 2, sceneNumber: 4, title: "北方长廊" }],
    currentSceneId: "scene-4",
    segments: [
      { id: "assistant-0", role: "assistant", status: "complete", text: "雨水落在长廊的玻璃上。" },
      { id: "user-1", role: "user", status: "complete", text: "我停在门槛外。" },
      { id: "assistant-2", role: "assistant", status: "complete", text: "她把旧信压在册页下面。" },
    ],
    notes: { summary: { text: "雨水沿着北方长廊的玻璃缓慢落下。她把写着 Mercury 的旧信压在册页下面，等在门边。", coveredThroughOrdinal: 2 } },
    pendingContinuation: null,
    ...overrides,
  };
}

const reliable = buildCinemaIntermissionProjection(instance());
assert.equal(reliable.structureReliable, true);
assert.deepEqual(reliable.position, { actNumber: 2, sceneNumber: 4, label: "第二幕 · 场景 04", location: "北方长廊" });
assert.equal(reliable.recapReliable, true);
assert.match(reliable.recap, /Mercury/);
assert.deepEqual(reliable.recapEvidence, { lastCompletedAssistantOrdinal: 2, coveredThroughOrdinal: 2 });
assert.deepEqual(reliable.primaryAction, { kind: "resume", label: "继续演出" });

for (const provenance of [{ scenes: "compatibility-unknown" }, { scenes: "future-value" }, undefined]) {
  const compatibility = buildCinemaIntermissionProjection(instance({ structureProvenance: provenance }));
  assert.equal(compatibility.structureReliable, false);
  assert.equal(compatibility.position, null, "normalized Scene arrays never override missing or compatibility provenance");
}

for (const notes of [
  { summary: { text: "", coveredThroughOrdinal: 2 } },
  { summary: { text: "Coverage is stale.", coveredThroughOrdinal: 1 } },
  { summary: { text: "Coverage is malformed.", coveredThroughOrdinal: "2" } },
  { overview: "Legacy overview without coverage." },
]) {
  const fallback = buildCinemaIntermissionProjection(instance({ notes }));
  assert.equal(fallback.recapReliable, false);
  assert.equal(fallback.recap, "故事仍停在你离开的地方。回来时，可以从这里继续。");
}

const pendingRequest = { requestId: "request-pending", userSegmentId: "user-3" };
const pending = buildCinemaIntermissionProjection(instance({ pendingContinuation: pendingRequest }));
assert.equal(pending.mode, "pending");
assert.equal(pending.pendingRequestId, pendingRequest.requestId);
assert.deepEqual(pending.primaryAction, { kind: "pending-recovery", label: "处理待续写" });
assert.match(pending.stateCopy, /明确重试/);

const running = buildCinemaIntermissionProjection(instance({ pendingContinuation: pendingRequest }), { phase: "running", requestId: pendingRequest.requestId });
assert.equal(running.mode, "in-flight");
assert.deepEqual(running.primaryAction, { kind: "return-to-running", label: "返回演出" });

const unrelatedRunning = buildCinemaIntermissionProjection(instance({ pendingContinuation: pendingRequest }), { phase: "running", requestId: "other-request" });
assert.equal(unrelatedRunning.mode, "pending", "another request cannot convert durable pending into an in-flight state");

const relationNoise = buildCinemaIntermissionProjection(instance({
  relationshipSummary: "Fabricated relationship conclusion",
  variant: { sharedHistory: "Not Intermission recap evidence" },
}));
assert.equal(JSON.stringify(relationNoise).includes("Fabricated relationship conclusion"), false);
assert.equal(JSON.stringify(relationNoise).includes("Not Intermission recap evidence"), false);

console.log("cinema-intermission-projection: structural truth, recap coverage, and pending-action assertions passed");
