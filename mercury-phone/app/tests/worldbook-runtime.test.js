"use strict";

const assert = require("node:assert/strict");
const runtime = require("../core/worldbook-runtime.js");

const worlds = [{
  id: "world-harbor",
  name: "Harbor",
  entries: [
    { id: "always", title: "Rule", content: "The harbor closes at dusk.", alwaysActive: true, enabled: true, priority: 1 },
    { id: "pier", title: "Pier", content: "The final ferry leaves from the east pier.", aliases: ["ferry", "pier"], enabled: true, priority: 3 },
    { id: "quiet", title: "Quiet", content: "This must not enter the request.", aliases: ["unmentioned"], enabled: true },
    { id: "disabled", title: "Disabled", content: "This must stay excluded.", aliases: ["ferry"], enabled: false },
  ],
}];

const current = runtime.resolve(worlds, { currentMessage: "Can we still catch the ferry?" });
assert.deepEqual(current.worlds[0].entries.map((entry) => entry.id), ["pier", "always"]);
assert.equal(current.trace.selectedEntries.find((entry) => entry.entryId === "pier").reason, "current_message");
assert.equal(current.worlds[0].entries.some((entry) => entry.id === "quiet"), false);
assert.equal(current.worlds[0].entries.some((entry) => entry.id === "disabled"), false);

const crowded = runtime.resolve([{ id: "crowded", name: "Crowded", entries: [
  ...Array.from({ length: 8 }, (_, index) => ({ id: `always-${index}`, content: "Baseline context.", alwaysActive: true, enabled: true })),
  { id: "target", content: "The target is relevant to this message.", aliases: ["target"], enabled: true },
] }], { currentMessage: "target" }, { maxEntries: 2 });
assert.equal(crowded.trace.selectedEntries.some((entry) => entry.entryId === "target" && entry.reason === "current_message"), true);

const history = runtime.resolve(worlds, { currentMessage: "Tell me more.", recentMessages: [{ role: "user", text: "Did the ferry leave?" }] });
assert.equal(history.trace.selectedEntries.find((entry) => entry.entryId === "pier").reason, "recent_history");

const bounded = runtime.resolve(worlds, { currentMessage: "ferry" }, { maxEntries: 2, maxCharacters: 24, maxEntryCharacters: 24, minimumRemainingCharacters: 1 });
assert.equal(bounded.trace.usedCharacters <= 24, true);
assert.equal(bounded.trace.warnings.some((warning) => warning.code === "world_entry_truncated"), true);

const scoped = runtime.resolve([{
  id: "scoped-world",
  name: "Scoped world",
  relatedProfileIds: ["profile-river"],
  entries: [
    { id: "objective", content: "Objective fact.", visibility: "objective", alwaysActive: true },
    { id: "restricted", content: "Restricted fact for River.", visibility: "restricted", alwaysActive: true },
    { id: "character", content: "River's private character detail.", visibility: "character-specific", runtimeProfileId: "profile-river", alwaysActive: true },
    { id: "other-character", content: "Another character's detail.", visibility: "character-specific", runtimeProfileId: "profile-other", alwaysActive: true },
    { id: "wrong-variant", content: "Wrong variant fact.", worldVariantId: "other-world", alwaysActive: true },
    { id: "wrong-timeline", content: "Wrong timeline fact.", timelineId: "other-timeline", alwaysActive: true },
    { id: "private", content: "Private implementation detail.", visibility: "private", alwaysActive: true },
  ],
}], { scope: { contactId: "contact-river", runtimeProfileId: "profile-river", worldVariantId: "harbor", timelineId: "default" } });
const scopedIds = scoped.worlds[0].entries.map((entry) => entry.id);
assert.deepEqual(scopedIds, ["objective", "restricted", "character"], "visibility and entry scope are enforced before retrieval");
assert.equal(scoped.trace.scope.worldVariantId, "harbor", "trace records the active world variant scope");
assert.equal(scoped.trace.eligibleWorldCount, 1, "a matching world remains eligible for retrieval");

const mismatchedWorld = runtime.resolve([{ id: "other-variant-world", worldVariantId: "other-world", entries: [{ id: "leak", content: "Must not leak.", alwaysActive: true }] }], { scope: { worldVariantId: "harbor", timelineId: "default" } });
assert.equal(mismatchedWorld.worlds.length, 0, "world-level variant scope excludes an unrelated world");

const titleFallback = runtime.resolve([{ id: "title-fallback", entries: [{ id: "title-only", title: "North gate", content: "The north gate is watched.", enabled: true }] }], { currentMessage: "Wait by the north gate." });
assert.equal(titleFallback.trace.selectedEntries[0].entryId, "title-only", "an ordinary keyless entry can fall back to its title without indexing its body");
const universalFallback = runtime.resolve([{ id: "legacy-universal", entries: [{ id: "universal", title: "Universal", content: "A legacy universal rule.", activationMode: "unkeyed-universal", alwaysActive: true }] }], { currentMessage: "Unrelated message." });
assert.equal(universalFallback.trace.selectedEntries[0].reason, "always_active", "translated universal entries remain active without a keyword");

console.log("worldbook-runtime: 8 assertions passed");
