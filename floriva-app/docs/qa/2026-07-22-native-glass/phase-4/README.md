# Phase 4 evidence — Buttons & FABs → Glass fixed footer

## Expansion-task finding (2026-07-22)

The literal Phase 4 targets don't exist in this app: `ActionButton`'s `glass`
appearance is **dead** (used nowhere) and there are **no FABs**. Per the refresh's
rule ("glass only where a control floats over content"), the genuine floating chrome
is the **fixed footer** (`footerPlacement="fixed"`, used by 11 onboarding/import
screens) — the analogue of the tab bar and sticky header. Decision: make the fixed
footer a Liquid Glass surface; keep the action buttons **solid** for prominence
(primary CTA legibility beats trendiness).

## What shipped

- `Screen.tsx` fixed footer now renders a non-interactive `GlassSurface` backdrop
  (`material="regular"`, warm tint, `pointerEvents="none"`) filling the footer; the
  footer container dropped its solid `backgroundColor` so content refracts beneath.
  The measured/testID container, paddings, and top hairline are unchanged, so
  content-clearance and existing footer tests are unaffected. Action buttons stay solid.
- Degrades to the solid paper fallback off iOS 26 (Android / iOS<26 / reduce-transparency).

## Evidence

- `fixed-footer-glass-onboarding.png` — onboarding start-path screen (a fixed-footer
  screen) on iPhone 17 Pro / iOS 26.4. The bottom action bar shows solid Back/Continue
  over the glass backdrop with a clean top hairline. Content here is short, so the glass
  refracts the static background (subtle by design); on longer scrolling forms it
  refracts the content passing under it. No layout regression; buttons stay prominent.
