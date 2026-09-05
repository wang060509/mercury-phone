"use strict";

const assert = require("node:assert/strict");
const content = require("../core/preset-content.js");

let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n += 1; };
const eq = (a, b, msg) => { assert.equal(a, b, msg); n += 1; };

// 骨架模块表：每个骨架 id 都有文本。
content.SKELETON_MODULES.forEach((id) => ok(content.MODULE_TEXTS[id], `skeleton 文本缺失: ${id}`));
eq(content.SKELETON_MODULES.length, 2, "骨架模块应为 2 个");

// 互斥组分区：rel/int/pro 三组，候选都在 MODULE_TEXTS 里有文本。
const groups = content.EXCLUSIVE_GROUPS;
eq(Object.keys(groups).length, 3, "互斥组应为 3 组");
eq(groups["group.rel"].length, 4, "rel 组 4 候选");
eq(groups["group.int"].length, 3, "int 组 3 候选");
eq(groups["group.pro"].length, 3, "pro 组 3 候选");
["group.rel", "group.int", "group.pro"].forEach((g) => {
  groups[g].forEach((id) => ok(content.MODULE_TEXTS[id], `互斥候选缺文本: ${id}`));
});

// 偏好模块（非互斥，id 无 group. 前缀）都有文本 + 占位符。
["pref.focus", "pref.address", "pref.hard-off"].forEach((id) => {
  ok(content.MODULE_TEXTS[id], `pref 缺文本: ${id}`);
  ok(content.PREF_PLACEHOLDERS[id], `pref 缺占位符: ${id}`);
});

// pref 不含 group. 前缀（避免与互斥组 id 命名冲突）。
ok(!content.EXCLUSIVE_GROUPS["pref"], "pref 不应该出现在互斥组里");

// 默认预设数据：引用正确、互斥组各一、骨架在序。
const def = content.DEFAULT_PRESET;
eq(def.id, "preset-default", "默认预设 id");
eq(def.modules.order.length, 5, "默认预设 order 5 项");
// rel/int/pro 各恰好一个 enabled。
["group.rel", "group.int", "group.pro"].forEach((g) => {
  const count = groups[g].filter((id) => def.modules.enabled[id] === true).length;
  eq(count, 1, `${g} 组默认应恰好启用 1 个，实际 ${count}`);
});
// 骨架必开。
content.SKELETON_MODULES.forEach((id) => ok(def.modules.enabled[id] === true, `骨架默认应开: ${id}`));
// 骨架在 order 最前。
eq(def.modules.order[0], "skeleton.preserve-role", "骨架须在 order 最前");

// hasConflictGroupValue 识别互斥组、排除层内的非组 id。
ok(content.hasConflictGroupValue("group.rel"), "识别 group.rel");
ok(!content.hasConflictGroupValue("pref.focus"), "pref 不是互斥组");

console.log(`preset-content: ${n} assertions passed`);
