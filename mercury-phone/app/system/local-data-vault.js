(function exposeMercuryLocalDataVault(global) {
  "use strict";

  const BACKUP_FORMAT = "mercury-phone-backup";
  const BACKUP_VERSION = 1;
  const MERCURY_KEY_PREFIX = "mercury.";

  const source = (definition) => Object.freeze(definition);
  const DATA_SOURCES = Object.freeze([
    source({ id: "archive", domain: "library", label: "Archive", storage: "localStorage", policy: "include", exact: ["mercury.app.shared.archive.v1", "mercury.app.archive.archive.v1"] }),
    source({ id: "generation-profiles", domain: "library", label: "Generation Profiles", storage: "localStorage", policy: "include", exact: ["mercury.app.shared.generation-profiles.v1"] }),
    source({ id: "legacy-generation-profiles", domain: "library", label: "Legacy Generation Profiles", storage: "localStorage", policy: "include", exact: ["mercury.app.mercury-chat.mercury.apps.chats.userPresets", "mercury.apps.chats.userPresets"], legacy: true }),
    source({ id: "chat-experience", domain: "chat", label: "Chat Experience", storage: "localStorage", policy: "include", exact: ["mercury.app.shared.chat-experience.v1", "mercury.app.mercury-chat.chat-experience.v1"] }),
    source({ id: "conversations", domain: "chat", label: "Conversations", storage: "localStorage", policy: "include", prefixes: ["mercury.app.mercury-chat.conversation."] }),
    source({ id: "relationship-events", domain: "memory", label: "Relationship Events", storage: "localStorage", policy: "include", exact: ["mercury.app.shared.relationship-records.v1"] }),
    source({ id: "notifications", domain: "system", label: "Notifications", storage: "localStorage", policy: "include", exact: ["mercury.system.notifications"] }),
    source({ id: "connection-preferences", domain: "settings", label: "Connection Preferences", storage: "localStorage", policy: "redact", exact: ["mercury.app.settings.connection"], redact: redactConnection }),
    source({ id: "device-lock", domain: "device", label: "Device Lock", storage: "localStorage", policy: "exclude", exact: ["mercury.system.lock"], reason: "device-only-secret" }),
    source({ id: "session-credentials", domain: "settings", label: "Session Credentials", storage: "sessionStorage", policy: "exclude", virtual: true, reason: "credential" }),
    source({ id: "vector-index", domain: "memory", label: "Vector Memory Index", storage: "indexedDB", policy: "exclude", virtual: true, derived: true, reason: "rebuildable" }),
    source({ id: "embedding-cache", domain: "memory", label: "Embedding Model Cache", storage: "browser-cache", policy: "exclude", virtual: true, derived: true, reason: "rebuildable" }),
  ]);

  function redactConnection(raw) {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new TypeError("Connection preferences are invalid.");
    return JSON.stringify({ ...parsed, apiKey: "", rememberApiKey: false, lastTest: "idle" });
  }

  function byteLength(value) {
    const text = String(value ?? "");
    if (typeof global.TextEncoder === "function") return new global.TextEncoder().encode(text).byteLength;
    if (typeof Buffer !== "undefined") return Buffer.byteLength(text, "utf8");
    return unescape(encodeURIComponent(text)).length;
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.keys(value).forEach((key) => deepFreeze(value[key]));
    return Object.freeze(value);
  }

  function matches(definition, key) {
    return definition.exact?.includes(key)
      || definition.prefixes?.some((prefix) => key.startsWith(prefix));
  }

  function safeError(error) {
    return Object.freeze({
      name: typeof error?.name === "string" ? error.name : "StorageError",
      message: typeof error?.message === "string" ? error.message : "Browser storage is unavailable.",
    });
  }

  class MercuryLocalDataVault {
    constructor(options = {}) {
      if (!options.storage || typeof options.storage.getItem !== "function" || typeof options.storage.setItem !== "function" || typeof options.storage.removeItem !== "function") {
        throw new TypeError("Local Data Vault requires a Storage Adapter.");
      }
      this.storage = options.storage;
      this.mode = options.mode === "volatile" ? "volatile" : "persistent";
      this.modeReason = options.modeReason || null;
      this.storageInfo = typeof options.storageInfo === "function" ? options.storageInfo : () => this.defaultStorageInfo();
      this.indexedDB = options.indexedDB === undefined ? global.indexedDB : options.indexedDB;
      this.cacheStorage = options.cacheStorage === undefined ? global.caches : options.cacheStorage;
      this.now = typeof options.now === "function" ? options.now : () => new Date();
      this.probeSequence = 0;
    }

    async snapshot() {
      const scan = this.scan();
      const probe = this.probe();
      const warnings = [...scan.warnings];
      if (probe.error) warnings.push(Object.freeze({ code: "storage-write-failed", sourceId: null, error: probe.error }));
      let estimate = { usage: null, quota: null, persisted: null };
      try {
        const value = await this.storageInfo();
        estimate = {
          usage: Number.isFinite(value?.usage) ? Number(value.usage) : null,
          quota: Number.isFinite(value?.quota) ? Number(value.quota) : null,
          persisted: typeof value?.persisted === "boolean" ? value.persisted : null,
        };
      } catch (error) {
        warnings.push(Object.freeze({ code: "storage-estimate-unavailable", sourceId: null, error: safeError(error) }));
      }
      const status = this.mode === "volatile" ? "volatile" : probe.ok ? "healthy" : "degraded";
      return deepFreeze({
        status,
        mode: this.mode,
        modeReason: this.modeReason,
        writable: probe.ok,
        usage: estimate.usage,
        quota: estimate.quota,
        persisted: estimate.persisted,
        backup: {
          includedRecords: scan.includedRecords,
          includedBytes: scan.includedBytes,
          excludedPresentRecords: scan.excludedPresentRecords,
        },
        sources: scan.sources,
        warnings,
      });
    }

    createBackup() {
      const scan = this.scan({ collectValues: true });
      const datasets = scan.sources
        .filter((item) => item.policy === "include" || item.policy === "redact")
        .map((item) => ({
          id: item.id,
          domain: item.domain,
          policy: item.policy,
          records: item.records.map((record) => ({ key: record.key, value: record.value })),
        }));
      return deepFreeze({
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        createdAt: this.now().toISOString(),
        storageMode: this.mode,
        summary: {
          records: datasets.reduce((total, item) => total + item.records.length, 0),
          bytes: datasets.reduce((total, item) => total + item.records.reduce((sum, record) => sum + byteLength(record.key) + byteLength(record.value), 0), 0),
        },
        datasets,
        exclusions: scan.sources
          .filter((item) => item.policy === "exclude")
          .map((item) => ({ id: item.id, domain: item.domain, storage: item.storage, reason: item.reason, presentRecords: item.recordCount })),
        warnings: scan.warnings,
      });
    }

    scan(options = {}) {
      const collectValues = options.collectValues === true;
      const warnings = [];
      const keys = [];
      try {
        for (let index = 0; index < Number(this.storage.length || 0); index += 1) {
          const key = this.storage.key(index);
          if (typeof key === "string") keys.push(key);
        }
      } catch (error) {
        warnings.push(Object.freeze({ code: "storage-enumeration-failed", sourceId: null, error: safeError(error) }));
      }

      const claimed = new Set();
      const localSources = DATA_SOURCES.filter((definition) => definition.storage === "localStorage").map((definition) => {
        const matchingKeys = keys.filter((key) => matches(definition, key));
        matchingKeys.forEach((key) => claimed.add(key));
        const records = [];
        let bytes = 0;
        matchingKeys.forEach((key) => {
          let raw;
          try { raw = this.storage.getItem(key); }
          catch (error) {
            warnings.push(Object.freeze({ code: "storage-read-failed", sourceId: definition.id, error: safeError(error) }));
            return;
          }
          if (raw === null) return;
          bytes += byteLength(key) + byteLength(raw);
          if (definition.policy === "exclude") return;
          let value = raw;
          if (definition.policy === "redact") {
            try { value = definition.redact(raw); }
            catch (error) {
              warnings.push(Object.freeze({ code: "backup-redaction-failed", sourceId: definition.id, error: Object.freeze({ name: "RedactionError", message: "Sensitive settings could not be safely exported." }) }));
              return;
            }
          }
          records.push({ key, value });
        });
        const backupBytes = records.reduce((total, record) => total + byteLength(record.key) + byteLength(record.value), 0);
        return this.sourceSnapshot(definition, matchingKeys.length, bytes, collectValues ? records : [], true, records.length, backupBytes);
      });

      const unknownKeys = keys.filter((key) => key.startsWith(MERCURY_KEY_PREFIX) && !claimed.has(key));
      const unknownBytes = unknownKeys.reduce((total, key) => {
        try { return total + byteLength(key) + byteLength(this.storage.getItem(key) || ""); }
        catch (_) { return total + byteLength(key); }
      }, 0);
      if (unknownKeys.length) warnings.push(Object.freeze({ code: "unclassified-local-data", sourceId: "unclassified", count: unknownKeys.length }));

      const virtualSources = DATA_SOURCES.filter((definition) => definition.virtual).map((definition) => {
        let available = null;
        if (definition.storage === "indexedDB") available = Boolean(this.indexedDB && typeof this.indexedDB.open === "function");
        if (definition.storage === "browser-cache") available = Boolean(this.cacheStorage && typeof this.cacheStorage.open === "function");
        return this.sourceSnapshot(definition, 0, 0, [], available, 0, 0);
      });
      const unclassified = deepFreeze({
        id: "unclassified",
        domain: "system",
        label: "Unclassified Mercury Data",
        storage: "localStorage",
        policy: "exclude",
        reason: "unclassified",
        derived: false,
        legacy: false,
        available: true,
        present: unknownKeys.length > 0,
        recordCount: unknownKeys.length,
        bytes: unknownBytes,
        backupRecordCount: 0,
        backupBytes: 0,
        records: Object.freeze([]),
      });
      const sources = deepFreeze([...localSources, ...virtualSources, unclassified]);
      const included = sources.filter((item) => item.policy === "include" || item.policy === "redact");
      return {
        sources,
        warnings: deepFreeze(warnings),
        includedRecords: included.reduce((total, item) => total + item.backupRecordCount, 0),
        includedBytes: included.reduce((total, item) => total + item.backupBytes, 0),
        excludedPresentRecords: sources.filter((item) => item.policy === "exclude").reduce((total, item) => total + item.recordCount, 0),
      };
    }

    sourceSnapshot(definition, recordCount, bytes, records = [], available = true, backupRecordCount = 0, backupBytes = 0) {
      return deepFreeze({
        id: definition.id,
        domain: definition.domain,
        label: definition.label,
        storage: definition.storage,
        policy: definition.policy,
        reason: definition.reason || null,
        derived: definition.derived === true,
        legacy: definition.legacy === true,
        available,
        present: recordCount > 0,
        recordCount,
        bytes,
        backupRecordCount,
        backupBytes,
        records,
      });
    }

    probe() {
      if (this.mode === "volatile") return { ok: true, error: null };
      const key = `__mercury_local_data_probe_${Date.now()}_${++this.probeSequence}__`;
      try {
        this.storage.setItem(key, "1");
        if (this.storage.getItem(key) !== "1") throw new Error("Browser storage did not preserve the diagnostic write.");
        this.storage.removeItem(key);
        return { ok: true, error: null };
      } catch (error) {
        try { this.storage.removeItem(key); } catch (_) {}
        return { ok: false, error: safeError(error) };
      }
    }

    async defaultStorageInfo() {
      const storage = global.navigator?.storage;
      if (!storage) return {};
      const estimate = typeof storage.estimate === "function" ? await storage.estimate() : {};
      const persisted = typeof storage.persisted === "function" ? await storage.persisted() : undefined;
      return { ...estimate, persisted };
    }
  }

  MercuryLocalDataVault.BACKUP_FORMAT = BACKUP_FORMAT;
  MercuryLocalDataVault.BACKUP_VERSION = BACKUP_VERSION;
  global.MercuryLocalDataVault = MercuryLocalDataVault;
  if (typeof module !== "undefined" && module.exports) module.exports = MercuryLocalDataVault;
})(typeof window !== "undefined" ? window : globalThis);
