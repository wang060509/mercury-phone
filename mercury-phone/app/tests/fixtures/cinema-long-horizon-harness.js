"use strict";

const { webcrypto } = require("node:crypto");
if (!global.crypto?.subtle) global.crypto = webcrypto;
global.window = global;

const stageCatalogModule = require("../../core/cinema-stage-catalog.js");
global.MercuryCinemaStageCatalog = stageCatalogModule;
const contracts = require("../../core/cinema-contracts.js");
global.MercuryCinemaContracts = contracts;
const persistence = require("../../system/cinema-repository.js");
global.MercuryCinemaPersistence = persistence;
const MercuryCinemaStore = require("../../system/cinema-store.js");
const compiler = require("../../use-cases/cinema-context-compiler.js");
const ledger = require("../../use-cases/cinema-continuity-ledger.js");
const MercuryCinemaGenerationWorkflow = require("../../use-cases/cinema-generation-workflow.js");
const fixture = require("./cinema-long-horizon-fixture.js");

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const textSize = (value) => typeof value === "string" ? value.trim().length : 0;

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, clone(value)]));
  return {
    values,
    get(key, fallback) { return values.has(key) ? clone(values.get(key)) : clone(fallback); },
    set(key, value) { values.set(key, clone(value)); return value; },
    remove(key) { values.delete(key); },
  };
}

class MemoryCinemaDatabase {
  constructor() {
    this.bundle = { root: null, migration: null, instances: [], segments: [] };
    this.commits = [];
    this.failNextCommit = false;
  }

  async readBundle() { return clone(this.bundle); }

  async replaceAll(bundle) { this.bundle = clone(bundle); }

  async commitChanges(change = {}) {
    if (this.failNextCommit) {
      this.failNextCommit = false;
      throw new Error("deterministic IndexedDB commit failure");
    }
    this.commits.push(clone(change));
    const next = clone(this.bundle);
    if (change.root !== undefined) next.root = clone(change.root);
    if (change.migration !== undefined) next.migration = clone(change.migration);
    const instances = new Map(next.instances.map((record) => [record.id, record]));
    (change.instanceDeletes || []).forEach((id) => instances.delete(id));
    (change.instancePuts || []).forEach((record) => instances.set(record.id, clone(record)));
    next.instances = Array.from(instances.values());
    const segments = new Map(next.segments.map((record) => [record.id, record]));
    (change.segmentDeletes || []).forEach((id) => segments.delete(id));
    (change.segmentPuts || []).forEach((record) => segments.set(record.id, clone(record)));
    next.segments = Array.from(segments.values()).sort((a, b) => String(a.instanceId).localeCompare(String(b.instanceId)) || a.ordinal - b.ordinal);
    this.bundle = next;
  }
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
  return { promise, resolve, reject };
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)];
}

function statistics(values) {
  if (!values.length) return { min: 0, max: 0, median: 0, p95: 0 };
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    median: percentile(values, 0.5),
    p95: percentile(values, 0.95),
  };
}

function continuityCounts(notes = {}) {
  return {
    timeline: Array.isArray(notes.timeline) ? notes.timeline.length : 0,
    people: Array.isArray(notes.people) ? notes.people.length : 0,
    places: Array.isArray(notes.places) ? notes.places.length : 0,
    threads: Array.isArray(notes.threads) ? notes.threads.length : 0,
    commitments: Array.isArray(notes.commitments) ? notes.commitments.length : 0,
    importantFacts: Array.isArray(notes.importantFacts) ? notes.importantFacts.length : 0,
  };
}

function recordText(record) {
  if (typeof record === "string") return record;
  return [record?.description, record?.who, record?.what].filter(Boolean).join(" ");
}

function allContinuityRecords(notes = {}) {
  return ["timeline", "people", "places", "threads", "commitments", "importantFacts"]
    .flatMap((key) => Array.isArray(notes[key]) ? notes[key] : []);
}

class LongHorizonHarness {
  constructor() {
    this.catalog = stageCatalogModule.createStageCatalog([fixture.STAGE]);
    this.storage = memoryStorage();
    this.database = new MemoryCinemaDatabase();
    this.now = Date.parse("2026-09-01T08:00:00.000Z");
    this.telemetry = [];
    this.summaryCheckpoints = [];
    this.recoveryEvents = [];
    this.lifecycleEvents = [];
    this.reloadEvents = [];
    this.attempts = new Map();
    this.failedSummarySlots = { early: false, late: false };
    this.activeScript = null;
    this.cancelStarted = null;
    this.checkpoints = {};
  }

  clock = () => this.now;

  createRepository() {
    return new persistence.MercuryIndexedDBCinemaRepository({
      legacyStorage: this.storage,
      database: this.database,
      catalog: this.catalog,
    });
  }

  async initialize() {
    this.repository = this.createRepository();
    this.store = new MercuryCinemaStore({ repository: this.repository, catalog: this.catalog, clock: this.clock });
    await this.store.ready;
    this.mainId = await this.openInstance("character-ari", "Ari", fixture.PROFILES.a);
    this.shadowId = await this.openInstance("character-bea", "Bea", fixture.PROFILES.shadow);
    this.store.focusInstance(this.mainId);
    await this.store.flush();
    this.installWorkflow();
    return this;
  }

  async openInstance(characterId, displayName, profile) {
    this.store.beginDraft(fixture.STAGE.id);
    this.store.updateDraft({
      characterId,
      characterSnapshot: {
        id: characterId,
        displayName,
        identity: "repair clerk",
        summary: "Patient and observant during ordinary work.",
        stableTraits: ["patient", "observant"],
        motivations: ["finish the inventory accurately"],
        values: ["care", "accuracy"],
        boundaries: ["no coercion"],
      },
      playerName: "Player",
      playerRole: "inventory assistant",
      relationshipStart: "new colleagues",
      generationProfileId: profile.id,
      generationProfileSnapshot: clone(profile),
    });
    const instance = this.store.openCurtain();
    this.now += 1000;
    await this.store.flush();
    return instance.id;
  }

  installWorkflow() {
    const harness = this;
    const instrumentedCompiler = {
      compile(input) {
        const compiled = compiler.compile(input);
        const historyOrdinals = compiled.request.history.map((entry) => Number(String(entry.text).match(/^\[ordinal (\d+)\]/)?.[1])).filter(Number.isInteger);
        const combined = [compiled.layers.frozenTruth, compiled.layers.continuity, ...compiled.layers.recentHistory.map((entry) => entry.text), compiled.layers.currentTurn].join("\n");
        const script = harness.activeScript || { turn: -1, label: input.instance.id === harness.mainId ? "main" : "shadow" };
        harness.telemetry.push({
          turn: script.turn,
          label: script.label,
          instanceId: input.instance.id,
          retry: input.retry === true,
          total: compiled.budget.actual,
          totalBudget: compiled.budget.total,
          layerA: textSize(compiled.layers.frozenTruth),
          layerB: textSize(compiled.layers.continuity),
          layerBFull: compiled.budget.continuityFull,
          layerC: compiled.layers.recentHistory.reduce((sum, entry) => sum + textSize(entry.text), 0),
          layerD: textSize(compiled.layers.currentTurn),
          historyCount: compiled.request.history.length,
          coveredThroughOrdinal: input.instance.notes?.summary?.coveredThroughOrdinal ?? -1,
          earliestRawOrdinal: historyOrdinals.length ? Math.min(...historyOrdinals) : null,
          latestRawOrdinal: historyOrdinals.length ? Math.max(...historyOrdinals) : null,
          requiredOverflow: compiled.budget.requiredOverflow,
          continuityTruncated: compiled.budget.continuityTruncated,
          continuityCounts: continuityCounts(input.instance.notes),
          generationProfileId: compiled.request.generationProfileId,
          hasExtractedDelayed: combined.includes(fixture.MARKERS.extractedDelayed),
          hasRawOnlyDelayed: combined.includes(fixture.MARKERS.rawOnlyDelayed),
          hasCorrectionOld: combined.includes(fixture.MARKERS.correctionOld),
          hasCorrectionNew: combined.includes(fixture.MARKERS.correctionNew),
          hasStateOld: combined.includes(fixture.MARKERS.stateOld),
          hasStateNew: combined.includes(fixture.MARKERS.stateNew),
          hasAuthorityRule: combined.includes("evidence ordinal 较大的明确更正或状态变化为准"),
          hasMainMarker: combined.includes(fixture.MARKERS.main),
          hasShadowMarker: combined.includes(fixture.MARKERS.shadow),
          hasProfileA: combined.includes("PROFILE-A-MEASURED"),
          hasProfileB: combined.includes("PROFILE-B-REFLECTIVE"),
          hasProfileC: combined.includes("PROFILE-C-DIRECT"),
          categoryAdmission: {
            people: compiled.layers.continuity.includes("人物状态："),
            places: compiled.layers.continuity.includes("地点状态："),
            summary: compiled.layers.continuity.includes("累计摘要（覆盖至 ordinal"),
            threads: compiled.layers.continuity.includes("未收束线索："),
            commitments: compiled.layers.continuity.includes("承诺与约定："),
            importantFacts: compiled.layers.continuity.includes("重要事实："),
          },
        });
        return compiled;
      },
    };

    const instrumentedLedger = {
      normalizeLedger: ledger.normalizeLedger,
      advance(previousNotes, userSegment, assistantSegment, instance, options) {
        const before = ledger.normalizeLedger(previousNotes, harness.clock);
        const next = ledger.advance(previousNotes, userSegment, assistantSegment, instance, options);
        if (next.summary.text.includes(fixture.MARKERS.rawOnlyDelayed)) {
          next.summary.text = next.summary.text.replaceAll(fixture.MARKERS.rawOnlyDelayed, "[unextracted inventory mark omitted]");
          next.overview = next.summary.text;
        }
        const script = harness.activeScript || { turn: -1, label: "unknown" };
        const checkpoint = next.summary.coveredThroughOrdinal > before.summary.coveredThroughOrdinal;
        if (checkpoint) {
          const failEarly = script.label === "main" && !harness.failedSummarySlots.early && script.turn >= 12;
          const failLate = script.label === "main" && !harness.failedSummarySlots.late && script.turn >= 112;
          const failed = failEarly || failLate;
          if (failEarly) harness.failedSummarySlots.early = true;
          if (failLate) harness.failedSummarySlots.late = true;
          const uncoveredSegments = instance.segments.filter((_, ordinal) => ordinal > before.summary.coveredThroughOrdinal);
          harness.summaryCheckpoints.push({
            turn: script.turn,
            label: script.label,
            before: before.summary.coveredThroughOrdinal,
            attemptedAfter: next.summary.coveredThroughOrdinal,
            committedAfter: null,
            summarySize: next.summary.text.length,
            uncoveredStorySize: uncoveredSegments.reduce((sum, segment) => sum + textSize(segment.text), 0),
            continuityCounts: continuityCounts(next),
            failed,
          });
          if (failed) throw Object.assign(new Error(`deterministic continuity checkpoint failure at turn ${script.turn}`), { code: "CINEMA_CONTINUITY_STRESS_FAILURE", retryable: true });
        }
        return next;
      },
    };

    const transport = {
      connectionStatus: () => ({ ready: true }),
      generateCinema: async (request, { signal }) => {
        const script = harness.activeScript;
        if (!script) throw new Error("Long-horizon transport requires an active scripted turn.");
        const key = `${request.instanceId}:${script.turn}`;
        const attempt = (harness.attempts.get(key) || 0) + 1;
        harness.attempts.set(key, attempt);
        if (script.label === "main" && script.turn === 60 && attempt === 1) {
          throw Object.assign(new Error("deterministic model outage"), { code: "STRESS_MODEL_OUTAGE", retryable: true });
        }
        if (script.label === "main" && script.turn === 90 && attempt === 1) {
          harness.cancelStarted?.resolve();
          return new Promise((resolve, reject) => {
            signal.addEventListener("abort", () => {
              const error = new Error("deterministic cancelled request");
              error.name = "AbortError";
              reject(error);
            }, { once: true });
          });
        }
        return { requestId: request.requestId, text: script.assistant };
      },
    };

    this.workflow = new MercuryCinemaGenerationWorkflow({
      store: this.store,
      transport,
      compiler: instrumentedCompiler,
      ledger: instrumentedLedger,
      contracts,
      clock: this.clock,
    });
  }

  async reload(reason) {
    await this.store.flush();
    const before = this.store.snapshot();
    this.repository = this.createRepository();
    this.store = new MercuryCinemaStore({ repository: this.repository, catalog: this.catalog, clock: this.clock });
    await this.store.ready;
    const after = this.store.snapshot();
    this.installWorkflow();
    const sameOrdering = before.instances.every((instance) => {
      const restored = after.instances.find((item) => item.id === instance.id);
      return JSON.stringify(restored?.segments.map(({ id, role, text }) => ({ id, role, text }))) === JSON.stringify(instance.segments.map(({ id, role, text }) => ({ id, role, text })));
    });
    this.reloadEvents.push({ reason, sameOrdering, instanceCount: after.instances.length });
    return { before, after, sameOrdering };
  }

  finalizeSummaryCheckpoint(script) {
    const instance = this.store.get(script.label === "main" ? this.mainId : this.shadowId);
    this.summaryCheckpoints
      .filter((entry) => entry.turn === script.turn && entry.label === script.label && entry.committedAfter === null)
      .forEach((entry) => {
        entry.committedAfter = instance.notes.summary.coveredThroughOrdinal;
        entry.committedSummarySize = instance.notes.summary.text.length;
      });
  }

  async completeScriptedTurn(instanceId, script) {
    this.activeScript = script;
    let result;
    if (script.label === "main" && script.turn === 25) result = await this.recoverAfterUserDurability(instanceId, script);
    else if (script.label === "main" && script.turn === 75) result = await this.recoverAfterPendingDurability(instanceId, script);
    else if (script.label === "main" && script.turn === 90) result = await this.cancelAndRetry(instanceId, script);
    else {
      result = await this.workflow.runTurn({ instanceId, userText: script.user });
      if (script.label === "main" && script.turn === 60) {
        const failed = result;
        const beforeNotes = clone(this.store.get(instanceId).notes);
        this.store.applyGenerationProfile(instanceId, fixture.PROFILES.b);
        await this.store.flush();
        const afterNotes = clone(this.store.get(instanceId).notes);
        result = await this.workflow.retryPending(instanceId);
        this.recoveryEvents.push({
          type: "model-failure-profile-switch-retry",
          failedReason: failed.reason,
          retryAccepted: result.accepted,
          notesStableAcrossProfileSwitch: JSON.stringify(beforeNotes) === JSON.stringify(afterNotes),
          pendingProfile: fixture.PROFILES.a.id,
          currentProfile: this.store.get(instanceId).generationProfileId,
        });
      }
    }
    this.finalizeSummaryCheckpoint(script);
    this.activeScript = null;
    this.now += 60000;
    return result;
  }

  async recoverAfterUserDurability(instanceId, script) {
    const user = this.store.appendUser(instanceId, script.user);
    await this.store.flush();
    const beforeReloadCount = this.store.get(instanceId).segments.filter((segment) => segment.id === user.id).length;
    await this.reload("after-user-segment-durability");
    const restored = this.store.get(instanceId);
    const pendingAfterReload = restored.pendingContinuation;
    const restoredCount = restored.segments.filter((segment) => segment.id === user.id).length;
    this.store.markPendingContinuation(instanceId, {
      requestId: `stress-recovered-user-${script.turn}`,
      userSegmentId: user.id,
      startedAt: new Date(this.now).toISOString(),
      generationProfileId: user.generationProfileId,
    });
    await this.store.flush();
    const result = await this.workflow.retryPending(instanceId);
    this.recoveryEvents.push({
      type: "after-user-durability",
      beforeReloadCount,
      restoredCount,
      pendingAfterReload,
      harnessReboundPendingIdentity: true,
      retryAccepted: result.accepted,
    });
    return result;
  }

  async recoverAfterPendingDurability(instanceId, script) {
    const user = this.store.appendUser(instanceId, script.user);
    await this.store.flush();
    this.store.markPendingContinuation(instanceId, {
      requestId: `stress-pending-${script.turn}`,
      userSegmentId: user.id,
      startedAt: new Date(this.now).toISOString(),
      generationProfileId: user.generationProfileId,
    });
    await this.store.flush();
    await this.reload("after-pending-durability");
    const pending = clone(this.store.get(instanceId).pendingContinuation);
    const result = await this.workflow.retryPending(instanceId);
    this.recoveryEvents.push({
      type: "after-pending-durability",
      pendingRestored: pending?.userSegmentId === user.id,
      retryAccepted: result.accepted,
      userSegmentCount: this.store.get(instanceId).segments.filter((segment) => segment.id === user.id).length,
    });
    return result;
  }

  async cancelAndRetry(instanceId, script) {
    this.cancelStarted = deferred();
    const operation = this.workflow.runTurn({ instanceId, userText: script.user });
    await this.cancelStarted.promise;
    const cancelAccepted = this.workflow.cancel();
    const cancelled = await operation;
    const pendingAfterCancel = clone(this.store.get(instanceId).pendingContinuation);
    const retried = await this.workflow.retryPending(instanceId);
    this.recoveryEvents.push({
      type: "cancel-retry",
      cancelAccepted,
      cancelledReason: cancelled.reason,
      pendingAfterCancel: Boolean(pendingAfterCancel),
      retryAccepted: retried.accepted,
    });
    this.cancelStarted = null;
    return retried;
  }

  async exerciseLifecycle(turn, withReload = false) {
    const beforeMain = this.store.get(this.mainId);
    const beforeShadow = this.store.get(this.shadowId);
    this.store.intermission(this.mainId);
    this.store.focusInstance(this.shadowId);
    if (withReload) await this.reload(`lifecycle-paused-turn-${turn}`);
    this.store.focusInstance(this.mainId);
    const stillPaused = this.store.get(this.mainId).status === "intermission";
    this.store.resume(this.mainId);
    await this.store.flush();
    const afterMain = this.store.get(this.mainId);
    const afterShadow = this.store.get(this.shadowId);
    const narrativeProjection = (instance) => ({ scenes: instance.scenes, currentSceneId: instance.currentSceneId, segments: instance.segments, notes: instance.notes });
    this.lifecycleEvents.push({
      turn,
      withReload,
      stillPaused,
      mainNarrativeUnchanged: JSON.stringify(narrativeProjection(beforeMain)) === JSON.stringify(narrativeProjection(afterMain)),
      shadowNarrativeUnchanged: JSON.stringify(narrativeProjection(beforeShadow)) === JSON.stringify(narrativeProjection(afterShadow)),
    });
  }

  async run() {
    await this.initialize();
    for (let turn = 1; turn <= 200; turn += 1) {
      if ([45, 95, 155].includes(turn)) await this.exerciseLifecycle(turn, turn === 95);
      this.store.focusInstance(this.mainId);
      const mainResult = await this.completeScriptedTurn(this.mainId, fixture.mainTurn(turn));
      if (!mainResult.accepted) throw new Error(`Main long-horizon turn ${turn} did not recover: ${mainResult.reason}`);
      if (turn === 140) {
        const notesBefore = clone(this.store.get(this.mainId).notes);
        this.store.applyGenerationProfile(this.mainId, fixture.PROFILES.c);
        await this.store.flush();
        const notesAfter = clone(this.store.get(this.mainId).notes);
        this.recoveryEvents.push({ type: "profile-c-switch", notesStable: JSON.stringify(notesBefore) === JSON.stringify(notesAfter) });
      }
      if (turn % 2 === 0) {
        this.store.focusInstance(this.shadowId);
        const shadowResult = await this.completeScriptedTurn(this.shadowId, fixture.shadowTurn(turn / 2));
        if (!shadowResult.accepted) throw new Error(`Shadow long-horizon turn ${turn / 2} failed: ${shadowResult.reason}`);
        this.store.focusInstance(this.mainId);
      }
      if ([100, 150, 200].includes(turn)) {
        this.checkpoints[turn] = this.buildCheckpoint(turn);
        await this.reload(`checkpoint-${turn}`);
      }
    }
    await this.store.flush();
    return this.buildReport();
  }

  buildCheckpoint(turn) {
    const instance = this.store.get(this.mainId);
    const notes = instance.notes;
    const turnTelemetry = this.telemetry.filter((entry) => entry.label === "main" && entry.turn === turn).at(-1);
    const cumulative = this.telemetry.filter((entry) => entry.label === "main" && entry.turn > 0 && entry.turn <= turn);
    const coverage = notes.summary.coveredThroughOrdinal;
    const lastOrdinal = instance.segments.length - 1;
    const repeatedCount = notes.importantFacts.filter((entry) => recordText(entry).includes(fixture.MARKERS.repeatedFact)).length;
    const threadRecords = notes.threads.filter((entry) => recordText(entry).includes(fixture.MARKERS.openThread));
    return {
      turn,
      rawSegmentCount: instance.segments.length,
      userSegmentCount: instance.segments.filter((entry) => entry.role === "user").length,
      assistantSegmentCount: instance.segments.filter((entry) => entry.role === "assistant").length,
      rawStoryCharacterSize: instance.segments.reduce((sum, entry) => sum + textSize(entry.text), 0),
      durableSummarySize: notes.summary.text.length,
      durableLedgerSize: JSON.stringify(notes).length,
      continuityCounts: continuityCounts(notes),
      compiled: turnTelemetry && {
        total: turnTelemetry.total,
        layerA: turnTelemetry.layerA,
        layerB: turnTelemetry.layerB,
        layerBFull: turnTelemetry.layerBFull,
        layerC: turnTelemetry.layerC,
        layerD: turnTelemetry.layerD,
        historyCount: turnTelemetry.historyCount,
        requiredOverflow: turnTelemetry.requiredOverflow,
        continuityTruncated: turnTelemetry.continuityTruncated,
        earliestRawOrdinal: turnTelemetry.earliestRawOrdinal,
        latestRawOrdinal: turnTelemetry.latestRawOrdinal,
        categoryAdmission: turnTelemetry.categoryAdmission,
      },
      aggregate: {
        total: statistics(cumulative.map((entry) => entry.total)),
        layerB: statistics(cumulative.map((entry) => entry.layerB)),
        layerC: statistics(cumulative.map((entry) => entry.layerC)),
      },
      coverageOrdinal: coverage,
      uncoveredOrdinalSpan: coverage < lastOrdinal ? [coverage + 1, lastOrdinal] : [],
      duplicateContinuityObservations: Math.max(0, repeatedCount - 1),
      repeatedFactEntries: repeatedCount,
      resolvedThreadEntriesStillOpen: threadRecords.filter((entry) => entry.status === "open").length,
      delayedRelevance: turn >= 145 ? {
        extractedAvailable: turnTelemetry.hasExtractedDelayed,
        rawOnlyAvailable: turnTelemetry.hasRawOnlyDelayed,
      } : { extractedAvailable: null, rawOnlyAvailable: null },
      profileSegmentCounts: instance.segments.reduce((counts, segment) => {
        counts[segment.generationProfileId] = (counts[segment.generationProfileId] || 0) + 1;
        return counts;
      }, {}),
    };
  }

  validateEvidence(instance) {
    return allContinuityRecords(instance.notes).every((record) => {
      const ordinals = Array.isArray(record?.evidenceOrdinals) ? record.evidenceOrdinals : [];
      if (!ordinals.length) return true;
      if (!ordinals.every((ordinal) => Number.isInteger(ordinal) && ordinal >= 0 && ordinal < instance.segments.length)) return false;
      const roles = new Set(ordinals.map((ordinal) => instance.segments[ordinal]?.role));
      return roles.has("user") && roles.has("assistant");
    });
  }

  buildReport() {
    const main = this.store.get(this.mainId);
    const shadow = this.store.get(this.shadowId);
    const mainTelemetry = this.telemetry.filter((entry) => entry.label === "main");
    const delayed = mainTelemetry.filter((entry) => entry.turn === 145).at(-1);
    const correction = mainTelemetry.filter((entry) => entry.turn === 150).at(-1);
    const profileRetry = mainTelemetry.filter((entry) => entry.turn === 60).at(-1);
    const profileB = mainTelemetry.filter((entry) => entry.turn === 61).at(-1);
    const profileC = mainTelemetry.filter((entry) => entry.turn === 141).at(-1);
    const rawText = main.segments.map((entry) => entry.text).join("\n");
    const derivedText = JSON.stringify(main.notes);
    const plantedMarkers = Object.fromEntries(Object.entries(fixture.MARKERS)
      .filter(([key]) => !["main", "shadow"].includes(key))
      .map(([key, marker]) => [key, { raw: rawText.includes(marker), derived: derivedText.includes(marker) }]));
    const coverageMonotonic = ["main", "shadow"].every((label) => {
      const values = this.summaryCheckpoints.filter((entry) => entry.label === label).map((entry) => entry.committedAfter).filter(Number.isInteger);
      return values.every((value, index) => index === 0 || value >= values[index - 1]);
    });
    const maximumUncoveredSize = Math.max(0, ...this.summaryCheckpoints.map((entry) => entry.uncoveredStorySize));
    const assistantCommitsAtomic = this.database.commits
      .filter((change) => (change.segmentPuts || []).some((segment) => segment.role === "assistant"))
      .every((change) => (change.instancePuts || []).some((instance) => instance.pendingContinuation === null));
    const mainBundleOrdinals = this.database.bundle.segments.filter((entry) => entry.instanceId === this.mainId).map((entry) => entry.ordinal).sort((a, b) => a - b);
    const shadowBundleOrdinals = this.database.bundle.segments.filter((entry) => entry.instanceId === this.shadowId).map((entry) => entry.ordinal).sort((a, b) => a - b);
    return {
      checkpoints: this.checkpoints,
      summaryCheckpoints: this.summaryCheckpoints,
      final: {
        mainSegments: main.segments.length,
        shadowSegments: shadow.segments.length,
        mainCoverage: main.notes.summary.coveredThroughOrdinal,
        shadowCoverage: shadow.notes.summary.coveredThroughOrdinal,
        runtimeProfileHistory: main.runtimeProfileHistory.map((entry) => entry.profileId),
        pendingMain: main.pendingContinuation,
        pendingShadow: shadow.pendingContinuation,
      },
      invariants: {
        mainOrdinalsContiguous: mainBundleOrdinals.every((ordinal, index) => ordinal === index),
        shadowOrdinalsContiguous: shadowBundleOrdinals.every((ordinal, index) => ordinal === index),
        evidenceValidMain: this.validateEvidence(main),
        evidenceValidShadow: this.validateEvidence(shadow),
        reloadOrderingStable: this.reloadEvents.every((entry) => entry.sameOrdering),
        coverageMonotonic,
        successfulCoverageCommitted: this.summaryCheckpoints.filter((entry) => !entry.failed).every((entry) => entry.committedAfter === entry.attemptedAfter),
        failedCoveragePreserved: this.summaryCheckpoints.filter((entry) => entry.failed).every((entry) => entry.committedAfter === entry.before),
        summaryBounded: this.summaryCheckpoints.every((entry) => entry.committedSummarySize <= 3200),
        maximumUncoveredSize,
        totalContextBounded: mainTelemetry.every((entry) => entry.total <= entry.totalBudget || entry.requiredOverflow > 0),
        requiredOverflowCount: mainTelemetry.filter((entry) => entry.requiredOverflow > 0).length,
        continuityTruncationCount: mainTelemetry.filter((entry) => entry.continuityTruncated).length,
        assistantCommitsAtomic,
        noMainContinuityInShadow: !JSON.stringify(shadow.notes).includes(fixture.MARKERS.main),
        noShadowContinuityInMain: !JSON.stringify(main.notes).includes(fixture.MARKERS.shadow),
        compilerIsolation: mainTelemetry.every((entry) => !entry.hasShadowMarker) && this.telemetry.filter((entry) => entry.label === "shadow").every((entry) => !entry.hasMainMarker),
        lifecycleNarrativeStable: this.lifecycleEvents.every((entry) => entry.stillPaused && entry.mainNarrativeUnchanged && entry.shadowNarrativeUnchanged),
        delayedExtractedAvailable: delayed.hasExtractedDelayed,
        delayedRawOnlyUnavailable: !delayed.hasRawOnlyDelayed,
        correctionAndStateChangePresent: correction.hasCorrectionOld && correction.hasCorrectionNew && correction.hasStateOld && correction.hasStateNew && correction.hasAuthorityRule,
        pendingRetryUsedOriginalProfile: profileRetry.generationProfileId === fixture.PROFILES.a.id && profileRetry.hasProfileA && !profileRetry.hasProfileB,
        nextTurnUsedProfileB: profileB.generationProfileId === fixture.PROFILES.b.id && profileB.hasProfileB && !profileB.hasProfileA,
        laterTurnUsedProfileC: profileC.generationProfileId === fixture.PROFILES.c.id && profileC.hasProfileC && !profileC.hasProfileB,
      },
      recoveryEvents: this.recoveryEvents,
      lifecycleEvents: this.lifecycleEvents,
      reloadEvents: this.reloadEvents,
      plantedMarkers,
    };
  }
}

async function runRepositoryWriteFailureProbe() {
  const catalog = stageCatalogModule.createStageCatalog([fixture.STAGE]);
  const storage = memoryStorage();
  const database = new MemoryCinemaDatabase();
  let now = Date.parse("2026-09-01T00:00:00.000Z");
  const clock = () => now;
  const repository = new persistence.MercuryIndexedDBCinemaRepository({ legacyStorage: storage, database, catalog });
  const store = new MercuryCinemaStore({ repository, catalog, clock });
  await store.ready;
  store.beginDraft(fixture.STAGE.id);
  store.updateDraft({
    characterId: "write-failure-character",
    characterSnapshot: { id: "write-failure-character", displayName: "Case", stableTraits: ["steady"] },
    generationProfileId: fixture.PROFILES.a.id,
    generationProfileSnapshot: fixture.PROFILES.a,
  });
  const instance = store.openCurtain();
  await store.flush();
  const durableBefore = database.bundle.segments.filter((entry) => entry.instanceId === instance.id).length;
  let modelCalls = 0;
  const workflow = new MercuryCinemaGenerationWorkflow({
    store,
    compiler,
    ledger,
    contracts,
    clock,
    transport: {
      connectionStatus: () => ({ ready: true }),
      generateCinema: async (request) => { modelCalls += 1; return { requestId: request.requestId, text: "This response must never be requested." }; },
    },
  });
  database.failNextCommit = true;
  now += 1000;
  const result = await workflow.runTurn({ instanceId: instance.id, userText: "A write that cannot become durable must stop before generation." });
  const reloadedRepository = new persistence.MercuryIndexedDBCinemaRepository({ legacyStorage: storage, database, catalog });
  const reloadedStore = new MercuryCinemaStore({ repository: reloadedRepository, catalog, clock });
  await reloadedStore.ready;
  const durableAfter = reloadedStore.get(instance.id);
  return {
    resultReason: result.reason,
    modelCalls,
    durableSegmentCountBefore: durableBefore,
    durableSegmentCountAfter: durableAfter.segments.length,
    pendingAfterReload: durableAfter.pendingContinuation,
  };
}

module.exports = {
  LongHorizonHarness,
  MemoryCinemaDatabase,
  memoryStorage,
  runRepositoryWriteFailureProbe,
  fixture,
};
