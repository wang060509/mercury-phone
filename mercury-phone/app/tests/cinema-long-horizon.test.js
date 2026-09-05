"use strict";

const assert = require("node:assert/strict");
const {
  LongHorizonHarness,
  runRepositoryWriteFailureProbe,
  fixture,
} = require("./fixtures/cinema-long-horizon-harness.js");

const originalRandom = Math.random;
let randomStep = 0;
Math.random = () => ((++randomStep % 997) + 1) / 1000;

async function run() {
  try {
    const report = await new LongHorizonHarness().run();
    const writeFailure = await runRepositoryWriteFailureProbe();
    report.writeFailureProbe = writeFailure;

    assert.deepEqual(Object.keys(report.checkpoints), ["100", "150", "200"]);
    assert.deepEqual([100, 150, 200].map((turn) => report.checkpoints[turn].userSegmentCount), [100, 150, 200], "all committed user turns remain present at every checkpoint");
    assert.deepEqual([100, 150, 200].map((turn) => report.checkpoints[turn].assistantSegmentCount), [101, 151, 201], "opening prose plus every committed assistant turn remains present");
    assert.deepEqual([100, 150, 200].map((turn) => report.checkpoints[turn].rawSegmentCount), [201, 301, 401], "raw prose is never compacted away");
    assert.equal(report.final.shadowSegments, 201, "the interleaved secondary Instance remains long-lived for 100 turns");

    assert.equal(report.invariants.mainOrdinalsContiguous, true);
    assert.equal(report.invariants.shadowOrdinalsContiguous, true);
    assert.equal(report.invariants.evidenceValidMain, true, "main evidence ordinals still resolve to durable story prose");
    assert.equal(report.invariants.evidenceValidShadow, true, "secondary evidence ordinals remain instance-local and meaningful");
    assert.equal(report.invariants.reloadOrderingStable, true, "every deterministic reload reconstructs the same story ordering");
    assert.equal(report.invariants.assistantCommitsAtomic, true, "assistant prose and pending clear share the Repository change set");

    assert.equal(report.invariants.coverageMonotonic, true);
    assert.equal(report.invariants.successfulCoverageCommitted, true);
    assert.equal(report.invariants.failedCoveragePreserved, true, "injected summary failures retain previous coverage");
    assert.equal(report.summaryCheckpoints.filter((entry) => entry.failed).length, 2, "one early and one post-100-turn checkpoint failure are injected");
    assert.ok(report.summaryCheckpoints.some((entry) => entry.failed && entry.turn < 100));
    assert.ok(report.summaryCheckpoints.some((entry) => entry.failed && entry.turn > 100));
    assert.equal(report.invariants.summaryBounded, true);
    assert.ok(report.invariants.maximumUncoveredSize < 8000, "checkpoint recovery prevents uncovered prose from growing without bound");

    assert.equal(report.invariants.totalContextBounded, true);
    assert.equal(report.invariants.requiredOverflowCount, 0, "the neutral fixture stays within required-layer budget");
    assert.ok(report.invariants.continuityTruncationCount > 0, "Layer B pressure exercises deterministic compiler truncation");
    assert.ok(report.checkpoints[200].aggregate.total.max <= 24000);
    assert.ok(report.checkpoints[200].compiled.layerB <= report.checkpoints[200].compiled.layerBFull);
    assert.equal(report.checkpoints[200].compiled.categoryAdmission.importantFacts, true, "tail admission retains the final continuity category under pressure");
    assert.ok(Object.values(report.checkpoints[200].compiled.categoryAdmission).some((value) => value === false), "Layer B truncation exposes category starvation instead of hiding it");
    assert.ok(report.checkpoints[200].continuityCounts.timeline <= 80);
    assert.ok(report.checkpoints[200].continuityCounts.people <= 50);
    assert.ok(report.checkpoints[200].continuityCounts.places <= 50);
    assert.ok(report.checkpoints[200].continuityCounts.threads <= 50);
    assert.ok(report.checkpoints[200].continuityCounts.commitments <= 50);
    assert.ok(report.checkpoints[200].continuityCounts.importantFacts <= 80);

    assert.equal(report.invariants.delayedExtractedAvailable, true, "the extracted early marker remains available after leaving Layer C");
    assert.equal(report.invariants.delayedRawOnlyUnavailable, true, "the intentionally unextracted raw-only marker is not automatically rediscovered");
    assert.equal(Object.values(report.plantedMarkers).every((entry) => entry.raw), true, "every planted identity, commitment, thread, relationship, correction, state, location, and delayed marker remains in raw prose");
    assert.equal(report.plantedMarkers.extractedDelayed.derived, true);
    assert.equal(report.plantedMarkers.rawOnlyDelayed.derived, false);
    assert.equal(report.checkpoints[150].delayedRelevance.extractedAvailable, true);
    assert.equal(report.checkpoints[150].delayedRelevance.rawOnlyAvailable, false);
    assert.equal(report.invariants.correctionAndStateChangePresent, true, "later correction and legitimate state change remain distinguishable in context with ordinal authority");

    assert.equal(report.invariants.noMainContinuityInShadow, true);
    assert.equal(report.invariants.noShadowContinuityInMain, true);
    assert.equal(report.invariants.compilerIsolation, true, "ContextCompiler never admits prose or continuity from the other Instance");
    assert.equal(report.invariants.lifecycleNarrativeStable, true, "pause, focus, resume, and reload do not create narrative state");
    assert.equal(report.final.pendingMain, null);
    assert.equal(report.final.pendingShadow, null);

    assert.deepEqual(report.final.runtimeProfileHistory, [fixture.PROFILES.a.id, fixture.PROFILES.b.id, fixture.PROFILES.c.id]);
    assert.equal(report.invariants.pendingRetryUsedOriginalProfile, true, "retry uses the profile captured by its durable pending identity");
    assert.equal(report.invariants.nextTurnUsedProfileB, true);
    assert.equal(report.invariants.laterTurnUsedProfileC, true);
    assert.ok(report.checkpoints[200].profileSegmentCounts[fixture.PROFILES.a.id] > 0);
    assert.ok(report.checkpoints[200].profileSegmentCounts[fixture.PROFILES.b.id] > 0);
    assert.ok(report.checkpoints[200].profileSegmentCounts[fixture.PROFILES.c.id] > 0);
    assert.equal(report.recoveryEvents.find((entry) => entry.type === "model-failure-profile-switch-retry").notesStableAcrossProfileSwitch, true);

    const userDurability = report.recoveryEvents.find((entry) => entry.type === "after-user-durability");
    assert.equal(userDurability.beforeReloadCount, 1);
    assert.equal(userDurability.restoredCount, 1);
    assert.equal(userDurability.pendingAfterReload, null, "the pre-pending crash window has no durable operation identity");
    assert.equal(userDurability.retryAccepted, true, "the harness can explicitly rebind the preserved user Segment without duplicating it");
    const pendingDurability = report.recoveryEvents.find((entry) => entry.type === "after-pending-durability");
    assert.equal(pendingDurability.pendingRestored, true);
    assert.equal(pendingDurability.userSegmentCount, 1);
    assert.equal(pendingDurability.retryAccepted, true);
    const cancellation = report.recoveryEvents.find((entry) => entry.type === "cancel-retry");
    assert.equal(cancellation.cancelAccepted, true);
    assert.equal(cancellation.cancelledReason, "cancelled");
    assert.equal(cancellation.pendingAfterCancel, true);
    assert.equal(cancellation.retryAccepted, true);

    assert.equal(writeFailure.resultReason, "storage-failed");
    assert.equal(writeFailure.modelCalls, 0, "a user Segment that cannot flush never reaches model transport");
    assert.equal(writeFailure.durableSegmentCountAfter, writeFailure.durableSegmentCountBefore);
    assert.equal(writeFailure.pendingAfterReload, null);

    assert.ok(report.checkpoints[200].duplicateContinuityObservations > 0, "differently phrased repeated facts remain observable as semantic duplicates");
    assert.ok(report.checkpoints[200].resolvedThreadEntriesStillOpen > 0, "the current heuristic ledger does not model thread resolution automatically");

    if (process.env.CINEMA_LONG_HORIZON_JSON === "1") {
      console.log(`CINEMA_LONG_HORIZON_RESULT=${JSON.stringify(report)}`);
    } else {
      console.log(`cinema-long-horizon: main=200 turns shadow=100 turns checkpoints=100/150/200 summaries=${report.summaryCheckpoints.length} truncated=${report.invariants.continuityTruncationCount}`);
    }
  } finally {
    Math.random = originalRandom;
  }
}

run().catch((error) => {
  Math.random = originalRandom;
  console.error(error);
  process.exitCode = 1;
});
