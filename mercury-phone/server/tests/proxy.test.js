"use strict";

const assert = require("node:assert/strict");
const { handleChat, handleProviderTest } = require("../chat-handler.js");
const { DEFAULT_CHAT_TIMEOUT_MS } = require("../upstream-client.js");
const contracts = require("../../app/core/chat-contracts.js");

const connection = { baseUrl: "https://provider.example.test/v1", apiKey: "secret-key", model: "model-neutral" };
const request = { requestId: "request-1", conversationId: "conversation-neutral", userMessage: { id: "user-1", text: "A neutral question." }, settings: contracts.DEFAULT_SETTINGS, experienceSettings: contracts.DEFAULT_EXPERIENCE_SETTINGS, recentMessages: [] };
assert.equal(DEFAULT_CHAT_TIMEOUT_MS, 90000, "the relay allows slower roleplay providers to finish");

let lastSeenMessages = null;
const fakeProvider = async (url, options) => {
  assert.equal(url, "https://provider.example.test/v1/chat/completions");
  assert.equal(options.method, "POST");
  assert.equal(JSON.parse(options.body).stream, false);
  assert.equal(options.headers.Authorization, "Bearer secret-key");
  lastSeenMessages = JSON.parse(options.body).messages;
  return { ok: true, status: 200, text: async () => JSON.stringify({ id: "provider-1", choices: [{ message: { role: "assistant", content: "A normalized reply." } }], usage: { prompt_tokens: 5, completion_tokens: 4, total_tokens: 9 } }) };
};

(async () => {
  const success = await handleChat({ connection, request }, { fetchImpl: fakeProvider });
  assert.equal(success.status, 200);
  assert.equal(success.body.assistantTurn.parts[0].text, "A normalized reply.");
  assert.equal(success.body.requestId, request.requestId);
  assert.equal(success.body.usage.inputTokens, 5);
  assert.equal(JSON.stringify(success.body).includes("secret-key"), false);

  const personaRequest = { ...request, systemPrompt: "你现在担任的角色是「测试角色」。请始终在该身份内回应。" };
  await handleChat({ connection, request: personaRequest }, { fetchImpl: fakeProvider });
  assert.equal(lastSeenMessages[0].role, "system");
  assert.equal(lastSeenMessages[0].content, personaRequest.systemPrompt);
  assert.equal(lastSeenMessages[lastSeenMessages.length - 1].role, "user");
  assert.equal(lastSeenMessages[lastSeenMessages.length - 1].content, request.userMessage.text);

  const credentialVocabularyPrompt = "Keep the story's secret private. References to an API key, Authorization, or credentials are ordinary prompt text, not credential fields.";
  const credentialVocabulary = await handleChat({ connection, request: { ...request, systemPrompt: credentialVocabularyPrompt } }, { fetchImpl: fakeProvider });
  assert.equal(credentialVocabulary.status, 200, "credential vocabulary in prompt content must not be mistaken for a credential field");
  assert.equal(lastSeenMessages[0].content, credentialVocabularyPrompt, "legitimate imported-preset text reaches the provider unchanged");

  const multiBubble = await handleChat({ connection, request }, { fetchImpl: async (url, options) => {
    lastSeenMessages = JSON.parse(options.body).messages;
    return { ok: true, status: 200, text: async () => JSON.stringify({ id: "provider-multi", choices: [{ message: { role: "assistant", content: "第一条。\n第二条。\n第三条。\n第四条。\n第五条。" } }], usage: { prompt_tokens: 5, completion_tokens: 4, total_tokens: 9 } }) };
  } });
  assert.equal(multiBubble.status, 200);
  assert.equal(multiBubble.body.assistantTurn.parts.length, 4);
  assert.equal(multiBubble.body.assistantTurn.parts[0].text, "第一条。");
  assert.ok(multiBubble.body.assistantTurn.parts[3].text.includes("第五条。"));

  const runOnSentence = await handleChat({ connection, request }, { fetchImpl: async (url, options) => {
    lastSeenMessages = JSON.parse(options.body).messages;
    return { ok: true, status: 200, text: async () => JSON.stringify({ id: "provider-runon", choices: [{ message: { role: "assistant", content: "我也没想到会这样。但现在说这些也没用。你先别慌。" } }], usage: { prompt_tokens: 5, completion_tokens: 4, total_tokens: 9 } }) };
  } });
  assert.equal(runOnSentence.status, 200);
  assert.equal(runOnSentence.body.assistantTurn.parts.length, 3);
  assert.equal(runOnSentence.body.assistantTurn.parts[0].text, "我也没想到会这样。");
  assert.equal(runOnSentence.body.assistantTurn.parts[2].text, "你先别慌。");

  const asideReply = await handleChat({ connection, request }, { fetchImpl: async (url, options) => {
    lastSeenMessages = JSON.parse(options.body).messages;
    const content = "我知道了。你别担心。\n〔心声〕其实我也有点怕,但我不想让他看出来。〔/心声〕";
    return { ok: true, status: 200, text: async () => JSON.stringify({ id: "provider-aside", choices: [{ message: { role: "assistant", content } }], usage: { prompt_tokens: 5, completion_tokens: 4, total_tokens: 9 } }) };
  } });
  assert.equal(asideReply.status, 200);
  assert.equal(asideReply.body.assistantTurn.unspokenAside, "其实我也有点怕,但我不想让他看出来。", "inner voice extracted from the response");
  assert.equal(asideReply.body.assistantTurn.parts.some((part) => part.text.includes("〔心声〕")), false, "aside markers stripped from spoken parts");
  assert.equal(asideReply.body.assistantTurn.parts[0].text.includes("我知道了。"), true, "spoken text retained");
  const plainAside = await handleChat({ connection, request }, { fetchImpl: async (url, options) => ({ ok: true, status: 200, text: async () => JSON.stringify({ id: "provider-plain", choices: [{ message: { role: "assistant", content: "只是一句普通的话。" } }], usage: {} }) }) });
  assert.equal(plainAside.body.assistantTurn.unspokenAside, null, "no markers means no inner voice");

  const structuredReply = await handleChat({ connection, request }, { fetchImpl: async (url, options) => {
    lastSeenMessages = JSON.parse(options.body).messages;
    const content = "<thinking>她好像有点不高兴，我别踩雷。</thinking>\n嗯。\n知道了。\n<inner-voice>内心：其实我有点内疚</inner-voice>";
    return { ok: true, status: 200, text: async () => JSON.stringify({ id: "provider-structured", choices: [{ message: { role: "assistant", content } }], usage: {} }) };
  } });
  assert.equal(structuredReply.status, 200);
  assert.equal(structuredReply.body.assistantTurn.parts.length, 2, "two spoken bubbles, chain-of-thought dropped");
  assert.equal(structuredReply.body.assistantTurn.parts[0].text, "嗯。", "first spoken bubble is the body line");
  assert.equal(structuredReply.body.assistantTurn.parts[1].text, "知道了。", "second spoken bubble is the body line");
  assert.equal(structuredReply.body.assistantTurn.unspokenAside, "内心：其实我有点内疚", "inner-voice inner voice moved to unspokenAside");
  for (const part of structuredReply.body.assistantTurn.parts) assert.equal(part.text.includes("<thinking>") || part.text.includes("<inner-voice>"), false, "no structural tag leaks into a bubble");
  assert.equal(String(structuredReply.body.assistantTurn.unspokenAside).includes("<inner-voice>"), false, "aside carries no tag markers");
  const memoryMarkerOpen = String.fromCharCode(0x3014, 0x8bb0, 0x5f55, 0x3015);
  const memoryMarkerClose = String.fromCharCode(0x3014, 0x2f, 0x8bb0, 0x5f55, 0x3015);
  const memoryReply = await handleChat({ connection, request }, { fetchImpl: async (url, options) => ({ ok: true, status: 200, text: async () => JSON.stringify({ id: "provider-memory", choices: [{ message: { content: `好的。${memoryMarkerOpen}{"kind":"shared_event","content":"下周一起去看海","certainty":"explicit"}${memoryMarkerClose}` } }], usage: {} }) }) });
  assert.equal(memoryReply.status, 200);
  assert.equal(memoryReply.body.memoryCandidates.length, 1, "record marker becomes a memory candidate");
  assert.equal(memoryReply.body.memoryCandidates[0].kind, "shared_event");
  assert.deepEqual(memoryReply.body.memoryCandidates[0].evidence.sourceTurnIds, ["user-1", "turn-request-1"]);
  assert.equal(memoryReply.body.assistantTurn.parts[0].text.includes("记录"), false, "record marker does not leak into the spoken bubble");
  const extensionMemory = await handleChat({ connection, request }, { fetchImpl: async (url, options) => ({ ok: true, status: 200, text: async () => JSON.stringify({ id: "provider-memory-extension", choices: [{ message: { content: "收到。", memoryCandidates: [{ id: "extension-1", kind: "open_thread", content: "Continue this topic later.", evidence: { sourceTurnIds: ["user-1"], certainty: "inferred" } }] } }], usage: {} }) }) });
  assert.equal(extensionMemory.body.memoryCandidates[0].kind, "open_thread", "provider extension candidates are normalized");
  assert.equal(extensionMemory.body.memoryCandidates[0].evidence.certainty, "inferred");
  const toolCallMemory = await handleChat({ connection, request }, { fetchImpl: async (url, options) => ({ ok: true, status: 200, text: async () => JSON.stringify({ id: "provider-memory-tool", choices: [{ message: { content: "我记下了。", tool_calls: [{ type: "function", function: { name: "record_memory", arguments: JSON.stringify({ kind: "shared_event", content: "周末一起看展", certainty: "explicit" }) } }] } }], usage: {} }) }) });
  assert.equal(toolCallMemory.body.memoryCandidates[0].content, "周末一起看展", "provider tool call becomes a memory candidate");
  const unrelatedToolCall = await handleChat({ connection, request }, { fetchImpl: async (url, options) => ({ ok: true, status: 200, text: async () => JSON.stringify({ id: "provider-unrelated-tool", choices: [{ message: { content: "收到。", tool_calls: [{ type: "function", function: { name: "search_web", arguments: JSON.stringify({ kind: "shared_event", content: "不应被记录" }) } }] } }], usage: {} }) }) });
  assert.deepEqual(unrelatedToolCall.body.memoryCandidates, [], "unrelated provider tools cannot create memory candidates");
  const multiLineVoice = await handleChat({ connection, request }, { fetchImpl: async (url, options) => ({ ok: true, status: 200, text: async () => JSON.stringify({ id: "provider-mlv", choices: [{ message: { role: "assistant", content: "行吧。\n<inner-voice>内心：有点累\n内心：但还是想陪他</inner-voice>" } }], usage: {} }) }) });
  assert.equal(multiLineVoice.body.assistantTurn.parts.length, 1, "body bubble only");
  assert.equal(multiLineVoice.body.assistantTurn.parts[0].text, "行吧。", "body text retained when voice spans multiple lines");
  assert.equal(multiLineVoice.body.assistantTurn.unspokenAside, "内心：有点累\n内心：但还是想陪他", "multi-line inner-voice joined onto aside");

  const bracketAction = await handleChat({ connection, request }, { fetchImpl: async (url, options) => ({ ok: true, status: 200, text: async () => JSON.stringify({ id: "provider-action", choices: [{ message: { role: "assistant", content: "（想了一下，语气随和）那倒也是。\n要不这样，下回约你。\n（点头）" } }], usage: {} }) }) });
  assert.equal(bracketAction.status, 200);
  assert.equal(bracketAction.body.assistantTurn.parts.length, 2, "solo bracketed-action bubble dropped entirely");
  assert.equal(bracketAction.body.assistantTurn.parts[0].text, "那倒也是。", "leading bracketed action stripped from spoken text");
  assert.equal(bracketAction.body.assistantTurn.parts[1].text, "要不这样，下回约你。", "plain bubble untouched");
  assert.ok(!JSON.stringify(bracketAction.body.assistantTurn.parts).includes("（"), "no bracket remains in any part");

  const invalidJson = await handleChat({ connection, request }, { fetchImpl: async () => ({ ok: true, status: 200, text: async () => "not-json" }) });
  assert.equal(invalidJson.body.error.code, "UPSTREAM_INVALID_JSON");
  const emptyChoices = await handleChat({ connection, request }, { fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ choices: [] }) }) });
  assert.equal(emptyChoices.body.error.code, "UPSTREAM_EMPTY_CHOICES");
  const badContent = await handleChat({ connection, request }, { fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: { bad: true } } }] }) }) });
  assert.equal(badContent.body.error.code, "UPSTREAM_INVALID_CONTENT");
  const authFailure = await handleChat({ connection, request }, { fetchImpl: async () => ({ ok: false, status: 401, text: async () => "secret-key" }) });
  assert.equal(authFailure.status, 502);
  assert.equal(authFailure.body.error.code, "UPSTREAM_AUTH");
  assert.equal(JSON.stringify(authFailure.body).includes("secret-key"), false);
  assert.equal(authFailure.body.assistantTurn, undefined);
  const tooLarge = await handleChat({ connection, request: { ...request, userMessage: { id: "user-1", text: "x".repeat(16001) } } });
  assert.equal(tooLarge.status, 400);
  assert.equal(tooLarge.body.error.code, "INVALID_REQUEST");
  const forbidden = await handleChat({ connection, request: { ...request, apiKey: "should-not-be-here" } });
  assert.equal(forbidden.body.error.code, "INVALID_REQUEST");
  const nestedForbidden = await handleChat({ connection, request: { ...request, runtimeContext: { api_key: "should-not-be-here" } } });
  assert.equal(nestedForbidden.body.error.code, "INVALID_REQUEST", "nested credential-shaped fields remain blocked");
  const invalidExperience = await handleChat({ connection, request: { ...request, experienceSettings: { ...contracts.DEFAULT_EXPERIENCE_SETTINGS, contextScope: "unsupported" } } });
  assert.equal(invalidExperience.body.error.code, "INVALID_REQUEST");
  const providerTestRequests = [];
  const providerTest = await handleProviderTest({ connection }, { fetchImpl: async (url, options) => {
    providerTestRequests.push({ url, options });
    if (url.endsWith("/models")) return { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ id: "model-neutral" }] }) };
    assert.equal(url, "https://provider.example.test/v1/chat/completions");
    const body = JSON.parse(options.body);
    assert.equal(body.model, "model-neutral", "the selected model is verified by an actual completion request");
    assert.equal(body.messages[0].content, "Reply with exactly: OK");
    return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: "OK" } }] }) };
  } });
  assert.equal(providerTest.status, 200);
  assert.equal(providerTestRequests.length, 2, "model discovery and real model verification are distinct steps");
  assert.equal(providerTest.body.discovery.includesConfiguredModel, true);
  assert.equal(providerTest.body.probe.status, "success");

  const noModelsProviderTest = await handleProviderTest({ connection: { ...connection, baseUrl: "https://provider.example.test/v1/chat/completions" } }, { fetchImpl: async (url) => {
    if (url.endsWith("/models")) return { ok: false, status: 404, text: async () => JSON.stringify({ error: { message: "models endpoint unavailable" } }) };
    assert.equal(url, "https://provider.example.test/v1/chat/completions", "a full chat endpoint is normalized instead of duplicated");
    return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: "OK" } }] }) };
  } });
  assert.equal(noModelsProviderTest.status, 200, "a missing optional models endpoint does not invalidate a working chat model");
  assert.equal(noModelsProviderTest.body.discovery.status, "unavailable");

  const falsePositiveModelsTest = await handleProviderTest({ connection }, { fetchImpl: async (url) => {
    if (url.endsWith("/models")) return { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ id: "model-neutral" }] }) };
    return { ok: false, status: 401, text: async () => JSON.stringify({ error: { message: "bad key secret-key" } }) };
  } });
  assert.equal(falsePositiveModelsTest.body.error.code, "UPSTREAM_AUTH", "a successful model list cannot mask a failed real completion");
  assert.equal(JSON.stringify(falsePositiveModelsTest.body).includes("secret-key"), false, "provider errors never echo the configured key");
  const blockedHost = await handleChat({ connection: { ...connection, baseUrl: "http://127.0.0.1:1234/v1" }, request }, { fetchImpl: fakeProvider });
  assert.equal(blockedHost.body.error.code, "INVALID_PROVIDER_URL");
  const devHost = await handleChat({ connection: { ...connection, baseUrl: "http://127.0.0.1:1234/v1" }, request }, { fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ id: "provider-dev", choices: [{ message: { content: "A dev reply." } }] }) }), allowInsecureDev: true });
  assert.equal(devHost.status, 200);
  console.log("proxy: 46 assertions passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
