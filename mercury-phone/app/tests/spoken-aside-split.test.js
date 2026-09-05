"use strict";

// 渲染层心声剥离的回归测试。
// splitSpokenAside 保证：正文气泡里绝不出现〔心声〕…〔/心声〕叙述，凡心声均剥离成独立 aside。
// 自计数断言（避免手写字面量漂移）：末尾 console.log 的字面量 = 断言数。

const assert = require("node:assert/strict");
global.window = global;
require("../core/contracts.js");
require("../core/chat-experience-contracts.js");
require("../core/app-engine.js");
require("../apps/mercury-chat-data.js");
require("../system/conversation-store.js");
require("../use-cases/chat-generation-workflow.js");
require("../apps/mercury-chat-app.js");

let n = 0;
const eq = (a, b, msg) => { assert.equal(a, b, msg); n += 1; };
const ok = (cond, msg) => { assert.ok(cond, msg); n += 1; };

const app = global.MercuryCreateChatDefinition().create();
const s = app.splitSpokenAside.bind(app);

// 1. 正文 + 尾部心声 → 正文剥离、心声进 aside
{
  const r = s("今天天气真好。〔心声〕其实我有点不安，但不想说。〔/心声〕");
  eq(r.body, "今天天气真好。", "尾随心声从正文剥离");
  eq(r.aside, "其实我有点不安，但不想说。", "心声被提取为独立 aside");
}

// 2. 无心声 → 原样返回、aside 空
{
  const r = s("就是普通一句。");
  eq(r.body, "就是普通一句。", "无心声时正文原样");
  eq(r.aside, "", "无心声时 aside 为空");
}

// 3. 多行正文 + 尾部心声
{
  const r = s("第一行\n第二行\n〔心声〕心里话。〔/心声〕");
  eq(r.body, "第一行\n第二行", "多行正文剥离心声");
  eq(r.aside, "心里话。", "多行场景心声正确提取");
}

// 4. 空串边界
{
  const r = s("");
  eq(r.body, "", "空串正文为空");
  eq(r.aside, "", "空串无 aside");
}

// 5. 中间夹心声（模型不守纪律时）→ 也剥离，正文不含叙述
{
  const r = s("开头〔心声〕心里〔/心声〕结尾");
  ok(!r.body.includes("〔心声〕"), "嵌在正文中间的心声也被剥离");
  eq(r.aside, "心里", "中心声进 aside");
}

// 6. 单边标记（开无闭）→ 视为普通正文，不误判
{
  const r = s("就这么说〔心声〕但没闭合");
  eq(r.body, "就这么说〔心声〕但没闭合", "不完整标记不剥离（保守）");
  eq(r.aside, "", "不完整标记无 aside");
}

// 7. 结构性三段标签走到渲染层（服务端漏网时的兜底）→ 剥 thinking、inner-voice 并入 aside
{
  const r = s("<thinking>她在想要不要继续。</thinking>\n嗯。\n知道了。\n<inner-voice>内心：其实有点想留下</inner-voice>");
  eq(r.body, "嗯。\n知道了。", "渲染层兜底剥 thinking 与 inner-voice，正文只留口语");
  eq(r.aside, "内心：其实有点想留下", "inner-voice 内文并入 aside");
}

// 8. 标签 + 〔心声〕混合 → 两路都剥，aside 合一
{
  const r = s("<thinking>试探一下。</thinking>\n好吧。\n〔心声〕有点舍不得。〔/心声〕\n<inner-voice>内心：骗他的</inner-voice>");
  ok(!r.body.includes("<thinking>") && !r.body.includes("<inner-voice>") && !r.body.includes("〔心声〕"), "两种标记都不泄漏进正文");
  eq(r.body, "好吧。", "正文口语行保留");
  ok(r.aside.includes("有点舍不得。") && r.aside.includes("内心：骗他的"), "〔心声〕与 inner-voice 两路心声并入 aside");
}

// 9. 仅带 <thinking>（无 inner-voice）→ 只剥思维链，正文保留、aside 空
{
  const r = s("<thinking>分析一下。</thinking>\n就这样吧。");
  eq(r.body, "就这样吧。", "仅 thinking 时正文口语保留");
  eq(r.aside, "", "无 inner-voice 也无〔心声〕时 aside 为空");
}

// 10. 渲染层兜底：正文气泡里的括号动作也被剥掉（服务端漏网时）
{
  const r = s("（想了一下，语气随和）那倒也是。\n要不这样，下回约你。");
  ok(!r.body.includes("（") && !r.body.includes("）"), "括号动作从正文剥离");
  eq(r.body, "那倒也是。\n要不这样，下回约你。", "剥括号后口语正文保留");
  eq(r.aside, "", "括号动作不当作 aside");
}

// 11. 整行只有括号动作（模型只输出（点头））→ 剥空后不残留括号
{
  const r = s("（点头）");
  eq(r.body.replace(/[（）()]/g, "").trim(), "", "整行括号动作被剥空");
}

console.log(`spoken-aside-split: ${n} assertions passed`);
