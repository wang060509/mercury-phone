# Mercury Cinema UI Normalization Audit

Status: approved normalization baseline, with the handwriting correction recorded on 2026-09-03. No production Cinema files, Phase 2D contracts, or runtime delegates were changed.

## Decision

The approved family is coherent and implementable as one system. It should not be redrawn screen by screen. The implementation should be built from five shared material families (theater, programme paper, rehearsal scrim, reading stage, curtain transition), one typography system, one custom SVG glyph system, and one constrained ornament vocabulary.

The two material corrections that must happen during implementation are:

- Oxblood is a recessed lining/threshold behind matte black stage structure, at roughly 8-12% perceptual weight. It is not a full-screen slab, glow, or primary button color.
- Warm ivory is the visual bridge between stage light, translucent scrim, paper, and reading text. It changes material behavior by surface, but keeps one hue family.

Home remains the approved black-box foyer and stays visually stable across empty, active, intermission, and pending runtime conditions. Programme owns selection, Continue, pending recovery entry, and the empty path toward a new life.

## 1. Reusable UI Families

### Foundations

| Family | Components | Responsibility |
| --- | --- | --- |
| Shell | `CinemaViewport`, `CinemaSafeArea`, `CinemaRouteSurface` | Fixed phone composition, safe-area insets, scroll ownership, surface transition; no domain state |
| Material | `TheaterSurface`, `ProgrammePaper`, `RehearsalScrim`, `ReadingStage`, `CurtainSurface` | Applies lifecycle-specific color/material rhythm without changing content contracts |
| Navigation | `CinemaBackAction`, `CinemaHeader`, `CinemaOverflowAction`, `CinemaTextAction` | Minimal route chrome; 44px hit targets; icon/label may be visually smaller |
| Type | `CinemaDisplayTitle`, `CinemaSectionTitle`, `CinemaReadingText`, `CinemaUiLabel`, `CinemaEditorialLabel`, `CinemaCaption`, `CinemaMetadata`, `CinemaAnnotation` | Maps semantic text roles to fixed tokens; Chinese and English roles remain separate |
| Glyph | `CinemaGlyph`, `CinemaDestinationGlyph` | Inline SVG/currentColor rendering, optical sizing, accessibility labels on controls |
| Ornament | `CinemaRegistrationMark`, `CinemaIndex`, `CinemaRule`, `CinemaTick`, `CinemaOrbit`, `CinemaDiamond`, `CinemaCoordinate`, `CinemaSectionDivider` | Deterministic editorial notation with page-family placement rules |

### Product surfaces

| Surface | Component family | Required data/actions |
| --- | --- | --- |
| Home | `CinemaFoyer`, `StageWing`, `ScrimAperture`, `FoyerDestination` | Stable Programme/Worlds/Cast destinations only; no Performance metadata |
| Programme | `ProgrammeSheet`, `ProgrammeMasthead`, `ProgrammeLead`, `ProgrammeEntryList`, `ProgrammeStartRow`, `ProgrammeEmpty` | Derived unfinished/past groups; `#continueInstance`; World/Stage selection path |
| Programme Entry | `ProgrammeSpread`, `ProgrammeIdentity`, `CurrentPerformance`, `PastPerformanceIndex` | One Character x World/Stage group; unfinished and historical Instances remain individually reachable |
| World Library | `WorldIndex`, `WorldEntry`, `WorldVisualPlate`, `MercuryWorldFallback` | Current static Stage catalog first; visuals optional; deterministic fallback always complete |
| Cast | `CastIndex`, `CastEntry`, `CastEmptyBridge` | Read-only Archive `runtimeProfiles`; creation/editing stays in Archive |
| Adaptation | `AdaptationStage`, `ScrimColumn`, `RehearsalDocument`, `PreservedCore`, `AdaptationField`, `MarginAnnotation`, `AdaptationWarning`, `AdaptationFooter` | Character snapshot + per-Instance draft Variant; annotations only when grounded in real data |
| Before the Curtain | `CurtainRitual`, `RitualPrompt`, `CurtainSeam`, `OpeningAction` | Scenario/Opening Setup and Shared History presented together but edited as separate values; opening delegates to existing curtain lifecycle |
| Reading | `ReadingShell`, `ActMasthead`, `SceneVisualPlate`, `NarrativeFlow`, `PlayerPassage`, `ReadingComposer`, `ReadingUtilityMenu` | Raw Segments, current Scene, Workflow send/retry/cancel; visual plate optional and collapsible |
| Intermission | `IntermissionCurtain`, `ActTransitionBlock`, `IntermissionActions` | Existing explicit intermission/resume lifecycle; no fabricated next-Act data |

These are unframed page regions, documents, and stage layers, not a card library. Repeated Programme entries are typographic rows separated by rules; Adaptation documents may overlap because they represent physical translucent sheets, not nested cards.

## 2. Typography Tokens

### Proposed role tokens

```css
:root {
  --cinema-font-display-zh: "Cinema Zhuque", "Noto Serif SC", "Songti SC", SimSun, serif;
  --cinema-font-reading-zh: "Cinema Noto Serif SC", "Noto Serif SC", "Songti SC", SimSun, serif;
  --cinema-font-ui-zh: "Noto Sans SC", "PingFang SC", "Microsoft YaHei UI", sans-serif;
  --cinema-font-editorial-en: "Cinema Manrope", Manrope, "Segoe UI", sans-serif;
  --cinema-font-handwriting-zh: "JasonHandwriting8", "STKaiti", KaiTi, serif;

  --cinema-type-display-major-size: 46px;
  --cinema-type-display-major-leading: 1.08;
  --cinema-type-display-page-size: 34px;
  --cinema-type-display-page-leading: 1.15;
  --cinema-type-section-size: 22px;
  --cinema-type-section-leading: 1.35;
  --cinema-type-reading-size: 17px;
  --cinema-type-reading-leading: 1.95;
  --cinema-type-ui-size: 14px;
  --cinema-type-ui-leading: 1.45;
  --cinema-type-editorial-en-size: 9px;
  --cinema-type-editorial-en-leading: 1.25;
  --cinema-type-editorial-en-tracking: .22em;
  --cinema-type-caption-size: 12px;
  --cinema-type-caption-leading: 1.6;
  --cinema-type-metadata-size: 11px;
  --cinema-type-metadata-leading: 1.5;
  --cinema-type-annotation-size: 16px;
  --cinema-type-annotation-leading: 1.55;

  --cinema-space-1: 4px;
  --cinema-space-2: 8px;
  --cinema-space-3: 12px;
  --cinema-space-4: 16px;
  --cinema-space-5: 24px;
  --cinema-space-6: 32px;
  --cinema-space-7: 48px;
  --cinema-space-8: 64px;
  --cinema-space-9: 88px;
  --cinema-page-gutter: 24px;
  --cinema-reading-measure: 29ch;
}
```

Chinese display, body, UI, and annotation text use `letter-spacing: 0`. Only English editorial micro-labels use generous tracking. Font size does not scale with viewport width.

### Repository font audit

| Font | Repository state | Coverage/result | Decision |
| --- | --- | --- | --- |
| Zhuque Fangsong UI WOFF2 | 203,940 B, 665 Unicode code points | Missing 16 of 68 audit characters, including `子午二廊必须注雾港气立林疏配應邊` | Suitable only for controlled strings already in its subset. Not safe for dynamic Performance/World/Act titles. |
| Noto Serif SC UI TTF | 201,384 B, 579 code points | Same audit gaps as Zhuque | Not sufficient for arbitrary Reading prose or dynamic titles. |
| Manrope Variable | 165,420 B, weight axis 200-800 | Latin/editorial coverage is sufficient | Approved for `--cinema-font-editorial-en`; Cinema `@font-face` should expose `font-weight: 200 800`, not only 500. |
| Pinyon Script | 151,412 B, Latin only | No Chinese; visually outside the approved contemporary family except existing Credits | Do not use as an editorial system font. Re-evaluate/remove when Credits is eventually normalized. |
| Noto Sans SC VF/UI | Two byte-identical 15,054,748 B files; 30,890 code points | Audit sample complete, but both directories are excluded from release | Valid UI reference, not shippable as-is under current budgets; deduplicate before any future use. |
| LXGW WenKai Lite local TTF | 9,371,648 B | Corrupt/truncated: `post` table expects data beyond EOF | Cannot be used. The current chat CSS instead imports a remote segmented webfont, which is not an offline deterministic Cinema dependency. |

The current repository therefore cannot reproduce the approved Chinese typography deterministically across dynamic content. A production typography pass must regenerate licensed, route-appropriate webfont assets before broad UI replacement. No new font dependency was added in this audit.

### Handwriting comparison

Rendered samples:

- [Adaptation context comparison](./handwriting-candidates.png)
- [Readable-size detail comparison](./handwriting-candidates-detail.png)

| Candidate | Official source result | TTF / local WOFF2 conversion | Visual finding | Status |
| --- | --- | --- | --- | --- |
| JasonHandwriting 8 / 清松手写体 8 | 9,461 code points; audit sample complete | 8,030,664 B / 4,287,988 B | Deliberately irregular and human; best match for real rehearsal/director margin notes | Approved visual target; production packaging remains blocked |
| JasonHandwriting 9 / 清松手写体 9 | 9,421 code points; audit sample complete | 8,379,644 B / 4,539,840 B | More polished and editorial than the intended rehearsal-note voice | Comparison only |
| LXGW WenKai Lite Light (official current file) | 25,598 code points; audit sample complete | 15,612,172 B / 6,531,976 B | Most legible and broad, but looks more like a typeset Kaiti/Wenkai face than a human margin note | Fallback candidate only |

JasonHandwriting 8 is the approved visual target. Handwriting remains annotation-only: no navigation, Programme content, Reading body, buttons, or primary headings may use it. The full WOFF2 is 4,287,988 B and exceeds the 4 MiB single-asset hard limit. A verified four-shard conversion totals 4,334,312 B; when added to the current release it leaves only 23,265 B below the 25 MiB total hard limit. That margin is operationally unacceptable, so production integration remains blocked until at least 512 KiB of real release headroom has been reclaimed.

### Production-safe handwriting subset strategy

Treat subsetting as an OFL Modified Version and make the build reproducible:

1. Pin the official `JasonHandwriting8.ttf` source by repository commit, source URL, SHA-256, and original copyright statement. The audited source SHA-256 is `1437DE4A5FEE29A5C6B43450DF56E734AF9CDDB5B3A68D236CF5F42BE178C93F`.
2. Resolve the upstream license-package gap before distribution. The official repository and font copyright record say `SIL Open Font License`, but the audited source has no standalone OFL file, license version, or RFN declaration. Obtain author/upstream confirmation of the exact version and RFN status, or use an official package that supplies them. Do not ship while that evidence is ambiguous.
3. Keep the confirmed full OFL text, original copyright, any RFN declaration, source URL/commit, generated-file hashes, and a modification log in the repository's third-party attribution area. The generated WOFF2 metadata must retain original authorship and identify Mercury's subsetting/conversion.
4. Use a distinct internal family/PostScript name such as `MercuryCinemaHandwriting` for the Modified Version. This avoids cache/name collisions and remains safe if a Reserved Font Name declaration is later discovered. The documentation must still identify 清松手写体 8 and Jason/Yu Ching Sung as the source.
5. Generate non-overlapping WOFF2 shards from one pinned build script and one manifest. The verified partition is:
   - `base`: `U+0000-02FF,U+2000-33FF,U+FE60-FE6F,U+FF00-FFEF` - 22,264 B
   - `han-1`: `U+3400-4DBF,U+4E00-6FFF` - 1,833,312 B
   - `han-2`: `U+7000-8FFF` - 1,729,096 B
   - `han-3`: `U+9000-9FFF` - 749,640 B
6. Declare four `@font-face` entries with one renamed family, matching `unicode-range`, `font-weight: 400`, `font-style: normal`, and `font-display: swap`. Do not synthesize bold or italic handwriting.
7. Preserve the union of the source cmap across the shards. Characters outside the original 9,461-code-point cmap fall through to the declared Kaiti/system fallback rather than rendering tofu. Do not ship a mockup-corpus-only subset for dynamic annotations.
8. Gate the generated assets on cmap-union equality, non-overlapping ranges, per-file size, WOFF2 parseability, name-table/copyright metadata, source and output hashes, 390x844 annotation rendering, and the release hard-budget headroom check.
9. Do not add these generated files to production until the release can retain at least 512 KiB below the 25 MiB hard cap after all shards and license material are included.

Official licensing/source checks:

- JasonHandwriting 1-9 are published by the author under SIL OFL: <https://github.com/jasonhandwriting/JasonHandwriting>
- LXGW WenKai Lite is published under SIL OFL 1.1 and requires the OFL text when redistributed: <https://github.com/lxgw/LxgwWenKai-Lite/blob/main/README.MD>
- SIL's official modification guidance requires the original copyright, exact license text, RFN declarations, and modified-version metadata to accompany redistribution: <https://openfontlicense.org/how-to-modify-ofl-fonts/>

The repository currently has no license file beside its local LXGW binary. If a valid LXGW build is ever bundled, its official OFL notice must be added to the third-party attribution area.

## 3. SVG Pictogram Inventory

### Home identity glyphs: custom geometry required

| Glyph | Geometry to reconstruct | Production rule |
| --- | --- | --- |
| Worlds | Offset orbital circles, one registration node, small central world mark | 48x48 viewBox, 32-38px optical size; no Saturn badge |
| Programme | Open black-box doorway/programme fold with an interrupted baseline | Primary Home destination; 42-48px optical size; no enclosing circle/card |
| Cast | Two reduced human/identity outlines with one small orbital registration mark | 34-38px optical size; not masks, quotation marks, or portrait badge |

The current prototype SVGs under `design-prototypes/cinema-home/assets-v3/icons/` belong to the earlier V3 direction (Saturn, ticket, arched figure). They are useful construction references but do not match the approved black-box Home and should not be promoted unchanged.

### Common functional glyphs

`back`, `forward/action`, `edit`, `location`, `ellipsis`, `registration-cross`, `orbital-mark`, and `diamond/star-marker` belong in one inline SVG registry. Use a 24x24 viewBox, `fill="none"`, `stroke="currentColor"`, 1.25px stroke at 24px, round caps/joins, and an 18-20px optical drawing area. Home destination glyphs may use a 48x48 grid with 1.1-1.25px strokes. Every functional control keeps at least a 44x44px hit target without drawing a visible circular badge.

Iconoir can supply construction geometry for ordinary back/location/ellipsis controls, but the final paths should be normalized into the Cinema registry. Programme, Worlds, Cast, the editorial action arrow, and the registration/orbital markers require custom geometry because they carry the product identity.

## 4. Ornament Inventory

| Ornament | Deterministic form | Placement contract |
| --- | --- | --- |
| Registration cross | Two 10-14px hairlines, optional center gap | Programme page corners and spread anchors only |
| Page/index number | Manrope micro-label, two digits | Section heads and Performance indices; never decorative random numbering |
| Thin rule | 1px currentColor at low alpha | Programme hierarchy and document fields |
| Oxblood registration tick | 18-32px rule segment | One emphasis point per section or lifecycle transition |
| Orbital circle | 1px SVG ellipse with at most two nodes | Home/Programme identity areas, not Reading prose |
| Small diamond | Four-point path or rotated square | Masthead/seam registration, not a repeated star field |
| Coordinate footer | Manrope micro-label + index | Programme/Programme Entry footer only |
| Section divider | Rule plus one centered or offset marker | Between editorial groups; no ornamental divider after every paragraph |

Density rule: at most three ornament groups in one 390x844 viewport. Paper screens use registration/index/rule language; theater screens use seam/orbit/diamond language; Reading uses only one restrained Act marker and occasional oxblood dash.

## 5. Color and Material Tokens

```css
:root {
  --cinema-black-1000: #050505;
  --cinema-black-950: #090909;
  --cinema-black-900: #11100f;
  --cinema-graphite: #1a1917;

  --cinema-oxblood-900: #2b0e13;
  --cinema-oxblood-800: #43151b;
  --cinema-oxblood-700: #62242a;
  --cinema-registration: #7b2a2d;

  --cinema-ivory-100: #f0ebe2;
  --cinema-ivory-200: #e7e0d5;
  --cinema-ivory-300: #d5cabb;
  --cinema-ink: #191715;
  --cinema-muted-ink: #706860;
  --cinema-muted-gold: #a88f60;

  --cinema-rule-on-paper: rgb(31 27 23 / 28%);
  --cinema-rule-on-dark: rgb(230 218 198 / 22%);
  --cinema-scrim-fill: rgb(232 224 208 / 72%);
}
```

Material application:

- Home: matte black wings -> recessed oxblood lining -> translucent ivory scrim/light.
- Programme/Entry: cool-warm ivory paper -> near-black ink -> tiny oxblood registration.
- Adaptation: near-black stage -> translucent ivory documents/scrim -> oxblood corrections.
- Before the Curtain: black textile/planes -> warm ivory type/light -> one thin oxblood seam.
- Reading: near-black field -> warm readable text -> minimal registration red.
- Intermission: black curtain/scrim -> warm ivory type -> one restrained transition mark.

Oxblood must remain behind or between black structure and partly visible through scrim. It is not a ruby fill, glow, glossy material, or default CTA background.

## 6. Raster Asset Requirements

No raster is functionally required.

| Mockup element | Raster status |
| --- | --- |
| Home wings, floor grid, scrim aperture, light seam | Deterministic CSS polygons/gradients/transforms; optional low-contrast material grain only |
| Programme paper | Existing 1,042 B tile is optional and usable; page geometry, fold, rules, and type remain HTML/CSS |
| Adaptation scrim/documents | CSS gradients, transparency, borders, and masks; no raster text or notes |
| Before-Curtain and Intermission cloth | CSS structure is sufficient for deterministic layout; an optional neutral fabric tile may add microtexture |
| World cover | Optional user/Mercury asset; otherwise deterministic `MercuryWorldFallback` |
| Reading environmental plate | Optional World/Scenario/Act/Scene presentation media; region collapses completely when absent |
| Existing red curtain PNG/WebP pair | Not compatible with the approved black-box material system; do not use as required presentation |
| Existing Aevoria map | A World material/content asset, not a World cover guarantee and not required for creation/play |

Exact photographic microtexture from the mockups cannot be pixel-identical across browsers without a raster material plate. Composition, hierarchy, lighting, hit regions, type, pictograms, and ornaments can and should be deterministic. Any optional raster must sit below semantic HTML and never contain functional text, icons, or hit regions.

## 7. Deterministic CSS/SVG Scope

Deterministic implementation owns all layout, stage-wing geometry, scrim geometry, paper/spread structure, fold/seam, masks, shadows, lighting gradients, floor perspective, focus states, typography, actions, icons, ornaments, empty fallbacks, crop masks, and dark tonal overlays.

Motion should be limited to material transitions:

- Route surface: 180-240ms opacity plus at most 4px translation.
- Curtain open/close: 850-1050ms transform/clip-path while retaining the existing callback timing contract.
- Programme paper/spread: no theatrical flourish; at most a 220ms opacity/position settle.
- Reading: static prose; no particles, pulsing, or continuous glow.
- `prefers-reduced-motion: reduce`: transition duration collapses to the existing short safe path; lifecycle callbacks still fire exactly once.

## 8. Optional Visual-Asset Metadata Boundary

Presentation imagery should be resolved through a separate, noncanonical interface:

```ts
type CinemaPresentationVisualRef = {
  id: string;
  ownerType: "world" | "performance" | "act" | "scene";
  ownerId: string;
  role: "world-cover" | "performance-cover" | "act-opening" | "scene-transition" | "ambient";
  source: "mercury" | "user" | "generated";
  assetRef: string;
  alt: string;
  crop?: { x: number; y: number; zoom: number };
  focalPoint?: { x: number; y: number };
  tonalPreset?: "cinema-dark" | "programme-muted" | "neutral";
  updatedAt: string;
};
```

Boundary rules:

1. The resolver returns `CinemaPresentationVisualRef | null`; every consumer must render completely when it returns `null`.
2. Do not add visual fields to `World Definition`, `Invariants`, `Default Experience Profile`, `Scenario`, `CharacterVariant`, `Scene`, `Segment`, continuity notes, or generation requests.
3. Do not reinterpret `materials[0]` as a cover. Current Stage `materials` are arbitrary content extras and historical Stage snapshots deliberately exclude them.
4. Future user replacement belongs in a presentation-only repository/database, not `mercury.cinema` canonical Instance storage. That repository is reserved, not implemented in the first slice.
5. The first slice implements only `CinemaPresentationMediaResolver` plus `MercuryWorldFallback`; it may accept explicitly registered Mercury assets and otherwise returns `null`.
6. Fixed crop, focal point, dark overlay, saturation ceiling, and contrast normalization are presentation transforms. They never alter source media or narrative state.

## 9. Mockup vs Current Capability Discrepancies

| Approved expectation | Current capability | First-slice treatment |
| --- | --- | --- |
| Home is a stable foyer with Programme/Worlds/Cast | Production `#renderLobby` currently embeds focused Performance metadata, Continue, Stage list, history, and tutorial | Replace presentation later; keep route/delegates; Home never reads Performance presentation data |
| Programme owns selection and Continue | Current Programme is embedded in Lobby; `#continueInstance` already preserves focus/lifecycle | Add pure `CinemaProgrammeProjection`; Programme rows call existing delegate unchanged |
| Stable Character x World/Stage grouping | No aggregate exists; Instances contain stable Character and Stage snapshot IDs | Derive group key only when both IDs exist; never persist projection; legacy missing IDs stay separate rather than falsely merged |
| Programme Entry | No dedicated grouped route | Add presentation route over projected Instances; historical snapshots remain source of titles/details |
| Worlds and Cast destinations | Static Stage catalog exists; Cinema reads Archive `runtimeProfiles`; production has one Stage | Worlds wraps catalog browse; Cast is a read-only bridge/list and delegates editing/creation to Archive |
| Scenario selection | Catalog supports scenarios, but UI uses first/default and has no selector | First slice uses existing selected/default Scenario; do not imply multi-scenario choice until implemented |
| Adaptation rehearsal notes are grounded | Character snapshot + Variant values exist; Archive analysis provenance and a separate Cinema Interpretation Override do not survive into the snapshot as distinct entities | Render stable traits/values/boundaries and real Variant fields. Hide margin annotations when no grounded note/override exists; do not manufacture director psychology |
| Before Curtain shows opening setup + shared history | Draft has Scenario/entry period and `sharedHistory`; current confirmation mixes more programme metadata | Present both in one ritual screen while keeping fields/actions separate; `openCurtain()` remains the only Instance creation boundary |
| Reading Act title and visual plate | `actNumber` and Scene title exist; no validated visual ref; default Instance creates one Scene | Text-only Reading is canonical. Optional plate resolver returns null by default. Use current Scene title, not invented Act subtitle |
| Intermission completed/next Act | Intermission currently changes status only. Pause/resume does not create or advance Scene; no next-Act domain event exists | Show current Act paused and Continue/Programme. Do not show a fabricated completed Act, next Act, or transition summary |
| Pending recovery | Durable pending identity and explicit retry already exist | Programme can expose the affected Performance; entering Reading shows retry. Never auto-resend from Home/Programme |
| Custom currentColor icons | Current app loads generic Iconoir SVGs through `<img>` and filter coloring | Introduce inline Cinema SVG registry; retain accessible button delegates |
| Approved dynamic Chinese typography | Current production subsets omit common approved-title and prose characters | Rebuild font packaging before visual lock; system fallback is only a temporary local baseline |
| Photographic red curtains | Existing rasters are bright, traditional, and semantically over-weighted | Remove from the approved black-box family when replacement lands; use deterministic dark planes/scrim |
| Presentation component boundary | `cinema-app.js` contains rendering and inline domain delegates in one controller | Extract only presentation builders/pure projections; keep Store/Workflow ownership and callback behavior unchanged |

Specific data caveat: `notes.overview` and continuity summary are story-derived records, not a canonical relationship summary. Programme and Programme Entry must not relabel them as relationship truth. `variant.sharedHistory` may be shown when explicitly present; otherwise that copy region collapses.

## 10. Smallest First-Vertical-Slice Order

1. **Foundation package.** Add Cinema tokens, material surfaces, inline SVG glyph registry, ornament primitives, and 390x844 visual-test harness. Resolve dynamic font packaging before claiming typography parity.
2. **Approved Home presentation.** Replace only the foyer DOM/CSS with stable Programme/Worlds/Cast destinations. Preserve app entry/readiness handling and keep `#continueInstance` intact but unused by Home.
3. **Programme projection and screen.** Implement a pure `CinemaProgrammeProjection` from `snapshot().instances`, focus, and timestamps; add active/empty Programme states; make Programme the owner of Continue and explicit pending entry.
4. **Programme Entry.** Add Character x Stage grouped detail, multiple unfinished reachability, read-only historical snapshots, and new-performance entry through the current Stage flow.
5. **Static Worlds and Cast bridges.** Re-present the existing Stage catalog and Archive runtime profiles. Add deterministic World fallback; do not add editable World or required images.
6. **Adaptation and Before Curtain.** Restyle the existing prep/Variant/confirmation sequence with grounded fields; keep Scenario/Shared History separate; delegate opening to the existing curtain lifecycle.
7. **Text-first Reading.** Restyle current Scene/Segment/composer/menu while preserving Workflow send/retry/cancel and pending suppression. Add a null-safe presentation-media resolver but no uploader or generator.
8. **Intermission transition.** Restyle current explicit pause/resume and Programme return. Defer completed/next-Act semantics until a real Act/Scene progression use case exists.
9. **End-to-end closure.** Exercise `Home -> Programme -> World/Stage -> Character -> Adaptation -> Before the Curtain -> Reading -> Intermission -> Programme -> Continue` at 390x844 and keyboard viewport, including multiple unfinished, pending reload, no-image, reduced-motion, and historical-snapshot cases.

Ending/Credits behavior remains unchanged in this slice. Editable World architecture, broad image management, automatic AI imagery, Act progression, and Phase 2D contract changes remain out of scope.

## Approval Record

- Component, material, token, pictogram, and ornament normalization: approved.
- `JasonHandwriting8` / 清松手写体 8 as the annotation-only visual target: approved; production packaging remains blocked by the font build and release-headroom gates above.
- Presentation-only optional media boundary and complete no-image fallback: approved.
- Intermission limitation: approved; visual pause/return now, true next-Act semantics only after a real runtime transition event exists.
- Fidelity rule: deterministic approved geometry and micro-elements must be reconstructed rather than simplified or redesigned. Texture/noise and optional imagery are perceptual, not pixel-identical, requirements.
- Implementation sequencing: shared foundations first, then Programme Entry, Adaptation, and Home as representative approval gates before family propagation.
