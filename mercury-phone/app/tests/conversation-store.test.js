"use strict";

const assert = require("node:assert/strict");
global.window = global;
require("../core/chat-contracts.js");
require("../system/conversation-store.js");

const Store = global.MercuryConversationStore;
const contracts = global.MercuryChatContracts;

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  const writes = [];
  return {
    values,
    writes,
    get(key, fallback) { return values.has(key) ? values.get(key) : fallback; },
    set(key, value) { writes.push({ key, value }); values.set(key, value); return value; },
  };
}

function message(id = "message-1") {
  return { id, role: "user", content: "Hello", createdAt: "2026-08-19T00:00:00.000Z", delivery: "complete" };
}

const keys = new Store();
assert.equal(keys.keyFor("contact-a"), "conversation.v1", "the original default-conversation key remains compatible");
assert.equal(keys.keyFor("contact-b"), "conversation.contact-b.v1");
assert.equal(keys.keyFor("contact-b", "timeline-2"), "conversation.contact-b.timeline-2.v1");
assert.throws(() => keys.keyFor(""), /contact id/);
assert.throws(() => new Store({ storage: { get() {} } }), /get and set/);

const fallback = [message("starter")];
const absent = new Store({ storage: memoryStorage() }).load("contact-a", "default", { fallbackMessages: fallback });
assert.equal(absent.hadStoredValue, false);
assert.equal(absent.corrupted, false, "an absent record is not mislabeled as damaged data");
assert.equal(absent.sourceStatus, "missing");
assert.equal(absent.messages[0].id, "starter", "only an absent or unreadable source uses the caller's starter transcript");

const emptyConversation = contracts.migrateV1({ schemaVersion: 1, id: "contact-a:default", messages: [] });
const explicitEmptyStorage = memoryStorage({ "conversation.v1": emptyConversation });
const explicitEmpty = new Store({ storage: explicitEmptyStorage }).load("contact-a", "default", { fallbackMessages: fallback });
assert.equal(explicitEmpty.hadStoredValue, true);
assert.equal(explicitEmpty.corrupted, false);
assert.equal(explicitEmpty.sourceStatus, "ready");
assert.equal(explicitEmpty.messages.length, 0, "an explicitly saved empty conversation never resurrects starter messages");

const legacy = { schemaVersion: 1, id: "contact-a:default", messages: [message()] };
const legacyStorage = memoryStorage({ "conversation.v1": legacy });
const migrated = new Store({ storage: legacyStorage }).load("contact-a");
assert.equal(migrated.migrated, true);
assert.equal(migrated.sourceStatus, "migrated");
assert.equal(migrated.migrationPersisted, true);
assert.equal(legacyStorage.writes.length, 1);
assert.equal(legacyStorage.values.get("conversation.v1").schemaVersion, 2, "legacy data is normalized through the domain contract before write-back");

const damagedStorage = memoryStorage({ "conversation.v1": { schemaVersion: 99, unexpected: true } });
const recovered = new Store({ storage: damagedStorage }).load("contact-a", "default", { fallbackMessages: fallback });
assert.equal(recovered.corrupted, true);
assert.equal(recovered.sourceStatus, "corrupted");
assert.equal(recovered.messages[0].id, "starter");
assert.equal(damagedStorage.writes.length, 0, "recovery does not silently overwrite the damaged source");

const migrationWriteFailure = new Store({ storage: { get: () => legacy, set: () => { throw new Error("quota"); } } }).load("contact-a");
assert.equal(migrationWriteFailure.messages[0].id, "message-1", "a migration write failure does not make valid data unreadable");
assert.equal(migrationWriteFailure.migrationPersisted, false);
assert.equal(migrationWriteFailure.writeError.code, "CONVERSATION_MIGRATION_WRITE_FAILED");

const readFailure = new Store({ storage: { get: () => { throw new Error("blocked"); }, set() {} } }).load("contact-a", "default", { fallbackMessages: fallback });
assert.equal(readFailure.messages[0].id, "starter");
assert.equal(readFailure.sourceStatus, "unavailable");
assert.equal(readFailure.readError.code, "CONVERSATION_STORAGE_READ_FAILED");

const saveStorage = memoryStorage();
const saveStore = new Store({ storage: saveStorage });
const saved = saveStore.save("contact-a", "default", legacy);
assert.equal(saved.schemaVersion, 2);
assert.equal(saveStorage.values.get("conversation.v1").schemaVersion, 2);
assert.throws(() => saveStore.save("contact-a", "default", { broken: true }), (error) => error.code === "CONVERSATION_INVALID");
assert.throws(
  () => new Store({ storage: { get: () => null, set: () => { throw new Error("quota"); } } }).save("contact-a", "default", emptyConversation),
  (error) => error.code === "CONVERSATION_STORAGE_WRITE_FAILED",
);

console.log("conversation-store: contract assertions passed");
