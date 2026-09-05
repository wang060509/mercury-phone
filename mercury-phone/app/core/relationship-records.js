(function exposeMercuryRelationshipRecords(global) {
  "use strict";

  const STORAGE_KEY = "relationship-records.v1";
  const SCHEMA_VERSION = 1;
  const KINDS = Object.freeze(["shared_event", "open_thread"]);
  const STATUSES = Object.freeze(["pending", "confirmed", "dismissed"]);
  const CERTAINTIES = Object.freeze(["explicit", "inferred"]);
  const MEMORY_RETENTIONS = Object.freeze(["session", "durable"]);
  const MEMORY_STATES = Object.freeze(["active", "superseded", "expired", "archived"]);
  const MEMORY_EVENT_TYPES = Object.freeze(["shared-event", "commitment", "preference", "relationship-shift", "open-thread", "note"]);
  const EVENT_BACKUP_KIND = "mercury-event-memory-backup";
  const EVENT_BACKUP_VERSION = 1;

  const clone = (value) => value && typeof value === "object" ? JSON.parse(JSON.stringify(value)) : value;
  const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const text = (value) => typeof value === "string" && value.trim();

  function normalizeScope(input = {}) {
    if (!isObject(input) || !text(input.contactId)) return null;
    return {
      contactId: input.contactId.trim(),
      worldVariantId: text(input.worldVariantId) ? input.worldVariantId.trim() : "default",
      timelineId: text(input.timelineId) ? input.timelineId.trim() : "default",
    };
  }

  function recordMatchesScope(record, scope) {
    return Boolean(record && scope && record.contactId === scope.contactId && (record.worldVariantId || "default") === scope.worldVariantId && (record.timelineId || "default") === scope.timelineId);
  }

  function createState() {
    return { schemaVersion: SCHEMA_VERSION, records: [] };
  }

  function isValidRecord(record) {
    return isObject(record)
      && text(record.id)
      && text(record.contactId)
      && KINDS.includes(record.kind)
      && text(record.content)
      && STATUSES.includes(record.status)
      && text(record.createdAt)
      && isObject(record.evidence)
      && Array.isArray(record.evidence.sourceTurnIds)
      && record.evidence.sourceTurnIds.every(text)
      && CERTAINTIES.includes(record.evidence.certainty);
  }

  function normalize(value) {
    const records = Array.isArray(value?.records) ? value.records.filter(isValidRecord).map(clone) : [];
    return { schemaVersion: SCHEMA_VERSION, records };
  }

  function load(storage) {
    return normalize(storage?.get?.(STORAGE_KEY, null));
  }

  function save(storage, state) {
    const next = normalize(state);
    storage?.set?.(STORAGE_KEY, next);
    return next;
  }

  function candidateToRecord(candidate, context = {}) {
    if (!isObject(candidate) || !KINDS.includes(candidate.kind) || !text(candidate.content)) return null;
    const sourceTurnIds = Array.from(new Set([
      ...(Array.isArray(candidate.evidence?.sourceTurnIds) ? candidate.evidence.sourceTurnIds : []),
      context.userMessageId,
      context.assistantTurnId,
    ].filter(text)));
    if (!sourceTurnIds.length) return null;
    const candidateId = text(candidate.id) || `${context.requestId || "request"}-${candidate.kind}`;
    const id = text(context.recordId) || `record-${candidateId}`;
    const record = {
      id,
      contactId: text(context.contactId) || "contact-a",
      kind: candidate.kind,
      content: candidate.content.trim(),
      evidence: {
        sourceTurnIds,
        certainty: CERTAINTIES.includes(candidate.evidence?.certainty) ? candidate.evidence.certainty : "explicit",
      },
      status: "pending",
      requestId: text(context.requestId) || null,
      createdAt: text(context.createdAt) || new Date().toISOString(),
      updatedAt: text(context.createdAt) || new Date().toISOString(),
    };
    if (text(context.timelineId)) record.timelineId = context.timelineId.trim();
    if (text(context.worldVariantId)) record.worldVariantId = context.worldVariantId.trim();
    return record;
  }

  function addPending(storage, candidates, context = {}) {
    const state = load(storage);
    const existing = new Set(state.records.map((record) => `${record.contactId}:${record.worldVariantId || "default"}:${record.timelineId || "default"}:${record.kind}:${record.content}`));
    const added = [];
    (Array.isArray(candidates) ? candidates : []).forEach((candidate, index) => {
      const record = candidateToRecord(candidate, { ...context, recordId: `${context.requestId || "request"}-${candidate.id || index + 1}` });
      if (!record) return;
      const dedupeKey = `${record.contactId}:${record.worldVariantId || "default"}:${record.timelineId || "default"}:${record.kind}:${record.content}`;
      if (existing.has(dedupeKey)) return;
      existing.add(dedupeKey);
      state.records.push(record);
      added.push(record);
    });
    if (added.length) save(storage, state);
    return added;
  }

  function updateStatus(storage, recordId, status) {
    if (!text(recordId) || !STATUSES.includes(status)) return null;
    const state = load(storage);
    const record = state.records.find((item) => item.id === recordId);
    if (!record) return null;
    record.status = status;
    record.updatedAt = new Date().toISOString();
    save(storage, state);
    return record;
  }

  function updateContent(storage, recordId, content) {
    if (!text(recordId) || !text(content)) return null;
    const state = load(storage);
    const record = state.records.find((item) => item.id === recordId);
    if (!record) return null;
    record.content = content.trim();
    record.updatedAt = new Date().toISOString();
    save(storage, state);
    return record;
  }

  function updateMemory(storage, recordId, input = {}) {
    if (!text(recordId) || !isObject(input)) return null;
    const state = load(storage);
    const record = state.records.find((item) => item.id === recordId);
    if (!record) return null;
    const previous = isObject(record.memory) ? record.memory : {};
    const memory = {
      retention: MEMORY_RETENTIONS.includes(input.retention) ? input.retention : (MEMORY_RETENTIONS.includes(previous.retention) ? previous.retention : "session"),
      eventType: MEMORY_EVENT_TYPES.includes(input.eventType) ? input.eventType : (MEMORY_EVENT_TYPES.includes(previous.eventType) ? previous.eventType : (record.kind === "open_thread" ? "open-thread" : "shared-event")),
      state: MEMORY_STATES.includes(input.state) ? input.state : (MEMORY_STATES.includes(previous.state) ? previous.state : "active"),
      importance: Number.isInteger(input.importance) ? Math.max(1, Math.min(input.importance, 5)) : (Number.isInteger(previous.importance) ? previous.importance : 2),
      occurredAt: text(input.occurredAt) || previous.occurredAt || record.createdAt,
      expiresAt: input.expiresAt === null ? null : (text(input.expiresAt) || previous.expiresAt || null),
      supersededBy: input.supersededBy === null ? null : (text(input.supersededBy) || previous.supersededBy || null),
    };
    record.memory = memory;
    record.updatedAt = new Date().toISOString();
    save(storage, state);
    return record;
  }

  function list(storage, contactId, status = null) {
    return load(storage).records.filter((record) => (!contactId || record.contactId === contactId) && (!status || record.status === status));
  }

  function exportDurableEvents(storage, scopeInput) {
    const scope = normalizeScope(scopeInput);
    if (!scope) throw new TypeError("Event backup requires a complete memory scope.");
    const records = load(storage).records.filter((record) => recordMatchesScope(record, scope) && record.status === "confirmed" && record.memory?.retention === "durable").map(clone);
    return { kind: EVENT_BACKUP_KIND, version: EVENT_BACKUP_VERSION, exportedAt: new Date().toISOString(), scope, records };
  }

  function importDurableEvents(storage, backup, scopeInput) {
    const scope = normalizeScope(scopeInput);
    if (!scope || !isObject(backup) || backup.kind !== EVENT_BACKUP_KIND || backup.version !== EVENT_BACKUP_VERSION || !recordMatchesScope(backup.scope, scope) || !Array.isArray(backup.records)) throw new TypeError("Invalid event memory backup.");
    const state = load(storage);
    const existingIds = new Set(state.records.map((record) => record.id));
    const existingEvents = new Set(state.records.filter((record) => recordMatchesScope(record, scope)).map((record) => `${record.kind}:${record.content}`));
    let imported = 0;
    backup.records.forEach((item) => {
      if (!isValidRecord(item) || !recordMatchesScope(item, scope) || item.status !== "confirmed" || item.memory?.retention !== "durable" || !MEMORY_STATES.includes(item.memory?.state)) return;
      const eventKey = `${item.kind}:${item.content}`;
      if (existingIds.has(item.id) || existingEvents.has(eventKey)) return;
      state.records.push(clone(item));
      existingIds.add(item.id);
      existingEvents.add(eventKey);
      imported += 1;
    });
    if (imported) save(storage, state);
    return imported;
  }

  global.MercuryRelationshipRecords = Object.freeze({
    STORAGE_KEY,
    SCHEMA_VERSION,
    KINDS,
    STATUSES,
    CERTAINTIES,
    MEMORY_RETENTIONS,
    MEMORY_STATES,
    MEMORY_EVENT_TYPES,
    EVENT_BACKUP_KIND,
    EVENT_BACKUP_VERSION,
    createState,
    normalizeScope,
    recordMatchesScope,
    normalize,
    load,
    save,
    candidateToRecord,
    addPending,
    updateStatus,
    updateContent,
    updateMemory,
    list,
    exportDurableEvents,
    importDurableEvents,
  });
})(typeof window !== "undefined" ? window : globalThis);
