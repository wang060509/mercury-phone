(function exposeMercuryVectorMemoryStore(global) {
  "use strict";

  const contracts = () => global.MercuryVectorMemoryContracts;

  class VectorMemoryStorageError extends Error {
    constructor(message) { super(message); this.name = "VectorMemoryStorageError"; }
  }

  class MercuryVectorMemoryStore {
    constructor(options = {}) {
      this.indexedDB = options.indexedDB || global.indexedDB || null;
      this.databaseName = options.databaseName || contracts()?.DB_NAME || "mercury-vector-memory";
      this.version = options.version || contracts()?.DB_VERSION || 1;
      this.db = null;
    }

    isAvailable() { return Boolean(this.indexedDB && typeof this.indexedDB.open === "function"); }

    async open() {
      if (this.db) return this.db;
      if (!this.isAvailable()) throw new VectorMemoryStorageError("IndexedDB is unavailable in this browser.");
      const c = contracts();
      if (!c) throw new VectorMemoryStorageError("Vector memory contracts are unavailable.");
      this.db = await new Promise((resolve, reject) => {
        const request = this.indexedDB.open(this.databaseName, this.version);
        request.onerror = () => reject(new VectorMemoryStorageError("Unable to open local vector memory."));
        request.onupgradeneeded = (event) => {
          const database = request.result;
          if (!database.objectStoreNames.contains(c.STORE_ENTRIES)) {
            const entries = database.createObjectStore(c.STORE_ENTRIES, { keyPath: "id" });
            entries.createIndex("scopeKey", "scopeKey", { unique: false });
            entries.createIndex("sourceId", "source.id", { unique: false });
            entries.createIndex("updatedAt", "updatedAt", { unique: false });
          }
          if (!database.objectStoreNames.contains(c.STORE_META)) database.createObjectStore(c.STORE_META, { keyPath: "key" });
          // V1 entries were only rebuildable derived indexes and used a two-part scope key.
          // Clear them during the V2 scope migration rather than risking cross-variant recall.
          if (event.oldVersion > 0 && database.objectStoreNames.contains(c.STORE_ENTRIES)) request.transaction.objectStore(c.STORE_ENTRIES).clear();
        };
        request.onsuccess = () => {
          const database = request.result;
          database.onversionchange = () => { database.close(); if (this.db === database) this.db = null; };
          resolve(database);
        };
      });
      return this.db;
    }

    async transaction(storeName, mode, action) {
      const database = await this.open();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        let result;
        transaction.onerror = () => reject(new VectorMemoryStorageError("Local vector memory transaction failed."));
        transaction.onabort = () => reject(new VectorMemoryStorageError("Local vector memory transaction was aborted."));
        transaction.oncomplete = () => resolve(result);
        try { result = action(store); } catch (error) { transaction.abort(); reject(error); }
      });
    }

    async put(entry) {
      const normalized = contracts()?.normalizeEntry(entry);
      if (!normalized) throw new TypeError("Invalid vector memory entry.");
      await this.transaction(contracts().STORE_ENTRIES, "readwrite", (store) => store.put(normalized));
      return normalized;
    }

    async get(id) {
      if (!id) return null;
      const database = await this.open(); const c = contracts();
      return new Promise((resolve, reject) => {
        const request = database.transaction(c.STORE_ENTRIES, "readonly").objectStore(c.STORE_ENTRIES).get(String(id));
        request.onerror = () => reject(new VectorMemoryStorageError("Unable to read local vector memory."));
        request.onsuccess = () => resolve(c.normalizeEntry(request.result));
      });
    }

    async list(scope) {
      const c = contracts(); const normalizedScope = c?.normalizeScope(scope);
      if (!normalizedScope) return [];
      const database = await this.open();
      return new Promise((resolve, reject) => {
        const request = database.transaction(c.STORE_ENTRIES, "readonly").objectStore(c.STORE_ENTRIES).index("scopeKey").getAll(c.scopeKey(normalizedScope));
        request.onerror = () => reject(new VectorMemoryStorageError("Unable to list local vector memory."));
        request.onsuccess = () => resolve((request.result || []).map(c.normalizeEntry).filter(Boolean));
      });
    }

    async remove(id) {
      if (!id) return false;
      await this.transaction(contracts().STORE_ENTRIES, "readwrite", (store) => store.delete(String(id)));
      return true;
    }

    async clear(scope) {
      const entries = await this.list(scope);
      if (!entries.length) return 0;
      const c = contracts();
      await this.transaction(c.STORE_ENTRIES, "readwrite", (store) => entries.forEach((entry) => store.delete(entry.id)));
      return entries.length;
    }

    async upsertConfirmedRecord(record, scope) {
      const entry = contracts()?.entryFromConfirmedRecord(record, scope);
      if (!entry) return null;
      const existing = await this.get(entry.id);
      if (existing?.embedding && existing.content === entry.content && existing.embedding.modelId === entry.embedding?.modelId) entry.embedding = existing.embedding;
      if (existing?.embedding && existing.content === entry.content && !entry.embedding) entry.embedding = existing.embedding;
      entry.embeddingState = entry.embedding ? "ready" : "pending";
      return this.put(entry);
    }

    async removeSource(scope, sourceType, sourceId) {
      if (!sourceType || !sourceId) return 0;
      const entries = await this.list(scope);
      const matches = entries.filter((entry) => entry.source.type === sourceType && entry.source.id === String(sourceId));
      if (!matches.length) return 0;
      await this.transaction(contracts().STORE_ENTRIES, "readwrite", (store) => matches.forEach((entry) => store.delete(entry.id)));
      return matches.length;
    }

    async setMeta(key, value) {
      if (!key) throw new TypeError("Vector memory metadata requires a key.");
      await this.transaction(contracts().STORE_META, "readwrite", (store) => store.put({ key: String(key), value, updatedAt: new Date().toISOString() }));
      return value;
    }

    async getMeta(key, fallback = null) {
      if (!key) return fallback;
      const database = await this.open(); const c = contracts();
      return new Promise((resolve, reject) => {
        const request = database.transaction(c.STORE_META, "readonly").objectStore(c.STORE_META).get(String(key));
        request.onerror = () => reject(new VectorMemoryStorageError("Unable to read vector memory metadata."));
        request.onsuccess = () => resolve(request.result?.value ?? fallback);
      });
    }

    async exportScope(scope, options = {}) {
      const entries = await this.list(scope);
      const includeVectors = options.includeVectors === true;
      return {
        schemaVersion: contracts().SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        scope: contracts().normalizeScope(scope),
        entries: entries.map((entry) => includeVectors ? entry : { ...entry, embedding: null, embeddingState: entry.embedding ? "pending" : entry.embeddingState }),
      };
    }

    close() { if (this.db) this.db.close(); this.db = null; }
  }

  global.MercuryVectorMemoryStore = Object.freeze({ MercuryVectorMemoryStore, VectorMemoryStorageError });
  if (typeof module !== "undefined" && module.exports) module.exports = global.MercuryVectorMemoryStore;
})(typeof window !== "undefined" ? window : globalThis);
