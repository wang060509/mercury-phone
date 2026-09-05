"use strict";

const assert = require("node:assert/strict");
require("../core/preset-content.js");
require("../system/user-preset-store.js");

class FakeStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n += 1; };
const eq = (a, b, msg) => { assert.equal(a, b, msg); n += 1; };
const throws = (fn, re, msg) => { assert.throws(fn, re, msg); n += 1; };

// 1) 空库 list() 恒含内置 default。
const storage = new FakeStorage();
const store = new global.MercuryUserPresetStore({ storage });
const events = [];
store.subscribe((event) => events.push(event.type));
eq(store.list().length, 1, "空库 list 应为 1（含默认）");
eq(store.list()[0].id, "preset-default", "空库首项是 preset-default");

// 2) get(null) / get(缺失 id) 都回退默认，不崩。
const def = store.get(null);
eq(def.id, "preset-default", "get(null) 返回默认");
eq(store.get("ghost").id, "preset-default", "get(不存在) 回退默认");

// 3) add 用户预设：列表长 2，get 可取回。
const p = store.add({
  id: "preset-zen",
  name: "佛系",
  modules: { order: ["skeleton.preserve-role", "group.int.slow", "group.pro.reactive"], enabled: { "skeleton.preserve-role": true, "group.int.slow": true, "group.pro.reactive": true } },
});
eq(p.id, "preset-zen", "add 返回所选预设");
eq(p.name, "佛系", "name 保留");
eq(store.list().length, 2, "add 后 list 长 2");
eq(store.list()[1].id, "preset-zen", "默认排在用户前");
eq(store.get("preset-zen").name, "佛系", "get 取回用户预设");

// 4) 同 id 覆盖：不新增。
store.add({ id: "preset-zen", name: "佛系改", modules: { order: ["group.int.high"], enabled: { "group.int.high": true } } });
eq(store.list().length, 2, "同 id 覆盖不新增");
eq(store.get("preset-zen").name, "佛系改", "覆盖生效");

// 5) acceptedConflicts 透传保存。
store.remove("preset-zen");
store.add({ id: "preset-edge", name: "边缘", modules: { order: ["group.rel.familiar"], enabled: { "group.rel.familiar": true } }, acceptedConflicts: ["group.rel"] });
eq(store.get("preset-edge").acceptedConflicts[0], "group.rel", "acceptedConflicts 透传");

// 6) 空 id / 空 modules 校验拦截。
throws(() => store.add({}), /require an id/, "空 id 拒绝");
throws(() => store.add({ id: "x", modules: {} }), /require modules/, "无 order 且无 enabled 拒绝");

// 7) remove / clear。
eq(store.remove("preset-edge"), true, "remove 存在返回 true");
eq(store.remove("ghost"), false, "remove 缺失返回 false");
eq(store.list().length, 1, "remove 后仅剩默认");
eq(store.clear(), 0, "clear 只清用户条目，此刻已无");
eq(store.list().length, 1, "clear 后 list 仍含默认");

eq(events.join(","), "added,added,removed,added,removed", "事件序列（clear 空时不 emit）");

// 8) 坏数据留存 corrupt、不覆盖、不清空。
const corruptStorage = new FakeStorage();
corruptStorage.setItem("k", '"semi-{broken');
const bad = new global.MercuryUserPresetStore({ storage: corruptStorage, storageKey: "k" });
eq(bad.corrupt, '"semi-{broken', "整表坏数据留存 corrupt");
bad.add({ id: "ok", modules: { order: ["group.int.balanced"], enabled: { "group.int.balanced": true } } });
eq(bad.corrupt, '"semi-{broken', "add 不抹掉 corrupt 标记（原坏数据仍留存可查）");

// 9) storage null：可建、可 add、list 不崩（坑2）。
const nullStore = new global.MercuryUserPresetStore({ storage: null });
nullStore.add({ id: "mem", name: "内存", modules: { order: ["group.int.balanced"], enabled: { "group.int.balanced": true } } }); // 不抛
eq(nullStore.list().length >= 1, true, "null storage 仍能 list");

// 10) preferences（pref.* 运行时占位符取值）保存并原样取回，不因 add→get 往返丢失。
store.add({ id: "preset-pref", name: "偏好", modules: { order: ["pref.focus"], enabled: { "pref.focus": true } }, preferences: { initialFocus: "聊今天的黄昏", address: "阿彩" } });
const prefBack = store.get("preset-pref");
eq(prefBack.preferences.initialFocus, "聊今天的黄昏", "preferences.initialFocus 往返保留");
eq(prefBack.preferences.address, "阿彩", "preferences.address 往返保留");
eq(store.get("preset-default").preferences, undefined, "默认预设无 preferences（未填）");

store.add({ id: "preset-compatible", name: "兼容预设", modules: { order: ["compat.block.primary"], enabled: { "compat.block.primary": true }, texts: { "compat.block.primary": "Keep this text." } }, compatibility: { format: "external-chat-preset", rawSource: { future_setting: { preserve: true } }, blocks: [{ id: "primary", enabled: true, role: "system", injection: { position: null, depth: null, order: 0 } }] } });
eq(store.get("preset-compatible").compatibility.rawSource.future_setting.preserve, true, "compatible preset raw source survives store round-trip");
eq(store.get("preset-compatible").compatibility.blocks[0].injection.order, 0, "compatible preset injection metadata survives store round-trip");
eq(store.get("preset-compatible").modules.texts["compat.block.primary"], "Keep this text.", "compatible preset prompt text survives store round-trip");

console.log(`user-preset-store: ${n} assertions passed`);
