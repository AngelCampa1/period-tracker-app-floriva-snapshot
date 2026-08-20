# Phase 5 evidence — Surfaces & Sheets → Glass HelpTooltip sheet

## Expansion-task finding (2026-07-22)

Phase 5 listed `SectionCard`, `MotionPressableSurface`, `TodaySummaryCard`, and the
privacy/info modals. But these are **readability-critical content surfaces** carrying
sensitive reproductive data and explanatory text. CLAUDE.md ("calm, clarity, trust";
"treat all reproductive data as highly sensitive") and the plan's own rule ("solid for
readability-critical content surfaces; glass only where the surface overlays content")
mean **these must stay solid** — glass there would be form-over-function and hurt
legibility. Forcing glass onto them is deliberately NOT done.

The one genuine floating-overlay surface is the **HelpTooltip bottom sheet** (a short
title + one paragraph that slides up over dimmed content — not a long readable block).
That is the correct, tasteful Phase 5 glass target, consistent with the tab bar, sticky
header, and footer.

## What shipped

- `HelpTooltip` sheet is now a `GlassSurface` (`material="regular"`, warm tint) over the
  dimmed backdrop; dropped its solid `backgroundColor` so it reads as a floating glass
  overlay. Rounded top, grabber, title/body, and the solid accent Close button are
  unchanged. Degrades to the solid paper fallback off iOS 26.
- Content surfaces (cards, rows) and the text-heavy info/privacy modals intentionally
  remain solid for legibility of sensitive content.

## Evidence

- `help-tooltip-glass-sheet.png` — the "Fertile window" help sheet on iPhone 17 Pro /
  iOS 26.4: a Liquid Glass sheet rendered inside a transparent RN Modal, sliding up over
  the dimmed Today screen. Title + body fully legible; Close button solid. Confirms
  glass renders correctly inside a Modal (no crash, no readability loss).
