# Mercury Cinema Code Quality Audit

Audited after the Alpha Closure full regression on 2026-09-05. The scope covers Cinema contracts and projections, persistence, workflows, the application controller, production loading, and the verification surface. Findings are ordered by severity. There are no remaining Alpha release blockers.

## Findings

### P2 - Draft input produces unbounded persistence write amplification

Character preparation and adaptation input handlers call `store.updateDraft()` on each `input` event (`app/apps/cinema-app.js`, around lines 1398-1408 and 1518). Each update normalizes and clones the complete Cinema state, publishes a complete snapshot, queues a repository save, and compares split records with stable serialization (`app/system/cinema-store.js`, lines 57-60 and 323-335; `app/system/cinema-repository.js`, lines 291-303).

This is acceptable for the current small Alpha preparation form, but it will scale poorly with large History/Archive state and the planned Customization forms. Fast typing can create a long write queue and unnecessary whole-state CPU work.

Before adding broad authoring forms, introduce a latest-value/coalesced Draft write path. Keep in-memory input updates immediate, flush at explicit navigation and `openCurtain()` boundaries, and test crash/reload behavior around the flush boundary. Do not weaken the existing durable lifecycle commits for Segments, pending requests, ending, or ended state.

### P2 - The controller's external Interface is deep, but its implementation Locality is deteriorating

`app/apps/cinema-app.js` is 2,649 lines and owns routing, more than twenty screen renderers, gesture state, timers, persistence-error presentation, workflow subscriptions, and lifecycle navigation. Its public Interface to the app engine remains narrow, so file size alone is not the problem. The problem is that a change to one visual family now requires understanding unrelated presentation and orchestration code in the same implementation module.

Before Customization materially expands the route set, retain the controller as lifecycle/orchestration owner and extract a small number of coherent renderer families. Suitable seams are Programme/document surfaces, theater transition surfaces, and World/Cast library surfaces. Each renderer should receive derived projections plus explicit delegates; it must not own or duplicate persisted domain state. Avoid one-file-per-helper fragmentation.

Several delivery tests assert exact source and CSS text. Preserve their design invariants, but migrate the most brittle assertions toward rendered DOM/computed-style or screenshot evidence as renderer extraction proceeds.

### P2 - Production request headroom is operationally unsafe for Customization

The production audit passes all hard limits, but eager requests are `62 / 64`. Total output is `22.62 MiB / 25.00 MiB`, CSS is `474.0 KiB / 512.0 KiB`, and eager Brotli is `200.8 KiB / 256.0 KiB`. Total size, request count, and Brotli have crossed their warning budgets.

`app/main.js` currently loads two Cinema stylesheets and sixteen Cinema scripts when Cinema launches. Before adding new Customization entrypoint dependencies, recover request headroom. The lowest-risk candidate is a production-only Cinema bundle/concatenation step that preserves source modules and test seams. Merging the two Cinema stylesheets at build time is another bounded candidate. Route-level lazy loading is a larger architectural change and should only follow measurement.

### P2 - The authoritative browser regression is not a reproducible release command yet

`app/tests/browser/cinema-alpha-closure-regression.cjs` requires `playwright`, but `package.json` does not declare it and `npm test` / `release:check` do not execute the runner. The current run depends on the Codex bundled runtime being exposed through `NODE_PATH`. A developer or CI environment can therefore pass the declared release commands without exercising the complete browser lifecycle.

Pin the QA dependency or provide a documented repository-owned bootstrap, add a dedicated `test:cinema:e2e` script, and then decide whether it belongs in the mandatory release check. Keep its isolated port/context behavior and machine-readable report.

### P3 - Generation Profile copy advertises a route the current UI does not expose

The Profile picker is Draft-owned and writes through `updateDraft()`, but `app/apps/cinema-app.js` line 1579 says that changing the profile "during projection" affects the next continuation. There is no active Reading route to this picker. The underlying store supports runtime profile changes, but the production presentation does not.

Until a real Performance override surface is designed, change this copy when the screen is next touched so it describes preparation only. Do not add an active-Performance control as a copy fix.

### P3 - A legacy Credits helper remains in the contracts Interface without a production consumer

`computeCredits()` is defined and exported by `app/core/cinema-contracts.js` (lines 421 and 514), but production Credits and History use their dedicated projections. Only its contract test still consumes it. This creates two possible homes for Credits-derived presentation rules.

Mark the helper deprecated or remove it after confirming no external consumer relies on the exported global Interface. Keep Credits presentation derivation in `cinema-credits-projection.js`.

### P3 - Cinema material tokens are only partially normalized

The shared typography, spacing, and core material tokens are established at the top of `app/styles/cinema-app.css`, but screen families still contain repeated literal near-black, ink-opacity, and gold-opacity values. Some literals are legitimate one-off compositing values; repeated semantic values are not.

Consolidate repeated semantic materials only while touching the owning visual family. A wholesale replacement would risk approved visual fidelity and is not justified by this audit.

## Blockers fixed during regression

- A durable preparation Draft is now reachable from Programme after reload without creating or replacing an Instance.
- Programme no longer presents compatibility-generated Scene arrays as canonical Act/Scene position.
- Generation context no longer injects compatibility placeholder Scene names or Act/Scene labels as frozen truth.
- Migrated Instances remain reloadable after a legitimate Generation Profile switch while Stage, Scenario, Character, Variant, and migration-time prose protection remain enforced.

## Verification

- Unit/contract suite: 85 files, 3,001 assertions, 0 skipped, 0 failures.
- Integrated Playwright lifecycle: PASS at 360x780, 390x844, and 430x932.
- Durable pending reload/retry/abandon, late-result protection, ending reload, persistence failure, no-image fallback, multi-Performance grouping, and legacy Past redirect: PASS.
- Production build: PASS.
- Production hard-budget audit: PASS with warning-budget pressure recorded above.
- Security-oriented DOM construction scan: dynamic narrative and metadata are assigned through `textContent`; no Cinema `innerHTML`, `outerHTML`, `insertAdjacentHTML`, or `dangerouslySetInnerHTML` use was found.
- Git anomaly audit remains unavailable because this workspace has no usable Git metadata.

## Entry conditions for Customization

Alpha Closure can be frozen. Before broad Customization implementation, recover eager-request headroom and define the coalesced Draft persistence Interface. Renderer extraction can proceed incrementally with the first affected material family; it is not a prerequisite for freezing Closure and must not become a broad rewrite.
