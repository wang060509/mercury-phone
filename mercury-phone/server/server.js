"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { handleChat, handleProviderTest, handleRoleAnalysis } = require("./chat-handler.js");
const { handleCinema } = require("./cinema-handler.js");

const APP_ROOT = path.resolve(process.env.MERCURY_STATIC_ROOT || path.join(__dirname, "..", "app"));
const MAX_REQUEST_BODY = 128 * 1024;
const PORT = Number(process.env.MERCURY_PORT || 5500);
const HOST = process.env.MERCURY_HOST || "127.0.0.1";
const allowInsecureDev = process.env.MERCURY_ALLOW_INSECURE_PROVIDER === "1";
const MIME = Object.freeze({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".woff2": "font/woff2" });

function sendJson(response, status, body) {
  const serialized = JSON.stringify(body);
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  response.end(serialized);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    request.on("data", (chunk) => { size += chunk.length; if (size > MAX_REQUEST_BODY) { reject(Object.assign(new Error("Request body is too large."), { code: "REQUEST_TOO_LARGE" })); request.destroy(); return; } chunks.push(chunk); });
    request.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch (_) { reject(Object.assign(new Error("Request body must be valid JSON."), { code: "INVALID_JSON" })); } });
    request.on("error", reject);
  });
}

function safeFilePath(urlPath) {
  let decoded; try { decoded = decodeURIComponent(urlPath); } catch (_) { return null; }
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const target = path.resolve(APP_ROOT, relative);
  return target === APP_ROOT || target.startsWith(`${APP_ROOT}${path.sep}`) ? target : null;
}

function serveStatic(request, response, pathname) {
  const filePath = safeFilePath(pathname);
  if (!filePath) return sendJson(response, 400, { ok: false, error: { code: "INVALID_PATH", message: "Invalid path.", retryable: false } });
  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) return sendJson(response, 404, { ok: false, error: { code: "NOT_FOUND", message: "Not found.", retryable: false } });
    response.writeHead(200, { "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    fs.createReadStream(filePath).pipe(response);
  });
}

const server = http.createServer(async (request, response) => {
  let url;
  try { url = new URL(request.url, `http://${request.headers.host || "localhost"}`); } catch (_) { return sendJson(response, 400, { ok: false, error: { code: "INVALID_URL", message: "Invalid URL.", retryable: false } }); }
  if (url.pathname === "/api/chat" || url.pathname === "/api/provider/test" || url.pathname === "/api/role-analysis" || url.pathname === "/api/cinema") {
    if (request.method !== "POST") return sendJson(response, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "POST is required.", retryable: false } });
    if (!String(request.headers["content-type"] || "").toLowerCase().startsWith("application/json")) return sendJson(response, 415, { ok: false, error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "JSON is required.", retryable: false } });
    try {
      const payload = await readJson(request);
      const result = url.pathname === "/api/chat" ? await handleChat(payload, { allowInsecureDev }) : url.pathname === "/api/role-analysis" ? await handleRoleAnalysis(payload, { allowInsecureDev, timeoutMs: 105000 }) : url.pathname === "/api/cinema" ? await handleCinema(payload, { allowInsecureDev, timeoutMs: 105000 }) : await handleProviderTest(payload, { allowInsecureDev });
      return sendJson(response, result.status, result.body);
    } catch (error) {
      const code = error.code === "REQUEST_TOO_LARGE" ? "REQUEST_TOO_LARGE" : error.code === "INVALID_JSON" ? "INVALID_JSON" : "INVALID_REQUEST";
      return sendJson(response, code === "REQUEST_TOO_LARGE" ? 413 : 400, { ok: false, error: { code, message: code === "REQUEST_TOO_LARGE" ? "Request body is too large." : "The request is invalid.", retryable: false } });
    }
  }
  if (request.method !== "GET" && request.method !== "HEAD") return sendJson(response, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed.", retryable: false } });
  return serveStatic(request, response, url.pathname);
});

if (require.main === module) server.listen(PORT, HOST, () => console.log(`Mercury Phone dev server: http://${HOST}:${PORT}`));
module.exports = server;
