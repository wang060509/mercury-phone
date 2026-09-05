(function exposeMercuryCinemaStore(global) {
  "use strict";

  const contracts = global.MercuryCinemaContracts
    || (typeof require === "function" ? require("../core/cinema-contracts.js") : null);
  const persistence = global.MercuryCinemaPersistence
    || (typeof require === "function" ? require("./cinema-repository.js") : null);

  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const MercuryLocalStorageCinemaRepository = persistence.MercuryLocalStorageCinemaRepository;
  const MercuryIndexedDBCinemaRepository = persistence.MercuryIndexedDBCinemaRepository;

  class MercuryCinemaStore {
    constructor(options = {}) {
      this.repository = options.repository || (options.storage ? new MercuryIndexedDBCinemaRepository({ legacyStorage: options.storage, catalog: options.catalog, indexedDB: options.indexedDB, database: options.database }) : null);
      if (!this.repository || typeof this.repository.load !== "function" || typeof this.repository.save !== "function") {
        throw new TypeError("CinemaStore requires a CinemaRepository.");
      }
      this.catalog = options.catalog || global.MercuryCinemaStageCatalog?.PRODUCTION_STAGE_CATALOG;
      if (!this.catalog || typeof this.catalog.getStage !== "function" || typeof this.catalog.getScenario !== "function") throw new TypeError("CinemaStore requires a StageCatalog.");
      this.clock = typeof options.clock === "function" ? options.clock : () => Date.now();
      this.listeners = new Set();
      this.state = contracts.createState();
      this.initialized = false;
      this.initializationError = null;
      this.persistenceError = null;
      this.writeQueue = Promise.resolve();
      this.draftPersistenceDelay = Number.isFinite(options.draftPersistenceDelay) ? Math.max(0, options.draftPersistenceDelay) : 120;
      this.schedule = typeof options.schedule === "function" ? options.schedule : (callback, delay) => global.setTimeout(callback, delay);
      this.cancelSchedule = typeof options.cancelSchedule === "function" ? options.cancelSchedule : (timer) => global.clearTimeout(timer);
      this.pendingDraftPersistence = null;
      this.draftPersistenceTimer = null;
      this.ready = this.#load();
    }

    snapshot() { return clone(this.state); }
    isReady() { return this.initialized && !this.initializationError; }

    async flush() {
      await this.ready;
      this.flushDraftPersistence();
      await this.writeQueue;
      if (this.persistenceError) throw this.persistenceError;
      return this.snapshot();
    }

    flushDraftPersistence() {
      if (!this.pendingDraftPersistence) return this.writeQueue;
      if (this.draftPersistenceTimer !== null) this.cancelSchedule(this.draftPersistenceTimer);
      this.draftPersistenceTimer = null;
      const persisted = this.pendingDraftPersistence;
      this.pendingDraftPersistence = null;
      this.#enqueuePersistence(persisted);
      return this.writeQueue;
    }

    subscribe(listener, options = {}) {
      if (typeof listener !== "function") throw new TypeError("CinemaStore listeners must be functions.");
      this.listeners.add(listener);
      if (options.emitCurrent === true) listener(Object.freeze({ type: "snapshot" }), this.snapshot());
      return () => this.listeners.delete(listener);
    }

    markEntered() { return this.#commit({ ...this.state, hasEntered: true }, "entered"); }
    markTutorialSeen() { return this.#commit({ ...this.state, tutorialSeen: true }, "tutorial-seen"); }

    beginDraft(stageId = this.catalog.listStages()[0]?.id) {
      const draft = contracts.createDraft({ stageId }, this.clock, this.catalog);
      this.#commit({ ...this.state, draft }, "draft-created", { draftId: draft.id });
      return clone(draft);
    }

    updateDraft(patch = {}) {
      const draft = contracts.normalizeDraft({ ...(this.state.draft || contracts.createDraft({}, this.clock, this.catalog)), ...clone(patch), updatedAt: new Date(this.clock()).toISOString() }, this.clock, this.catalog);
      this.#commit({ ...this.state, draft }, "draft-updated", { draftId: draft.id }, { coalesceDraft: true });
      return clone(draft);
    }

    discardDraft() {
      if (!this.state.draft) return false;
      this.#commit({ ...this.state, draft: null }, "draft-discarded");
      return true;
    }

    openCurtain() {
      this.flushDraftPersistence();
      const instance = contracts.createInstanceFromDraft(this.state.draft, this.clock, this.catalog);
      const instances = [...this.state.instances.filter((item) => item.id !== instance.id), instance];
      this.#commit({ ...this.state, focusedInstanceId: instance.id, draft: null, instances }, "instance-started", { instanceId: instance.id });
      return clone(instance);
    }

    focused() {
      const instance = this.state.instances.find((item) => item.id === this.state.focusedInstanceId && item.status !== "ended");
      return instance ? clone(instance) : null;
    }

    active() { return this.focused(); }

    get(instanceId) {
      const instance = this.state.instances.find((item) => item.id === instanceId);
      return instance ? clone(instance) : null;
    }

    listPast() {
      return this.state.instances.filter((item) => item.status === "ended").slice().sort((a, b) => String(b.endedAt).localeCompare(String(a.endedAt))).map(clone);
    }

    listUnfinished() {
      return this.state.instances.filter((item) => item.status !== "ended").slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).map(clone);
    }

    focusInstance(instanceId) {
      const instance = this.state.instances.find((item) => item.id === instanceId && item.status !== "ended");
      if (!instance) return null;
      if (this.state.focusedInstanceId !== instanceId) {
        this.#commit({ ...this.state, focusedInstanceId: instanceId }, "instance-focused", { instanceId });
      }
      return clone(instance);
    }

    updateInstance(instanceId, updater, type = "instance-updated") {
      const index = this.state.instances.findIndex((item) => item.id === instanceId);
      if (index < 0) return null;
      const current = clone(this.state.instances[index]);
      const proposed = typeof updater === "function" ? updater(current) : { ...current, ...(updater || {}) };
      const next = contracts.normalizeInstance({ ...proposed, id: current.id, updatedAt: new Date(this.clock()).toISOString() }, this.catalog);
      const instances = this.state.instances.map((item, itemIndex) => itemIndex === index ? next : item);
      this.#commit({ ...this.state, instances }, type, { instanceId });
      return clone(next);
    }

    appendUser(instanceId, userText) {
      const text = String(userText || "").trim();
      if (!text) throw new TypeError("Cinema user text cannot be empty.");
      const id = `cinema-user-${this.clock()}-${Math.random().toString(36).slice(2, 7)}`;
      this.updateInstance(instanceId, (instance) => ({
        ...instance,
        lastError: null,
        segments: [...instance.segments, { id, sceneId: instance.currentSceneId, role: "user", text, status: "complete", createdAt: new Date(this.clock()).toISOString(), generationProfileId: instance.generationProfileId }],
      }), "user-appended");
      return this.get(instanceId).segments.find((segment) => segment.id === id);
    }

    appendAssistant(instanceId, assistantText, profileId = "") {
      const text = String(assistantText || "").trim();
      if (!text) throw new TypeError("Cinema assistant text cannot be empty.");
      const id = `cinema-assistant-${this.clock()}-${Math.random().toString(36).slice(2, 7)}`;
      return this.updateInstance(instanceId, (instance) => ({
        ...instance,
        lastError: null,
        segments: [...instance.segments, { id, sceneId: instance.currentSceneId, role: "assistant", text, status: "complete", createdAt: new Date(this.clock()).toISOString(), generationProfileId: profileId || instance.generationProfileId }],
      }), "assistant-appended");
    }

    markPendingContinuation(instanceId, pending) {
      const nextPending = contracts.normalizePendingContinuation(pending);
      if (!nextPending) throw new TypeError("Cinema pending continuation requires requestId and userSegmentId.");
      const current = this.get(instanceId);
      const userSegment = current?.segments.find((segment) => segment.id === nextPending.userSegmentId && segment.role === "user");
      if (!userSegment) {
        throw Object.assign(new Error("Cinema pending continuation references a missing user segment."), { code: "CINEMA_PENDING_USER_SEGMENT_MISSING" });
      }
      if (current.pendingContinuation && current.pendingContinuation.requestId !== nextPending.requestId) {
        throw Object.assign(new Error("Cinema already has a different pending continuation."), { code: "CINEMA_PENDING_CONTINUATION_EXISTS" });
      }
      return this.updateInstance(instanceId, (instance) => ({
        ...instance,
        pendingContinuation: nextPending,
        lastError: null,
      }), "continuation-pending");
    }

    clearPendingContinuation(instanceId, requestId = "") {
      return this.updateInstance(instanceId, (instance) => {
        if (requestId && instance.pendingContinuation?.requestId !== requestId) return instance;
        return { ...instance, pendingContinuation: null };
      }, "continuation-cleared");
    }

    commitAssistantTurn(instanceId, { assistantText, generationProfileId = "", notes = null, requestId = "", userSegmentId = "" } = {}) {
      const text = String(assistantText || "").trim();
      if (!text) throw new TypeError("Cinema assistant text cannot be empty.");
      const current = this.get(instanceId);
      if (!current || !requestId || !userSegmentId
        || current.pendingContinuation?.requestId !== requestId
        || current.pendingContinuation?.userSegmentId !== userSegmentId
        || !current.segments.some((segment) => segment.id === userSegmentId && segment.role === "user")) return null;
      const id = `cinema-assistant-${this.clock()}-${Math.random().toString(36).slice(2, 7)}`;
      this.updateInstance(instanceId, (instance) => ({
        ...instance,
        lastError: null,
        pendingContinuation: null,
        notes: notes ? contracts.normalizeNotes(notes, this.clock) : instance.notes,
        segments: [...instance.segments, { id, sceneId: instance.currentSceneId, role: "assistant", text, status: "complete", createdAt: new Date(this.clock()).toISOString(), generationProfileId: generationProfileId || instance.generationProfileId }],
      }), "assistant-turn-committed");
      return this.get(instanceId).segments.find((segment) => segment.id === id);
    }

    failGeneration(instanceId, error) {
      return this.updateInstance(instanceId, (instance) => ({
        ...instance,
        lastError: {
          code: typeof error?.code === "string" ? error.code : "CINEMA_GENERATION_FAILED",
          message: error instanceof Error ? error.message : String(error || "演绎失败"),
          retryable: error?.retryable === true,
          recovery: typeof error?.recovery === "string" ? error.recovery : null,
          at: new Date(this.clock()).toISOString(),
        },
      }), "generation-failed");
    }

    failContinuity(instanceId, error) {
      return this.updateInstance(instanceId, (instance) => ({
        ...instance,
        notes: contracts.normalizeNotes({
          ...instance.notes,
          lastFailure: {
            code: typeof error?.code === "string" ? error.code : "CINEMA_CONTINUITY_FAILED",
            message: error instanceof Error ? error.message : String(error || "连续性更新失败"),
            at: new Date(this.clock()).toISOString(),
          },
        }, this.clock),
      }), "continuity-failed");
    }

    clearError(instanceId) { return this.updateInstance(instanceId, { lastError: null }, "generation-recovered"); }

    intermission(instanceId) {
      return this.updateInstance(instanceId, (instance) => instance.status === "active" ? { ...instance, status: "intermission" } : instance, "instance-paused");
    }

    resume(instanceId) {
      return this.updateInstance(instanceId, (instance) => instance.status === "intermission" ? { ...instance, status: "active" } : instance, "instance-resumed");
    }

    beginEnding(instanceId) {
      const current = this.get(instanceId);
      if (!current) throw Object.assign(new Error("Cinema Performance does not exist."), { code: "CINEMA_INSTANCE_NOT_FOUND" });
      if (current.status === "ending" && current.closureRecord) return current;
      if (!["active", "intermission"].includes(current.status)) {
        throw Object.assign(new Error("Only an active or paused Performance can begin ending."), { code: "CINEMA_ENDING_INVALID_STATE" });
      }
      if (current.pendingContinuation) {
        throw Object.assign(new Error("The pending continuation requires an explicit disposition before ending."), { code: "CINEMA_PENDING_CONTINUATION_REQUIRES_DISPOSITION" });
      }
      const initiatedAt = new Date(this.clock()).toISOString();
      return this.updateInstance(instanceId, (instance) => ({
        ...instance,
        status: "ending",
        closureRecord: { version: 1, initiatedAt, pendingDisposition: null },
      }), "ending-started");
    }

    abandonPendingAndBeginEnding(instanceId, expectedRequestId) {
      const requestId = String(expectedRequestId || "").trim();
      if (!requestId) throw Object.assign(new Error("The pending request identity is required."), { code: "CINEMA_PENDING_REQUEST_ID_REQUIRED" });
      const current = this.get(instanceId);
      if (!current) throw Object.assign(new Error("Cinema Performance does not exist."), { code: "CINEMA_INSTANCE_NOT_FOUND" });
      const settledDisposition = current.closureRecord?.pendingDisposition;
      if (["ending", "ended"].includes(current.status) && settledDisposition?.requestId === requestId) return current;
      if (["ending", "ended"].includes(current.status)) {
        throw Object.assign(new Error("The Performance already has a different closure disposition."), { code: "CINEMA_PENDING_REQUEST_ID_MISMATCH" });
      }
      if (!["active", "intermission"].includes(current.status)) {
        throw Object.assign(new Error("Only an active or paused Performance can abandon pending work and end."), { code: "CINEMA_ENDING_INVALID_STATE" });
      }
      const pending = current.pendingContinuation;
      if (!pending) throw Object.assign(new Error("The Performance has no durable pending continuation."), { code: "CINEMA_PENDING_CONTINUATION_MISSING" });
      if (pending.requestId !== requestId) throw Object.assign(new Error("The pending continuation identity changed."), { code: "CINEMA_PENDING_REQUEST_ID_MISMATCH" });
      if (!current.segments.some((segment) => segment.id === pending.userSegmentId && segment.role === "user")) {
        throw Object.assign(new Error("The pending continuation no longer points to its original user segment."), { code: "CINEMA_PENDING_USER_SEGMENT_MISSING" });
      }
      const settledAt = new Date(this.clock()).toISOString();
      return this.updateInstance(instanceId, (instance) => ({
        ...instance,
        status: "ending",
        pendingContinuation: null,
        closureRecord: {
          version: 1,
          initiatedAt: settledAt,
          pendingDisposition: {
            kind: "abandoned-by-user",
            requestId: pending.requestId,
            userSegmentId: pending.userSegmentId,
            startedAt: pending.startedAt,
            settledAt,
          },
        },
      }), "pending-abandoned-ending-started");
    }

    finish(instanceId) {
      const current = this.get(instanceId);
      if (!current) throw Object.assign(new Error("Cinema Performance does not exist."), { code: "CINEMA_INSTANCE_NOT_FOUND" });
      if (current.status === "ended") return current;
      if (current.status !== "ending") throw Object.assign(new Error("Cinema Performance has not begun ending."), { code: "CINEMA_FINISH_INVALID_STATE" });
      if (current.pendingContinuation) throw Object.assign(new Error("Cinema cannot finish while a continuation remains pending."), { code: "CINEMA_ENDING_HAS_PENDING_CONTINUATION" });
      const endedAt = new Date(this.clock()).toISOString();
      const closureRecord = current.closureRecord || { version: 1, initiatedAt: current.updatedAt || endedAt, pendingDisposition: null };
      const ended = contracts.normalizeInstance({ ...current, status: "ended", endedAt, updatedAt: endedAt, closureRecord }, this.catalog);
      const instances = this.state.instances.map((item) => item.id === instanceId ? ended : item);
      const nextFocus = this.state.focusedInstanceId === instanceId
        ? instances.filter((item) => item.id !== instanceId && item.status !== "ended").slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0]?.id || null
        : this.state.focusedInstanceId;
      this.#commit({ ...this.state, focusedInstanceId: nextFocus, instances }, "instance-ended", { instanceId, focusedInstanceId: nextFocus });
      return clone(ended);
    }

    applyGenerationProfile(instanceId, profile) {
      if (!profile?.id) throw new TypeError("Cinema requires a Generation Profile.");
      const appliedAt = new Date(this.clock()).toISOString();
      return this.updateInstance(instanceId, (instance) => ({
        ...instance,
        generationProfileId: profile.id,
        generationProfileSnapshot: clone(profile),
        runtimeProfileHistory: [...instance.runtimeProfileHistory, { profileId: profile.id, snapshot: clone(profile), appliedAt }],
      }), "profile-applied");
    }

    updateReadingSettings(patch = {}) {
      const next = contracts.normalizeState({ ...this.state, readingSettings: { ...this.state.readingSettings, ...patch } }, this.catalog);
      this.#commit(next, "reading-settings-updated");
      return clone(next.readingSettings);
    }

    async #load() {
      try {
        this.state = contracts.normalizeState(await this.repository.load(contracts.createState()), this.catalog);
        this.initialized = true;
        const snapshot = this.snapshot();
        this.listeners.forEach((listener) => listener(Object.freeze({ type: "ready" }), snapshot));
        return snapshot;
      } catch (cause) {
        this.initializationError = Object.assign(new Error("Cinema 无法安全读取本地放映。旧存档没有被替换。"), { code: "CINEMA_STORAGE_READ_FAILED", cause });
        throw this.initializationError;
      }
    }

    #commit(next, type, detail = {}, options = {}) {
      if (!this.initialized) throw Object.assign(new Error("Cinema 仍在读取本地放映。"), { code: "CINEMA_STORE_NOT_READY" });
      if (this.persistenceError) throw this.persistenceError;
      const normalized = contracts.normalizeState(next, this.catalog);
      this.state = normalized;
      const event = Object.freeze({ type, ...detail });
      const snapshot = this.snapshot();
      this.listeners.forEach((listener) => listener(event, snapshot));
      const persisted = clone(normalized);
      if (options.coalesceDraft === true) this.#scheduleDraftPersistence(persisted);
      else {
        this.flushDraftPersistence();
        this.#enqueuePersistence(persisted);
      }
      return snapshot;
    }

    #scheduleDraftPersistence(persisted) {
      this.pendingDraftPersistence = persisted;
      if (this.draftPersistenceTimer !== null) this.cancelSchedule(this.draftPersistenceTimer);
      this.draftPersistenceTimer = this.schedule(() => {
        this.draftPersistenceTimer = null;
        this.flushDraftPersistence();
      }, this.draftPersistenceDelay);
    }

    #enqueuePersistence(persisted) {
      this.writeQueue = this.writeQueue.then(async () => {
        if (this.persistenceError) return;
        try {
          await this.repository.save(persisted);
        } catch (cause) {
          this.persistenceError = Object.assign(new Error("Cinema 无法保存本次放映。旧存档不会被静默载入。"), { code: "CINEMA_STORAGE_WRITE_FAILED", cause });
          const failureEvent = Object.freeze({ type: "persistence-error", code: this.persistenceError.code });
          const failureSnapshot = this.snapshot();
          this.listeners.forEach((listener) => listener(failureEvent, failureSnapshot));
        }
      });
    }
  }

  global.MercuryLocalStorageCinemaRepository = MercuryLocalStorageCinemaRepository;
  global.MercuryIndexedDBCinemaRepository = MercuryIndexedDBCinemaRepository;
  global.MercuryCinemaStore = MercuryCinemaStore;
  MercuryCinemaStore.LocalStorageRepository = MercuryLocalStorageCinemaRepository;
  if (typeof module !== "undefined" && module.exports) module.exports = MercuryCinemaStore;
})(typeof window !== "undefined" ? window : globalThis);
