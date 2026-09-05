"use strict";

const assert = require("node:assert/strict");
const ledger = require("../use-cases/cinema-continuity-ledger.js");

const instance = {
  id: "cinema-ledger",
  characterSnapshot: { displayName: "River" },
  scenes: [{ id: "scene-1", title: "Archive Room" }],
  currentSceneId: "scene-1",
  notes: {
    summary: { text: "Earlier summary.", coveredThroughOrdinal: 50 },
    commitments: [{ who: "River", what: "guard the first door", status: "open", evidenceOrdinals: [4] }],
  },
  segments: [
    ...Array.from({ length: 51 }, (_, ordinal) => ({ id: `old-${ordinal}`, role: ordinal % 2 ? "user" : "assistant", text: `old ${ordinal}`, status: "complete" })),
    { id: "user-51", role: "user", text: "I remember the important promise.", status: "complete" },
    { id: "assistant-52", role: "assistant", text: "River promised to keep the lantern lit.", status: "complete" },
  ],
};

const next = ledger.advance(instance.notes, instance.segments[51], instance.segments[52], instance, { forceSummary: true, clock: () => Date.parse("2026-01-01T00:00:00.000Z") });
assert.equal(next.summary.coveredThroughOrdinal, 52, "coverage advances to the committed assistant ordinal");
assert.match(next.summary.text, /Earlier summary/);
assert.ok(next.commitments.some((item) => /promise/i.test(item.what) && item.evidenceOrdinals.includes(52)), "promise continuity keeps evidence ordinals");
assert.ok(next.importantFacts.some((item) => item.description.includes("important") && item.evidenceOrdinals.includes(51)), "important facts keep evidence ordinals");

const monotonic = ledger.advance({ summary: { text: "Already ahead.", coveredThroughOrdinal: 150 } }, instance.segments[51], instance.segments[52], instance, { forceSummary: true });
assert.equal(monotonic.summary.coveredThroughOrdinal, 150, "coverage never moves backward");

const notesBeforeFailure = JSON.parse(JSON.stringify(instance.notes));
const rawBeforeFailure = instance.segments.map((segment) => segment.text);
assert.throws(() => ledger.advance(instance.notes, instance.segments[51], instance.segments[52], instance, { fail: true }), /Continuity advancement failed/);
assert.deepEqual(instance.notes, notesBeforeFailure, "summary failure cannot mutate or advance the durable ledger input");
assert.deepEqual(instance.segments.map((segment) => segment.text), rawBeforeFailure, "summary failure never consumes raw story prose");
assert.equal(instance.notes.summary.coveredThroughOrdinal, 50);

console.log("cinema-continuity-ledger: coverage, evidence, promise, and failure assertions passed");
