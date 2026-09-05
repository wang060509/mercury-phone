"use strict";

const assert = require("node:assert/strict");
global.window = global;
require("../core/contracts.js");
require("../core/events.js");
require("../core/state-machine.js");
require("../system/system-components.js");
require("../system/desktop-icon-map.js");
require("../system/home-controller.js");

class ClassList { add() {} remove() {} toggle() {} }
class FakeElement {
  constructor(tag) { this.tag = tag; this.children = []; this.attributes = {}; this.listeners = {}; this.dataset = {}; this.style = {}; this.classList = new ClassList(); this.textContent = ""; this.className = ""; this.type = ""; this.src = ""; this.alt = ""; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  removeEventListener(type) { delete this.listeners[type]; }
}

const root = new FakeElement("section");
const components = new global.MercurySystemComponents({ createElement: (tag) => new FakeElement(tag) });
const localeListeners = new Set();
const i18n = { t(key, values = {}) { return key === "home.page" ? `Page ${values.page}` : key; }, subscribe(listener) { localeListeners.add(listener); return () => localeListeners.delete(listener); } };
const swipes = {};
const gestureManager = { registerSwipe(element, options) { swipes[options.direction] = options.onCommit; return () => { delete swipes[options.direction]; }; } };
const machine = new global.MercurySystemStateMachine(global.MercuryContracts.SYSTEM_STATES.HOME);
const launches = [];
const home = new global.MercuryHomeController({ root, machine, gestureManager, components, i18n, onLaunch: (appId) => launches.push(appId) });
const findNode = (node, predicate) => predicate(node) ? node : node.children?.map((child) => findNode(child, predicate)).find(Boolean);

assert.equal(root.getAttribute("aria-hidden"), "false");
assert.equal(root.children.length, 2);
assert.equal(home.track.children.length, 2);
assert.equal(home.indicator.children.length, 2);
assert.equal(home.pageIndex, 0);
const settingsButton = findNode(root, (node) => node.getAttribute?.("aria-label") === "apps.settings");
settingsButton.listeners.click();
assert.deepEqual(launches, ["settings"]);
const marketButton = findNode(root, (node) => node.getAttribute?.("aria-disabled") === "true");
assert.equal(marketButton.getAttribute("aria-label"), "apps.market — apps.comingSoon");
assert.equal(marketButton.children[0].children[0].src, "assets/icons/desktop-handdrawn/market.svg");
assert.equal(home.goToPage(1), true);
assert.equal(home.track.style.transform, "translate3d(-100%, 0, 0)");
assert.equal(home.indicator.children[1].getAttribute("aria-current"), "page");
assert.equal(home.goToPage(7), false);
swipes.right();
assert.equal(home.pageIndex, 0);
swipes.left();
assert.equal(home.pageIndex, 1);
machine.dispatch(global.MercuryEvents.LOCK);
assert.equal(root.getAttribute("aria-hidden"), "true");
home.destroy();
assert.deepEqual(Object.keys(swipes), []);
assert.equal(localeListeners.size, 0);

console.log("home-controller: 15 assertions passed");
