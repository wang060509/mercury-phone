"use strict";

const assert = require("node:assert/strict");
const contracts = require("../core/role-analysis-contracts.js");

const input = contracts.createInput({ displayName: "River", identity: "Imported character", background: "A careful guide who protects the harbor.", openingMessage: "The tide is turning.", stableTraits: ["calm"] });
assert.equal(input.displayName, "River");
assert.match(input.sourceText, /careful guide/);
assert.equal(input.sourceText.includes("Imported character"), false);
assert.equal(contracts.validateInput(input), true);

const response = {
  schemaVersion: 1,
  analysis: {
    identity: "Harbor guide",
    summary: "A precise and quiet guide.",
    stableTraits: ["calm", "observant"],
    boundaries: ["Does not make unsupported promises"],
    voiceStyle: "Short, practical sentences.",
    unknown: "discarded",
  },
  sourceTruncated: false,
  warnings: [],
};
assert.equal(contracts.validateResponse(response), true);
const merged = contracts.mergeIntoProfile({ displayName: "River", identity: "Imported character", background: "Original source text.", stableTraits: ["calm"] }, response, "2026-08-13T00:00:00.000Z");
assert.equal(merged.identity, "Harbor guide");
assert.equal(merged.summary, "A precise and quiet guide.");
assert.equal(merged.background, "Original source text.");
assert.deepEqual(merged.stableTraits, ["calm"]);
assert.deepEqual(merged.boundaries, ["Does not make unsupported promises"]);
assert.deepEqual(merged.analysis.filledFields.sort(), ["boundaries", "identity", "summary", "voiceStyle"].sort());

const extracted = contracts.extractLocalAnalysis({ background: "<character>\n```yaml\nRole:\n  identity: Harbor keeper\n  personality:\n    traits: calm, observant\n  relationship_logic: Slow to trust\n  conflict_handling: Steps back before responding\n  language_style: Brief and measured\n  goals:\n    short_term: Keep the pier open\n```" });
assert.equal(extracted.analysis.identity, "Harbor keeper");
assert.deepEqual(extracted.analysis.stableTraits, ["calm", "observant"]);
assert.equal(extracted.analysis.voiceStyle, "Brief and measured");

assert.throws(() => contracts.validateInput({ schemaVersion: 1, displayName: "River", sourceText: "", truncated: false }));
assert.throws(() => contracts.validateResponse({ schemaVersion: 1, analysis: {}, warnings: "no" }));

console.log("role-analysis-contracts: 12 assertions passed");
