# Mercury Event Memory V1

## Status

This document supersedes the runtime behavior described by `vector-memory-v1.md`.
Vectors are a retrieval aid. The product memory unit is an event, and the confirmed
relationship record remains its evidence source.

## Event contract

```json
{
  "schemaVersion": 2,
  "id": "relationship:contact-echo:default:default:record-42",
  "scope": {
    "contactId": "contact-echo",
    "worldVariantId": "default",
    "timelineId": "default"
  },
  "eventType": "shared-event",
  "content": "The meeting was moved to Friday afternoon.",
  "retention": "durable",
  "state": "active",
  "importance": 3,
  "confidence": "explicit",
  "occurredAt": "2026-08-13T00:00:00.000Z",
  "expiresAt": null,
  "supersededBy": null,
  "source": { "type": "relationship-record", "id": "record-42" },
  "evidenceTurnIds": ["turn-13", "turn-14"]
}
```

All public write, read, delete, export, and rebuild operations normalize to all three scope
fields. Existing records without a world variant migrate only to `default`; no lookup can omit a
scope dimension after normalization.

## Lifecycle

- `session`: confirmed context that is not eligible for long-term recall. It stays evidence in
  the relationship record and is covered by normal recent-chat context.
- `durable`: a user-selected event eligible for retrieval in its exact scope.
- `active`: eligible for retrieval.
- `superseded`: retained as historical evidence, excluded from ordinary retrieval, and linked to
  the active replacement.
- `expired`: excluded from ordinary retrieval after `expiresAt`.
- `archived`: user-retained but excluded from automatic retrieval.

Confirmation is not a durable-memory decision. A pending record may be confirmed as `session`,
or explicitly confirmed and kept as a durable event. A later event can supersede an earlier one;
the old event is never silently overwritten.

## Eligibility and context budget

- Only `durable` + `active` events may enter automatic recall.
- The resolver filters lifecycle state and exact scope before keyword or vector scoring.
- Semantic, keyword, missing-IndexedDB, and failed-model paths all return the same bounded
  result shape: at most 3 events and at most 560 characters of event data.
- There is no all-confirmed-record fallback.
- Scores, embeddings, and source turn text remain outside the prompt. The runtime receives only
  compact event data and internal trace IDs.

## Runtime injection boundary

Recalled events are historical, untrusted narrative data. They are not instructions, policy,
role definitions, user commands, or permission to alter scopes, settings, relationship state,
or the character core. The runtime wrapper states this before the serialized event data. Event
content is serialized as data rather than appended as free-form rules.

## Recovery

The relationship record store is the source of truth. The IndexedDB event index is derived and
can be cleared or rebuilt from durable source records. The settings page exposes a per-scope
event backup: it exports durable source records, including lifecycle metadata, but never vectors
or model files. Import accepts only a backup whose contact, world variant, and timeline exactly
match the active scope, then rebuilds that scope's index. The separate index export is diagnostic
only and is not a recovery format.

If local semantic preparation is stopped, Mercury immediately returns to keyword retrieval and
discards a late model-ready result. The browser may still finish a cache request already started;
that request is never treated as permission to enable semantic retrieval.

## Non-goals

V1 does not infer lasting memory from arbitrary chat text, rewrite the character card, merge
conflicting events automatically, or treat a downloaded model artifact as a completed semantic
runtime. A full successful model-load and roleplay-retrieval evaluation remains a separate
acceptance item.
