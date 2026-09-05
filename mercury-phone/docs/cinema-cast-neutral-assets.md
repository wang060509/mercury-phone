# Cinema Cast neutral presentation assets

These six images are presentation-only fallbacks for Character rows in Cinema Cast.

- Runtime size: `44 x 58` CSS pixels.
- Source delivery size: `192 x 256` WebP.
- Assignment: stable Character ID hash; no persistence field.
- Ownership: Mercury presentation layer.
- Semantic status: none. These files must never enter Character prompts, snapshots, analysis, or continuity.
- Failure behavior: user image -> assigned neutral image -> surname/initial typography.

The current Archive model does not expose a complete user-managed Character image pipeline. Cinema consumes a direct image reference from the existing `avatarAssetId` / `imageAssetId` string only when it is already a safe image URL. It does not add or edit that data.

## Generation prompts

All sources were generated with the built-in ImageGen tool. Every prompt required a vertical `3:4` editorial macro image, simple forms legible at thumbnail scale, near-black/warm-ivory Mercury color, and no text, logo, watermark, people, faces, bodies, human silhouettes, character-specific symbols, stars, planets, neon, or red glow.

1. Near-black theater fabric folding across a softly illuminated warm-ivory translucent scrim.
2. Layered smoked and frosted glass with one narrow warm-ivory reflection.
3. Overlapping warm-ivory paper and translucent vellum crossed by a narrow theatrical beam.
4. Out-of-focus dark botanical leaves behind ribbed translucent glass.
5. Black water with one restrained warm-ivory reflection broken into soft ripples.
6. A contemporary black architectural wall fragment crossed by a soft warm stage-light trapezoid and scrim edge.

`scripts/prepare-cinema-cast-placeholders.cjs` performs only the final attention crop, resize, and WebP encoding.
