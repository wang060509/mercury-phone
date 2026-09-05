"use strict";

const assert = require("node:assert/strict");
const content = require("../core/preset-content.js");
const { assemblePresetInstructions, inspectPresetInstructions } = require("../core/preset-assemble.js");

let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n += 1; };
const eq = (a, b, msg) => { assert.equal(a, b, msg); n += 1; };

// 1) preset-default 的 diff 断言：输出 == 按 order 从 MODULE_TEXTS 逐段拼接。
const expectedDefault = content.DEFAULT_PRESET.modules.order
  .map((id) => content.MODULE_TEXTS[id])
  .join("\n\n");
eq(assemblePresetInstructions(content.DEFAULT_PRESET), expectedDefault, "preset-default 输出与 §5.1 拼串一致");
eq(typeof assemblePresetInstructions(content.DEFAULT_PRESET), "string", "默认返回 string");

// 2) 段间空行：默认输出应包含两个连续换行。
ok(assemblePresetInstructions(content.DEFAULT_PRESET).includes("\n\n"), "段间空行");

// 3) 互斥组双选：按 order 取第一个，后者跳过并记 warning。
const both = { id: "b", modules: {
  order: ["skeleton.preserve-role", "group.rel.respect-card", "group.rel.stranger"],
  enabled: { "skeleton.preserve-role": true, "group.rel.respect-card": true, "group.rel.stranger": true },
} };
const res = assemblePresetInstructions(both, { withWarnings: true });
ok(res.warnings.some((w) => w.code === "exclusive_group_multiple" && w.group === "group.rel"), "互斥双选记 warning");
// 仍只有 respect-card（order 靠前）的文本，stranger 被跳过。
const relParts = res.text.split("\n\n").filter((seg) => seg.includes("关系起点"));
eq(relParts.length, 1, "互斥组只拼一条");
ok(relParts[0].includes("尊重角色卡"), "取 order 靠前的 respect-card");

// 4) 空预设返回空字符串。
eq(assemblePresetInstructions(null), "", "null 预设返回空串");
eq(assemblePresetInstructions({ id: "x", modules: {} }), "", "无有效模块返回空串");

// 5) 未知模块带携带文本 → 依序拼入；不带 → 跳过 + warning。
const withUnknown = { id: "u", modules: {
  order: ["skeleton.preserve-role", "custom.rule-a", "custom.rule-b"],
  enabled: { "skeleton.preserve-role": true, "custom.rule-a": true, "custom.rule-b": true },
  texts: { "custom.rule-a": "自定义规则A" },
} };
const ru = assemblePresetInstructions(withUnknown, { withWarnings: true });
ok(ru.text.includes("自定义规则A"), "带文本的未知模块被拼入");
ok(!ru.text.includes("custom.rule-b"), "无文本未知模块未拼入");
ok(ru.warnings.some((w) => w.code === "no_text" && w.moduleId === "custom.rule-b"), "无文本未知模块记 warning");

// 6) 仅启用过滤：enabled false 的模块跳过。
const filtered = { id: "f", modules: {
  order: ["skeleton.preserve-role", "group.int.high"],
  enabled: { "skeleton.preserve-role": true, "group.int.high": false },
} };
eq(assemblePresetInstructions(filtered), content.MODULE_TEXTS["skeleton.preserve-role"], "只拼 enabled=true；high 被关闭");

// 7) pref 占位符：有值注入；未填跳过。
const noPref = { id: "p", modules: {
  order: ["skeleton.preserve-role", "pref.focus"],
  enabled: { "skeleton.preserve-role": true, "pref.focus": true },
} };
eq(assemblePresetInstructions(noPref), content.MODULE_TEXTS["skeleton.preserve-role"], "pref 占位未填则不生成该段");
const withPref = { id: "p2", ...noPref, preferences: { initialFocus: "雨后的窗台" } };
const prefText = assemblePresetInstructions(withPref);
ok(prefText.includes("雨后的窗台"), "pref.focus 占位被替换");
ok(prefText.includes("优先朝雨后的窗台展开"), "占位替换进原文串");
ok(!prefText.includes("{initialFocus}"), "{initialFocus} 已无残留");

// 8) custom.instructions 非空追加末尾。
const withCustom = { id: "c", ...content.DEFAULT_PRESET, custom: { instructions: "补充一句。" } };
const customOut = assemblePresetInstructions(withCustom);
ok(customOut.endsWith("补充一句。"), "custom 追加在最后");

// 9) 互斥组内候选关闭：order 里先出现但关闭的候选静默跳过，改取组内下一个开着的候选。
const groupOneOn = { id: "n", modules: {
  order: ["skeleton.preserve-role", "group.rel.respect-card", "group.rel.stranger"],
  enabled: { "skeleton.preserve-role": true, "group.rel.respect-card": false, "group.rel.stranger": true },
} };
const gon = assemblePresetInstructions(groupOneOn, { withWarnings: true });
ok(gon.text.includes(content.MODULE_TEXTS["group.rel.stranger"]), "组装取开着的那条 stranger");
ok(!gon.text.includes(content.MODULE_TEXTS["group.rel.respect-card"]), "关闭的 respect-card 不产出");

// 10) 导入提示块的兼容性诊断只读，不改写装配文本。
const imported = {
  id: "preset-imported",
  modules: { order: [], enabled: {} },
  instructionBlocks: [{ id: "stage-1", enabled: true, runtimeEligible: true, content: "<style>{{getvar::voice}} {{getvar::pace}}</style>" }],
  compatibility: { runtime: { activeCount: 1, preservedCount: 64 } },
};
const importedBefore = assemblePresetInstructions(imported);
const importedInspection = inspectPresetInstructions(imported);
eq(importedInspection.status, "partial", "含未解析变量或仅保留块时标为部分接入");
eq(importedInspection.unresolvedMacroCount, 2, "按唯一变量统计未解析宏");
eq(importedInspection.runtimeActiveCount, 1, "保留导入报告的运行项计数");
eq(importedInspection.preservedCount, 64, "保留导入报告的仅保留项计数");
eq(assemblePresetInstructions(imported), importedBefore, "诊断不改写运行时装配文本");

// 11) 外部预设只从启用的纯文本赋值块建立变量上下文，未知模板继续保留。
const adapted = {
  id: "preset-adapted",
  modules: { order: [], enabled: {} },
  instructionBlocks: [{ id: "stage-1", enabled: true, runtimeEligible: true, content: "<style>{{getvar::voice}} {{getvar::missing}}</style>" }],
  compatibility: {
    format: "external-chat-preset",
    runtime: { activeCount: 1, preservedCount: 1 },
    blocks: [
      { id: "init", enabled: true, runtimeActive: false, injection: { order: 0 }, content: "{{setvar::voice::克制、自然}}" },
      { id: "stage-1", enabled: true, runtimeActive: true, injection: { order: 1 }, content: "<style>{{getvar::voice}} {{getvar::missing}}</style>" },
    ],
  },
};
const adaptedText = assemblePresetInstructions(adapted);
const adaptedInspection = inspectPresetInstructions(adapted);
ok(adaptedText.includes("克制、自然"), "已启用的安全变量定义进入装配文本");
ok(adaptedText.includes("{{getvar::missing}}"), "没有定义的变量继续原样保留");
eq(adaptedInspection.resolvedVariableCount, 1, "诊断报告已适配变量数");
eq(adaptedInspection.unresolvedVariableCount, 1, "诊断报告剩余变量数");
eq(adaptedInspection.unresolvedMacroCount, 1, "最终文本只统计仍未解决的模板项");
eq(adaptedInspection.status, "partial", "仍有未解析模板或仅保留块时保持部分接入");

console.log(`preset-assemble: ${n} assertions passed`);
