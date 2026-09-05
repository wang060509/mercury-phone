"use strict";

const MAX_UPSTREAM_BODY = 512 * 1024;
const DEFAULT_PROVIDER_TIMEOUT_MS = 90000;
const PROVIDER_OPENAI_COMPATIBLE = "openai-compatible";
const TERMINAL_ENDPOINT = /\/(?:chat\/completions|completions|models)$/i;

class UpstreamError extends Error {
  constructor(code, message, status = 502, retryable = false, upstreamStatus = null) {
    super(message);
    this.name = "UpstreamError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.upstreamStatus = Number.isInteger(upstreamStatus) ? upstreamStatus : null;
  }
}

function assertProviderUrl(baseUrl, options = {}) {
  let url;
  try { url = new URL(baseUrl); } catch (_) { throw new UpstreamError("INVALID_PROVIDER_URL", "The provider URL is invalid.", 400); }
  const allowInsecureDev = options.allowInsecureDev === true;
  if (url.protocol !== "https:" && !(allowInsecureDev && url.protocol === "http:")) throw new UpstreamError("INVALID_PROVIDER_URL", "The provider URL must use HTTPS.", 400);
  if (url.username || url.password) throw new UpstreamError("INVALID_PROVIDER_URL", "The provider URL must not contain credentials.", 400);
  const host = url.hostname.toLowerCase();
  const privateHost = host === "localhost" || host === "metadata.google.internal" || host === "host.docker.internal" || host === "::1" || host === "0.0.0.0" || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (privateHost && !allowInsecureDev) throw new UpstreamError("PROVIDER_HOST_NOT_ALLOWED", "The provider host is not allowed.", 400);
  return url;
}

function normalizeProviderRoot(baseUrl, options = {}) {
  const url = assertProviderUrl(baseUrl, options);
  url.hash = "";
  url.search = "";
  let path = url.pathname.replace(/\/+$/, "");
  path = path.replace(TERMINAL_ENDPOINT, "");
  url.pathname = `${path || ""}/`;
  return url;
}

function endpointUrl(root, endpoint) {
  return new URL(endpoint.replace(/^\/+/, ""), root).toString();
}

function redactProviderText(value, apiKey = "") {
  let text = String(value || "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
  if (apiKey) text = text.split(apiKey).join("[credential]");
  return text
    .replace(/bearer\s+[^\s,;]+/ig, "authorization credential")
    .replace(/(?:api[_ -]?key|secret|token)[=: ]+[^\s,;]+/ig, "credential")
    .replace(/<[^>]{0,80}>/g, " ")
    .replace(/\s{2,}/g, " ")
    .slice(0, 240);
}

function providerDetail(raw, apiKey = "") {
  let candidate = "";
  try {
    const parsed = JSON.parse(raw);
    candidate = parsed?.error?.message || parsed?.message || parsed?.detail || "";
  } catch (_) {
    if (String(raw || "").length <= 600) candidate = raw;
  }
  return redactProviderText(typeof candidate === "string" ? candidate : "", apiKey);
}

function httpError(response, raw, apiKey = "") {
  const upstreamStatus = Number(response?.status) || 0;
  const detail = providerDetail(raw, apiKey);
  if (upstreamStatus === 401 || upstreamStatus === 403) return new UpstreamError("UPSTREAM_AUTH", "The API key was rejected or lacks permission.", 502, false, upstreamStatus);
  if (upstreamStatus === 404) return new UpstreamError("UPSTREAM_NOT_FOUND", detail ? `The provider endpoint or model was not found: ${detail}` : "The provider endpoint or model was not found.", 502, false, upstreamStatus);
  if (upstreamStatus === 408) return new UpstreamError("UPSTREAM_TIMEOUT", "The provider did not respond in time.", 504, true, upstreamStatus);
  if (upstreamStatus === 429) return new UpstreamError("UPSTREAM_RATE_LIMIT", detail ? `The provider rate limit was reached: ${detail}` : "The provider rate limit was reached.", 503, true, upstreamStatus);
  if (upstreamStatus >= 500) return new UpstreamError("UPSTREAM_UNAVAILABLE", detail ? `The provider is temporarily unavailable: ${detail}` : "The provider is temporarily unavailable.", 502, true, upstreamStatus);
  return new UpstreamError("UPSTREAM_BAD_REQUEST", detail ? `The provider rejected the request: ${detail}` : "The provider rejected the request.", 502, false, upstreamStatus);
}

async function readBody(response) {
  const text = await response.text();
  if (text.length > MAX_UPSTREAM_BODY) throw new UpstreamError("UPSTREAM_RESPONSE_TOO_LARGE", "The provider response was too large.", 502, false);
  return text;
}

function parseJsonBody(raw, apiKey = "") {
  let body;
  try { body = JSON.parse(raw); } catch (_) { throw new UpstreamError("UPSTREAM_INVALID_JSON", "The provider returned invalid JSON.", 502, false); }
  if (!body || typeof body !== "object") throw new UpstreamError("UPSTREAM_INVALID_JSON", "The provider returned invalid JSON.", 502, false);
  if (body.error) {
    const detail = redactProviderText(typeof body.error === "string" ? body.error : body.error.message || body.message || "", apiKey);
    throw new UpstreamError("UPSTREAM_PROVIDER_ERROR", detail ? `The provider returned an error: ${detail}` : "The provider returned an error.", 502, false);
  }
  return body;
}

function parseAssistantText(body) {
  const choice = Array.isArray(body?.choices) ? body.choices[0] : null;
  const content = choice?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) return content.map((part) => typeof part === "string" ? part : typeof part?.text === "string" ? part.text : "").join("").trim();
  if (typeof choice?.text === "string") return choice.text.trim();
  return "";
}

function parseModelIds(body) {
  const values = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : Array.isArray(body?.models) ? body.models : [];
  const ids = values.map((entry) => {
    if (typeof entry === "string") return entry;
    if (!entry || typeof entry !== "object") return "";
    return typeof entry.id === "string" ? entry.id : typeof entry.name === "string" ? entry.name.replace(/^models\//, "") : "";
  }).map((value) => value.trim()).filter(Boolean);
  return [...new Set(ids)].sort((left, right) => left.localeCompare(right));
}

class OpenAICompatibleAdapter {
  constructor(connection, options = {}) {
    this.connection = Object.freeze({
      provider: PROVIDER_OPENAI_COMPATIBLE,
      baseUrl: String(connection.baseUrl || "").trim(),
      apiKey: String(connection.apiKey || "").trim(),
      model: String(connection.model || "").trim(),
    });
    this.fetchImpl = options.fetchImpl || global.fetch;
    if (typeof this.fetchImpl !== "function") throw new UpstreamError("UPSTREAM_UNAVAILABLE", "The provider is unavailable.", 502, true);
    this.root = normalizeProviderRoot(this.connection.baseUrl, { allowInsecureDev: options.allowInsecureDev });
    this.defaultTimeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : DEFAULT_PROVIDER_TIMEOUT_MS;
  }

  urlFor(kind) {
    if (kind === "chat") return endpointUrl(this.root, "chat/completions");
    if (kind === "models") return endpointUrl(this.root, "models");
    throw new TypeError(`Unsupported provider endpoint: ${kind}`);
  }

  headers(includeJson = true) {
    return {
      Accept: "application/json",
      ...(includeJson ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${this.connection.apiKey}`,
    };
  }

  async requestJson(kind, request = {}, options = {}) {
    const controller = new AbortController();
    const externalSignal = options.signal;
    const abortExternal = () => controller.abort();
    if (externalSignal?.aborted) controller.abort();
    else externalSignal?.addEventListener("abort", abortExternal, { once: true });
    let timedOut = false;
    const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : this.defaultTimeoutMs;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
      if (externalSignal?.aborted) throw Object.assign(new Error("The provider request was cancelled."), { name: "AbortError" });
      const response = await this.fetchImpl(this.urlFor(kind), {
        method: request.method || "GET",
        redirect: "error",
        headers: request.headers || this.headers(request.body !== undefined),
        ...(request.body !== undefined ? { body: JSON.stringify(request.body) } : {}),
        signal: controller.signal,
      });
      const raw = await readBody(response);
      if (!response.ok) throw httpError(response, raw, this.connection.apiKey);
      return parseJsonBody(raw, this.connection.apiKey);
    } catch (error) {
      if (error instanceof UpstreamError) throw error;
      if (error?.name === "AbortError") {
        if (timedOut) throw new UpstreamError("UPSTREAM_TIMEOUT", "The provider did not respond in time.", 504, true);
        throw error;
      }
      throw new UpstreamError("UPSTREAM_UNAVAILABLE", "The provider is unavailable.", 502, true);
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abortExternal);
    }
  }

  async createChatCompletion(messages, parameters = {}, options = {}) {
    return this.requestJson("chat", {
      method: "POST",
      body: {
        model: this.connection.model,
        messages,
        stream: false,
        ...parameters,
      },
    }, options);
  }

  async discoverModels(options = {}) {
    try {
      const body = await this.requestJson("models", { method: "GET", headers: this.headers(false) }, options);
      const models = parseModelIds(body);
      return Object.freeze({ status: "available", models: Object.freeze(models) });
    } catch (error) {
      if (!(error instanceof UpstreamError)) throw error;
      return Object.freeze({ status: "unavailable", models: Object.freeze([]), reason: error.code });
    }
  }
}

function createProviderAdapter(connection, options = {}) {
  const provider = String(connection?.provider || PROVIDER_OPENAI_COMPATIBLE).trim().toLowerCase();
  if (provider !== PROVIDER_OPENAI_COMPATIBLE) throw new UpstreamError("UNSUPPORTED_PROVIDER", "The configured provider is not supported.", 400, false);
  return new OpenAICompatibleAdapter(connection, options);
}

module.exports = Object.freeze({
  DEFAULT_PROVIDER_TIMEOUT_MS,
  PROVIDER_OPENAI_COMPATIBLE,
  UpstreamError,
  assertProviderUrl,
  normalizeProviderRoot,
  endpointUrl,
  parseAssistantText,
  parseModelIds,
  createProviderAdapter,
});
