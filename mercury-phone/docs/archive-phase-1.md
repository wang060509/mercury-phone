# Archive Phase 1

## Scope

Archive is a formal Mercury app. It uses the existing App Engine, system status bar, home indicator, storage boundary, and navigation behavior. The isolated visual preview remains a reference-only prototype and is not loaded by the formal app.

## Data model

The app stores one scoped `archive.v1` object. It contains `sourceAssets`, `runtimeProfiles`, `worlds`, `promptModules`, and `contactInstances`.

- `SourceAsset` preserves `rawText` exactly and records filename, MIME type, parse status, detected blocks, and confirmation state.
- `RuntimeProfile` is a deterministic, reviewable structure derived from a source asset. Its status is `draft`, `needs-review`, or `ready`.
- `WorldProfile` contains basic `WorldEntry` records. Entries support rule, place, group, person, history, event, object, culture, and other types.
- `PromptModule` stores classified behavior, relationship, world, output, format, or unknown modules. Modules are saved only and are not sent to Chat.
- `ContactInstance` is a placeholder link to a runtime profile. Creating or deleting it does not mutate the runtime profile or source asset.
- Image fields are IDs (`imageAssetId`, `avatarAssetId`, and `coverAssetId`); imported files never become base64 image data in resource records.

## Pages and navigation

The Home screen launches `archive`. Archive contains Characters, Worlds, and Imports segments. Character cards open a profile page; profile sections open compact read/edit pages. Imports open a review page before confirmation. Worlds open a list, detail page, and basic entry editor. Prompt Modules are available from Imports and are explicitly labeled as inactive in Chat.

All pages render inside the existing Mercury app layer. Archive does not render a second time, Wi-Fi, battery, Dynamic Island, or Home Indicator.

## Import flow

1. The user selects a local JSON or text file.
2. The file is read as text only. JSON parsing and top-level key inspection produce conservative `detectedBlocks`.
3. HTML, CSS, and JavaScript-looking strings are classified as format extensions or unknown content. They are never inserted as markup or executed.
4. Review shows type, confidence, source path, and a length-limited preview. The user may change block classifications.
5. Cancel discards the transient candidate. Confirm preserves the source and creates only the selected resource records.

## Safety boundary

Imported content is plain text. Archive uses `textContent` and textarea values for display, has no `eval`, `new Function`, dynamic script injection, remote asset loading, or widget execution path. Imported source is not automatically applied to Runtime, Prompt Modules, Chat, contacts, or long-term memory.

## Implemented in this phase

- Formal Archive app registration and Home entry.
- Source preservation and deterministic mixed-content classification.
- Import review, classification edits, cancel, and confirmation.
- Character list, profile overview, six profile section routes, and compact profile editing.
- Minimal World list/detail/entry creation and editing.
- Prompt Module read-only display with inactive status.
- ContactInstance placeholder creation from Runtime Check.
- Neutral local data only and scoped local storage.

## Not implemented

AI parsing, Chat integration, hidden presets, complex relationship graphs, timeline or simulation systems, semantic triggers, HTML widgets, gallery management, long-term memory writes, and provider/API changes are outside this phase.

## Runtime Core interface reservation

The resource records deliberately retain `sourceAssetId`, runtime status, world bindings, and prompt module scope. A later Runtime Compiler may accept a `RuntimeCompilationInput` containing a core, modules, profile, world bindings, and user preset, and return compiled text plus provenance. Core rules must remain higher priority than imported material. This phase does not compile or send these records to Chat.
