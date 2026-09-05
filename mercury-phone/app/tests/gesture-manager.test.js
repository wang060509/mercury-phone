"use strict";

const assert = require("node:assert/strict");
global.window = global;
require("../core/gesture-manager.js");

class FakeTarget {
  constructor() { this.listeners = new Map(); this.captured = new Set(); }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  removeEventListener(type) { this.listeners.delete(type); }
  emit(type, detail) { this.listeners.get(type)?.(detail); }
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { this.captured.delete(id); }
  getBoundingClientRect() { return { top: 0, right: 390, bottom: 844, left: 0 }; }
}

const manager = new global.MercuryGestureManager();
const target = new FakeTarget();
let commits = 0;
const unregister = manager.registerSwipe(target, { direction: "up", threshold: 40, onCommit: () => { commits += 1; } });
target.emit("pointerdown", { clientX: 100, clientY: 180, pointerId: 1 });
assert.equal(target.captured.has(1), false);
target.emit("pointermove", { clientX: 101, clientY: 165, pointerId: 1 });
assert.equal(target.captured.has(1), true);
target.emit("pointerup", { clientX: 104, clientY: 112, pointerId: 1 });
assert.equal(commits, 1);
assert.equal(target.captured.has(1), false);
target.emit("pointerdown", { clientX: 100, clientY: 180, pointerId: 2 });
target.emit("pointerup", { clientX: 170, clientY: 150, pointerId: 2 });
assert.equal(commits, 1);
target.emit("pointerdown", { clientX: 100, clientY: 180, pointerId: 3 });
target.emit("pointercancel", { pointerId: 3 });
assert.equal(target.captured.has(3), false);
target.emit("pointerup", { clientX: 100, clientY: 80, pointerId: 3 });
assert.equal(commits, 1);
unregister();
assert.equal(target.listeners.size, 0);
assert.throws(() => manager.registerSwipe(null), /target element/);
manager.destroy();

const edgeManager = new global.MercuryGestureManager();
const edgeTarget = new FakeTarget();
let edgeCommits = 0;
let holdCommits = 0;
let preventedDefaults = 0;
const unregisterEdge = edgeManager.registerEdgeSwipe(edgeTarget, {
  edge: "bottom",
  threshold: 50,
  holdDelay: 15,
  onCommit: () => { edgeCommits += 1; },
  onHoldCommit: () => { holdCommits += 1; },
});
edgeTarget.emit("pointerdown", { clientX: 190, clientY: 700, pointerId: 8 });
edgeTarget.emit("pointermove", { clientX: 190, clientY: 620, pointerId: 8 });
edgeTarget.emit("pointerup", { clientX: 190, clientY: 620, pointerId: 8 });
assert.equal(edgeCommits, 0);
edgeTarget.emit("pointerdown", { clientX: 190, clientY: 835, pointerId: 9, preventDefault() { preventedDefaults += 1; } });
edgeTarget.emit("pointermove", { clientX: 192, clientY: 770, pointerId: 9, preventDefault() { preventedDefaults += 1; } });
edgeTarget.emit("pointerup", { clientX: 192, clientY: 770, pointerId: 9 });
assert.equal(edgeCommits, 1);
assert.equal(edgeTarget.captured.has(9), false);
assert.equal(preventedDefaults, 2);

setTimeout(() => {
  edgeTarget.emit("pointerdown", { clientX: 190, clientY: 835, pointerId: 10 });
  edgeTarget.emit("pointermove", { clientX: 190, clientY: 770, pointerId: 10 });
  setTimeout(() => {
    assert.equal(holdCommits, 1);
    edgeTarget.emit("pointerup", { clientX: 190, clientY: 760, pointerId: 10 });
    assert.equal(edgeCommits, 1);
    edgeTarget.emit("pointerdown", { clientX: 190, clientY: 835, pointerId: 11 });
    edgeTarget.emit("pointermove", { clientX: 190, clientY: 770, pointerId: 11 });
    edgeTarget.emit("lostpointercapture", { pointerId: 11 });
    edgeTarget.emit("pointerup", { clientX: 190, clientY: 760, pointerId: 11 });
    assert.equal(edgeCommits, 1);
    edgeTarget.emit("pointerdown", { clientX: 190, clientY: 835, pointerId: 12 });
    edgeTarget.emit("pointermove", { clientX: 260, clientY: 770, pointerId: 12 });
    edgeTarget.emit("pointerup", { clientX: 260, clientY: 770, pointerId: 12 });
    assert.equal(edgeCommits, 1);
    for (let pointerId = 20; pointerId < 30; pointerId += 1) {
      edgeTarget.emit("pointerdown", { clientX: 190, clientY: 835, pointerId });
      edgeTarget.emit("pointermove", { clientX: 190, clientY: 775, pointerId });
      edgeTarget.emit("pointerup", { clientX: 190, clientY: 775, pointerId });
    }
    assert.equal(edgeCommits, 11);
    unregisterEdge();
    assert.equal(edgeTarget.listeners.size, 0);
console.log("gesture-manager: 20 assertions passed");
  }, 25);
}, 0);
