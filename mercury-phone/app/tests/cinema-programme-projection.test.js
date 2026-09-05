"use strict";

const assert = require("node:assert/strict");
const { buildCinemaProgrammeProjection } = require("../core/cinema-programme-projection.js");

function instance(overrides = {}) {
  return {
    id: "instance-a",
    status: "active",
    title: "静默子午线",
    programmeSubtitle: "第二幕",
    stageId: "world-harbor",
    stageSnapshot: { id: "world-harbor", title: "雾港", shortTitle: "雾港" },
    characterSnapshot: { id: "character-lin", displayName: "林疏白" },
    variant: { sharedHistory: "我们在离港前重新遇见，仍没有说出那封信的事。" },
    scenes: [{ id: "scene-2", actNumber: 2, sceneNumber: 4, title: "北方长廊" }],
    currentSceneId: "scene-2",
    pendingContinuation: null,
    structureProvenance: { scenes: "runtime" },
    updatedAt: "2026-09-03T12:00:00.000Z",
    endedAt: "",
    ...overrides,
  };
}

const active = instance();
const intermission = instance({ id: "instance-b", status: "intermission", title: "最后一班渡船", updatedAt: "2026-09-03T13:00:00.000Z" });
const past = instance({ id: "instance-past", status: "ended", title: "潮汐抵达以前", endedAt: "2026-09-02T13:00:00.000Z" });
const otherCharacter = instance({ id: "instance-other", characterSnapshot: { id: "character-ye", displayName: "叶知栖" } });
const legacy = instance({ id: "instance-legacy", characterSnapshot: { id: "", displayName: "旧角色" }, stageSnapshot: { id: "", title: "旧世界" }, stageId: "" });

const projection = buildCinemaProgrammeProjection({
  focusedInstanceId: active.id,
  instances: [active, intermission, past, otherCharacter, legacy],
}, intermission.id);

assert.equal(projection.groups.length, 3, "stable Character x Stage identity groups matching snapshots");
assert.equal(projection.selectedGroup.characterName, "林疏白");
assert.equal(projection.selectedGroup.worldTitle, "雾港");
assert.equal(projection.selectedGroup.selected.id, intermission.id, "the requested Instance anchors the group view");
assert.deepEqual(projection.selectedGroup.unfinished.map((item) => item.id), [intermission.id, active.id]);
assert.deepEqual(projection.selectedGroup.past.map((item) => item.id), [past.id]);
assert.equal(projection.selectedGroup.selected.position, "第二幕 · 北方长廊");
assert.equal(projection.selectedGroup.selected.actionLabel, "从中场继续");
assert.equal(projection.selectedGroup.sharedHistory, active.variant.sharedHistory, "only explicit sharedHistory is projected as relationship copy");
assert.ok(projection.groups.some((group) => group.key === `legacy:${legacy.id}`), "records missing stable identity stay isolated instead of being falsely merged");
assert.equal(projection.primary.id, active.id, "the focused unfinished Instance leads the Programme index even when another Instance is newer");
assert.deepEqual(projection.unfinished.map((item) => item.id), [intermission.id, active.id, legacy.id, otherCharacter.id], "all unfinished Instances remain individually reachable in recency order with a stable id tie-break");
assert.deepEqual(projection.past.map((item) => item.id), [past.id], "past Instances remain available as a global index");
assert.equal(projection.unfinished.find((item) => item.id === otherCharacter.id).characterName, "叶知栖", "index entries carry their stable Character identity as derived presentation data");
assert.equal(projection.unfinished.find((item) => item.id === otherCharacter.id).worldTitle, "雾港", "index entries carry their stable World identity as derived presentation data");

const latestFallback = buildCinemaProgrammeProjection({ focusedInstanceId: "missing", instances: [active, intermission] });
assert.equal(latestFallback.primary.id, intermission.id, "the most recently updated unfinished Instance is primary when focus is unavailable");

const noInventedSummary = buildCinemaProgrammeProjection({ instances: [instance({ variant: {} })] }, active.id).selectedGroup;
assert.equal(noInventedSummary.sharedHistory, "", "presentation never fabricates canonical relationship copy");

const pending = buildCinemaProgrammeProjection({ instances: [instance({ pendingContinuation: { requestId: "r", userSegmentId: "u" } })] }, active.id).selectedGroup.selected;
assert.equal(pending.actionLabel, "处理待续写");

const compatibility = buildCinemaProgrammeProjection({ instances: [instance({
  status: "intermission",
  structureProvenance: { scenes: "compatibility-unknown" },
})] }, active.id).selectedGroup.selected;
assert.equal(compatibility.position, "演出暂时停在这里", "compatibility Scene arrays never become canonical Programme position facts");
assert.equal(compatibility.position.includes("幕"), false);

console.log("cinema-programme-projection: stable grouping, reachability, and grounded-copy assertions passed");
