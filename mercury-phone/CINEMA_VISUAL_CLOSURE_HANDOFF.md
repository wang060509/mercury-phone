# Cinema Visual Closure Handoff

## Audit status and scope

This is a read-only current-state audit of the Cinema visual replacement seam. Repository code is the source of truth. `CINEMA_CONSTRUCTION_BLUEPRINT.md` was checked against the controller, CSS, Catalog, Contracts, Store, Workflow, loader manifest, and current tests.

This document does not propose visual design, add an API, implement Visual Closure, or begin Phase 2E.

Current implementation shape:

- `app/apps/cinema-app.js` is one imperative DOM controller, not a component tree.
- `app/styles/cinema-app.css` is loaded by the Cinema manifest in `app/main.js:39-42`.
- Controller navigation is runtime-only. There are no Cinema URL routes.
- Catalog queries return clones. Store queries return clones.
- Home presentation is replaceable, but the inline Store and curtain delegates documented below are behavioral boundaries.

## Shared DOM helper conventions

The target blocks all use the same private helpers in `app/apps/cinema-app.js:132-219`:

- `#el(tag, className, text)` creates an element, assigns `className`, and writes `textContent`.
- `#button(label, className, onClick, iconName)` creates `button[type="button"]`; an optional icon is appended first, a label is wrapped in a plain `<span>`, and the click listener is attached directly.
- `#iconButton(...)` creates a `.cinema-icon-button` containing only an `img.cinema-icon` and sets `aria-label`.
- `#icon(...)` emits an empty-alt, `aria-hidden="true"` image under `assets/icons/iconoir/`.
- `#paper()` emits `section.cinema-paper`.
- `#ornament()` emits `span.cinema-ornament > i + img.cinema-icon + i`.
- `#pageHeader(...)` emits the shared three-column page header and routes its back button through `#go(...)`.

Shared CSS affecting all or several audited surfaces is in `app/styles/cinema-app.css:33-191`: `.cinema-host`, form-control inheritance and focus rules, button active/disabled rules, `.cinema-screen`, `.cinema-paper-screen`, `.cinema-paper`, `.cinema-structural`, `.cinema-display`, `.cinema-icon`, `.cinema-icon-button`, `.cinema-button` and its variants, `.cinema-link-button`, `.cinema-text-action`, `.cinema-programme__help`, `.cinema-ornament`, `.cinema-page-header`, and `.cinema-section-heading`.

## 1. `#renderLobby`

1. **Exact file/function**

   `app/apps/cinema-app.js:320-375`, `MercuryCinemaAppController.#renderLobby()`.

2. **DOM structure currently emitted**

   ```text
   section.cinema-screen.cinema-lobby
   ├─ section.cinema-lobby__theatre
   │  ├─ img.cinema-lobby__curtain.cinema-lobby__curtain--left
   │  ├─ img.cinema-lobby__curtain.cinema-lobby__curtain--right
   │  ├─ header.cinema-lobby__toolbar
   │  │  ├─ button.cinema-icon-button[aria-label="返回桌面"] > img.cinema-icon
   │  │  ├─ span
   │  │  └─ button.cinema-icon-button[aria-label="剧场说明"] > img.cinema-icon
   │  └─ div.cinema-lobby__marquee
   │     ├─ img.cinema-icon.cinema-lobby__spark
   │     ├─ p.cinema-structural
   │     ├─ h1.cinema-lobby__title
   │     ├─ when focused: p.cinema-structural.cinema-lobby__status
   │     ├─ when focused: button.cinema-button.cinema-button--ghost-light > span
   │     └─ when not focused: p.cinema-lobby__caption
   ├─ section.cinema-paper.cinema-programme
   │  ├─ header.cinema-programme__head
   │  │  ├─ p.cinema-structural
   │  │  ├─ time.cinema-programme__date
   │  │  └─ span.cinema-ornament
   │  ├─ when focused: article.cinema-current-ticket from #renderCurrentProgramme
   │  ├─ when other unfinished exist: section.cinema-programme__archive
   │  │  ├─ p.cinema-structural
   │  │  ├─ h2.cinema-display
   │  │  └─ one button.cinema-past-row per Instance from #unfinishedRow
   │  ├─ one article.cinema-stage-listing per Catalog Stage from #renderStageProgramme
   │  ├─ section.cinema-programme__archive
   │  │  ├─ p.cinema-structural
   │  │  ├─ h2.cinema-display
   │  │  ├─ zero to three button.cinema-past-row entries from #pastRow, or p.cinema-empty-copy
   │  │  └─ when past exists: button.cinema-text-action
   │  └─ button.cinema-programme__help
   └─ when tutorial is unseen or forced: section.cinema-modal-layer from #tutorialOverlay
   ```

   The programme order is fixed in code: head, focused ticket, other unfinished list, all current Catalog Stages, past archive, help. The tutorial overlay is appended last to the screen.

3. **CSS selectors/classes**

   Lobby-specific selectors are `app/styles/cinema-app.css:266-320`:

   - `.cinema-lobby`, `.cinema-lobby::-webkit-scrollbar`
   - `.cinema-lobby__theatre`
   - `.cinema-lobby__curtain`, `--left`, `--right`
   - `.cinema-lobby__toolbar`, `.cinema-lobby__toolbar .cinema-icon`
   - `.cinema-lobby__marquee`, `.cinema-lobby__spark`, `.cinema-lobby__title`, `.cinema-lobby__status`, `.cinema-lobby__caption`, `.cinema-lobby__marquee .cinema-button`
   - `.cinema-programme`, its `::before` and `::after`, `.cinema-programme__head`, `.cinema-programme__date`
   - `.cinema-current-ticket` selectors
   - `.cinema-stage-listing` selectors
   - `.cinema-programme__archive`, `.cinema-empty-copy`, `.cinema-programme__help`
   - Tutorial selectors `.cinema-modal-layer`, `.cinema-foldout`, `.cinema-foldout__intro`, `.cinema-foldout__term`

   Unfinished and past rows reuse archive selectors at `app/styles/cinema-app.css:549-554`: `.cinema-past-row` and `.cinema-past-row__copy` descendants. Shared selectors listed above also apply.

4. **Data/query source**

   At the start of every render it reads:

   - `this.store.snapshot()` for `tutorialSeen` and root metadata.
   - `this.store.focused()` for the one focused, non-ended Instance or `null`.
   - `this.store.listUnfinished()` for all `status !== "ended"` Instances, already sorted descending by `updatedAt`.
   - `this.catalog.listStages()` for current Stage definitions in registration order.
   - `this.store.listPast()` for ended Instances sorted descending by `endedAt`; Home slices the first three.
   - `new Date()` and `Intl.DateTimeFormat("zh-CN", ...)` for the programme date.
   - Runtime-only `this.forceTutorial` in addition to durable `state.tutorialSeen`.

   The focused Instance is removed from the separate unfinished rows by ID. If focus is `null`, every unfinished Instance remains in the unfinished section. The Stage list is independent of unfinished Instances and does not currently derive a per-Stage count.

5. **Event handlers**

   - Back toolbar button calls `this.context.services.requestHome?.()`.
   - Tutorial toolbar and help buttons call `#showTutorial(true)`, which sets runtime `forceTutorial` and rerenders.
   - Focused marquee button:
     - `intermission`: sets `curtainMode = "resume"`, then `#go("curtain")`.
     - every other non-ended status: `#go("reading")`.
   - Current ticket and unfinished rows delegate to `#continueInstance(instance)`.
   - Stage listing action delegates to `#go("stage", { stageId })`.
   - Past rows route to `history`; the archive action routes to `past`.
   - Tutorial acknowledgement calls `store.markTutorialSeen()`, clears `forceTutorial`, and rerenders.

6. **Store/Catalog calls**

   Direct read calls are `snapshot`, `focused`, `listUnfinished`, `listPast`, and `catalog.listStages`. Inline child blocks can subsequently call `focusInstance`; tutorial acknowledgement calls `markTutorialSeen`. No Stage click calls Store.

7. **Narrative/lifecycle mutations, if any**

   Rendering and browsing mutate no narrative or lifecycle state. Tutorial acknowledgement is a durable root metadata mutation only. Existing-Instance selection can mutate durable focus through `#continueInstance`; it does not itself change lifecycle or prose. The marquee's intermission path defers lifecycle mutation to the resume curtain.

8. **Whether presentation can be replaced wholesale**

   Yes, the Lobby DOM and layout can be replaced wholesale as presentation. The replacement must remain a read client of the same Catalog and Store state and must retain the action boundaries below. A per-Stage projection must not replace or discard the complete unfinished list, because a retained Instance may reference a Stage no longer present in the current Catalog.

9. **Behavior that MUST survive replacement**

   - Hydrated Store state remains the source of Home content.
   - Multiple unfinished Instances remain supported.
   - Focus and lifecycle remain separate.
   - Browsing a Stage remains non-narrative and does not create an Instance.
   - Existing-Instance selection still runs the focus and status policy in `#continueInstance`.
   - Intermission requires the explicit resume curtain before `resume(...)`.
   - Pending recovery is not auto-sent from Home.
   - Ended Instances stay read-only and separate from unfinished Instances.
   - Tutorial acknowledgement remains a metadata write if the tutorial remains reachable.
   - Unknown or removed Catalog Stages must not cause retained unfinished Instances to disappear.

10. **Tests currently protecting it**

   There is no direct DOM, ordering, label, selector, or click test for `#renderLobby`. Indirect protection is:

   - `app/tests/cinema-stage-catalog.test.js:10-30` protects generic Stage enumeration order and absence of Stage-ID renderer branching.
   - `app/tests/cinema-store.test.js:103-150` protects multiple unfinished Instances, focus/lifecycle separation, reload, and finish moving only the target to past.
   - `app/tests/cinema-app-readiness.test.js:85-125` protects the hydration/error gate before any Lobby or curtain state is rendered.
   - `app/tests/cinema-app-readiness.test.js:128-159` protects pending recovery after direct launch to Reading, not pending selection from Lobby.

   No current test protects the global `updatedAt` sort as a Home ordering contract, the three-item past slice, tutorial DOM, or any Lobby CSS selector.

## 2. `#renderCurrentProgramme`

1. **Exact file/function**

   `app/apps/cinema-app.js:377-384`, `MercuryCinemaAppController.#renderCurrentProgramme(instance)`.

2. **DOM structure currently emitted**

   ```text
   article.cinema-current-ticket
   ├─ p.cinema-structural                  "CURRENT PERFORMANCE"
   ├─ h2.cinema-display                    instance.title
   ├─ p                                    instance.programmeSubtitle
   └─ button.cinema-button.cinema-button--crimson
      └─ span                              status-dependent label
   ```

   The label is `从中场继续` only for `intermission`; it is `继续本场` for active, preparing, and ending.

3. **CSS selectors/classes**

   `.cinema-current-ticket` and its descendant selectors are at `app/styles/cinema-app.css:290-293`. Shared `.cinema-structural`, `.cinema-display`, `.cinema-button`, and `.cinema-button--crimson` rules also apply.

4. **Data/query source**

   No query is made inside the method. `#renderLobby` passes the clone returned by `store.focused()`.

5. **Event handlers**

   The sole button calls `#continueInstance(instance)`.

6. **Store/Catalog calls**

   None directly. `#continueInstance` calls `store.focusInstance(instance.id)`.

7. **Narrative/lifecycle mutations, if any**

   None in rendering. The click can change durable focus only when needed. Resume or finish remains deferred to a curtain path.

8. **Whether presentation can be replaced wholesale**

   Yes. This ticket is a pure presentation block around an Instance plus one continuation delegate.

9. **Behavior that MUST survive replacement**

   The action must use the same continuation policy, including the ending branch. It must not equate focus with resume, and it must not create, advance, or end an Instance directly.

10. **Tests currently protecting it**

   No direct test protects this function, DOM, labels, or click. `cinema-store.test.js:117-130` indirectly protects that focus preserves lifecycle and Scenes. `cinema-store.test.js:141-150` protects ending and finish behavior after the handler has routed into that flow.

## 3. `#unfinishedRow`

1. **Exact file/function**

   `app/apps/cinema-app.js:393-401`, `MercuryCinemaAppController.#unfinishedRow(instance)`.

2. **DOM structure currently emitted**

   ```text
   button.cinema-past-row[type="button"]
   ├─ span.cinema-past-row__copy
   │  ├─ small.cinema-structural           status + ACT + SCENE
   │  ├─ strong                            instance.title
   │  └─ span                              instance.programmeSubtitle
   └─ img.cinema-icon                      nav-arrow-right
   ```

   Current Scene resolution is `scenes.find(id === currentSceneId) || scenes.at(-1)`. The status label is `中场暂停` for intermission, `等待谢幕` for ending, and `演绎中` for every other unfinished status. `pendingContinuation` is not displayed.

3. **CSS selectors/classes**

   `.cinema-past-row`, `.cinema-past-row__copy`, and their descendant selectors are at `app/styles/cinema-app.css:549-554`. Shared `.cinema-structural` and `.cinema-icon` rules apply. There is no separate unfinished-row selector.

4. **Data/query source**

   No query is made inside the method. The input comes from `store.listUnfinished()` after `#renderLobby` removes the focused ID.

5. **Event handlers**

   The entire row button calls `#continueInstance(instance)`.

6. **Store/Catalog calls**

   None directly. The delegated handler calls `store.focusInstance(instance.id)`.

7. **Narrative/lifecycle mutations, if any**

   None in rendering. Selection can change durable focus. Status transitions occur only later in the resume or ending curtain.

8. **Whether presentation can be replaced wholesale**

   Yes. The row can be wholly replaced if it still delegates selection by exact Instance identity and does not collapse multiple Instances by Stage or Scenario.

9. **Behavior that MUST survive replacement**

   - Every non-focused unfinished Instance remains individually selectable.
   - Selection is by `instance.id`, not Stage or Scenario.
   - Scene display, if retained, resolves the Instance's current Scene and only then falls back to the last Scene.
   - Lifecycle routing remains status-based and pending state remains independent.
   - No focus click changes `updatedAt`, Scene, Segment, continuity, or lifecycle.

10. **Tests currently protecting it**

   No direct DOM/status-label/click test exists. `cinema-store.test.js:103-150` protects coexistence, focus isolation, intermission persistence, and ending removal from unfinished. There is no test for the row's current-Scene fallback or its reuse of archive CSS.

## 4. `#renderStageProgramme`

1. **Exact file/function**

   `app/apps/cinema-app.js:403-414`, `MercuryCinemaAppController.#renderStageProgramme(stage, index)`.

2. **DOM structure currently emitted**

   ```text
   article.cinema-stage-listing
   ├─ div.cinema-stage-listing__copy
   │  ├─ p.cinema-structural.cinema-stage-listing__number   "STAGE NN"
   │  ├─ h2.cinema-display                                  stage.title
   │  ├─ optional p.cinema-stage-listing__latin             stage.latinTitle
   │  ├─ optional p.cinema-stage-listing__summary           stage.tagline
   │  └─ p.cinema-stage-listing__roles
   │     ├─ b                                                "YOU"
   │     ├─ Text                                             presentation copy or fallback
   │     ├─ b                                                "CHAR"
   │     └─ Text                                             " 世界变体"
   └─ button.cinema-icon-button.cinema-stage-listing__action
      └─ img.cinema-icon                                    nav-arrow-right
   ```

   Numbering uses the `catalog.listStages()` enumeration index plus one, not `stage.order`.

3. **CSS selectors/classes**

   `.cinema-stage-listing` and all `__copy`, `__number`, `__latin`, `__summary`, `__roles`, and `__action` selectors are at `app/styles/cinema-app.css:295-303`. Shared structural, display, icon-button, and icon rules apply.

4. **Data/query source**

   No query occurs inside the method. `#renderLobby` passes each clone from `catalog.listStages()` and its enumeration index. Visible role copy reads `stage.presentation.programmeRoleCopy || "自定义身份"`.

5. **Event handlers**

   The arrow button calls `#go("stage", { stageId: stage.id })`.

6. **Store/Catalog calls**

   None directly. The parent made the Catalog query. No Store call occurs on Stage listing selection.

7. **Narrative/lifecycle mutations, if any**

   None. Selecting a Stage only changes controller-local route state.

8. **Whether presentation can be replaced wholesale**

   Yes. This is a replaceable Catalog presentation block.

9. **Behavior that MUST survive replacement**

   - Enumerate registered Stages generically and in Catalog registration order.
   - Use `stage.id` as navigation identity.
   - Do not branch on a specific Stage ID.
   - Do not infer a guaranteed artwork contract from `materials[0]` or `presentation`.
   - Do not create a draft or Instance from the Home Stage browse action.

10. **Tests currently protecting it**

   `app/tests/cinema-stage-catalog.test.js:10-30` protects registration order, unknown-ID behavior, a neutral Stage without material/specializations, and absence of `stageId === ...` renderer branching. It does not instantiate this DOM block or click its button. No CSS selector test exists.

## 5. `#continueInstance`

1. **Exact file/function**

   `app/apps/cinema-app.js:386-391`, `MercuryCinemaAppController.#continueInstance(instance)`.

2. **DOM structure currently emitted**

   None. This is an inline UI-to-domain action policy invoked by the current ticket and unfinished rows.

3. **CSS selectors/classes**

   None directly. Its callers are styled by `.cinema-current-ticket` or `.cinema-past-row`; its destination surfaces use reading or curtain selectors.

4. **Data/query source**

   It consumes the passed Instance clone's `id` and `status`. Routing is based on that passed `instance.status`, not on the clone returned by `focusInstance(...)`.

5. **Event handlers**

   This function is itself the click delegate. Exact policy:

   ```text
   store.focusInstance(instance.id)
   ├─ falsy -> stop, no route change
   ├─ passed status is intermission -> curtainMode="resume"; #go("curtain")
   ├─ passed status is ending       -> curtainMode="ending"; #go("curtain")
   └─ every other status            -> #go("reading")
   ```

6. **Store/Catalog calls**

   Calls `store.focusInstance(instance.id)` exactly once. No Catalog call.

7. **Narrative/lifecycle mutations, if any**

   `focusInstance` changes only durable root `focusedInstanceId` when the target differs. It rejects missing or ended targets. It does not update the Instance's `updatedAt`, status, Scenes, Segments, notes, or pending identity. This handler itself never calls `resume`, `beginEnding`, or `finish`.

8. **Whether presentation can be replaced wholesale**

   Not as disposable presentation. It contains the current focus and status-routing policy. A replacement may relocate this policy but must preserve its separation of focus from lifecycle and its curtain delegation.

9. **Behavior that MUST survive replacement**

   - Focus exact Instance ID first and stop if focus is rejected.
   - Active and other non-intermission/non-ending unfinished statuses go to Reading.
   - Intermission goes to a resume curtain without an immediate resume mutation.
   - Ending goes to the ending curtain.
   - `pendingContinuation` does not substitute for lifecycle and does not trigger an automatic request.
   - Ended Instances are not focusable through this path.

10. **Tests currently protecting it**

   No direct controller test invokes this private function. `app/tests/cinema-store.test.js:117-130` protects focus without resume or Scene change. `app/tests/cinema-store.test.js:84-94` protects explicit pause/resume without Scene progression. `app/tests/cinema-store.test.js:141-150` protects ending and finish isolation. The exact branch mapping is not directly tested.

   `app/tests/cinema-long-horizon.test.js:65-73`, through its harness lifecycle exercise at `app/tests/fixtures/cinema-long-horizon-harness.js:422-441`, additionally protects focus switching, pause/resume, reload, Instance isolation, and pending-profile recovery over a long-running two-Instance workload. It still does not exercise the controller branch itself.

## 6. `#renderStage`

1. **Exact file/function**

   - Model helper: `app/apps/cinema-app.js:14-27`, `buildStageDetailModel(catalog, stageId, scenarioId)`.
   - Renderer: `app/apps/cinema-app.js:448-495`, `MercuryCinemaAppController.#renderStage()`.

2. **DOM structure currently emitted**

   ```text
   section.cinema-screen.cinema-paper-screen
   ├─ header.cinema-page-header
   │  ├─ button.cinema-icon-button > img.cinema-icon
   │  ├─ h1.cinema-page-header__title                      "舞台说明"
   │  └─ span.cinema-page-header__spacer
   └─ section.cinema-paper
      └─ article.cinema-stage-detail
         ├─ p.cinema-structural                            model.structuralLabel
         ├─ h1.cinema-stage-detail__title                  stage.title
         ├─ optional p.cinema-stage-detail__latin          stage.latinTitle
         ├─ span.cinema-ornament
         ├─ when first material has asset: button.cinema-stage-map
         │  ├─ img
         │  └─ span.cinema-stage-map__caption
         │     ├─ strong                                   material.title
         │     └─ small                                    material.caption or fallback
         ├─ section.cinema-editorial-copy
         │  ├─ optional p.cinema-dropcap                   stage.premise
         │  └─ optional p                                  stage.summary
         ├─ dl.cinema-fact-list
         │  └─ repeated dt.cinema-structural + dd
         ├─ when stage.specializations is nonempty: section.cinema-stage-fields
         │  ├─ header.cinema-section-heading
         │  └─ repeated div.cinema-stage-field-row
         │     ├─ span.cinema-structural
         │     └─ span
         └─ button.cinema-button.cinema-button--crimson.cinema-sticky-action
            └─ span                                        "选择这一场"
   ```

   If Stage or Scenario lookup fails, the method instead returns `#redirectScreen("lobby")`, which emits the loading-state screen and schedules a zero-delay route to Lobby.

3. **CSS selectors/classes**

   - Shell and header: `app/styles/cinema-app.css:75-88`, `174-187`, and `323-324`.
   - Stage detail and material trigger: `app/styles/cinema-app.css:325-345`.
   - Shared section-heading rules: `app/styles/cinema-app.css:189-191`.
   - Shared button and sticky action rules: `app/styles/cinema-app.css:125-144` and `217-220`.
   - Redirect fallback uses `.cinema-loading-state` and `.cinema-loading-rule` at `app/styles/cinema-app.css:591-593`.

4. **Data/query source**

   `buildStageDetailModel` performs:

   - `catalog.getStage(routeData?.stageId)`.
   - `catalog.getScenario(stage.id, routeData?.scenarioId || stage.scenarios[0]?.id)`.
   - Structural label from `stage.presentation.structuralLabel`, falling back to padded `stage.order`.
   - Material from `stage.materials[0] || null`.
   - Facts from Scenario title, optional Scenario season, and `stage.presentation.facts`.
   - Displayed specialization rows from `stage.specializations` excluding `stage.defaultSpecialization`.

   Stage and Scenario are Catalog clones. No Instance is read.

5. **Event handlers**

   - Page-header back calls `#go("lobby")`.
   - Optional material button calls `#go("material", { stageId, materialId })`.
   - `选择这一场` calls `store.beginDraft(stage.id)`, then `#go("prep")`.

6. **Store/Catalog calls**

   Direct Catalog calls are `getStage` and `getScenario` through the model helper. The only Store call is `beginDraft(stage.id)` on explicit selection.

7. **Narrative/lifecycle mutations, if any**

   Browsing Stage Detail and material is non-narrative. `beginDraft` creates or replaces durable root `draft`, which is a preparation mutation, not an Instance or prose mutation. No Instance exists until the opening curtain later calls `store.openCurtain()`.

   Exact current Scenario caveat: the detail helper can display `routeData.scenarioId`, but `选择这一场` passes only `stage.id` to `beginDraft`. `createDraft` therefore selects the Stage's first Scenario. A non-default Scenario supplied only in route data is not forwarded into the draft.

8. **Whether presentation can be replaced wholesale**

   Yes for the browse/read DOM. The explicit selection action is coupled and must remain a Store draft delegate. The renderer cannot be replaced with an action that creates an Instance or assumes a material asset exists.

9. **Behavior that MUST survive replacement**

   - Unknown Stage or Scenario returns safely to Lobby.
   - Stage/Scenario come from Catalog, not from an existing Instance snapshot.
   - Optional material and specialization capabilities remain optional.
   - No Stage-ID-specific renderer branch is introduced.
   - Browsing remains mutation-free.
   - Explicit selection begins a draft; only the later opening curtain creates the Instance.
   - There is no current user-visible Scenario selector. Presentation-only replacement must not claim one exists.

10. **Tests currently protecting it**

   - `app/tests/cinema-stage-catalog.test.js:17-30` directly tests `buildStageDetailModel` with a neutral Stage, no material, no specializations, and no Stage-ID renderer branch.
   - `app/tests/cinema-contracts.test.js:20-27` protects the production Catalog seed and unknown Stage behavior.
   - `app/tests/cinema-contracts.test.js:74-83` protects later Instance creation as active with snapshots and opening prose.
   - `app/tests/cinema-store.test.js:173-190` protects the same draft/open lifecycle for a neutral Stage.

   No current test builds `#renderStage` DOM, clicks its material/back/select controls, or checks that route Scenario is dropped by `beginDraft(stage.id)`.

## 7. `#go` and route state

1. **Exact file/function**

   - Constructor state: `app/apps/cinema-app.js:42-50`.
   - Initialization and resume: `app/apps/cinema-app.js:52-106`.
   - Launch-payload mapping: `app/apps/cinema-app.js:124-130`.
   - `#go`: `app/apps/cinema-app.js:221-227`.
   - `#renderRoute`: `app/apps/cinema-app.js:229-252`.
   - Redirect guard: `app/apps/cinema-app.js:1009-1015`.

2. **DOM structure currently emitted**

   `#go` itself emits no DOM. It synchronously calls `#renderRoute`, which invokes one route renderer and then executes:

   ```text
   root.replaceChildren(screen)
   ```

   `#redirectScreen(route)` temporarily emits:

   ```text
   section.cinema-screen.cinema-loading-state
   ├─ span.cinema-loading-rule
   └─ p.cinema-structural                  "RELOADING PROGRAMME"
   ```

   It schedules `#go(route)` at delay zero.

3. **CSS selectors/classes**

   `#go` has no selector. Every destination uses `.cinema-screen`. Redirects use `.cinema-loading-state` and `.cinema-loading-rule` at `app/styles/cinema-app.css:591-593`; reduced motion disables the loading animation at `595-601`.

4. **Data/query source**

   Runtime fields are:

   - `route`, initialized to `"lobby"`.
   - `routeData`, initialized to `null`.
   - `menuOpen`, initialized to `false`.
   - `curtainMode`, initialized to `"entry"`.
   - `timers`, a runtime `Set`.

   After Store hydration, no launch route means `entrance` when `hasEntered` is false and `lobby` when true. Supported launch payloads are only `past`, `history/<instanceId>`, and `active` when `store.focused()` exists. Unknown payload routes leave the constructor's current route in place, normally Lobby.

5. **Event handlers**

   All controller navigation actions call `#go(route, data)`. It first clears registered timers, replaces `route` and `routeData`, sets `menuOpen = false`, and rerenders synchronously.

6. **Store/Catalog calls**

   `#go` and `#renderRoute` make no Store/Catalog call themselves. Destination renderers do. Initialization reads `store.snapshot().hasEntered`; launch route `active` checks `store.focused()`.

7. **Narrative/lifecycle mutations, if any**

   None. Route, route data, menu state, timers, and curtain mode are runtime-only. They are not persisted and are not narrative history.

8. **Whether presentation can be replaced wholesale**

   Destination DOM can be replaced, but `#go` is controller behavior rather than presentation. A Home-only presentation pass should not turn route state into persisted domain state or reinterpret route changes as lifecycle transitions.

9. **Behavior that MUST survive replacement**

   - Navigation remains non-narrative.
   - Route data is replaced, not merged, on every `#go`; omitted data becomes `null`.
   - `#go` closes the reading menu and clears registered timers.
   - Route rendering replaces the root's entire child list.
   - Unknown route keys render the Lobby renderer through `(routes[this.route] || routes.lobby)`, although the unknown string itself is not rewritten.
   - Timer cleanup remains active on `#go`, `onPause`, and `onUnmount`.
   - Readiness and persistence failure gates remain ahead of ordinary route rendering.

   Current route matrix:

   | Route | Renderer | Route data currently read |
   |---|---|---|
   | `entrance` | `#renderCurtain("entry")` | none |
   | `lobby` | `#renderLobby()` | none |
   | `stage` | `#renderStage()` | `stageId`, optional `scenarioId` |
   | `prep` | `#renderPreparation()` | none; reads durable draft |
   | `variant` | `#renderVariant()` | none; reads durable draft |
   | `profile` | `#renderProfilePicker()` | none; reads durable draft |
   | `confirm` | `#renderProgrammeConfirmation()` | optional `error` |
   | `curtain` | `#renderCurtain(curtainMode)` | none |
   | `reading` | `#renderReading()` | none; reads focused Instance |
   | `intermission` | `#renderIntermission()` | none; reads focused Instance |
   | `ending` | `#renderEndingConfirmation()` | none; reads focused Instance |
   | `credits` | `#renderCredits()` | optional `instanceId` |
   | `past` | `#renderPast()` | none |
   | `history` | `#renderHistory()` | `instanceId` |
   | `settings` | `#renderReadingSettings()` | none |
   | `notes` | `#renderNotes()` | none |
   | `material` | `#renderMaterial()` | `stageId`, `materialId` |

   Exact current back-navigation caveat: `#pageHeader` passes only a route string. For example, the material viewer's back action calls `#go("stage")` without restoring `stageId`, so `#renderStage` fails lookup and redirects to Lobby. This is current controller behavior, not a persisted domain invariant.

10. **Tests currently protecting it**

   `app/tests/cinema-app-readiness.test.js:85-125` protects readiness routing to the entry curtain and explicit persistence failure. Lines `128-159` protect launch payload `route: "active"` reaching pending recovery. There is no direct test of `#go`, route-data replacement, the route table, timer clearing, unknown-route fallback, or back-navigation data loss.

## 8. Curtain lifecycle and entry points

1. **Exact file/function**

   - `app/apps/cinema-app.js:254-294`, `#renderCurtain(mode)`.
   - `app/apps/cinema-app.js:296-318`, `#openCurtain(screen, mode, skip)`.
   - Related state and timer cleanup: `app/apps/cinema-app.js:48-49`, `98-105`, `221-227`, `1022-1025`.

2. **DOM structure currently emitted**

   ```text
   section.cinema-screen.cinema-curtain.cinema-curtain--{mode}
   ├─ div.cinema-curtain__field
   │  └─ div.cinema-curtain__content
   │     ├─ p.cinema-structural.cinema-curtain__brand
   │     ├─ span.cinema-ornament
   │     ├─ h1.cinema-curtain__title
   │     ├─ p.cinema-curtain__cn
   │     ├─ p.cinema-curtain__line
   │     ├─ entry/opening/resume only: button.cinema-button.cinema-button--light
   │     └─ entry only: button.cinema-link-button.cinema-curtain__skip
   ├─ img.cinema-curtain__panel.cinema-curtain__panel--left
   └─ img.cinema-curtain__panel.cinema-curtain__panel--right
   ```

   Modes and copy are runtime literals: `entry`, `opening`, `resume`, and `ending`. Ending has no action button.

3. **CSS selectors/classes**

   Curtain selectors are `app/styles/cinema-app.css:222-264`:

   - `.cinema-curtain`
   - `.cinema-curtain__field`
   - `.cinema-curtain__panel`, `--left`, `--right`
   - `.cinema-curtain.is-opening ...`
   - `.cinema-curtain__content`
   - `.cinema-curtain--ending ...`
   - `.cinema-curtain--ending.is-closing ...`
   - `.cinema-curtain__brand`, `__title`, `__cn`, `__line`, `__skip`

   Shared button, ornament, structural, and icon rules also apply. `app/styles/cinema-app.css:595-601` disables curtain transitions/animations under reduced motion. The JS delay independently checks `prefers-reduced-motion`.

4. **Data/query source**

   Reads runtime `curtainMode`, the passed mode, `matchMedia("(prefers-reduced-motion: reduce)")`, `store.focused()` for resume/ending, and runtime `creditsInstanceId`. Opening reads the durable draft indirectly through `store.openCurtain()`.

5. **Event handlers**

   - Entry action and skip call `#openCurtain(screen, "entry", skip)`.
   - Opening action calls `#openCurtain(screen, "opening")`.
   - Resume action calls `#openCurtain(screen, "resume")`.
   - `#openCurtain` adds `.is-opening`, optionally `.is-skip`, then waits 40 ms when skipped or reduced-motion, otherwise 1050 ms.
   - Ending mounts an automatic 120 ms timer, adds `.is-closing`, finishes the focused Instance, then waits 1050 ms and routes to Credits.

   Current curtain entry points:

   | Mode | Entry point(s) |
   |---|---|
   | `entry` | Initialization selects route `entrance` when hydrated `hasEntered` is false. `#renderRoute` calls `#renderCurtain("entry")`. |
   | `opening` | `#renderProgrammeConfirmation` sets `curtainMode = "opening"` and calls `#go("curtain")`. |
   | `resume` | Focused Lobby marquee for intermission; `#continueInstance` for an intermission Instance; and the Intermission screen's continue action all set `curtainMode = "resume"` and route to `curtain`. |
   | `ending` | `#renderEndingConfirmation` first calls `store.beginEnding(instance.id)`, then sets the mode and routes; `#continueInstance` routes an already-ending Instance directly; `#renderReading` redirects a focused ending Instance after setting the mode. |

   The decorative curtains in `#renderLobby` and `#renderIntermission` are images only and are not lifecycle entry points.

6. **Store/Catalog calls**

   - Entry completion: `store.markEntered()`.
   - Opening completion: `store.openCurtain()`.
   - Resume completion: `store.focused()`, then `store.resume(active.id)` if present.
   - Ending timer: `store.focused()`, records `creditsInstanceId`, then `store.finish(active.id)` if present.
   - No Catalog call is made directly by curtain code.

7. **Narrative/lifecycle mutations, if any**

   - Entry: durable metadata only.
   - Opening: the explicit narrative start boundary. It validates the draft, creates and focuses one active Instance, creates the initial Scene and opening assistant Segment, snapshots Stage/Scenario/character/profile data, initializes notes, and clears the draft.
   - Resume: lifecycle-only `intermission -> active` plus `updatedAt`; no Scene, Segment, or continuity mutation.
   - Ending: lifecycle closure `ending -> ended`, sets `endedAt` and `updatedAt`, and may select another unfinished focus; it adds no prose or Scene.
   - Animation classes themselves are not narrative state.

8. **Whether presentation can be replaced wholesale**

   Curtain visuals can be replaced. Curtain callbacks cannot be discarded or reimplemented as direct object mutation. Opening, resume, and ending remain explicit lifecycle boundaries delegated to Store.

9. **Behavior that MUST survive replacement**

   - Entry acknowledgement occurs only after explicit curtain action.
   - Opening creates an Instance only through `store.openCurtain()` and reports validation failure back to Confirmation.
   - Resume targets the focused intermission Instance and does not advance narrative structure.
   - Ending acts on an already-ending focused Instance, calls `finish`, records the exact credits target, then navigates to Credits.
   - Pending continuation identity is not cleared by resume or finish.
   - Timers are registered and cancelable; `#go`, pause, and unmount clear them.
   - A canceled opening/resume timer performs no Store mutation. Rerendering the curtain requires the action again.

10. **Tests currently protecting it**

   - `app/tests/cinema-app-readiness.test.js:85-113` proves the entry curtain appears only after hydration, but does not click it.
   - `app/tests/cinema-contracts.test.js:74-83` protects the Instance, snapshot, Scene, and opening Segment produced by opening.
   - `app/tests/cinema-store.test.js:84-94` and `103-139` protect resume without Scene progression and pending preservation across pause/resume/reload.
   - `app/tests/cinema-store.test.js:141-150` protects begin-ending/finish isolation and movement to past.
   - `app/tests/cinema-long-horizon.test.js:65-73`, backed by `app/tests/fixtures/cinema-long-horizon-harness.js:422-441`, protects lifecycle/focus/reload narrative stability and original pending-profile recovery under long-running interleaved Instances.

   No direct test protects curtain DOM, mode copy, class transitions, delays, reduced-motion timing, callback routing, error return to Confirmation, timer cancellation, or automatic Credits navigation.

## Exact per-Stage Home derivation without persisted aggregates

Use only current read APIs inside the presentation render. Do not write the result to Store, draft, Catalog, Repository, or Instance fields.

```js
const stages = this.catalog.listStages();
const unfinished = this.store.listUnfinished();
const focused = this.store.focused();

const stagePresentationState = stages.map((stage) => {
  const stageUnfinished = unfinished.filter((instance) => instance.stageId === stage.id);
  const unfinishedCount = stageUnfinished.length;

  return {
    stage,
    stageUnfinished,
    unfinishedCount,
    unfinishedCardinality: unfinishedCount === 0 ? "0" : unfinishedCount === 1 ? "1" : "N",
    mostRecentlyMutatedUnfinishedInstance: stageUnfinished[0] || null,
    focusedInstance: focused?.stageId === stage.id ? focused : null,
  };
});
```

Why this is exact:

- `catalog.listStages()` returns every current Stage clone in registration order (`app/core/cinema-stage-catalog.js:60-79`).
- `store.listUnfinished()` includes `preparing`, `active`, `intermission`, and `ending` because it filters only `status !== "ended"` (`app/system/cinema-store.js:92-94`).
- `listUnfinished()` sorts descending by ISO `updatedAt`, so filtering it without re-sorting preserves the first per-Stage item as the most recently Store-mutated unfinished Instance.
- `focusInstance(...)` does not update the Instance's `updatedAt` (`app/system/cinema-store.js:96-103`). Therefore most recently mutated and focused are intentionally separate facts.
- `store.focused()` returns only the durable focus target when that Instance is non-ended (`app/system/cinema-store.js:76-79`). Comparing `focused.stageId` to `stage.id` yields the Stage-local focus or `null`.
- No Stage or Scenario uniqueness constraint exists. `stageUnfinished` may contain any count.
- `pendingContinuation` is orthogonal to all four derivations and must not affect count, cardinality, recency, or focus.

Important completeness caveat: a retained unfinished Instance can reference a Stage ID no longer registered in the current Catalog. Such an Instance remains in `listUnfinished()` and current Lobby rows. A current-Stage projection must not become the only source used to surface unfinished Instances, or those retained Instances will be lost from Home presentation.

No persisted aggregate is needed or justified. The code above is a render-local projection over cloned query results, not a new API or domain object.

## Exact selection traces

### Selecting a Stage with no existing Instance

Current Stage selection does not inspect existing Instances at all, so the path is identical whether the Stage has zero, one, or many unfinished Instances.

```text
Lobby Stage action
-> #go("stage", { stageId })
-> #renderStage()
-> catalog.getStage(stageId)
-> catalog.getScenario(stageId, routeData.scenarioId || first Scenario ID)
-> no Store mutation

"选择这一场"
-> store.beginDraft(stage.id)
-> durable root draft is created/replaced using the Stage's first Scenario
-> #go("prep")
-> preparation / variant / profile / confirmation edits only the draft

"正式开场"
-> curtainMode = "opening"
-> #go("curtain")
-> explicit curtain action
-> store.openCurtain()
-> new active Instance + initial Scene + opening assistant Segment
-> new Instance is focused; draft becomes null
-> #go("reading")
```

Browsing or opening Stage Detail is non-narrative. Draft creation is durable preparation state. Instance creation occurs only at `openCurtain()`.

### Selecting an active Instance

From the current ticket or an unfinished row:

```text
#continueInstance(instance)
-> store.focusInstance(instance.id)
-> status is active
-> #go("reading")
-> #renderReading reads store.focused()
```

Only focus may change. Status, `updatedAt`, Scenes, Segments, notes, and pending identity are preserved. The focused marquee is already bound to `store.focused()`, so its non-intermission action skips `focusInstance` and routes directly to Reading.

### Selecting an intermission Instance

From the current ticket or an unfinished row:

```text
#continueInstance(instance)
-> store.focusInstance(instance.id)
-> status is intermission
-> curtainMode = "resume"
-> #go("curtain")
-> no resume yet

explicit curtain action
-> .is-opening
-> 40 ms if skipped/reduced-motion, otherwise 1050 ms
-> store.focused()
-> store.resume(focused.id)
-> status intermission -> active; updatedAt refreshed
-> #go("reading")
```

The focused Lobby marquee and the Intermission screen enter the same resume curtain without refocusing because the target is already focused. Resume adds no Scene or Segment and preserves `pendingContinuation`.

### Selecting an ending Instance, if reachable

It is reachable. `ending` is non-ended, so `listUnfinished()` includes it. A persisted ending Instance can appear after a full app remount/reload, and an ending non-focused Instance can appear in the other unfinished rows.

From the current ticket or an unfinished row:

```text
#continueInstance(instance)
-> store.focusInstance(instance.id)
-> status is ending
-> curtainMode = "ending"
-> #go("curtain")
-> ending curtain has no button
-> after 120 ms: add .is-closing
-> store.focused()
-> creditsInstanceId = focused.id
-> store.finish(focused.id)
-> ending -> ended; endedAt/updatedAt set
-> if it was focused, Store focuses the latest other unfinished Instance or null
-> after 1050 ms: #go("credits", { instanceId: creditsInstanceId })
```

If the ending Instance is the focused marquee target, its marquee button currently routes to Reading rather than directly to the curtain. `#renderReading` detects `status === "ending"`, sets `curtainMode = "ending"`, returns a redirect screen, and the zero-delay redirect enters the same ending curtain.

The ordinary path into ending is separate: Reading menu routes to `ending` without mutation; the confirmation button calls `store.beginEnding(instance.id)` before entering the ending curtain.

### Selecting an Instance with `pendingContinuation`

`pendingContinuation` does not participate in `#continueInstance` routing. Lifecycle status wins:

- Active plus pending: focus, then Reading.
- Intermission plus pending: focus, explicit resume curtain, then Reading. Resume preserves pending identity.
- Ending plus pending: focus, ending curtain, then finish. `finish` preserves the pending field on the now-ended Instance because it changes lifecycle fields only. Current Credits/History UI does not expose retry.

For the normal active pending case, `#renderReading` does the following:

```text
instance.pendingContinuation is non-null
-> synthesize or reuse a recovery error
-> render "重试续写" when retryable
-> do not render form.cinema-composer
-> do not send any model request automatically

explicit "重试续写"
-> workflow.retry()
-> workflow.retryPending() uses store.focused()
-> original requestId, userSegmentId, user text, and profile identity are reused
```

If `lastError.code === "CINEMA_PENDING_CONTINUATION_INVALID"`, the UI uses that non-retryable error rather than synthesizing a retryable one. If malformed pending data normalized to `null`, the invalid error is shown but the composer condition is based on `!instance.pendingContinuation`, so the current controller can render a composer beside that non-retryable error. This is exact current behavior.

Protection for the pending path is split across:

- `app/tests/cinema-app-readiness.test.js:128-159`: reload shows explicit retry and suppresses composer for valid durable pending identity.
- `app/tests/cinema-generation-workflow.test.js:141-165`: failure retains the original user Segment and pending identity; retry does not duplicate prose; new input is rejected with `pending-exists`.
- `app/tests/cinema-generation-workflow.test.js:239-276`: invalid pending identity is not guessed, and cancel retains pending identity.
- `app/tests/cinema-store.test.js:109-139`: pause/resume/reload preserves pending identity and does not advance Scene.
- `app/tests/cinema-long-horizon.test.js:65-94`: interleaved Instance isolation, lifecycle narrative stability, pending durability, explicit recovery, cancellation recovery, and original-profile retry remain true through the long-horizon harness.

There is no current test for selecting a pending Instance from Lobby, or for finishing an ending Instance that still has pending identity.

## CSS replacement boundary index

This is the complete relevant selector grouping for the audited Home, Stage, routing fallback, and curtain surfaces. It is not a visual recommendation.

| Surface | Current selector groups in `app/styles/cinema-app.css` |
|---|---|
| Controller host and shared primitives | `33-191`: `.cinema-host`, focus/active/disabled rules, `.cinema-screen`, `.cinema-paper-screen`, `.cinema-paper`, typography classes, icon/button classes, ornament, page header, section heading |
| Sticky Stage selection action | `217-220`: `.cinema-sticky-action` |
| Lifecycle curtain | `222-264`: all `.cinema-curtain*` selectors and state-class selectors |
| Lobby theatre and programme | `266-309`: all `.cinema-lobby*`, `.cinema-programme*`, `.cinema-current-ticket*`, and `.cinema-stage-listing*` selectors |
| Lobby tutorial overlay | `311-320`: `.cinema-modal-layer`, `.cinema-foldout*` |
| Stage Detail | `322-345`: paper scrolling, `.cinema-stage-detail*`, `.cinema-stage-map*`, `.cinema-editorial-copy`, `.cinema-dropcap`, `.cinema-fact-list`, `.cinema-stage-fields`, `.cinema-stage-field-row` |
| Unfinished row reuse | `549-554`: `.cinema-past-row*` |
| Redirect/hydration presentation | `591-593`: `.cinema-loading-state`, `.cinema-loading-rule` |
| Reduced motion | `595-601`: includes curtain panels/content and loading rule |
| Reduced transparency affecting Lobby tutorial | `604-608`: `.cinema-modal-layer` background override |

There is no selector-level test for `cinema-app.css`. A presentation replacement can remove selectors that become unreachable only after confirming no remaining Cinema renderer emits them. Shared selectors cannot be treated as local to one block.

## Replacement seam summary

Presentation-only wholesale replacement is safe for:

- `#renderLobby` DOM and layout.
- `#renderCurrentProgramme` DOM.
- `#unfinishedRow` DOM.
- `#renderStageProgramme` DOM.
- `#renderStage` browse/read DOM, including optional material and field presentation.
- Curtain imagery, copy layout, and animation presentation, provided the existing action boundaries remain.

Behavioral code that must be preserved or explicitly re-delegated is:

- `#continueInstance` focus and lifecycle-routing policy.
- `#go` runtime-only navigation semantics and readiness separation.
- Stage selection's `store.beginDraft(...)` boundary.
- Curtain callbacks to `markEntered`, `openCurtain`, `resume`, and `finish`.
- Reading's explicit pending recovery and composer suppression.
- Full unfinished-Instance reachability independent of current Catalog membership.

No current component-level test suite guarantees a replacement of `cinema-app.js`. The replacement agent must preserve these delegates explicitly and should not infer safety from CSS or DOM test coverage.

## Verification performed

The following existing tests were run without modification and passed:

- `node app/tests/cinema-stage-catalog.test.js`
- `node app/tests/cinema-contracts.test.js`
- `node app/tests/cinema-store.test.js`
- `node app/tests/cinema-app-readiness.test.js`
- `node app/tests/cinema-long-horizon.test.js`

Final audit confirmation:

- runtime files changed: NONE
- test files changed: NONE
- Phase 2E NOT STARTED
- Visual Closure NOT IMPLEMENTED
