# Record Cabinet UI-01 design QA

Date: 2026-08-17

User visual confirmation: approved on 2026-08-18.

## Scope

- Reference: machine-local design reference, Page 1 Record Cabinet; the source file is not a repository dependency.
- Implementation: Mercury's real phone shell, 390 × 844 px, at `http://127.0.0.1:5500/?passcode=2468`.
- Final phone screenshot: `artifacts/record-cabinet-ui01.png`.
- Combined reference/implementation comparison: `artifacts/record-cabinet-ui01-comparison.png`.
- Test state: the real shared Generation Profile store, containing 1 Mercury Profile, 2 user Profiles, and 0 imported Profiles. No demo records were fabricated to match the board.

## Visual comparison

- Information hierarchy: passed. The Archive eyebrow, title/new action, source jump index, three numbered shelves, horizontal collection rails, and bottom archive note preserve the reference's spatial order.
- Sleeve/record structure: passed. Every record uses an explicit 92 × 92 px square sleeve and an independent 86 × 86 px circular vinyl layer. The visible vinyl edge reads as stored behind the sleeve instead of a generic card decoration.
- Typography and spacing: passed. Existing Mercury serif/editorial hierarchy and spacing tokens are reused; no page-level screenshot tracing or brittle absolute page layout was introduced.
- Color and materials: passed. Existing cold silver-blue Mercury tokens, restrained borders, rails, and shadows are used. User covers retain their actual colors instead of receiving a forced blue filter.
- Controls: passed. The rejected floating cover ellipsis is absent. Dedicated square create/import sleeves stay in their corresponding shelves. Current-use state remains subordinate to the cover.
- Responsive phone behavior: passed. The page is a real vertical scroll and each shelf is a horizontal collection. The 350 px guard preserves usable margins.
- Image quality: passed. Covers and vinyl are real raster assets; no placeholder, CSS art, emoji, or handcrafted SVG was introduced.

## Interaction verification

- MERCURY / MINE / IMPORTED source index remains a same-page shelf jump.
- Clicking a record begins a short sleeve/vinyl extraction transition, then opens the existing detail/editor route.
- Reduced-motion users bypass the transition delay.
- Long-press, context menu, and Shift+F10 expose the existing management sheet without restoring a floating CRUD menu.
- Mine always exposes `制作新唱片`; Imported always exposes `导入档案` and reuses the existing resource detector.
- Built-in `preset-default` remains read-only and Remix-only; shared store/runtime contracts were not changed.

## Browser and regression checks

- Browser console warnings/errors: none.
- Measured first sleeve: 92 × 92 px.
- Measured first vinyl: 86 × 86 px.
- Dedicated action sleeves: 2.
- `node --check app/apps/archive-app.js`: passed.
- Targeted Archive tests: passed.
- `npm test`: 46 files, 1337 assertions, 0 skipped, 0 failures.

## Intentional differences

- The design board uses illustrative sample quantities; implementation displays only actual store contents.
- The approved product decision uses true 1:1 LP sleeves, while the older annotated board drew portrait sample covers.
- On a real 390 × 844 phone shell, lower content is reached by scrolling rather than compressing the three shelves.
- Profile Detail, Pressing Room, Workbench, inheritance, model parameters, Advanced UI, and Playback remain outside UI-01.

## Finding history

- P1, fixed: the prior portrait sleeve plus half-record card composition contradicted the approved LP structure.
- P1, fixed: the prior floating ellipsis made the collection read as a CRUD card grid.
- P2, fixed: source labels repeated on every sleeve even though the shelf already owns source identity.
- P3, accepted: the archive note is partly below the first 844 px viewport when real store content grows; vertical scrolling is intentional.
- Current comparison contains no open P0, P1, or P2 visual issue.

final result: passed and user-approved

---

# Cinema Reading composer visual correction

Date: 2026-08-21

## Scope and evidence

- Visual source: machine-local Cinema Reading reference; the source file is not a repository dependency.
- Real viewport: 390 × 844 px at `http://127.0.0.1:5500/?passcode=2468`.
- Collapsed state: `artifacts/cinema-reading-composer-collapsed-390x844.png`.
- Expanded and focused state: `artifacts/cinema-reading-composer-expanded-focused-390x844.png`.
- Keyboard-occupied visual viewport simulation: `artifacts/cinema-reading-composer-keyboard-viewport-390x520.png`.
- Source/implementation comparison: `artifacts/cinema-reading-composer-comparison.png`.

## Visual comparison

- Reading typography, paper background, header, prose hierarchy, and page structure remain unchanged.
- Collapsed state preserves the approved quiet writing cue. The placeholder is subordinate to prose and the sole manuscript cue is a small upward caret.
- Expanded state uses the existing paper directly: transparent surface, transparent border, zero radius, no left message icon, and no card-like white container.
- The submit affordance is a 28 px transparent target with a 14 px thin arrow. Its opacity rises from 0.14 to 0.7 only after text exists.
- The textarea grows naturally to 252 px. Beyond that point it changes to internal scrolling; a 1,384-character QA passage measured 252 px client height and 1,534 px scroll height.
- Composer clearance tracks the writing height and scrolls the prose end above a resized keyboard viewport instead of allowing story text to sit beneath the writing area.

## Interaction and regression checks

- Focus is communicated by the native caret; textarea border, outline, and background all compute to transparent/none.
- Placeholder copy is exactly `轮到你了，写下接下来发生的事…`.
- Submission blurs the textarea, hides the composer before generation, and lets the existing workflow place the user passage into prose flow.
- Browser console warnings/errors: none.
- `node --check app/apps/cinema-app.js`: passed.
- `npm test`: 64 files, 1,974 assertions, 0 skipped, 0 failures.

## Finding history

- P1, fixed: expanded composer previously read as a bordered form card with a high-weight circular submit control.
- P1, fixed: the initial correction referenced a missing arrow asset and inherited a red generic focus outline.
- P2, fixed: long writing was height-capped while overflow remained hidden.
- P2, fixed: the first reduced-height QA left prose underneath the composer; dynamic clearance plus delayed keyboard settling now keeps the writing end visible.
- P3, QA limitation: the desktop in-app browser cannot render a mobile operating-system keyboard inside its tab screenshot. The focused 390 × 844 capture is therefore paired with a real 390 × 520 resized visual-viewport capture; final native keyboard/chrome appearance remains a physical-device check.
- Current source/implementation comparison contains no open P0, P1, or P2 visual issue.

final result: passed with one physical-device keyboard screenshot pending
