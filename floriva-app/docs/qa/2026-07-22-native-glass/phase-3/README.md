# Phase 3 evidence — Sticky Glass Collapse Header

Captured on iPhone 17 Pro simulator, iOS 26.4, from a local Xcode debug build
(`expo run:ios`, `Floriva` scheme) that links the `ExpoGlassEffect` native module.

## What this shows

- `today-01-rest-editorial-header.png` — Today at scroll offset 0. The editorial
  large-title header (`TODAY` / **Floriva**, Newsreader serif) is the title; **no
  pinned bar is shown**. This is the intended at-rest state.
- `today-02-pinned-glass-revealed.png` — after scrolling the editorial header off.
  The pinned Liquid Glass collapse bar has faded in: compact **Floriva** title,
  centered, with a hairline bottom edge, refracting the content scrolling beneath
  it. Today has no back action, so the bar shows the title only.

## Behavior verified on-device

- Bar hidden + non-interactive + a11y-hidden at rest; fades in past the editorial
  header height; hides again on scroll-to-top.
- Real iOS 26 `UIGlassEffect` renders (not the solid fallback) — content is visible
  through the bar.
- No crash from the previously-absent native module (guarded `GlassSurface`).

## Gate outcome (2026-07-22, 5-lens adversarial panel)

No P0 blockers. ui-fidelity + accessibility **passed**. Fixed before closing Phase 3:
- **P1 (test):** the FlatList/`virtualizedList` reveal path was uncovered even though
  `PrivateTimelineScreen` uses it — added a Screen integration test that scrolls the
  FlatList and asserts the bar reveals, plus an onLayout-threshold-measurement test.
- **Correctness/a11y:** the pinned bar seeded its revealed state from offset 0, so a
  Screen mounted pre-scrolled (`CalendarScreen`) showed the bar opaque yet
  non-interactive + screen-reader-hidden until the first scroll. Now seeded from the
  host's `initialScrollOffset` and re-derived on threshold change.
- **A11y:** added `accessibilityLabel` to the sticky back control (chevron glyph was
  voiced literally).

## Open observation — weak glass frost on the SIMULATOR (needs physical-device sign-off)

`today-03-pinned-glass-tinted.png` adds `tint={theme.glass.tint.regular}` (a warm paper
wash) to the pinned bar. On the **simulator this changes almost nothing**: GlassView's
`tintColor` is a color *hue*, not an opacity backing, and the sim under-renders the
Liquid Glass *blur* that actually frosts content beneath the bar. So the pinned
"Floriva" title and the large "RIGHT NOW / 25" numeral still share one visual plane in
these captures.

This is judged a **simulator rendering limitation**, not an implementation defect:
- `regular` is already the strongest available `GlassStyle` (`clear` is lighter; there
  is no thicker option).
- The Android / iOS<26 / reduce-transparency paths use a **solid** paper fallback and
  are fully legible.
- On a real iOS 26 device the `regular` blur frosts the numeral into a soft wash,
  which is what separates chrome from content.

Deliberately NOT adding an opaque backing (it would fight the Liquid Glass aesthetic).
**Action:** confirm the figure/ground separation on a physical iOS 26 device; only if it
still reads busy there, revisit (e.g. a heavier tint or a translucency-aware backing).
