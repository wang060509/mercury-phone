(function exposeMercuryChatGenerationWorkflow(global) {
  "use strict";

  const USER_RETRY_STATES = Object.freeze(["failed", "cancelled"]);
  const OPERATIONS = Object.freeze(["send", "retry", "regenerate"]);

  function cloneParts(parts) {
    return Array.isArray(parts) ? parts.map((part) => ({ ...part })) : [];
  }

  function cloneUserEntry(entry, delivery = entry?.delivery || "queued") {
    const result = {
      ...entry,
      role: "user",
      text: String(entry?.text || ""),
      delivery,
      replyToId: entry?.replyToId || null,
      quote: entry?.quote ? { ...entry.quote } : null,
    };
    if (Array.isArray(entry?.parts) && entry.parts.length) result.parts = cloneParts(entry.parts);
    else delete result.parts;
    return result;
  }

  function assistantIndexForMessage(entries, message = {}) {
    return entries.findIndex((entry) => entry.role === "assistant" && (
      entry.id === message.turnId
      || entry.id === message.id
      || entry.legacyMessageId === message.id
      || entry.parts?.some((part) => part.id === message.id)
    ));
  }

  function assistantVersion(entry, fallbackId, nowIso) {
    return {
      id: entry?.activeVersionId || entry?.legacyMessageId || entry?.id || fallbackId,
      legacyMessageId: entry?.legacyMessageId || entry?.id || fallbackId,
      parts: cloneParts(entry?.parts),
      status: entry?.status || "complete",
      createdAt: entry?.createdAt || nowIso,
      usage: entry?.usage ?? null,
      unspokenAside: entry?.unspokenAside ?? null,
    };
  }

  function errorSnapshot(error, kind = "request") {
    const message = error instanceof Error ? error.message : String(error || "Generation failed.");
    return Object.freeze({
      kind,
      code: typeof error?.code === "string" ? error.code : null,
      message,
      retryable: error?.retryable === true,
      recovery: typeof error?.recovery === "string" ? error.recovery : null,
    });
  }

  function readinessError(readiness) {
    const error = new Error(String(readiness?.message || "AI connection is not ready."));
    if (typeof readiness?.code === "string") error.code = readiness.code;
    if (typeof readiness?.recovery === "string") error.recovery = readiness.recovery;
    error.retryable = readiness?.retryable === true;
    return error;
  }

  function isAbortLike(error) {
    return error?.name === "AbortError" || /\babort(?:ed)?\b/i.test(String(error?.message || ""));
  }

  function createAbortController() {
    if (typeof global.AbortController === "function") return new global.AbortController();
    return { signal: undefined, abort() {} };
  }

  class MercuryChatGenerationWorkflow {
    constructor(options = {}) {
      if (typeof options.host?.read !== "function" || typeof options.host?.commit !== "function") {
        throw new Error("Chat Generation Workflow requires a host Adapter with read and commit.");
      }
      this.host = options.host;
      this.generation = typeof options.generation?.generate === "function" ? options.generation : null;
      this.contracts = options.contracts || global.MercuryChatContracts;
      if (!this.contracts || typeof this.contracts.validateConversationV2 !== "function") {
        throw new Error("Chat Generation Workflow requires the conversation contracts.");
      }
      this.now = typeof options.now === "function" ? options.now : () => Date.now();
      this.sequence = 0;
      this.active = null;
      this.state = Object.freeze({ phase: "idle", operation: null, requestId: null, messageId: null, error: null });
    }

    snapshot() {
      return this.state;
    }

    start(command = {}) {
      if (this.active) return this.reject("busy");
      if (!OPERATIONS.includes(command.kind)) return this.reject("unsupported-operation");
      let context;
      try {
        context = this.readContext();
      } catch (error) {
        this.setState({ phase: "failed", error: errorSnapshot(error, "host") });
        return this.reject("host-unavailable", this.state.error);
      }
      if (command.kind === "send") return this.startSend(command, context);
      if (!this.generation) return this.reject("generation-unavailable");
      if (command.kind === "retry") return this.startRetry(command, context);
      return this.startRegenerate(command, context);
    }

    cancel() {
      const request = this.active;
      if (!request) return false;
      request.cancelled = true;
      this.active = null;
      request.controller.abort();
      try {
        if (request.operation === "send" || request.operation === "retry") {
          const context = this.readContext();
          if (this.sameScope(context, request)) {
            const entries = context.conversation.entries.map((entry) => entry.id === request.userMessageId && entry.role === "user" ? { ...entry, delivery: "cancelled" } : entry);
            if (entries.some((entry, index) => entry !== context.conversation.entries[index])) {
              this.commit({ ...context.conversation, entries }, { kind: "cancelled", scope: request.scope, requestId: request.requestId });
            }
          }
        }
        this.setState({ phase: "idle" });
      } catch (error) {
        this.setState({ phase: "failed", error: errorSnapshot(error, "storage") });
      }
      return true;
    }

    startSend(command, context) {
      const source = command.userEntry;
      if (!source?.id || source.role !== "user") return this.reject("invalid-user-entry");
      if (!String(source.text || "").trim() && !(Array.isArray(source.parts) && source.parts.length)) return this.reject("empty-user-entry");
      if (context.conversation.entries.some((entry) => entry.id === source.id)) return this.reject("duplicate-user-entry");
      const userEntry = cloneUserEntry(source, "queued");
      if (this.generation && String(userEntry.text || "").trim()) {
        const rejected = this.preflight("send", context, userEntry.id);
        if (rejected) return rejected;
      }
      const previousEntries = context.conversation.entries.map((entry) => entry);
      try {
        const committed = this.commit({ ...context.conversation, entries: [...previousEntries, userEntry] }, { kind: "queued", scope: context.scope, messageId: userEntry.id });
        context = { ...context, conversation: committed };
      } catch (error) {
        this.setState({ phase: "failed", error: errorSnapshot(error, "storage") });
        return this.reject("commit-failed", this.state.error);
      }
      if (!this.generation || !String(userEntry.text || "").trim()) {
        this.setState({ phase: "idle" });
        return this.accept(Promise.resolve(true), false);
      }
      return this.beginGeneration({ operation: "send", context, userEntry, previousEntries, messageId: userEntry.id });
    }

    startRetry(command, context) {
      const messageId = String(command.messageId || command.message?.id || "");
      const index = context.conversation.entries.findIndex((entry) => entry.id === messageId && entry.role === "user");
      const original = context.conversation.entries[index];
      if (index < 0 || !USER_RETRY_STATES.includes(original?.delivery)) return this.reject("not-retryable");
      const userEntry = cloneUserEntry(original, "queued");
      const rejected = this.preflight("retry", context, messageId);
      if (rejected) return rejected;
      const previousEntries = context.conversation.entries.slice(0, index);
      try {
        const entries = context.conversation.entries.map((entry, entryIndex) => entryIndex === index ? userEntry : entry);
        const committed = this.commit({ ...context.conversation, entries }, { kind: "retry-queued", scope: context.scope, messageId });
        context = { ...context, conversation: committed };
      } catch (error) {
        this.setState({ phase: "failed", error: errorSnapshot(error, "storage") });
        return this.reject("commit-failed", this.state.error);
      }
      return this.beginGeneration({ operation: "retry", context, userEntry, previousEntries, messageId });
    }

    startRegenerate(command, context) {
      const message = command.message || { id: command.messageId, turnId: command.turnId };
      const targetIndex = assistantIndexForMessage(context.conversation.entries, message);
      if (targetIndex < 0) return this.reject("assistant-turn-missing");
      let priorUserIndex = -1;
      for (let index = targetIndex - 1; index >= 0; index -= 1) {
        if (context.conversation.entries[index].role === "user") { priorUserIndex = index; break; }
      }
      if (priorUserIndex < 0) return this.reject("user-turn-missing");
      const userEntry = cloneUserEntry(context.conversation.entries[priorUserIndex]);
      const rejected = this.preflight("regenerate", context, message.id || context.conversation.entries[targetIndex].id);
      if (rejected) return rejected;
      return this.beginGeneration({
        operation: "regenerate",
        context,
        userEntry,
        previousEntries: context.conversation.entries.slice(0, priorUserIndex),
        messageId: message.id || context.conversation.entries[targetIndex].id,
        targetEntryId: context.conversation.entries[targetIndex].id,
      });
    }

    preflight(operation, context, messageId) {
      if (typeof this.generation?.preflight !== "function") return null;
      try {
        const readiness = this.generation.preflight(Object.freeze({
          operation,
          contactId: context.scope.contactId,
          timelineId: context.scope.timelineId,
        }));
        if (readiness && typeof readiness.then === "function") {
          throw Object.assign(new Error("Generation preflight must complete synchronously."), { code: "GENERATION_PREFLIGHT_ASYNC", retryable: false });
        }
        if (readiness === false || readiness?.ready === false) throw readinessError(readiness);
        return null;
      } catch (error) {
        const snapshot = errorSnapshot(error, "preflight");
        this.setState({ phase: "failed", operation, messageId, error: snapshot });
        return this.reject("preflight-failed", snapshot);
      }
    }

    beginGeneration({ operation, context, userEntry, previousEntries, messageId, targetEntryId = null }) {
      const prefix = operation === "retry" ? "request-retry" : operation === "regenerate" ? "request-regen" : "request";
      const suffix = operation === "send" ? "" : `-${++this.sequence}`;
      const requestId = `${prefix}-${userEntry.id}${suffix}`;
      const controller = createAbortController();
      const request = {
        operation,
        requestId,
        messageId,
        userMessageId: userEntry.id,
        targetEntryId,
        conversationId: context.conversation.id,
        scope: context.scope,
        controller,
        cancelled: false,
      };
      this.active = request;
      this.setState({ phase: "running", operation, requestId, messageId, error: null });
      const completion = this.run(request, userEntry, previousEntries);
      return this.accept(completion, true);
    }

    async run(request, userEntry, previousEntries) {
      try {
        const response = await this.generation.generate({
          operation: request.operation,
          message: userEntry,
          previousEntries: previousEntries.map((entry) => entry),
          requestId: request.requestId,
          signal: request.controller.signal,
        });
        if (!this.isCurrent(request)) return false;
        const context = this.readContext();
        const next = request.operation === "regenerate"
          ? this.applyRegeneration(context.conversation, request, response)
          : this.applyAssistantResponse(context.conversation, request, response);
        if (!next) return false;
        const committed = this.commit(next, { kind: request.operation === "regenerate" ? "regenerated" : "completed", scope: request.scope, requestId: request.requestId, messageId: request.messageId });
        this.emitEffect({ type: "assistant-completed", operation: request.operation, request: this.publicRequest(request), response, conversation: committed, assistantTurn: request.operation === "regenerate" ? committed.entries.find((entry) => entry.id === request.targetEntryId) : response.assistantTurn });
        return true;
      } catch (error) {
        if (!this.isCurrent(request)) return false;
        const cancelled = request.cancelled || isAbortLike(error);
        if (request.operation === "send" || request.operation === "retry") {
          try {
            const context = this.readContext();
            const entries = context.conversation.entries.map((entry) => entry.id === request.userMessageId && entry.role === "user" ? { ...entry, delivery: cancelled ? "cancelled" : "failed" } : entry);
            this.commit({ ...context.conversation, entries }, { kind: cancelled ? "cancelled" : "failed", scope: request.scope, requestId: request.requestId, messageId: request.messageId });
          } catch (commitError) {
            this.setState({ phase: "failed", operation: request.operation, requestId: request.requestId, messageId: request.messageId, error: errorSnapshot(commitError, "storage") });
            return false;
          }
        }
        this.setState({ phase: "failed", operation: request.operation, requestId: request.requestId, messageId: request.messageId, error: errorSnapshot(error, cancelled ? "cancelled" : "request") });
        return false;
      } finally {
        if (this.active === request) {
          this.active = null;
          if (this.state.phase === "running") this.setState({ phase: "idle" });
        }
      }
    }

    applyAssistantResponse(conversation, request, response) {
      if (!response?.assistantTurn) throw new Error("Generation response is missing an assistant turn.");
      let found = false;
      const entries = conversation.entries.map((entry) => {
        if (entry.id !== request.userMessageId || entry.role !== "user") return entry;
        found = true;
        return { ...entry, delivery: "complete" };
      });
      if (!found) return null;
      return { ...conversation, entries: [...entries, response.assistantTurn] };
    }

    applyRegeneration(conversation, request, response) {
      if (!response?.assistantTurn) throw new Error("Generation response is missing an assistant turn.");
      const targetIndex = conversation.entries.findIndex((entry) => entry.id === request.targetEntryId && entry.role === "assistant");
      if (targetIndex < 0) return null;
      const original = conversation.entries[targetIndex];
      const nowIso = new Date(this.now()).toISOString();
      const versions = Array.isArray(original.versions) && original.versions.length
        ? original.versions.map((version) => ({ ...version, parts: cloneParts(version.parts) }))
        : [assistantVersion(original, original.id, nowIso)];
      const regeneratedVersion = assistantVersion(response.assistantTurn, `regen-${this.now()}-${this.sequence}`, nowIso);
      if (versions.some((version) => version.id === regeneratedVersion.id)) regeneratedVersion.id = `${regeneratedVersion.id}-v${versions.length + 1}`;
      const updated = {
        ...original,
        parts: cloneParts(regeneratedVersion.parts),
        status: regeneratedVersion.status,
        createdAt: regeneratedVersion.createdAt,
        usage: regeneratedVersion.usage,
        unspokenAside: regeneratedVersion.unspokenAside,
        legacyMessageId: regeneratedVersion.legacyMessageId || regeneratedVersion.id,
        versions: [...versions, regeneratedVersion],
        activeVersionId: regeneratedVersion.id,
      };
      return { ...conversation, entries: conversation.entries.map((entry, index) => index === targetIndex ? updated : entry) };
    }

    readContext() {
      const value = this.host.read();
      if (!value?.conversation || !value?.scope) throw new Error("Chat Generation Workflow host returned an invalid context.");
      this.contracts.validateConversationV2(value.conversation);
      return {
        conversation: value.conversation,
        scope: Object.freeze({ contactId: String(value.scope.contactId || ""), timelineId: String(value.scope.timelineId || "default") }),
      };
    }

    commit(conversation, meta) {
      this.contracts.validateConversationV2(conversation);
      const committed = this.host.commit(conversation, Object.freeze({ ...meta }));
      const result = committed || conversation;
      this.contracts.validateConversationV2(result);
      return result;
    }

    sameScope(context, request) {
      return context.conversation.id === request.conversationId
        && context.scope.contactId === request.scope.contactId
        && context.scope.timelineId === request.scope.timelineId;
    }

    isCurrent(request) {
      if (this.active !== request || request.cancelled) return false;
      try { return this.sameScope(this.readContext(), request); } catch (_) { return false; }
    }

    publicRequest(request) {
      return Object.freeze({ operation: request.operation, requestId: request.requestId, messageId: request.messageId, userMessageId: request.userMessageId, contactId: request.scope.contactId, timelineId: request.scope.timelineId });
    }

    emitEffect(event) {
      if (typeof this.host.effect !== "function") return;
      try {
        const result = this.host.effect(Object.freeze(event));
        if (result && typeof result.catch === "function") result.catch(() => {});
      } catch (_) {
        // Post-commit effects are best-effort and cannot reverse a durable reply.
      }
    }

    setState(next) {
      this.state = Object.freeze({
        phase: next.phase,
        operation: next.operation || null,
        requestId: next.requestId || null,
        messageId: next.messageId || null,
        error: next.error || null,
      });
      try { this.host.changed?.(this.state); } catch (_) {}
    }

    accept(completion, generated) {
      return Object.freeze({ accepted: true, generated, completion });
    }

    reject(reason, error = null) {
      return Object.freeze({ accepted: false, reason, error, completion: null });
    }
  }

  global.MercuryChatGenerationWorkflow = MercuryChatGenerationWorkflow;
  if (typeof module !== "undefined" && module.exports) module.exports = MercuryChatGenerationWorkflow;
})(typeof window !== "undefined" ? window : globalThis);
