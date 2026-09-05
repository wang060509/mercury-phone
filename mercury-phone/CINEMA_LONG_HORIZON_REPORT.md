# Cinema Phase 2D-LH Long-Horizon Report

## Verdict

**YES WITH KNOWN LIMITS.** The frozen Phase 2D narrative kernel completed a deterministic 200-turn primary Instance while a second 100-turn Instance was interleaved. Raw prose, ordering, coverage safety, budget bounds, instance isolation, profile binding, lifecycle neutrality, and atomic assistant commits held. No BLOCKER or HIGH defect was found, so production runtime code was not changed.

## Harness

- `app/tests/cinema-long-horizon.test.js` contains the long-horizon assertions.
- `app/tests/fixtures/cinema-long-horizon-fixture.js` generates an original, source-neutral story with planted identity facts, commitments, open threads, relationship phases, location returns, correction and state-change cases, delayed details, near-duplicates, and noise.
- `app/tests/fixtures/cinema-long-horizon-harness.js` drives the real `MercuryCinemaGenerationWorkflow`, `MercuryCinemaContextCompiler`, `MercuryCinemaContinuityLedger`, `MercuryCinemaStore`, and `MercuryIndexedDBCinemaRepository` over a deterministic in-memory database adapter. It records structured telemetry without logging story prose.

The primary Instance runs 200 user turns. A shadow Instance runs 100 interleaved turns against the same Stage and Scenario. Deterministic fault injection covers early and late continuity derivation failures, model failure, cancellation, repository write failure, reload after user durability, reload after pending durability, and lifecycle reload.

## Checkpoint Metrics

Continuity counts are `timeline / people / places / threads / commitments / importantFacts`. Context sizes are characters, matching the compiler's existing estimator.

| Turn | Raw segments (user/assistant) | Raw chars | Summary | Durable ledger | Continuity counts | Context total (A/B/C/D) | History | Coverage | Uncovered ordinals | Duplicate observations | Resolved threads still open | Delayed extracted/raw-only |
| ---: | --- | ---: | ---: | ---: | --- | --- | ---: | ---: | --- | ---: | ---: | --- |
| 100 | 201 (100/101) | 54,827 | 3,200 | 44,106 | 80 / 1 / 2 / 25 / 21 / 43 | 17,791 (1,122 / 13,927 / 2,230 / 320) | 8 | 200 | none | 3 | 0 | not yet queried |
| 150 | 301 (150/151) | 82,247 | 3,199 | 52,000 | 80 / 1 / 2 / 39 / 30 / 61 | 21,126 (1,113 / 17,735 / 1,668 / 418) | 6 | 292 | 293-300 | 5 | 1 | available / unavailable |
| 200 | 401 (200/201) | 109,353 | 3,200 | 59,679 | 80 / 1 / 2 / 50 / 40 / 80 | 21,449 (1,113 / 18,255 / 1,570 / 319) | 6 | 392 | 393-400 | 7 | 1 | available / unavailable |

Per-generation aggregates through each checkpoint:

| Turn | Total min / max / median / p95 | Layer B min / max / median / p95 | Layer C min / max / median / p95 |
| ---: | --- | --- | --- |
| 100 | 1,822 / 17,791 / 11,609 / 16,626 | 187 / 13,927 / 8,948 / 13,432 | 0 / 3,026 / 1,071 / 2,238 |
| 150 | 1,822 / 22,300 / 14,005 / 20,880 | 187 / 18,963 / 11,178 / 18,076 | 0 / 3,026 / 1,074 / 2,323 |
| 200 | 1,822 / 23,855 / 16,823 / 22,247 | 187 / 22,216 / 13,802 / 18,963 | 0 / 3,026 / 1,074 / 2,328 |

The durable ledger grew from 44,106 to 59,679 characters, while compiled total context remained below the 24,000-character budget. No required-content overflow occurred. Layer B truncation occurred on 50 generations. At turn 200, commitments and important facts were admitted, while people, places, summary, and threads were omitted from the compiled request; their durable records remained intact.

## Summary And Coverage

- 51 summary checkpoints ran across both Instances.
- Injected primary-Instance failures occurred at turns 14 and 115. Coverage stayed at 18 and 220 respectively, then advanced to 30 and 232 after recovery.
- Coverage was monotonic per Instance and never advanced beyond a successfully committed continuity result.
- The largest uncovered story window was 3,540 characters; it did not grow without bound or repeat the same failed window forever.
- All covered raw Segments remained durable. Final coverage was 392 for the primary Instance and 198 for the shadow Instance.

## Verified Invariants

- Every committed user and assistant Segment remained present; primary and shadow ordinals stayed contiguous and reload preserved ordering.
- Every checked `evidenceOrdinal` referred to a durable user/assistant turn position.
- Summary size never exceeded 3,200 characters; compiled context remained bounded; required-overflow count was zero.
- Segments, notes, continuity, coverage, pending continuation, and compiler input never crossed Instances.
- Profile history remained `A -> B -> C`; an old pending retry used profile A after the runtime switched to B, the next turn used B, and later turns used C. Historical Segment profile ids were unchanged.
- Pause, focus switch, resume, and reload created no Scene, Segment, continuity update, or coverage movement.
- Model failure, cancellation, pending reload, summary failure, and repository write failure did not duplicate canonical prose. Assistant Segment, notes, continuity, and pending clear committed atomically.

## Delayed Relevance

The extracted turn-5-to-15 detail left recent Layer C, became covered, and was still available when required after turn 130. This demonstrates the intended structured-continuity path.

The raw-only detail also remained in permanent raw prose, but was unavailable to the later compiled request because it was deliberately not extracted. This is the accepted boundary: durable raw retention is not automatic rediscovery.

## Findings

| Classification | Severity | Reproduction and result | Decision |
| --- | --- | --- | --- |
| RECOVERY DEFECT | MEDIUM | At primary turn 25, reload after the user Segment flush but before pending durability restores exactly one user Segment and no pending identity. The harness can rebind pending using the known durable Segment id and retry without duplication, but the current runtime does not durably encode that operation identity in this narrow window. | Documented. A robust fix would change the user-plus-pending transaction boundary and exceeds the BLOCKER/HIGH-only production change policy. |
| SEMANTIC QUALITY LIMITATION | MEDIUM | At budget pressure, Layer B tail truncation is order-biased. By turn 200, later commitments/facts fit while people, places, summary, and threads do not. Total context remains bounded and durable data remains present. | Documented; no new pruning or retrieval architecture added. |
| EXPECTED MODEL-DEPENDENT LIMITATION | MEDIUM | Correction and state-change old/new evidence both remain in continuity. The compiler tells the model to prefer later corrections and current state, but the ledger has no typed supersession relation. | Both cases are preserved and distinguishable in raw history; final interpretation remains model-dependent. |
| SEMANTIC QUALITY LIMITATION | LOW | One resolved thread remains marked `open`, and fulfilled commitments have no automatic terminal-state transition. | Documented; no heuristic lifecycle framework added. |
| SEMANTIC QUALITY LIMITATION | LOW | Exact-description deduplication does not merge differently worded repeats; duplicate observations rise from 3 at turn 100 to 7 at turn 200. | Documented; durable category caps and compiler budget prevent unbounded request growth. |
| EXPECTED MODEL-DEPENDENT LIMITATION | OBSERVATION | The raw-only delayed detail is retained but cannot be rediscovered after leaving recent context. | Expected Phase 2D boundary; no vector search or replay-all-story added. |
| TEST-HARNESS LIMITATION | OBSERVATION | The harness uses deterministic transport and derivation fault injection rather than paid model calls. It deliberately suppresses one planted detail from derived continuity to exercise the raw-only boundary. | Results validate architecture and deterministic heuristics, not model prose quality. |

No CORRECTNESS, BOUNDEDNESS, or ISOLATION defect was observed.

## Verification

- Independent: `node app/tests/cinema-long-horizon.test.js` passed with primary `200` turns, shadow `100` turns, checkpoints `100/150/200`, `51` summary attempts, and `50` continuity truncations.
- Full suite: `npm test` passed: `70` files, `2,285` assertion calls, `0` skipped, `0` failures.
- Production audit: `npm run audit:production` passed all hard limits. Existing warnings remain for total output (`20.82 MiB / 20.00 MiB` warning budget) and eager local requests (`62 / 55` warning budget). Git anomaly audit was skipped because this workspace has no usable Git metadata.
- Browser smoke: **NOT RUN - environment blocked.** Chromium was not installed.
- Production runtime changes: **NONE.** Cinema Home and visual presentation were not modified.

## Architecture Status

Phase 2D remains frozen. The measurements do not justify reopening it under the stated fix policy.

**Phase 2E NOT STARTED.**

**Visual Closure NOT STARTED.**
