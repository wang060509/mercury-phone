(function exposeMercuryAITransport(global) {
  "use strict";

  // Leave a small buffer above the local relay timeout so the relay can return
  // its structured provider error instead of the browser aborting first.
  const DEFAULT_CHAT_TIMEOUT_MS = 100000;
  // The relay may spend up to 12s on optional model discovery before a 45s
  // real-model probe. Keep enough headroom to receive its structured error.
  const DEFAULT_PROVIDER_TEST_TIMEOUT_MS = 65000;
  // Cinema requests are longer-form than an interactive Chat turn. Keep the
  // transport policy here so Cinema callers do not need to know relay timing.
  const DEFAULT_CINEMA_TIMEOUT_MS = 110000;

  function safeErrorMessage(value, fallback) {
    if (typeof value !== "string" || !value.trim()) return fallback;
    return value.replace(/bearer\s+[^\s]+/ig, "authorization credential").replace(/(?:api[_ -]?key|secret)[=: ]+[^\s,;]+/ig, "credential").slice(0, 240);
  }

  function parseLocalApiResponse(text, status = 200) {
    let body;
    try { body = JSON.parse(text); } catch (_) { throw Object.assign(new Error(`Local API request failed (${status}).`), { code: "LOCAL_INVALID_JSON", retryable: false }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw Object.assign(new Error(`Local API request failed (${status}).`), { code: "LOCAL_INVALID_RESPONSE", retryable: false });
    if (status < 200 || status >= 300 || body.ok === false) {
      const error = body.error && typeof body.error === "object" ? body.error : {};
      throw Object.assign(new Error(safeErrorMessage(error.message, `Local API request failed (${status}).`)), { code: typeof error.code === "string" ? error.code : "LOCAL_API_ERROR", retryable: error.retryable === true });
    }
    return body;
  }

  function assertLocalRelayAvailable() {
    if (global.location?.protocol !== "file:") return;
    throw Object.assign(new Error("请通过 http://127.0.0.1:5500/ 打开 Mercury，再连接模型服务。"), { code: "LOCAL_SERVER_REQUIRED", retryable: false });
  }

  function connectionError(code, message) {
    return Object.assign(new Error(message), {
      code,
      retryable: false,
      recovery: "ai-connection",
    });
  }

  function abortError() {
    return Object.assign(new Error("The request was cancelled."), { name: "AbortError" });
  }

  class MercuryAITransport {
    constructor(options = {}) {
      this.storage = options.storage || null;
      this.storagePrefix = options.storagePrefix || "mercury.app";
      this.credentialsAppId = options.credentialsAppId || "settings";
      this.sessionCredentials = options.sessionCredentials || null;
      this.fetchImpl = options.fetchImpl || global.fetch?.bind(global);
      this.timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : DEFAULT_CHAT_TIMEOUT_MS;
      this.providerTestTimeoutMs = Number.isFinite(options.providerTestTimeoutMs) ? options.providerTestTimeoutMs : DEFAULT_PROVIDER_TEST_TIMEOUT_MS;
    }

    #readCredential() {
      let raw;
      try {
        raw = this.storage?.getItem(`${this.storagePrefix}.${this.credentialsAppId}.connection`);
      } catch (_) {
        throw connectionError("AI_CONNECTION_STORAGE_UNAVAILABLE", "无法读取当前标签页的 AI 连接配置。");
      }
      let stored; try { stored = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (_) { stored = null; }
      let session = null;
      try { session = this.sessionCredentials?.get?.() || null; } catch (_) { session = null; }
      if ((!stored || typeof stored !== "object") && (!session || typeof session !== "object")) {
        throw connectionError("AI_CONNECTION_NOT_CONFIGURED", "当前标签页尚未配置可用的 AI 连接。");
      }
      const connection = { ...(stored && typeof stored === "object" ? stored : {}), ...(session && typeof session === "object" ? session : {}) };
      const provider = String(connection.provider || "openai-compatible").trim().toLowerCase();
      const apiKey = String(connection.apiKey || "").trim();
      const model = String(connection.model || "").trim();
      const baseUrl = String(connection.baseUrl || "").trim();
      if (!baseUrl) throw connectionError("AI_CONNECTION_BASE_URL_REQUIRED", "AI 连接缺少 Base URL。");
      if (!apiKey) throw connectionError("AI_CONNECTION_API_KEY_REQUIRED", "当前标签页缺少 API Key，请在 AI 连接中重新填写。");
      if (!model) throw connectionError("AI_CONNECTION_MODEL_REQUIRED", "AI 连接缺少模型名称。");
      return Object.freeze({ provider, baseUrl, apiKey, model });
    }

    connectionStatus() {
      try {
        this.#readCredential();
        return Object.freeze({ ready: true, code: null, message: null, retryable: false, recovery: null });
      } catch (error) {
        return Object.freeze({
          ready: false,
          code: typeof error?.code === "string" ? error.code : "AI_CONNECTION_UNAVAILABLE",
          message: safeErrorMessage(error?.message, "当前 AI 连接不可用。"),
          retryable: error?.retryable === true,
          recovery: "ai-connection",
        });
      }
    }

    async #postLocal(endpoint, payload, options = {}) {
      const externalSignal = options.signal;
      if (externalSignal?.aborted) throw abortError();
      if (typeof this.fetchImpl !== "function") throw new Error("Fetch is not available.");
      assertLocalRelayAvailable();
      const controller = new AbortController();
      const abortExternal = () => controller.abort();
      externalSignal?.addEventListener("abort", abortExternal, { once: true });
      let timedOut = false;
      const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : this.timeoutMs;
      const timeout = global.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      try {
        const response = await this.fetchImpl(endpoint, {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        return parseLocalApiResponse(await response.text(), response.status);
      } catch (error) {
        if (timedOut && error?.name === "AbortError") {
          throw Object.assign(new Error("The provider did not respond in time. Please retry."), { code: "LOCAL_TIMEOUT", retryable: true });
        }
        throw error;
      } finally {
        global.clearTimeout(timeout);
        externalSignal?.removeEventListener("abort", abortExternal);
      }
    }

    async chat(request, options = {}) {
      const contracts = global.MercuryChatContracts;
      contracts.validateChatApiRequest(request);
      const body = await this.#postLocal("/api/chat", { connection: this.#readCredential(), request }, { ...options, timeoutMs: Number.isFinite(options.timeoutMs) ? options.timeoutMs : this.timeoutMs });
      contracts.validateChatApiResponse(body);
      return body;
    }

    async analyzeRole(input, options = {}) {
      const roleContracts = global.MercuryRoleAnalysisContracts;
      roleContracts.validateInput(input);
      // Role sources can be substantially larger than a chat turn. Keep this
      // separate from the interactive chat timeout and leave headroom for the
      // local relay's role-analysis limit.
      const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : Math.max(this.timeoutMs, 120000);
      const body = await this.#postLocal("/api/role-analysis", { connection: this.#readCredential(), input }, { ...options, timeoutMs });
      roleContracts.validateResponse(body);
      return body;
    }

    async testConnection(options = {}) {
      const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : this.providerTestTimeoutMs;
      return this.#postLocal("/api/provider/test", { connection: this.#readCredential() }, { ...options, timeoutMs });
    }

    async generateCinema(request, options = {}) {
      const contracts = global.MercuryCinemaContracts;
      contracts.validateGenerationRequest(request);
      const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : DEFAULT_CINEMA_TIMEOUT_MS;
      const body = await this.#postLocal("/api/cinema", { connection: this.#readCredential(), request }, { ...options, timeoutMs });
      contracts.validateGenerationResponse(body);
      return body;
    }
  }

  global.MercuryAITransport = MercuryAITransport;
  global.MercuryParseLocalApiResponse = parseLocalApiResponse;
  global.MercuryAssertLocalRelayAvailable = assertLocalRelayAvailable;
  if (typeof module !== "undefined" && module.exports) module.exports = MercuryAITransport;
})(typeof window !== "undefined" ? window : globalThis);
