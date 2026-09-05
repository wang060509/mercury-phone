(function exposeMercuryCinemaPersistence(global) {
  "use strict";

  const contracts = global.MercuryCinemaContracts
    || (typeof require === "function" ? require("../core/cinema-contracts.js") : null);

  const DATABASE_NAME = "mercury.cinema";
  const DATABASE_VERSION = 1;
  const TARGET_REVISION = 1;
  const AUTHORITY_KEY = "cinema.idb-authority.v1";
  const META_ROOT_KEY = "root";
  const META_MIGRATION_KEY = "migration";
  const INDEX_INSTANCE_ORDINAL = "byInstanceOrdinal";
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

  function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    if (isObject(value)) {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  async function sha256(value) {
    const subtle = global.crypto?.subtle;
    if (!subtle || typeof subtle.digest !== "function") throw Object.assign(new Error("Cinema migration verification requires SHA-256 support."), { code: "CINEMA_DIGEST_UNAVAILABLE" });
    const bytes = new TextEncoder().encode(typeof value === "string" ? value : stableStringify(value));
    const digest = await subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function rootRecord(state) {
    return {
      schemaVersion: state.schemaVersion,
      hasEntered: state.hasEntered === true,
      tutorialSeen: state.tutorialSeen === true,
      focusedInstanceId: state.focusedInstanceId || null,
      draft: clone(state.draft),
      readingSettings: clone(state.readingSettings),
    };
  }

  function splitState(stateValue) {
    const state = clone(stateValue);
    const instances = [];
    const segments = [];
    state.instances.forEach((instance, instanceOrdinal) => {
      const header = clone(instance);
      delete header.segments;
      header.instanceOrdinal = instanceOrdinal;
      instances.push(header);
      instance.segments.forEach((segment, ordinal) => segments.push({ ...clone(segment), instanceId: instance.id, ordinal }));
    });
    return { root: rootRecord(state), instances, segments };
  }

  function joinBundle(bundle, catalog) {
    if (!isObject(bundle?.root)) throw Object.assign(new Error("Cinema IndexedDB root metadata is missing."), { code: "CINEMA_IDB_ROOT_MISSING" });
    const headers = Array.isArray(bundle.instances) ? bundle.instances.slice().sort((a, b) => Number(a.instanceOrdinal) - Number(b.instanceOrdinal)) : [];
    const headerIds = new Set(headers.map((entry) => entry.id));
    const grouped = new Map(headers.map((entry) => [entry.id, []]));
    const segmentIds = new Set();
    (Array.isArray(bundle.segments) ? bundle.segments : []).forEach((segment) => {
      if (!headerIds.has(segment.instanceId)) throw Object.assign(new Error(`Cinema segment ${segment.id || "(missing)"} references an unknown instance.`), { code: "CINEMA_IDB_ORPHAN_SEGMENT" });
      if (segmentIds.has(segment.id)) throw Object.assign(new Error(`Cinema segment ID is duplicated: ${segment.id}`), { code: "CINEMA_IDB_DUPLICATE_SEGMENT" });
      segmentIds.add(segment.id);
      grouped.get(segment.instanceId).push(segment);
    });
    const instances = headers.map((storedHeader) => {
      const header = clone(storedHeader);
      delete header.instanceOrdinal;
      const storedSegments = grouped.get(header.id).slice().sort((a, b) => Number(a.ordinal) - Number(b.ordinal));
      storedSegments.forEach((segment, expectedOrdinal) => {
        if (!Number.isInteger(segment.ordinal) || segment.ordinal !== expectedOrdinal) {
          throw Object.assign(new Error(`Cinema segment ordering is invalid for ${header.id}.`), { code: "CINEMA_IDB_ORDINAL_INVALID", instanceId: header.id });
        }
      });
      const segments = storedSegments.map((storedSegment) => {
        const segment = clone(storedSegment);
        delete segment.instanceId;
        delete segment.ordinal;
        return segment;
      });
      return { ...header, segments };
    });
    return contracts.normalizeState({ ...clone(bundle.root), instances }, catalog);
  }

  async function buildManifest(sourceValue, canonicalState) {
    const source = isObject(sourceValue) ? clone(sourceValue) : {};
    const canonical = contracts.normalizeState(canonicalState);
    const instanceEntries = [];
    for (const instance of canonical.instances) {
      instanceEntries.push({
        id: instance.id,
        status: instance.status,
        sceneCount: instance.scenes.length,
        sceneIds: instance.scenes.map((scene) => scene.id),
        segmentCount: instance.segments.length,
        segments: instance.segments.map((segment, ordinal) => ({ id: segment.id, ordinal })),
        proseDigest: await sha256(instance.segments.map((segment) => segment.text).join("\u001e")),
        snapshotDigest: await sha256({
          stageSnapshot: instance.stageSnapshot,
          scenarioSnapshot: instance.scenarioSnapshot,
          characterSnapshot: instance.characterSnapshot,
          variant: instance.variant,
          generationProfileSnapshot: instance.generationProfileSnapshot,
        }),
      });
    }
    return {
      sourceSchemaVersion: Number(source.schemaVersion) || 1,
      sourceDigest: await sha256(source),
      canonicalDigest: await sha256(canonical),
      instanceCount: canonical.instances.length,
      instanceIds: canonical.instances.map((instance) => instance.id),
      instances: instanceEntries,
    };
  }

  async function verifyMigration(expectedState, actualState, manifest) {
    const expected = contracts.normalizeState(expectedState);
    const actual = contracts.normalizeState(actualState);
    const failures = [];
    const same = (left, right) => stableStringify(left) === stableStringify(right);
    if (!same(rootRecord(expected), rootRecord(actual))) failures.push("root-metadata");
    if (expected.focusedInstanceId !== actual.focusedInstanceId) failures.push("focused-instance");
    if (expected.instances.length !== actual.instances.length) failures.push("instance-count");
    expected.instances.forEach((instance, index) => {
      const restored = actual.instances[index];
      if (!restored || restored.id !== instance.id) { failures.push(`instance:${instance.id}`); return; }
      if (restored.status !== instance.status) failures.push(`status:${instance.id}`);
      ["stageSnapshot", "scenarioSnapshot", "characterSnapshot", "variant", "generationProfileSnapshot", "runtimeProfileHistory", "scenes", "notes"].forEach((key) => {
        if (!same(instance[key], restored[key])) failures.push(`${key}:${instance.id}`);
      });
      if (instance.segments.length !== restored.segments.length) failures.push(`segment-count:${instance.id}`);
      instance.segments.forEach((segment, ordinal) => {
        const restoredSegment = restored.segments[ordinal];
        if (!restoredSegment || restoredSegment.id !== segment.id || !same(segment, restoredSegment)) failures.push(`segment:${instance.id}:${ordinal}`);
      });
    });
    const digest = await sha256(actual);
    if (digest !== manifest.canonicalDigest) failures.push("canonical-digest");
    for (const entry of manifest.instances) {
      const instance = actual.instances.find((item) => item.id === entry.id);
      if (!instance) continue;
      const proseDigest = await sha256(instance.segments.map((segment) => segment.text).join("\u001e"));
      if (proseDigest !== entry.proseDigest) failures.push(`prose-digest:${entry.id}`);
    }
    if (failures.length) {
      throw Object.assign(new Error(`Cinema migration verification failed: ${failures.join(", ")}`), { code: "CINEMA_MIGRATION_VERIFY_FAILED", failures });
    }
    return true;
  }

  async function matchesVerifiedSnapshot(instance, expectedDigest) {
    const profileSnapshots = [
      instance.generationProfileSnapshot,
      ...instance.runtimeProfileHistory.map((entry) => entry?.snapshot),
    ].map((snapshot) => isObject(snapshot) ? snapshot : null)
      .filter((snapshot, index, values) => values.findIndex((candidate) => stableStringify(candidate) === stableStringify(snapshot)) === index);
    for (const generationProfileSnapshot of profileSnapshots) {
      const digest = await sha256({
        stageSnapshot: instance.stageSnapshot,
        scenarioSnapshot: instance.scenarioSnapshot,
        characterSnapshot: instance.characterSnapshot,
        variant: instance.variant,
        generationProfileSnapshot,
      });
      if (digest === expectedDigest) return true;
    }
    return false;
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
      if ("onblocked" in request) request.onblocked = () => reject(Object.assign(new Error("IndexedDB request is blocked by another open connection."), { code: "CINEMA_IDB_BLOCKED" }));
    });
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted."));
      transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed."));
    });
  }

  class MercuryCinemaIndexedDBDatabase {
    constructor(options = {}) {
      this.factory = options.indexedDB || global.indexedDB;
      this.name = options.databaseName || DATABASE_NAME;
      this.version = Number(options.databaseVersion) || DATABASE_VERSION;
      this.database = null;
    }

    async open() {
      if (!this.factory || typeof this.factory.open !== "function") throw Object.assign(new Error("IndexedDB is unavailable."), { code: "CINEMA_IDB_UNAVAILABLE" });
      if (this.database) return this.database;
      const request = this.factory.open(this.name, this.version);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains("meta")) database.createObjectStore("meta", { keyPath: "key" });
        if (!database.objectStoreNames.contains("instances")) database.createObjectStore("instances", { keyPath: "id" });
        if (!database.objectStoreNames.contains("segments")) {
          const segments = database.createObjectStore("segments", { keyPath: "id" });
          segments.createIndex(INDEX_INSTANCE_ORDINAL, ["instanceId", "ordinal"], { unique: true });
        }
      };
      this.database = await requestResult(request);
      this.database.onversionchange = () => { this.database?.close(); this.database = null; };
      return this.database;
    }

    async readBundle() {
      const database = await this.open();
      const transaction = database.transaction(["meta", "instances", "segments"], "readonly");
      const done = transactionDone(transaction);
      const meta = transaction.objectStore("meta");
      const rootRequest = meta.get(META_ROOT_KEY);
      const migrationRequest = meta.get(META_MIGRATION_KEY);
      const instancesRequest = transaction.objectStore("instances").getAll();
      const segmentsRequest = transaction.objectStore("segments").index(INDEX_INSTANCE_ORDINAL).getAll();
      const [root, migration, instances, segments] = await Promise.all([requestResult(rootRequest), requestResult(migrationRequest), requestResult(instancesRequest), requestResult(segmentsRequest)]);
      await done;
      return {
        root: clone(root?.value || null),
        migration: clone(migration?.value || null),
        instances: clone(instances || []),
        segments: clone(segments || []),
      };
    }

    async replaceAll(bundle) {
      const database = await this.open();
      const transaction = database.transaction(["meta", "instances", "segments"], "readwrite");
      const done = transactionDone(transaction);
      const meta = transaction.objectStore("meta");
      const instances = transaction.objectStore("instances");
      const segments = transaction.objectStore("segments");
      meta.clear(); instances.clear(); segments.clear();
      meta.put({ key: META_ROOT_KEY, value: clone(bundle.root) });
      meta.put({ key: META_MIGRATION_KEY, value: clone(bundle.migration) });
      bundle.instances.forEach((record) => instances.put(clone(record)));
      bundle.segments.forEach((record) => segments.put(clone(record)));
      await done;
    }

    async commitChanges(change = {}) {
      const stores = [];
      if (change.root !== undefined || change.migration !== undefined) stores.push("meta");
      if ((change.instancePuts?.length || 0) + (change.instanceDeletes?.length || 0) > 0) stores.push("instances");
      if ((change.segmentPuts?.length || 0) + (change.segmentDeletes?.length || 0) > 0) stores.push("segments");
      if (!stores.length) return;
      const database = await this.open();
      const transaction = database.transaction(stores, "readwrite");
      const done = transactionDone(transaction);
      if (stores.includes("meta")) {
        const meta = transaction.objectStore("meta");
        if (change.root !== undefined) meta.put({ key: META_ROOT_KEY, value: clone(change.root) });
        if (change.migration !== undefined) meta.put({ key: META_MIGRATION_KEY, value: clone(change.migration) });
      }
      if (stores.includes("segments")) {
        const segments = transaction.objectStore("segments");
        (change.segmentDeletes || []).forEach((id) => segments.delete(id));
        (change.segmentPuts || []).forEach((record) => segments.put(clone(record)));
      }
      if (stores.includes("instances")) {
        const instances = transaction.objectStore("instances");
        (change.instanceDeletes || []).forEach((id) => instances.delete(id));
        (change.instancePuts || []).forEach((record) => instances.put(clone(record)));
      }
      await done;
    }
  }

  class MercuryLocalStorageCinemaRepository {
    constructor(storage, key = contracts.STORAGE_KEY) {
      if (!storage || typeof storage.get !== "function" || typeof storage.set !== "function") throw new TypeError("LocalStorageCinemaRepository requires scoped storage.");
      this.storage = storage;
      this.key = key;
    }

    async load(fallback) { return clone(this.storage.get(this.key, fallback)); }
    async save(state) { this.storage.set(this.key, clone(state)); return clone(state); }
  }

  function diffRecords(previousState, nextState) {
    const previous = splitState(previousState);
    const next = splitState(nextState);
    const previousInstances = new Map(previous.instances.map((record) => [record.id, record]));
    const nextInstances = new Map(next.instances.map((record) => [record.id, record]));
    const previousSegments = new Map(previous.segments.map((record) => [record.id, record]));
    const nextSegments = new Map(next.segments.map((record) => [record.id, record]));
    return {
      root: stableStringify(previous.root) === stableStringify(next.root) ? undefined : next.root,
      instancePuts: next.instances.filter((record) => stableStringify(previousInstances.get(record.id)) !== stableStringify(record)),
      instanceDeletes: previous.instances.filter((record) => !nextInstances.has(record.id)).map((record) => record.id),
      segmentPuts: next.segments.filter((record) => stableStringify(previousSegments.get(record.id)) !== stableStringify(record)),
      segmentDeletes: previous.segments.filter((record) => !nextSegments.has(record.id)).map((record) => record.id),
    };
  }

  class MercuryIndexedDBCinemaRepository {
    constructor(options = {}) {
      if (!options.legacyStorage) throw new TypeError("IndexedDBCinemaRepository requires scoped legacy storage.");
      this.legacy = options.legacyRepository || new MercuryLocalStorageCinemaRepository(options.legacyStorage);
      this.markerStorage = options.legacyStorage;
      this.database = options.database || new MercuryCinemaIndexedDBDatabase(options);
      this.catalog = options.catalog || global.MercuryCinemaStageCatalog?.PRODUCTION_STAGE_CATALOG;
      this.mode = "uninitialized";
      this.lastState = null;
    }

    async load(fallback = contracts.createState()) {
      const authority = this.markerStorage.get(AUTHORITY_KEY, null);
      let bundle;
      try {
        bundle = await this.database.readBundle();
      } catch (cause) {
        if (authority) throw Object.assign(new Error("Cinema IndexedDB is authoritative but unavailable; stale legacy data will not be loaded."), { code: "CINEMA_AUTHORITATIVE_IDB_UNAVAILABLE", cause });
        if (cause?.code === "CINEMA_IDB_UNAVAILABLE") {
          const legacyState = await this.legacy.load(fallback);
          this.mode = "legacy";
          this.lastState = contracts.normalizeState(legacyState, this.catalog);
          return clone(this.lastState);
        }
        throw Object.assign(new Error("Cinema IndexedDB could not be inspected safely; legacy data was not loaded as a substitute."), { code: "CINEMA_IDB_INSPECTION_FAILED", cause });
      }

      if (bundle.migration?.state === "complete") {
        const state = joinBundle(bundle, this.catalog);
        await this.#assertCompleteMigration(bundle.migration, state);
        if (authority && (authority.sourceDigest !== bundle.migration.sourceDigest || authority.targetRevision !== bundle.migration.targetRevision)) {
          throw Object.assign(new Error("Cinema authority marker does not match the verified IndexedDB migration."), { code: "CINEMA_AUTHORITY_MISMATCH" });
        }
        this.#writeAuthorityMarker(bundle.migration);
        this.mode = "indexeddb";
        this.lastState = state;
        return clone(state);
      }

      if (authority?.state === "authoritative") {
        throw Object.assign(new Error("Cinema IndexedDB migration metadata is incomplete; stale legacy data will not be loaded."), { code: "CINEMA_AUTHORITATIVE_IDB_INCOMPLETE" });
      }

      const legacyValue = await this.legacy.load(null);
      const source = legacyValue === null ? clone(fallback) : legacyValue;
      const canonical = contracts.normalizeState(source, this.catalog);
      const manifest = await buildManifest(source, canonical);
      const split = splitState(canonical);
      const copying = { state: "copying", targetRevision: TARGET_REVISION, manifest: clone(manifest) };
      let restored;
      try {
        await this.database.replaceAll({ ...split, migration: copying });
        const verifying = { ...copying, state: "verifying" };
        await this.database.commitChanges({ migration: verifying });
        const readBack = await this.database.readBundle();
        restored = joinBundle(readBack, this.catalog);
        await verifyMigration(canonical, restored, manifest);
      } catch (cause) {
        this.mode = "legacy";
        this.lastState = canonical;
        return clone(canonical);
      }

      const complete = { state: "complete", targetRevision: TARGET_REVISION, sourceDigest: manifest.sourceDigest, manifest: clone(manifest), completedAt: new Date().toISOString() };
      this.markerStorage.set(AUTHORITY_KEY, { state: "pending", databaseName: DATABASE_NAME, databaseVersion: DATABASE_VERSION, targetRevision: TARGET_REVISION, sourceDigest: manifest.sourceDigest });
      try {
        await this.database.commitChanges({ migration: complete });
      } catch (cause) {
        this.markerStorage.remove?.(AUTHORITY_KEY);
        this.mode = "legacy";
        this.lastState = canonical;
        return clone(canonical);
      }
      try {
        this.#writeAuthorityMarker(complete);
      } catch (cause) {
        throw Object.assign(new Error("Cinema migration completed in IndexedDB but its authority marker could not be finalized; stale legacy data will not be loaded."), { code: "CINEMA_AUTHORITY_MARKER_FAILED", cause });
      }
      this.mode = "indexeddb";
      this.lastState = restored;
      return clone(restored);
    }

    async save(stateValue) {
      const state = contracts.normalizeState(stateValue, this.catalog);
      if (this.mode === "legacy") {
        await this.legacy.save(state);
        this.lastState = state;
        return clone(state);
      }
      if (this.mode !== "indexeddb" || !this.lastState) throw Object.assign(new Error("Cinema Repository is not ready."), { code: "CINEMA_REPOSITORY_NOT_READY" });
      const changes = diffRecords(this.lastState, state);
      await this.database.commitChanges(changes);
      this.lastState = state;
      return clone(state);
    }

    async #assertCompleteMigration(migration, state) {
      if (migration.targetRevision !== TARGET_REVISION || !migration.sourceDigest || !isObject(migration.manifest) || migration.manifest.sourceDigest !== migration.sourceDigest) {
        throw Object.assign(new Error("Cinema IndexedDB completion marker is invalid."), { code: "CINEMA_IDB_COMPLETE_INVALID" });
      }
      if (migration.manifest.instanceCount > state.instances.length) {
        throw Object.assign(new Error("Cinema IndexedDB contains fewer instances than the verified migration."), { code: "CINEMA_IDB_INSTANCE_LOSS" });
      }
      migration.manifest.instances.forEach((entry) => {
        const instance = state.instances.find((item) => item.id === entry.id);
        if (!instance || instance.segments.length < entry.segmentCount) {
          throw Object.assign(new Error(`Cinema IndexedDB is missing verified story data for ${entry.id}.`), { code: "CINEMA_IDB_STORY_LOSS" });
        }
        entry.segments.forEach((segment, ordinal) => {
          if (instance.segments[ordinal]?.id !== segment.id) throw Object.assign(new Error(`Cinema IndexedDB changed verified prose order for ${entry.id}.`), { code: "CINEMA_IDB_VERIFIED_ORDER_CHANGED" });
        });
      });
      await Promise.all(migration.manifest.instances.map(async (entry) => {
        const instance = state.instances.find((item) => item.id === entry.id);
        if (!instance) return;
        const proseDigest = await sha256(instance.segments.slice(0, entry.segmentCount).map((segment) => segment.text).join("\u001e"));
        if (proseDigest !== entry.proseDigest) throw Object.assign(new Error(`Cinema IndexedDB changed verified prose content for ${entry.id}.`), { code: "CINEMA_IDB_VERIFIED_PROSE_CHANGED" });
        if (!await matchesVerifiedSnapshot(instance, entry.snapshotDigest)) throw Object.assign(new Error(`Cinema IndexedDB changed verified snapshots for ${entry.id}.`), { code: "CINEMA_IDB_VERIFIED_SNAPSHOT_CHANGED" });
      }));
    }

    #writeAuthorityMarker(migration) {
      this.markerStorage.set(AUTHORITY_KEY, {
        state: "authoritative",
        databaseName: DATABASE_NAME,
        databaseVersion: DATABASE_VERSION,
        targetRevision: migration.targetRevision,
        sourceDigest: migration.sourceDigest,
      });
    }
  }

  const api = Object.freeze({
    DATABASE_NAME,
    DATABASE_VERSION,
    TARGET_REVISION,
    AUTHORITY_KEY,
    INDEX_INSTANCE_ORDINAL,
    MercuryCinemaIndexedDBDatabase,
    MercuryLocalStorageCinemaRepository,
    MercuryIndexedDBCinemaRepository,
    stableStringify,
    sha256,
    splitState,
    joinBundle,
    buildManifest,
    verifyMigration,
    matchesVerifiedSnapshot,
  });

  global.MercuryCinemaPersistence = api;
  global.MercuryLocalStorageCinemaRepository = MercuryLocalStorageCinemaRepository;
  global.MercuryIndexedDBCinemaRepository = MercuryIndexedDBCinemaRepository;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
