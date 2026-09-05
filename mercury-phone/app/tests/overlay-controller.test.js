"use strict";

const assert = require("node:assert/strict");
global.window = global;
require("../core/contracts.js");
require("../core/events.js");
require("../core/state-machine.js");
require("../system/notification-store.js");
require("../system/overlay-controller.js");

class FakeElement {
  constructor(tag = "div") { this.tag = tag; this.children = []; this.attributes = {}; this.listeners = {}; this.style = {}; this.dataset = {}; this.value = ""; this.textContent = ""; this.hidden = false; this.className = ""; this.map = {}; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  removeEventListener(type, listener) { this.listeners[type] = (this.listeners[type] || []).filter((item) => item !== listener); }
  dispatch(type, event = {}) { (this.listeners[type] || []).forEach((listener) => listener({ preventDefault() {}, target: this, ...event })); }
  querySelector(selector) { return this.map[selector] || null; }
  querySelectorAll(selector) { return selector === "[data-overlay-close]" ? this.closeButtons : []; }
}

const root = new FakeElement("section");
const control = new FakeElement("section");
const notifications = new FakeElement("section");
const brightness = new FakeElement("input");
const brightnessValue = new FakeElement("output");
const composer = new FakeElement("form");
const noteInput = new FakeElement("input");
const list = new FakeElement("div");
const empty = new FakeElement("div");
const clear = new FakeElement("button");
const closeControl = new FakeElement("button");
const closeNotifications = new FakeElement("button");
root.closeButtons = [closeControl, closeNotifications];
Object.assign(root.map, { "#controlCenter": control, "#notificationCenter": notifications, "#brightnessControl": brightness, "#brightnessValue": brightnessValue, "#notificationComposer": composer, "#notificationNote": noteInput, "#notificationList": list, "#notificationEmpty": empty, "#clearNotifications": clear });

const saved = new Map();
const storage = { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, String(value)) };
const store = new global.MercuryNotificationStore({ storage });
const machine = new global.MercurySystemStateMachine(global.MercuryContracts.SYSTEM_STATES.HOME);
const gestures = [];
const gestureManager = { registerSwipe(element, options) { gestures.push({ element, options }); return () => gestures.splice(gestures.findIndex((item) => item.options === options), 1); } };
const screen = new FakeElement("screen");
screen.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 844 });
const brightnessLayer = new FakeElement("div");
const localeListeners = new Set();
const i18n = { locale: "en-US", t: (key) => key, subscribe(listener) { localeListeners.add(listener); return () => localeListeners.delete(listener); } };
const controller = new global.MercuryOverlayController({ root, screen, machine, events: global.MercuryEvents, gestureManager, notificationStore: store, i18n, brightnessLayer, storage, createElement: (tag) => new FakeElement(tag) });

assert.equal(gestures.length, 3);
assert.equal(gestures[0].options.canStart({ clientX: 360, clientY: 30, target: { closest: () => true } }), false);
assert.equal(gestures[0].options.canStart({ clientX: 360, clientY: 30, target: { closest: () => false } }), true);
assert.equal(gestures[1].options.canStart({ clientX: 190, clientY: 30, target: { closest: () => false } }), true);
assert.equal(controller.open("control"), true);
assert.equal(machine.state, "overlayOpen");
assert.equal(control.getAttribute("aria-hidden"), "false");
assert.equal(notifications.getAttribute("aria-hidden"), "true");
assert.equal(controller.setBrightness(50), 50);
assert.equal(brightnessLayer.style.opacity, String(.31));
assert.equal(saved.get("mercury.system.brightness"), "50");
assert.equal(controller.close(), true);
assert.equal(machine.state, "home");

controller.open("notifications");
noteInput.value = "Remember the rain";
composer.dispatch("submit");
assert.equal(store.list().length, 1);
assert.equal(list.children.length, 1);
assert.equal(empty.hidden, true);
clear.dispatch("click");
assert.equal(store.list().length, 0);
closeNotifications.dispatch("click");
assert.equal(machine.state, "home");
controller.destroy();
assert.equal(gestures.length, 0);

console.log("overlay-controller: 19 assertions passed");
