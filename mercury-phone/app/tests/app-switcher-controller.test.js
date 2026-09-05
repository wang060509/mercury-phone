"use strict";

const assert = require("node:assert/strict");
global.window = global;
require("../core/contracts.js");
require("../core/events.js");
require("../core/state-machine.js");
require("../system/app-switcher-controller.js");

class FakeTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  removeEventListener(type) { this.listeners.delete(type); }
  emit(type, detail = {}) { this.listeners.get(type)?.({ type, detail }); }
}

const E = global.MercuryEvents;
const machine = new global.MercurySystemStateMachine();
machine.dispatch(E.BOOT_COMPLETE);
machine.dispatch(E.REQUEST_UNLOCK);
machine.dispatch(E.UNLOCK_SUCCESS);
machine.dispatch(E.OPEN_APP, { appId: "settings" });

const screen = new FakeTarget();
const instances = [{ appId: "settings" }, { appId: "chat" }];
const lifecycle = [];
const appEngine = {
  activeAppId: "settings",
  listInstances: () => instances,
  getInstance: (id) => instances.find((record) => record.appId === id) || null,
  pause(id) { lifecycle.push(`pause:${id}`); this.activeAppId = null; },
  resume(id) { lifecycle.push(`resume:${id}`); this.activeAppId = id; },
  unmount() { throw new Error("The App Menu must never unmount an app."); },
};
const visibility = [];
const renders = [];
const view = {
  onSelect: null,
  onDismiss: null,
  setVisible(value) { visibility.push(value); },
  render(records, selected) { renders.push({ records, selected }); },
  destroy() { this.destroyed = true; },
};
const controller = new global.MercuryAppSwitcherController({ view, screen, machine, events: E, appEngine });

assert.equal(visibility.at(-1), false);
screen.emit("mercury:home-bar", { intent: "switcher" });
assert.equal(machine.state, "appSwitcher");
assert.deepEqual(lifecycle, ["pause:settings"]);
assert.equal(renders.length, 1);
assert.equal(renders[0].records, instances);
assert.equal(renders[0].selected, "settings");
assert.equal(visibility.at(-1), true);

view.onSelect("settings");
assert.equal(machine.state, "appOpen");
assert.deepEqual(lifecycle, ["pause:settings", "resume:settings"]);
assert.equal(visibility.at(-1), false);

for (let index = 0; index < 10; index += 1) {
  assert.equal(controller.open(), true);
  assert.equal(machine.state, "appSwitcher");
  assert.equal(controller.resume("settings"), true);
  assert.equal(machine.state, "appOpen");
}
assert.equal(instances.length, 2);
assert.equal(controller.resume("missing"), false);

assert.equal(controller.open(), true);
view.onDismiss();
assert.equal(machine.state, "home");
assert.equal(visibility.at(-1), false);
assert.equal(instances.length, 2);

assert.equal(controller.open(), true);
assert.equal(machine.state, "appSwitcher");
view.onDismiss();
assert.equal(machine.state, "home");

controller.destroy();
assert.equal(screen.listeners.has("mercury:home-bar"), false);
assert.equal(view.destroyed, true);
console.log("app-switcher-controller: 58 assertions passed");
