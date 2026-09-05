(function exposeMercuryUserPresetStore(global) {
  "use strict";

  const DEFAULT_STORAGE_KEY = "mercury.apps.chats.userPresets";
  const content = global.MercuryPresetContent || null;
  const BUILTIN_DEFAULT = (content && content.DEFAULT_PRESET) || null;

  function clonePreset(value) {
    return value && typeof value === "object"
      ? JSON.parse(JSON.stringify(value))
      : value;
  }

  // 存储侧规范化只做结构/类型强转（含"已确认冲突"标记），不重复 validate 的语义校验。
  // 语义合法性（互斥组、order 是否自洽）归 validateUserPreset；store 只负责存得下、读得回。
  function normalizeModules(value) {
    const modules = value && typeof value === "object" ? value : {};
    const order = Array.isArray(modules.order) ? modules.order.map(String) : [];
    const rawEnabled = modules.enabled && typeof modules.enabled === "object" ? modules.enabled : {};
    const enabled = {};
    Object.keys(rawEnabled).forEach((key) => { enabled[String(key)] = rawEnabled[key] === true; });
    const rawTexts = modules.texts && typeof modules.texts === "object" ? modules.texts : {};
    const texts = {};
    Object.keys(rawTexts).forEach((key) => { if (typeof rawTexts[key] === "string") texts[String(key)] = rawTexts[key]; });
    return Object.keys(texts).length ? { order, enabled, texts } : { order, enabled };
  }

  class MercuryUserPresetStore {
    constructor(options = {}) {
      this.storage = options.storage || null;
      this.storageKey = options.storageKey || DEFAULT_STORAGE_KEY;
      this.listeners = new Set();
      this.sequence = options.sequence || 0;
      this._corrupt = null;
      this._lastWriteError = null;
      this.items = this.#load();
    }

    // 已加载但损坏的原始数据，供上层决定去留，不让坏数据静默变空/覆盖。见 feature-store-layer.md §2坑1。
    get corrupt() { return this._corrupt; }
    // 最近一次落盘失败，写失败不再被悄悄吞掉。见 §2坑3。
    get lastWriteError() { return this._lastWriteError; }

    // 内置默认预设（preset-default）作为兜底，不参与用户列表的 persisted 部分，但恒可取得。
    get defaultPreset() {
      return BUILTIN_DEFAULT ? clonePreset(BUILTIN_DEFAULT) : null;
    }

    // 返回全部预设列表，始终以 preset-default 打头，其后是用户保存的（用户同 id 覆盖内置时用用户的）。
    list() {
      const custom = this.items;
      if (!BUILTIN_DEFAULT) return this.items;
      const idx = custom.findIndex((item) => item.id === BUILTIN_DEFAULT.id);
      if (idx >= 0) return custom; // 用户已覆盖默认，直接用（默认排在最前的维护交给 add）
      return [clonePreset(BUILTIN_DEFAULT), ...custom];
    }

    // 取单个预设；id 为 null/undefined/不存在 时返回内置默认（兜底行为见 preset-onboard §5）。
    get(id) {
      if (id == null) return this.defaultPreset;
      const found = this.items.find((item) => item.id === String(id));
      if (found) return clonePreset(found);
      return this.defaultPreset;
    }

    // 新建/覆盖（同 id 覆盖）。id 为空时由 normalize 生成。
    add(input) {
      const item = this.#normalizeOne(input);
      const existing = this.items.findIndex((entry) => entry.id === item.id);
      this.#commit(existing >= 0
        ? this.items.map((entry, index) => index === existing ? item : entry)
        : [item, ...this.items]);
      this.#emit("added", { item });
      return item;
    }

    remove(id) {
      const next = this.items.filter((item) => item.id !== String(id));
      if (next.length === this.items.length) return false;
      this.#commit(next);
      this.#emit("removed", { id });
      return true;
    }

    clear() {
      if (!this.items.length) return 0;
      const count = this.items.length;
      this.#commit([]);
      this.#emit("cleared", { count });
      return count;
    }

    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("User preset listeners must be functions.");
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    #normalizeOne(input) {
      if (!input || typeof input !== "object" || !String(input.id || "").trim()) {
        throw new TypeError("User presets require an id.");
      }
      const modules = normalizeModules(input.modules);
      if (!modules.order.length && !Object.keys(modules.enabled).length) {
        throw new TypeError("User presets require modules with order or enabled.");
      }
      // pref.* 运行时占位符的取值（聚焦/称呼/避开等），跨模块存顶层。见 preset-content PREF_PLACEHOLDERS。
      const preferences = {};
      if (input.preferences && typeof input.preferences === "object") {
        Object.keys(input.preferences).forEach((key) => {
          const v = input.preferences[key];
          if (typeof v === "string" && v.trim()) preferences[key] = v.trim();
        });
      }
      return {
        id: String(input.id),
        name: String(input.name || input.id),
        version: Number.isFinite(input.version) ? Number(input.version) : 1,
        modules,
        preferences,
        custom: (input.custom && typeof input.custom === "object")
          ? { instructions: (typeof input.custom.instructions === "string") ? input.custom.instructions : null }
          : { instructions: null },
        // 用户对互斥冲突显式点过「不更改继续」的组集合，授权后不再提示。见 preset-validate。
        acceptedConflicts: Array.isArray(input.acceptedConflicts)
          ? input.acceptedConflicts.map(String).filter(Boolean)
          : [],
        compatibility: input.compatibility && typeof input.compatibility === "object"
          ? clonePreset(input.compatibility)
          : undefined,
        createdAt: Number(input.createdAt) || Date.now(),
      };
    }

    #normalizeAll(value) {
      if (!Array.isArray(value)) return [];
      return value.map((entry) => {
        try { return Object.freeze(this.#normalizeOne(entry)); }
        catch { return null; } // 个别坏条目丢弃，但整表不因一处坏而全丢
      }).filter(Boolean);
    }

    #load() {
      const raw = this.storage?.getItem?.(this.storageKey);
      if (raw == null) return Object.freeze([]);
      try {
        const value = JSON.parse(raw);
        return Object.freeze(this.#normalizeAll(value));
      } catch {
        // 坑1：整表 JSON 损坏时留存原文，返回空，但不覆盖写回。
        this._corrupt = raw;
        return Object.freeze([]);
      }
    }

    // 坑3：所有写操作收敛到这。存数组 + 落盘 + 记录写错误（不吞死）。
    #commit(next) {
      this.items = Object.freeze(next.map((entry) => Object.freeze(entry)));
      try {
        this.storage?.setItem?.(this.storageKey, JSON.stringify(this.items));
        this._lastWriteError = null;
      } catch (error) {
        this._lastWriteError = error;
      }
    }

    #emit(type, detail) {
      const event = Object.freeze({ type, ...detail });
      this.listeners.forEach((listener) => listener(event, this.items));
    }
  }

  global.MercuryUserPresetStore = MercuryUserPresetStore;
})(typeof window !== "undefined" ? window : globalThis);
