"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
global.window = global;
require("../core/contracts.js");
require("../core/events.js");
require("../core/state-machine.js");

const S = global.MercuryContracts.SYSTEM_STATES;
const E = global.MercuryEvents;
const machine = new global.MercurySystemStateMachine();
const observed = [];
machine.subscribe((transition) => observed.push(transition));

assert.equal(machine.state, S.BOOTING);
assert.equal(machine.dispatch(E.OPEN_APP).accepted, false);
assert.equal(machine.state, S.BOOTING);
assert.equal(machine.dispatch(E.BOOT_COMPLETE).to, S.LOCKED);
assert.equal(machine.dispatch(E.REQUEST_UNLOCK).to, S.UNLOCKING);
assert.equal(machine.dispatch(E.UNLOCK_CANCEL).to, S.LOCKED);
assert.equal(machine.dispatch(E.REQUEST_UNLOCK).to, S.UNLOCKING);
assert.equal(machine.dispatch(E.UNLOCK_SUCCESS).to, S.HOME);
assert.equal(machine.dispatch(E.OPEN_APP).to, S.APP_OPEN);
assert.equal(machine.dispatch(E.OPEN_OVERLAY).to, S.OVERLAY_OPEN);
assert.equal(machine.dispatch(E.CLOSE_OVERLAY).to, S.APP_OPEN);
assert.equal(machine.dispatch(E.OPEN_APP_SWITCHER).to, S.APP_SWITCHER);
assert.equal(machine.dispatch(E.GO_HOME).to, S.HOME);
assert.equal(machine.dispatch(E.LOCK).to, S.LOCKED);
assert.equal(machine.dispatch(E.OPEN_OVERLAY, { type: "notifications" }).to, S.OVERLAY_OPEN);
assert.equal(machine.dispatch(E.CLOSE_OVERLAY).to, S.LOCKED);
const homeSwitcherMachine = new global.MercurySystemStateMachine(S.HOME);
assert.equal(homeSwitcherMachine.dispatch(E.OPEN_APP_SWITCHER).to, S.APP_SWITCHER);
assert.equal(homeSwitcherMachine.dispatch(E.GO_HOME).to, S.HOME);
// From APP_OPEN, launching a different app stays in the foreground (Me rows: Archive / AI Connection).
const appOpenMachine = new global.MercurySystemStateMachine(S.APP_OPEN);
assert.equal(appOpenMachine.dispatch(E.OPEN_APP).accepted, true);
assert.equal(appOpenMachine.dispatch(E.OPEN_APP).to, S.APP_OPEN);
assert.equal(observed.length, 13);
assert.equal(machine.snapshot().history.length, 14);
assert.ok(Object.isFrozen(machine.snapshot()));
assert.ok(Object.isFrozen(machine.snapshot().history));
const shellCss = fs.readFileSync(path.join(__dirname, "../styles/system-shell.css"), "utf8");
const switcherCss = fs.readFileSync(path.join(__dirname, "../styles/app-switcher.css"), "utf8");
assert.match(shellCss, /data-system-state="appOpen"\] \.system-surface/);
assert.match(shellCss, /data-system-state="appSwitcher"\] \.system-surface/);
assert.match(shellCss, /\.app-layer \{[^}]*inset: var\(--safe-top\) 0 0;/s);
assert.match(shellCss, /\.app-instance \{[^}]*user-select: none;/s);
assert.match(switcherCss, /--task-card-width: 68%/);
assert.match(switcherCss, /grid-auto-columns: var\(--task-card-width\)/);
assert.match(switcherCss, /\.app-snapshot__canvas \{[^}]*left: 50%;[^}]*transform-origin: top center;/s);
assert.match(switcherCss, /--task-rail-icon-size:/);

console.log("state-machine: 27 assertions passed");
