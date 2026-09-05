"use strict";

const assert = require("node:assert/strict");
global.window = global;

const stageCatalogModule = require("../core/cinema-stage-catalog.js");
const contracts = require("../core/cinema-contracts.js");
const CinemaStore = require("../system/cinema-store.js");
const CinemaClosureWorkflow = require("../use-cases/cinema-closure-workflow.js");
const quietStation = require("./fixtures/quiet-station-stage.js");

const clone = (value) => JSON.parse(JSON.stringify(value));
const catalog = stageCatalogModule.createStageCatalog([quietStation]);
const startedAt = "2026-09-05T01:00:00.000Z";

function instance(id, options = {}) {
  const sceneId = `${id}-scene`;
  const segments = [
    { id: `${id}-opening`, sceneId, role: "assistant", text: "The curtain opened.", status: "complete", createdAt: startedAt, generationProfileId: "profile-closure" },
    { id: `${id}-user`, sceneId, role: "user", text: "I left the final line unanswered.", status: "complete", createdAt: startedAt, generationProfileId: "profile-closure" },
  ];
  return contracts.normalizeInstance({
    id,
    status: options.status || "active",
    structureProvenance: { scenes: "runtime" },
    stageId: quietStation.id,
    stageSnapshot: contracts.createStageSnapshot(quietStation),
    scenarioId: quietStation.scenarios[0].id,
    scenarioSnapshot: contracts.createScenarioSnapshot(quietStation.scenarios[0]),
    title: `${id} Performance`,
    characterSnapshot: { id: `${id}-character`, displayName: "Closure Character" },
    player: { name: "Player", role: "traveler", specialization: "" },
    scenes: [{ id: sceneId, actNumber: 1, sceneNumber: 1, title: "Last Platform", createdAt: startedAt }],
    currentSceneId: sceneId,
    segments,
    pendingContinuation: options.pending ? { requestId: `${id}-request`, userSegmentId: `${id}-user`, startedAt, generationProfileId: "profile-closure" } : null,
    closureRecord: options.closureRecord || null,
    createdAt: startedAt,
    updatedAt: startedAt,
  }, catalog);
}

function state(instances, focusedInstanceId) {
  return contracts.normalizeState({ ...contracts.createState(), hasEntered: true, tutorialSeen: true, focusedInstanceId, instances }, catalog);
}

function memoryRepository(initial, options = {}) {
  return {
    value: clone(initial),
    saves: [],
    async load() { return clone(this.value); },
    async save(next) {
      if (options.gate) await options.gate;
      if (options.failSave) throw Object.assign(new Error("simulated storage failure"), { code: "TEST_STORAGE_FAILURE" });
      this.value = clone(next);
      this.saves.push(clone(next));
      return clone(next);
    },
  };
}

async function createHarness(initial, options = {}) {
  let now = Date.parse(startedAt);
  const repository = options.repository || memoryRepository(initial);
  const store = new CinemaStore({ repository, catalog, clock: () => { now += 1000; return now; } });
  await store.ready;
  const generationWorkflow = options.generationWorkflow || { snapshot: () => ({ phase: "idle", requestId: null }) };
  const workflow = new CinemaClosureWorkflow({ store, generationWorkflow });
  return { repository, store, workflow };
}

async function run() {
  const normal = instance("normal");
  const other = instance("other", { status: "intermission" });
  let harness = await createHarness(state([normal, other], normal.id));
  const events = [];
  harness.store.subscribe((event) => events.push(event.type));
  const begun = await harness.workflow.beginEnding(normal.id);
  assert.equal(begun.accepted, true);
  assert.equal(harness.store.get(normal.id).status, "ending");
  assert.deepEqual(harness.store.get(normal.id).closureRecord.pendingDisposition, null);
  assert.equal(harness.repository.saves.length, 1, "begin ending is one durable Store snapshot");

  harness.repository.saves.length = 0;
  const finished = await harness.workflow.finishEnding(normal.id);
  assert.equal(finished.accepted, true);
  assert.equal(harness.store.get(normal.id).status, "ended");
  assert.equal(harness.store.snapshot().focusedInstanceId, other.id);
  assert.equal(harness.repository.saves.length, 1, "ended state and focus reassignment persist in one snapshot");
  assert.equal(harness.repository.saves[0].instances.find((item) => item.id === normal.id).status, "ended");
  assert.equal(harness.repository.saves[0].focusedInstanceId, other.id);
  assert.deepEqual(events, ["ending-started", "instance-ended"], "finish no longer emits a separate focus-cleared commit");

  const pending = instance("pending", { pending: true });
  harness = await createHarness(state([pending], pending.id));
  const beforeSegments = clone(harness.store.get(pending.id).segments);
  await assert.rejects(() => harness.workflow.beginEnding(pending.id), (error) => error.code === "CINEMA_PENDING_CONTINUATION_REQUIRES_DISPOSITION");
  assert.equal(harness.store.get(pending.id).status, "active");
  await assert.rejects(() => harness.workflow.abandonPendingAndBeginEnding(pending.id, "stale-request"), (error) => error.code === "CINEMA_PENDING_REQUEST_ID_MISMATCH");
  assert.equal(harness.store.get(pending.id).pendingContinuation.requestId, "pending-request");
  const abandoned = await harness.workflow.abandonPendingAndBeginEnding(pending.id, "pending-request");
  assert.equal(abandoned.accepted, true);
  const afterAbandon = harness.store.get(pending.id);
  assert.equal(afterAbandon.status, "ending");
  assert.equal(afterAbandon.pendingContinuation, null);
  assert.deepEqual(afterAbandon.segments, beforeSegments, "pending abandonment preserves every Segment and its ordinal");
  assert.deepEqual(afterAbandon.closureRecord.pendingDisposition, {
    kind: "abandoned-by-user",
    requestId: "pending-request",
    userSegmentId: "pending-user",
    startedAt,
    settledAt: afterAbandon.closureRecord.pendingDisposition.settledAt,
  });
  const savesAfterAbandon = harness.repository.saves.length;
  const repeated = await harness.workflow.abandonPendingAndBeginEnding(pending.id, "pending-request");
  assert.equal(repeated.accepted, true);
  assert.equal(harness.repository.saves.length, savesAfterAbandon, "repeated abandonment is idempotent and queues no second state write");
  await assert.rejects(() => harness.workflow.abandonPendingAndBeginEnding(pending.id, "different-request"), (error) => error.code === "CINEMA_PENDING_REQUEST_ID_MISMATCH");
  assert.equal(harness.store.commitAssistantTurn(pending.id, { requestId: "pending-request", userSegmentId: "pending-user", assistantText: "Late provider response." }), null, "late provider response cannot commit after pending abandonment");
  const reloaded = new CinemaStore({ repository: harness.repository, catalog, clock: () => Date.parse("2026-09-05T01:10:00.000Z") });
  await reloaded.ready;
  assert.equal(reloaded.get(pending.id).status, "ending");
  assert.equal(reloaded.get(pending.id).closureRecord.pendingDisposition.requestId, "pending-request");
  assert.equal(reloaded.get(pending.id).pendingContinuation, null, "reload after abandonment preserves the settled disposition");

  const activeGeneration = instance("active-generation", { pending: true });
  harness = await createHarness(state([activeGeneration], activeGeneration.id), { generationWorkflow: { snapshot: () => ({ phase: "running", requestId: "active-generation-request" }) } });
  await assert.rejects(() => harness.workflow.abandonPendingAndBeginEnding(activeGeneration.id, "active-generation-request"), (error) => error.code === "CINEMA_CLOSURE_GENERATION_ACTIVE");
  assert.equal(harness.store.get(activeGeneration.id).status, "active");
  assert.equal(harness.store.get(activeGeneration.id).pendingContinuation.requestId, "active-generation-request", "in-flight generation must settle before closure changes durable identity");

  let releaseSave;
  const saveGate = new Promise((resolve) => { releaseSave = resolve; });
  const duplicate = instance("duplicate");
  const delayedRepository = memoryRepository(state([duplicate], duplicate.id), { gate: saveGate });
  harness = await createHarness(delayedRepository.value, { repository: delayedRepository });
  const firstOperation = harness.workflow.beginEnding(duplicate.id);
  const duplicateOperation = await harness.workflow.beginEnding(duplicate.id);
  assert.deepEqual(duplicateOperation, { accepted: false, reason: "busy" }, "duplicate activation cannot re-enter a persisting closure transition");
  releaseSave();
  assert.equal((await firstOperation).accepted, true);
  assert.equal(delayedRepository.saves.length, 1);

  const storageFailure = instance("storage-failure");
  const durableBeforeFailure = state([storageFailure], storageFailure.id);
  const failingRepository = memoryRepository(durableBeforeFailure, { failSave: true });
  harness = await createHarness(durableBeforeFailure, { repository: failingRepository });
  await assert.rejects(() => harness.workflow.beginEnding(storageFailure.id), (error) => error.code === "CINEMA_STORAGE_WRITE_FAILED");
  assert.equal(harness.workflow.snapshot().phase, "failed");
  assert.equal(harness.store.get(storageFailure.id).status, "ending", "uncertain in-memory state never becomes a Credits success signal");
  const reloadAfterFailure = new CinemaStore({ repository: failingRepository, catalog });
  await reloadAfterFailure.ready;
  assert.equal(reloadAfterFailure.get(storageFailure.id).status, "active", "reload recovers the last durable state after closure persistence failure");

  const durableEnding = instance("durable-ending", { status: "ending", closureRecord: { version: 1, initiatedAt: startedAt, pendingDisposition: null } });
  harness = await createHarness(state([durableEnding], durableEnding.id));
  assert.equal((await harness.workflow.finishEnding(durableEnding.id)).accepted, true, "a durable ending state can safely finish after reload");
  assert.equal(harness.store.get(durableEnding.id).status, "ended");

  console.log("cinema-closure-workflow: durable ending, pending disposition, race, idempotency, and failure assertions passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
