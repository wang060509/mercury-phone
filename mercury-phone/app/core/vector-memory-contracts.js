(function exposeMercuryVectorMemoryContracts(global) {
  "use strict";

  const SCHEMA_VERSION = 2;
  const DB_NAME = "mercury-vector-memory";
  const DB_VERSION = 2;
  const STORE_ENTRIES = "entries";
  const STORE_META = "meta";
  const EVENT_TYPES = Object.freeze(["shared-event", "commitment", "preference", "relationship-shift", "open-thread", "note"]);
  const RETENTIONS = Object.freeze(["session", "durable"]);
  const MEMORY_STATES = Object.freeze(["active", "superseded", "expired", "archived"]);
  const EMBEDDING_STATES = Object.freeze(["pending", "ready", "unavailable"]);
  const CONFIDENCES = Object.freeze(["explicit", "inferred"]);
  const DEFAULT_WORLD_VARIANT_ID = "default";
  const DEFAULT_TIMELINE_ID = "default";
  const MAX_CONTENT_LENGTH = 900;
  const MAX_VECTOR_DIMENSIONS = 2048;
  const MAX_RESULTS = 3;
  const MAX_RUNTIME_MEMORY_CHARS = 560;

  const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const nonEmptyText = (value) => typeof value === "string" && value.trim().length > 0;
  const copy = (value) => value && typeof value === "object" ? JSON.parse(JSON.stringify(value)) : value;
  const clampText = (value, limit = MAX_CONTENT_LENGTH) => String(value || "").trim().replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").slice(0, limit);
  const validDate = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
  const nowIso = () => new Date().toISOString();

  function normalizeScope(input = {}) {
    if (!isObject(input) || !nonEmptyText(input.contactId)) return null;
    return {
      contactId: input.contactId.trim(),
      worldVariantId: nonEmptyText(input.worldVariantId) ? input.worldVariantId.trim() : DEFAULT_WORLD_VARIANT_ID,
      timelineId: nonEmptyText(input.timelineId) ? input.timelineId.trim() : DEFAULT_TIMELINE_ID,
    };
  }

  function scopeKey(scope) {
    const normalized = normalizeScope(scope);
    return normalized ? `${normalized.contactId}:${normalized.worldVariantId}:${normalized.timelineId}` : "";
  }

  function scopesMatch(entryScope, queryScope) {
    const entry = normalizeScope(entryScope);
    const query = normalizeScope(queryScope);
    return Boolean(entry && query && entry.contactId === query.contactId && entry.worldVariantId === query.worldVariantId && entry.timelineId === query.timelineId);
  }

  function tokenize(value) {
    const source = clampText(value, MAX_CONTENT_LENGTH).toLocaleLowerCase();
    if (!source) return [];
    const tokens = new Set();
    (source.match(/[a-z0-9][a-z0-9'_\-]*/g) || []).forEach((word) => { if (word.length > 1) tokens.add(word); });
    (source.match(/[\u3400-\u9fff]+/g) || []).forEach((run) => {
      if (run.length === 1) tokens.add(run);
      for (let index = 0; index < run.length; index += 1) {
        if (index < run.length - 1) tokens.add(run.slice(index, index + 2));
        if (index < run.length - 2) tokens.add(run.slice(index, index + 3));
      }
    });
    return [...tokens].slice(0, 180);
  }

  function normalizeEmbedding(input) {
    if (input === null || input === undefined) return null;
    if (!isObject(input) || !nonEmptyText(input.modelId) || !Number.isInteger(input.dimensions) || input.dimensions < 1 || input.dimensions > MAX_VECTOR_DIMENSIONS) return null;
    const values = Array.from(input.values || []);
    if (values.length !== input.dimensions || !values.every(Number.isFinite)) return null;
    return { modelId: input.modelId.trim(), dimensions: input.dimensions, values };
  }

  function normalizedState(input, expiresAt, now = Date.now()) {
    if (input === "active" && validDate(expiresAt) && Date.parse(expiresAt) <= now) return "expired";
    return MEMORY_STATES.includes(input) ? input : "active";
  }

  function normalizeEntry(input = {}, options = {}) {
    const scope = normalizeScope(input.scope);
    const content = clampText(input.content);
    if (!scope || !nonEmptyText(input.id) || !content || !isObject(input.source) || !nonEmptyText(input.source.type) || !nonEmptyText(input.source.id)) return null;
    const legacyKind = input.eventType || (input.kind === "open_thread" ? "open-thread" : "shared-event");
    if (!EVENT_TYPES.includes(legacyKind)) return null;
    const embedding = normalizeEmbedding(input.embedding);
    const createdAt = validDate(input.createdAt) ? input.createdAt : nowIso();
    const updatedAt = validDate(input.updatedAt) ? input.updatedAt : createdAt;
    const expiresAt = validDate(input.expiresAt) ? input.expiresAt : null;
    const state = normalizedState(input.state, expiresAt, Number.isFinite(options.now) ? options.now : Date.now());
    return {
      schemaVersion: SCHEMA_VERSION,
      id: input.id.trim(),
      scope,
      scopeKey: scopeKey(scope),
      eventType: legacyKind,
      content,
      retention: RETENTIONS.includes(input.retention) ? input.retention : "session",
      state,
      importance: Number.isInteger(input.importance) ? Math.max(1, Math.min(input.importance, 5)) : 2,
      confidence: CONFIDENCES.includes(input.confidence) ? input.confidence : "explicit",
      occurredAt: validDate(input.occurredAt) ? input.occurredAt : createdAt,
      expiresAt,
      supersededBy: nonEmptyText(input.supersededBy) ? input.supersededBy.trim() : null,
      source: { type: input.source.type.trim(), id: input.source.id.trim() },
      evidenceTurnIds: Array.isArray(input.evidenceTurnIds) ? [...new Set(input.evidenceTurnIds.filter(nonEmptyText).map((id) => id.trim()))].slice(0, 16) : [],
      tokens: Array.isArray(input.tokens) ? [...new Set(input.tokens.filter(nonEmptyText).map((token) => token.trim().toLocaleLowerCase()))].slice(0, 180) : tokenize(content),
      embedding,
      embeddingState: embedding ? "ready" : (EMBEDDING_STATES.includes(input.embeddingState) ? input.embeddingState : "pending"),
      createdAt,
      updatedAt,
    };
  }

  function entryFromConfirmedRecord(record, scope, options = {}) {
    if (!isObject(record) || record.status !== "confirmed" || !nonEmptyText(record.id) || !nonEmptyText(record.content)) return null;
    const normalizedScope = normalizeScope(scope);
    if (!normalizedScope) return null;
    const memory = isObject(record.memory) ? record.memory : {};
    const eventType = EVENT_TYPES.includes(options.eventType) ? options.eventType : (EVENT_TYPES.includes(memory.eventType) ? memory.eventType : (record.kind === "open_thread" ? "open-thread" : "shared-event"));
    const retention = RETENTIONS.includes(options.retention) ? options.retention : (RETENTIONS.includes(memory.retention) ? memory.retention : "session");
    return normalizeEntry({
      id: `relationship:${normalizedScope.contactId}:${normalizedScope.worldVariantId}:${normalizedScope.timelineId}:${record.id.trim()}`,
      scope: normalizedScope,
      eventType,
      content: record.content,
      retention,
      state: memory.state || "active",
      importance: memory.importance,
      confidence: record.evidence?.certainty,
      occurredAt: memory.occurredAt || record.createdAt,
      expiresAt: memory.expiresAt || null,
      supersededBy: memory.supersededBy || null,
      source: { type: "relationship-record", id: record.id },
      evidenceTurnIds: record.evidence?.sourceTurnIds || [],
      embedding: null,
      embeddingState: "pending",
      createdAt: record.createdAt,
      updatedAt: record.updatedAt || record.createdAt,
    });
  }

  function cosineSimilarity(left, right) {
    const a = Array.from(left || []); const b = Array.from(right || []);
    if (!a.length || a.length !== b.length || !a.every(Number.isFinite) || !b.every(Number.isFinite)) return null;
    let dot = 0; let aMagnitude = 0; let bMagnitude = 0;
    for (let index = 0; index < a.length; index += 1) { dot += a[index] * b[index]; aMagnitude += a[index] * a[index]; bMagnitude += b[index] * b[index]; }
    return aMagnitude && bMagnitude ? dot / Math.sqrt(aMagnitude * bMagnitude) : null;
  }

  function keywordScore(queryTokens, entryTokens) {
    const query = new Set(Array.isArray(queryTokens) ? queryTokens : []); const entry = new Set(Array.isArray(entryTokens) ? entryTokens : []);
    if (!query.size || !entry.size) return 0;
    let overlap = 0; let possible = 0;
    query.forEach((token) => {
      // Longer CJK n-grams are much less likely to be accidental overlaps.
      // The fallback therefore refuses to make a broad recall decision on a
      // single common two-character fragment such as "喜欢".
      const weight = Math.max(1, [...token].length - 1);
      possible += weight;
      if (entry.has(token)) overlap += weight;
    });
    return overlap / Math.max(1, possible);
  }

  function recencyScore(date, currentTime = Date.now()) {
    const timestamp = Date.parse(date); if (!Number.isFinite(timestamp)) return 0;
    return Math.exp(-Math.max(0, (currentTime - timestamp) / 86400000) / 45);
  }

  function rankEntries(entries, options = {}) {
    const scope = normalizeScope(options.scope); const queryTokens = tokenize(options.query || ""); const queryEmbedding = normalizeEmbedding(options.embedding);
    const now = Number.isFinite(options.now) ? options.now : Date.now();
    const maxResults = Number.isInteger(options.maxResults) ? Math.max(1, Math.min(options.maxResults, MAX_RESULTS)) : MAX_RESULTS;
    const minimumScore = Number.isFinite(options.minimumScore) ? options.minimumScore : (queryEmbedding ? 0.22 : 0.16);
    const includeSession = options.includeSession === true;
    if (!scope || !queryTokens.length) return [];
    const queryTokenSet = new Set(queryTokens);
    const candidates = (Array.isArray(entries) ? entries : []).map((entry) => normalizeEntry(entry, { now })).filter(Boolean)
      .filter((entry) => scopesMatch(entry.scope, scope) && entry.state === "active" && (entry.retention === "durable" || includeSession))
    ;
    const documentFrequency = new Map();
    candidates.forEach((entry) => {
      entry.tokens.forEach((token) => {
        if (queryTokenSet.has(token)) documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
      });
    });
    return candidates
      .map((entry) => {
        const matchedTokens = queryTokens.filter((token) => entry.tokens.includes(token));
        const lexical = keywordScore(queryTokens, entry.tokens); const recency = recencyScore(entry.occurredAt || entry.updatedAt, now);
        const comparable = queryEmbedding && entry.embedding && queryEmbedding.modelId === entry.embedding.modelId && queryEmbedding.dimensions === entry.embedding.dimensions;
        const cosine = comparable ? cosineSimilarity(queryEmbedding.values, entry.embedding.values) : null;
        const semantic = cosine === null ? null : Math.max(0, cosine);
        const score = semantic === null ? (lexical * 0.88) + (recency * 0.12) : (semantic * 0.72) + (lexical * 0.2) + (recency * 0.08);
        const hasSpecificLexicalMatch = matchedTokens.some((token) => (/^[a-z0-9]/i.test(token) ? token.length >= 4 : [...token].length >= 3) || documentFrequency.get(token) === 1);
        return { ...entry, score, match: semantic === null ? "keyword" : "semantic", lexicalScore: lexical, semanticScore: semantic, hasSpecificLexicalMatch };
      })
      .filter((entry) => entry.score >= minimumScore && (entry.semanticScore !== null || entry.hasSpecificLexicalMatch))
      .sort((left, right) => right.score - left.score || right.importance - left.importance || Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
      // A bounded fallback should avoid filling the prompt with weak lexical
      // neighbours just because room remains under the Top-K limit.
      .filter((entry, index, ranked) => index === 0 || entry.score >= Math.max(minimumScore, ranked[0].score * 0.65))
      .slice(0, maxResults)
      .map((entry) => ({ id: entry.id, eventType: entry.eventType, content: entry.content, occurredAt: entry.occurredAt, source: copy(entry.source), score: entry.score, match: entry.match }));
  }

  function runtimeRecords(results, options = {}) {
    const maxChars = Number.isInteger(options.maxChars) ? Math.max(80, Math.min(options.maxChars, MAX_RUNTIME_MEMORY_CHARS)) : MAX_RUNTIME_MEMORY_CHARS;
    let used = 0;
    return (Array.isArray(results) ? results : []).slice(0, MAX_RESULTS).reduce((selected, result) => {
      const content = clampText(result?.content, Math.min(220, maxChars - used));
      if (!content || used + content.length > maxChars) return selected;
      used += content.length;
      selected.push({ id: String(result.id || ""), eventType: EVENT_TYPES.includes(result.eventType) ? result.eventType : "shared-event", content, occurredAt: validDate(result.occurredAt) ? result.occurredAt : null, sourceId: result.source?.id || null });
      return selected;
    }, []);
  }

  const api = { SCHEMA_VERSION, DB_NAME, DB_VERSION, STORE_ENTRIES, STORE_META, EVENT_TYPES, RETENTIONS, MEMORY_STATES, EMBEDDING_STATES, CONFIDENCES, DEFAULT_WORLD_VARIANT_ID, DEFAULT_TIMELINE_ID, MAX_CONTENT_LENGTH, MAX_VECTOR_DIMENSIONS, MAX_RESULTS, MAX_RUNTIME_MEMORY_CHARS, normalizeScope, scopeKey, scopesMatch, tokenize, normalizeEmbedding, normalizeEntry, entryFromConfirmedRecord, cosineSimilarity, keywordScore, recencyScore, rankEntries, runtimeRecords };
  global.MercuryVectorMemoryContracts = Object.freeze(api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
