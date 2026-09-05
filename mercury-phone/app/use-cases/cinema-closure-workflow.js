(function exposeMercuryCinemaClosureWorkflow(global) {
  "use strict";

  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

  class MercuryCinemaClosureWorkflow {
    constructor(options = {}) {
      if (!options.store || typeof options.store.flush !== "function") throw new TypeError("CinemaClosureWorkflow requires a CinemaStore.");
      this.store = options.store;
      this.generationWorkflow = options.generationWorkflow || null;
      this.listeners = new Set();
      this.state = Object.freeze({ phase: "idle", operation: null, instanceId: null, error: null });
    }

    snapshot() { return clone(this.state); }

    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("CinemaClosureWorkflow listeners must be functions.");
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    pause(instanceId) {
      return this.#run("pause", instanceId, () => this.store.intermission(instanceId), { guardGeneration: false });
    }

    beginEnding(instanceId) {
      return this.#run("begin-ending", instanceId, () => this.store.beginEnding(instanceId));
    }

    abandonPendingAndBeginEnding(instanceId, requestId) {
      return this.#run("abandon-pending", instanceId, () => this.store.abandonPendingAndBeginEnding(instanceId, requestId));
    }

    finishEnding(instanceId) {
      return this.#run("finish-ending", instanceId, () => this.store.finish(instanceId));
    }

    #generationIsRunning() {
      return this.generationWorkflow?.snapshot?.().phase === "running";
    }

    async #run(operation, instanceId, action, options = {}) {
      if (this.state.phase === "persisting") return Object.freeze({ accepted: false, reason: "busy" });
      if (options.guardGeneration !== false && this.#generationIsRunning()) {
        const error = Object.assign(new Error("请先返回演出并明确取消当前续写，待请求结束后再谢幕。"), { code: "CINEMA_CLOSURE_GENERATION_ACTIVE" });
        this.#setState({ phase: "failed", operation, instanceId, error });
        throw error;
      }
      this.#setState({ phase: "persisting", operation, instanceId, error: null });
      try {
        const instance = action();
        await this.store.flush();
        this.#setState({ phase: "idle", operation, instanceId, error: null });
        return Object.freeze({ accepted: true, instance: clone(instance) });
      } catch (cause) {
        const error = cause?.code
          ? cause
          : Object.assign(new Error(cause?.message || "Cinema closure could not be persisted."), { code: "CINEMA_CLOSURE_FAILED", cause });
        this.#setState({ phase: "failed", operation, instanceId, error });
        throw error;
      }
    }

    #setState(value) {
      this.state = Object.freeze({
        phase: value.phase,
        operation: value.operation || null,
        instanceId: value.instanceId || null,
        error: value.error ? Object.freeze({ code: value.error.code || "CINEMA_CLOSURE_FAILED", message: value.error.message || String(value.error) }) : null,
      });
      const snapshot = this.snapshot();
      this.listeners.forEach((listener) => listener(snapshot));
    }
  }

  global.MercuryCinemaClosureWorkflow = MercuryCinemaClosureWorkflow;
  if (typeof module !== "undefined" && module.exports) module.exports = MercuryCinemaClosureWorkflow;
})(typeof window !== "undefined" ? window : globalThis);
