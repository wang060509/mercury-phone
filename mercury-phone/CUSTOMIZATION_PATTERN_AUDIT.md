# Mercury Phone Customization Pattern Audit

Status: research baseline for the post-Alpha Customization phase  
Audited baseline: `711f3d8`  
Research date: 2026-09-06  
Scope: product architecture and interaction patterns only; no implementation or schema is authorized by this document.

## Decision Summary

The next highest-leverage Customization slice should be **guided Cinema World creation**, not a second Character system, a universal settings engine, or a media manager.

Mercury already has substantial Character authoring, import, Archive WorldBook, Cinema preparation, snapshot, and recovery capabilities. Its largest replayability and ownership gap is that the World Library can present worlds but ordinary users cannot yet turn an idea into a reusable playable Cinema World without understanding internal structures.

The recommended default path is:

```text
natural-language idea
-> at most two small, defaultable framing decisions
-> AI proposes a World
-> readable review
-> save to World Library
-> select Character
-> existing Performance preparation and curtain lifecycle
```

The source of truth remains:

```text
Primary Archive Original Character
!= Cinema Character Interpretation

Archive WorldBook
!= Cinema World Definition

mutable authoring asset
!= opened Performance snapshot

presentation imagery
!= narrative truth or model context
```

## Evidence Boundary

This audit compares the current Mercury repository with:

- public first-party documentation for mature character-RP and interactive-fiction products;
- public specifications where interoperability behavior is relevant;
- a local, Git-excluded virtual-phone reference cohort.

The local cohort was used only to corroborate abstract mechanisms: compact creation forms, inspect-before-save import, library/item/binding separation, presentation-asset references, and ownership-based backup catalogs. No local source name, code, field name, wording, visual asset, identifier, or distinctive expression is carried into this document.

The strongest public evidence is consistent on five points:

1. A useful asset can begin with very little required input; advanced definitions are hidden until requested. [Character authoring documentation](https://docs.sillytavern.app/usage/core-concepts/characterdesign/)
2. Reusable knowledge is managed as a library, while activation and context-specific binding are separate concerns. [World information documentation](https://docs.sillytavern.app/usage/core-concepts/worldinfo/), [lore library documentation](https://docs.novelai.net/en/text/lorebook/)
3. Reusable starting configurations are distinct from the playthroughs created from them. A start may ask a short set of questions, then produce and save an independent playthrough. [Scenario documentation](https://help.aidungeon.com/faq/what-are-scenarios)
4. Guided choices can shape a generated opening without exposing the full authoring surface. [Guided character-start documentation](https://help.aidungeon.com/faq/whats-the-difference-between-scenarios-and-worlds)
5. Power-user inspection is valuable, but belongs behind an advanced surface that explains what was included and why. [Context inspection documentation](https://docs.novelai.net/en/text/editor/advancedsettings/)

These sources demonstrate patterns, not a design to copy. Mercury terminology, screens, domain boundaries, and visual language remain its own.

## A. Pattern Matrix

| Research dimension | Proven pattern | Why products use it | Failure mode it prevents | Mercury applicability | Recommendation |
| --- | --- | --- | --- | --- | --- |
| First useful asset | Require one identity or idea; allow the rest to be empty, defaulted, or proposed. | Reduces the expertise required before value is visible. | Empty-form paralysis and abandonment before first use. | Archive already supports sparse manual starts; Cinema World authoring does not. | Require only a natural-language World idea. Make all framing questions answerable by a recommended default. |
| Progressive disclosure | Present a compact common path and place raw or high-impact controls behind Advanced. | Keeps routine creation legible while retaining expert control. | A configuration cockpit that teaches implementation details before purpose. | Mercury has rich underlying Character fields and several preparation controls. | Use three levels: quick create, readable review, Advanced Edit. Never begin on the raw definition. |
| AI-assisted authoring | Generate a proposal into a reviewable draft, not directly into canonical storage. | AI can expand intent quickly while the user retains authority. | Silent invention becoming truth and failed generation corrupting a valid asset. | Archive analysis already follows an assistive direction; World creation is missing it. | Preserve the user's idea, show generation status, and save only after explicit acceptance. |
| Human-readable review | Summarize the proposed asset by product concepts, with an escape hatch to inspect details. | Users can evaluate meaning without reading serialized data. | Approval without comprehension and accidental prompt-level editing. | Cinema already has editorial review surfaces and projection patterns. | Review premise, objective facts, invariants, default experience, and reusable openings as a document, not a field dump. |
| Content versus organization | Keep user-facing title/notes and model-relevant content semantically distinct. | Organization text often has a different audience and lifecycle. | Internal labels leaking into prompts or prompt content being hidden as metadata. | Archive and Cinema already distinguish some presentation and runtime data. | Every future authoring decision must declare whether it is user-only, presentation-only, or eligible for runtime context. |
| Library versus binding | Edit reusable assets in their owning library; bind or select them from the consuming context. | One asset can be reused without duplicating it into every session. | Divergent copies and editors appearing on unrelated screens. | Archive owns Characters and WorldBooks; Cinema consumes snapshots. | Archive edits Original Characters/WorldBooks. World Library edits playable Worlds. Cast and preparation select or adapt; they do not take ownership. |
| Reusable template versus playthrough | A reusable start owns defaults; each launched experience becomes an independent saved instance. | Users can replay a premise with different choices while preserving history. | Editing a template rewriting an active or ended story. | Cinema Draft and Instance snapshots already establish this boundary. | World Definition and openings stay reusable; `openCurtain()` resolves and snapshots the chosen configuration. |
| Defaults and overrides | Resolve a small, explicit chain and show the effective source near the control. | Users need predictable inheritance and a way back to the inherited value. | Invisible overrides, stale values, and a generic precedence engine no one understands. | Generation Profile, World selection, Adaptation, and Reading settings already have different owners. | Implement precedence separately per approved setting. Show “using X” and “reset to X”; do not build a universal inheritance framework. |
| Knowledge activation | Keep ordinary entry content simple; hide placement, budget, and activation controls in Advanced. | Most authors need facts, while power users need deterministic context control. | Casual users breaking retrieval or spending context unintentionally. | Archive WorldBook already has entry activation and budget semantics. | Preserve WorldBook as knowledge infrastructure. Do not expose its advanced retrieval controls in World Creator's default path. |
| Explainability | Offer an optional inspection view showing included sources, exclusions, order, and limits. | Power users can diagnose behavior without making the default workflow technical. | “The AI ignored my setting” with no observable cause. | Mercury has provenance and snapshot data but no unified customization explanation. | Later add a read-only “what this Performance uses” view. Keep it out of the MVP creation path. |
| User correction | Allow edit, retry, undo where still mutable, and an explicit commit boundary. | Generated content is fallible and users need final authority. | AI interpretation becoming irreversible or retries destroying good work. | Runtime pending/closure recovery is strong; authoring recovery is less complete. | World generation preserves the last accepted draft and user input. Retry creates another proposal; it does not overwrite a saved revision. Direct narrative editing remains outside this slice. |
| Import/export | Import into a preflight or draft, preserve unknown safe data where possible, validate, then confirm. Export the owned canonical asset. | Interoperability is unsafe when parsing and committing are the same action. | Invalid imports, silent field loss, and half-created assets. | Archive already has preflight/source preservation and canonical export paths. | Reuse the same interaction principle for future World import, but do not add import to the first World Creator slice. |
| Presentation assets | Manage media through references with crop/position and fallback behavior; consumer surfaces do not own copies. | The same visual can be replaced or reused without contaminating narrative data. | Blob duplication, broken references, and images becoming required truth. | Chat has per-conversation appearance; Cinema has deterministic no-image fallbacks; a shared presentation module is missing. | Reserve a presentation-asset seam. The World MVP accepts no image or one optional reference; no central media-management UI yet. |
| Themes and reset | Save named appearance configurations and provide explicit reset independently from content. | Appearance experimentation should not threaten authored work. | Users avoiding customization because reset is destructive or unclear. | Chat and Reading expose some appearance controls and defaults. | Keep app/mode appearance in Settings. “Reset appearance” must never reset Character, World, or Performance content. [Theme management documentation](https://docs.sillytavern.app/usage/core-concepts/uicustomization/) |
| Delete while referenced | Distinguish removal from selection, archival, and irreversible purge; preserve snapshots already used by playthroughs. | References outlive the mutable source asset. | Broken history and ended works changing after publication. | Cinema already snapshots Character, Stage, Scenario, and Generation Profile inputs. | Referenced assets are archived from new selection rather than hard-deleted. Existing Instance and History snapshots remain readable. |
| Draft and failure recovery | Autosave user input and mutable drafts; make retry, cancel, discard, and resume distinct actions. | Network and AI failures are normal authoring states. | Duplicate assets, phantom saves, or loss after reload. | Cinema Draft and pending continuation recovery provide strong precedents. | Give AI build a durable request identity and idempotent acceptance. Never create a canonical World from a partial or failed response. |
| Mobile asset management | Library list supports search/filter; item view owns inspect/edit/duplicate/export/archive; binding is a separate compact picker. | Large collections cannot remain navigable if every consumer embeds a full editor. | Long forms inside play flows and inconsistent lifecycle actions. | Archive already approximates this for WorldBooks; World Library needs an authoring counterpart. | Keep lifecycle commands in the owning library and expose only selection, summary, and override at preparation time. |

### Cross-pattern conclusion

The repeated mechanism is a deep authoring module with a small Interface:

```text
idea/import -> recoverable draft -> proposal -> human acceptance -> reusable asset
reusable asset -> explicit selection/binding -> resolved draft -> immutable play snapshot
```

The UI may expose this through several screens, but ownership and commit boundaries should remain local. A large shared customization object would make the module shallow and couple Archive, World Library, Programme, and runtime assembly.

## B. Existing Mercury Coverage

### Track A: Character authoring

**Already implemented**

- Primary Archive owns the Original Character and its runtime profile.
- Manual creation, import preflight, source-asset preservation, analysis-assisted filling, sectioned inspection/editing, canonical export, and deletion exist.
- Character data is rich enough to represent identity, stable behavior, motivations, boundaries, expression, openings, relationships, and creator metadata.
- Cinema consumes a Character snapshot rather than mutating the Original Character during a Performance.

**Partially implemented**

- A sparse manual start exists, but the ordinary-user flow still exposes more structure than a guided quick-create experience should.
- AI analysis can assist, but proposed changes are not yet presented as a consistent review/diff/accept workflow across all Character authoring.
- Character visual identifiers exist, but there is no complete reference, crop, replace, reset, backup, and usage lifecycle.
- Status supports draft/readiness concepts, but reload recovery, version history, and undo are not yet a coherent authoring experience.

**Missing**

- A guided Character quick-create path owned by Archive.
- A durable AI proposal workflow that leaves the Original Character untouched until acceptance.
- Safe duplicate/revision restore and a clear “used by existing Performances” deletion explanation.
- A complete presentation-asset lifecycle.

**Conclusion**

Character authoring is not the first Customization implementation priority. Improve the existing Archive system later; do not build a second Character model in Cinema.

### Track B: Cinema World authoring

**Already implemented**

- Archive owns WorldBooks as reusable knowledge assets with entries and retrieval behavior.
- Cinema has a stable static Stage/Scenario path sufficient for the Alpha vertical slice.
- World Library provides a Cinema-owned discovery/selection surface.
- Draft and Instance creation already snapshot inputs so historical Performances remain stable.

**Partially implemented**

- WorldBooks can describe a world and relate to Characters, but they do not define a playable Cinema experience.
- Static Stages and Scenarios provide the current catalog Interface, but users cannot author an equivalent reusable World.
- World presentation has deterministic no-image fallbacks, but optional visual ownership is only reserved.

**Missing**

- Cinema World Definition as a reusable playable asset distinct from Archive WorldBook.
- Guided idea-to-World creation, AI proposal, review, Advanced Edit, acceptance, and draft recovery.
- Authored objective facts, invariants, default experience, reusable openings, and future module boundaries.
- Version/change behavior for a World used by active or ended Performances.

**Conclusion**

This is Mercury's clearest high-value gap and should be the first implementation slice.

### Track C: Visual customization

**Already implemented**

- Chat has per-conversation appearance controls and reset behavior.
- Reading has user-facing typography and presentation settings.
- Archive and Cinema have deterministic fallbacks, so images are not required for creation or play.
- Cinema's product rule already keeps optional presentation media outside canonical narrative truth.

**Partially implemented**

- Some surfaces support backgrounds, avatars, crop position, or theme-like choices, but ownership and storage are not normalized.
- Asset identifiers are present in parts of the domain, but not backed by one complete lifecycle and usage graph.

**Missing**

- A presentation-asset module that can import, resolve, replace, reset, report usage, and participate in backup/restore.
- Fixed crop and tonal normalization rules for heterogeneous Character and World images.
- A clear ownership map for global, Character, World, Performance, and app/mode visuals.

**Conclusion**

Reserve the module boundary now, but defer a user-facing media manager until after World creation. Do not add AI image generation.

### Track D: Performance-level customization

**Already implemented**

- Character Adaptation, Scenario/Opening Setup, Shared History, Generation Profile selection, and Reading appearance controls exist.
- `Before the Curtain` is already the ritual preparation boundary.
- Opening resolves mutable draft choices into an Instance snapshot.

**Partially implemented**

- Defaults are applied, but the user is not always shown the effective value and its source.
- Preparation supports several edits, but does not yet present a concise configuration summary across Character, World, and Performance.

**Missing**

- A source-aware “using recommended/custom” explanation and reset action for each approved override.
- Future Narrative Direction, if later justified by product evidence.
- An explicit policy for which presentation changes are safe during a Performance.

**Conclusion**

The next improvement here should be clarity, not more controls: show resolved defaults and ownership in preparation, while keeping the default path fast.

### Recovery and data ownership

**Strong baseline**

- Cinema Draft, pending continuation, closure, reload, and snapshot semantics are already robust.
- Existing Performance history is isolated from later Character or catalog edits.
- Local Data Vault has an authoritative ownership catalog and explicit inclusion/redaction/exclusion policies.

**Remaining gaps**

- Customization authoring does not yet share an equivalent durable draft/proposal/acceptance lifecycle.
- Full global restore is not complete.
- Future binary presentation assets will need explicit registration in the ownership catalog; otherwise backup can silently omit them.

## C. Proposed Customization IA

### Primary Archive

Owns:

- Original Characters;
- Archive WorldBooks and their knowledge entries;
- Generation Profiles;
- import, canonical export, duplicate/version/archive actions for its own assets.

May later add a guided Character creator:

```text
name + freeform core idea
-> optional opening preference
-> AI proposes structured interpretation
-> readable comparison
-> user accepts or edits
-> advanced sections
```

It must not receive Cinema Adaptation changes automatically. A user may deliberately copy an interpretation into the Original Character only through a future explicit Archive-owned action.

### World Library

Owns:

- Cinema World Definitions;
- World creation, inspect, edit, duplicate, version/archive, export, and optional presentation visual;
- World invariants and default experience;
- reusable Scenarios/Openings associated with the World;
- future World Modules, if later justified.

It does **not** replace Archive WorldBook. A playable World may later reference zero or more Archive WorldBooks through an explicit binding seam, but knowledge retrieval and playable-world authorship remain separate modules.

World Library is the only entry for `新建世界`. The default create screen asks for an idea, not a schema.

### Cast

Owns no Original Character data.

Responsibilities:

- browse/select Archive Characters for Cinema;
- show Cinema eligibility/readiness truthfully;
- enter Character Adaptation for the selected World/Performance;
- display the currently effective Character interpretation and whether it differs from the Original Character.

Cast must not become a duplicate Archive editor.

### Programme

Owns Performance selection and lifecycle entry, not reusable asset authoring.

Responsibilities:

- ongoing and ended Performance access;
- starting a new Performance;
- selecting a World and Character, or routing to their owning libraries when none exist;
- resuming pending/unfinished work through existing explicit semantics;
- archive/history access.

Programme must not embed World or Character advanced editors.

### Performance preparation

Owns only the mutable configuration for one prospective Performance:

- selected Original Character snapshot candidate;
- selected Cinema World and Scenario/Opening;
- Character Adaptation for this World/life;
- Shared History and opening setup;
- Generation Profile selection;
- future, narrowly approved Performance-level narrative or presentation overrides.

The preparation UI should display an effective configuration summary:

```text
value
source: Mercury / Character / World / this Performance
action: change
action: reset to the immediate source
```

Opening the curtain is the commit boundary. After that, runtime uses the snapshot; later source-asset edits do not rewrite the Performance.

### Settings / Appearance

Owns:

- global and app/mode presentation defaults;
- accessibility defaults;
- theme-like appearance configurations;
- eventual presentation-asset library and storage health;
- appearance-only reset and backup participation.

It does not own Character identity, World truth, Performance continuity, or model-context content.

### Presentation-asset ownership map

| Asset | Owning surface | Consumer behavior | Canonical effect |
| --- | --- | --- | --- |
| Product fallback | Mercury package / Settings policy | Resolve when no user asset exists | None |
| Original Character visual | Primary Archive | Cast/Programme use a normalized rendition | Presentation only unless a future explicit feature says otherwise |
| World visual | World Library | Library, Programme, and optional Reading plate use a normalized rendition | None |
| Performance/Act/Scene visual | Performance presentation metadata | Reading may reveal it contextually and collapse cleanly when absent | None |
| App/mode background | Settings / Appearance | The owning app resolves the selected theme/reference | None |

The internal presentation module should be deep: consumers request a normalized rendition and fallback; they should not know blob storage, migration, cleanup, or crop implementation.

### Explicit override resolution

Use the following candidate order only where that setting semantically exists at every applicable level:

```text
product default
-> Character-owned preference
-> World default experience
-> Performance Draft override
-> opened Instance snapshot
```

This is not authorization for a generic inheritance engine. Each setting needs an explicit resolver, source label, reset target, and test matrix. Examples:

- Character expression may begin from the Original Character, be adapted for a World, and be overridden only in this Performance.
- World experience defaults may influence pacing or opening setup but cannot overwrite Original Character truth.
- Reading appearance may use an app default and a Performance-local preference without involving Character or World.
- Presentation imagery follows fallback/reference rules and never enters runtime context merely because it is visible.

## D. MVP Recommendation

### Recommended slice: Guided Cinema World Creator

Deliver one complete vertical slice from `World Library -> New World` through saving a reusable playable World and reaching the existing Character selection/preparation flow.

Do not include Character creation, World import, a general media manager, or runtime editing in this slice.

### Default-user decision budget

Before the first useful generated World proposal:

1. Enter one natural-language idea. Required.
2. Accept or change one recommended experience frame. Defaulted.
3. Optionally choose an opening shape. Skippable and defaulted.

Target: **one required authored decision, no more than two visible optional decisions** before generation.

After accepting the World, starting a Performance should require only selecting a Character if one is not already focused. Existing static Worlds remain immediately playable with zero authoring decisions.

### User flow

```text
World Library
-> New World
-> idea + up to two defaultable framing choices
-> Build
-> durable generating state
-> readable proposal
-> [Save World] or [Revise] or [Advanced Edit]
-> saved World detail
-> Start a Performance
-> existing Cast / Adaptation / Before the Curtain path
```

### Proposal review

The first review should expose product meaning, not storage shape:

- the premise in plain language;
- objective World facts;
- invariants the Performance must preserve;
- Mercury's proposed default experience;
- one or more reusable opening setups only when the generation produced them;
- an optional visual state that defaults to Mercury's deterministic fallback.

`Advanced Edit` may reveal the same approved concepts in structured form. It must not expose raw serialized data or Archive WorldBook retrieval controls.

### AI and commit semantics

- The user's input and selected framing choices are autosaved locally before the request starts.
- The request has a durable identity so reload or repeated taps cannot create duplicate Worlds.
- Generation output is a proposal. It is not canonical and is not selectable by a Performance until accepted.
- Failure preserves the last user-authored draft and last accepted proposal. Retry is explicit.
- Partial output is inspectable only if valid enough to render truthfully; it cannot be saved as canonical by accident.
- `Save World` is idempotent and produces one stable reusable asset.
- `Revise` creates a new proposal while preserving the prior proposal for the current authoring session.
- No AI-generated image is requested.

### Change, reference, and deletion behavior

- An authoring draft is mutable and recoverable.
- A saved World has stable identity and change metadata; the exact revision schema remains a later implementation decision.
- Editing a saved World changes future selections only.
- Opening a Performance snapshots the resolved World/Scenario inputs through the existing Cinema lifecycle.
- If a World is referenced by an active or ended Performance, “delete” means archive it from new selection. Existing snapshots and History remain readable.
- Irreversible purge is allowed only for an unreferenced asset, with explicit confirmation, and need not be part of MVP.
- Duplicate creates a new independent World identity.

### Lifecycle actions by phase

| Action | MVP | Later | Reason |
| --- | --- | --- | --- |
| Create from idea | Yes |  | Core ownership and replayability gain |
| Inspect/readable preview | Yes |  | Required user authority boundary |
| Edit proposal | Yes |  | Correct AI interpretation before commit |
| Advanced Edit | Narrow | Expand | Preserve progressive disclosure without blocking expert correction |
| Duplicate saved World | Yes |  | Safer experimentation than destructive editing |
| Archive from new selection | Yes |  | Protect referenced Performances |
| Recover draft after reload | Yes |  | AI/network failure is routine, not exceptional |
| Reset individual recommendation | Yes |  | Makes defaults understandable and reversible |
| Export |  | Yes | Valuable, but not needed to prove the authoring loop |
| Import |  | Yes | Requires a separate validation/preflight contract |
| WorldBook binding |  | Yes | Keep World Definition and retrieval concerns separate in MVP |
| Version history/restore | Minimal metadata only | Yes | Full version UI increases migration and testing scope |
| Hard purge |  | Yes | Unsafe until reference inspection is complete |
| Optional visual replace/crop | Only if existing asset seam suffices | Yes | World must remain complete with no image |
| AI image generation | No | No current plan | Outside the approved product boundary |

### New domain requirements

The MVP needs design approval for these concepts before code:

- a reusable Cinema World Definition owned by World Library;
- mutable authoring draft versus AI proposal versus accepted World;
- objective facts, invariants, default experience, and reusable openings as separate meanings;
- stable identity and enough change metadata to protect references;
- an Adapter that lets authored Worlds participate beside the current static Stage catalog;
- a snapshot projection into the existing Cinema Draft/Instance boundary;
- explicit archive/reference policy;
- durable generation request and idempotent acceptance.

It does **not** need a finalized universal schema, generic inheritance engine, or changes to Phase 2D pending/closure contracts.

### UI requirements

- World Library `New World` entry.
- One compact idea/framing screen.
- One durable generating/error/reload-recovery state.
- One readable proposal screen with Save, Revise, and Advanced Edit.
- A narrow structured editor for approved concepts only.
- Saved World detail with Start, Edit, Duplicate, and Archive actions.
- Reference-aware archive confirmation.
- Deterministic no-image cover and accessible mobile interactions at the established `390x844` baseline.

Any new visual surface should follow the established process: generate and approve one reference, reconstruct deterministically, compare reference/current/overlay, then propagate the component family.

### Migration risk

**Overall: medium.**

- Low risk if authored Worlds are added beside static Stages through an Adapter and only new data uses the new owner.
- Medium risk at the World-to-Scenario-to-Draft projection boundary; identity and snapshot semantics must remain stable.
- Medium risk for deletion/archive and duplicate behavior because existing Performances may reference earlier versions.
- High risk if implementation tries to replace Archive WorldBook, rewrite static Stage data, generalize all settings, or alter current Instance/pending/closure contracts. Those approaches are out of scope.
- Presentation blobs raise separate backup/migration risk and should remain optional or deferred.

### Testing burden

**Focused contract tests**

- draft/proposal/accepted transitions;
- invalid and partial AI output;
- retry, cancel, duplicate response, reload, and idempotent Save;
- explicit effective-source/reset behavior for each MVP default;
- duplicate and archive semantics;
- authored World projection into Cinema Draft and Instance snapshot;
- edit/archive after active and ended Performances exist;
- no-image fallback and proof that imagery never enters canonical runtime input.

**Integration tests**

- empty World Library -> create -> accept -> select Character -> existing preparation;
- existing static World path remains unchanged;
- AI failure -> reload -> recover draft -> retry -> one saved World;
- edit a World after opening -> active/History snapshot remains unchanged;
- archive a referenced World -> hidden from new selection but old Performance remains readable;
- Local Data Vault export includes all new owned records and intentionally handles any asset references.

**Visual and interaction tests**

- one real `390x844` reference/current/overlay gate per new screen family;
- keyboard, screen-reader naming, reduced motion, 44px targets, inert surrounding space, and one tap -> one action;
- long Chinese content, missing optional sections, generation error, and no-image states.

### Recommended implementation order when development resumes

1. Freeze the World Definition terminology, ownership, lifecycle states, and snapshot projection in a narrow ADR/spec review.
2. Implement the deep authoring module and contract tests without replacing the static Stage path.
3. Produce and approve the World Creator idea/framing visual reference.
4. Reconstruct that representative screen in production and pass its visual/interaction gate.
5. Add generating/recovery and readable proposal surfaces, one gate at a time.
6. Connect acceptance to World Library, then to the existing Cast/preparation path.
7. Verify snapshot stability, archive behavior, backup coverage, and the full release baseline.

This order is intentionally one representative surface at a time, not authorization for continuous multi-screen construction.

## E. Explicit Non-goals

The first Customization implementation must not include:

- a second Character system or Cinema-owned Original Character editor;
- automatic write-back from Character Adaptation to Primary Archive;
- replacement of Archive WorldBook with Cinema World Definition;
- a universal settings inheritance engine;
- a broad editable World architecture before the World Creator domain boundary is approved;
- modification of Phase 2D pending, recovery, closure, snapshot, or History contracts;
- continuity correction or editing canonical evidence;
- editing ended Performance snapshots;
- runtime scripts, regex authoring, or a general prompt-programming cockpit;
- AI image generation;
- a required Character, World, Act, or Scene image;
- one visual asset per Scene or Act;
- automatic presentation imagery entering model context;
- a full media-management product in the World Creator MVP;
- automatic generation of canonical relationship conclusions or Character interpretations;
- Narrative Direction until its ownership, runtime effect, and recovery semantics are separately approved;
- unrestricted mid-Performance domain editing;
- marketplace, publishing, collaboration, cloud sync, or community sharing;
- stats-first authoring dashboards;
- hard deletion of referenced assets;
- bulk migration of existing static Stages into speculative authored-world records;
- speculative schemas committed only to reserve future ideas.

## Future Starting Point

When Mercury development resumes, begin with the narrow terminology/ownership review in the MVP section. Do not reopen Cinema Alpha, redo the Closure lifecycle, or redesign the approved Cinema family. The first engineering question is not “what fields should a World have?” but:

> What is the smallest deep World-authoring module that can turn one user idea into a reviewable, recoverable, reusable Cinema World while preserving the existing Performance snapshot boundary?

Until that Interface is approved, this audit remains guidance rather than an implementation contract.
