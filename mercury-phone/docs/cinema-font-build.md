# Cinema Font Build

Cinema production fonts are deterministic modified subsets. They are not built from developer-specific temporary paths.

## Rebuild

Run these commands from `mercury-phone` on Windows:

```powershell
npm run fonts:deps
npm run fonts:fetch
npm run fonts:build
```

`fonts:deps` installs the pinned Python packages into the ignored `.cache/cinema-font-pydeps` directory. The four license-compatible, hash-pinned upstream source fonts are versioned in `vendor/cinema-font-sources` so a clean clone does not depend on a developer cache or GitHub asset availability. `fonts:fetch` verifies those files and can restore missing sources from the official fixed URLs, preferring a bounded `curl` transfer and falling back to Python `urllib`. `fonts:build` uses the frozen ranges in `scripts/cinema-font-codepoints.json` and rejects output that differs from the approved output hashes.

Use `npm run fonts:verify-sources` for offline vendored-source verification. `CINEMA_FONT_SOURCE_DIR` and individual `CINEMA_*_SOURCE` environment variables remain available for verified local mirrors; every override is still hash checked.

## Intentional Range Changes

Do not regenerate ranges from all application text. That made unrelated source edits silently alter font binaries. Expand coverage only after a typography gate, rebuild the intended subset, verify it visually, then deliberately run `node scripts/freeze-cinema-font-codepoints.cjs` and update the approved hashes.

JasonHandwriting 8 remains annotation-only and uses whole-string fallback. Broad dynamic handwriting shards are deferred until dynamic annotation authoring requires them.

Licenses and attribution ship in `app/THIRD_PARTY_NOTICES.md`, `app/third-party/`, and `app/assets/fonts/cinema/`.
