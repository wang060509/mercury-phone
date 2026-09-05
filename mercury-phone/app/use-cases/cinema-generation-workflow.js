(function exposeMercuryCinemaGenerationWorkflow(global) {
  "use strict";

  const isAbortLike = (error) => error?.name === "AbortError" || /abort|cancel/i.test(String(error?.message || ""));
  const compilerModule = global.MercuryCinemaContextCompiler
    || (typeof require === "function" ? require("./cinema-context-compiler.js") : null);
  const ledgerModule = global.MercuryCinemaContinuityLedger
    || (typeof require === "function" ? require("./cinema-continuity-ledger.js") : null);
  const inFlightByStore = new WeakMap();

  function claimInstance(store, instanceId) {
    let claims = inFlightByStore.get(store);
    if (!claims) {
      claims = new Map();
      inFlightByStore.set(store, claims);
    }
    if (claims.has(instanceId)) return null;
    const lease = Object.freeze({ instanceId, token: Symbol(instanceId) });
    claims.set(instanceId, lease);
    return lease;
  }

  function releaseInstance(store, lease) {
    if (!lease) return;
    const claims = inFlightByStore.get(store);
    if (claims?.get(lease.instanceId) === lease) claims.delete(lease.instanceId);
    if (claims?.size === 0) inFlightByStore.delete(store);
  }

  function pendingMatches(instance, requestId, userSegmentId) {
    return instance?.pendingContinuation?.requestId === requestId
      && instance.pendingContinuation.userSegmentId === userSegmentId;
  }

  function profileSnapshotFor(instance, profileId) {
    if (!profileId) return null;
    if (instance?.generationProfileId === profileId && instance.generationProfileSnapshot) return instance.generationProfileSnapshot;
    return (Array.isArray(instance?.runtimeProfileHistory) ? instance.runtimeProfileHistory : [])
      .slice()
      .reverse()
      .find((entry) => entry?.profileId === profileId && entry?.snapshot)?.snapshot || null;
  }

  class MercuryCinemaGenerationWorkflow {
    constructor(options = {}) {
      if (!options.store || typeof options.store.focused !== "function") throw new TypeError("Cinema Generation Workflow requires a CinemaStore.");
      this.store = options.store;
      this.transport = options.transport || null;
      this.contracts = options.contracts || global.MercuryCinemaContracts;
      this.compiler = options.compiler || compilerModule;
      this.ledger = options.ledger || ledgerModule;
      this.clock = typeof options.clock === "function" ? options.clock : () => Date.now();
      this.listeners = new Set();
      this.activeRequest = null;
      this.operationStarting = false;
      this.state = Object.freeze({ phase: "idle", requestId: null, error: null });
    }

    snapshot() { return this.state; }

    subscribe(listener, options = {}) {
      if (typeof listener !== "function") throw new TypeError("Cinema generation listeners must be functions.");
      this.listeners.add(listener);
      if (options.emitCurrent === true) listener(this.state);
      return () => this.listeners.delete(listener);
    }

    async continueWith(userText, options = {}) {
      return this.runTurn({ userText, ...options });
    }

    async runTurn(input = {}) {
      if (this.activeRequest || this.operationStarting) return Object.freeze({ accepted: false, reason: "busy" });
      const active = input.instanceId ? this.store.get?.(input.instanceId) : this.store.focused();
      if (!active || active.status !== "active") return Object.freeze({ accepted: false, reason: "inactive-instance" });
      const text = String(input.userText || "").trim();
      if (!text) return Object.freeze({ accepted: false, reason: "empty" });
      if (active.pendingContinuation) return Object.freeze({ accepted: false, reason: "pending-exists" });
      const lease = claimInstance(this.store, active.id);
      if (!lease) return Object.freeze({ accepted: false, reason: "busy" });
      this.operationStarting = true;
      let userSegment;
      try { userSegment = this.store.appendUser(active.id, text); }
      catch (error) {
        this.operationStarting = false;
        releaseInstance(this.store, lease);
        return this.#storageFailure(error);
      }
      try { if (typeof this.store.flush === "function") await this.store.flush(); }
      catch (error) {
        this.operationStarting = false;
        releaseInstance(this.store, lease);
        return this.#storageFailure(error);
      }
      this.operationStarting = false;
      return this.#request({ instanceId: active.id, userSegmentId: userSegment.id, userText: text, retry: input.retry === true, lease });
    }

    async retryPending(instanceId = "") {
      if (this.activeRequest || this.operationStarting) return Object.freeze({ accepted: false, reason: "busy" });
      const active = instanceId ? this.store.get?.(instanceId) : this.store.focused();
      if (!active) return Object.freeze({ accepted: false, reason: "inactive-instance" });
      const pending = active?.pendingContinuation;
      if (!pending) {
        if (active.lastError?.code === "CINEMA_PENDING_CONTINUATION_INVALID") {
          return this.#invalidPending(active, active.lastError.code, active.lastError.message);
        }
        return Object.freeze({ accepted: false, reason: "nothing-to-retry" });
      }
      const userSegment = active?.segments?.find((entry) => entry.id === pending?.userSegmentId && entry.role === "user");
      if (!userSegment?.text) {
        return this.#invalidPending(active, "CINEMA_PENDING_USER_SEGMENT_MISSING", "待重试的原始用户段落不存在；Mercury 不会猜测另一条消息代替它。");
      }
      const generationProfileId = pending.generationProfileId || active.generationProfileId;
      const profileOverride = profileSnapshotFor(active, generationProfileId);
      if (generationProfileId !== active.generationProfileId && !profileOverride) {
        return this.#invalidPending(active, "CINEMA_PENDING_PROFILE_MISSING", "待重试续写所使用的原始演绎方式快照不存在；Mercury 不会改用当前演绎方式。");
      }
      const lease = claimInstance(this.store, active.id);
      if (!lease) return Object.freeze({ accepted: false, reason: "busy" });
      this.operationStarting = true;
      try {
        this.store.clearError(active.id);
        if (typeof this.store.flush === "function") await this.store.flush();
      }
      catch (error) {
        this.operationStarting = false;
        releaseInstance(this.store, lease);
        return this.#storageFailure(error);
      }
      this.operationStarting = false;
      return this.#request({
        instanceId: active.id,
        userSegmentId: userSegment.id,
        userText: userSegment.text,
        retry: true,
        requestId: pending.requestId,
        startedAt: pending.startedAt,
        generationProfileId,
        profileOverride,
        lease,
      });
    }

    async retry() { return this.retryPending(); }

    cancel() {
      if (!this.activeRequest) return false;
      this.activeRequest.controller.abort();
      return true;
    }

    async #request(options = {}) {
      const instance = this.store.get?.(options.instanceId) || this.store.focused();
      if (!instance) {
        releaseInstance(this.store, options.lease);
        return Object.freeze({ accepted: false, reason: "inactive-instance" });
      }
      if (this.activeRequest) {
        releaseInstance(this.store, options.lease);
        return Object.freeze({ accepted: false, reason: "busy" });
      }
      const requestId = options.requestId || `cinema-request-${this.clock()}-${Math.random().toString(36).slice(2, 7)}`;
      const generationProfileId = options.generationProfileId || instance.generationProfileId;
      const profileOverride = options.profileOverride || profileSnapshotFor(instance, generationProfileId);
      const controller = new AbortController();
      const requestRecord = { requestId, instanceId: instance.id, controller };
      this.activeRequest = requestRecord;
      this.#setState({ phase: "running", requestId, error: null });
      try {
        this.store.markPendingContinuation(instance.id, { requestId, userSegmentId: options.userSegmentId, startedAt: options.startedAt || new Date(this.clock()).toISOString(), generationProfileId });
        if (typeof this.store.flush === "function") await this.store.flush();
        const readiness = this.transport?.connectionStatus?.() || { ready: false, message: "当前 AI 连接不可用。", recovery: "ai-connection" };
        if (readiness.ready === false) {
          const error = Object.assign(new Error(readiness.message || "当前 AI 连接不可用。"), {
            code: readiness.code || "AI_CONNECTION_UNAVAILABLE",
            recovery: readiness.recovery || "ai-connection",
            retryable: readiness.retryable === true,
          });
          throw error;
        }
        const fresh = this.store.get?.(instance.id) || this.store.focused();
        if (!fresh || fresh.id !== instance.id) throw Object.assign(new Error("放映已切换。"), { code: "CINEMA_INSTANCE_CHANGED" });
        if (!pendingMatches(fresh, requestId, options.userSegmentId)) {
          throw Object.assign(new Error("待续写身份已改变，旧请求不会继续提交。"), { code: "CINEMA_PENDING_CONTINUATION_MISMATCH", retryable: false });
        }
        const compiled = this.compiler.compile({ instance: fresh, requestId, currentUserSegmentId: options.userSegmentId, userText: options.userText, retry: options.retry === true, generationProfileId, profileOverride });
        const request = compiled.request;
        const body = await this.transport.generateCinema(request, { signal: controller.signal });
        this.contracts.validateGenerationResponse(body);
        if (body.requestId !== requestId) {
          throw Object.assign(new Error("AI 返回了不属于本次续写的响应。"), { code: "CINEMA_RESPONSE_REQUEST_MISMATCH", retryable: true });
        }
        const current = this.store.get?.(fresh.id) || this.store.focused();
        if (!current || current.id !== fresh.id || this.activeRequest !== requestRecord) {
          if (this.activeRequest === requestRecord) this.#setState({ phase: "idle", requestId: null, error: null });
          return Object.freeze({ accepted: false, reason: "superseded" });
        }
        if (!pendingMatches(current, requestId, options.userSegmentId)) {
          this.#setState({ phase: "idle", requestId: null, error: null });
          return Object.freeze({ accepted: false, reason: "superseded" });
        }
        const committedUserSegment = current.segments.find((entry) => entry.id === options.userSegmentId && entry.role === "user");
        if (!committedUserSegment) {
          throw Object.assign(new Error("待续写的原始用户段落不存在。"), { code: "CINEMA_PENDING_USER_SEGMENT_MISSING", retryable: false });
        }
        const assistantSegmentDraft = { id: `cinema-assistant-${this.clock()}-draft`, sceneId: current.currentSceneId, role: "assistant", text: body.text, status: "complete", createdAt: new Date(this.clock()).toISOString(), generationProfileId };
        let nextNotes = current.notes;
        try {
          nextNotes = this.ledger.advance(current.notes, committedUserSegment, assistantSegmentDraft, { ...current, segments: [...current.segments, assistantSegmentDraft] }, { clock: this.clock });
        } catch (continuityError) {
          nextNotes = this.contracts.normalizeNotes({
            ...current.notes,
            lastFailure: {
              code: typeof continuityError?.code === "string" ? continuityError.code : "CINEMA_CONTINUITY_FAILED",
              message: continuityError instanceof Error ? continuityError.message : String(continuityError || "连续性更新失败"),
              at: new Date(this.clock()).toISOString(),
            },
          }, this.clock);
        }
        const committed = this.store.commitAssistantTurn(current.id, { assistantText: body.text, generationProfileId, notes: nextNotes, requestId, userSegmentId: options.userSegmentId });
        if (committed === null) {
          this.#setState({ phase: "idle", requestId: null, error: null });
          return Object.freeze({ accepted: false, reason: "superseded" });
        }
        if (typeof this.store.flush === "function") await this.store.flush();
        this.#setState({ phase: "idle", requestId: null, error: null });
        return Object.freeze({ accepted: true, response: body });
      } catch (error) {
        const cancelled = isAbortLike(error);
        const snapshot = {
          code: typeof error?.code === "string" ? error.code : cancelled ? "CINEMA_GENERATION_CANCELLED" : "CINEMA_GENERATION_FAILED",
          message: cancelled ? "本次演绎已中止，刚才写下的内容仍然保留。" : (error instanceof Error ? error.message : String(error)),
          retryable: cancelled || error?.retryable === true,
          recovery: typeof error?.recovery === "string" ? error.recovery : null,
        };
        if (error?.code !== "CINEMA_STORAGE_WRITE_FAILED") {
          try {
            this.store.failGeneration(instance.id, Object.assign(new Error(snapshot.message), snapshot));
            if (typeof this.store.flush === "function") await this.store.flush();
          } catch (storageError) {
            return this.#storageFailure(storageError, requestId);
          }
        }
        this.#setState({ phase: "failed", requestId, error: snapshot });
        return Object.freeze({ accepted: false, reason: cancelled ? "cancelled" : "failed", error: snapshot });
      } finally {
        if (this.activeRequest === requestRecord) this.activeRequest = null;
        releaseInstance(this.store, options.lease);
      }
    }

    async #invalidPending(instance, code, message) {
      const snapshot = Object.freeze({ code, message, retryable: false, recovery: "cinema-pending" });
      try {
        if (typeof this.store.failGeneration === "function" && instance?.id) {
          this.store.failGeneration(instance.id, Object.assign(new Error(message), snapshot));
          if (typeof this.store.flush === "function") await this.store.flush();
        }
      } catch (error) {
        return this.#storageFailure(error);
      }
      this.#setState({ phase: "failed", requestId: instance?.pendingContinuation?.requestId || null, error: snapshot });
      return Object.freeze({ accepted: false, reason: "invalid-pending", error: snapshot });
    }

    #setState(value) {
      this.state = Object.freeze({ phase: value.phase, requestId: value.requestId || null, error: value.error || null });
      this.listeners.forEach((listener) => listener(this.state));
    }

    #storageFailure(error, requestId = null) {
      const snapshot = Object.freeze({
        code: "CINEMA_STORAGE_WRITE_FAILED",
        message: error instanceof Error ? error.message : "Cinema 无法保存本次放映。",
        retryable: false,
        recovery: "cinema-storage",
      });
      this.#setState({ phase: "failed", requestId, error: snapshot });
      return Object.freeze({ accepted: false, reason: "storage-failed", error: snapshot });
    }
  }

  global.MercuryCinemaGenerationWorkflow = MercuryCinemaGenerationWorkflow;
  if (typeof module !== "undefined" && module.exports) module.exports = MercuryCinemaGenerationWorkflow;
})(typeof window !== "undefined" ? window : globalThis);
