"use strict";

const assert = require("node:assert/strict");
global.window = global;
require("../system/system-services.js");
require("../system/island-controller.js");

class FakeElement {
  constructor() { this.attributes = {}; this.dataset = {}; this.listeners = {}; this.hidden = false; this.src = ""; this.textContent = ""; this.map = {}; }
  querySelector(selector) { return this.map[selector]; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  removeEventListener(type) { delete this.listeners[type]; }
  click() { this.listeners.click?.(); }
}

const island = new FakeElement();
const idle = new FakeElement();
const compact = new FakeElement();
const compactIcon = new FakeElement();
const compactText = new FakeElement();
const artIcon = new FakeElement();
const title = new FakeElement();
const detail = new FakeElement();
const trailing = new FakeElement();
Object.assign(island.map, { "#islandIdle": idle, "#islandCompact": compact, "#islandCompactIcon": compactIcon, "#islandCompactText": compactText, "#islandArtIcon": artIcon, "#islandTitle": title, "#islandDetail": detail, "#islandTrailing": trailing });
const hub = new global.MercurySystemServices({ storage: { setItem() {}, getItem() { return null; }, removeItem() {}, get length() { return 0; }, key() { return null; } } });
const localeListeners = new Set();
const translations = { "contacts.a": "Contact A", "island.compact": "Contact A is typing", "island.detail": "I thought of you.", "island.idle": "Idle", "island.collapse": "Collapse" };
const i18n = { t(key, values = {}) { return key === "island.expand" ? `Expand ${values.title}` : (translations[key] || key); }, subscribe(listener) { localeListeners.add(listener); return () => localeListeners.delete(listener); } };
const controller = new global.MercuryIslandController({ island, systemServices: hub, i18n });

assert.equal(island.dataset.state, "idle");
assert.equal(controller.toggleExpanded(), true);
assert.equal(island.getAttribute("aria-expanded"), "true");
assert.equal(title.textContent, "system.name");
assert.equal(detail.textContent, "island.idleDetail");
controller.toggleExpanded(false);
const chat = hub.createAppServices("mercury-chat");
chat.dynamicIsland.set({ kind: "message", title: "fallback", titleKey: "contacts.a", compactKey: "island.compact", detailKey: "island.detail", priority: 10 });
assert.equal(island.dataset.state, "active");
assert.equal(compact.hidden, false);
assert.equal(compactText.textContent, "Contact A is typing");
assert.match(compactIcon.src, /chat-bubble\.svg$/);
island.click();
assert.equal(island.getAttribute("aria-expanded"), "true");
assert.equal(title.textContent, "Contact A");
assert.equal(detail.textContent, "I thought of you.");
const timer = hub.createAppServices("timer");
timer.dynamicIsland.set({ kind: "timer", title: "Timer", detail: "00:20", priority: 30 });
assert.equal(title.textContent, "Timer");
assert.match(artIcon.src, /timer\.svg$/);
timer.dynamicIsland.clear();
assert.equal(title.textContent, "Contact A");
chat.dynamicIsland.clear();
assert.equal(island.dataset.state, "idle");
assert.equal(island.getAttribute("aria-expanded"), "false");
controller.destroy();
assert.equal(localeListeners.size, 0);

console.log("island-controller: 19 assertions passed");
