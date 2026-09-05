# Mercury Cinema Closure Implementation Blueprint

> Frozen: 2026-09-05  
> Status: product and engineering decisions approved; visual generation and production implementation have not started.  
> Scope: `Intermission -> Credits -> Programme History`, delivered through strict per-screen visual gates.

## 1. Objective

Complete the first durable Cinema lifecycle without reopening the frozen Phase 2D generation architecture:

```text
Reading
-> explicit safe pause
-> Intermission
-> resume or Programme

Reading / Intermission
-> explicit ending confirmation
-> ending curtain lifecycle
-> durable ended commit
-> Credits
-> History Detail or Programme

Programme
-> ongoing and ended Performances
-> Programme Archive Index
-> read-only History Detail
```

Success means that a long Performance can be paused, resumed, explicitly ended, durably archived, found from Programme, and read from beginning to end without invented narrative facts or implicit model requests.

## 2. Frozen Product Rules

- Programme is the only user-level entrance to ongoing and ended Performances.
- Home remains a stable foyer and does not receive Performance metadata.
- `intermission` means an explicit safe pause in Alpha. It does not prove an Act ended or that a next Act exists.
- `幕间`, `第 N 幕落幕`, and `下一幕` remain unavailable until a real runtime Act-transition event exists.
- Ending is always initiated by an explicit user action. AI may not end a Performance.
- Closure makes no AI request and generates no canonical editorial summary.
- Ended Performances are read-only and cannot be continued.
- History is the complete work first; cover, contents, notes, and colophon may introduce it but may not replace the prose.
- Continuity and History remain read-only in this batch.
- Replay, fork, clone, bookmarks, highlights, annotations, export UI, search, filters, and active-play timing are deferred.
- Visual assets remain optional presentation metadata. Closure cannot depend on an image.
- Closure Alpha adds no AI image generation, vision input, image-to-continuity, or multimodal prompt contract.

## 3. Narrow Additive Data Contract

### 3.1 `closureRecord`

Add one optional Instance field with a deliberately narrow purpose:

```js
closureRecord: {
  version: 1,
  initiatedAt: "ISO timestamp",
  pendingDisposition: null | {
    kind: "abandoned-by-user",
    requestId: "...",
    userSegmentId: "...",
    startedAt: "ISO timestamp",
    settledAt: "ISO timestamp"
  }
}
```

Rules:

- It records lifecycle/provenance only.
- It never enters narrative prompts, continuity extraction, relationship truth, or Character knowledge.
- It must not become a miscellaneous metadata container.
- Normal ending records `pendingDisposition: null`.
- Pending abandonment copies the exact durable pending identity before clearing it.
- The referenced User Segment remains unchanged and in its original ordinal position.
- No assistant Segment is synthesized.
- `endedAt` remains the authoritative completion timestamp and is not duplicated in `closureRecord`.

### 3.2 `structureProvenance`

Add one minimal structure reliability marker:

```js
structureProvenance: {
  scenes: "runtime" | "compatibility-unknown"
}
```

Rules:

- New Instances created by the current runtime are `runtime`.
- Explicit valid provenance is preserved on normalization.
- Legacy data that required fallback Scene creation is `compatibility-unknown`.
- Migration may infer `runtime` only when the persisted structure is internally consistent and distinguishable from the compatibility fallback.
- Ambiguous data must resolve to `compatibility-unknown`.
- Do not add speculative future enum values.
- Compatibility Scenes may support safe continuous reading, but may not justify Act/Scene counts, a fabricated contents list, or canonical boundary claims.

### 3.3 Schema handling

- Increment the Cinema state schema version because Instance records gain durable semantic fields.
- Keep the IndexedDB object-store version unchanged unless implementation proves that a store/index migration is required.
- Existing Instance headers already serialize additive fields; repository changes should be avoided unless a failing persistence test demonstrates a real need.
- Add normalization and round-trip coverage for legacy, current, malformed, and reload cases.

## 4. Closure Operations

### 4.1 Normal ending

`beginEnding(instanceId)` must:

- accept only `active` or `intermission`;
- reject an Instance with `pendingContinuation` using a typed error;
- create an immutable normalized `closureRecord` with no pending disposition;
- transition to `ending` in one Store commit;
- be idempotent when the same Instance is already in the same valid ending lifecycle.

### 4.2 Pending abandonment

Add:

```js
abandonPendingAndBeginEnding(instanceId, expectedRequestId)
```

It must atomically:

1. require `active` or `intermission`;
2. require a durable pending continuation;
3. match `expectedRequestId` exactly;
4. verify the referenced User Segment still exists;
5. copy pending provenance into `closureRecord.pendingDisposition`;
6. clear `pendingContinuation`;
7. preserve every Segment and ordinal;
8. transition to `ending`;
9. emit one Store event and queue one state snapshot for persistence.

Idempotency:

- A repeated call with the same request identity against the matching existing closure record returns the unchanged Instance.
- A different or missing request identity fails closed.
- A late assistant response cannot commit because the pending identity no longer exists.

Runtime guard:

- An active in-flight generation must first be explicitly cancelled and settle.
- The controller/closure workflow enforces the active-operation guard.
- The Store operation independently enforces durable request identity.

### 4.3 Durable finish

Refactor `finish(instanceId)` so one normalized Store commit contains:

- `status: "ended"`;
- `endedAt`;
- the Instance `updatedAt`;
- root `focusedInstanceId` reassignment when required.

The IndexedDB diff should therefore write the Instance header and root metadata in one database transaction. Credits cannot appear until that write has completed successfully.

## 5. Durable Transition Coordinator

Add a narrow `MercuryCinemaClosureWorkflow` rather than spreading persistence timing across button handlers.

Proposed file:

`app/use-cases/cinema-closure-workflow.js`

Responsibilities:

- serialize one closure transition at a time;
- expose idle/persisting/failed state for deterministic UI;
- invoke the existing Store operations;
- await `store.flush()` before reporting durable success;
- reject duplicate activation while an operation is running;
- preserve typed storage failures;
- never call AITransport or CinemaGenerationWorkflow generation methods;
- never own narrative state.

Expected operations:

```text
pause(instanceId)
beginEnding(instanceId)
abandonPendingAndBeginEnding(instanceId, requestId)
finishEnding(instanceId)
```

The controller remains responsible for requiring explicit generation cancellation before an ending operation. The closure workflow must not silently cancel generation.

Persistence failure behavior:

- Do not navigate to a success screen.
- Do not display Credits before durable `ended` persistence.
- Surface the existing Cinema storage-failure experience with operation-specific copy.
- Do not attempt an automatic retry or rollback that could conceal uncertainty.
- Reload must recover from the last durable repository state.

## 6. Derived Presentation Models

### 6.1 Intermission projection

Add:

`app/core/cinema-intermission-projection.js`

It returns only presentation data derived from the focused Instance:

- title and stable identity;
- reliable current position when `structureProvenance.scenes === "runtime"`;
- a recap only when `notes.summary.text` is non-empty and `coveredThroughOrdinal >= lastCompletedAssistantOrdinal`;
- neutral fallback copy otherwise;
- pending and lifecycle flags needed to choose legal actions.

It must not calculate elapsed minutes, invent Act completion, infer a next Act, summarize prose, or mutate state.

### 6.2 Complete Performance document

Add:

`app/core/cinema-performance-document-projection.js`

It must return a complete, ordered, viewport-independent document:

```text
identity/front matter
conditional reliable structure and contents
all canonical Segments in stored ordinal order
segment role/provenance
evidence-based notes available for read-only presentation
conditional verified statistics
colophon metadata
closure provenance required for faithful archival explanation
```

Rules:

- It consumes canonical Store data, never rendered DOM.
- It never drops prose because a section is not currently visible.
- Assistant narrative and User Segments remain distinct in data.
- Player display identity is included only when it is explicit and more specific than the default `你` fallback.
- Word count and dates may be shown.
- Act/Scene counts and contents require reliable structure provenance.
- Elapsed minutes are removed.
- Future TXT/HTML/JSON exporters must consume this projection or a lower canonical document source, never query UI elements.

### 6.3 Programme archive projection

Extend `app/core/cinema-programme-projection.js` rather than creating a second grouping authority.

- Reuse stable `Character identity x World/Stage identity` grouping.
- Sort groups by latest ended activity.
- Sort ended Performances within a group by `endedAt` descending.
- Preserve historical Character and World snapshot labels when current source assets are absent or changed.
- Provide a complete archive index, not only the two-item Hub preview.

## 7. Navigation Changes

- Keep `programme` as the user-level root.
- Add a Programme-owned archive child route, provisionally `programme-archive`.
- Change the Hub's `查看全部往期` action to the Programme archive child.
- Keep direct ended rows opening `history/{instanceId}` behavior.
- Convert legacy `past` launch/navigation requests into a compatibility redirect to `programme-archive`.
- Remove the old `#renderPast()` page from reachable product navigation only after route compatibility is covered.
- History back returns to the Programme archive context when entered from there, otherwise Programme.
- Reading's existing Programme safe exit remains lifecycle-neutral and continues to preserve pending identity.

## 8. Visual Delivery Gates

No production screen is implemented before its visual result is approved.

### Gate A: Intermission

1. Use ImageGen for one `390x844` art-direction reference.
2. Reference state contains reliable current position and a coverage-valid short recap.
3. Default is no Scene/Act image.
4. Build an isolated deterministic prototype after reference approval.
5. Validate at `390x844`, `360x780`, and `430x932`.
6. Capture reliable recap, neutral fallback, pending-safe actions, reduced motion, overlay/comparison, and interaction evidence.
7. After visual approval, integrate production Intermission only.
8. Run focused and full regression before Gate B.

Intermission composition:

- `中场休息 / INTERMISSION`;
- black curtain field;
- narrow warm-ivory center seam;
- restrained oxblood lining;
- floor/threshold cue;
- reliable position or neutral pause line;
- one short recap at most;
- Continue, read-only Notes, Programme;
- no cards, stats, next Act, image requirement, red glow, or generated text raster.

### Gate B: Credits lifecycle

1. Generate one `390x844` static curtain-call Credits reference after Intermission production PASS.
2. Ending confirmation is a deterministic overlay/state in the same system, not a separate visual direction.
3. Build and approve an isolated Credits lifecycle prototype.
4. Integrate confirmation, curtain persistence states, and Credits only after approval.
5. Verify normal ending, pending-abandon ending, reload from `ending`, persistence failure, reduced motion, and repeated actions.

Credits content:

- `THE END / 谢幕`;
- Performance title;
- Character;
- explicit Player identity only when reliable;
- World;
- opening and ending dates;
- body word count;
- Act/Scene counts only when reliable;
- `这一场演出，至此落幕。`;
- `阅读完整节目册` and `返回节目单` only.

Credits remain static and user-controlled. They do not roll, auto-dismiss, start a new Performance, or depend on imagery.

### Gate C: Programme History

#### C1: History Detail

1. Generate one `390x844` History reference after Credits production PASS.
2. Use one continuous material transition:

```text
warm-ivory Programme Cover
-> near-black complete work
-> warm-ivory Colophon
```

3. Build and approve the isolated History Detail prototype.
4. Verify reliable and compatibility-unknown structure variants.
5. Integrate the complete read-only History reader.

History rendering:

- cover and front matter;
- contents anchors only when structure is reliable;
- all prose in canonical ordinal order;
- assistant narrative as primary reading text;
- User Segments distinguished by restrained indentation, a thin rule, or narrower measure;
- no avatars, bubbles, `YOU:` labels, rewriting, tabs, pagination, or required load-more action;
- `content-visibility` or equivalent rendering optimization may be used without removing content from the document projection.

#### C2: Programme Archive Index

This remains inside the Programme History phase but is a distinct new UI and therefore receives its own ImageGen reference before production integration.

- warm-ivory Programme editorial family;
- Character x World jump index at the top;
- complete vertical grouped index below;
- every ended Performance present in DOM;
- ended order descending;
- no cards, filters, search, folding, or independent top-level Archive destination.

## 9. Raster and Multimodal Boundaries

ImageGen output is never shipped as a full-screen UI.

Deterministic production requirements:

- text and dynamic values;
- buttons and hit regions;
- curtain and paper structure;
- rules, registration marks, light seam, layout, and state indicators;
- contents and archive indexes;
- focus, disabled, busy, error, and reduced-motion states.

Bounded optional raster use:

- curtain microtexture;
- paper fiber;
- very light floor/environment texture.

Explicitly out of scope:

- in-app AI image generation;
- automatic Scene or Act illustrations;
- AI vision or Character image understanding;
- image-derived continuity or World facts;
- mandatory visual uploads;
- new provider, cost, asset-management, or multimodal prompt systems.

## 10. Expected File Changes

### Add

- `app/core/cinema-intermission-projection.js`
- `app/core/cinema-performance-document-projection.js`
- `app/use-cases/cinema-closure-workflow.js`
- focused unit tests for each new module
- browser harnesses for Intermission, Credits lifecycle, History, and Programme Archive Index
- one isolated prototype directory per approved visual Gate

### Modify narrowly

- `app/core/cinema-contracts.js`
  - schema version;
  - `closureRecord` normalization;
  - `structureProvenance` normalization and migration;
  - new-Instance provenance.
- `app/system/cinema-store.js`
  - pending-aware `beginEnding`;
  - atomic `abandonPendingAndBeginEnding`;
  - atomic `finish` including focus reassignment.
- `app/core/cinema-programme-projection.js`
  - complete grouped ended index.
- `app/apps/cinema-app.js`
  - consume projections/workflow;
  - replace each screen only after its Gate;
  - durable transition UI;
  - compatibility routing.
- `app/styles/cinema-app.css`
  - replace only selectors belonging to the currently approved screen;
  - remove obsolete selectors only after renderer reachability checks.
- `app/main.js`
  - load new projection/workflow scripts before `apps/cinema-app.js`.

### Expected no production change

- `app/use-cases/cinema-generation-workflow.js`
- `app/use-cases/cinema-context-compiler.js`
- AITransport/provider files
- Chat/Archive/WorldBook contracts
- Home, Reading, World Library, Cast, Adaptation, and Before the Curtain presentation
- image-generation or vision infrastructure

`app/system/cinema-repository.js` should require no schema-storage rewrite. Its existing diff and multi-store IndexedDB transaction should persist the new Instance header fields and atomic finish root/header change. Modify it only if focused tests reveal a real serialization or transaction defect.

## 11. Verification Matrix

### Contracts and migration

- valid and malformed `closureRecord`;
- valid two-value `structureProvenance`;
- new Instance marked runtime;
- fallback legacy structure marked compatibility-unknown;
- ambiguous legacy structure fails conservative;
- reload preserves both fields;
- no closure field enters generated prompt/context.

### Store and persistence

- normal ending rejects pending;
- abandon requires exact request ID and existing User Segment;
- abandon preserves prose and ordinal order;
- repeated abandon is idempotent;
- mismatched repeat fails closed;
- late assistant commit returns null;
- active in-flight cannot enter closure before explicit cancellation settles;
- atomic finish writes Instance and focus together;
- flush failure never reaches Credits;
- reload from durable `ending` can safely complete;
- reload after failed persistence reflects the last durable state;
- no automatic retry or resend.

### Projection

- recap appears only with complete coverage;
- stale, empty, or malformed coverage uses neutral copy;
- complete document contains every Segment exactly once in ordinal order;
- provenance roles remain intact;
- explicit Player identity is conditional;
- minutes never appear;
- unreliable structures expose no Act/Scene claims;
- Programme archive grouping and sorting are stable.

### Controller and interaction

- double taps and re-entry do not duplicate transitions;
- pending-abandon confirmation is distinct from ordinary ending;
- destructive copy is direct and comprehensible;
- Credits wait for durable `ended`;
- Credits actions route correctly and create no Draft;
- legacy `past` redirects to Programme archive;
- History back context is correct;
- all content is reachable by touch, keyboard, and screen-reader labels;
- Reading's existing safe Programme exit and pending behavior remain unchanged.

### Visual and long-horizon

- exact `390x844` acceptance screenshots;
- `360x780` and `430x932` stress screenshots;
- long titles, Character names, World names, recaps, and many archive groups;
- History with very long prose and many Scenes;
- compatibility-unknown History;
- reduced motion and reduced transparency;
- no overlap, clipped controls, dead hit regions, or accidental horizontal scroll;
- full test suite, production build, production audit, and asset/request budgets.

## 12. Delivery Order and Stop Rules

```text
1. Intermission ImageGen reference
2. User visual review
3. Intermission isolated prototype and evidence
4. User approval
5. Intermission production integration and regression
6. User PASS

7. Credits ImageGen reference
8. User visual review
9. Credits lifecycle isolated prototype and evidence
10. User approval
11. Credits production integration and regression
12. User PASS

13. History Detail ImageGen reference
14. User visual review
15. History Detail isolated prototype and evidence
16. User approval
17. History Detail production integration and regression

18. Programme Archive Index ImageGen reference
19. User visual review
20. Programme Archive Index isolated prototype and evidence
21. User approval
22. Programme Archive Index production integration
23. Full closure and vertical-slice regression
24. User PASS
```

Stop immediately when:

- a visual reference is not approved;
- deterministic implementation materially departs from the approved image;
- a required state cannot be represented without inventing narrative facts;
- persistence ordering cannot prove durable success;
- a change would require rewriting Phase 2D generation/pending architecture;
- a new multimodal, replay, annotation, export, or authoring subsystem becomes necessary.

The next authorized activity after this blueprint is approved is only the Intermission ImageGen reference. It does not authorize prototype or production implementation.
