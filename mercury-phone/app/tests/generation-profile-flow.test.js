const assert = require("node:assert/strict");

global.window = global;
require("../core/preset-content.js");
require("../core/generation-profile-contracts.js");
const GenerationProfileStore = require("../system/generation-profile-store.js");
const { MercuryGenerationProfileFlow, VIEWS, OVERLAYS, EVENTS } = require("../use-cases/generation-profile-flow.js");

function memoryStorage() {
  const values = new Map();
  return {
    failWrites: false,
    get(key, fallback) { return values.has(key) ? values.get(key) : fallback; },
    set(key, value) {
      if (this.failWrites) throw new Error("Storage unavailable");
      values.set(key, JSON.parse(JSON.stringify(value)));
    },
    remove(key) { values.delete(key); },
  };
}

const storage = memoryStorage();
const store = new GenerationProfileStore({ storage, now: 100 });
store.add({
  id: "profile-rain",
  name: "Rain Study",
  origin: "user",
  cover: { kind: "asset", value: "archive:water-starlight-v1" },
  modules: { order: [], enabled: {} },
  createdAt: 101,
  updatedAt: 101,
});

const flow = new MercuryGenerationProfileFlow({ store });
assert.equal(flow.snapshot().view, VIEWS.CABINET);
assert.equal(flow.snapshot().selectedProfileId, null);
assert.equal(Object.isFrozen(flow.snapshot()), true, "UI receives an immutable flow snapshot");

const transitions = [];
const unsubscribe = flow.subscribe((snapshot, event) => transitions.push([snapshot.view, event.type]));
let snapshot = flow.openDetail("profile-rain");
assert.equal(snapshot.view, VIEWS.DETAIL);
assert.equal(snapshot.selectedProfile.name, "Rain Study");
assert.deepEqual(transitions[0], [VIEWS.DETAIL, EVENTS.OPEN_DETAIL]);

snapshot = flow.back();
assert.equal(snapshot.view, VIEWS.CABINET);
assert.equal(snapshot.selectedProfileId, null);

assert.throws(
  () => flow.openDetail("profile-missing"),
  (error) => error.code === "GENERATION_PROFILE_FLOW_PROFILE_NOT_FOUND",
  "missing Profiles cannot create an invalid detail route",
);
assert.equal(flow.snapshot().view, VIEWS.CABINET, "failed transitions preserve the last valid state");

snapshot = flow.openActions("preset-default");
assert.equal(snapshot.overlay, OVERLAYS.ACTIONS);
assert.equal(snapshot.overlayProfile.readOnly, true);
assert.throws(
  () => flow.previewCover("preset-default", "data:image/png;base64,AA=="),
  (error) => error.code === "GENERATION_PROFILE_FLOW_READ_ONLY",
  "built-in Profiles stay read-only inside the workflow",
);
assert.equal(flow.snapshot().overlay, OVERLAYS.ACTIONS, "a rejected cover action does not discard the existing action sheet");

snapshot = flow.previewCover("profile-rain", "data:image/png;base64,AA==");
assert.equal(snapshot.overlay, OVERLAYS.COVER_PREVIEW);
assert.equal(snapshot.coverDraft.profileId, "profile-rain");
assert.equal(store.get("profile-rain").cover.kind, "asset", "preview does not persist before confirmation");

snapshot = flow.cancelCover();
assert.equal(snapshot.overlay, null);
assert.equal(snapshot.coverDraft, null);
assert.equal(store.get("profile-rain").cover.kind, "asset");

flow.previewCover("profile-rain", "data:image/webp;base64,BB==");
storage.failWrites = true;
assert.throws(
  () => flow.saveCover(),
  (error) => error.code === "GENERATION_PROFILE_STORAGE_WRITE_FAILED",
  "store failures cross the seam with the established storage error code",
);
assert.equal(flow.snapshot().overlay, OVERLAYS.COVER_PREVIEW, "failed saves keep the recoverable preview open");
assert.equal(flow.snapshot().coverDraft.dataUrl, "data:image/webp;base64,BB==", "failed saves preserve the user's draft");
assert.equal(store.get("profile-rain").cover.kind, "asset", "failed saves do not mutate the in-memory store");

storage.failWrites = false;
snapshot = flow.saveCover();
assert.equal(snapshot.overlay, null);
assert.equal(store.get("profile-rain").cover.value, "data:image/webp;base64,BB==");

snapshot = flow.updateCover("profile-rain", global.MercuryGenerationProfileContracts.DEFAULT_COVER);
assert.equal(snapshot.coverDraft, null);
assert.equal(store.get("profile-rain").cover.value, "archive:glass-water-v1");

flow.openDetail("profile-rain");
store.remove("profile-rain");
snapshot = flow.reload();
assert.equal(snapshot.view, VIEWS.CABINET, "reload repairs a detail route whose Profile was removed elsewhere");
assert.equal(snapshot.selectedProfileId, null);

assert.throws(
  () => flow.dispatch({ type: "OPEN_PRESSING_ROOM" }),
  (error) => error.code === "GENERATION_PROFILE_FLOW_UNKNOWN_EVENT",
  "future screens cannot enter the workflow before their checkpoint",
);

unsubscribe();
console.log("generation-profile-flow: assertions passed");
