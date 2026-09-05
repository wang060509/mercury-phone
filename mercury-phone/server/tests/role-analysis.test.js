"use strict";

const assert = require("node:assert/strict");
const { handleRoleAnalysis } = require("../chat-handler.js");
const roleContracts = require("../../app/core/role-analysis-contracts.js");

const connection = { baseUrl: "https://provider.example.test/v1", apiKey: "secret-key", model: "model-neutral" };
const input = { schemaVersion: 1, displayName: "River", sourceText: "A careful guide keeps the harbor open at dusk.", truncated: false };

(async () => {
  let providerBody = null;
  const result = await handleRoleAnalysis({ connection, input }, { fetchImpl: async (url, options) => {
    assert.equal(url, "https://provider.example.test/v1/chat/completions");
    providerBody = JSON.parse(options.body);
    return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: '```json\n{"schemaVersion":1,"analysis":{"identity":"Harbor guide","stableTraits":["calm"]}}\n```' } }] }) };
  } });
  assert.equal(result.status, 200);
  assert.equal(result.body.schemaVersion, roleContracts.SCHEMA_VERSION);
  assert.equal(result.body.analysis.identity, "Harbor guide");
  assert.deepEqual(result.body.analysis.stableTraits, ["calm"]);
  assert.equal(providerBody.messages[0].role, "system");
  assert.equal(providerBody.messages[1].content.includes(input.sourceText), true);
  assert.equal(providerBody.max_tokens, 1800);
  assert.equal(JSON.stringify(result.body).includes("secret-key"), false);

  const invalid = await handleRoleAnalysis({ connection, input }, { fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: "not json" } }] }) }) });
  assert.equal(invalid.status, 502);
  assert.equal(invalid.body.error.code, "UPSTREAM_INVALID_ANALYSIS");
  const forbidden = await handleRoleAnalysis({ connection, input: { ...input, apiKey: "secret" } });
  assert.equal(forbidden.status, 400);
  assert.equal(forbidden.body.error.code, "INVALID_REQUEST");
  console.log("role-analysis: 11 assertions passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
