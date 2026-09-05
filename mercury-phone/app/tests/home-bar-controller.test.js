"use strict";

const assert = require("node:assert/strict");
global.window = global;
global.CustomEvent = class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } };
require("../core/contracts.js");
require("../core/events.js");
require("../core/state-machine.js");
require("../system/home-bar-controller.js");

const classes = new Set();
const dispatched = [];
const screen = {
  classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) },
  dispatchEvent: (event) => dispatched.push(event),
};
const gestureTarget = {};
let gestureOptions;
let unregistered = false;
const gestureManager = {
  registerEdgeSwipe(target, options) {
    assert.equal(target, gestureTarget);
    gestureOptions = options;
    return () => { unregistered = true; };
  },
};
const machine = new global.MercurySystemStateMachine();
const E = global.MercuryEvents;
machine.dispatch(E.BOOT_COMPLETE);
machine.dispatch(E.REQUEST_UNLOCK);
machine.dispatch(E.UNLOCK_SUCCESS);
machine.dispatch(E.OPEN_APP, { appId: "settings" });
const paused = [];
const appEngine = { activeAppId: "settings", pause: (appId) => paused.push(appId) };
const controller = new global.MercuryHomeBarController({ screen, gestureTarget, machine, events: E, gestureManager, appEngine });

assert.equal(gestureOptions.edgeSize, 58);
assert.equal(gestureOptions.threshold, 44);
assert.equal(gestureOptions.holdDelay, 240);
assert.equal(gestureOptions.canStart({ target: { closest: () => null } }), true);
assert.equal(gestureOptions.canStart({ target: { closest: () => ({}) } }), false);
gestureOptions.onStart();
assert.equal(classes.has("is-home-gesture-active"), true);
gestureOptions.onHoldCommit({ edge: "bottom", distance: 64 });
assert.equal(machine.state, "appOpen");
assert.equal(dispatched.at(-1).detail.intent, "switcher");
gestureOptions.onCommit({ edge: "bottom", distance: 72 });
assert.equal(machine.state, "home");
assert.deepEqual(paused, ["settings"]);
assert.equal(dispatched.at(-1).detail.intent, "home");
gestureOptions.onEnd();
assert.equal(classes.has("is-home-gesture-active"), false);
controller.destroy();
assert.equal(unregistered, true);

const homeMachine = new global.MercurySystemStateMachine(global.MercuryContracts.SYSTEM_STATES.HOME);
let homeGestureOptions;
const homeController = new global.MercuryHomeBarController({
  screen,
  gestureTarget,
  machine: homeMachine,
  events: E,
  gestureManager: { registerEdgeSwipe(target, options) { homeGestureOptions = options; return () => {}; } },
  appEngine: { activeAppId: null, pause() {} },
});
assert.equal(homeGestureOptions.canStart({ target: { closest: () => null } }), true);
homeGestureOptions.onCommit({ edge: "bottom", distance: 60 });
assert.equal(dispatched.at(-1).detail.intent, "switcher");
homeGestureOptions.onHoldCommit({ edge: "bottom", distance: 60 });
assert.equal(dispatched.at(-1).detail.intent, "switcher");
homeController.destroy();

console.log("home-bar-controller: 14 assertions passed");
