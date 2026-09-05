"use strict";

// Local-only provider fixture for browser acceptance. It deliberately speaks
// the OpenAI-compatible subset used by Mercury and never leaves 127.0.0.1.
const http = require("node:http");

const HOST = "127.0.0.1";
const PORT = Number(process.env.MERCURY_DEMO_PROVIDER_PORT || 5501);
const MAX_BODY = 128 * 1024;

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  response.end(JSON.stringify(body));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("Request body is too large."), { code: "REQUEST_TOO_LARGE" }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch (_) { reject(Object.assign(new Error("Request body must be valid JSON."), { code: "INVALID_JSON" })); }
    });
    request.on("error", reject);
  });
}

function completionBody(requestBody) {
  const latestUserMessage = Array.isArray(requestBody?.messages) ? requestBody.messages.at(-1) : null;
  const latestText = typeof latestUserMessage?.content === "string" ? latestUserMessage.content : "";
  const content = latestText.includes("不记录") ? "好的，这条先不保存。" : "我记下来了。周末一起看展。";
  const toolCalls = latestText.includes("不记录") ? [] : [{
    type: "function",
    function: {
      name: "record_memory",
      arguments: JSON.stringify({ kind: "shared_event", content: "周末一起看展", certainty: "explicit" }),
    },
  }];
  return {
    id: `demo-completion-${Date.now()}`,
    object: "chat.completion",
    choices: [{ index: 0, message: { role: "assistant", content, tool_calls: toolCalls }, finish_reason: "stop" }],
    usage: { prompt_tokens: 24, completion_tokens: 12, total_tokens: 36 },
  };
}

const server = http.createServer(async (request, response) => {
  let url;
  try { url = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`); }
  catch (_) { return sendJson(response, 400, { error: { message: "Invalid URL." } }); }

  if (url.pathname === "/v1/models" && request.method === "GET") {
    return sendJson(response, 200, { object: "list", data: [{ id: "mercury-local-demo", object: "model", owned_by: "local" }] });
  }
  if (url.pathname === "/v1/chat/completions" && request.method === "POST") {
    try { return sendJson(response, 200, completionBody(await readJson(request))); }
    catch (error) { return sendJson(response, error.code === "REQUEST_TOO_LARGE" ? 413 : 400, { error: { message: error.message } }); }
  }
  return sendJson(response, 404, { error: { message: "Not found." } });
});

if (require.main === module) server.listen(PORT, HOST, () => console.log(`Mercury local demo provider: http://${HOST}:${PORT}/v1`));

module.exports = Object.freeze({ server, completionBody });
