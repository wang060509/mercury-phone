"use strict";

const assert = require("node:assert/strict");
const historyProjection = require("../core/cinema-history-projection.js");

function instance(overrides = {}) {
  return {
    id: "history-performance",
    status: "ended",
    title: "北方长廊",
    structureProvenance: { scenes: "runtime" },
    stageSnapshot: { title: "雨夜长廊" },
    characterSnapshot: { displayName: "林雾岚", relationshipSummary: "must not render" },
    player: { name: "岑遥" },
    scenes: [
      { id: "scene-arrival", actNumber: 1, sceneNumber: 1, title: "雨中的来信" },
      { id: "scene-platform", actNumber: 1, sceneNumber: 2, title: "末班站台" },
    ],
    segments: [
      { id: "opening", sceneId: "scene-arrival", role: "assistant", text: "雨沿着长廊尽头的玻璃缓慢落下。" },
      { id: "reply", sceneId: "scene-arrival", role: "user", text: "我把信放在门槛外。" },
      { id: "platform", sceneId: "scene-platform", role: "assistant", text: "站台只剩最后一盏灯。" },
    ],
    createdAt: "2026-09-04T10:00:00.000Z",
    endedAt: "2026-09-05T11:00:00.000Z",
    closureRecord: { version: 1, initiatedAt: "2026-09-05T10:59:00.000Z", pendingDisposition: null },
    ...overrides,
  };
}

const reliable = historyProjection.buildCinemaHistoryProjection(instance());
assert.equal(reliable.title, "北方长廊");
assert.equal(reliable.identityLine, "林雾岚 × 雨夜长廊");
assert.equal(reliable.dateRange, "2026.09.04  /  2026.09.05");
assert.equal(reliable.structureProvenance, "runtime");
assert.equal(reliable.contents.length, 2);
assert.equal(reliable.contents[0].label, "第 1 幕 · 第 1 场");
assert.equal(reliable.sections[1].title, "末班站台");
assert.deepEqual(reliable.sections.flatMap((section) => section.segments).map((segment) => segment.text), instance().segments.map((segment) => segment.text));
assert.equal(reliable.colophon.find((entry) => entry.key === "structure").value, "1 幕 · 2 场");
assert.equal(JSON.stringify(reliable).includes("relationship"), false);
assert.equal(JSON.stringify(reliable).includes("minutes"), false);

for (const provenance of [undefined, null, { scenes: "compatibility-unknown" }, { scenes: "future" }]) {
  const fallback = historyProjection.buildCinemaHistoryProjection(instance({ structureProvenance: provenance }));
  assert.equal(fallback.structureProvenance, "compatibility-unknown");
  assert.equal(fallback.contents.length, 1);
  assert.equal(fallback.contents[0].label, "正文");
  assert.equal(fallback.contents[0].title, "完整演出");
  assert.equal(fallback.sections[0].structuralLabel, "");
  assert.equal(fallback.sections[0].segments.length, 3, "compatibility fallback retains the complete chronological work");
  assert.equal(fallback.colophon.some((entry) => entry.key === "structure"), false);
}

const abandoned = historyProjection.buildCinemaHistoryProjection(instance({
  closureRecord: {
    version: 1,
    initiatedAt: "2026-09-05T10:59:00.000Z",
    pendingDisposition: {
      kind: "abandoned-by-user",
      requestId: "request-reply",
      userSegmentId: "reply",
      startedAt: "2026-09-05T10:58:00.000Z",
      settledAt: "2026-09-05T10:59:00.000Z",
    },
  },
}));
const abandonedSegments = abandoned.sections.flatMap((section) => section.segments);
assert.equal(abandoned.hasAbandonedPending, true);
assert.equal(abandonedSegments.find((segment) => segment.id === "reply").abandonedPending, true);
assert.equal(abandonedSegments.filter((segment) => segment.abandonedPending).length, 1);
assert.equal(abandonedSegments.length, 3, "pending abandonment never deletes the user-authored Segment");

const longSegments = Array.from({ length: 320 }, (_, index) => ({
  id: `segment-${index}`,
  sceneId: "scene-arrival",
  role: index % 3 === 1 ? "user" : "assistant",
  text: `完整正文段落 ${index + 1}。`,
}));
const longWork = historyProjection.buildCinemaHistoryProjection(instance({ scenes: [{ id: "scene-arrival", actNumber: 1, sceneNumber: 1, title: "长夜" }], segments: longSegments }));
assert.equal(longWork.sections[0].segments.length, 320, "arbitrarily long works are projected without truncation or load-more windows");
assert.equal(longWork.wordCount, longSegments.reduce((sum, segment) => sum + segment.text.replace(/\s+/g, "").length, 0));

assert.equal(historyProjection.buildCinemaHistoryProjection(instance({ status: "ending", endedAt: "" })), null, "History cannot project before durable ended state");

console.log("cinema-history-projection: complete archive, structural truth, and abandoned-pending provenance verified");
