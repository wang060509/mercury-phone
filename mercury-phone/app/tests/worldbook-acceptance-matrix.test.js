"use strict";

const assert = require("node:assert/strict");
const runtime = require("../core/worldbook-runtime.js");

// This is an in-memory acceptance matrix. It intentionally uses synthetic
// resources so the test never imports, rewrites, or persists reference assets.
const world = {
  id: "matrix-harbor",
  name: "Harbor matrix",
  relatedProfileIds: ["profile-river"],
  entries: [
    { id: "universal", title: "Baseline", content: "The harbor has a curfew.", alwaysActive: true, priority: 1 },
    { id: "keyword", title: "Lantern signal", content: "A blue lantern means the courier is expected.", aliases: ["blue lantern"], priority: 2 },
    { id: "title", title: "North gate", content: "The north gate is watched.", priority: 1 },
    { id: "history", title: "Old ferry", content: "The last ferry leaves at dusk.", aliases: ["ferry"], priority: 1 },
    { id: "restricted", title: "River route", content: "Only River may use the restricted route.", visibility: "restricted", alwaysActive: true },
    { id: "character", title: "River detail", content: "River keeps a blue notebook.", visibility: "character-specific", runtimeProfileId: "profile-river", alwaysActive: true },
    { id: "other-character", title: "Other detail", content: "This belongs to another character.", visibility: "character-specific", runtimeProfileId: "profile-other", alwaysActive: true },
    { id: "wrong-variant", title: "Other variant", content: "This belongs to another world variant.", worldVariantId: "other", alwaysActive: true },
    { id: "wrong-timeline", title: "Other timeline", content: "This belongs to another timeline.", timelineId: "past", alwaysActive: true },
    { id: "duplicate", title: "Duplicate one", content: "This should be injected once.", aliases: ["duplicate"], priority: 4 },
    { id: "duplicate", title: "Duplicate two", content: "This should be injected twice.", aliases: ["duplicate"], priority: 1 },
  ],
};

const scoped = runtime.resolve([world], {
  currentMessage: "Wait by the north gate with the blue lantern; duplicate.",
  recentMessages: [{ role: "user", text: "Did the ferry leave?" }],
  scope: {
    runtimeProfileId: "profile-river",
    worldVariantId: "harbor",
    timelineId: "present",
  },
});
const scopedIds = scoped.worlds[0].entries.map((entry) => entry.id);
assert.deepEqual(scopedIds, ["duplicate", "keyword", "title", "universal", "restricted", "character", "history"]);
assert.equal(scoped.trace.rawCandidateCount, 8, "eligible entries are counted before duplicate collapse");
assert.equal(scoped.trace.duplicateCount, 1, "same world/entry id is collapsed before budget selection");
assert.equal(scoped.trace.candidateCount, 7, "candidate count reflects deduped entries");
assert.equal(scoped.trace.selectedEntries.find((entry) => entry.entryId === "keyword").reason, "current_message");
assert.equal(scoped.trace.selectedEntries.find((entry) => entry.entryId === "history").reason, "recent_history");
assert.equal(scoped.worlds[0].entries.filter((entry) => entry.id === "duplicate").length, 1);
assert.equal(scoped.worlds[0].entries.some((entry) => entry.id === "other-character"), false);
assert.equal(scoped.worlds[0].entries.some((entry) => entry.id === "wrong-variant"), false);
assert.equal(scoped.worlds[0].entries.some((entry) => entry.id === "wrong-timeline"), false);
assert.equal(scoped.trace.scope.worldVariantId, "harbor");
assert.equal(scoped.trace.scope.timelineId, "present");

const noMatch = runtime.resolve([world], {
  currentMessage: "Tell me about the weather.",
  scope: { runtimeProfileId: "profile-outsider", worldVariantId: "harbor", timelineId: "present" },
});
assert.deepEqual(noMatch.worlds[0].entries.map((entry) => entry.id), ["universal"]);
assert.equal(noMatch.trace.selectedEntries[0].reason, "always_active");
assert.equal(noMatch.trace.eligibleWorldCount, 1);

const bounded = runtime.resolve([world], {
  currentMessage: "duplicate blue lantern north gate",
  scope: { runtimeProfileId: "profile-river", worldVariantId: "harbor", timelineId: "present" },
}, { maxEntries: 2, maxCharacters: 34, maxEntryCharacters: 20, minimumRemainingCharacters: 8 });
assert.equal(bounded.trace.selectedCount <= 2, true);
assert.equal(bounded.trace.usedCharacters <= 34, true);
assert.equal(bounded.trace.warnings.length > 0, true, "budget pressure is visible in the runtime trace");
assert.equal(bounded.trace.limits.maxEntries, 2);

console.log(JSON.stringify({
  name: "worldbook-acceptance-matrix",
  scenarios: 3,
  scoped: { rawCandidates: scoped.trace.rawCandidateCount, candidates: scoped.trace.candidateCount, selected: scoped.trace.selectedCount, duplicates: scoped.trace.duplicateCount, characters: scoped.trace.usedCharacters },
  noMatch: { selected: noMatch.trace.selectedCount, selectedIds: noMatch.worlds[0].entries.map((entry) => entry.id) },
  bounded: { selected: bounded.trace.selectedCount, characters: bounded.trace.usedCharacters, warnings: bounded.trace.warnings.map((warning) => warning.code) },
}));
console.log("worldbook-acceptance-matrix: 19 assertions passed");
