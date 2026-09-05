"use strict";

const assert = require("node:assert/strict");
global.window = global;
require("../system/system-components.js");

class FakeElement {
  constructor(tag) { this.tag = tag; this.children = []; this.attributes = {}; this.listeners = {}; this.textContent = ""; this.className = ""; this.type = ""; this.src = ""; this.alt = ""; }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  click() { this.listeners.click?.(); }
}

const ui = new global.MercurySystemComponents({ createElement: (tag) => new FakeElement(tag) });
const icon = ui.icon("spark");
assert.equal(icon.src, "assets/icons/iconoir/spark.svg");
assert.equal(icon.getAttribute("aria-hidden"), "true");
assert.throws(() => ui.icon("../bad"), /Invalid Iconoir/);

let pressed = 0;
const iconButton = ui.iconButton({ icon: "settings", label: "Settings", onPress: () => { pressed += 1; } });
assert.equal(iconButton.tag, "button");
assert.equal(iconButton.getAttribute("aria-label"), "Settings");
iconButton.click();
assert.equal(pressed, 1);
assert.throws(() => ui.iconButton({ icon: "settings" }), /accessible label/);

const panel = ui.glassPanel({ className: "settings-panel", label: "Preferences" });
assert.match(panel.className, /mercury-glass/);
assert.equal(panel.getAttribute("aria-label"), "Preferences");

const list = ui.list({ label: "General", rows: [{ icon: "settings", label: "Settings", detail: "System", onPress: () => {} }] });
assert.equal(list.children.length, 1);
assert.equal(list.children[0].tag, "button");
assert.equal(list.children[0].children[1].children[0].textContent, "Settings");

let toggleValue = null;
const toggle = ui.toggle({ label: "Passcode", checked: false, onChange: (value) => { toggleValue = value; } });
assert.equal(toggle.getAttribute("role"), "switch");
assert.equal(toggle.getAttribute("aria-checked"), "false");
toggle.click();
assert.equal(toggle.getAttribute("aria-checked"), "true");
assert.equal(toggleValue, true);

const appIcon = ui.appIcon({ icon: "chat-bubble", name: "Mercury", badge: 120 });
assert.equal(appIcon.getAttribute("aria-label"), "Mercury");
assert.equal(appIcon.children[0].children[1].textContent, "99+");

const illustratedIcon = ui.appIcon({ icon: "graph-up", artwork: "assets/icons/desktop-handdrawn/market.svg", name: "Market", status: "Soon" });
assert.equal(illustratedIcon.children[0].children[0].src, "assets/icons/desktop-handdrawn/market.svg");
assert.equal(illustratedIcon.getAttribute("aria-disabled"), "true");
assert.equal(illustratedIcon.getAttribute("aria-label"), "Market — Soon");

let keyValue = null;
const key = ui.keypadKey({ value: 7, onPress: (value) => { keyValue = value; } });
key.click();
assert.equal(keyValue, 7);
assert.equal(key.getAttribute("aria-label"), "7");

console.log("system-components: 20 assertions passed");
