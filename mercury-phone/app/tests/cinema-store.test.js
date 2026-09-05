"use strict";

const assert = require("node:assert/strict");
global.window = global;
require("../core/cinema-contracts.js");
require("../system/cinema-store.js");
const quietStation = require("./fixtures/quiet-station-stage.js");

const clone = (value) => JSON.parse(JSON.stringify(value));

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    get(key, fallback) { return values.has(key) ? clone(values.get(key)) : fallback; },
    set(key, value) { values.set(key, clone(value)); return value; },
    remove(key) { values.delete(key); },
  };
}

async function run() {
  let now = Date.parse("2026-08-20T08:00:00.000Z");
  const storage = memoryStorage();
  const store = new global.MercuryCinemaStore({ storage, clock: () => now });
  const events = [];
  store.subscribe((event) => events.push(event.type));
  assert.throws(() => store.markEntered(), (error) => error.code === "CINEMA_STORE_NOT_READY", "writes are gated until async hydration completes");
  await store.ready;

  function openInstance(characterId, displayName, profileId) {
    store.beginDraft();
    store.updateDraft({
      characterId,
      characterSnapshot: { id: characterId, displayName, stableTraits: ["乐观"] },
      playerName: "米拉",
      relationshipStart: "多年好友",
      generationProfileId: profileId,
      generationProfileSnapshot: { id: profileId, name: `${displayName}的演绎方式` },
    });
    const instance = store.openCurtain();
    now += 60000;
    return instance;
  }

store.markEntered();
store.markTutorialSeen();
const instanceA = openInstance("character-lumi", "露弥", "profile-quiet");
assert.equal(store.focused().id, instanceA.id);
assert.equal(store.snapshot().draft, null);
await store.flush();
assert.ok(storage.values.has(global.MercuryCinemaContracts.STORAGE_KEY));

store.appendUser(instanceA.id, "我把分流表折起来，先问她想去哪里。 ");
store.appendAssistant(instanceA.id, "露弥停在白阶边，认真看了看你。", "profile-quiet");
assert.equal(store.focused().segments.at(-2).role, "user");
assert.equal(store.focused().segments.at(-2).text.endsWith(" "), false, "passages are trimmed before persistence");

const guardedUser = store.appendUser(instanceA.id, "这段文字需要精确绑定续写。 ");
store.markPendingContinuation(instanceA.id, { requestId: "request-guarded", userSegmentId: guardedUser.id, startedAt: "2026-08-20T08:01:00.000Z", generationProfileId: "profile-quiet" });
const beforeGuardedCommit = store.get(instanceA.id).segments.length;
assert.equal(store.commitAssistantTurn(instanceA.id, {
  requestId: "request-stale",
  userSegmentId: guardedUser.id,
  assistantText: "This stale response must not be appended.",
}), null, "an assistant response with a stale request identity cannot commit");
assert.equal(store.get(instanceA.id).segments.length, beforeGuardedCommit);
assert.equal(store.get(instanceA.id).pendingContinuation.requestId, "request-guarded");
const guardedAssistant = store.commitAssistantTurn(instanceA.id, {
  requestId: "request-guarded",
  userSegmentId: guardedUser.id,
  assistantText: "露弥把这段回应稳稳接了下来。",
  generationProfileId: "profile-quiet",
  notes: { summary: { text: "精确绑定的段落已经完成。", coveredThroughOrdinal: beforeGuardedCommit }, coverage: { coveredThroughOrdinal: beforeGuardedCommit } },
});
assert.equal(guardedAssistant.role, "assistant");
assert.equal(store.get(instanceA.id).pendingContinuation, null, "assistant, continuity, and pending clear enter one Store snapshot");
assert.equal(store.get(instanceA.id).notes.summary.coveredThroughOrdinal, beforeGuardedCommit);

store.failGeneration(instanceA.id, Object.assign(new Error("暂时无法连接"), { code: "AI_CONNECTION_UNAVAILABLE", recovery: "ai-connection" }));
assert.equal(store.focused().lastError.recovery, "ai-connection");
store.clearError(instanceA.id);
assert.equal(store.focused().lastError, null);

const initialScenes = clone(store.focused().scenes);
const initialSceneId = store.focused().currentSceneId;
for (let cycle = 0; cycle < 3; cycle += 1) {
  store.intermission(instanceA.id);
  assert.equal(store.focused().status, "intermission");
  now += 60000;
  store.resume(instanceA.id);
  assert.equal(store.focused().status, "active");
  assert.deepEqual(store.focused().scenes, initialScenes, "intermission/resume never creates an Act or Scene");
  assert.equal(store.focused().currentSceneId, initialSceneId);
}

store.applyGenerationProfile(instanceA.id, { id: "profile-brisk", name: "轻快推进" });
assert.equal(store.focused().generationProfileId, "profile-brisk");
assert.equal(store.focused().runtimeProfileHistory.length, 2);
store.updateReadingSettings({ theme: "night", fontScale: 9 });
assert.equal(store.snapshot().readingSettings.theme, "night");
assert.equal(store.snapshot().readingSettings.fontScale, 1.18, "reading scale stays inside the approved range");

store.intermission(instanceA.id);
const instanceB = openInstance("character-river", "里弗", "profile-neutral");
assert.equal(store.focused().id, instanceB.id, "opening a new instance only changes UI focus");
assert.deepEqual(store.listUnfinished().map((item) => item.id).sort(), [instanceA.id, instanceB.id].sort(), "both unfinished instances remain queryable");
assert.equal(store.get(instanceA.id).status, "intermission", "opening B preserves A lifecycle");
assert.equal(store.get(instanceB.id).status, "active");
const pendingBUser = store.appendUser(instanceB.id, "把这段未完成续写留在原地。 ");
store.markPendingContinuation(instanceB.id, { requestId: "request-lifecycle-b", userSegmentId: pendingBUser.id, startedAt: "2026-08-20T08:10:00.000Z", generationProfileId: "profile-neutral" });
const pendingBScenes = clone(store.get(instanceB.id).scenes);
store.intermission(instanceB.id);
store.resume(instanceB.id);
assert.deepEqual(store.get(instanceB.id).scenes, pendingBScenes, "pending continuation does not turn pause/resume into a narrative boundary");
assert.equal(store.get(instanceB.id).pendingContinuation.requestId, "request-lifecycle-b");

const beforeFocusA = clone(store.get(instanceA.id));
store.focusInstance(instanceA.id);
assert.equal(store.focused().id, instanceA.id);
assert.equal(store.get(instanceA.id).status, beforeFocusA.status, "focusing A does not resume it");
assert.deepEqual(store.get(instanceA.id).scenes, beforeFocusA.scenes, "focusing A does not create narrative structure");
store.resume(instanceA.id);
assert.equal(store.focused().status, "active");
assert.deepEqual(store.focused().scenes, beforeFocusA.scenes);

const beforeFocusB = clone(store.get(instanceB.id));
store.focusInstance(instanceB.id);
assert.equal(store.focused().id, instanceB.id);
assert.deepEqual(store.get(instanceB.id).scenes, beforeFocusB.scenes);
assert.equal(store.get(instanceB.id).status, "active", "focusing B preserves its lifecycle");

await store.flush();
const reloadedWithBoth = new global.MercuryCinemaStore({ storage, clock: () => now });
await reloadedWithBoth.ready;
assert.equal(reloadedWithBoth.focused().id, instanceB.id);
assert.deepEqual(reloadedWithBoth.listUnfinished().map((item) => item.id).sort(), [instanceA.id, instanceB.id].sort(), "reload keeps both unfinished instances reachable");
assert.deepEqual(reloadedWithBoth.get(instanceA.id).scenes, beforeFocusA.scenes, "reload is not a narrative boundary");
assert.deepEqual(reloadedWithBoth.get(instanceB.id).scenes, pendingBScenes, "reload with pending continuation does not advance Scene");
assert.equal(reloadedWithBoth.get(instanceB.id).pendingContinuation.requestId, "request-lifecycle-b", "reload preserves pending operation identity without resending it");

store.beginEnding(instanceA.id);
assert.equal(store.get(instanceA.id).status, "ending");
assert.equal(store.focused().id, instanceB.id, "ending A does not steal focus from B");
assert.equal(store.get(instanceB.id).status, "active", "ending A does not alter B lifecycle");
now += 60000;
store.finish(instanceA.id);
assert.equal(store.get(instanceA.id).status, "ended");
assert.equal(store.focused().id, instanceB.id);
assert.deepEqual(store.listUnfinished().map((item) => item.id), [instanceB.id]);
assert.equal(store.listPast()[0].id, instanceA.id);

const legacyRaw = clone(storage.values.get(global.MercuryCinemaContracts.STORAGE_KEY));
legacyRaw.activeInstanceId = legacyRaw.focusedInstanceId;
delete legacyRaw.focusedInstanceId;
legacyRaw.instances[0].status = "intermission";
legacyRaw.instances[0].endedAt = "";
const repositoryCalls = { load: 0, save: 0 };
const repository = {
  async load(fallback) { repositoryCalls.load += 1; return legacyRaw || fallback; },
  async save(value) { repositoryCalls.save += 1; this.value = clone(value); return value; },
};
const migrated = new global.MercuryCinemaStore({ repository, clock: () => now });
await migrated.ready;
assert.equal(repositoryCalls.load, 1, "CinemaStore loads through the repository seam");
assert.equal(migrated.focused().id, instanceB.id, "legacy activeInstanceId becomes focusedInstanceId");
assert.equal(migrated.listUnfinished().length, 2, "legacy hydration never discards other stored instances");
migrated.markEntered();
await migrated.flush();
assert.equal(repositoryCalls.save, 1, "CinemaStore saves through the repository seam");
assert.equal(repository.value.focusedInstanceId, instanceB.id);
assert.equal("activeInstanceId" in repository.value, false);

const neutralCatalog = global.MercuryCinemaStageCatalog.createStageCatalog([quietStation]);
let coalescedPersisted = null;
const coalescedSaves = [];
const coalescedRepository = {
  async load(fallback) { return coalescedPersisted ? clone(coalescedPersisted) : fallback; },
  async save(value) { coalescedPersisted = clone(value); coalescedSaves.push(clone(value)); },
};
const coalescedStore = new global.MercuryCinemaStore({ repository: coalescedRepository, catalog: neutralCatalog, clock: () => now, draftPersistenceDelay: 10000 });
await coalescedStore.ready;
coalescedStore.beginDraft(quietStation.id);
await coalescedStore.flush();
coalescedSaves.length = 0;
coalescedStore.updateDraft({ playerName: "米" });
coalescedStore.updateDraft({ playerName: "米拉" });
coalescedStore.updateDraft({ playerName: "米拉的完整名字" });
assert.equal(coalescedStore.snapshot().draft.playerName, "米拉的完整名字", "rapid Draft input updates in-memory state immediately");
await Promise.resolve();
assert.equal(coalescedSaves.length, 0, "rapid Draft input does not persist once per keystroke");
await coalescedStore.flushDraftPersistence();
assert.equal(coalescedSaves.length, 1, "an explicit navigation-style flush persists one latest Draft snapshot");
assert.equal(coalescedSaves[0].draft.playerName, "米拉的完整名字");
const coalescedReload = new global.MercuryCinemaStore({ repository: coalescedRepository, catalog: neutralCatalog, clock: () => now });
await coalescedReload.ready;
assert.equal(coalescedReload.snapshot().draft.playerName, "米拉的完整名字", "the latest coalesced Draft survives reload");

const openingSaves = [];
const openingRepository = {
  async load(fallback) { return fallback; },
  async save(value) { openingSaves.push(clone(value)); },
};
const openingStore = new global.MercuryCinemaStore({ repository: openingRepository, catalog: neutralCatalog, clock: () => now, draftPersistenceDelay: 10000 });
await openingStore.ready;
openingStore.beginDraft(quietStation.id);
await openingStore.flush();
openingSaves.length = 0;
openingStore.updateDraft({
  playerName: "River",
  characterId: "character-opening-flush",
  characterSnapshot: { id: "character-opening-flush", displayName: "River", stableTraits: ["patient"] },
  generationProfileId: "profile-opening-flush",
  generationProfileSnapshot: { id: "profile-opening-flush", name: "Opening Flush" },
});
const flushedOpeningInstance = openingStore.openCurtain();
await openingStore.flush();
assert.equal(openingSaves.length, 2, "openCurtain flushes the latest Draft before persisting the created Instance");
assert.equal(openingSaves[0].draft.playerName, "River");
assert.equal(openingSaves[1].draft, null);
assert.equal(openingSaves[1].instances[0].id, flushedOpeningInstance.id);

const neutralStore = new global.MercuryCinemaStore({ storage: memoryStorage(), catalog: neutralCatalog, clock: () => now });
await neutralStore.ready;
neutralStore.beginDraft(quietStation.id);
neutralStore.updateDraft({
  characterId: "character-neutral",
  characterSnapshot: { id: "character-neutral", displayName: "River", stableTraits: ["patient"] },
  generationProfileId: "profile-neutral",
  generationProfileSnapshot: { id: "profile-neutral", name: "Neutral" },
});
const neutralInstance = neutralStore.openCurtain();
assert.equal(neutralInstance.stageSnapshot.title, "The Quiet Station");
assert.equal(neutralInstance.player.specialization, "");
const neutralScenes = clone(neutralInstance.scenes);
neutralStore.intermission(neutralInstance.id);
neutralStore.resume(neutralInstance.id);
assert.equal(neutralStore.focused().status, "active", "a non-academic Stage uses the normal lifecycle");
assert.deepEqual(neutralStore.focused().scenes, neutralScenes, "neutral Stage resume does not create narrative structure");

assert.ok(events.includes("instance-paused"));
assert.ok(events.includes("instance-focused"));
assert.ok(events.includes("instance-ended"));
await store.flush();
await neutralStore.flush();

let releaseFirstSave;
const firstSaveGate = new Promise((resolve) => { releaseFirstSave = resolve; });
let savesStarted = 0;
let inFlight = 0;
let maxInFlight = 0;
const savedStates = [];
const queuedRepository = {
  async load(fallback) { return fallback; },
  async save(value) {
    savesStarted += 1;
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    if (savesStarted === 1) await firstSaveGate;
    savedStates.push(clone(value));
    inFlight -= 1;
  },
};
const queuedStore = new global.MercuryCinemaStore({ repository: queuedRepository, clock: () => now });
await queuedStore.ready;
queuedStore.markEntered();
queuedStore.markTutorialSeen();
await Promise.resolve();
assert.equal(savesStarted, 1, "the second persistence write waits behind the first");
releaseFirstSave();
await queuedStore.flush();
assert.equal(maxInFlight, 1, "Cinema persistence writes are serialized");
assert.equal(savedStates.length, 2);
assert.equal(savedStates[0].hasEntered, true);
assert.equal(savedStates[0].tutorialSeen, false);
assert.equal(savedStates[1].tutorialSeen, true, "serialized snapshots preserve mutation order");

const failingRepository = {
  async load(fallback) { return fallback; },
  async save() { throw new Error("simulated quota failure"); },
};
const failingStore = new global.MercuryCinemaStore({ repository: failingRepository, clock: () => now });
await failingStore.ready;
failingStore.markEntered();
await assert.rejects(() => failingStore.flush(), (error) => error.code === "CINEMA_STORAGE_WRITE_FAILED", "flush exposes asynchronous persistence failure");
assert.throws(() => failingStore.markTutorialSeen(), (error) => error.code === "CINEMA_STORAGE_WRITE_FAILED", "a failed Store becomes write-blocked instead of accumulating unsaved state");

console.log("cinema-store: lifecycle, focus, hydration, and repository assertions passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
