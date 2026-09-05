"use strict";

// Chat Generation Profile 消费端与兼容编辑器的回归测试。
// 自计数断言：末尾 console.log 的字面量即 n，随断言数增减（避免手写字面量漂移）。

const assert = require("node:assert/strict");
global.window = global;
require("../core/contracts.js");
require("../core/chat-experience-contracts.js");
require("../core/app-engine.js");
require("../apps/mercury-chat-data.js");
require("../system/conversation-store.js");
require("../use-cases/chat-generation-workflow.js");
require("../apps/mercury-chat-app.js");
require("../core/preset-content.js");
require("../core/generation-profile-contracts.js");
require("../core/preset-assemble.js");
require("../system/generation-profile-store.js");

class FakeElement {
  constructor(tagName) { this.tagName = tagName; this.children = []; this.dataset = {}; this.className = ""; this.style = {}; this.scrollHeight = 37; this.classList = { add: (name) => { this.className += ` ${name}`; } }; this.listeners = {}; this.type = ""; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(name, value) { this[name] = String(value); }
  addEventListener(name, callback) { this.listeners[name] = callback; }
}
global.document = { createElement: (tagName) => new FakeElement(tagName) };

let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n += 1; };
const eq = (a, b, msg) => { assert.equal(a, b, msg); n += 1; };

const definition = global.MercuryCreateChatDefinition();

// ---- 预置一个 store：默认 + 1 个已存预设 ----
const savedId = "preset-lovers";
const savedName = "恋人开局";
const savedPreset = {
  id: savedId,
  name: savedName,
  version: 1,
  preferences: { initialFocus: "聊今天的黄昏", address: "阿彩" },
  modules: {
    order: ["skeleton.preserve-role", "skeleton.mode", "group.rel.lovers", "group.int.slow", "group.pro.initiative", "pref.focus", "pref.address", "pref.hard-off"],
    enabled: {
      "skeleton.preserve-role": true, "skeleton.mode": true,
      "group.rel.lovers": true, "group.int.slow": true, "group.pro.initiative": true,
      "pref.focus": true, "pref.address": true, "pref.hard-off": false,
    },
  },
  custom: { instructions: "保持温柔。" },
};

const DEFAULT_STORAGE_KEY = "mercury.apps.chats.userPresets";
const stored = new Map();
stored.set(DEFAULT_STORAGE_KEY, JSON.stringify([savedPreset]));

const root = new FakeElement("main");
const launches = [];
const ctx = {
  state: {},
  i18n: { t: (key) => key },
  services: {
    storage: { get: (key, fallback) => stored.get(key) ?? fallback, set: (key, value) => stored.set(key, value) },
    launchApp: (appId, route) => { launches.push({ appId, route }); return true; },
  },
};
const app = definition.create();
app.render(root, ctx);
app.ui.selectedContactId = "contact-a";

// 预设层应已装载
ok(app.presetLayerReady(), "预设层已装配（store/assemble/PC 齐备）");

const PC = global.MercuryPresetContent;
const cfg = global.MercuryChatExperienceContracts;

// ---- 1. 入口：设置页将资源统一收在「资源与上下文」，预设只在该页出现 ----
app.ui.route = "settings"; app.paint();
{
  const page = root.children[0];
  const body = page.children[1];
  const rows = [];
  (function walk(node) {
    (node.children || []).forEach((c) => { if (c.className && String(c.className).includes("mercury-chat-settings-row") && c.children && c.children[0]) rows.push(c); walk(c); });
  })(body);
  const resourceEntry = rows.find((r) => r.children[0].textContent === "资源与上下文");
  ok(Boolean(resourceEntry), "设置页含「资源与上下文」行");
  resourceEntry.listeners.click();
  eq(app.ui.route, "conversationResources", "点「资源与上下文」进入会话资源页");
  const resourceRows = [];
  (function walk(node) {
    (node.children || []).forEach((c) => { if (c.className && String(c.className).includes("mercury-chat-settings-row") && c.children && c.children[0]) resourceRows.push(c); walk(c); });
  })(root.children[0].children[1]);
  const presetEntry = resourceRows.find((r) => r.children[0].textContent === "玩法预设");
  ok(Boolean(presetEntry), "会话资源页含唯一的「玩法预设」行");
  eq(presetEntry.children[1].textContent, "默认预设 · 已生效", "会话资源页显示当前预设及真实运行状态");
  presetEntry.listeners.click();
  eq(app.ui.route, "presetList", "点资源页的「玩法预设」进入预设列表路由");
}

// ---- 2. 列表：Chat 只做当前会话切换，完整管理回到 Archive ----
app.paint();
{
  const page = root.children[0];
  const body = page.children[1];
  const picks = body.children[1];
  eq(String(picks.className).includes("mercury-chat-preset-picks"), true, "列表含启用法分组");
  const pickRows = picks.children.filter((c) => String(c.className).split(/\s+/).includes("mercury-chat-preset-pick"));
  eq(pickRows.length, 2, "列表渲染 2 个预设 pick（默认 + 已存）");
  eq(pickRows[0].dataset.presetId, "preset-default", "第一行为默认预设");
  eq(pickRows[1].dataset.presetId, savedId, "第二行为已存预设");
  eq(body.children.some((node) => String(node.className).includes("mercury-chat-preset-mine")), false, "Chat 不再重复渲染我的预设管理列表");
  eq(body.children.some((node) => String(node.className).includes("mercury-chat-preset-transfer")), false, "Chat 不再暴露导入导出管理操作");
  const manage = body.children[2];
  eq(String(manage.className).includes("mercury-chat-preset-manage"), true, "列表底部提供唯一档案馆管理入口");
  manage.listeners.click();
  eq(launches[0].appId, "archive", "管理入口打开档案馆");
  eq(launches[0].route, "presets", "管理入口直达生成档案唱片柜");
  // 点击「名字→保存」前，先用行触发启用绑定（第 2、3 步之间状态可交错，但这里独立断言绑定）
  pickRows[1].listeners.click();
  eq(app.ui.route, "presetList", "启用后停留列表");
  eq(app.experienceFor("contact-a").settings.userPresetId, savedId, "启用绑定 userPresetId 为已存预设");
  const persisted = cfg.normalize(stored.get(cfg.STORAGE_KEY));
  eq(persisted.conversations["contact-a:default"].settings.userPresetId, savedId, "绑定写入 chat-experience 存储");
}

// 导入档案中未解析的宏必须显示为部分接入，不得冒充完整生效。
{
  app.presetStore.add({
    id: "preset-imported-partial",
    name: "Imported preset",
    origin: "imported",
    modules: { order: [], enabled: {} },
    instructionBlocks: [{ id: "stage-1", enabled: true, runtimeEligible: true, content: "<style>{{getvar::voice}} {{user}} {{getvar::missing}}</style>" }],
    compatibility: {
      format: "external-chat-preset",
      runtime: { activeCount: 1, preservedCount: 64 },
      blocks: [
        { id: "init", enabled: true, runtimeActive: false, injection: { order: 0 }, content: "{{setvar::voice::克制、自然}}" },
        { id: "stage-1", enabled: true, runtimeActive: true, injection: { order: 1 }, content: "<style>{{getvar::voice}} {{user}} {{getvar::missing}}</style>" },
      ],
    },
  });
  app.ui.route = "presetList"; app.paint();
  const body = root.children[0].children[1];
  const rows = body.children[1].children.filter((node) => String(node.className).split(/\s+/).includes("mercury-chat-preset-pick"));
  const importedRow = rows.find((row) => row.dataset.presetId === "preset-imported-partial");
  ok(Boolean(importedRow), "导入档案出现在唯一选择列表中");
  eq(importedRow.children[1].children[1].textContent, "部分接入", "未解析变量显示为部分接入");
  ok(String(importedRow.children[0].children[2].textContent).includes("已适配 1 个变量"), "列表明确提示已完成的变量适配");
  ok(String(importedRow.children[0].children[2].textContent).includes("剩余 1 个模板项"), "列表明确提示尚未解析的模板项");
  eq(app.presetRuntimeState({ settings: { userPresetId: "preset-imported-partial" }, resourceBindings: { presetId: "preset-imported-partial" } }).label, "部分接入", "会话资源入口沿用真实兼容状态");
  const parameterCopy = app.presetRuntimeCopy({ origin: "imported" }, { status: "preserved", runtimeActiveCount: 0, preservedCount: 0, preservedSettingsCount: 3, resolvedVariableCount: 0, unresolvedMacroCount: 0 });
  eq(parameterCopy.label, "仅保留", "参数型预设不会被描述为已经生效");
  ok(parameterCopy.detail.includes("3 个参数保留"), "紧凑状态说明保留的生成参数数量");
}

// ---- 3. 编辑器：一发卡 = 一模块；组卡单选；骨架只读；free-text 预览；保存 ----
app.openPresetEditor(savedId);
eq(app.ui.route, "presetEditor", "进入编辑器路由");
{
  const page = root.children[0];
  const body = page.children[1];
  eq(body.className, "mercury-chat-settings mercury-chat-preset-editor", "编辑器 body 类名");
  const cards = body.children.filter((c) => c.className && String(c.className).includes("mercury-chat-preset-card"));
  // 模块卡: 骨架2 + 组rel/int/pro各1 + pref.focus/address/hard-off = 8；再加 custom + 预览卡 = 10
  eq(cards.length, 10, "编辑器渲染 10 张卡（8 模块 + 自定义 + 预览）");
  const firstModuleHeader = cards[0].children[0];
  const firstModuleDisclosure = firstModuleHeader.children[0];
  eq(firstModuleDisclosure["aria-expanded"], "false", "模块默认折叠，保持列表扫描效率");
  firstModuleDisclosure.listeners.click();
  eq(app.ui.presetExpandedCards[cards[0].dataset.presetTitle], true, "点击模块标题会记录展开状态");

  // 组卡：group.rel 卡，候选 4 个单选，恰好一个 checked
  const relCard = cards.find((c) => c.dataset.presetTitle === "关系与连续性");
  ok(Boolean(relCard), "有「关系与连续性」组卡");
  const relOpts = relCard.children[1].children.filter((c) => c.className && String(c.className).includes("mercury-chat-preset-opt"));
  eq(relOpts.length, PC.EXCLUSIVE_GROUPS["group.rel"].length, "组卡含 4 个候选选项");
  const enabledIn = (group, enabled) => PC.EXCLUSIVE_GROUPS[group].filter((m) => enabled[m] === true);
  const selNow = enabledIn("group.rel", app.presetDraft.modules.enabled);
  eq(selNow.length, 1, "组内恰好一个候选被选中");
  eq(selNow[0], "group.rel.lovers", "group.rel 当前选中恋人候选");
  // 点另一个候选（stranger）→ 组内切换，仅一个 true
  const strangerOpt = relOpts.find((o) => String(o.children[1].textContent).includes("陌生"));
  ok(Boolean(strangerOpt), "找到 stranger 候选 option");
  strangerOpt.children[0].checked = true;
  strangerOpt.children[0].listeners.change();
  const afterOn = enabledIn("group.rel", app.presetDraft.modules.enabled);
  eq(afterOn.length, 1, "组内切换后仍恰好一个 true");
  eq(afterOn[0], "group.rel.stranger", "切换生效为 stranger");

  // 骨架卡：含「必开」pill 且无控件
  const skelCardA = cards.find((c) => c.dataset.presetTitle === "尊重角色本质");
  ok(Boolean(skelCardA), "有骨架卡（尊重角色本质）");
  const reqPills = skelCardA.querySelectorAll ? [] : skelCardA.children[1].children.filter((c) => c.className && String(c.className).includes("mercury-chat-preset-required"));
  eq(reqPills.length, 1, "骨架卡含必开 pill");
  eq(reqPills[0].textContent, "必开", "pill 文本为必开");
  const skeletonControls = skelCardA.children[1].children.filter((c) => c.type && (c.type === "radio" || c.type === "checkbox"));
  eq(skeletonControls.length, 0, "骨架卡无控件（只读）");

  // free-text pref + 实时预览：填称呼「阿彩」→ 预览更新
  const addrCard = cards.find((c) => c.dataset.presetTitle === "称呼");
  ok(Boolean(addrCard), "有称呼 free-text 卡");
  const addrInput = addrCard.children[1].children[0];
  eq(addrInput.className.includes("mercury-chat-preset-input"), true, "称呼卡内嵌输入框");
  addrInput.value = "阿彩";
  addrInput.listeners.input();
  const draftPref = app.presetDraft.preferences.address;
  eq(draftPref, "阿彩", "输入写回 draft.preferences.address");

  // 预览 = 动态生成；改用「预览方法」直接断言装配输出（避免旧 DOM 节点引用）
  const builtPreview = app.presetLivePreviewText(app.presetDraft);
  ok(String(builtPreview).includes("陌生"), "预览装配反映新选中 stranger 候选文本");
  ok(String(builtPreview).includes("阿彩"), "预览装配含填写的称呼");
  ok(String(builtPreview).includes("黄昏"), "预览装配含 initialFocus 偏好");
}

// 重渲后链路取到的 editor 视图里仍有「输出检查」卡（阅读路径可用）
{
  app.ui.route = "presetEditor"; app.paint();
  const page = root.children[0];
  const body = page.children[1];
  const allCards = body.children.filter((c) => c.className && String(c.className).includes("mercury-chat-preset-card"));
  const preCard = allCards.find((c) => c.dataset.presetTitle === "输出检查");
  ok(Boolean(preCard), "重渲后仍有输出检查卡");
  const pre = preCard.children[1].children[0];
  ok(String(pre.textContent).includes("陌生"), "UI 预览卡反映新选中 stranger");
}

// ---- 4. 保存为新预设：store.list() +1，来源未被 clobber ----
{
  app.presetDraft.name = "温柔开局";
  app.presetDraft.dirty = true;
  const saved = app.savePresetDraftAsNew();
  ok(Boolean(saved), "保存为新预设返回对象");
  ok(saved.id !== savedId, "新预设 id 与来源不同（未覆盖）");
  const list = app.presetStore.list();
  const ids = list.map((p) => p.id);
  ok(ids.includes(saved.id), "新预设已入库");
  ok(ids.includes(savedId), "来源预设仍在（未 clobber）");
  // 「保存为新预设」不静默改绑当前对话（启用是列表里的独立动作）
  eq(app.experienceFor("contact-a").settings.userPresetId, savedId, "保存为新预设不改动当前对话的绑定");
  // 保存后停留在新预设的编辑器内
  eq(app.ui.route, "presetEditor", "保存后进入新预设编辑器");
  eq(app.presetDraft.id, saved.id, "编辑目标切为新预设");
}

console.log(`preset-ui: ${n} assertions passed`);
