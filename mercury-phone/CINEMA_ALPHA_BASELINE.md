# Mercury Cinema Alpha Baseline

Frozen after the Alpha Closure regression on 2026-09-05, hardened by Batch A, and re-frozen after Final Safe Cleanup on 2026-09-06.

## Implemented and verified

The user-visible lifecycle is:

`Theater Home -> Programme -> World Library -> World Detail -> Cast -> Adaptation -> Before the Curtain -> Reading -> Intermission/Resume -> Ending -> Credits -> History -> Programme Archive Index`

- Home is a stable foyer with Programme, Worlds, and Cast. It contains no current-Performance dashboard data.
- Programme is the only user-level entry for unfinished and ended Performances. It preserves every unfinished Performance and groups archive entries by stable Character x World identity.
- Preparation is a durable Draft. Reloaded Drafts are recoverable through Programme and do not create an Instance.
- `openCurtain()` is the Instance creation boundary. Character adaptation and Before the Curtain remain Draft-owned.
- Reading persists the user's Segment and pending request identity before transport. Retry is explicit and request-identity guarded.
- Intermission is a durable paused state. It does not fabricate an Act transition or automatically retry pending work.
- Ending is a two-step durable closure: `ending` is persisted before the final `ended` commit. Credits is unreachable until `ended` is durable.
- Explicit pending abandonment preserves the unanswered user Segment and records its non-response provenance in `closureRecord.pendingDisposition`.
- Credits links only to the complete Programme History and Programme.
- History is an immutable continuous document with cover, contents, complete prose, and colophon. Archive navigation cannot reactivate an ended Performance.
- Legacy `past` launches redirect to Programme Archive Index. Compatibility-generated Scene arrays are not presented as canonical Act/Scene truth.
- Character, World, Act, and Scene presentation imagery remains optional. The verified no-image path uses deterministic World/Cast fallbacks and text-first Reading.

## Authoritative state boundaries

| State | Authority |
| --- | --- |
| preparation | `state.draft`; no Instance exists |
| active | unfinished Instance; resumable and writable |
| intermission | unfinished Instance; paused and explicitly resumable |
| pending continuation | durable request identity plus preserved user Segment; never auto-resend |
| ending | durable closure transition; not yet archived success |
| ended | immutable archived Performance; no Continue path |

UI route state is deliberately not persisted. A full page reopen returns to the Cinema foyer; Programme restores access to the durable Draft, unfinished Performance, ending recovery, Credits outcome, or History as applicable.

## Persistence guarantees

- IndexedDB is authoritative after verified legacy migration; migration does not rewrite the legacy source.
- Instance metadata and ordered Segments are stored separately with a unique `[instanceId, ordinal]` index.
- Migration manifests retain source, prose, and snapshot digests.
- User Segment, pending identity, assistant response, continuity notes, ending state, ended state, and focus reassignment are covered by explicit commit boundaries.
- Stale, duplicate, aborted, late, and repeated generation/closure operations are identity-checked and idempotent at their workflow boundary.
- A closure write failure cannot expose Credits. Reload recovers the last durable state, and retry does not duplicate prose or closure records.

## Verification baseline

- Full suite: 86 files, 3,052 assertions, 0 skipped, 0 failures. The three-assertion reduction removes only the unused legacy `computeCredits()` contract surface.
- Real Mercury Phone Playwright regression: complete new-Performance lifecycle, generation, two Intermission resumes, ordinary closure, Credits, History, Archive, pending reload/retry, pending abandonment, durable-ending reload, closure persistence failure, and 360x780 / 390x844 / 430x932 viewports.
- Native IndexedDB harness: migration complete, commit granularity verified, Scene ids and prose order preserved.
- Long-horizon continuity: 200-turn main Performance plus 100-turn shadow Performance.
- Stress gates: 160-segment History and 180-entry Programme Archive; no clipped labelled content at the authoritative viewport.
- Reduced motion: major lifecycle transitions complete; History and Archive animations/scrolling become static/automatic.
- Integrated report: `test-results/cinema-alpha-closure/regression-report.json`.
- Reproducible runner: `app/tests/browser/cinema-alpha-closure-regression.cjs`. Playwright is a declared development dependency and the core profile runs through `release:check`; the larger viewport sweep remains available as `test:cinema:e2e:stress`.

## Batch A hardening

- Production keeps the source module seams but bundles Cinema into one CSS and one JavaScript request at build time.
- Core app and production smoke checks run at the authoritative 390x844 viewport.
- Archive Store owns imported role-profile repair writes; Chat requests repair through the Store interface.
- Draft persistence is latest-value coalesced and flushes before navigation, lifecycle boundaries, and `openCurtain()`.
- Cinema font sources, versions, hashes, codepoint coverage, build dependencies, and third-party notices are repository-owned and reproducible.

## Production budget

| Budget | Current | Hard limit | Headroom |
| --- | ---: | ---: | ---: |
| total output | 22.61 MiB | 25.00 MiB | 2.39 MiB |
| JavaScript | 1.23 MiB | 1.50 MiB | 0.27 MiB |
| CSS | 470.9 KiB | 512.0 KiB | 41.1 KiB |
| shell requests | 62 | 64 | 2 |
| shell raw | 986.1 KiB | 1.25 MiB | about 294 KiB |
| shell gzip | 241.2 KiB | 320.0 KiB | 78.8 KiB |
| shell Brotli | 199.7 KiB | 256.0 KiB | 56.3 KiB |
| Cinema cold-open requests | 64 | 68 | 4 |
| Cinema cold-open raw | 1.47 MiB | 2.00 MiB | about 543 KiB |
| Cinema cold-open gzip | 358.6 KiB | 512.0 KiB | 153.4 KiB |
| Cinema cold-open Brotli | 281.8 KiB | 384.0 KiB | 102.2 KiB |

Warnings remain active for total output (over 20 MiB) and shell request count (over 55). Shell Brotli is now inside its warning budget. Cinema has four cold-open requests of hard headroom after production-only bundling. New Customization code must preserve route-level measurement and should not add shell dependencies without evidence.

## Known limitations

- The production catalog currently exposes the static Aevoria Stage system; editable World architecture is not implemented.
- Runtime-owned Act transition events do not yet exist. Intermission therefore uses neutral pause semantics and never promises a canonical next Act.
- Older `compatibility-unknown` Performances remain readable but omit unreliable structural labels and statistics.
- History is read-only. Canonical continuity correction is not implemented.
- Optional presentation-media replacement and management are reserved contracts, not a complete user workflow.
- Production deployment, hosted relay policy, and CI are still not established; the local release command is reproducible but not yet a remote pipeline.

## Planned or deferred

Not implemented in this baseline: World Builder, Character authoring, advanced Performance customization, image generation, required multimodal inputs, Diegetic Modules, replay/fork, editable annotations, canonical continuity correction, AI-authored ending summaries, AI-authored relationship conclusions, active-play timing, and runtime-backed Act progression.
