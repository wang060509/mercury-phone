"use strict";

const assert = require("node:assert/strict");
global.window = global;
require("../core/relationship-records.js");

const records = global.MercuryRelationshipRecords;
const storage = new Map();
const backend = { get: (key, fallback) => storage.has(key) ? storage.get(key) : fallback, set: (key, value) => storage.set(key, value) };
const candidate = { id: "memory-1", kind: "shared_event", content: "We will visit the coast next week.", evidence: { sourceTurnIds: ["user-1"], certainty: "explicit" } };

assert.deepEqual(records.KINDS, ["shared_event", "open_thread"]);
assert.deepEqual(records.normalize(null), { schemaVersion: 1, records: [] });
const added = records.addPending(backend, [candidate], { contactId: "contact-a", requestId: "request-1", userMessageId: "user-1", assistantTurnId: "turn-1" });
assert.equal(added.length, 1);
assert.equal(added[0].status, "pending");
assert.deepEqual(added[0].evidence.sourceTurnIds, ["user-1", "turn-1"]);
assert.equal(records.list(backend, "contact-a", "pending").length, 1);
assert.equal(records.addPending(backend, [candidate], { contactId: "contact-a", requestId: "request-2", userMessageId: "user-2", assistantTurnId: "turn-2" }).length, 0, "duplicate content is idempotent");
assert.equal(records.addPending(backend, [candidate], { contactId: "contact-a", worldVariantId: "harbor", requestId: "request-3", userMessageId: "user-3", assistantTurnId: "turn-3" }).length, 1, "the same event may exist independently in another world variant");
assert.equal(records.updateStatus(backend, added[0].id, "confirmed").status, "confirmed");
assert.equal(records.updateContent(backend, added[0].id, "We will visit the coast together next week.").content, "We will visit the coast together next week.");
assert.equal(records.updateMemory(backend, added[0].id, { retention: "durable", eventType: "commitment", importance: 4 }).memory.retention, "durable");
assert.equal(records.updateMemory(backend, added[0].id, { state: "superseded", supersededBy: "record-new" }).memory.supersededBy, "record-new");
assert.equal(records.updateMemory(backend, added[0].id, { state: "active", expiresAt: "2026-08-20T00:00:00.000Z" }).memory.expiresAt, "2026-08-20T00:00:00.000Z");
const backup = records.exportDurableEvents(backend, { contactId: "contact-a", worldVariantId: "default", timelineId: "default" });
assert.equal(backup.kind, records.EVENT_BACKUP_KIND);
assert.equal(backup.records.length, 1, "a backup keeps durable event sources, not the derived vector index");
const restoredStorage = new Map();
const restoredBackend = { get: (key, fallback) => restoredStorage.has(key) ? restoredStorage.get(key) : fallback, set: (key, value) => restoredStorage.set(key, value) };
assert.equal(records.importDurableEvents(restoredBackend, backup, { contactId: "contact-a", worldVariantId: "default", timelineId: "default" }), 1);
assert.equal(records.importDurableEvents(restoredBackend, backup, { contactId: "contact-a", worldVariantId: "default", timelineId: "default" }), 0, "event backup imports are idempotent");
assert.throws(() => records.importDurableEvents(restoredBackend, backup, { contactId: "contact-a", worldVariantId: "harbor", timelineId: "default" }), /Invalid event memory backup/, "event backups cannot cross a world-variant scope");
assert.equal(records.list(backend, "contact-a", "confirmed").length, 1);
assert.equal(records.list(backend, "contact-a", "pending").length, 1, "the other world variant remains an independent pending record");
assert.equal(records.updateStatus(backend, "missing", "confirmed"), null);
assert.equal(records.updateContent(backend, "missing", "No record"), null);
assert.equal(records.candidateToRecord({ kind: "fact", content: "not supported" }, { contactId: "contact-a" }), null);
assert.equal(records.candidateToRecord({ kind: "open_thread", content: "Continue this later.", evidence: { sourceTurnIds: [], certainty: "inferred" } }, { contactId: "contact-a", userMessageId: "user-2", assistantTurnId: "turn-2" }).evidence.certainty, "inferred");

console.log("relationship-records: 15 assertions passed");
