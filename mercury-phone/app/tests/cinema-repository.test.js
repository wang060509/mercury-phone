"use strict";

const assert = require("node:assert/strict");
global.window = global;
require("../core/cinema-stage-catalog.js");
const contracts = require("../core/cinema-contracts.js");
const persistence = require("../system/cinema-repository.js");

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, clone(value)]));
  const writes = [];
  return {
    values,
    writes,
    get(key, fallback) { return values.has(key) ? clone(values.get(key)) : clone(fallback); },
    set(key, value) { writes.push({ key, value: clone(value) }); values.set(key, clone(value)); return value; },
    remove(key) { values.delete(key); },
  };
}

class MemoryCinemaDatabase {
  constructor(options = {}) {
    this.bundle = { root: null, migration: null, instances: [], segments: [] };
    this.commits = [];
    this.replaceCount = 0;
    this.failRead = options.failRead === true;
    this.failReplace = options.failReplace === true;
    this.corruptAfterReplace = options.corruptAfterReplace || null;
  }

  async readBundle() {
    if (this.failRead) throw new Error("simulated IndexedDB read failure");
    return clone(this.bundle);
  }

  async replaceAll(bundle) {
    this.replaceCount += 1;
    if (this.failReplace) throw new Error("simulated copy interruption");
    this.bundle = clone(bundle);
    if (this.corruptAfterReplace === "missing-segment") this.bundle.segments.pop();
    if (this.corruptAfterReplace === "wrong-ordinal" && this.bundle.segments[0]) this.bundle.segments[0].ordinal += 3;
  }

  async commitChanges(change = {}) {
    this.commits.push(clone(change));
    if (change.root !== undefined) this.bundle.root = clone(change.root);
    if (change.migration !== undefined) this.bundle.migration = clone(change.migration);
    const instances = new Map(this.bundle.instances.map((record) => [record.id, record]));
    (change.instanceDeletes || []).forEach((id) => instances.delete(id));
    (change.instancePuts || []).forEach((record) => instances.set(record.id, clone(record)));
    this.bundle.instances = Array.from(instances.values());
    const segments = new Map(this.bundle.segments.map((record) => [record.id, record]));
    (change.segmentDeletes || []).forEach((id) => segments.delete(id));
    (change.segmentPuts || []).forEach((record) => segments.set(record.id, clone(record)));
    this.bundle.segments = Array.from(segments.values()).sort((a, b) => String(a.instanceId).localeCompare(String(b.instanceId)) || a.ordinal - b.ordinal);
  }
}

function makeSegment(instanceId, ordinal, role = ordinal % 2 ? "user" : "assistant", size = 0) {
  return {
    id: `${instanceId}-segment-${ordinal}`,
    sceneId: `${instanceId}-scene-1`,
    role,
    text: size ? `${instanceId}-${ordinal}-`.padEnd(size, String(ordinal % 10)) : `${instanceId} prose ${ordinal}`,
    createdAt: `2026-08-2${ordinal % 9}T08:00:00.000Z`,
    status: ordinal % 11 === 0 ? "pending" : "complete",
    generationProfileId: `${instanceId}-profile`,
  };
}

function makeInstance(id, status, segmentCount = 3, proseSize = 0) {
  return {
    id,
    status,
    stageId: `${id}-stage`,
    stageSnapshot: {
      id: `${id}-stage`, version: 4, title: `${id} Stage`, shortTitle: id, latinTitle: id.toUpperCase(), programmeTitle: `${id} Programme`, region: "Test Region",
      tagline: "Frozen stage", summary: "Snapshot summary", premise: "Snapshot premise", roleConfiguration: { defaultPlayerRole: "observer" }, specializations: ["archive"],
      defaultSpecialization: "archive", relationshipOptions: ["old friends"], places: ["Platform"], worldRules: ["Keep the snapshot"], unavailable: false,
    },
    scenarioId: `${id}-scenario`,
    scenarioSnapshot: { id: `${id}-scenario`, title: `${id} Scenario`, season: "Autumn", summary: "Frozen scenario", entryPeriods: ["Year 16"], defaultEntryPeriod: "Year 16", opening: "Opening prose", unavailable: false },
    title: `${id} title`,
    programmeSubtitle: `${id} subtitle`,
    entryPeriod: "Year 16",
    characterSnapshot: { id: `${id}-character`, displayName: `${id} Character`, identity: "student", summary: "stable", stableTraits: ["patient"], motivations: ["learn"], values: ["truth"], boundaries: ["honesty"], voiceStyle: "quiet", background: "shared past", relationshipSummary: "friends", sourceRevision: 7 },
    player: { name: `${id} Player`, role: "student", specialization: "archive" },
    characterSpecialization: "archive",
    variant: { coreProfileId: `${id}-character`, coreRevision: 7, stableCore: "patient", worldIdentity: "student", contextBackground: "campus", expression: "quiet courage", relationshipStart: "old friends", sharedHistory: "library", userEdited: true },
    generationProfileId: `${id}-profile`,
    generationProfileSnapshot: { id: `${id}-profile`, name: `${id} Profile`, modules: [{ kind: "style", value: "measured" }] },
    runtimeProfileHistory: [{ profileId: `${id}-profile`, snapshot: { id: `${id}-profile`, name: `${id} Profile` }, appliedAt: "2026-08-20T08:00:00.000Z" }],
    scenes: [{ id: `${id}-scene-1`, actNumber: 1, sceneNumber: 1, title: "Arrival", createdAt: "2026-08-20T08:00:00.000Z" }],
    currentSceneId: `${id}-scene-1`,
    segments: Array.from({ length: segmentCount }, (_, ordinal) => makeSegment(id, ordinal, undefined, proseSize)),
    notes: { overview: `${id} overview`, timeline: ["arrival"], people: [`${id} Character`], places: ["Platform"], threads: ["letter"] },
    createdAt: "2026-08-20T08:00:00.000Z",
    updatedAt: "2026-08-20T09:00:00.000Z",
    endedAt: status === "ended" ? "2026-08-21T09:00:00.000Z" : "",
    lastError: null,
  };
}

function makeLegacyState(options = {}) {
  const instances = options.instances || [makeInstance("instance-a", "intermission"), makeInstance("instance-b", "active")];
  const state = {
    schemaVersion: options.schemaVersion || 3,
    hasEntered: true,
    tutorialSeen: true,
    focusedInstanceId: options.focusedInstanceId || "instance-b",
    draft: null,
    instances,
    readingSettings: { fontScale: 1.12, lineHeight: "airy", theme: "night", progressiveReveal: false, actCards: true },
  };
  if (options.legacyFocus === true) {
    state.activeInstanceId = state.focusedInstanceId;
    delete state.focusedInstanceId;
  }
  return state;
}

async function run() {
  const legacy = makeLegacyState();
  const storage = memoryStorage({ [contracts.STORAGE_KEY]: legacy });
  const untouchedLegacy = clone(storage.values.get(contracts.STORAGE_KEY));
  const database = new MemoryCinemaDatabase();
  const repository = new persistence.MercuryIndexedDBCinemaRepository({ legacyStorage: storage, database, catalog: global.MercuryCinemaStageCatalog.PRODUCTION_STAGE_CATALOG });
  const migrated = await repository.load(contracts.createState());

  assert.equal(repository.mode, "indexeddb");
  assert.equal(database.bundle.migration.state, "complete", "migration becomes complete only after read-back verification");
  assert.equal(database.bundle.instances.length, 2);
  assert.equal(database.bundle.segments.length, 6);
  assert.deepEqual(database.bundle.segments.filter((entry) => entry.instanceId === "instance-a").map((entry) => entry.ordinal), [0, 1, 2], "ordinal is persistence ordering truth");
  assert.deepEqual(storage.values.get(contracts.STORAGE_KEY), untouchedLegacy, "legacy cinema.v1 remains byte-for-byte equivalent as parsed data");
  assert.equal(storage.writes.some((entry) => entry.key === contracts.STORAGE_KEY), false, "migration never writes the legacy cinema.v1 key");
  assert.equal(storage.values.get(persistence.AUTHORITY_KEY).state, "authoritative");
  assert.deepEqual(migrated.instances.map((instance) => instance.id), ["instance-a", "instance-b"]);
  assert.equal(migrated.schemaVersion, 4, "legacy Cinema state is normalized to the closure schema");
  assert.deepEqual(migrated.instances[0].structureProvenance, { scenes: "runtime" }, "distinguishable legacy Scene structure receives conservative runtime provenance");
  assert.equal(migrated.instances[0].closureRecord, null);
  assert.deepEqual(migrated.instances[0].stageSnapshot, contracts.normalizeState(legacy).instances[0].stageSnapshot);
  assert.deepEqual(migrated.instances[0].scenarioSnapshot, contracts.normalizeState(legacy).instances[0].scenarioSnapshot);
  assert.deepEqual(migrated.instances[0].characterSnapshot, contracts.normalizeState(legacy).instances[0].characterSnapshot);
  assert.deepEqual(migrated.instances[0].variant, contracts.normalizeState(legacy).instances[0].variant);
  assert.deepEqual(migrated.instances[0].generationProfileSnapshot, contracts.normalizeState(legacy).instances[0].generationProfileSnapshot);

  const replaceCount = database.replaceCount;
  const secondRepository = new persistence.MercuryIndexedDBCinemaRepository({ legacyStorage: storage, database });
  const secondLoad = await secondRepository.load(contracts.createState());
  assert.equal(database.replaceCount, replaceCount, "repeated startup does not duplicate migrated records");
  assert.deepEqual(secondLoad, migrated, "repeated migration produces the same canonical state");

  const profileStorage = memoryStorage({ [contracts.STORAGE_KEY]: makeLegacyState({ instances: [makeInstance("profile-switch", "active")], focusedInstanceId: "profile-switch" }) });
  const profileDatabase = new MemoryCinemaDatabase();
  const profileRepository = new persistence.MercuryIndexedDBCinemaRepository({ legacyStorage: profileStorage, database: profileDatabase });
  const profileState = await profileRepository.load(contracts.createState());
  const switchedProfileState = clone(profileState);
  const switchedInstance = switchedProfileState.instances[0];
  const originalProfileSnapshot = clone(switchedInstance.generationProfileSnapshot);
  const replacementProfile = { id: "profile-replacement", name: "Replacement Profile", modules: [{ kind: "style", value: "spare" }] };
  switchedInstance.generationProfileId = replacementProfile.id;
  switchedInstance.generationProfileSnapshot = clone(replacementProfile);
  switchedInstance.runtimeProfileHistory = [
    { profileId: originalProfileSnapshot.id, snapshot: originalProfileSnapshot, appliedAt: "2026-08-20T08:00:00.000Z" },
    { profileId: replacementProfile.id, snapshot: clone(replacementProfile), appliedAt: "2026-08-20T10:00:00.000Z" },
  ];
  await profileRepository.save(switchedProfileState);
  const profileReload = await new persistence.MercuryIndexedDBCinemaRepository({ legacyStorage: profileStorage, database: profileDatabase }).load(contracts.createState());
  assert.equal(profileReload.instances[0].generationProfileId, replacementProfile.id, "a legitimate runtime Generation Profile switch remains reloadable after migration verification");
  assert.deepEqual(profileReload.instances[0].generationProfileSnapshot, replacementProfile);

  const next = clone(secondLoad);
  next.instances[1].segments.push(makeSegment("instance-b", 3, "assistant"));
  next.instances[1].updatedAt = "2026-08-20T10:00:00.000Z";
  database.commits.length = 0;
  await secondRepository.save(next);
  const appendCommit = database.commits.at(-1);
  assert.equal(appendCommit.segmentPuts.length, 1, "append persists only the new prose segment");
  assert.equal(appendCommit.segmentPuts[0].ordinal, 3);
  assert.equal(appendCommit.instancePuts.length, 1, "append updates only the relevant instance header");
  assert.equal(appendCommit.root, undefined, "append does not rewrite root metadata");
  assert.equal(appendCommit.segmentPuts.some((entry) => entry.id === "instance-a-segment-0"), false, "append never rewrites another story's prose");

  const focusNext = clone(next);
  focusNext.focusedInstanceId = "instance-a";
  database.commits.length = 0;
  await secondRepository.save(focusNext);
  const focusCommit = database.commits.at(-1);
  assert.ok(focusCommit.root, "focus changes persist root metadata");
  assert.equal(focusCommit.instancePuts.length, 0);
  assert.equal(focusCommit.segmentPuts.length, 0);

  const lifecycleNext = clone(focusNext);
  lifecycleNext.instances[0].status = "active";
  lifecycleNext.instances[0].updatedAt = "2026-08-20T11:00:00.000Z";
  database.commits.length = 0;
  await secondRepository.save(lifecycleNext);
  const lifecycleCommit = database.commits.at(-1);
  assert.equal(lifecycleCommit.root, undefined);
  assert.deepEqual(lifecycleCommit.instancePuts.map((entry) => entry.id), ["instance-a"], "lifecycle change writes only the affected instance");
  assert.equal(lifecycleCommit.segmentPuts.length, 0);

  const endingNext = clone(lifecycleNext);
  endingNext.instances[0].status = "ending";
  endingNext.instances[0].closureRecord = { version: 1, initiatedAt: "2026-08-20T11:05:00.000Z", pendingDisposition: null };
  endingNext.instances[0].updatedAt = "2026-08-20T11:05:00.000Z";
  await secondRepository.save(endingNext);
  const finishedNext = clone(endingNext);
  finishedNext.instances[0].status = "ended";
  finishedNext.instances[0].endedAt = "2026-08-20T11:06:00.000Z";
  finishedNext.instances[0].updatedAt = "2026-08-20T11:06:00.000Z";
  finishedNext.focusedInstanceId = "instance-b";
  database.commits.length = 0;
  await secondRepository.save(finishedNext);
  const finishCommit = database.commits.at(-1);
  assert.equal(database.commits.length, 1, "finish maps to one IndexedDB commitChanges transaction");
  assert.equal(finishCommit.root.focusedInstanceId, "instance-b", "atomic finish transaction includes root focus reassignment");
  assert.deepEqual(finishCommit.instancePuts.map((entry) => entry.id), ["instance-a"], "atomic finish transaction includes the ended Instance header");
  assert.equal(finishCommit.instancePuts[0].status, "ended");
  assert.equal(finishCommit.instancePuts[0].closureRecord.initiatedAt, "2026-08-20T11:05:00.000Z");
  assert.equal(finishCommit.segmentPuts.length, 0, "closure metadata and focus never rewrite canonical prose");

  const afterAppendRepository = new persistence.MercuryIndexedDBCinemaRepository({ legacyStorage: storage, database });
  const afterAppend = await afterAppendRepository.load(contracts.createState());
  assert.deepEqual(afterAppend.instances[1].segments.map((entry) => entry.id), ["instance-b-segment-0", "instance-b-segment-1", "instance-b-segment-2", "instance-b-segment-3"]);
  assert.deepEqual(afterAppend.instances[0].segments.map((entry) => entry.id), ["instance-a-segment-0", "instance-a-segment-1", "instance-a-segment-2"], "prose never crosses instances");

  const atomicLegacy = makeLegacyState({ instances: [makeInstance("atomic-turn", "active")], focusedInstanceId: "atomic-turn" });
  const atomicStorage = memoryStorage({ [contracts.STORAGE_KEY]: atomicLegacy });
  const atomicDatabase = new MemoryCinemaDatabase();
  const atomicRepository = new persistence.MercuryIndexedDBCinemaRepository({ legacyStorage: atomicStorage, database: atomicDatabase });
  const atomicLoaded = await atomicRepository.load(contracts.createState());
  const atomicPending = clone(atomicLoaded);
  atomicPending.instances[0].segments.push(makeSegment("atomic-turn", 3, "user"));
  atomicPending.instances[0].pendingContinuation = { requestId: "request-atomic", userSegmentId: "atomic-turn-segment-3", startedAt: "2026-08-20T09:00:00.000Z", generationProfileId: "atomic-turn-profile" };
  await atomicRepository.save(atomicPending);
  const atomicComplete = clone(atomicPending);
  atomicComplete.instances[0].segments.push(makeSegment("atomic-turn", 4, "assistant"));
  atomicComplete.instances[0].pendingContinuation = null;
  atomicComplete.instances[0].notes = contracts.normalizeNotes({ summary: { text: "Atomic turn committed.", coveredThroughOrdinal: 4 } });
  atomicDatabase.commits.length = 0;
  await atomicRepository.save(atomicComplete);
  const atomicCommit = atomicDatabase.commits.at(-1);
  assert.equal(atomicCommit.segmentPuts.length, 1, "assistant prose is one segment put");
  assert.equal(atomicCommit.instancePuts.length, 1, "notes and pending clear are one instance-header put");
  assert.equal(atomicCommit.instancePuts[0].pendingContinuation, null);
  assert.equal(atomicCommit.instancePuts[0].notes.summary.coveredThroughOrdinal, 4, "coverage advances in the same IndexedDB change set as assistant prose");
  const atomicReload = await new persistence.MercuryIndexedDBCinemaRepository({ legacyStorage: atomicStorage, database: atomicDatabase }).load(contracts.createState());
  assert.equal(atomicReload.instances[0].segments.at(-1).id, "atomic-turn-segment-4");
  assert.equal(atomicReload.instances[0].pendingContinuation, null);
  assert.equal(atomicReload.instances[0].notes.summary.coveredThroughOrdinal, 4, "reload cannot observe assistant prose without its committed continuity header");

  const interruptedStorage = memoryStorage({ [contracts.STORAGE_KEY]: legacy });
  const interruptedDatabase = new MemoryCinemaDatabase({ failReplace: true });
  const interrupted = new persistence.MercuryIndexedDBCinemaRepository({ legacyStorage: interruptedStorage, database: interruptedDatabase });
  const legacyAfterInterruption = await interrupted.load(contracts.createState());
  assert.equal(interrupted.mode, "legacy");
  assert.equal(interruptedDatabase.bundle.migration, null, "an interrupted copy cannot create a complete marker");
  assert.deepEqual(interruptedStorage.values.get(contracts.STORAGE_KEY), legacy);
  assert.equal(interruptedStorage.writes.some((entry) => entry.key === contracts.STORAGE_KEY), false);
  assert.deepEqual(legacyAfterInterruption.instances.map((entry) => entry.id), ["instance-a", "instance-b"]);
  interruptedDatabase.failReplace = false;
  const retry = new persistence.MercuryIndexedDBCinemaRepository({ legacyStorage: interruptedStorage, database: interruptedDatabase });
  await retry.load(contracts.createState());
  assert.equal(interruptedDatabase.bundle.migration.state, "complete", "migration can be retried after copy interruption");

  for (const corruption of ["missing-segment", "wrong-ordinal"]) {
    const failedStorage = memoryStorage({ [contracts.STORAGE_KEY]: legacy });
    const failedDatabase = new MemoryCinemaDatabase({ corruptAfterReplace: corruption });
    const failedRepository = new persistence.MercuryIndexedDBCinemaRepository({ legacyStorage: failedStorage, database: failedDatabase });
    const fallback = await failedRepository.load(contracts.createState());
    assert.equal(failedRepository.mode, "legacy", `${corruption} keeps legacy authoritative`);
    assert.notEqual(failedDatabase.bundle.migration.state, "complete", `${corruption} cannot mark migration complete`);
    assert.deepEqual(failedStorage.values.get(contracts.STORAGE_KEY), legacy);
    assert.deepEqual(fallback.instances.map((entry) => entry.id), ["instance-a", "instance-b"]);
  }

  const v2 = makeLegacyState({ schemaVersion: 2, legacyFocus: true });
  const v2Storage = memoryStorage({ [contracts.STORAGE_KEY]: v2 });
  const v2Database = new MemoryCinemaDatabase();
  const v2Repository = new persistence.MercuryIndexedDBCinemaRepository({ legacyStorage: v2Storage, database: v2Database });
  const v2Migrated = await v2Repository.load(contracts.createState());
  assert.equal(v2Migrated.focusedInstanceId, "instance-b", "legacy activeInstanceId hydrates as focusedInstanceId");
  assert.deepEqual(v2Migrated.instances.map((entry) => entry.status), ["intermission", "active"], "multiple unfinished lifecycle states survive migration");

  const largeLegacy = makeLegacyState({ instances: [makeInstance("large-a", "active", 400, 256), makeInstance("large-b", "intermission", 250, 192)], focusedInstanceId: "large-a" });
  const largeStorage = memoryStorage({ [contracts.STORAGE_KEY]: largeLegacy });
  const largeDatabase = new MemoryCinemaDatabase();
  const largeRepository = new persistence.MercuryIndexedDBCinemaRepository({ legacyStorage: largeStorage, database: largeDatabase });
  const largeState = await largeRepository.load(contracts.createState());
  const largeNext = clone(largeState);
  largeNext.instances[0].segments.push(makeSegment("large-a", 400, "user", 300));
  largeDatabase.commits.length = 0;
  await largeRepository.save(largeNext);
  assert.equal(largeDatabase.commits.at(-1).segmentPuts.length, 1, "large-prose append writes one segment, not all stored prose");
  const largeReload = await new persistence.MercuryIndexedDBCinemaRepository({ legacyStorage: largeStorage, database: largeDatabase }).load(contracts.createState());
  assert.equal(largeReload.instances[0].segments.length, 401);
  assert.equal(largeReload.instances[1].segments.length, 250);
  assert.equal(largeReload.instances[0].segments.at(-1).id, "large-a-segment-400");

  const unavailableDatabase = new MemoryCinemaDatabase({ failRead: true });
  const unavailableStorage = memoryStorage({
    [contracts.STORAGE_KEY]: legacy,
    [persistence.AUTHORITY_KEY]: { state: "authoritative", sourceDigest: "verified", targetRevision: persistence.TARGET_REVISION },
  });
  const unavailableRepository = new persistence.MercuryIndexedDBCinemaRepository({ legacyStorage: unavailableStorage, database: unavailableDatabase });
  await assert.rejects(() => unavailableRepository.load(contracts.createState()), (error) => error.code === "CINEMA_AUTHORITATIVE_IDB_UNAVAILABLE", "authoritative IDB failure never silently loads stale legacy prose");

  console.log("cinema-repository: migration, verification, failure recovery, ordinal, and large-prose assertions passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
