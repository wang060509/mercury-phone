"use strict";

const contracts = require("../app/core/chat-contracts.js");
const roleAnalysisContracts = require("../app/core/role-analysis-contracts.js");
const { UpstreamError, assertProviderUrl, createProviderAdapter, parseAssistantText } = require("./provider-adapter.js");

const MAX_BUBBLES = 4;
const DEFAULT_CHAT_TIMEOUT_MS = 90000;
const DEFAULT_PROVIDER_TEST_TIMEOUT_MS = 45000;

const SENTENCE_END = /([。！？；……!?])/;
const ASIDE_OPEN = "〔心声〕";
const ASIDE_CLOSE = "〔/心声〕";
const STRUCTURE_TAG = /<(\/)?(thinking|inner-voice)\b[^>]*>/gi;
const MEMORY_BLOCK = /〔记录〕([\s\S]*?)〔\/记录〕/g;
const MEMORY_KINDS = new Set(["shared_event", "open_thread"]);

// Structural three-part format: <thinking>…</thinking> → body bubbles →
// <inner-voice>…</inner-voice>. The model dumps its chain-of-thought inside
// <thinking> and its unspoken inner voice inside <inner-voice>; both must be
// stripped out so the user only ever sees the spoken body. Order is tolerant:
// tags are matched wherever they appear, anything outside <thinking>/<inner-voice>
// is spoken body.
function extractStructure(text) {
  const source = String(text || "");
  if (!STRUCTURE_TAG.test(source)) return { aside: null, body: source.trim(), tagged: false };
  STRUCTURE_TAG.lastIndex = 0;
  const bodyFragments = [];
  const asideFragments = [];
  let mode = "body"; // body | aside (inside inner-voice) | drop (inside thinking)
  let cursor = 0;
  let match;
  while ((match = STRUCTURE_TAG.exec(source))) {
    const closing = !!match[1];
    const kind = match[2].toLowerCase();
    const before = source.slice(cursor, match.index);
    if (mode === "body") { if (before.trim()) bodyFragments.push(before); }
    else if (mode === "aside") { if (before.trim()) asideFragments.push(before); }
    if (!closing) mode = kind === "inner-voice" ? "aside" : "drop";
    else mode = "body";
    cursor = STRUCTURE_TAG.lastIndex;
  }
  const tail = source.slice(cursor);
  if (mode === "body") { if (tail.trim()) bodyFragments.push(tail); }
  else if (mode === "aside") { if (tail.trim()) asideFragments.push(tail); }
  const body = bodyFragments.join("\n").replace(/\r?\n+/g, "\n").trim();
  const aside = asideFragments.join("\n").trim();
  return { aside: aside || null, body, tagged: true };
}

// The model may wrap a character's unspoken inner thought in 〔心声〕…〔/心声〕.
// Pull every such block out into the unspokenAside field and strip the markers
// from the spoken text so the thought renders as its own inner-voice bubble.
function extractAside(text) {
  const source = String(text || "");
  const matches = [];
  let leftover = source;
  let from = 0;
  while (true) {
    const open = leftover.indexOf(ASIDE_OPEN, from);
    if (open < 0) break;
    const close = leftover.indexOf(ASIDE_CLOSE, open + ASIDE_OPEN.length);
    if (close < 0) break;
    const inner = leftover.slice(open + ASIDE_OPEN.length, close).trim();
    if (inner) matches.push(inner);
    from = close + ASIDE_CLOSE.length;
  }
  const aside = matches.join("\n").trim();
  if (!matches.length) return { aside: null, body: source.trim() };
  const body = source.split(ASIDE_OPEN).map((segment, index) => {
    if (index === 0) return segment;
    const closeIndex = segment.indexOf(ASIDE_CLOSE);
    return closeIndex >= 0 ? segment.slice(closeIndex + ASIDE_CLOSE.length) : segment;
  }).join("").replace(/\n\s*\n/g, "\n").trim();
  return { aside: aside || null, body };
}

function cutSentences(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return [];
  const rough = trimmed.split(SENTENCE_END).map((s) => s.trim()).filter(Boolean);
  const sentences = [];
  for (let i = 0; i < rough.length; i += 1) {
    const piece = rough[i];
    const marker = rough[i + 1];
    if (marker) { sentences.push(piece + marker); i += 1; }
    else if (piece) sentences.push(piece);
  }
  const result = [];
  for (const sentence of sentences) {
    if (!sentence) continue;
    if (result.length < MAX_BUBBLES) result.push(sentence);
    else result[result.length - 1] += "\n" + sentence;
  }
  return result;
}

function splitBubbles(text) {
  const raw = String(text || "").split(/\r?\n+/).map((line) => line.trim()).filter(Boolean);
  if (raw.length > 1) {
    const bubbles = [];
    for (const line of raw) {
      if (bubbles.length < MAX_BUBBLES) bubbles.push(line);
      else bubbles[bubbles.length - 1] += "\n" + line;
    }
    return bubbles;
  }
  const single = String(text || "").trim();
  // No newlines: still break an overlong message into several short texts so a
  // reply does not arrive as one long run-on. Fall back to sentences.
  const cut = cutSentences(single);
  if (cut.length > 1) return cut;
  return [single];
}

function parseMemoryPayload(value) {
  const source = String(value || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  if (!source) return [];
  try {
    const parsed = JSON.parse(source);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (_) {
    return [];
  }
}

function extractProviderMemoryCandidates(body) {
  const message = body?.choices?.[0]?.message;
  const candidates = [];
  if (Array.isArray(message?.memoryCandidates)) candidates.push(...message.memoryCandidates);
  if (Array.isArray(body?.memoryCandidates)) candidates.push(...body.memoryCandidates);

  // Some OpenAI-compatible providers expose structured side effects through
  // tool_calls instead of a custom memoryCandidates extension. We only accept
  // the two names used by the Mercury memory protocol, so arbitrary tools
  // cannot accidentally become relationship records.
  const toolCalls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
  toolCalls.forEach((call) => {
    const name = call?.function?.name;
    if (name !== "record_memory" && name !== "memory_candidates") return;
    candidates.push(...parseMemoryPayload(call?.function?.arguments));
  });
  return candidates;
}

function extractMemoryCandidates(text) {
  const candidates = [];
  MEMORY_BLOCK.lastIndex = 0;
  const spoken = String(text || "").replace(MEMORY_BLOCK, (_, payload) => {
    candidates.push(...parseMemoryPayload(payload));
    return "";
  }).replace(/\n{3,}/g, "\n\n").trim();
  return { spoken, candidates };
}

function normalizeMemoryCandidates(candidates, request, assistantTurnId) {
  const warnings = [];
  const normalized = [];
  const seen = new Set();
  (Array.isArray(candidates) ? candidates : []).slice(0, 8).forEach((candidate, index) => {
    if (!candidate || typeof candidate !== "object" || !MEMORY_KINDS.has(candidate.kind) || typeof candidate.content !== "string" || !candidate.content.trim()) {
      warnings.push("invalid_memory_candidate_ignored");
      return;
    }
    const content = candidate.content.trim();
    const dedupeKey = `${candidate.kind}:${content}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    const sourceTurnIds = Array.from(new Set([
      ...(Array.isArray(candidate.evidence?.sourceTurnIds) ? candidate.evidence.sourceTurnIds : []),
      request.userMessage.id,
      assistantTurnId,
    ].filter((value) => typeof value === "string" && value.trim())));
    const value = {
      id: typeof candidate.id === "string" && candidate.id.trim() ? candidate.id.trim() : `memory-${request.requestId}-${index + 1}`,
      kind: candidate.kind,
      content,
      evidence: {
        sourceTurnIds,
        certainty: candidate.evidence?.certainty === "inferred" ? "inferred" : "explicit",
      },
    };
    try {
      contracts.validateMemoryCandidate(value);
      normalized.push(value);
    } catch (_) {
      warnings.push("invalid_memory_candidate_ignored");
    }
  });
  return { candidates: normalized.slice(0, 4), warnings };
}

// Models on immersive roleplay tend to staple a bracketed action onto the start of a
// line, e.g. （笑了笑）说实话…. That is prose, not what a person would type in a text
// message; strip it out entirely so a bubble is always pure spoken words. This is the
// render-layer guarantee we bank on because no prompt wording has reliably stopped it.
const ACTION_PAREN = /[（(][^（）()]*[）)]/g;
function stripActions(text) {
  return String(text || "")
    .replace(ACTION_PAREN, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function providerMessages(request) {
  const messages = [];
  if (typeof request.systemPrompt === "string" && request.systemPrompt.trim()) messages.push({ role: "system", content: request.systemPrompt.trim() });
  const recent = Array.isArray(request.recentMessages) ? request.recentMessages : [];
  recent.filter((entry) => entry.id !== request.userMessage.id).map((entry) => ({
    role: entry.role,
    content: entry.role === "user" ? entry.text : entry.parts.map((part) => part.text).join("\n"),
  })).filter((entry) => entry.content).forEach((entry) => messages.push(entry));
  messages.push({ role: "user", content: request.userMessage.text });
  return messages;
}

function mapUsage(value) {
  if (!value || typeof value !== "object") return null;
  return { inputTokens: Number.isFinite(value.prompt_tokens) ? value.prompt_tokens : null, outputTokens: Number.isFinite(value.completion_tokens) ? value.completion_tokens : null, totalTokens: Number.isFinite(value.total_tokens) ? value.total_tokens : null, providerReported: true };
}

async function requestProvider(connection, request, options = {}) {
  const adapter = createProviderAdapter(connection, options);
  try {
    const body = await adapter.createChatCompletion(providerMessages(request), {}, { timeoutMs: options.timeoutMs || DEFAULT_CHAT_TIMEOUT_MS, signal: options.signal });
    const text = parseAssistantText(body);
    if (!Array.isArray(body?.choices) || !body.choices.length) throw new UpstreamError("UPSTREAM_EMPTY_CHOICES", "The provider returned no choices.", 502, false);
    if (!text) throw new UpstreamError("UPSTREAM_INVALID_CONTENT", "The provider returned no assistant text.", 502, false);
    const memoryFromText = extractMemoryCandidates(text);
    const providerMemory = extractProviderMemoryCandidates(body);
    const assistantTurnId = `turn-${request.requestId}`;
    const memories = normalizeMemoryCandidates([...providerMemory, ...memoryFromText.candidates], request, assistantTurnId);
    const structured = extractStructure(memoryFromText.spoken);
    let aside = structured.aside;
    let spoken = structured.body;
    // The model may also still emit a stray 〔心声〕…〔/心声〕 inline; strip it onto the
    // aside too so narration never leaks into a spoken bubble.
    const inner = extractAside(spoken);
    if (inner.aside) aside = aside ? aside + "\n" + inner.aside : inner.aside;
    spoken = inner.body;
    const bubbles = splitBubbles(spoken);
    if (process.env.MERCURY_DEBUG_UPSTREAM === "1") {
      const sysPrompt = String(request.systemPrompt || "");
      // eslint-disable-next-line no-console
      console.log(`[DEBUG][${connection.model}] === RAW MODEL TEXT ===\n${text}\n=== END RAW ===\n=== BUBBLES ===\n${JSON.stringify(bubbles)}\n=== ASIDE ===\n${aside || "(none)"}\n=== 提示词含括号禁令: ${sysPrompt.includes("括号")} ===`);
      // eslint-disable-next-line no-console
      console.log(`[DEBUG] === SYSTEM PROMPT (前1200字) ===\n${sysPrompt.slice(0, 1200)}`);
    }
    const parts = bubbles.map((bubble) => stripActions(bubble)).filter(Boolean).map((bubble, index) => ({ id: `part-${request.requestId}-${index + 1}`, text: bubble, order: index, pauseAfter: "none", deliveryStatus: "delivered" }));
    const normalized = { requestId: request.requestId, assistantTurn: { id: assistantTurnId, role: "assistant", parts, status: "complete", createdAt: new Date().toISOString(), unspokenAside: aside }, memoryCandidates: memories.candidates, usage: mapUsage(body.usage), warnings: memories.warnings };
    const result = contracts.parseApiResponse(normalized);
    contracts.validateChatApiResponse(result);
    return result;
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    if (error?.name === "AbortError") throw new UpstreamError("UPSTREAM_CANCELLED", "The provider request was cancelled.", 499, false);
    throw new UpstreamError("UPSTREAM_UNAVAILABLE", "The provider is unavailable.", 502, true);
  }
}

function analysisMessages(input) {
  return [
    { role: "system", content: "You extract a compact structured role profile from source text. Use only stated facts. Return exactly one JSON object and no Markdown. The object must have schemaVersion: 1 and analysis. analysis may contain only identity, summary, background, careStyle, conflictStyle, defenseStyle, voiceStyle, relationshipSummary, openingMessage, scenePresentation, creatorNotes, stableTraits, motivations, fears, values, boundaries, cognitionLimits, changeThresholds, alternateGreetings, exampleDialogues, tags. Omit unsupported fields. Keep each text field under 250 characters and each list to 8 brief items. Do not repeat source passages. Do not include worldbook entries, private source metadata, or an API key." },
    { role: "user", content: `Role name: ${input.displayName}\n\nSource text:\n${input.sourceText}` },
  ];
}

function parseAnalysisJson(value) {
  const source = String(value || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end < start) throw new UpstreamError("UPSTREAM_INVALID_ANALYSIS", "The provider did not return a JSON role analysis.", 502, false);
  try { return JSON.parse(source.slice(start, end + 1)); }
  catch (_) { throw new UpstreamError("UPSTREAM_INVALID_ANALYSIS", "The provider did not return a JSON role analysis.", 502, false); }
}

async function requestRoleAnalysis(connection, input, options = {}) {
  const adapter = createProviderAdapter(connection, options);
  try {
    const body = await adapter.createChatCompletion(analysisMessages(input), { max_tokens: 1800 }, { timeoutMs: options.timeoutMs || 105000, signal: options.signal });
    const rawText = parseAssistantText(body);
    if (!Array.isArray(body?.choices) || !body.choices.length || !rawText) throw new UpstreamError("UPSTREAM_INVALID_ANALYSIS", "The provider returned no role analysis.", 502, false);
    const analysis = roleAnalysisContracts.normalizeAnalysis(parseAnalysisJson(rawText));
    return { schemaVersion: roleAnalysisContracts.SCHEMA_VERSION, analysis, sourceTruncated: input.truncated === true, warnings: [] };
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    if (error?.name === "AbortError") throw new UpstreamError("UPSTREAM_CANCELLED", "The provider request was cancelled.", 499, false);
    throw new UpstreamError("UPSTREAM_UNAVAILABLE", "The provider is unavailable.", 502, true);
  }
}

async function testProvider(connection, options = {}) {
  const adapter = createProviderAdapter(connection, options);
  const discovery = await adapter.discoverModels({ timeoutMs: Math.min(options.discoveryTimeoutMs || 12000, 12000), signal: options.signal });
  const body = await adapter.createChatCompletion([
    { role: "user", content: "Reply with exactly: OK" },
  ], { temperature: 0, max_tokens: 4096 }, { timeoutMs: options.timeoutMs || DEFAULT_PROVIDER_TEST_TIMEOUT_MS, signal: options.signal });
  const preview = parseAssistantText(body);
  if (!Array.isArray(body?.choices) || !body.choices.length) throw new UpstreamError("UPSTREAM_EMPTY_CHOICES", "The provider returned no choices for the selected model.", 502, false);
  if (!preview) throw new UpstreamError("UPSTREAM_INVALID_CONTENT", "The selected model returned no assistant text.", 502, false);
  return Object.freeze({
    provider: connection.provider || "openai-compatible",
    model: connection.model,
    discovery: Object.freeze({
      status: discovery.status,
      count: discovery.models.length,
      includesConfiguredModel: discovery.status === "available" ? discovery.models.includes(connection.model) : null,
      ...(discovery.reason ? { reason: discovery.reason } : {}),
    }),
    probe: Object.freeze({ status: "success", preview: preview.replace(/\s+/g, " ").slice(0, 80) }),
  });
}

module.exports = Object.freeze({ UpstreamError, DEFAULT_CHAT_TIMEOUT_MS, DEFAULT_PROVIDER_TEST_TIMEOUT_MS, assertProviderUrl, requestProvider, requestRoleAnalysis, testProvider });
