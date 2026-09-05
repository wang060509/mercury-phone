"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const contracts = require("../core/chat-contracts.js");
const roleAnalysisContracts = require("../core/role-analysis-contracts.js");
const cinemaContracts = require("../core/cinema-contracts.js");
global.MercuryChatContracts = contracts;
global.MercuryRoleAnalysisContracts = roleAnalysisContracts;
global.MercuryCinemaContracts = cinemaContracts;
const MercuryAITransport = require("../core/ai-transport.js");
const parseLocalApiResponse = global.MercuryParseLocalApiResponse;
const assertLocalRelayAvailable = global.MercuryAssertLocalRelayAvailable;
const mainSource = fs.readFileSync(path.join(__dirname, "..", "main.js"), "utf8");
assert.match(mainSource, /MercuryAITransport\s*\(\s*\{[^}]*sessionCredentials:\s*systemServices\.sessionCredentials/s, "the shell must inject the shared session credential resolver into the real Chat transport");
assert.throws(() => parseLocalApiResponse("{\"ok\":false,\"error\":{\"code\":\"UPSTREAM_AUTH\",\"message\":\"The provider connection failed.\",\"retryable\":false}}", 502), (error) => error.code === "UPSTREAM_AUTH" && error.message === "The provider connection failed.");
assert.throws(() => parseLocalApiResponse("not-json", 502), /Local API request failed \(502\)/);
const originalLocation = global.location;
global.location = { protocol: "file:" };
assert.throws(() => assertLocalRelayAvailable(), (error) => error.code === "LOCAL_SERVER_REQUIRED", "file origin explains that the local relay is required");
global.location = originalLocation;

const storage = new Map([["mercury.app.settings.connection", JSON.stringify({ baseUrl: "https://api.example.test/v1", apiKey: "secret-key", model: "model-neutral" })]]);
let requestOptions;
const transport = new MercuryAITransport({
  storage: { getItem: (key) => storage.get(key) || null },
  fetchImpl: async (url, options) => {
    requestOptions = { url, options };
    if (url === "/api/provider/test") return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, provider: "openai-compatible", model: "model-neutral", discovery: { status: "available", count: 1, includesConfiguredModel: true }, probe: { status: "success", preview: "OK" } }) };
    if (url === "/api/role-analysis") return { ok: true, status: 200, text: async () => JSON.stringify({ schemaVersion: 1, analysis: { identity: "Harbor guide", stableTraits: ["calm"] }, sourceTruncated: false, warnings: [] }) };
    if (url === "/api/cinema") return { ok: true, status: 200, text: async () => JSON.stringify({ requestId: "cinema-request-1", text: "The story continues." }) };
    return { ok: true, status: 200, text: async () => JSON.stringify({ requestId: "request-1", assistantTurn: { id: "turn-1", role: "assistant", parts: [{ id: "part-1", text: "A provider reply.", order: 0, pauseAfter: "none", deliveryStatus: "delivered" }], status: "complete", createdAt: "2026-01-01T00:00:00.000Z", usage: { inputTokens: 11, outputTokens: 7, totalTokens: 18, providerReported: true }, unspokenAside: null }, memoryCandidates: [], usage: { inputTokens: 11, outputTokens: 7, totalTokens: 18, providerReported: true }, warnings: [] }) };
  },
});
assert.equal(transport.timeoutMs, 100000, "interactive chat leaves time for a full provider reply");
assert.equal(transport.providerTestTimeoutMs, 65000, "connection tests leave room for discovery plus the real-model probe");

const sessionOnlyTransport = new MercuryAITransport({
  storage: { getItem: () => JSON.stringify({ baseUrl: "https://stored.example.test/v1", apiKey: "", model: "stored-model" }) },
  sessionCredentials: { get: () => ({ baseUrl: "https://session.example.test/v1", apiKey: "session-key", model: "session-model" }) },
  fetchImpl: async (_, options) => ({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true, echoedConnection: JSON.parse(options.body).connection }) }),
});
const missingTransport = new MercuryAITransport({ storage: { getItem: () => null }, sessionCredentials: { get: () => null } });
assert.deepEqual(missingTransport.connectionStatus(), { ready: false, code: "AI_CONNECTION_NOT_CONFIGURED", message: "当前标签页尚未配置可用的 AI 连接。", retryable: false, recovery: "ai-connection" }, "connection preflight reports a safe status without exposing credentials");
assert.deepEqual(sessionOnlyTransport.connectionStatus(), { ready: true, code: null, message: null, retryable: false, recovery: null }, "connection preflight recognizes the current tab session credential");
assert.equal("apiKey" in sessionOnlyTransport.connectionStatus(), false, "connection preflight never returns the API key");
assert.equal(typeof sessionOnlyTransport.readCredential, "undefined", "credential resolution is not exposed through the AITransport Interface");
assert.equal(typeof sessionOnlyTransport.postLocal, "undefined", "relay payload assembly is not exposed through the AITransport Interface");

const request = {
  requestId: "request-1",
  conversationId: "conversation-neutral",
  userMessage: { id: "user-1", text: "A neutral question." },
  settings: contracts.DEFAULT_SETTINGS,
  experienceSettings: contracts.DEFAULT_EXPERIENCE_SETTINGS,
  recentMessages: [],
};

const roleInput = { schemaVersion: 1, displayName: "River", sourceText: "A calm guide.", truncated: false };
const cinemaRequest = {
  requestId: "cinema-request-1",
  instanceId: "cinema-instance-1",
  userText: "Continue across the courtyard.",
  systemPrompt: "Continue the story in a restrained style.",
  history: [],
  generationProfileId: "profile-neutral",
  retry: false,
};

(async () => {
  const sessionTest = await sessionOnlyTransport.testConnection();
  assert.deepEqual(sessionTest.echoedConnection, { provider: "openai-compatible", baseUrl: "https://session.example.test/v1", apiKey: "session-key", model: "session-model" }, "session credentials bridge Settings to high-level operations without exposing credential resolution");

  const response = await transport.chat(request);
  assert.equal(requestOptions.url, "/api/chat");
  assert.equal(requestOptions.options.headers.Authorization, undefined);
  const body = JSON.parse(requestOptions.options.body);
  assert.equal(body.connection.apiKey, "secret-key");
  assert.equal(body.request.userMessage.text, "A neutral question.");
  assert.deepEqual(body.request.experienceSettings, contracts.DEFAULT_EXPERIENCE_SETTINGS);
  assert.equal(response.assistantTurn.parts[0].text, "A provider reply.");
  assert.equal(response.usage.inputTokens, 11);
  assert.equal(response.usage.outputTokens, 7);
  assert.equal(response.usage.totalTokens, 18);

  const testResult = await transport.testConnection();
  assert.equal(requestOptions.url, "/api/provider/test", "connection tests use the same transport boundary as Chat");
  assert.equal(JSON.parse(requestOptions.options.body).connection.provider, "openai-compatible");
  assert.equal(testResult.probe.status, "success");

  const analysis = await transport.analyzeRole(roleInput);
  assert.equal(requestOptions.url, "/api/role-analysis");
  assert.equal(JSON.parse(requestOptions.options.body).connection.apiKey, "secret-key");
  assert.equal(analysis.analysis.identity, "Harbor guide");

  const cinema = await transport.generateCinema(cinemaRequest);
  assert.equal(requestOptions.url, "/api/cinema", "Cinema uses a high-level AITransport operation");
  assert.equal(JSON.parse(requestOptions.options.body).connection.apiKey, "secret-key", "Cinema credentials are assembled inside AITransport");
  assert.equal(JSON.parse(requestOptions.options.body).request.userText, "Continue across the courtyard.");
  assert.equal(cinema.text, "The story continues.");

  let preAbortedFetches = 0;
  const preAbortedTransport = new MercuryAITransport({
    storage: { getItem: (key) => storage.get(key) || null },
    fetchImpl: async () => { preAbortedFetches += 1; throw new Error("fetch must not start"); },
  });
  const preAbortedController = new AbortController();
  preAbortedController.abort();
  const preAbortedOperations = [
    () => preAbortedTransport.chat(request, { signal: preAbortedController.signal }),
    () => preAbortedTransport.testConnection({ signal: preAbortedController.signal }),
    () => preAbortedTransport.analyzeRole(roleInput, { signal: preAbortedController.signal }),
    () => preAbortedTransport.generateCinema(cinemaRequest, { signal: preAbortedController.signal }),
  ];
  for (const operation of preAbortedOperations) {
    await assert.rejects(operation, (error) => error?.name === "AbortError", "every high-level operation preserves the pre-aborted signal contract");
  }
  assert.equal(preAbortedFetches, 0, "a pre-aborted high-level operation never starts fetch");

  const slowTransport = new MercuryAITransport({
    storage: { getItem: (key) => storage.get(key) || null },
    timeoutMs: 5,
    fetchImpl: async (_, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(Object.assign(new Error("Aborted"), { name: "AbortError" })), { once: true });
    }),
  });
  await assert.rejects(() => slowTransport.chat(request), (error) => error.code === "LOCAL_TIMEOUT" && error.retryable === true);
  console.log("ai-transport: high-level operation contracts passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
