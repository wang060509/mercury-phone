(function exposeMercuryGenerationProfileStore(global) {
  "use strict";

  const contracts = global.MercuryGenerationProfileContracts || null;
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

  class MercuryGenerationProfileStore {
    constructor(options = {}) {
      if (!contracts) throw new Error("Generation Profile contracts are unavailable.");
      this.storage = options.storage || null;
      this.listeners = new Set();
      this._lastWriteError = null;
      this._migratedInMemory = false;
      this.state = this.#loadOrMigrate(options.now);
    }

    get lastWriteError() { return this._lastWriteError; }
    get migration() { return clone(this.state.migration); }
    get migratedInMemory() { return this._migratedInMemory; }
    get defaultProfile() { return clone(contracts.BUILTIN_PROFILES[0] || null); }

    list() {
      return [...contracts.BUILTIN_PROFILES.map(clone), ...this.state.profiles.map(clone)];
    }

    listPersisted() { return this.state.profiles.map(clone); }

    reload() {
      const stored = this.storage?.get?.(contracts.STORAGE_KEY, null);
      if (stored && typeof stored === "object" && stored.schemaVersion === contracts.SCHEMA_VERSION) this.state = contracts.normalizeStore(stored);
      return this.list();
    }

    get(id) {
      if (id == null) return this.defaultProfile;
      const key = String(id);
      const builtin = contracts.BUILTIN_PROFILES.find((profile) => profile.id === key);
      if (builtin) return clone(builtin);
      const profile = this.state.profiles.find((item) => item.id === key);
      return profile ? clone(profile) : null;
    }

    add(input) {
      if (contracts.isReservedId(input?.id)) throw new Error(`Built-in Generation Profile "${input.id}" is read-only. Use Remix to create an editable copy.`);
      const carriesLegacyModuleText = input?.modules?.texts && typeof input.modules.texts === "object" && Object.keys(input.modules.texts).length > 0;
      const migratedInput = carriesLegacyModuleText && !Array.isArray(input.instructionBlocks)
        ? contracts.migrateLegacySources({ legacyUserPresets: [input], archiveState: null }).profiles[0]
        : null;
      const normalized = migratedInput
        ? contracts.normalizeProfile({ ...migratedInput, origin: input.origin || migratedInput.origin, creationMode: input.creationMode || migratedInput.creationMode, provenance: input.provenance || migratedInput.provenance, cover: input.cover || migratedInput.cover })
        : contracts.normalizeProfile(input);
      if (!normalized) throw new TypeError("Generation Profiles require an id.");
      const index = this.state.profiles.findIndex((profile) => profile.id === normalized.id);
      const profiles = index >= 0
        ? this.state.profiles.map((profile, profileIndex) => profileIndex === index ? { ...normalized, updatedAt: Date.now() } : profile)
        : [{ ...normalized, updatedAt: normalized.updatedAt || Date.now() }, ...this.state.profiles];
      this.#commit({ ...this.state, profiles });
      const item = this.get(normalized.id);
      this.#emit(index >= 0 ? "updated" : "added", { item });
      return item;
    }

    importProfile(input) {
      const requested = String(input?.id || "profile-imported").trim() || "profile-imported";
      const base = contracts.isReservedId(requested) ? `profile-imported-${requested}` : requested;
      let id = base;
      let suffix = 2;
      while (this.get(id)) id = `${base}-${suffix++}`;
      return this.add({ ...input, id, origin: "imported", creationMode: "import" });
    }

    remove(id) {
      if (contracts.isReservedId(id)) return false;
      const profiles = this.state.profiles.filter((profile) => profile.id !== String(id));
      if (profiles.length === this.state.profiles.length) return false;
      this.#commit({ ...this.state, profiles });
      this.#emit("removed", { id: String(id) });
      return true;
    }

    clear() {
      if (!this.state.profiles.length) return 0;
      const count = this.state.profiles.length;
      this.#commit({ ...this.state, profiles: [] });
      this.#emit("cleared", { count });
      return count;
    }

    remix(id, input = {}) {
      const source = this.get(id);
      if (!source) return null;
      const name = String(input.name || `${source.name} Remix`).trim();
      const requestedId = String(input.id || `profile-${name.replace(/[^\w\u4e00-\u9fa5-]/g, "").slice(0, 24) || "remix"}-${Date.now().toString(36)}`);
      return this.add({
        ...source,
        ...input,
        id: requestedId,
        name,
        origin: "user",
        creationMode: "remix",
        remixOf: source.id,
        readOnly: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("Generation Profile listeners must be functions.");
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    #loadOrMigrate(timestamp) {
      const stored = this.storage?.get?.(contracts.STORAGE_KEY, null);
      if (stored && typeof stored === "object" && stored.schemaVersion === contracts.SCHEMA_VERSION) {
        const normalized = contracts.normalizeStore(stored);
        if (contracts.needsCompatibilityUpgrade?.(stored)) {
          try {
            this.storage?.set?.(contracts.STORAGE_KEY, normalized);
            this._lastWriteError = null;
          } catch (error) {
            this._lastWriteError = error;
            this._migratedInMemory = true;
          }
        }
        return normalized;
      }
      const migrated = contracts.migrateLegacySources({
        legacyUserPresets: this.storage?.get?.(contracts.LEGACY_USER_PRESET_KEY, null),
        archiveState: this.storage?.get?.(contracts.ARCHIVE_STORAGE_KEY, null),
        now: timestamp,
      });
      try {
        this.storage?.set?.(contracts.STORAGE_KEY, migrated);
        this._lastWriteError = null;
      } catch (error) {
        this._lastWriteError = error;
        this._migratedInMemory = true;
      }
      return migrated;
    }

    #commit(next) {
      const normalized = contracts.normalizeStore(next);
      try {
        this.storage?.set?.(contracts.STORAGE_KEY, normalized);
        this._lastWriteError = null;
      } catch (error) {
        this._lastWriteError = error;
        throw Object.assign(new Error("Failed to write Generation Profile data."), { code: "GENERATION_PROFILE_STORAGE_WRITE_FAILED", cause: error });
      }
      this.state = normalized;
    }

    #emit(type, detail) {
      const event = Object.freeze({ type, ...detail });
      this.listeners.forEach((listener) => listener(event, this.list()));
    }
  }

  global.MercuryGenerationProfileStore = MercuryGenerationProfileStore;
  if (typeof module !== "undefined" && module.exports) module.exports = MercuryGenerationProfileStore;
})(typeof window !== "undefined" ? window : globalThis);
