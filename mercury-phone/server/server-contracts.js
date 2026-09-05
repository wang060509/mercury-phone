"use strict";

const chatContracts = require("../app/core/chat-contracts.js");
const roleAnalysisContracts = require("../app/core/role-analysis-contracts.js");
const cinemaContracts = require("../app/core/cinema-contracts.js");

const MAX_MODEL_LENGTH = 160;
const MAX_BASE_URL_LENGTH = 2048;
const MAX_API_KEY_LENGTH = 4096;
const SUPPORTED_PROVIDERS = new Set(["openai-compatible"]);
const MAX_MESSAGES = 40;
const MAX_MESSAGE_TEXT_LENGTH = 16000;
const FORBIDDEN_CREDENTIAL_KEYS = new Set(["apikey", "authorization", "credential", "credentials", "secretkey", "accesstoken", "bearertoken"]);

function isObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function isText(value, max = Infinity) { return typeof value === "string" && value.trim().length > 0 && value.length <= max; }
function fail(message, code = "INVALID_REQUEST") { const error = new TypeError(message); error.code = code; throw error; }
function containsCredentialField(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((entry) => containsCredentialField(entry, seen));
  return Object.entries(value).some(([key, entry]) => {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    return FORBIDDEN_CREDENTIAL_KEYS.has(normalizedKey) || containsCredentialField(entry, seen);
  });
}

function validateConnection(connection) {
  if (!isObject(connection)) fail("connection is required.");
  const provider = typeof connection.provider === "string" && connection.provider.trim() ? connection.provider.trim().toLowerCase() : "openai-compatible";
  if (!SUPPORTED_PROVIDERS.has(provider)) fail("connection.provider is not supported.");
  if (!isText(connection.baseUrl, MAX_BASE_URL_LENGTH)) fail("connection.baseUrl is invalid.");
  if (!isText(connection.apiKey, MAX_API_KEY_LENGTH)) fail("connection.apiKey is invalid.");
  if (!isText(connection.model, MAX_MODEL_LENGTH)) fail("connection.model is invalid.");
  return { provider, baseUrl: connection.baseUrl.trim(), apiKey: connection.apiKey.trim(), model: connection.model.trim() };
}

function validateRecentMessages(messages) {
  if (messages === undefined) return [];
  if (!Array.isArray(messages) || messages.length > MAX_MESSAGES) fail("recentMessages is invalid.");
  messages.forEach((message) => {
    if (!isObject(message) || !["user", "assistant"].includes(message.role)) fail("recentMessages contains an invalid role.");
    const text = message.role === "user" ? message.text : message.parts?.map((part) => part.text).join("\n");
    if (!isText(text, MAX_MESSAGE_TEXT_LENGTH)) fail("recentMessages contains invalid text.");
  });
  return messages;
}

function validateProxyRequest(payload) {
  if (!isObject(payload)) fail("Request body must be an object.");
  const connection = validateConnection(payload.connection);
  if (!isObject(payload.request)) fail("request is required.");
  try { chatContracts.validateChatApiRequest(payload.request); } catch (_) { fail("request does not match ChatApiRequest."); }
  if (!isText(payload.request.userMessage.text, MAX_MESSAGE_TEXT_LENGTH)) fail("userMessage.text is invalid.");
  validateRecentMessages(payload.request.recentMessages);
  // Credential protection is structural. Scanning serialized values would
  // reject legitimate roleplay text such as "keep this secret" and common
  // imported-preset safety instructions that mention API credentials.
  if (containsCredentialField(payload.request)) fail("request contains a forbidden credential field.");
  return Object.freeze({ connection: Object.freeze(connection), request: payload.request });
}

function validateProviderTestRequest(payload) {
  if (!isObject(payload)) fail("Request body must be an object.");
  return Object.freeze({ connection: Object.freeze(validateConnection(payload.connection)) });
}

function validateRoleAnalysisRequest(payload) {
  if (!isObject(payload)) fail("Request body must be an object.");
  const connection = validateConnection(payload.connection);
  if (!isObject(payload.input) || Object.keys(payload.input).some((key) => !["schemaVersion", "displayName", "sourceText", "truncated"].includes(key))) fail("input contains unsupported fields.");
  try { roleAnalysisContracts.validateInput(payload.input); } catch (_) { fail("input does not match RoleAnalysisRequest."); }
  return Object.freeze({ connection: Object.freeze(connection), input: payload.input });
}

function validateCinemaProxyRequest(payload) {
  if (!isObject(payload)) fail("Request body must be an object.");
  const connection = validateConnection(payload.connection);
  if (!isObject(payload.request)) fail("request is required.");
  try { cinemaContracts.validateGenerationRequest(payload.request); }
  catch (_) { fail("request does not match CinemaGenerationRequest."); }
  if (containsCredentialField(payload.request)) fail("request contains a forbidden credential field.");
  return Object.freeze({ connection: Object.freeze(connection), request: payload.request });
}

module.exports = Object.freeze({
  MAX_MESSAGES,
  MAX_MESSAGE_TEXT_LENGTH,
  validateConnection,
  validateProxyRequest,
  validateProviderTestRequest,
  validateRoleAnalysisRequest,
  validateCinemaProxyRequest,
});
