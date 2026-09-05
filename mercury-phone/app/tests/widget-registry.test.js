"use strict";

const assert = require("node:assert/strict");
global.window = global;
require("../core/contracts.js");
require("../system/widget-registry.js");

const registry = new global.MercuryWidgetRegistry();
const events = [];
registry.subscribe((event) => events.push(event));
const widget = registry.register("mercury-chat", { id: "lumi", size: "medium", render() {} });
assert.equal(widget.appId, "mercury-chat");
assert.equal(widget.size, "medium");
assert.equal(registry.list().length, 1);
assert.equal(registry.list("mercury-chat").length, 1);
assert.equal(registry.list("settings").length, 0);
assert.throws(() => registry.register("mercury-chat", { id: "lumi", size: "medium", render() {} }), /already registered/);
assert.throws(() => registry.register("settings", { id: "bad", size: "tiny", render() {} }), /supported size/);
assert.equal(registry.unregister("mercury-chat", "lumi"), true);
assert.equal(registry.unregister("mercury-chat", "lumi"), false);
assert.deepEqual(events.map((event) => event.type), ["registered", "unregistered"]);

console.log("widget-registry: 10 assertions passed");
