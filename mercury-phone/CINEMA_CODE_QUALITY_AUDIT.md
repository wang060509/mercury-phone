# Mercury Cinema Code Quality Audit

Audited after the Alpha Closure full regression on 2026-09-05 and reconciled after Batch A plus Final Safe Cleanup on 2026-09-06. The scope covers Cinema contracts and projections, persistence, workflows, the application controller, production loading, and the verification surface. The original findings remain below as engineering history; their current disposition is authoritative here. There are no remaining Alpha release blockers.

## Final disposition

- **Resolved**: Draft writes are latest-value coalesced and flush at navigation/lifecycle boundaries.
- **Resolved**: Playwright is declared, the core Cinema lifecycle is part of `release:check`, and the clean-clone build/test path is reproducible.
- **Resolved for Alpha**: production-only Cinema bundling reduced incremental Cinema loading to two requests; all hard budgets pass.
- **Resolved**: the unused `computeCredits()` export and its isolated tests were removed. Credits derivation remains in `cinema-credits-projection.js`.
- **Resolved**: high-confidence dead renderer methods, legacy Chat methods, Cinema CSS, and seven unreferenced Iconoir assets were removed without changing public delegates or persisted contracts.
- **Deferred, not a cleanup authorization**: `cinema-app.js` remains a large controller implementation; renderer-family extraction must wait for an affected product slice and keep projections/delegates explicit.
- **Deferred**: selective material-token normalization and brittle source-text test migration should occur only inside an approved owning-family change.
- **Retained deliberately**: ambiguous legacy candidates such as Archive `renderProfile()` were not deleted without stronger runtime evidence.

## Findings

### P2 - Draft input produces unbounded persistence write amplification (resolved in Batch A)

Character preparation and adaptation input still update in-memory Draft state immediately, but persistence is now latest-value coalesced. Explicit navigation, lifecycle, and `openCurtain()` boundaries flush the pending Draft write. Focused crash/reload tests cover the boundary without weakening durable Segment, pending, ending, or ended commits.

### P2 - The controller's external Interface is deep, but its implementation Locality is deteriorating (deferred)

`app/apps/cinema-app.js` remains about 2,642 lines and owns routing, more than twenty screen renderers, gesture state, timers, persistence-error presentation, workflow subscriptions, and lifecycle navigation. Its public Interface to the app engine remains narrow, so file size alone is not the problem. The problem is that a change to one visual family now requires understanding unrelated presentation and orchestration code in the same implementation module.

Before Customization materially expands the route set, retain the controller as lifecycle/orchestration owner and extract a small number of coherent renderer families. Suitable seams are Programme/document surfaces, theater transition surfaces, and World/Cast library surfaces. Each renderer should receive derived projections plus explicit delegates; it must not own or duplicate persisted domain state. Avoid one-file-per-helper fragmentation.

Several delivery tests assert exact source and CSS text. Preserve their design invariants, but migrate the most brittle assertions toward rendered DOM/computed-style or screenshot evidence as renderer extraction proceeds.

### P2 - Production request headroom is operationally unsafe for Customization (resolved for Alpha)

The final production audit passes all hard limits. Eager requests remain `62 / 64`; total output is `22.61 MiB / 25.00 MiB`, CSS is `470.9 KiB / 512.0 KiB`, and eager Brotli is `199.7 KiB / 256.0 KiB`. Total size and request count remain above warning budgets; Brotli is back inside its warning budget.

The production build now concatenates Cinema CSS/JavaScript while preserving source module seams, reducing Cinema incremental loading to two requests and cold-open loading to 64 requests. Route-level lazy loading remains a larger architectural change and should only follow measurement; Customization must not add eager shell dependencies without evidence.

### P2 - The authoritative browser regression is not a reproducible release command yet (resolved in Batch A)

Playwright is now a declared development dependency. `test:cinema:e2e` runs the core profile, `test:cinema:e2e:stress` preserves the larger viewport/stress sweep, and `release:check` includes the core lifecycle plus production smoke and budget audit. A clean clone at the private recovery hash reproduced the same build and test result.

### P3 - Generation Profile copy advertises a route the current UI does not expose

The Profile picker is Draft-owned and writes through `updateDraft()`, but `app/apps/cinema-app.js` line 1579 says that changing the profile "during projection" affects the next continuation. There is no active Reading route to this picker. The underlying store supports runtime profile changes, but the production presentation does not.

Until a real Performance override surface is designed, change this copy when the screen is next touched so it describes preparation only. Do not add an active-Performance control as a copy fix.

### P3 - A legacy Credits helper remains in the contracts Interface without a production consumer (resolved in Final Safe Cleanup)

Repository-wide static analysis and the full runtime gate confirmed no production consumer. `computeCredits()` and its three isolated contract assertions were removed; Credits presentation derivation remains solely in `cinema-credits-projection.js`.

### P3 - Cinema material tokens are only partially normalized

The shared typography, spacing, and core material tokens are established at the top of `app/styles/cinema-app.css`, but screen families still contain repeated literal near-black, ink-opacity, and gold-opacity values. Some literals are legitimate one-off compositing values; repeated semantic values are not.

Consolidate repeated semantic materials only while touching the owning visual family. A wholesale replacement would risk approved visual fidelity and is not justified by this audit.

## Blockers fixed during regression

- A durable preparation Draft is now reachable from Programme after reload without creating or replacing an Instance.
- Programme no longer presents compatibility-generated Scene arrays as canonical Act/Scene position.
- Generation context no longer injects compatibility placeholder Scene names or Act/Scene labels as frozen truth.
- Migrated Instances remain reloadable after a legitimate Generation Profile switch while Stage, Scenario, Character, Variant, and migration-time prose protection remain enforced.

## Verification

- Unit/contract suite: 86 files, 3,052 assertions, 0 skipped, 0 failures.
- Integrated Playwright lifecycle: PASS at 360x780, 390x844, and 430x932.
- Durable pending reload/retry/abandon, late-result protection, ending reload, persistence failure, no-image fallback, multi-Performance grouping, and legacy Past redirect: PASS.
- Production build: PASS.
- Production hard-budget audit: PASS with warning-budget pressure recorded above.
- Security-oriented DOM construction scan: dynamic narrative and metadata are assigned through `textContent`; no Cinema `innerHTML`, `outerHTML`, `insertAdjacentHTML`, or `dangerouslySetInnerHTML` use was found.
- Git anomaly audit: PASS. A private remote recovery baseline was clean-cloned, rebuilt, tested, and hash-verified before cleanup; Final Safe Cleanup is a separate later commit.

## Entry conditions for Customization

Alpha Closure and the safe-cleanup baseline are frozen. The next stage is **Customization Pattern Audit — no implementation yet** across Character authoring, World authoring, Visual customization, and Performance-level customization. Before implementation, define authority/default/override/recovery boundaries and measure any new eager dependency. Renderer extraction may proceed only with the first approved affected family; it must not become a broad rewrite.
