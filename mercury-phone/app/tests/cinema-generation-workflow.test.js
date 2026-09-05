"use strict";

const assert = require("node:assert/strict");
const contracts = require("../core/cinema-contracts.js");
global.MercuryCinemaContracts = contracts;
const MercuryCinemaGenerationWorkflow = require("../use-cases/cinema-generation-workflow.js");

const clone = (value) => JSON.parse(JSON.stringify(value));
const persistenceOrder = [];
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
  return { promise, resolve, reject };
}

function mutableStore(target) {
  let userOrdinal = 0;
  let assistantOrdinal = 0;
  return {
    focused: () => clone(target),
    get: (id) => id === target.id ? clone(target) : null,
    appendUser: (id, text) => {
      if (id !== target.id) return null;
      const segment = { id: `${id}-user-${++userOrdinal}`, sceneId: target.currentSceneId, role: "user", text, status: "complete", createdAt: "2026-01-01T00:00:01.000Z", generationProfileId: target.generationProfileId };
      target.segments.push(segment);
      return clone(segment);
    },
    markPendingContinuation: (id, pending) => { if (id === target.id) target.pendingContinuation = clone(pending); },
    commitAssistantTurn: (id, { assistantText, generationProfileId, notes }) => {
      if (id !== target.id) return null;
      const segment = { id: `${id}-assistant-${++assistantOrdinal}`, sceneId: target.currentSceneId, role: "assistant", text: assistantText, status: "complete", createdAt: "2026-01-01T00:00:02.000Z", generationProfileId };
      target.notes = clone(notes);
      target.pendingContinuation = null;
      target.segments.push(segment);
      return clone(segment);
    },
    failGeneration: (id, error) => { if (id === target.id) target.lastError = { code: error.code, message: error.message, retryable: error.retryable === true, recovery: error.recovery || null }; },
    clearError: (id) => { if (id === target.id) target.lastError = null; },
    flush: async () => {},
  };
}

const instance = {
  id: "cinema-instance-1",
  status: "active",
  stageId: "aevoria-academy",
  scenarioId: "specialization-placement",
  title: "Aevoria",
  characterSnapshot: { id: "character-1", displayName: "River", stableTraits: ["calm"] },
  player: { name: "You", role: "student", specialization: "history" },
  variant: { stableCore: "calm", worldIdentity: "student", relationshipStart: "friend" },
  generationProfileId: "profile-neutral",
  generationProfileSnapshot: { id: "profile-neutral", description: "Restrained prose." },
  scenes: [{ id: "scene-1", actNumber: 1, sceneNumber: 1, title: "Courtyard", createdAt: "2026-01-01T00:00:00.000Z" }],
  currentSceneId: "scene-1",
  segments: [{ id: "opening-1", sceneId: "scene-1", role: "assistant", text: "The courtyard was quiet.", status: "complete", createdAt: "2026-01-01T00:00:00.000Z", generationProfileId: "profile-neutral" }],
  notes: { overview: "", timeline: [], people: [], places: [], threads: [] },
};

const store = {
  focused: () => clone(instance),
  get: () => clone(instance),
  appendUser: (_, text) => { persistenceOrder.push("append-user"); const segment = { id: "user-1", sceneId: "scene-1", role: "user", text, status: "complete", createdAt: "2026-01-01T00:00:01.000Z", generationProfileId: "profile-neutral" }; instance.segments.push(segment); return clone(segment); },
  markPendingContinuation: (_, pending) => { persistenceOrder.push("pending"); instance.pendingContinuation = clone(pending); },
  commitAssistantTurn: (_, { assistantText, generationProfileId, notes }) => { persistenceOrder.push("commit-assistant-turn"); instance.notes = clone(notes); instance.pendingContinuation = null; instance.segments.push({ id: "assistant-1", sceneId: "scene-1", role: "assistant", text: assistantText, status: "complete", createdAt: "2026-01-01T00:00:02.000Z", generationProfileId }); },
  failGeneration: (_, error) => { instance.lastError = { code: error.code, message: error.message }; },
  clearError: () => { instance.lastError = null; },
  flush: async () => { persistenceOrder.push("flush"); },
};

let generationCall = null;
const transport = {
  connectionStatus: () => ({ ready: true }),
  generateCinema: async (request, options) => {
    persistenceOrder.push("generate");
    generationCall = { request: clone(request), signal: options.signal };
    return { requestId: request.requestId, text: "River crossed the courtyard beside you." };
  },
};

(async () => {
  const workflow = new MercuryCinemaGenerationWorkflow({ store, transport, contracts, clock: () => 1000 });
  const result = await workflow.continueWith("Walk toward the library.");

  assert.equal(result.accepted, true, "Cinema completes through the high-level transport operation");
  assert.equal(generationCall.request.userText, "Walk toward the library.");
  assert.equal(generationCall.request.instanceId, "cinema-instance-1");
  assert.equal("connection" in generationCall.request, false, "the Cinema workflow never receives or forwards credentials");
  assert.equal(generationCall.signal instanceof AbortSignal, true, "Cinema preserves cancellation at the high-level Interface");
  assert.equal(instance.segments.at(-1).text, "River crossed the courtyard beside you.");
  assert.deepEqual(persistenceOrder, ["append-user", "flush", "pending", "flush", "generate", "commit-assistant-turn", "flush"], "user prose and pending identity are durable before generation and assistant prose is flushed before completion");
  assert.equal(instance.pendingContinuation, null, "completed turns clear pending continuation identity");
  assert.ok(instance.notes.timeline.length, "logical completion advances story notes continuity");
  assert.equal(workflow.snapshot().phase, "idle");

  const instances = {
    a: {
      ...clone(instance),
      id: "cinema-retry-a",
      segments: [{ id: "opening-a", sceneId: "scene-1", role: "assistant", text: "Opening A.", status: "complete", createdAt: "2026-01-01T00:00:00.000Z", generationProfileId: "profile-neutral" }],
      pendingContinuation: null,
    },
    b: {
      ...clone(instance),
      id: "cinema-retry-b",
      segments: [{ id: "opening-b", sceneId: "scene-1", role: "assistant", text: "Opening B.", status: "complete", createdAt: "2026-01-01T00:00:00.000Z", generationProfileId: "profile-neutral" }],
      pendingContinuation: null,
    },
  };
  let focusedId = "cinema-retry-a";
  let retryCalls = 0;
  const retryStore = {
    focused: () => clone(instances[focusedId === "cinema-retry-a" ? "a" : "b"]),
    get: (id) => clone(id === "cinema-retry-a" ? instances.a : instances.b),
    appendUser: (id, text) => {
      const target = id === "cinema-retry-a" ? instances.a : instances.b;
      const segment = { id: `${id}-user-1`, sceneId: "scene-1", role: "user", text, status: "complete", createdAt: "2026-01-01T00:00:01.000Z", generationProfileId: "profile-neutral" };
      target.segments.push(segment);
      return clone(segment);
    },
    markPendingContinuation: (id, pending) => { (id === "cinema-retry-a" ? instances.a : instances.b).pendingContinuation = clone(pending); },
    commitAssistantTurn: (id, { assistantText, notes }) => {
      const target = id === "cinema-retry-a" ? instances.a : instances.b;
      target.notes = clone(notes);
      target.pendingContinuation = null;
      target.segments.push({ id: `${id}-assistant-1`, sceneId: "scene-1", role: "assistant", text: assistantText, status: "complete", createdAt: "2026-01-01T00:00:02.000Z", generationProfileId: "profile-neutral" });
    },
    failGeneration: (id, error) => { (id === "cinema-retry-a" ? instances.a : instances.b).lastError = { code: error.code, message: error.message }; },
    clearError: (id) => { (id === "cinema-retry-a" ? instances.a : instances.b).lastError = null; },
    flush: async () => {},
  };
  const retryTransport = {
    connectionStatus: () => ({ ready: true }),
    generateCinema: async (request) => {
      retryCalls += 1;
      if (retryCalls === 1) throw Object.assign(new Error("network down"), { code: "NETWORK_DOWN", retryable: true });
      return { requestId: request.requestId, text: `Recovered for ${request.instanceId}.` };
    },
  };
  const retryWorkflow = new MercuryCinemaGenerationWorkflow({ store: retryStore, transport: retryTransport, contracts, clock: () => 2000 });
  const failed = await retryWorkflow.continueWith("Keep walking.");
  assert.equal(failed.accepted, false, "failed transport does not complete the turn");
  assert.equal(instances.a.segments.filter((entry) => entry.role === "user").length, 1, "failed model requests keep the durable user prose once");
  assert.ok(instances.a.pendingContinuation?.userSegmentId, "failed model requests keep pending identity for recovery");
  focusedId = "cinema-retry-b";
  const recovered = await retryWorkflow.retryPending("cinema-retry-a");
  assert.equal(recovered.accepted, true, "retry can target the interrupted instance explicitly");
  assert.equal(instances.a.segments.filter((entry) => entry.role === "user").length, 1, "retry does not duplicate user prose");
  assert.equal(instances.a.pendingContinuation, null, "successful retry clears pending identity");
  assert.equal(instances.b.segments.length, 1, "retry does not contaminate another unfinished instance");

  const unresolved = {
    ...clone(instance),
    id: "cinema-unresolved",
    segments: [
      { id: "unresolved-opening", sceneId: "scene-1", role: "assistant", text: "Opening.", status: "complete", createdAt: "2026-01-01T00:00:00.000Z", generationProfileId: "profile-neutral" },
      { id: "unresolved-user", sceneId: "scene-1", role: "user", text: "Keep the lamp lit.", status: "complete", createdAt: "2026-01-01T00:00:01.000Z", generationProfileId: "profile-neutral" },
    ],
    pendingContinuation: { requestId: "request-unresolved", userSegmentId: "unresolved-user", startedAt: "2026-01-01T00:00:01.000Z", generationProfileId: "profile-neutral" },
  };
  const unresolvedStore = mutableStore(unresolved);
  const blockedNewTurn = await new MercuryCinemaGenerationWorkflow({ store: unresolvedStore, transport, contracts }).runTurn({ instanceId: unresolved.id, userText: "A different continuation." });
  assert.equal(blockedNewTurn.reason, "pending-exists", "new user prose cannot overwrite an unresolved durable continuation identity");
  assert.equal(unresolved.segments.filter((entry) => entry.role === "user").length, 1);

  const concurrentGate = deferred();
  const concurrentStarted = deferred();
  let concurrentCalls = 0;
  const concurrentStore = mutableStore(unresolved);
  const concurrentTransport = {
    connectionStatus: () => ({ ready: true }),
    generateCinema: async (request) => {
      concurrentCalls += 1;
      concurrentStarted.resolve();
      await concurrentGate.promise;
      return { requestId: request.requestId, text: "Only one recovered continuation." };
    },
  };
  const concurrentA = new MercuryCinemaGenerationWorkflow({ store: concurrentStore, transport: concurrentTransport, contracts, clock: () => 3000 });
  const concurrentB = new MercuryCinemaGenerationWorkflow({ store: concurrentStore, transport: concurrentTransport, contracts, clock: () => 3001 });
  const firstRetry = concurrentA.retryPending(unresolved.id);
  const duplicateRetry = await concurrentB.retryPending(unresolved.id);
  assert.equal(duplicateRetry.reason, "busy", "a shared per-instance lease rejects concurrent retry from another workflow object");
  await concurrentStarted.promise;
  concurrentGate.resolve();
  assert.equal((await firstRetry).accepted, true);
  assert.equal(concurrentCalls, 1, "concurrent retry sends exactly one model request");
  assert.equal(unresolved.segments.filter((entry) => entry.role === "assistant" && entry.text === "Only one recovered continuation.").length, 1, "concurrent retry commits exactly one assistant segment");

  const mismatch = {
    ...clone(instance),
    id: "cinema-response-mismatch",
    segments: [{ id: "mismatch-opening", sceneId: "scene-1", role: "assistant", text: "Opening.", status: "complete", createdAt: "2026-01-01T00:00:00.000Z", generationProfileId: "profile-neutral" }],
    pendingContinuation: null,
  };
  const mismatchStore = mutableStore(mismatch);
  const mismatched = await new MercuryCinemaGenerationWorkflow({
    store: mismatchStore,
    contracts,
    transport: { connectionStatus: () => ({ ready: true }), generateCinema: async () => ({ requestId: "wrong-request", text: "Wrong response." }) },
    clock: () => 4000,
  }).runTurn({ instanceId: mismatch.id, userText: "Continue safely." });
  assert.equal(mismatched.error.code, "CINEMA_RESPONSE_REQUEST_MISMATCH", "a response must correlate to the exact durable request identity");
  assert.equal(mismatch.segments.some((entry) => entry.text === "Wrong response."), false, "a mismatched response is never committed");
  assert.ok(mismatch.pendingContinuation, "response mismatch keeps the original pending continuation recoverable");

  const profilePending = {
    ...clone(instance),
    id: "cinema-profile-pending",
    generationProfileId: "profile-b",
    generationProfileSnapshot: { id: "profile-b", description: "PROFILE B CURRENT" },
    runtimeProfileHistory: [
      { profileId: "profile-a", snapshot: { id: "profile-a", description: "PROFILE A ORIGINAL" }, appliedAt: "2026-01-01T00:00:00.000Z" },
      { profileId: "profile-b", snapshot: { id: "profile-b", description: "PROFILE B CURRENT" }, appliedAt: "2026-01-01T00:05:00.000Z" },
    ],
    segments: [
      { id: "profile-opening", sceneId: "scene-1", role: "assistant", text: "Opening.", status: "complete", createdAt: "2026-01-01T00:00:00.000Z", generationProfileId: "profile-a" },
      { id: "profile-user", sceneId: "scene-1", role: "user", text: "Continue in the original performance style.", status: "complete", createdAt: "2026-01-01T00:01:00.000Z", generationProfileId: "profile-a" },
    ],
    pendingContinuation: { requestId: "request-profile-a", userSegmentId: "profile-user", startedAt: "2026-01-01T00:01:00.000Z", generationProfileId: "profile-a" },
  };
  const profileStore = mutableStore(profilePending);
  let profileRequest;
  const profileResult = await new MercuryCinemaGenerationWorkflow({
    store: profileStore,
    contracts,
    transport: {
      connectionStatus: () => ({ ready: true }),
      generateCinema: async (request) => { profileRequest = clone(request); return { requestId: request.requestId, text: "Profile A continuation." }; },
    },
    clock: () => 5000,
  }).retryPending(profilePending.id);
  assert.equal(profileResult.accepted, true);
  assert.equal(profileRequest.generationProfileId, "profile-a", "retry uses the profile captured by the pending operation, not the current runtime profile");
  assert.match(profileRequest.systemPrompt, /PROFILE A ORIGINAL/);
  assert.doesNotMatch(profileRequest.systemPrompt, /PROFILE B CURRENT/);
  assert.equal(profilePending.segments.at(-1).generationProfileId, "profile-a");

  const missingPending = {
    ...clone(instance),
    id: "cinema-missing-pending-segment",
    segments: [{ id: "missing-opening", sceneId: "scene-1", role: "assistant", text: "Opening.", status: "complete", createdAt: "2026-01-01T00:00:00.000Z", generationProfileId: "profile-neutral" }],
    pendingContinuation: { requestId: "request-missing", userSegmentId: "deleted-user", startedAt: "2026-01-01T00:01:00.000Z", generationProfileId: "profile-neutral" },
  };
  const missingStore = mutableStore(missingPending);
  const missingResult = await new MercuryCinemaGenerationWorkflow({ store: missingStore, transport, contracts }).retryPending(missingPending.id);
  assert.equal(missingResult.reason, "invalid-pending");
  assert.equal(missingResult.error.code, "CINEMA_PENDING_USER_SEGMENT_MISSING");
  assert.equal(missingPending.pendingContinuation.userSegmentId, "deleted-user", "invalid pending identity is preserved for diagnosis and never replaced with the latest message");

  const cancelTarget = {
    ...clone(instance),
    id: "cinema-cancel-pending",
    segments: [{ id: "cancel-opening", sceneId: "scene-1", role: "assistant", text: "Opening.", status: "complete", createdAt: "2026-01-01T00:00:00.000Z", generationProfileId: "profile-neutral" }],
    pendingContinuation: null,
  };
  const cancelStore = mutableStore(cancelTarget);
  const cancelStarted = deferred();
  const cancelWorkflow = new MercuryCinemaGenerationWorkflow({
    store: cancelStore,
    contracts,
    transport: {
      connectionStatus: () => ({ ready: true }),
      generateCinema: (_request, { signal }) => new Promise((_resolve, reject) => {
        cancelStarted.resolve();
        signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true });
      }),
    },
    clock: () => 6000,
  });
  const cancelOperation = cancelWorkflow.runTurn({ instanceId: cancelTarget.id, userText: "Keep this prose after cancellation." });
  await cancelStarted.promise;
  assert.equal(cancelWorkflow.cancel(), true);
  assert.equal((await cancelOperation).reason, "cancelled");
  assert.ok(cancelTarget.pendingContinuation, "runtime cancellation keeps durable pending state eligible for explicit retry");
  assert.equal(cancelTarget.segments.filter((entry) => entry.role === "user").length, 1);

  const continuityFailureTarget = {
    ...clone(instance),
    id: "cinema-continuity-failure",
    segments: [{ id: "continuity-opening", sceneId: "scene-1", role: "assistant", text: "Opening remains raw.", status: "complete", createdAt: "2026-01-01T00:00:00.000Z", generationProfileId: "profile-neutral" }],
    notes: contracts.normalizeNotes({ summary: { text: "Opening checkpoint.", coveredThroughOrdinal: 0 } }),
    pendingContinuation: null,
  };
  const continuityFailureStore = mutableStore(continuityFailureTarget);
  const continuityFailure = await new MercuryCinemaGenerationWorkflow({
    store: continuityFailureStore,
    contracts,
    ledger: { advance() { throw Object.assign(new Error("summary unavailable"), { code: "SUMMARY_UNAVAILABLE" }); } },
    transport: {
      connectionStatus: () => ({ ready: true }),
      generateCinema: async (request) => ({ requestId: request.requestId, text: "Assistant prose survives ledger failure." }),
    },
    clock: () => 7000,
  }).runTurn({ instanceId: continuityFailureTarget.id, userText: "User prose survives ledger failure." });
  assert.equal(continuityFailure.accepted, true, "ledger failure does not discard a valid model response");
  assert.equal(continuityFailureTarget.notes.summary.coveredThroughOrdinal, 0, "ledger failure cannot advance coverage");
  assert.equal(continuityFailureTarget.notes.lastFailure.code, "SUMMARY_UNAVAILABLE");
  assert.deepEqual(continuityFailureTarget.segments.slice(-2).map((entry) => entry.text), ["User prose survives ledger failure.", "Assistant prose survives ledger failure."], "both raw story segments remain durable and uncovered");
  assert.equal(continuityFailureTarget.pendingContinuation, null, "the completed raw turn clears pending even when derived continuity fails");

  console.log("cinema-generation-workflow: crash recovery, idempotency, profile, and cancellation assertions passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
