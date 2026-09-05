(function exposeMercuryNotificationStore(global) {
  "use strict";

  const DEFAULT_STORAGE_KEY = "mercury.system.notifications";

  class MercuryNotificationStore {
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

    add(input) {
      const item = this.#normalizeOne(input);
      const existing = this.items.findIndex((entry) => entry.id === item.id);
      this.#commit(existing >= 0
        ? this.items.map((entry, index) => index === existing ? item : entry)
        : [item, ...this.items]);
      this.#emit("added", { item });
      return item;
    }

    list() { return this.items; }

    remove(id) {
      const next = this.items.filter((item) => item.id !== id);
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
      if (typeof listener !== "function") throw new TypeError("Notification listeners must be functions.");
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    // 统一 schema：所有新/旧条目都过这道，补默认 + 强转类型，坏字段不许进 store。见 §2坑4。
    #normalizeOne(input) {
      if (!input || typeof input !== "object" || !String(input.body || "").trim()) throw new TypeError("Notifications require a body.");
      return {
        id: input.id || `notification:${Date.now()}:${++this.sequence}`,
        kind: input.kind || "note",
        appId: input.appId || "mercury-system",
        senderId: input.senderId || null,
        conversationId: input.conversationId || null,
        title: String(input.title || "Mercury"),
        body: String(input.body).trim(),
        createdAt: Number(input.createdAt) || Date.now(),
        unread: input.unread !== false,
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
        // 坑1：整表 JSON 损坏时留存原文，返回空，但不覆盖写回，避免把好数据抹掉。
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

  global.MercuryNotificationStore = MercuryNotificationStore;
})(window);
