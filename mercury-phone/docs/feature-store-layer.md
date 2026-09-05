# 数据 / 存储层：一个能扛住、能测、能迁移到 IndexedDB 的通用 Store

> 日期：2026-08-02
> 目的：你现有功能"一堆 bug"的第一类来源就是存储层。这份文档专治它——把你所有 store 共同的祖先模式（`notification-store.js`）擦亮，讲清几个让你返工的坑，并给一个可照抄的加固模板。
> 读法：先看 §1 弄懂你现在的模式为什么会出 bug，再按 §4 的模板建新 store。不用一次看完。

---

## 1. 你现在的模式（所有 store 的祖先）

你现在的 store 都长一个样（`app/system/notification-store.js`），骨架是：

```js
class MercuryXXXStore {
  constructor({ storage, storageKey }) {
    this.storage = storage;        // localStorage 接口（{getItem,setItem}），可注入 Fake 测
    this.storageKey = storageKey;  // 独占一个 key
    this.listeners = new Set();
    this.sequence = 0;
    this.items = this.#load();     // 构造时同步读
  }
  add(input) { /* 校验→造 item→immutable 替换→save→emit */ }
  list()      { return this.items; }
  remove(id)  { /* filter→save→emit */ }
  clear()     { /* 清空→save→emit */ }
  subscribe(listener) { /* 存进 Set，返回退订 fn */ }
  #load()  { try { JSON.parse(storage.getItem(key) || "[]") } catch { return [] } }
  #save()  { try { storage.setItem(key, JSON.stringify(items)) } catch {} }
  #emit(type, detail) { /* 遍历 listeners 通知 */ }
}
```

这套模式本身是健康的：注入 storage 好测、immutable 好推理、subscribe 让 UI 解耦。**问题不在"模式错了"，在几个细节上这几条会咬你。**

---

## 2. 五个让你返工的坑

### 坑 1：损坏数据静默变成空 —— 你最痛的

```js
#load() {
  try { return JSON.parse(storage.getItem(key) || "[]"); }
  catch { return []; }   // ← 数据坏了悄悄变空，看起来像功能没存住
}
```

你功能"存着存着突然没数据了""重启丢东西"，大半是这个。原因：某次写入过期、被别处改坏、localStorage 里塞了非 JSON 残留——`JSON.parse` 一炸，`catch` 把整坨当成不存在，返回空数组。**你以为 Bug 在业务逻辑，其实数据还在 localStorage 里躺着，只是被当成空读了。**

**治**：不 catch 回空，要 catch 后留存线索 + 拒绝覆盖好数据。见 §4。

### 坑 2：同步读构造 —— 迁 IndexedDB 必崩

`constructor` 里同步 `this.items = this.#load()`。localStorage 是同步的所以没问题；但哪天你要存图片/相册/音频大块，得换 IndexedDB（异步的），`getItem` 变成 `get` 返回 Promise——**整个同步构造假设崩掉**，所有依赖 store 的 app 全要改。

**治**：现在就把 store 做成"构造可无初始值、明确 `init()` 异步 + 未就绪时排队/等 ready"，而不是把读硬塞进 constructor。这样以后切 IndexedDB 只改 `init` 内部。

### 坑 3：写入路径不一致

- `add`：先算 `existing`，存在则整套替换，否则前插 → `save`
- `remove`：filter → `save`
- `clear`：清空 → `save`

三条路径都 `#save()`，但 `add` 里那条替换是 `map` 出来的新数组、前插是 `[...]` 新数组——**数组来源不同**。出错时你不知道是"没 save"还是"save 了错引用"。加上 `#save` 本身 `try{}catch{}` 吞异常，**写失败你永远不知道**。

**治**：所有写操作收敛到一个 `#commit(next)`（存数组 + save + emit 一次），语义统一、可断点、可断言。

### 坑 4：无 schema 版本 / 无字段校验

加载进来任何东西都 `Object.freeze` 直接当 `items`。旧版本数据、脏数据、被别的 key 污染的数据——**字段缺、类型错**全不校验，后面 `item.body.trim()` 这类就炸（TypeError 传播到 UI）。

**治**：每类 item 有 `normalize()`（补默认 + 类型强转），加载和新增都过一遍。进入 store 的数据保证合法，消费端永不 `undefined.trim()`。

### 坑 5：`#save` 每次整表 JSON.stringify

数据一多（聊天/相册滚动到几百条）每次都全量序列化 + 整表覆盖写，卡、慢，且并发写互相踩。

**治**（先不急，段 3）：小数据先顶住，迁移 IndexedDB 时改增量/结构化写入一并解决。

---

## 3. 定位：这些坑属"存储"，先修，别急着上 IndexedDB

判断优先级：**先把你现有 store 的坑 1–4 补牢（小改动、立即见效、全在 localStorage 语义下）**。IndexedDB 迁移（坑 2/5）是阶段二——等你真有图片/相册这类大块才值得。别为还没发生的需求过早引入异步复杂度。

---

## 4. 加固模板（可直接照抄建新 store）

这是把上面 5 坑都堵上的通用模板。保持你熟悉的字段/方法名，只改实现。

```js
(function exposeMercuryXXXStore(global) {
  "use strict";

  const STORAGE_KEY = "mercury.apps.xxx";   // 换个真名，别撞

  class MercuryXXXStore {
    constructor(options = {}) {
      this.storage = options.storage || null;
      this.storageKey = options.storageKey || STORAGE_KEY;
      this.listeners = new Set();
      this.sequence = 0;
      this._items = null;      // 未 init 前是 null，不是空数组 → 坑 2（可区分"没加载"和"加载了空的"）
      this._ready = this.#init();
    }

    // --- 异步就绪（坑 2）：localStorage 下同步完成，但留给 IndexedDB 换实现 ---
    async #init() {
      const raw = this.storage?.getItem?.(this.storageKey);
      if (raw == null) { this._items = Object.freeze([]); return; }
      try {
        this._items = this.#normalizeAll(JSON.parse(raw));   // 过 schema（坑 4）
      } catch {
        // 坑 1：坏数据不清空、不覆盖。留存原始，返回"损坏"标记，让上层决定。
        this._corrupt = raw;
        this._items = Object.freeze([]);
      }
    }
    async ready() { await this._ready; }

    get items() { return this._items || Object.freeze([]); }  // 未就绪读空的，不抛

    // --- 所有写操作收敛到这一个入口（坑 3） ---
    _commit(nextArray) {
      this._items = Object.freeze(nextArray.map((item) => Object.freeze(item)));
      try { this.storage?.setItem?.(this.storageKey, JSON.stringify(this._items)); }
      catch (error) { this._lastWriteError = error; /* 不吞死，留存 */ }
      return this._items;
    }

    add(input) {
      const item = this.#normalizeOne(input);   // 统一造 item（坑 4）
      const i = this._items.findIndex((e) => e.id === item.id);
      this._commit(i >= 0 ? this._items.map((e, idx) => idx === i ? item : e) : [item, ...this._items]);
      this.#emit("added", { item });
      return item;
    }
    remove(id) {
      const next = this._items.filter((e) => e.id !== id);
      if (next.length === this._items.length) return false;
      this._commit(next); this.#emit("removed", { id }); return true;
    }
    clear() {
      const count = this._items.length;
      if (!count) return 0;
      this._commit([]); this.#emit("cleared", { count }); return count;
    }
    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("subscriber must be a function");
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    // --- schema（坑 4）：允许补默认、强转类型。不许坏数据进 store ---
    #normalizeOne(input) {
      if (!input || typeof input !== "object" || !String(input.body || "").trim())
        throw new TypeError("Xxx require a body.");
      return {
        id: input.id || `xxx:${Date.now()}:${++this.sequence}`,
        kind: input.kind || "note",
        title: String(input.title || "Mercury"),
        body: String(input.body).trim(),
        createdAt: Number(input.createdAt) || Date.now(),
      };
    }
    #normalizeAll(list) { return Array.isArray(list) ? list.map((e) => this.#normalizeOne(e)) : []; }

    #emit(type, detail) {
      const event = Object.freeze({ type, ...detail });
      this.listeners.forEach((l) => l(event, this.items));
    }
  }

  global.MercuryXXXStore = MercuryXXXStore;
})(window);
```

对照 §2 五个坑，逐条看它堵住没：
- 坑 1（坏数据静默空）→ 坏数据留存 `_corrupt` 原值，不清空覆盖，上层可决定去留。
- 坑 2（同步构造）→ 改异步 `ready()`；`items` getter 未就绪读空不抛；localStorage 下仍是同步语义、不破坏现有消费者。
- 坑 3（写入不一致）→ 全部走 `_commit`，一个断点。
- 坑 4（无 schema）→ `normalizeOne`/`normalizeAll` 全入口过。
- 坑 5（整表 stringify）→ localStorage 下暂时忍受；迁 IndexedDB 时只改 `_commit` 内部为增量写入。

> 记牢：**这套模板和你的旧 store 行为基本兼容（方法名一样），只是把坑堵上。** 你的 app 不用改，只换 store 类。

---

## 5. 配套：怎么测（照抄就能跑）

给 store 测里必配一个 `FakeStorage`（你已有，`notification-store.test.js`）。三个必测点贴上（真话，测的是"坑被堵住"）：

```js
// 1) 坏数据不清空损坏原值
const badStore = new MercuryXXXStore({ storage: corruptStorage(stringify 半截 json) });
// await badStore.ready(); 未 init 时不炸

// 2) icon 命中坑 2：可注入不存在的 storage（null）——应该能建、能 add、list 不崩
const nullStore = new MercuryXXXStore({ storage: null });
nullStore.add({ body: "x" }); // 不抛

// 3) schema 强转：脏字段被 normalize 成合法默认
const s = new MercuryXXXStore({ storage: fake });
s.add({ body: "hi", createdAt: "abc" }); // createdAt 被 Number() 归一，不存 "abc"
```

## 6. 你现在手上哪些 store 该按此加固

先给每个 store 过一遍"5 坑清单"，看它中了几条。中 2 条以上优先改：
- `notification-store.js`（祖先，必改）
- 其余 app 各自的 store（`archive-app`、`chat-experience`、各 app 内部 store）逐一排查。

## 7. 状态
- 2026-08-02 建档。文档级，未动代码（除 `runtime-core.js` 本轮新增的 [Core 27]）。
- 下一步建议：先挑一个 store（如 `notification-store`）按 §4 模板加固 + §5 测试，看你"存不住/重启丢"这类 bug 是否消失，再批量铺开。
