"use strict";

const { validateProxyRequest, validateProviderTestRequest, validateRoleAnalysisRequest } = require("./server-contracts.js");
const { requestProvider, requestRoleAnalysis, testProvider, UpstreamError } = require("./upstream-client.js");

function errorResponse(error) {
  const known = error instanceof UpstreamError || error?.code === "INVALID_REQUEST";
  const status = known && Number.isInteger(error.status) ? error.status : error?.code === "INVALID_REQUEST" ? 400 : 400;
  return { status, body: { ok: false, error: { code: known ? error.code : "INVALID_REQUEST", message: known ? error.message : "The request is invalid.", retryable: known ? error.retryable === true : false } } };
}

async function handleChat(payload, options = {}) {
  try { const value = validateProxyRequest(payload); return { status: 200, body: await requestProvider(value.connection, value.request, options) }; } catch (error) { return errorResponse(error); }
}

async function handleProviderTest(payload, options = {}) {
  try {
    const value = validateProviderTestRequest(payload);
    const result = await testProvider(value.connection, options);
    return { status: 200, body: { ok: true, ...result } };
  } catch (error) { return errorResponse(error); }
}

async function handleRoleAnalysis(payload, options = {}) {
  try { const value = validateRoleAnalysisRequest(payload); return { status: 200, body: await requestRoleAnalysis(value.connection, value.input, options) }; } catch (error) { return errorResponse(error); }
}

module.exports = Object.freeze({ handleChat, handleProviderTest, handleRoleAnalysis });
