"use strict";

const assert = require("node:assert/strict");
global.window = global;
require("../core/contracts.js");
require("../core/events.js");
require("../core/state-machine.js");
require("../system/lock-controller.js");

class ClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  toggle(value, force) { force ? this.values.add(value) : this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}
class FakeElement {
  constructor() { this.children = []; this.attributes = {}; this.listeners = {}; this.dataset = {}; this.classList = new ClassList(); this.textContent = ""; }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  removeEventListener(type) { delete this.listeners[type]; }
}
const createParts = () => ({ lockScreen: new FakeElement(), passcodeScreen: new FakeElement(), keypad: new FakeElement(), dots: Object.assign(new FakeElement(), { children: [new FakeElement(), new FakeElement(), new FakeElement(), new FakeElement()] }), message: new FakeElement(), cancelButton: new FakeElement() });
const components = {
  createElement: () => new FakeElement(),
  keypadKey: ({ value, onPress }) => Object.assign(new FakeElement(), { value, onPress }),
  iconButton: ({ onPress }) => Object.assign(new FakeElement(), { onPress }),
};
const gestureManager = { registerSwipe(element, options) { element.swipe = options.onCommit; return () => { element.swipe = null; }; } };

const openMachine = new global.MercurySystemStateMachine(global.MercuryContracts.SYSTEM_STATES.LOCKED);
const openParts = createParts();
const openLock = new global.MercuryLockController({ machine: openMachine, events: global.MercuryEvents, gestureManager, components, ...openParts });
openParts.lockScreen.swipe();
assert.equal(openMachine.state, "home");
assert.equal(openParts.lockScreen.getAttribute("aria-hidden"), "true");
openLock.destroy();

const pinMachine = new global.MercurySystemStateMachine(global.MercuryContracts.SYSTEM_STATES.LOCKED);
const pinParts = createParts();
pinParts.message.dataset.errorText = "Wrong passcode";
const pinLock = new global.MercuryLockController({ machine: pinMachine, events: global.MercuryEvents, gestureManager, components, previewPasscode: "2468", ...pinParts });
assert.equal(pinParts.keypad.children.length, 12);
assert.equal(pinLock.requestUnlock(), true);
assert.equal(pinMachine.state, "unlocking");
assert.equal(pinParts.passcodeScreen.getAttribute("aria-hidden"), "false");
assert.equal(pinLock.cancel(), true);
assert.equal(pinMachine.state, "locked");
assert.equal(pinParts.lockScreen.getAttribute("aria-hidden"), "false");
assert.equal(pinLock.requestUnlock(), true);
[2, 4, 6, 8].forEach((digit) => pinLock.enterDigit(digit));
assert.equal(pinMachine.state, "home");
assert.equal(pinLock.input, "");
assert.throws(() => pinLock.setPasscode(true, "12"), /four digits/);
assert.deepEqual(pinLock.setPasscode(false), { enabled: false, passcode: null });
pinLock.destroy();

console.log("lock-controller: 14 assertions passed");
