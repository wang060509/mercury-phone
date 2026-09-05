"use strict";

const assert = require("node:assert/strict");
const { buildCinemaProgrammeArchiveProjection } = require("../core/cinema-programme-archive-projection.js");

function instance(overrides = {}) {
  const id = overrides.id || "performance-a";
  const sceneId = `${id}-scene`;
  return {
    id,
    status: "ended",
    title: "静默子午线",
    characterSnapshot: { id: "character-lin", displayName: "林疏白" },
    stageId: "world-harbor",
    stageSnapshot: { id: "world-harbor", title: "雾港", shortTitle: "雾港" },
    scenarioSnapshot: { id: "scenario-letter", title: "雨中的来信" },
    structureProvenance: { scenes: "runtime" },
    scenes: [{ id: sceneId, actNumber: 1, sceneNumber: 1, title: "雨中的来信" }],
    segments: [{ id: `${id}-segment`, sceneId, role: "assistant", text: "雨落在长廊尽头。" }],
    endedAt: "2026-09-04T12:00:00.000Z",
    updatedAt: "2026-09-04T12:00:00.000Z",
    ...overrides,
  };
}

const empty = buildCinemaProgrammeArchiveProjection({ instances: [] });
assert.equal(empty.empty, true);
assert.equal(empty.count, 0);
assert.deepEqual(empty.groups, []);

const newest = instance({ id: "harbor-newest", title: "潮汐回返", endedAt: "2026-09-04T12:00:00.000Z" });
const older = instance({ id: "harbor-older", title: "静默子午线", endedAt: "2026-08-02T12:00:00.000Z" });
const otherGroup = instance({
  id: "nightless",
  title: "无昼之后",
  characterSnapshot: { id: "character-ye", displayName: "叶知栖" },
  stageId: "world-nightless",
  stageSnapshot: { id: "world-nightless", title: "无昼城", shortTitle: "无昼城" },
  endedAt: "2026-09-03T12:00:00.000Z",
});
const active = instance({ id: "still-active", status: "active", endedAt: "" });
const grouped = buildCinemaProgrammeArchiveProjection({ instances: [older, active, otherGroup, newest] });
assert.equal(grouped.empty, false);
assert.equal(grouped.count, 3);
assert.equal(grouped.groups.length, 2, "ended Performances group by stable Character x World identity only");
assert.deepEqual(grouped.groups[0].performances.map((entry) => entry.id), [newest.id, older.id], "group order follows endedAt descending");
assert.deepEqual(grouped.groups.map((group) => group.number), ["01", "02"]);
assert.deepEqual(grouped.groups[0].performances.map((entry) => entry.number), ["01.01", "01.02"]);
assert.equal(grouped.groups[0].performances[0].endingDate, "2026.09.04");
assert.equal(grouped.groups[0].performances[0].metadataLine, "开场：雨中的来信 · 1 幕 1 场");
assert.ok(grouped.groups.every((group) => group.anchor.startsWith("programme-archive-")));

const compatibility = instance({
  id: "compatibility-ended",
  structureProvenance: { scenes: "compatibility-unknown" },
  scenarioSnapshot: {},
});
const compatibilityEntry = buildCinemaProgrammeArchiveProjection({ instances: [compatibility] }).groups[0].performances[0];
assert.equal(compatibilityEntry.structureLabel, "", "compatibility Scene arrays never become canonical archive metadata");
assert.equal(compatibilityEntry.openingLabel, "", "missing optional Scenario metadata stays absent");
assert.equal(compatibilityEntry.metadataLine, "", "the index does not invent filler metadata");

const longCharacter = "沈知昼与保存了十二封未寄出书信的同行者";
const longWorld = "无昼城北侧永不熄灭的第三座天文观测站";
const longTitle = "潮汐退去以前，那封仍未寄出的第三封信与最后一班列车";
const long = instance({
  id: "long-identity",
  title: longTitle,
  characterSnapshot: { id: "character-long", displayName: longCharacter },
  stageId: "world-long",
  stageSnapshot: { id: "world-long", title: longWorld, shortTitle: "" },
});
const longProjection = buildCinemaProgrammeArchiveProjection({ instances: [long] });
assert.equal(longProjection.groups[0].characterName, longCharacter);
assert.equal(longProjection.groups[0].worldTitle, longWorld);
assert.equal(longProjection.groups[0].performances[0].title, longTitle);

const legacyA = instance({ id: "legacy-a", characterSnapshot: { id: "", displayName: "" }, stageId: "", stageSnapshot: { id: "", title: "" } });
const legacyB = instance({ id: "legacy-b", characterSnapshot: { id: "", displayName: "" }, stageId: "", stageSnapshot: { id: "", title: "" } });
const legacyProjection = buildCinemaProgrammeArchiveProjection({ instances: [legacyA, legacyB] });
assert.equal(legacyProjection.groups.length, 2, "records missing stable identity remain isolated instead of being falsely merged");
assert.ok(legacyProjection.groups.every((group) => group.characterName === "未命名角色" && group.worldTitle === "已归档世界"));

const largeInstances = Array.from({ length: 240 }, (_, index) => instance({
  id: `large-${index}`,
  title: `完整往期演出 ${index + 1}`,
  characterSnapshot: { id: `character-${index % 12}`, displayName: `角色 ${index % 12}` },
  stageId: `world-${index % 6}`,
  stageSnapshot: { id: `world-${index % 6}`, title: `世界 ${index % 6}`, shortTitle: `世界 ${index % 6}` },
  endedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
}));
const large = buildCinemaProgrammeArchiveProjection({ instances: largeInstances });
assert.equal(large.count, 240);
assert.equal(large.groups.length, 12);
assert.equal(large.groups.reduce((total, group) => total + group.performances.length, 0), 240, "large archives keep every ended Performance present");
assert.equal(Object.isFrozen(large), true);
assert.equal(Object.isFrozen(large.groups), true);
assert.equal(Object.isFrozen(large.groups[0].performances), true);

console.log("cinema-programme-archive-projection: grouping, truth, fallback, and large archive assertions passed");
