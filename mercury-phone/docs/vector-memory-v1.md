# Mercury Vector Memory V1 (Superseded)

> Superseded by `event-memory-v1.md`. This document records the initial local-index boundary;
> it is not the current Mercury memory lifecycle contract.

## Purpose

Vector memory is a local retrieval index for confirmed, user-controlled facts. It helps a
conversation recover a small number of relevant records for the current reply. It is not a
second chat archive, a hidden character editor, or an automatic source of relationship facts.

## Source boundary

Only these sources may be indexed:

- a confirmed relationship record;
- a manual note explicitly saved by the user;
- a user-confirmed scene conclusion.

The following are never indexed by V1: full chat transcripts, pending or dismissed records,
role cards, world books, presets, API settings, or imported source files. The source record
remains authoritative. The index can always be deleted and rebuilt from confirmed sources.

## Storage and privacy

- The browser stores entries in IndexedDB database `mercury-vector-memory`, version 1.
- Entries are scoped by `contactId`; a `timelineId` can further isolate an alternate timeline.
- A query may only read entries from its exact contact and matching timeline scope. There is no
  global or cross-contact recall.
- Removing a source record removes its matching index entry. Clearing a scope removes all of its
  entries. Neither action has a server-side effect because V1 has no server storage.
- Export is explicit. The default export excludes embeddings because they are rebuildable derived
  data. API keys are never part of this database or export.

## Entry contract

`MercuryVectorMemoryEntry` has schema version 1 and these normalized fields:

```json
{
  "schemaVersion": 1,
  "id": "relationship:contact-echo:default:record-42",
  "scope": { "contactId": "contact-echo", "timelineId": "default" },
  "kind": "confirmed-record",
  "content": "The meeting is set for Friday afternoon.",
  "source": { "type": "relationship-record", "id": "record-42" },
  "tokens": ["meeting", "meet", "eti", "tin", "ing"],
  "embedding": null,
  "embeddingState": "pending",
  "createdAt": "2026-08-13T00:00:00.000Z",
  "updatedAt": "2026-08-13T00:00:00.000Z"
}
```

`embedding` is either `null` or `{ modelId, dimensions, values }`. It is valid only when the
vector length equals `dimensions`. A changed model marks old entries for rebuild rather than
mixing unrelated vector spaces.

## Retrieval and runtime boundary

1. The current outgoing message is the query.
2. Retrieve only the active contact and active timeline scope.
3. When a matching embedding model is available, rank by semantic similarity, keyword overlap,
   and recency. Without one, use keyword overlap and recency only.
4. Return at most four qualifying entries. A weak result is omitted rather than injected.
5. The runtime receives only the selected record text plus trace IDs. It never receives an
   embedding vector, a database dump, or records from another scope.
6. If IndexedDB, model loading, embedding, or retrieval fails, the reply continues with the
   existing confirmed-record path. The UI may report the unavailable mode but must not claim
   semantic recall was applied.

## Provider compatibility

V1 does not depend on a chat provider embedding endpoint. The default semantic adapter will be
an optional, user-approved browser-local model. Optional provider adapters may be added later
behind explicit configuration. When no adapter is active, Mercury stays usable in keyword mode.
