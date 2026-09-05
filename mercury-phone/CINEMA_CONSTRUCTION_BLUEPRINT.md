# Mercury Cinema Current-State Construction Blueprint

> Scope: repository state after the frozen Phase 2D adversarial closure. This is an implementation audit for a later presentation-only Cinema Home pass. Phase 2E is **not started** here.

## Status vocabulary

- **IMPLEMENTED**: a current contract, state transition, query, persistence rule, or tested behavior.
- **IMPLEMENTED BUT PLACEHOLDER UI**: working DOM/CSS exists, but its presentation may be replaced later if the documented data and action boundaries remain intact.
- **NOT IMPLEMENTED**: no current field, query, route, control, or behavior exists. This document does not propose one.

The implementation is the source of truth. `reference-sources/wanwan-public/js/bookstore.js` was inspected only as a narrow comparison for cumulative summary coverage; it does not define Mercury terminology, ownership, or product behavior.

## 1. Domain Hierarchy

The implementation has two definition sources that are referenced and snapshotted by durable Cinema state. `ContinuityLedger` is a stateless use case, not a stored child entity, and a Turn is a workflow boundary rather than a persisted object.

```text
Mercury Cinema
  source-code StageCatalog
    Stage
      Scenario (opening/setup definition)

  shared GenerationProfileStore
    GenerationProfile definitions

  durable Cinema root state
    draft (references current Stage/Scenario/Profile/Archive character)
    instances[]
      Instance
        Stage snapshot + Scenario snapshot
        Character snapshot + per-Instance Variant
        GenerationProfile snapshot + runtimeProfileHistory
        scenes[]
        segments[] -> each Segment references sceneId
        notes -> durable continuity carrier maintained by ContinuityLedger
        pendingContinuation -> durable in-flight Turn identity
```

An `Instance` references one Stage and one Scenario; it is not stored beneath the catalog objects. A Stage or Scenario therefore does not own its Instances.

| Entity | Canonical source | Persistence | Mutability and lifetime | Ownership / IDs | Current UI read |
|---|---|---|---|---|---|
| `StageCatalog` | `PRODUCTION_STAGE_CATALOG` created by `createStageCatalog(...)` | Source code only | Catalog internals are deep-frozen for the app lifetime; accessors return clones | Owns registered Stage definitions; Stage key is `stage.id` | Yes: `listStages`, `getStage`, `getScenario` |
| `Stage` | Normalized catalog definition | Not user-persisted; a subset is copied into each Instance | Definition is immutable inside a catalog; changing a future catalog build affects only future lookups/Instances | Owns its `scenarios[]`; key is `id` | Yes, directly in Lobby, Stage Detail, Preparation |
| `Scenario` | A Stage's normalized `scenarios[]` | Not user-persisted; a snapshot is copied into each Instance | Definition is immutable inside a catalog; Instance copy lasts with the Instance | Parent definition is Stage; key is `(stageId, scenario.id)` | Partly: current flow reads the first/default Scenario, but has no Scenario list/selector |
| `Instance` | `MercuryCinemaStore` normalized state | Cinema IndexedDB `instances` header plus its prose in `segments` | Mutable through Store actions until `ended`; ended state is treated as read-only by current UI | Root `instances[]`; key is `instance.id` | Yes: focused, unfinished, reading, notes, history, credits |
| `Scene` | `instance.scenes[]` | Inside the Instance header | Structurally mutable through generic `updateInstance`, but no current Scene-progression UI/use case exists; current creation makes one Scene | Owned by one Instance; key is `scene.id`; selected by `currentSceneId` | Yes: headings, Act/Scene labels, Segment grouping |
| `Segment` | `instance.segments[]` in memory | IndexedDB `segments`; key `id`, with durable `instanceId` and `ordinal` added by Repository | Append-oriented raw story record; current normal flow does not compact/delete it | Owned by one Instance and references `sceneId` | Yes: Reading and History render it directly |
| logical Turn | `MercuryCinemaGenerationWorkflow` operation | No Turn record/store | Runtime operation; durable boundary is represented by user Segment, `pendingContinuation`, assistant Segment, and continuity commit | Correlated by `requestId` and `userSegmentId` | Indirectly through workflow state, composer, retry/error UI |
| `ContinuityLedger` | Stateless `normalizeLedger` / `advance` functions | The result is durable in `instance.notes` | Derived mutable state over the Instance lifetime; raw Segments remain authoritative | No ledger ID; evidence uses Segment ordinals | Partly: Story Notes reads only a subset |
| `GenerationProfile` | Built-ins in `generation-profile-contracts.js`; user profiles in `MercuryGenerationProfileStore` | Shared storage key `generation-profiles.v1`, outside Cinema IndexedDB; snapshots/history also live in Instance headers | Built-in profile is read-only; user profiles are mutable/removable; each application is snapshotted for the Instance | Key is `profile.id`; referenced by draft/Instance `generationProfileId` | Yes in pre-opening picker; historical snapshot in confirmation/history |

`Stage`/`Scenario` snapshots are **semantically immutable copies**: catalog edits cannot rewrite existing Instances, Store accessors return clones, and current UI has no snapshot-edit action. They are not JavaScript `Object.freeze` objects; the public generic `updateInstance(...)` could replace them if misused. Future UI must treat them as immutable.

## 2. Stage Catalog Contract

`normalizeStage(...)` currently exposes these exact fields:

```text
id
version
order
title
shortTitle
latinTitle
programmeTitle
region
tagline
summary
premise
presentation
roleConfiguration
scenarios
specializations
defaultSpecialization
relationshipOptions
places
worldRules
materials
```

`presentation` and `roleConfiguration` are cloned objects without a separately validated schema. `materials` is a cloned list of arbitrary objects. Current Aevoria data uses material fields `id`, `kind`, `title`, `caption`, `alt`, and `asset`, but those names are not normalized as a universal visual contract.

Each normalized Scenario in `scenarios` has:

```text
id
title
season
summary
entryPeriods
defaultEntryPeriod
opening
```

Current answers for Stage-carousel planning:

- **IMPLEMENTED:** UI can enumerate every registered Stage generically with `catalog.listStages()`. Unknown IDs return `null`; there is no fallback to Aevoria.
- **IMPLEMENTED:** registration order is deterministic for a fixed definitions array. `listStages()` preserves input order. The numeric `order` field is normalized but is not used to sort; current Lobby numbering uses enumeration index.
- **IMPLEMENTED:** production currently registers exactly one Stage, `aevoria-academy`.
- **IMPLEMENTED:** Aevoria runtime semantics are catalog data, with no `stage.id` branch in `cinema-app.js`. Aevoria-specific text remains in the exported `AEVORIA_STAGE` seed definition. Its map binary remains at `app/assets/cinema/aevoria-campus-map.webp` and is referenced through that Stage's `materials[].asset`.
- **NOT IMPLEMENTED:** a first-class Stage artwork, thumbnail, emblem, poster, or key-art field.
- **NOT IMPLEMENTED:** a validated visual-metadata schema for `presentation` or `materials`. `materials[0]` must not be reinterpreted as a guaranteed carousel image.

The Instance Stage snapshot deliberately excludes `order`, `presentation`, `scenarios`, and `materials`. Historical Instances therefore do not retain catalog presentation assets.

## 3. Scenario Contract

A Scenario belongs to a Stage definition and is looked up by `catalog.getScenario(stageId, scenarioId)`. It means **opening/setup conditions for an Instance**, not the current evolved narrative Scene.

When `createInstanceFromDraft(...)` opens the curtain, it copies these exact fields to `scenarioSnapshot`:

```text
id
title
season
summary
entryPeriods
defaultEntryPeriod
opening
unavailable
```

It also creates the initial Scene using `scenarioSnapshot.title` and creates the first assistant Segment from `scenarioSnapshot.opening`. From that point:

- `scenarioId` and `scenarioSnapshot` retain the opening identity and setup.
- `currentSceneId -> scenes[]` identifies the current actual Scene.
- Existing Instances continue to read their snapshot even if the catalog definition later changes or disappears.
- Current catalog data remains separately retrievable by `stageId`/`scenarioId`, but it is not historical authority for an existing Instance.
- Compatibility hydration creates an `unavailable: true` snapshot if a legacy Instance references a missing definition; prose is retained.

The Context Compiler explicitly labels the Scenario as `开场情境` and the resolved Scene as `当前实际场景`. Some current placeholder UI copy still labels Scenario as `场景`; that wording is not the domain contract.

**NOT IMPLEMENTED:** a user-visible Scenario list or selector. The current Stage route and `beginDraft(stage.id)` use the Stage's first Scenario. Although `routeData.scenarioId` and `updateDraft({ scenarioId })` can represent another Scenario, the current controller does not connect them into a selection flow.

## 4. Instance Model

The normalized Instance has these exact top-level fields:

```text
id
status
stageId
stageSnapshot
scenarioId
scenarioSnapshot
title
programmeSubtitle
entryPeriod
characterSnapshot
player
characterSpecialization
variant
generationProfileId
generationProfileSnapshot
runtimeProfileHistory
scenes
currentSceneId
segments
notes
pendingContinuation
createdAt
updatedAt
endedAt
lastError
```

Relevant nested shapes are:

```text
status:
  "preparing" | "active" | "intermission" | "ending" | "ended"

stageSnapshot:
  id, version, title, shortTitle, latinTitle, programmeTitle,
  region, tagline, summary, premise, roleConfiguration,
  specializations, defaultSpecialization, relationshipOptions,
  places, worldRules, unavailable

scenarioSnapshot:
  id, title, season, summary, entryPeriods,
  defaultEntryPeriod, opening, unavailable

characterSnapshot:
  id, displayName, identity, summary, stableTraits, motivations,
  values, boundaries, voiceStyle, background,
  relationshipSummary, sourceRevision

player:
  name, role, specialization

variant:
  coreProfileId, coreRevision, stableCore, worldIdentity,
  contextBackground, expression, relationshipStart,
  sharedHistory, userEdited

runtimeProfileHistory[]:
  profileId, snapshot, appliedAt

scenes[]:
  id, actNumber, sceneNumber, title, createdAt

segments[]:
  id, sceneId, role, text, createdAt, status, generationProfileId

notes:
  overview
  summary: { text, coveredThroughOrdinal }
  timeline
  people
  places
  threads
  commitments
  importantFacts
  coverage: { coveredThroughOrdinal }
  lastFailure
  updatedAt

pendingContinuation:
  requestId, userSegmentId, startedAt, generationProfileId
```

Focus is not an Instance field. The durable root field `focusedInstanceId` points to one non-ended Instance or is `null`.

`createdAt`, `updatedAt`, and `endedAt` are ISO strings. `updateInstance(...)` refreshes `updatedAt` for Store-mediated Instance mutations. Merely navigating or changing focus does not refresh it.

New Instances are created directly as `active`, with one Scene and one opening assistant Segment. `preparing` remains a valid normalized status but the current creation flow uses a separate root `draft`, not a preparing Instance.

## 5. Multiple Unfinished Instances

- **Yes:** one Stage can have multiple unfinished Instances.
- **Yes:** one Scenario can have multiple unfinished Instances.
- `openCurtain()` creates a new unique Instance, appends it to root `instances[]`, focuses it, and does not end or alter other Instances.
- `listUnfinished()` returns every Instance whose `status !== "ended"`, sorted descending by `updatedAt`.
- `listPast()` returns `status === "ended"`, sorted descending by `endedAt`.
- `focused()` returns the one non-ended Instance named by root `focusedInstanceId`.
- `get(instanceId)` returns any Instance, including ended ones.
- `focusInstance(instanceId)` changes only root focus and rejects missing/ended Instances.

There is no per-Stage query helper. UI must currently derive a Stage's Instances by filtering `listUnfinished()` on `instance.stageId`.

The first item after that filter is the most recently **mutated** Instance because `listUnfinished()` is already sorted by `updatedAt`. It is not necessarily the most recently viewed/focused Instance because focus alone does not change `updatedAt`.

Focus does not imply resume. `focusInstance(...)` preserves `status`, `scenes`, `currentSceneId`, Segments, continuity, and pending identity. The current Lobby then chooses a route based on status; an intermission Instance is resumed only after the user activates the resume curtain.

Resume does not imply Scene progression. `resume(...)` only changes `intermission -> active`. No Scene or Segment is added.

Current classifications:

- **Unfinished:** `preparing`, `active`, `intermission`, or `ending`.
- **Paused:** only `intermission`.
- **Completed:** `ended`, with `endedAt`; exposed through `listPast()` and History.
- **Pending generation:** independent of lifecycle, represented by non-null `pendingContinuation`.
- **Delete/archive operation:** **NOT IMPLEMENTED.** Normal completion is `beginEnding(...)` then `finish(...)`; ended Instances remain in `instances[]`. The current “保存到我的影院” credit action only navigates to History because the Instance was already made durable and ended.

## 6. Focus vs Lifecycle

The accepted invariant is implemented as root focus plus per-Instance lifecycle.

| Action | Durable mutation | Narrative mutation? |
|---|---|---|
| Browse Lobby/Stage/Material or call controller `#go(...)` | None; route state is runtime-only | No |
| `focusInstance(id)` | `focusedInstanceId` only | No Scene, Segment, continuity, or lifecycle change |
| `beginDraft(stageId)` / `updateDraft(...)` | Root `draft` | No Instance or story prose change |
| `openCurtain()` | Creates/focuses an active Instance, initial Scene, opening assistant Segment, snapshots, and notes | Yes: this is the explicit narrative start boundary |
| `intermission(id)` | `active -> intermission`; refreshes `updatedAt` | No Scene/Segment/continuity change |
| `resume(id)` | `intermission -> active`; refreshes `updatedAt` | No Scene/Segment/continuity change |
| `beginEnding(id)` | `active|intermission -> ending` | No new Scene/Segment |
| `finish(id)` | `ending -> ended`, sets `endedAt`, may select another focus | No prose/Scene progression; closes lifecycle |
| `workflow.continueWith(...)` / `runTurn(...)` | User Segment, pending identity, assistant Segment, continuity, errors | Yes: the explicit turn boundary |
| Reading settings / tutorial / entry acknowledgment | Root metadata only | No |

The curtain is presentation plus explicit actions: entry calls `markEntered`, opening calls `openCurtain`, resume calls `resume`, and ending calls `finish`. The animation itself is not narrative state.

**NOT IMPLEMENTED:** automatic Scene detection or a dedicated Scene-advance command. Existing turns append to `currentSceneId`.

## 7. Current Cinema Navigation / View Flow

### Frozen presentation navigation grammar

The current production reconstruction fixes Programme as the operational hub:

```text
Home -> Programme -> Programme Entry -> Reading
```

Programme Entry and Reading both return semantically to Programme. Those exits are controller-local presentation navigation only: they do not end, resume, retry, create, focus, or mutate an Instance, and they do not use browser history as domain navigation. Until the approved Home/Programme split lands, the current `lobby` renderer remains their compatibility destination behind the named `#returnToProgramme()` method.

Current first-use flow:

```text
open Cinema
-> hydration gate
-> entrance curtain (if hasEntered is false)
-> Lobby / programme hall
-> Stage detail (first/default Scenario)
-> Preparation (entry period, Archive character, player/relationship data)
-> Character Variant
-> Generation Profile
-> Programme Confirmation
-> opening curtain
-> openCurtain(): create active Instance + initial Scene/opening Segment
-> Reading
-> workflow turn(s)
-> optional Intermission -> resume curtain -> Reading
-> optional Ending confirmation -> ending curtain -> finish
-> Credits -> read-only History / Lobby
```

All route switches are controller-local strings in `app/apps/cinema-app.js`; they are not URL routes and are not durable.

| Route/view | Function and current responsibility | Redesign classification |
|---|---|---|
| hydration / persistence failure | `#renderHydrationState`, `#renderPersistenceFailure`; gate dependent stores until Repository readiness and expose read failure | **KEEP DOMAIN BEHAVIOR**; presentation is safe to restyle |
| `entrance` | `#renderCurtain("entry")`; user action calls `markEntered()` | **KEEP DOMAIN BEHAVIOR; UNKNOWN / COUPLED — REVIEW BEFORE REDESIGN** because callback owns durable entry acknowledgment |
| `lobby` | `#renderLobby`; focused marquee, other unfinished Instances, generic Stage list, latest ended Instances, tutorial | **KEEP DOMAIN BEHAVIOR; VISUAL PLACEHOLDER / SAFE FOR FUTURE REDESIGN** if existing queries/actions are preserved |
| `stage` | `#renderStage`; reads Stage/default Scenario/material, and “选择这一场” calls `beginDraft(stage.id)` | **KEEP DOMAIN BEHAVIOR; UNKNOWN / COUPLED — REVIEW BEFORE REDESIGN** at the selection action; browse-only presentation is replaceable |
| `material` | `#renderMaterial`; read-only catalog material viewer | **KEEP DOMAIN BEHAVIOR; VISUAL PLACEHOLDER / SAFE FOR FUTURE REDESIGN** |
| `prep` | `#renderPreparation`; creates/updates durable draft and reads Archive characters | **KEEP DOMAIN BEHAVIOR; UNKNOWN / COUPLED — REVIEW BEFORE REDESIGN** |
| `variant` | `#renderVariant`; builds and edits per-Instance draft Variant | **KEEP DOMAIN BEHAVIOR; UNKNOWN / COUPLED — REVIEW BEFORE REDESIGN** |
| `profile` | `#renderProfilePicker`; reads profile store and snapshots selection into draft | **KEEP DOMAIN BEHAVIOR; UNKNOWN / COUPLED — REVIEW BEFORE REDESIGN** |
| `confirm` | `#renderProgrammeConfirmation`; read draft/catalog, then enters opening curtain | **KEEP DOMAIN BEHAVIOR; UNKNOWN / COUPLED — REVIEW BEFORE REDESIGN** |
| `curtain` | `#renderCurtain`, `#openCurtain`; mode-specific entry/open/resume/finish mutations | **KEEP DOMAIN BEHAVIOR; UNKNOWN / COUPLED — REVIEW BEFORE REDESIGN** |
| `reading` | `#renderReading`; resolves focused Instance/current Scene, renders raw Segments, calls Workflow for send/retry/cancel | **KEEP DOMAIN BEHAVIOR; UNKNOWN / COUPLED — REVIEW BEFORE REDESIGN** for composer and recovery; prose presentation alone is replaceable |
| reading menu overlay | `#readingMenu`; routes to Notes/Settings and directly requests intermission/ending flow | **KEEP DOMAIN BEHAVIOR; UNKNOWN / COUPLED — REVIEW BEFORE REDESIGN** |
| `intermission` | `#renderIntermission`; reads credits/notes and routes to explicit resume curtain | **KEEP DOMAIN BEHAVIOR; UNKNOWN / COUPLED — REVIEW BEFORE REDESIGN** at resume |
| `ending` | `#renderEndingConfirmation`; calls `beginEnding` before ending curtain | **KEEP DOMAIN BEHAVIOR; UNKNOWN / COUPLED — REVIEW BEFORE REDESIGN** |
| `credits` | `#renderCredits`; reads ended Instance and navigates only | **KEEP DOMAIN BEHAVIOR; VISUAL PLACEHOLDER / SAFE FOR FUTURE REDESIGN** |
| `past` | `#renderPast`; read-only `listPast()` | **KEEP DOMAIN BEHAVIOR; VISUAL PLACEHOLDER / SAFE FOR FUTURE REDESIGN** |
| `history` | `#renderHistory`; read-only Scene/Segment archive reader | **KEEP DOMAIN BEHAVIOR; VISUAL PLACEHOLDER / SAFE FOR FUTURE REDESIGN** |
| `notes` | `#renderNotes`; partial view over `instance.notes` plus current story data | **KEEP DOMAIN BEHAVIOR; VISUAL PLACEHOLDER / SAFE FOR FUTURE REDESIGN**; current view is not a complete ledger renderer |
| `settings` | `#renderReadingSettings`; writes durable root `readingSettings` only | **KEEP DOMAIN BEHAVIOR; UNKNOWN / COUPLED — REVIEW BEFORE REDESIGN** at controls; no narrative coupling |

## 8. Current Cinema Home

The current Cinema Home is route `lobby`, rendered by `#renderLobby()` as a programme hall.

- On initial app open, users first see a hydration gate. First-time users then see the entry curtain; returning users go to Lobby.
- A generic Stage list **exists** and is produced by `catalog.listStages()`.
- A Scenario list/selector **does not exist**. Current UI presents the first/default Scenario inside Stage/Preparation.
- A focused unfinished Instance appears in the top marquee and current-performance ticket.
- Other unfinished Instances appear as rows under “未结束的放映”. Selecting one calls `focusInstance(...)`, then routes according to its existing lifecycle.
- Ended Instances appear in “往期放映”; Lobby shows up to three and `past` shows all. `history` is read-only.
- There is no standalone global “new performance” command. Every Stage listing is an entry to the existing creation flow. The Credits label “开始新的故事” only returns to Lobby.
- Tutorial, current programme, unfinished list, Stage list, and history are **IMPLEMENTED BUT PLACEHOLDER UI**. Their underlying queries/actions are implemented domain behavior.

## 9. UI-Available State for a Future Visual Shell

No new fields or convenience APIs are required to read the following, but several values need filtering/reduction in the presentation layer.

### Per Stage

| Needed state | Availability | Current derivation |
|---|---|---|
| Stage identity/title | **AVAILABLE DIRECTLY** | `stage.id`, `stage.title`, plus existing title/copy fields |
| Scenario count | **DERIVABLE** | `stage.scenarios.length` |
| Unfinished Instance count | **DERIVABLE** | `store.listUnfinished().filter(i => i.stageId === stage.id).length` |
| Most recently touched Instance | **DERIVABLE** | first per-Stage item from `listUnfinished()`; means latest `updatedAt` mutation, not latest focus/view |
| Exactly one unfinished Instance | **DERIVABLE** | filtered count `=== 1` |
| Multiple unfinished Instances | **DERIVABLE** | filtered count `> 1` |
| Stage artwork/emblem/key art | **NOT AVAILABLE** | no first-class contract field; `materials` is not a key-art guarantee |

### Per Instance

| Needed state | Availability | Current field/derivation |
|---|---|---|
| Stage | **AVAILABLE DIRECTLY** | `stageId`, `stageSnapshot` |
| Scenario | **AVAILABLE DIRECTLY** | `scenarioId`, `scenarioSnapshot` |
| Current Scene ID | **AVAILABLE DIRECTLY** | `currentSceneId` |
| Current Scene object | **DERIVABLE** | find matching `scenes[].id`, with current code falling back to last Scene |
| Lifecycle | **AVAILABLE DIRECTLY** | `status` |
| Last activity timestamp | **AVAILABLE DIRECTLY** | `updatedAt`, with the mutation-not-focus caveat |
| Durable pending generation identity | **AVAILABLE DIRECTLY** | `pendingContinuation` |
| Live transport phase | **AVAILABLE DIRECTLY AT RUNTIME ONLY** | `workflow.snapshot().phase`; not durable across reload |
| Whether a pending request actually reached/succeeded at the model before a crash | **NOT AVAILABLE** | intentionally unresolved; recovery is explicit retry, never automatic guessing |

There is no canonical per-Stage aggregate object. A future Home may derive these read models, but must not persist them as narrative authority.

## 10. Turn / Generation Boundary

The frozen boundary is:

```text
UI composer/retry
-> MercuryCinemaGenerationWorkflow (TurnRunner responsibility)
-> MercuryCinemaContextCompiler
-> aiTransport.generateCinema
-> MercuryCinemaContinuityLedger
-> MercuryCinemaStore
-> MercuryIndexedDBCinemaRepository
```

Durability sequence for a new turn:

1. Workflow calls `appendUser(...)`; the user Segment is flushed to `segments` before any model request.
2. Workflow calls `markPendingContinuation(...)`; request/user/profile identity is flushed to the Instance header before the request.
3. Compiler constructs Frozen Truth, Continuity, Recent/Uncovered Story, and Current Turn. The current user text appears once.
4. The model response is validated and correlated to the exact `requestId`.
5. Ledger derives next `notes` and coverage from committed user/assistant prose.
6. `commitAssistantTurn(...)` appends the assistant Segment, writes notes/coverage, and clears pending identity in one Store mutation.
7. Repository commits the Instance header and assistant Segment in one IndexedDB transaction; Workflow flushes before reporting success.

On model/cancel failure, user prose and pending identity remain durable for explicit retry. On continuity derivation failure, assistant prose is still committed, old continuity/coverage is retained with `notes.lastFailure`, and raw prose remains authoritative.

The UI must not call `appendAssistant(...)`, write Segment records, clear pending state, or assemble generation context itself. The public helper exists in Store, but current UI correctly routes model turns through the Workflow and guarded `commitAssistantTurn(...)` path.

## 11. Persistence Map

Primary database: IndexedDB `mercury.cinema`, version `1`.

| Store/location | Durable contents |
|---|---|
| `meta`, key `root` | `schemaVersion`, `hasEntered`, `tutorialSeen`, `focusedInstanceId`, `draft`, `readingSettings` |
| `meta`, key `migration` | verified legacy-copy state/manifest and completion metadata |
| `instances`, key path `id` | every normalized Instance field except `segments`, plus Repository-only `instanceOrdinal`; includes snapshots, lifecycle, Scene state, notes/coverage, pending identity, errors, timestamps, profile history |
| `segments`, key path `id` | Segment fields plus Repository-only `instanceId` and `ordinal`; unique index `byInstanceOrdinal` on `[instanceId, ordinal]` |
| scoped legacy storage `cinema.v1` | retained legacy source/fallback before IndexedDB becomes authoritative; migration does not rewrite it |
| scoped marker `cinema.idb-authority.v1` | authority metadata preventing stale legacy fallback after verified migration |
| shared storage `generation-profiles.v1` | Generation Profile definitions; outside Cinema IndexedDB |
| shared Archive storage | source character/world data; Cinema reads character profiles but does not write them |

Repository joins Segment records back into each Instance in contiguous ordinal order. Segment `ordinal` is persistence ordering truth; the in-memory `segments[]` order is the corresponding domain view.

Runtime-only state includes controller `route`, `routeData`, `menuOpen`, `curtainMode`, timers, Workflow `activeRequest`/AbortController/lease/listeners/phase, Store listeners/readiness/write queue/error objects, and Repository `mode`/`lastState`. None is a fourth narrative store.

## 12. UI Hard Invariants

1. **Primary World/Archive and Cinema remain isolated.** Cinema declares `archive-read`, calls only `archiveStore.load()`, consumes `runtimeProfiles`, and stores a normalized `characterSnapshot` plus per-Instance `variant`. It does not consume or write Archive `worlds`, and does not call Archive mutation methods. “Primary World” is not a Cinema Instance field.
2. **Existing Stage/Scenario snapshots are historical authority.** Catalog edits must not rewrite them. Future UI must not use generic `updateInstance(...)` to replace snapshots.
3. **Multiple unfinished Instances remain supported.** No Stage/Scenario uniqueness assumption may be introduced.
4. **Focus and lifecycle remain separate.** Selecting/focusing an Instance must not implicitly resume, pause, end, or advance it.
5. **Pause/resume alone does not advance Scene.** It changes only lifecycle and `updatedAt`.
6. **Browsing Stages is non-narrative.** Current browse routes mutate nothing; explicit selection may create/update a draft, while only `openCurtain()` starts an Instance.
7. **UI does not fabricate assistant turns.** All generated continuation work goes through `MercuryCinemaGenerationWorkflow` and its guarded commit sequence.
8. **Pending recovery remains explicit.** Reload does not auto-resend. Current readiness UI shows retry and suppresses the composer while durable pending identity exists.
9. **New input cannot overwrite pending identity.** Workflow returns `pending-exists`; Store rejects a different pending request; current UI hides new input.
10. **Raw Segments remain source of truth.** Summary/continuity is derived, never a replacement for raw prose; coverage advancement does not delete Segments.
11. **Segment ordering/evidence remains instance-local.** Repository ordinals must remain contiguous and `evidenceOrdinals[]` must continue to refer to that durable order.
12. **Current Scene is resolved from the Instance.** Scenario remains opening context and must never substitute for `currentSceneId -> scenes[]` in later-turn context.

## 13. Visual Redesign Seams

`cinema-app.js` is a single imperative controller rather than a component tree. Presentation can be replaced at method/block boundaries, but action handlers must continue to delegate to Catalog, Store, or Workflow rather than duplicating those rules.

| Seam | Current component/file | Domain data consumed | Action triggered | Safe to restyle? | Safe to replace presentation only? | Domain logic coupled? |
|---|---|---|---|---|---|---|
| App entry/readiness | `#renderHydrationState`, `#renderPersistenceFailure`, `#renderCurtain`; `cinema-app.js` | `store.ready`, `hasEntered` | `markEntered` in entry mode | Yes | Yes, if readiness/error gate stays | Yes at curtain callback |
| Cinema Home | `#renderLobby`, `#renderCurrentProgramme`, `#unfinishedRow`, `#renderStageProgramme`; app + CSS | catalog Stages, `focused()`, `listUnfinished()`, `listPast()` | navigation, tutorial, existing-Instance continuation | Yes | Yes | Low for read blocks; action handlers are inline |
| Stage browsing | `#renderStageProgramme`, `#renderStage`, `#renderMaterial` | Stage/Scenario/material catalog clones | route changes; explicit selection calls `beginDraft` | Yes | Yes for browse presentation | Yes at selection action |
| Scenario selection | No current component | Catalog already exposes `stage.scenarios[]` | None wired | N/A | N/A | **NOT IMPLEMENTED**; do not claim existing behavior |
| Preparation | `#renderPreparation` | durable `draft`, Stage/Scenario, Archive `runtimeProfiles` | repeated `updateDraft`; build Variant | Yes | Only if all draft writes/validation are preserved | High |
| Variant/Profile/Confirmation | `#renderVariant`, `#renderProfilePicker`, `#renderProgrammeConfirmation` | draft, catalog, profile store | draft snapshots; route to opening | Yes | Only with exact Store delegation | High |
| Unfinished Instance selection | `#continueInstance` plus Lobby rows | Instance `id/status` | `focusInstance`, then status-specific route; resume remains separate | Yes | Yes | Medium; focus/routing policy is inline |
| Reading entry/display | `#renderReading`, `#renderSegment` | focused Instance, current Scene, raw Segments, reading settings | display only until composer/menu action | Yes | Yes for prose/header rendering | High around recovery/composer/menu |
| Turn composer/retry/cancel | `#renderReading`, `#generationError` | Workflow state, `pendingContinuation`, `lastError` | `continueWith`, `retry`, `cancel` | Yes | Yes only as a thin Workflow client | High; never replace with direct Store writes |
| Back navigation | `#pageHeader`, `#go` | runtime route only | route switch | Yes | Yes | Low, but route state is not domain history |
| Pause/resume | `#readingMenu`, `#renderIntermission`, resume curtain | focused Instance status | `intermission`; later explicit `resume` | Yes | Yes if two-step lifecycle remains | High |
| Ending/archive | `#renderEndingConfirmation`, ending curtain, Credits/Past/History | Instance lifecycle and read-only content | `beginEnding`, timed `finish`, then navigation | Yes | Read-only archive views yes; ending controls need review | High at ending curtain |
| Story Notes | `#renderNotes` | partial `instance.notes`, Stage places, recent user Segments | navigation only | Yes | Yes | Low, but current renderer is not a full/stable ledger view model |
| Reading settings | `#renderReadingSettings` | root `readingSettings` | `updateReadingSettings` | Yes | Yes | Medium; durable non-narrative writes inline |

Two current placeholder mismatches deserve review during later presentation work, without changing domain architecture now:

- Tutorial/Stage copy sometimes calls Scenario `场景`; domain semantics and Context Compiler correctly distinguish Scenario from Scene.
- Story Notes renders only a subset of structured continuity and currently treats `notes.places` as display-ready values even though Ledger entries can be records. The ledger schema, not this renderer, is authoritative.

## 14. Smallest Useful File Map

- `app/apps/cinema-app.js` — all current Cinema route state, DOM rendering, and inline UI-to-domain action wiring.
- `app/styles/cinema-app.css` — current Cinema presentation layer.
- `app/core/cinema-stage-catalog.js` — generic Stage/Scenario normalization, registration, lookup, and the Aevoria production seed.
- `app/core/cinema-contracts.js` — root/draft/Instance/Scene/Segment/snapshot/notes contracts and Instance creation.
- `app/system/cinema-store.js` — focus, multiple unfinished Instances, lifecycle, turn mutations, reading settings, and serialized persistence coordination.
- `app/system/cinema-repository.js` — IndexedDB `meta/instances/segments`, ordinal reconstruction, atomic diffs, and legacy migration authority.
- `app/use-cases/cinema-generation-workflow.js` — TurnRunner owner for durable user/pending/assistant sequencing, transport, retry, cancellation, and correlation.
- `app/use-cases/cinema-context-compiler.js` — frozen truth/continuity/recent/current-turn assembly and deterministic text budgeting.
- `app/use-cases/cinema-continuity-ledger.js` — normalized continuity, evidence extraction, checkpoint summary, and monotonic coverage.
- `app/core/generation-profile-contracts.js` and `app/system/generation-profile-store.js` — external Generation Profile definitions/storage snapshotted by Cinema.
- `app/core/archive-contracts.js` — external Archive source read by Cinema for character snapshots; not a Cinema persistence owner.
- `app/tests/cinema-app-readiness.test.js` — hydration/error gates and reload pending-retry UI.
- `app/tests/cinema-stage-catalog.test.js` — generic Stage rendering and no Aevoria branching/leakage.
- `app/tests/cinema-contracts.test.js` — snapshots, Scenario/Scene inputs, variants, neutral Stage behavior, and compatibility hydration.
- `app/tests/cinema-store.test.js` — multiple unfinished Instances, focus/lifecycle, pause/resume, reload, pending identity, and write serialization.
- `app/tests/cinema-repository.test.js` — migration, three-store durability, ordinal isolation, diffs, and atomic assistant/coverage commit.
- `app/tests/cinema-generation-workflow.test.js` — turn order, retry/idempotency, request correlation, cancellation, profile binding, and failure durability.
- `app/tests/cinema-context-compiler.test.js` — Scenario/Scene distinction, coverage/context layers, delayed relevance limits, correction authority, and budget pressure.
- `app/tests/cinema-continuity-ledger.test.js` — evidence, monotonic coverage, and summary-failure preservation.
- `server/tests/cinema.test.js` — server-side Cinema generation request/response and transport-boundary validation.

## 15. Current Test Safety Net

| Test family | Boundary protected |
|---|---|
| `cinema-stage-catalog.test.js` | Multiple generic definitions enumerate in registration order; neutral Stage/Scenario work without assets/specializations or Aevoria-specific renderer branches. |
| `cinema-contracts.test.js` | Archive character and Generation Profile are copied; Variant does not mutate Archive; existing Stage/Scenario snapshots survive catalog edits; missing templates retain prose; Scenario setup remains separate input to current Scene compilation. |
| `cinema-store.test.js` | Two unfinished Instances coexist; focus does not resume; intermission/resume/reload/pending do not create Scenes; lifecycle changes remain instance-local; finish moves only the target to past; writes serialize/fail explicitly. |
| `cinema-repository.test.js` | Verified non-destructive migration; `meta/instances/segments` isolation; contiguous ordinals; one-Instance diffs; assistant Segment, notes coverage, and pending clear reload atomically; authoritative IDB never silently falls back to stale legacy prose. |
| `cinema-generation-workflow.test.js` | User and pending flush before request; assistant/continuity flush before success; failure/retry does not duplicate user prose; per-Instance lease prevents duplicate concurrent retry; request IDs correlate responses; original pending profile is reused; cancel retains recovery; continuity failure retains raw turn. |
| `cinema-context-compiler.test.js` | Current user turn is not duplicated; Scenario is opening context and current Scene is resolved separately; covered prose is not replayed; structured early facts/corrections retain authority; delayed unextracted facts remain only in raw prose; budget behavior is deterministic. |
| `cinema-continuity-ledger.test.js` | Evidence ordinals survive; summary coverage advances monotonically; forced ledger failure does not mutate raw prose or advance previous coverage. |
| `cinema-app-readiness.test.js` | No UI/default-state overwrite before hydration; read failure is explicit; durable pending continuation appears as explicit retry after reload and suppresses new composer input. |
| `server/tests/cinema.test.js` | The server Cinema operation validates the request/response boundary used by the Workflow transport. |

The test suite protects current contracts, but it does not provide a component-level contract for replacing `cinema-app.js`; the future visual pass must preserve Store/Workflow calls explicitly.

Audit-time verification: `npm test` passed `69` files with `2214` assertion calls, `0` skipped, and `0` failures.

## 16. Final Design-Handoff Summary

### WHAT THE FUTURE CINEMA HOME MAY SAFELY CONTROL

- Runtime-only visual selection, ordering presentation, scrolling, expansion, and navigation among catalog Stages.
- Read-only presentation of `listStages()`, `focused()`, `listUnfinished()`, and `listPast()` results.
- Derived per-Stage Scenario counts, unfinished counts, one-versus-many state, and latest-`updatedAt` Instance.
- Read-only presentation of Instance Stage/Scenario snapshots, current Scene, lifecycle, last activity, and pending indicator.
- Navigation into the existing Stage/preparation flow without creating an Instance merely by browsing.
- User-requested focus switching through `focusInstance(...)`, while leaving resume/end decisions explicit.
- Presentation-only replacement of Lobby, Stage browsing, material, credits, past/history, and prose/notes surfaces while retaining their domain delegates.

### WHAT THE FUTURE CINEMA HOME MUST NOT OWN

- Stage/Scenario definition mutation or historical snapshot rewriting.
- Per-Stage uniqueness assumptions for unfinished Instances.
- Lifecycle transition rules, focus policy, Scene progression, or curtain-side effects.
- Instance creation outside `openCurtain()` and its validated draft/snapshot path.
- Direct user/assistant Segment persistence, Segment ordering, or assistant fabrication.
- Turn correlation, model transport, retry/idempotency, cancellation semantics, or pending recovery.
- Context compilation, Scenario/Scene interpretation, Generation Profile assembly, continuity extraction, summary coverage, or evidence provenance.
- IndexedDB transactions, legacy migration/authority, raw-prose retention, or derived aggregate persistence.
- Writes to Archive/Primary World characters or worlds from Cinema browsing or performance state.
