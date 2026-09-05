"use strict";

const assert = require("node:assert/strict");
const {
  createProviderAdapter,
  normalizeProviderRoot,
  parseAssistantText,
  parseModelIds,
} = require("../provider-adapter.js");

assert.equal(normalizeProviderRoot("https://provider.example.test/v1").toString(), "https://provider.example.test/v1/");
assert.equal(normalizeProviderRoot("https://provider.example.test/v1/chat/completions").toString(), "https://provider.example.test/v1/");
assert.equal(normalizeProviderRoot("https://provider.example.test/v1/models/").toString(), "https://provider.example.test/v1/");
assert.throws(() => normalizeProviderRoot("https://user:password@provider.example.test/v1"), (error) => error.code === "INVALID_PROVIDER_URL");
assert.deepEqual(parseModelIds({ data: [{ id: "z-model" }, { id: "a-model" }, { id: "a-model" }] }), ["a-model", "z-model"]);
assert.deepEqual(parseModelIds({ models: [{ name: "models/gemini-test" }] }), ["gemini-test"]);
assert.deepEqual(parseModelIds(["plain-model"]), ["plain-model"]);
assert.equal(parseAssistantText({ choices: [{ message: { content: [{ type: "text", text: "Hello" }, { type: "text", text: " world" }] } }] }), "Hello world");
assert.equal(parseAssistantText({ choices: [{ text: "legacy reply" }] }), "legacy reply");

const connection = { provider: "openai-compatible", baseUrl: "https://provider.example.test/v1/chat/completions", apiKey: "secret-key", model: "model-neutral" };
const requests = [];
const adapter = createProviderAdapter(connection, { fetchImpl: async (url, options) => {
  requests.push({ url, options });
  if (url.endsWith("/models")) return { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ id: "model-neutral" }] }) };
  return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: "OK" } }] }) };
} });

(async () => {
  assert.equal(adapter.urlFor("chat"), "https://provider.example.test/v1/chat/completions");
  assert.equal(adapter.urlFor("models"), "https://provider.example.test/v1/models");
  const discovery = await adapter.discoverModels();
  assert.deepEqual(discovery.models, ["model-neutral"]);
  const completion = await adapter.createChatCompletion([{ role: "user", content: "Hi" }], { temperature: 0 });
  assert.equal(parseAssistantText(completion), "OK");
  const chatRequest = requests.find((entry) => entry.url.endsWith("/chat/completions"));
  assert.equal(JSON.parse(chatRequest.options.body).model, "model-neutral");
  assert.equal(chatRequest.options.headers.Authorization, "Bearer secret-key");

  const rejected = createProviderAdapter(connection, { fetchImpl: async () => ({ ok: false, status: 400, text: async () => JSON.stringify({ error: { message: "unknown model; token=secret-key" } }) }) });
  await assert.rejects(() => rejected.createChatCompletion([{ role: "user", content: "Hi" }]), (error) => error.code === "UPSTREAM_BAD_REQUEST" && error.message.includes("unknown model") && !error.message.includes("secret-key"));

  const unauthorized = createProviderAdapter(connection, { fetchImpl: async () => ({ ok: false, status: 401, text: async () => JSON.stringify({ error: { message: "Incorrect API key secret-key" } }) }) });
  await assert.rejects(() => unauthorized.createChatCompletion([{ role: "user", content: "Hi" }]), (error) => error.code === "UPSTREAM_AUTH" && !error.message.includes("secret-key"));

  const stringError = createProviderAdapter(connection, { fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ error: "unknown model secret-key" }) }) });
  await assert.rejects(() => stringError.createChatCompletion([{ role: "user", content: "Hi" }]), (error) => error.code === "UPSTREAM_PROVIDER_ERROR" && error.message.includes("unknown model") && !error.message.includes("secret-key"));

  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(() => adapter.createChatCompletion([{ role: "user", content: "Hi" }], {}, { signal: cancelled.signal }), (error) => error.name === "AbortError", "a pre-aborted caller signal never starts a provider request");

  const unavailableModels = createProviderAdapter(connection, { fetchImpl: async (url) => url.endsWith("/models")
    ? { ok: false, status: 404, text: async () => "not implemented" }
    : { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: "OK" } }] }) } });
  assert.equal((await unavailableModels.discoverModels()).status, "unavailable");
  assert.equal(parseAssistantText(await unavailableModels.createChatCompletion([{ role: "user", content: "Hi" }])), "OK");
  console.log("provider-adapter: assertions passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
