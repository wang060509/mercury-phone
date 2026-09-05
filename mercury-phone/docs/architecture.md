# Mercury OS Architecture

## Ownership

- `SystemShell` owns only the device frame, safe areas, status bar, Dynamic Island container, Home Bar, and the system-surface mount point.
- The future system state machine owns legal transitions between system states.
- `MercuryAppLoader` owns resource readiness, retry, and launch-intent ordering; `MercuryAppEngine` owns registered definitions, isolated instances, and lifecycle callbacks.
- Apps receive a context object and may not query or modify System Shell DOM.
- App controllers own DOM rendering and translate user gestures into product intents; they do not own cross-screen workflow invariants.
- `app/use-cases/` owns product workflow state, legal transitions, recoverable drafts, and transaction ordering between UI and stores.
- Domain contracts/runtimes own pure normalization and compilation rules; stores own persistence and migration; adapters own external failures.
- `MercuryConversationStore` owns conversation key compatibility, V1-to-V2 normalization, persistence failures, and non-destructive recovery; Chat UI consumes its snapshots instead of reading storage directly.
- `MercuryChatGenerationWorkflow` owns send/retry/regenerate admission, the single active request, request identity, cancellation, stale-response rejection, delivery transitions, assistant commit ordering, and version-preserving regeneration.
- `MercuryResourceIntakeWorkflow` owns resource preflight handoff, duplicate identity allocation, Archive/Profile/Chat commit ordering, and compensating rollback; Archive and Chat only adapt files and destinations.
- `MercuryConversationTransferContracts` owns portable/readable formats, preflight, stable transcript normalization, and file limits; `MercuryConversationTransferWorkflow` owns conflict-free timeline allocation, local resource reconciliation, and commit/rollback across Chat-private and shared-storage Adapters.
- `MercuryLocalDataVault` owns the complete Mercury data-source catalog, persistent/volatile health diagnosis, backup inclusion/redaction/exclusion policy, and versioned local backup assembly.
- Widgets register separately from apps and request placement through a future Widget Service.
- System gestures enter through one future Input Router and Gesture Manager.

## Dependency direction

```text
System UI -> System State -> System Services
                       \-> App Engine -> App Context -> App
                       \-> Widget Service -> Widget

App UI -> Use Case -> Domain Runtime / Store -> Adapter
```

Dependencies must never point from an App or Widget back into System UI.
Use cases may depend on domain contracts and stores, but must not create DOM or import presentation assets. App UI may consume use-case snapshots, but must not duplicate their legal transitions or persistence ordering.

The first implemented product workflow is `MercuryGenerationProfileFlow`. It owns the current Record Cabinet / Profile Detail transition, action-sheet and cover-preview overlay state, editable/read-only checks, cover confirmation, and draft preservation after storage failure. Pressing Room, Workbench, Playback, inheritance, and model parameters are deliberately absent from this state machine until their checkpoints are approved.

`MercuryChatGenerationWorkflow` is the second deep workflow Module. Its Interface is `start(command)`, `cancel()`, and `snapshot()`. The production host Adapter supplies current conversation/scope, durable commit, state notification, and post-commit effects; the production generation Adapter performs memory recall, runtime request assembly, and AITransport. In-memory Adapters test the same Interface. The Module has no DOM, provider configuration, storage key knowledge, or Mercury visual behavior.

`MercuryResourceIntakeWorkflow` is the shared import transaction Module. Its Interface is `inspect(input)` and `commit(stage, options)`. Resource Contracts identify and normalize JSON/PNG content without writing; the workflow then allocates non-conflicting Archive identities, builds the complete next state, and commits Archive, Generation Profile, and optional Chat contact bindings behind one Seam. If a later write fails, captured keys are restored in reverse order and the Profile Store is reloaded. `library` imports never create Chat state; `chat` imports require a valid role card. File pickers, review screens, navigation, assets, and user-facing copy remain in App Adapters.

This is a compensating transaction over browser storage, not a claim that separate `localStorage` keys are natively atomic. A rollback failure has its own error state and must be shown honestly. Global backup restore remains out of scope until it adds durable recovery/journal semantics appropriate to a much wider write set.

`MercuryConversationTransferWorkflow` is the conversation-portability Module. Its Interface is `export(input, format)`, `inspect(rawText)`, and `commit(stage, options)`. The pure Contracts Implementation distinguishes a versioned Mercury JSON resource from human-readable text, validates ConversationV2/session metadata before writes, rejects duplicate identities, bounds transfer size, and converts transient delivery states into stable transcript states. `commit` always allocates a new timeline and rebinds the transcript to an existing local contact. Timeline allocation treats either an existing Chat-private transcript or an existing shared session as occupied, so scene-only and settings-only conversations cannot be overwritten. Only locally available world books and Generation Profiles are restored; foreign role/world-variant IDs never become authority. Presentation state, drafts, secrets, relationship events, and derived indexes do not cross this Seam.

The production topology intentionally uses two Storage Adapters: conversation bodies remain in the Chat app namespace while session settings and resource bindings remain shared. The workflow captures and restores both sides as one compensating operation without collapsing their ownership. This Depth keeps storage namespaces, collision handling, resource degradation, and rollback Locality inside one Module; the Chat controller only adapts files, current-contact intent, navigation, and copy. On success, Chat owns a scoped presentation receipt for the imported timeline: it reports the independent conversation and message count, exposes missing local worlds/Profile fallback or role rebinding, and links to the existing resource screen. The receipt adds no new Store and does not change transfer authority.

`MercuryLocalDataVault` is the storage-governance Module. Its Interface is `snapshot()` and `createBackup()`. The production Storage Adapter is the System Services backend; tests use an in-memory Adapter. The internal catalog is the single source of truth for canonical/legacy user data, redacted connection preferences, device-only secrets, session credentials, derived IndexedDB indexes, browser-managed model caches, and unknown Mercury keys. Unknown keys are reported but never blindly exported; API keys and passcodes cannot cross the backup Seam. Settings receives only the two-method Interface. Global restore remains outside this Module until a separate validation, transaction, rollback, and reload contract exists.

## Direct-file runtime

The project uses ordered classic scripts so `index.html` can run under `file://` as well as a preview server. A bundler is not required for development; typography may still request the configured remote webfont when network access is available. AITransport deliberately refuses real chat under `file://` because it requires the same-origin relay.

## Release Module

- The public Interface is `npm run build:production`, `npm run audit:production`, and `npm run release:check`; callers do not reproduce copy, filtering, demo stripping, measurement, or budget logic.
- The Implementation lives in `tools/build-production.cjs` and `tools/audit-production.cjs`. It rebuilds only the `dist` sibling of `app`, keeping destructive filesystem work local to the Module.
- `release-budget.json` is the versioned policy Interface. Warning limits expose approaching debt; hard limits fail the release check.
- The Module excludes tests, `.local-demo`, internal notes, and the currently unreferenced LXGW/Noto source font directories from production without deleting them from `app/`. The audit fails if production code later references an excluded asset, keeping that decision local and reversible.
- The current Adapter for local demo presentation uses a generic `moments` slot; production Chat does not know the demo route name. This removes a demo-specific Seam from the production App while keeping the Adapter replaceable.
- Current evidence: 155 production files / 20.74 MiB; eager local entrypoint 62 requests / 981.1 KiB raw / 239.7 KiB gzip / 198.2 KiB Brotli. Archive is the first lazy App. Hard budgets pass; output-size and request-count warnings remain.

## System state

- `SystemStateMachine` is the only owner of the active system state.
- Views subscribe through `SystemStateController`; they do not infer state from DOM classes.
- Illegal events return a rejected transition and do not mutate history.
- System overlays remember their origin and return to it when closed.
- The current state graph is `booting -> locked -> unlocking -> home`, with
  branches for app, overlay, and app-switcher states reserved before those UIs exist.

## App Engine contract

- Apps register by stable `id`; registration does not freeze an app's internal features.
- An app may expose `render` directly or a `create()` factory for instance-local behavior.
- The render signature is `render(root, context, launchPayload)`.
- Lifecycle signatures are `onMount(context, payload)`, `onPause(context, payload)`, `onResume(context, payload)`, and `onUnmount(context, payload)`. Context is always the first argument and a launch/deep-route payload is always the second; App code must not reinterpret the context as a payload.

## App Loader contract

- Home and cross-App requests call one `MercuryAppLoader.launch(appId, payload)` boundary. Eager definitions activate immediately; lazy definitions prepare all declared resources before App Engine registration.
- Styles load before ordered classic scripts. Asset preparation is deduplicated per attempt, but each user launch keeps its own global intent ticket; a slow earlier load cannot steal focus from a newer launch.
- CSS, script, factory, or registration failures never activate the App. Failed DOM nodes and cached promises are cleared so a later icon click retries. Relative URLs and `script.async = false` preserve direct-file behavior and manifest order.
- App Loader does not own app instances or state-machine transitions. App Engine remains the lifecycle authority, and the shell activation Adapter remains the navigation authority.
- Every instance receives its own DOM root, mutable state bag, and immutable context shell.
- App failures are caught and rendered inside that app root; System Shell remains alive.
- The context already reserves widget definitions and registration, but placement UI is not implemented yet.

Adding group chat later is therefore an internal Mercury Chat version change, not a new system app registration.

## Internationalization

- User-facing strings are resolved through `MercuryI18n`, not embedded in system controllers.
- Locale dictionaries currently include `en-US` and `zh-CN`.
- `?lang=zh-CN` can be used during direct-file or preview-server testing.
- Typography tokens and layout remain independent from the language, so the current English prototype does not lock the final product language.

## System Services

- Every app receives an app-scoped service facade from `MercurySystemServices`.
- Storage keys are automatically namespaced by app id, so one app cannot read or clear another app's data.
- Notifications, theme changes, and Dynamic Island activities are requests emitted to the system owner; apps never modify System Shell DOM.
- The storage service uses `localStorage` when available and falls back to in-memory storage if a direct-file browser blocks it.
- App controllers do not own conversation key selection or migration. The app-scoped `storage` facade is injected into `MercuryConversationStore`, which preserves legacy keys, normalizes through `MercuryChatContracts`, keeps valid migrated data usable when write-back fails, and never overwrites a damaged source during automatic recovery.
- Widget placement and notification presentation remain deliberately outside this layer.

## Lock input

- `MercuryGestureManager` is the single pointer-swipe registration layer and rejects cross-axis drags.
- `MercuryLockController` owns optional four-digit passcode input and dispatches only legal state-machine events.
- Passcode protection is an immersive preference, not a security boundary.
- The normal default is passcode-off; `?passcode=2468` is a non-persistent development preview only.
- The future left/right recovery route remains reserved and is not implemented in this layer.

## Home Screen and widgets

- `MercuryHomeController` renders pages, widgets, app rows, Dock, and page indicators from an immutable layout model.
- The default layout is intentionally sparse: one primary presence widget, two supporting widgets, one short app row, and a three-item Dock.
- Horizontal paging uses the shared `MercuryGestureManager`; keyboard arrows provide desktop-preview parity.
- App icons request launch through the App Engine bridge and remain inert when the target app is not registered.
- `MercuryWidgetRegistry` gives each app a namespaced widget registration path while Home retains placement ownership.
- Widget editing UI is reserved for Settings > Home & Widgets; drag-and-drop is not implemented in this layer.

## System overlays

- Top-right downward gestures request Control Center; top-left and top-middle downward gestures request Notification Center.
- Both surfaces enter the state machine through `OPEN_OVERLAY` and return to their origin state through `CLOSE_OVERLAY`, including when opened from the lock screen.
- Brightness is a real prototype display effect, persisted locally and applied above the complete simulated screen.
- Network, Bluetooth, and audio are non-interactive capability placeholders until a future device bridge or MCP integration exists.
- `MercuryNotificationStore` persists user notes and preserves optional `senderId` and `conversationId` metadata for future proactive and offline contact messages.
- App notification requests from System Services are ingested into the same store; apps still cannot modify Notification Center DOM.
- Notification-list scrolling remains independent from the bottom-edge gesture used to close the panel.

## Dynamic Island

- `MercuryIslandController` is the only owner of Dynamic Island presentation and DOM state.
- Apps submit or clear activities through their app-scoped System Services facade.
- The system selects the highest-priority activity; equal-priority activities prefer the most recently updated request.
- When a higher-priority activity ends, the next valid activity resumes instead of forcing the Island to idle.
- Presentation states are idle, compact active, and expanded active.
- Supported base kinds map to local Iconoir assets: message, music, timer, and generic status.
- Activity text may use locale keys, allowing system-owned previews to update when language changes.

## App Menu / recent spaces

- The `appSwitcher` state presents a navigation menu for recent app spaces; it is not a browser-style tab closer or an operating-system process manager.
- Opening the menu pauses the active app, and selecting a preview resumes the existing App Engine instance.
- The menu does not expose close, clear-all, swipe-to-kill, or unmount behavior. Reset, explicit restart, migration, and error recovery remain the only owners of destructive lifecycle actions.
- `MercuryAppSwitcherController` coordinates state and lifecycle, `MercuryAppSwitcherView` owns presentation, and `MercuryAppSnapshotService` creates inert, privacy-sanitized proportional previews.
- The bottom app rail is generated from registered App definitions. Its visual size, spacing, opacity, and selected state are independent CSS tokens so later icon themes do not change switching logic.
