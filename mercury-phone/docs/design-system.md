# Mercury OS Visual System V2

Reference: `../assets/references/mercury-os-visual-direction-v2.png`.

## Design read

Young, intimate, high-key editorial mobile OS with cold silver mercury glass, rain-window photography, abstract line icons, and restrained cyan/coral state color.

## Fixed decisions

- Device viewport: 390 x 844.
- Icon family: local Iconoir SVG only.
- Primary accent: icy cyan.
- Notification accent: pale coral, used only for semantic attention.
- Shape system: soft panels at 23px, controls at 16px, circular icon controls where required.
- Glass is selective. Wallpaper, type, and spacing remain visible without a glass container around every region.
- Use the supplied rain-window leaves photograph for the initial shell; later wallpaper variants must share the same photographic language.

## Typography

- The visual voice is light, narrow, and quiet. The date line in the selected
  lock-screen direction is the weight reference for the wider system.
- Use a locally hosted open font for cross-platform consistency, with Manrope
  Light/Regular as the leading candidate; keep the native system stack as fallback.
- Default UI weight is 300 or 400. Weight 500 is reserved for small state labels
  that need contrast. Avoid 600+ in normal interface copy.
- Large time and display values use weight 200-300 with tight optical spacing.
- Hierarchy should come from size, spacing, opacity, and alignment instead of bold text.

## Initial Iconoir vocabulary

Abstract system identity uses `spark`, `flower`, `planet`, and `view-grid`. Functional controls use the closest semantic Iconoir glyph without mixing another family.

## System component primitives

- `MercurySystemComponents` is the single DOM factory for shared controls.
- Available primitives: Iconoir icon, circular icon button, glass panel, list and row, switch, app icon with badge, and circular keypad key.
- Controls use native buttons, visible keyboard focus, accessible labels, and tactile pressed states.
- Glass is a Web approximation built from blur, translucent fill, highlights, and borders; it is not Apple's native Liquid Glass implementation.
- Reduced-motion and reduced-transparency preferences receive non-animated or opaque fallbacks.
