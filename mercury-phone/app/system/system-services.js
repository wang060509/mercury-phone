(function exposeMercurySystemServices(global) {
  "use strict";

  const THEMES = new Set(["system", "light", "dark"]);

  class MemoryStorage {
    constructor() { this.values = new Map(); }
    getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
    setItem(key, value) { this.values.set(key, String(value)); }
    removeItem(key) { this.values.delete(key); }
    key(index) { return [...this.values.keys()][index] ?? null; }
    get length() { return this.values.size; }
  }

  const SESSION_CONNECTION_KEY = "mercury.session.settings.connection";

  class MercurySessionCredentialStore {
    constructor(options = {}) {
      this.storage = options.storage || this.#resolveStorage();
      this.key = options.key || SESSION_CONNECTION_KEY;
    }

    get() {
      let raw;
      try { raw = this.storage.getItem(this.key); } catch (_) { return null; }
      if (raw === null) return null;
      let parsed;
      try { parsed = JSON.parse(raw); } catch (_) { return null; }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      return Object.freeze({
        provider: typeof parsed.provider === "string" && parsed.provider.trim() ? parsed.provider.trim().toLowerCase() : "openai-compatible",
        baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl.trim() : "",
        apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
        model: typeof parsed.model === "string" ? parsed.model.trim() : "",
      });
    }

    set(connection = {}) {
      if (!connection || typeof connection !== "object" || Array.isArray(connection)) throw new TypeError("Session credentials require a connection object.");
      const value = {
        provider: typeof connection.provider === "string" && connection.provider.trim() ? connection.provider.trim().toLowerCase() : "openai-compatible",
        baseUrl: typeof connection.baseUrl === "string" ? connection.baseUrl.trim() : "",
        apiKey: typeof connection.apiKey === "string" ? connection.apiKey : "",
        model: typeof connection.model === "string" ? connection.model.trim() : "",
      };
      this.storage.setItem(this.key, JSON.stringify(value));
      return Object.freeze({ ...value });
    }

    clear() {
      this.storage.removeItem(this.key);
    }

    #resolveStorage() {
      try {
        const candidate = global.sessionStorage;
        const probe = "__mercury_session_credential_probe__";
        candidate.setItem(probe, "1");
        candidate.removeItem(probe);
        return candidate;
      } catch { return new MemoryStorage(); }
    }
  }

  class MercurySystemServices {
    constructor(options = {}) {
      const resolvedStorage = options.storage
        ? { storage: options.storage, mode: options.storageMode === "volatile" ? "volatile" : "persistent", reason: options.storageModeReason || null }
        : this.#resolveStorage();
      this.storageBackend = resolvedStorage.storage;
      this.storageMode = resolvedStorage.mode;
      this.storageModeReason = resolvedStorage.reason;
      this.prefix = options.storagePrefix || "mercury.app";
      this.sessionCredentials = options.sessionCredentials || new MercurySessionCredentialStore({ storage: options.sessionStorage });
      this.localDataVault = options.localDataVault || (global.MercuryLocalDataVault ? new global.MercuryLocalDataVault({
        storage: this.storageBackend,
        mode: this.storageMode,
        modeReason: this.storageModeReason,
        storageInfo: options.storageInfo,
        indexedDB: options.indexedDB,
        cacheStorage: options.cacheStorage,
      }) : null);
      this.aiTransport = options.aiTransport || null;
      this.theme = "system";
      this.activities = new Map();
      this.listeners = new Set();
      this.notificationSequence = 0;
      this.activitySequence = 0;
      // A launch bridge installed by the shell owner. Apps request to open
      // another registered app through this facade; the shell owns the actual
      // state-machine transition so an app never drives navigation itself.
      this.launchBridge = options.launchBridge || null;
      this.homeBridge = options.homeBridge || null;
    }

    createAppServices(appId) {
      this.#assertToken(appId, "app id");
      return Object.freeze({
        notify: (notification) => this.#notify(appId, notification),
        storage: Object.freeze({
          get: (key, fallback = null) => this.#storageGet(appId, key, fallback),
          set: (key, value) => this.#storageSet(appId, key, value),
          remove: (key) => this.#storageRemove(appId, key),
          clear: () => this.#storageClear(appId),
        }),
        // Cross-app data lives behind an explicit shared boundary. Apps keep
        // private drafts in `storage` and only publish durable user data here.
        sharedStorage: Object.freeze({
          get: (key, fallback = null) => this.#sharedStorageGet(key, fallback),
          set: (key, value) => this.#sharedStorageSet(key, value),
          remove: (key) => this.#sharedStorageRemove(key),
        }),
        sessionCredentials: appId === "settings" ? Object.freeze({
          get: () => this.sessionCredentials.get(),
          set: (connection) => this.sessionCredentials.set(connection),
          clear: () => this.sessionCredentials.clear(),
        }) : null,
        localData: appId === "settings" && this.localDataVault ? Object.freeze({
          snapshot: () => this.localDataVault.snapshot(),
          createBackup: () => this.localDataVault.createBackup(),
        }) : null,
        aiTransport: this.aiTransport,
        launchApp: (targetAppId, route = null) => this.#launchApp(appId, targetAppId, route),
        requestHome: () => this.#requestHome(appId),
        theme: Object.freeze({
          get: () => this.theme,
          request: (theme) => this.#requestTheme(appId, theme),
        }),
        dynamicIsland: Object.freeze({
          set: (activity) => this.#setActivity(appId, activity),
          clear: () => this.#clearActivity(appId),
        }),
      });
    }

    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("System Service listeners must be functions.");
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    getActivity(appId) { return this.activities.get(appId) || null; }

    listActivities() {
      return Object.freeze([...this.activities.values()].sort((a, b) => (b.priority - a.priority) || (b.sequence - a.sequence)));
    }

    getPreferredActivity() { return this.listActivities()[0] || null; }

    #notify(appId, notification) {
      if (!notification || typeof notification !== "object" || !notification.title) throw new TypeError("Notifications require a title.");
      const value = Object.freeze({ id: notification.id || `${appId}:notification:${++this.notificationSequence}`, appId, title: String(notification.title), body: notification.body ? String(notification.body) : "", createdAt: Date.now() });
      this.#emit("notification:requested", { notification: value });
      return value;
    }

    #requestTheme(appId, theme) {
      if (!THEMES.has(theme)) throw new TypeError(`Unsupported theme: ${theme}`);
      this.theme = theme;
      this.#emit("theme:requested", { appId, theme });
      return theme;
    }

    #setActivity(appId, activity) {
      if (!activity || typeof activity !== "object" || !activity.title) throw new TypeError("Dynamic Island activities require a title.");
      const value = Object.freeze({
        ...activity,
        appId,
        kind: activity.kind || "status",
        title: String(activity.title),
        detail: activity.detail ? String(activity.detail) : "",
        priority: Number.isFinite(activity.priority) ? Number(activity.priority) : 0,
        updatedAt: Date.now(),
        sequence: ++this.activitySequence,
      });
      this.activities.set(appId, value);
      this.#emit("island:set", { appId, activity: value });
      return value;
    }

    #clearActivity(appId) {
      const removed = this.activities.delete(appId);
      if (removed) this.#emit("island:clear", { appId });
      return removed;
    }

    #storageGet(appId, key, fallback) {
      const raw = this.storageBackend.getItem(this.#key(appId, key));
      if (raw === null) return fallback;
      try { return JSON.parse(raw); } catch { return fallback; }
    }

    #storageSet(appId, key, value) {
      if (value === undefined) throw new TypeError("Storage cannot persist undefined.");
      this.storageBackend.setItem(this.#key(appId, key), JSON.stringify(value));
      return value;
    }

    #storageRemove(appId, key) { this.storageBackend.removeItem(this.#key(appId, key)); }

    #storageClear(appId) {
      const prefix = `${this.prefix}.${appId}.`;
      const keys = [];
      for (let index = 0; index < this.storageBackend.length; index += 1) {
        const key = this.storageBackend.key(index);
        if (key?.startsWith(prefix)) keys.push(key);
      }
      keys.forEach((key) => this.storageBackend.removeItem(key));
      return keys.length;
    }

    #sharedStorageGet(key, fallback) {
      this.#assertToken(key, "shared storage key");
      const sharedKey = this.#sharedKey(key);
      let raw = this.storageBackend.getItem(sharedKey);
      // Preserve data created before the shared boundary existed. The first
      // write after a read moves it to the canonical shared namespace.
      if (raw === null && key === "archive.v1") raw = this.storageBackend.getItem(this.#key("archive", key));
      if (raw === null && key === "chat-experience.v1") raw = this.storageBackend.getItem(this.#key("mercury-chat", key));
      // Generation Profile migration may read the former Chat-owned preset
      // value once. The new store never writes this legacy key.
      if (raw === null && key === "mercury.apps.chats.userPresets") raw = this.storageBackend.getItem(this.#key("mercury-chat", key));
      if (raw === null) return fallback;
      try { return JSON.parse(raw); } catch { return fallback; }
    }

    #sharedStorageSet(key, value) {
      if (value === undefined) throw new TypeError("Shared storage cannot persist undefined.");
      this.#assertToken(key, "shared storage key");
      this.storageBackend.setItem(this.#sharedKey(key), JSON.stringify(value));
      return value;
    }

    #sharedStorageRemove(key) {
      this.#assertToken(key, "shared storage key");
      this.storageBackend.removeItem(this.#sharedKey(key));
    }

    #sharedKey(key) {
      return `${this.prefix}.shared.${key}`;
    }

    #key(appId, key) {
      this.#assertToken(key, "storage key");
      return `${this.prefix}.${appId}.${key}`;
    }

    #assertToken(value, label) {
      if (typeof value !== "string" || !/^[a-z0-9][a-z0-9._-]*$/i.test(value)) throw new TypeError(`Invalid ${label}.`);
    }

    #launchApp(fromAppId, targetAppId, route) {
      this.#assertToken(targetAppId, "app id");
      if (route !== null && typeof route !== "string") throw new TypeError("Launch route must be text or null.");
      if (typeof this.launchBridge !== "function") return false;
      this.#emit("launch:requested", { fromAppId, targetAppId, route });
      return this.launchBridge(targetAppId, route);
    }

    #requestHome(fromAppId) {
      if (typeof this.homeBridge !== "function") return false;
      this.#emit("home:requested", { fromAppId });
      return this.homeBridge(fromAppId);
    }

    #resolveStorage() {
      try {
        const candidate = global.localStorage;
        const probe = "__mercury_storage_probe__";
        candidate.setItem(probe, "1");
        candidate.removeItem(probe);
        return { storage: candidate, mode: "persistent", reason: null };
      } catch (error) {
        return { storage: new MemoryStorage(), mode: "volatile", reason: typeof error?.name === "string" ? error.name : "storage-unavailable" };
      }
    }

    #emit(type, detail) {
      const event = Object.freeze({ type, ...detail });
      this.listeners.forEach((listener) => listener(event));
    }
  }

  global.MercurySessionCredentialStore = MercurySessionCredentialStore;
  global.MercurySystemServices = MercurySystemServices;
})(window);
