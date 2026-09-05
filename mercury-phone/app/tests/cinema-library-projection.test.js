"use strict";

const assert = require("node:assert/strict");
const { createStageCatalog } = require("../core/cinema-stage-catalog.js");
const projection = require("../core/cinema-library-projection.js");

function stage(index) {
  return {
    id: `world-${index}`,
    order: index,
    title: `世界 ${index}`,
    shortTitle: `世界${index}`,
    latinTitle: `WORLD ${index}`,
    scenarios: [{ id: `scenario-${index}`, title: `Scenario ${index}` }],
  };
}

[1, 3, 8].forEach((count) => {
  const catalog = createStageCatalog(Array.from({ length: count }, (_, index) => stage(index + 1)));
  const first = projection.buildWorldLibraryProjection(catalog, 0);
  assert.equal(first.total, count);
  assert.equal(first.selected.id, "world-1");
  assert.equal(first.visible.length, Math.min(3, count));
  assert.equal(first.visible.filter((world) => world.selected).length, 1);
  if (count === 1) assert.deepEqual(first.visible.map((world) => world.side), ["current"], "one World has no decorative neighbors");
  if (count === 8) {
    const middle = projection.buildWorldLibraryProjection(catalog, 4);
    assert.deepEqual(middle.visible.map((world) => world.id), ["world-4", "world-5", "world-6"]);
    assert.equal(middle.indexLabel, "05 / 08");
  }
});

const boundedTeaser = projection.summarizeWorldTeaser({ summary: "这是一个很长的世界资料段落。".repeat(20) });
assert.ok(boundedTeaser.length <= 64, "World Library teaser copy is presentation-bounded");
assert.equal(boundedTeaser.endsWith("…"), true);

const stableA = projection.placeholderPathFor("character-lin");
const stableB = projection.placeholderPathFor("character-lin");
assert.equal(stableA, stableB, "neutral placeholder assignment is stable");
assert.match(stableA, /^assets\/cinema\/cast-neutral-0[1-6]\.webp$/);

const userVisual = projection.resolveCinemaCharacterVisual({ id: "user-image", displayName: "林", avatarAssetId: "data:image/webp;base64,AAAA" });
assert.equal(userVisual.kind, "user");
assert.equal(userVisual.src, "data:image/webp;base64,AAAA");
assert.match(userVisual.neutralFallbackSrc, /cast-neutral-/);

const defaultArchiveVisual = projection.resolveCinemaCharacterVisual({ id: "default-image", displayName: "叶", avatarAssetId: "archive:wind-chimes-v1" });
assert.equal(defaultArchiveVisual.kind, "mercury-neutral", "Archive defaults remain presentation placeholders, not user portraits");
assert.equal(defaultArchiveVisual.textFallback, "叶");

assert.equal(
  projection.summarizeCharacterDescription({ identity: "摄政王", summary: "A much longer source summary." }),
  "摄政王",
  "Cast prioritizes the concise canonical identity over imported source prose",
);
const boundedDescription = projection.summarizeCharacterDescription({ summary: `<info>\n\`\`\`yaml\n${"角色设定 ".repeat(40)}\n\`\`\`` });
assert.equal(boundedDescription.includes("<info>"), false, "presentation excerpts remove import container markers");
assert.ok(boundedDescription.length <= 96, "long imported prose has a deterministic accessible-name bound");
assert.equal(boundedDescription.endsWith("…"), true);

const cast = projection.buildCinemaCastProjection({ runtimeProfiles: [
  { id: "character-lin", displayName: "林疏白", summary: "Existing source summary." },
  { id: "character-ye", displayName: "叶知栖", identity: "Existing source identity." },
] }, { instances: [
  { id: "performance-1", characterSnapshot: { id: "character-lin" }, stageSnapshot: { id: "world-1" }, updatedAt: "2026-09-01T10:00:00.000Z" },
  { id: "performance-2", characterSnapshot: { id: "character-lin" }, stageSnapshot: { id: "world-2" }, updatedAt: "2026-09-02T10:00:00.000Z" },
  { id: "performance-other", characterSnapshot: { id: "character-other" }, stageSnapshot: { id: "world-3" }, updatedAt: "2026-09-03T10:00:00.000Z" },
] });
assert.equal(cast.total, 2);
assert.equal(cast.entries[0].performanceCount, 2);
assert.equal(cast.entries[0].worldCount, 2);
assert.equal(cast.entries[0].latestInstanceId, "performance-2");
assert.equal(cast.entries[1].performanceCount, 0);
assert.equal(cast.entries[1].description, "Existing source identity.");

const horizontal = projection.createDirectionalGestureArbiter();
horizontal.start(100, 100);
assert.equal(horizontal.move(91, 97).intent, "pending", "tiny movement does not steal a tap or vertical scroll");
assert.equal(horizontal.move(62, 96).intent, "horizontal");
assert.deepEqual(horizontal.end(48, 95), { active: true, intent: "horizontal", deltaX: -52, deltaY: -5, commit: true, direction: "next", activate: false });

const vertical = projection.createDirectionalGestureArbiter();
vertical.start(100, 100);
assert.equal(vertical.move(96, 132).intent, "vertical");
assert.equal(vertical.end(94, 160).commit, false, "vertical reading never changes World");

const cancelled = projection.createDirectionalGestureArbiter();
cancelled.start(100, 100);
cancelled.move(50, 100);
assert.equal(cancelled.cancel().commit, false, "pointercancel resets without navigation");

console.log("cinema-library-projection: World scaling, Cast derivation, visual fallback, and gesture assertions passed");
