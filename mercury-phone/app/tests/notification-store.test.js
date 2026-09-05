"use strict";

const assert = require("node:assert/strict");
global.window = global;
require("../system/notification-store.js");

class FakeStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

const storage = new FakeStorage();
const store = new global.MercuryNotificationStore({ storage });
const events = [];
store.subscribe((event) => events.push(event.type));
const note = store.add({ title: "For later", body: "Buy flowers" });
assert.equal(note.kind, "note");
assert.equal(store.list().length, 1);
const message = store.add({ id: "lumi:1", kind: "message", title: "Lumi", body: "Are you there?", senderId: "lumi", conversationId: "chat:lumi" });
assert.equal(message.senderId, "lumi");
assert.equal(message.conversationId, "chat:lumi");
assert.equal(store.list()[0].id, "lumi:1");
store.add({ id: "lumi:1", kind: "message", title: "Lumi", body: "Updated", senderId: "lumi" });
assert.equal(store.list().length, 2);
assert.equal(store.list().find((item) => item.id === "lumi:1").body, "Updated");
assert.throws(() => store.add({ title: "Empty" }), /require a body/);
assert.equal(store.remove(note.id), true);
assert.equal(store.remove("missing"), false);
const restored = new global.MercuryNotificationStore({ storage });
assert.equal(restored.list().length, 1);
assert.equal(restored.clear(), 1);
assert.equal(restored.clear(), 0);
assert.deepEqual(events, ["added", "added", "added", "removed"]);

console.log("notification-store: 15 assertions passed");
