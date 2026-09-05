# Mercury Resource Contracts v1

This document defines the first implementation boundary for Mercury resource imports. The resource layer is local and explicit: parsing or importing a file creates normalized local resources only. It does not imply that a card, world, or preset is active in chat runtime until a contact or conversation binding points to it and the runtime assembler reads that binding.

## Formats

Mercury v1 JSON resources use a top-level `kind` and `schemaVersion`.

- Role card: `{ "kind": "mercury.roleCard", "schemaVersion": 1, "data": { ... } }`
- World book: `{ "kind": "mercury.worldBook", "schemaVersion": 1, "data": { ... } }`
- Preset: `{ "kind": "mercury.preset", "schemaVersion": 1, "data": { ... } }`

Legacy Mercury profile exports remain importable as `kind: "runtime-profile", schemaVersion: 1`; they migrate to a Mercury role card. Generic character-card shaped JSON can be detected and migrated into Mercury fields, but unknown original fields are not preserved as active Mercury behavior.

## Role Card

Required normalized fields:

- `id`: stable local id
- `displayName`: user-facing contact name
- `identity`: short role or identity label
- `summary`: concise character summary
- `profile`: structured character traits and behavior fields
- `createdAt`, `updatedAt`

The role card contract is the only character import shape that chat can convert into a contact. The contact stores the normalized card under `contact.persona` and marks `sourceKind: "mercury.roleCard"`.

When that contact is the active conversation target, the runtime compiler reads its role identity, summary, background, traits, motivations, fears, values, boundaries, interaction styles, inner conflict, signature details, and structured domain material into the request system prompt. The import alone remains local; this happens only after the contact is selected for a conversation.

## World Book

Required normalized fields:

- `id`, `name`, `summary`
- `entries[]`: each entry has `id`, `title`, `content`, `enabled`, `alwaysActive`, `priority`, `keys`, and `tags`

World books accept either an entry array or an object-keyed entry map. A file without an internal name must receive its local name from the import filename; preflight does not invent one.

An imported role card may carry an embedded world book. Mercury extracts it as a separate world resource, stores both resources locally, and links that world to the role profile. The world remains inactive outside conversations with that linked role. Runtime retrieval by enabled state, always-active state, explicit bindings, and query keys is a later phase before adding selected entries to the API request.

## Preset

Required normalized fields:

- `id`, `name`
- `modules.order[]`
- `modules.enabled{}`
- optional `preferences`, `custom.instructions`, and `acceptedConflicts`

Preset import normalizes to the existing user preset shape. A later binding phase must store `conversation.settings.userPresetId` before the preset affects runtime output constraints.

## Preflight Boundary

`preflightMercuryResourceImport(rawText)` returns a report:

- `ok`: true only when parsing, detection, migration, and validation produced a supported Mercury resource
- `format`: detected input family
- `resourceKind`: `roleCard`, `worldBook`, `preset`, or `unknown`
- `migrations[]`: explicit field or format migrations applied
- `errors[]`: blocking problems with stable `code`, `path`, and human message
- `warnings[]`: non-blocking drops, defaults, or ambiguous detections
- `resource`: normalized Mercury resource when `ok`

Preflight never writes storage and never builds prompts. Import UI may show errors from this report. Export uses `exportMercuryResource(resource)` and must round-trip through preflight.
