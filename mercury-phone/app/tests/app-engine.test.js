"use strict";

const assert = require("node:assert/strict");
global.window = global;
require("../locales/en-US.js");
require("../locales/zh-CN.js");
require("../core/i18n.js");
require("../core/contracts.js");
require("../core/app-engine.js");

class FakeElement {
  constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.hidden = false; this.textContent = ""; this.className = ""; this.removed = false; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  remove() { this.removed = true; }
}

const host = new FakeElement("host");
const i18n = new global.MercuryI18n({ locale: "en-US" });
const log = [];
const resumeCalls = [];
const createApp = (name) => ({
  render(root, context) { root.textContent = name; context.state.rendered = true; log.push(`${name}:render`); },
  onMount() { log.push(`${name}:mount`); },
  onPause() { log.push(`${name}:pause`); },
  onResume(context, payload) { resumeCalls.push({ name, context, payload }); log.push(`${name}:resume`); },
  onUnmount() { log.push(`${name}:unmount`); },
});

const engine = new global.MercuryAppEngine({ host, i18n, createElement: (tag) => new FakeElement(tag) });
engine.register({ id: "photos", nameKey: "apps.photos", version: 1, create: () => createApp("photos"), widgets: [] });
engine.register({ id: "settings", name: "Settings", render(root) { root.textContent = "settings"; } });
assert.throws(() => engine.register({ id: "photos", name: "Duplicate", render() {} }), /already registered/);
assert.equal(engine.list().length, 2);
assert.equal(engine.listInstances().length, 0);

const photos = engine.launch("photos");
assert.equal(engine.listInstances().length, 1);
assert.equal(host.hidden, false);
assert.equal(photos.status, "active");
assert.equal(photos.context.state.rendered, true);
assert.ok(photos.context.widgets);
const settings = engine.launch("settings");
assert.equal(photos.status, "paused");
assert.equal(settings.status, "active");
assert.notEqual(photos.root, settings.root);
const resumePayload = Object.freeze({ route: "album:favorites" });
engine.launch("photos", resumePayload);
assert.equal(settings.status, "paused");
assert.equal(photos.status, "active");
assert.equal(resumeCalls.length, 1);
assert.equal(resumeCalls[0].context, photos.context, "resume receives the same immutable app context used during render");
assert.equal(resumeCalls[0].payload, resumePayload, "resume receives the launch payload as its second argument");
assert.equal(engine.unmount("photos"), true);
assert.equal(photos.root.removed, true);
assert.equal(host.hidden, true);
assert.deepEqual(log, ["photos:render", "photos:mount", "photos:pause", "photos:resume", "photos:unmount"]);

engine.register({ id: "broken", name: "Broken", create: () => ({ render() { throw new Error("boom"); } }) });
const broken = engine.launch("broken");
assert.equal(broken.status, "error");
assert.equal(broken.error.phase, "render");
assert.equal(broken.error.message, "boom");
assert.equal(engine.launch("settings").status, "active");
assert.equal(engine.unregister("broken"), true);

i18n.setLocale("zh-CN");
assert.equal(i18n.t("lock.notification.rain"), "雨会慢慢停下来");
assert.equal(i18n.t("missing.key"), "missing.key");

console.log("app-engine: lifecycle assertions passed");
