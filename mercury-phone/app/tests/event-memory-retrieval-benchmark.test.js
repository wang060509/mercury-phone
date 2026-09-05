"use strict";

const assert = require("node:assert/strict");
const memory = require("../core/vector-memory-contracts.js");

const scope = { contactId: "zhao", worldVariantId: "palace", timelineId: "default" };
const date = "2026-08-13T00:00:00.000Z";
const event = (id, content, eventType = "shared-event", extra = {}) => memory.normalizeEntry({
  id, scope, eventType, content, retention: "durable", state: "active", importance: 3,
  confidence: "explicit", occurredAt: date, createdAt: date, updatedAt: date,
  source: { type: "relationship-record", id }, evidenceTurnIds: ["turn-a"], ...extra,
});

// A fixed, human-curated baseline. It checks retrieval behavior, not model prose quality.
const events = [
  event("return-capital", "赵琪会在秋猎后返回京城。"),
  event("winter-library", "你们约好初雪那天在藏书阁见面。", "commitment"),
  event("plum-tea", "赵琪喜欢梅子茶，不喝太甜的。", "preference"),
  event("border-report", "北境粮草不足的奏报仍未解决。", "open-thread"),
  event("lost-seal", "玉印暂时下落不明，赵琪正在暗中寻找。", "open-thread"),
  event("river-promise", "赵琪答应在河灯节陪你放一盏灯。", "commitment"),
  event("rain-current", "赵琪如今喜欢雨天，因为雨声能让他安静下来。", "preference"),
  event("horse-injury", "秋猎时赵琪的黑马伤了前蹄，需要休养。"),
  event("west-gate", "你们约定从西门离开皇城，避开宫人耳目。", "commitment"),
  event("medicine", "赵琪的旧伤在阴雨天会发痛。"),
  event("jasmine", "你送给赵琪一枚茉莉香囊，他收下了。"),
  event("portrait", "赵琪不愿让宫廷画师公开你的画像。", "relationship-shift"),
  event("night-watch", "今夜由禁军第三营负责宫门夜巡。"),
  event("chess", "你们上次对弈时赵琪输了一局，约好下次再战。", "open-thread"),
  event("letter", "赵琪写了一封未寄出的家书。", "open-thread"),
  event("flower-market", "春日会一起去城南花市。", "commitment"),
  event("court-debate", "朝会上关于盐税的争论尚未结束。", "open-thread"),
  event("lantern", "河灯节的灯要写下心愿再放入水中。"),
  event("dog", "赵琪幼时养过一只叫墨点的黑犬。"),
  event("music", "赵琪不擅长琴，但会吹一段短笛。", "preference"),
  event("old-rain", "赵琪小时候讨厌下雨。", "preference", { state: "superseded", supersededBy: "rain-current" }),
  event("expired-lesson", "你明天早上八点有礼法课。", "note", { expiresAt: "2026-08-02T00:00:00.000Z" }),
  event("alternate-return", "在另一条时间线里赵琪已经离开京城。", "shared-event", { scope: { ...scope, timelineId: "alternate" } }),
  event("other-world", "在海港世界里赵琪经营一家书店。", "shared-event", { scope: { ...scope, worldVariantId: "harbor" } }),
  event("archived-secret", "一封已经封存的密信。", "note", { state: "archived" }),
  event("festival-clothes", "河灯节那晚赵琪穿深青色常服。"),
  event("garden", "你们在御花园的石桥上谈过旧事。"),
  event("bird", "赵琪救过一只受伤的白鸽。"),
  event("map", "西北驿道的旧地图藏在书房暗格。", "open-thread"),
  event("moon", "赵琪答应在中秋陪你看月亮。", "commitment"),
].filter(Boolean);

const cases = [
  { query: "秋猎后还回京吗", expected: ["return-capital"] },
  { query: "初雪去哪里见面", expected: ["winter-library"], mode: "semantic" },
  { query: "他喜欢喝什么茶", expected: ["plum-tea"], mode: "semantic" },
  { query: "北境粮草的事有进展吗", expected: ["border-report"] },
  { query: "玉印找到了吗", expected: ["lost-seal"], mode: "semantic" },
  { query: "河灯节的约定还算数吗", expected: ["river-promise"], allowed: ["river-promise", "lantern", "festival-clothes"] },
  { query: "他现在喜欢雨天吗", expected: ["rain-current"], excluded: ["old-rain"] },
  { query: "秋猎的马伤得怎么样", expected: ["horse-injury"], mode: "semantic" },
  { query: "从哪个门离开皇城", expected: ["west-gate"] },
  { query: "阴雨天他的旧伤", expected: ["medicine"] },
  { query: "我送的茉莉香囊", expected: ["jasmine"] },
  { query: "下次还要下棋吗", expected: ["chess"], mode: "semantic" },
  { query: "未寄出的家书", expected: ["letter"] },
  { query: "盐税争论", expected: ["court-debate"] },
  { query: "中秋看月亮", expected: ["moon"] },
  { query: "今天天气真好", expected: [] },
  { query: "晚饭吃什么", expected: [] },
  { query: "礼法课几点开始", expected: [], excluded: ["expired-lesson"] },
  { query: "另一条时间线他在哪里", expected: [], excluded: ["alternate-return"] },
  { query: "海港世界的书店", expected: [], excluded: ["other-world"] },
];

let relevantReturned = 0;
let totalRelevant = 0;
let returned = 0;
let irrelevant = 0;
let semanticTargetQueries = 0;
for (const sample of cases) {
  const results = memory.rankEntries(events, { scope, query: sample.query, now: Date.parse("2026-08-13T12:00:00.000Z") });
  const ids = results.map((item) => item.id);
  const expected = new Set(sample.mode === "semantic" ? [] : sample.expected);
  const allowed = new Set(sample.allowed || sample.expected);
  if (sample.mode === "semantic") semanticTargetQueries += 1;
  const hitCount = ids.filter((id) => expected.has(id)).length;
  relevantReturned += hitCount;
  totalRelevant += expected.size;
  returned += ids.length;
  irrelevant += ids.filter((id) => !allowed.has(id)).length;
  if (process.env.MERCURY_MEMORY_BENCHMARK_DEBUG === "1") console.log(`${sample.query} => ${results.map((item) => `${item.id}:${item.score.toFixed(3)}`).join(", ") || "(none)"}`);
  (sample.excluded || []).forEach((id) => assert.equal(ids.includes(id), false, `${id} must not be recalled for: ${sample.query}`));
  if (!expected.size && sample.mode !== "semantic") assert.equal(ids.length, 0, `irrelevant query must not recall an event: ${sample.query}`);
}

const recallAt3 = relevantReturned / totalRelevant;
const precisionAt3 = (returned - irrelevant) / Math.max(1, returned);
assert.ok(recallAt3 >= 0.95, `keyword safety baseline Recall@3 too low: ${recallAt3.toFixed(3)}`);
assert.ok(precisionAt3 >= 0.95, `keyword safety baseline Precision@3 too low: ${precisionAt3.toFixed(3)}`);
console.log(`event-memory-retrieval-benchmark: keyword-safe Recall@3=${recallAt3.toFixed(3)} Precision@3=${precisionAt3.toFixed(3)} irrelevant=${irrelevant}; semantic-target queries=${semanticTargetQueries}`);
