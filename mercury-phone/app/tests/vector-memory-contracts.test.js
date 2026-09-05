"use strict";

const assert = require("node:assert/strict");
const memory = require("../core/vector-memory-contracts.js");

assert.equal(memory.SCHEMA_VERSION, 2);
assert.deepEqual(memory.normalizeScope({ contactId: " echo ", worldVariantId: " winter ", timelineId: " alternate " }), { contactId: "echo", worldVariantId: "winter", timelineId: "alternate" });
assert.deepEqual(memory.normalizeScope({ contactId: "echo" }), { contactId: "echo", worldVariantId: "default", timelineId: "default" });
assert.equal(memory.normalizeScope({ timelineId: "default" }), null);
assert.equal(memory.scopesMatch({ contactId: "echo" }, { contactId: "echo", timelineId: "default" }), true);
assert.equal(memory.scopesMatch({ contactId: "echo", worldVariantId: "one" }, { contactId: "echo", worldVariantId: "two" }), false);
assert.equal(memory.tokenize("赵琪在宫中读书").includes("赵琪"), true);
assert.equal(memory.tokenize("A quiet harbor").includes("harbor"), true);

const record = { id: "record-1", status: "confirmed", content: "赵琪将在秋猎后返回京城。", createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-03T00:00:00.000Z", evidence: { certainty: "explicit", sourceTurnIds: ["turn-1"] } };
const sessionEntry = memory.entryFromConfirmedRecord(record, { contactId: "zhao", timelineId: "default" });
assert.equal(sessionEntry.id, "relationship:zhao:default:default:record-1");
assert.equal(sessionEntry.retention, "session", "confirmation alone is not long-term eligibility");
assert.equal(sessionEntry.eventType, "shared-event");
assert.equal(memory.entryFromConfirmedRecord({ ...record, status: "pending" }, { contactId: "zhao" }), null);

const durableEntry = memory.normalizeEntry({ ...sessionEntry, retention: "durable", importance: 4, embedding: { modelId: "local-v1", dimensions: 2, values: [1, 0] } });
const supersededEntry = memory.normalizeEntry({ ...durableEntry, id: "old-preference", eventType: "preference", content: "赵琪讨厌下雨。", state: "superseded", supersededBy: durableEntry.id });
const expiredEntry = memory.normalizeEntry({ ...durableEntry, id: "old-appointment", content: "明天早上八点有课。", expiresAt: "2026-08-02T00:00:00.000Z", state: "active" }, { now: Date.parse("2026-08-13T00:00:00.000Z") });
const otherScope = memory.normalizeEntry({ ...durableEntry, id: "other", scope: { contactId: "zhao", worldVariantId: "other-world", timelineId: "default" }, content: "赵琪在秋猎后回京。" });
assert.equal(expiredEntry.state, "expired");

const ranked = memory.rankEntries([durableEntry, supersededEntry, expiredEntry, otherScope], { scope: { contactId: "zhao", worldVariantId: "default", timelineId: "default" }, query: "秋猎之后赵琪回京吗", embedding: { modelId: "local-v1", dimensions: 2, values: [1, 0] }, now: Date.parse("2026-08-13T00:00:00.000Z") });
assert.deepEqual(ranked.map((item) => item.id), [durableEntry.id]);
assert.equal(ranked[0].match, "semantic");
assert.equal(memory.rankEntries([sessionEntry], { scope: { contactId: "zhao" }, query: "秋猎" }).length, 0, "session-only facts cannot leak into long-term retrieval");
assert.equal(memory.rankEntries([durableEntry], { scope: { contactId: "zhao", worldVariantId: "default", timelineId: "other" }, query: "秋猎" }).length, 0, "timeline scope is hard-filtered");

const lexical = memory.rankEntries([durableEntry], { scope: { contactId: "zhao", timelineId: "default" }, query: "秋猎之后" });
assert.equal(lexical.length, 1);
assert.equal(lexical[0].match, "keyword");
const runtime = memory.runtimeRecords([...ranked, ...ranked, ...ranked, ...ranked]);
assert.equal(runtime.length, 3);
assert.deepEqual(runtime[0], { id: durableEntry.id, eventType: "shared-event", content: durableEntry.content, occurredAt: durableEntry.occurredAt, sourceId: "record-1" });
assert.equal(memory.normalizeEmbedding({ modelId: "bad", dimensions: 2, values: [1] }), null);
assert.equal(memory.cosineSimilarity([1, 0], [1, 0]), 1);
assert.equal(memory.cosineSimilarity([1, 0], [0, 1]), 0);

console.log("vector-memory-contracts: assertions passed");
