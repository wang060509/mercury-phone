"use strict";

const { validateCinemaProxyRequest } = require("./server-contracts.js");
const { createProviderAdapter, parseAssistantText, UpstreamError } = require("./provider-adapter.js");

function errorResponse(error) {
  const known = error instanceof UpstreamError || error?.code === "INVALID_REQUEST";
  return {
    status: known && Number.isInteger(error.status) ? error.status : 400,
    body: {
      ok: false,
      error: {
        code: known ? error.code : "INVALID_REQUEST",
        message: known ? error.message : "The Cinema request is invalid.",
        retryable: known ? error.retryable === true : false,
      },
    },
  };
}

async function requestCinema(connection, request, options = {}) {
  const adapter = createProviderAdapter(connection, options);
  const messages = [{ role: "system", content: request.systemPrompt }];
  request.history.forEach((entry) => messages.push({ role: entry.role, content: entry.text }));
  messages.push({ role: "user", content: request.userText });
  const body = await adapter.createChatCompletion(messages, {
    max_tokens: 1800,
    temperature: .82,
    stream: false,
  }, { timeoutMs: options.timeoutMs || 105000, signal: options.signal });
  const text = parseAssistantText(body).trim();
  if (!text) throw new UpstreamError("UPSTREAM_INVALID_CONTENT", "The provider returned no Cinema prose.", 502, false);
  const usage = body?.usage && typeof body.usage === "object" ? {
    inputTokens: Number.isFinite(body.usage.prompt_tokens) ? body.usage.prompt_tokens : null,
    outputTokens: Number.isFinite(body.usage.completion_tokens) ? body.usage.completion_tokens : null,
    totalTokens: Number.isFinite(body.usage.total_tokens) ? body.usage.total_tokens : null,
    providerReported: true,
  } : null;
  return Object.freeze({ requestId: request.requestId, text, usage, warnings: [] });
}

async function handleCinema(payload, options = {}) {
  try {
    const value = validateCinemaProxyRequest(payload);
    return { status: 200, body: await requestCinema(value.connection, value.request, options) };
  } catch (error) {
    return errorResponse(error);
  }
}

module.exports = Object.freeze({ handleCinema, requestCinema });
