"use strict";

const assert = require("node:assert/strict");
require("../core/preset-content.js");
const { validateUserPreset } = require("../core/preset-validate.js");

let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n += 1; };
const eq = (a, b, msg) => { assert.equal(a, b, msg); n += 1; };

// 1) 合法预设通过。
const good = {
  id: "preset-x", name: "X",
  modules: { order: ["skeleton.preserve-role", "group.rel.familiar", "group.int.slow"], enabled: { "skeleton.preserve-role": true, "group.rel.familiar": true, "group.int.slow": true } },
};
const g = validateUserPreset(good);
eq(g.ok, true, "合法预设 ok");
eq(g.errors.length, 0, "无 error");

// 2) 缺 id / name → error。
eq(validateUserPreset({ name: "没id" }).ok, false, "缺 id → 拒");
eq(validateUserPreset({ id: "x" }).ok, false, "缺 name → 拒");

// 3) modules 缺形状。
eq(validateUserPreset({ id: "x", name: "n" }).ok, false, "缺 modules → 拒");
eq(validateUserPreset({ id: "x", name: "n", modules: { enabled: {} } }).ok, false, "缺 order → 拒");

// 4) 互斥双选（未授权）→ 拒，且精确列出冲突。
const conflict = {
  id: "c", name: "撞",
  modules: { order: ["group.rel.respect-card", "group.rel.stranger"], enabled: { "group.rel.respect-card": true, "group.rel.stranger": true } },
};
const c = validateUserPreset(conflict);
eq(c.ok, false, "互斥双选 → 拒");
eq(c.errors.length, 1, "恰一条硬错误");
eq(c.errors[0].code, "exclusive_multiple", "错误码 exact");
eq(c.errors[0].group, "group.rel", "点名到组");
eq(c.errors[0].conflictModules.length, 2, "列全两条冲突候选");
ok(c.errors[0].conflictModules.includes("group.rel.respect-card") && c.errors[0].conflictModules.includes("group.rel.stranger"), "冲突清单含这两条");

// 5) 互斥双选 + acceptedConflicts 授权 → 放过，降级 warning（允许过就记住）。
const authorized = { ...conflict, acceptedConflicts: ["group.rel"] };
const ares = validateUserPreset(authorized);
eq(ares.ok, true, "授权后放过");
eq(ares.warnings.some((w) => w.code === "exclusive_multiple_accepted"), true, "记一条已确认 warning");

// 6) order 引用 enabled 里不存在的 key → error。
const strayOrder = {
  id: "s", name: "S",
  modules: { order: ["skeleton.preserve-role", "ghost.module"], enabled: { "skeleton.preserve-role": true } },
};
const so = validateUserPreset(strayOrder);
eq(so.ok, false, "order 引用未定义模块 → 拒");
ok(so.errors.some((e) => e.code === "order_unknown_module" && e.moduleId === "ghost.module"), "点名到未定义模块");

// 7) order 含 enabled:false 的模块 → warning 而非 error。
const inactive = {
  id: "i", name: "I",
  modules: { order: ["skeleton.preserve-role", "pref.focus"], enabled: { "skeleton.preserve-role": true, "pref.focus": false } },
};
const ia = validateUserPreset(inactive);
eq(ia.ok, true, "order 含未启用项不拒（warning）");
ok(ia.warnings.some((w) => w.code === "order_inactive_module" && w.moduleId === "pref.focus"), "未启用项记 warning");

// 8) 未知模块无携带文本（库不认、text 空）→ warning，不炸。
const unknown = {
  id: "u", name: "U",
  modules: { order: [], enabled: {}, texts: { "custom.thing": "" } },
};
const un = validateUserPreset(unknown);
eq(un.ok, true, "未知模块不炸");
ok(un.warnings.some((w) => w.code === "unknown_module_no_text"), "无文本未知模块记 warning");

// 9) acceptedConflicts 含未识别组 → warning。
const badAccepted = { ...good, acceptedConflicts: ["group.nope"] };
eq(validateUserPreset(badAccepted).warnings.some((w) => w.code === "unknown_accepted_group"), true, "未识别授权组记 warning");

console.log(`preset-validate: ${n} assertions passed`);
