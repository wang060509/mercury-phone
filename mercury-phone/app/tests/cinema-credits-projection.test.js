"use strict";

const assert = require("node:assert/strict");
const creditsProjection = require("../core/cinema-credits-projection.js");

function instance(overrides = {}) {
  return {
    id: "credits-performance",
    status: "ended",
    title: "北方长廊",
    structureProvenance: { scenes: "runtime" },
    stageSnapshot: { title: "雨夜长廊" },
    characterSnapshot: { displayName: "林雾岚", relationshipSummary: "must not render" },
    player: { name: "岑遥" },
    scenes: [
      { id: "scene-1", actNumber: 1, sceneNumber: 1 },
      { id: "scene-2", actNumber: 1, sceneNumber: 2 },
      { id: "scene-3", actNumber: 2, sceneNumber: 1 },
    ],
    segments: [
      { role: "assistant", text: "雨落长廊。" },
      { role: "user", text: "我把信递给她。" },
    ],
    createdAt: "2026-09-04T10:00:00.000Z",
    endedAt: "2026-09-05T11:00:00.000Z",
    closureRecord: { version: 1, initiatedAt: "2026-09-05T10:59:00.000Z", pendingDisposition: null },
    ...overrides,
  };
}

const reliable = creditsProjection.buildCinemaCreditsProjection(instance());
assert.equal(reliable.title, "北方长廊");
assert.deepEqual(reliable.structure, { acts: 2, scenes: 3 });
assert.equal(reliable.metadata.find((entry) => entry.key === "structure").value, "2 幕 · 3 场");
assert.equal(reliable.metadata.find((entry) => entry.key === "player").value, "岑遥");
assert.equal(reliable.metadata.find((entry) => entry.key === "opened").value, "2026.09.04");
assert.equal(reliable.metadata.find((entry) => entry.key === "ended").value, "2026.09.05");
assert.equal(reliable.historyAvailable, true, "Credits exposes the completed truthful History destination");
assert.equal(JSON.stringify(reliable).includes("relationship"), false);
assert.equal(JSON.stringify(reliable).includes("minutes"), false);

for (const provenance of [undefined, null, { scenes: "compatibility-unknown" }, { scenes: "future" }]) {
  const fallback = creditsProjection.buildCinemaCreditsProjection(instance({ structureProvenance: provenance }));
  assert.equal(fallback.structure, null);
  assert.equal(fallback.metadata.some((entry) => entry.key === "structure"), false, "unreliable structure exposes no Act or Scene counts");
}

const defaultPlayer = creditsProjection.buildCinemaCreditsProjection(instance({ player: { name: "你" } }));
assert.equal(defaultPlayer.metadata.some((entry) => entry.key === "player"), false, "default player fallback is not presented as verified identity");
assert.equal(creditsProjection.buildCinemaCreditsProjection(instance({ status: "ending", endedAt: "" })), null, "Credits cannot project before durable ended state");

console.log("cinema-credits-projection: verified Credits metadata and structural-truth assertions passed");
