"use strict";

const assert = require("node:assert/strict");
const { handleCinema } = require("../cinema-handler.js");

const connection = { baseUrl: "https://provider.example.test/v1", apiKey: "secret-key", model: "model-neutral" };
const request = {
  requestId: "cinema-request-1",
  instanceId: "cinema-instance-1",
  userText: "我接过课程册。",
  systemPrompt: "续写纯文字长篇故事。",
  history: [
    { role: "assistant", text: "风吹过长草坡。" },
    { role: "user", text: "我向她挥手。" },
  ],
};

(async () => {
  let providerBody = null;
  const success = await handleCinema({ connection, request }, { fetchImpl: async (url, options) => {
    assert.equal(url, "https://provider.example.test/v1/chat/completions");
    providerBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ choices: [{ message: { content: "（她没有立刻回答。）\n\n露弥把课程册翻到折角那一页。" } }], usage: { prompt_tokens: 11, completion_tokens: 17, total_tokens: 28 } }),
    };
  } });
  assert.equal(success.status, 200);
  assert.equal(providerBody.stream, false);
  assert.equal(providerBody.max_tokens, 1800);
  assert.equal(providerBody.messages[0].role, "system");
  assert.equal(providerBody.messages.at(-1).content, request.userText);
  assert.equal(success.body.text, "（她没有立刻回答。）\n\n露弥把课程册翻到折角那一页。", "Cinema preserves prose and parenthetical narration instead of Chat bubble normalization");
  assert.equal(success.body.usage.totalTokens, 28);
  assert.equal(JSON.stringify(success.body).includes("secret-key"), false);

  const forbidden = await handleCinema({ connection, request: { ...request, apiKey: "leak" } });
  assert.equal(forbidden.status, 400);
  assert.equal(forbidden.body.error.code, "INVALID_REQUEST");
  const invalid = await handleCinema({ connection, request: { ...request, history: [{ role: "system", text: "bad" }] } });
  assert.equal(invalid.body.error.code, "INVALID_REQUEST");

  console.log("cinema-server: assertions passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
