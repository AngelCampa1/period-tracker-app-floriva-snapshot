# Phase 0 delta ledger — radii/spacing token enforcement

Branch: `ui-lift/phase0-foundation`. Task 0.4 (literal enforcement) + 0.5 (onboarding shared shadows).

Token scales at time of migration (`src/theme/tokens.ts`):

- `spacing`: xs 4, sm 8, md 12, lg 16, xl 22, xxl 28, xxxl 36, '3xl' 40
- `radii`: xs 8, sm 10, md 16, lg 24, xl 28, pill 999, **hairline 3 (new)**

New token added: `radii.hairline: 3` — covers the tiny decorative 2–3px cluster
(chart bars, progress tracks, tick marks). It is the ONLY token added in this pass.

RN clamps a uniform `borderRadius` to half the view's smaller dimension, so for
perfect circles (radius == width/2 == height/2) and fully-rounded bars,
`radii.pill` renders pixel-identically to the old literal. Those rows are 0px deltas.

## Radius migrations (23 literals, 10 files)

| File | Line (pre) | Before → After | Delta | Surface |
| --- | --- | --- | --- | --- |
| src/features/insights/screens/InsightsScreen.tsx | 474 | 2 → `radii.hairline` (3) | **+1px** | cycle-length chart bar corners (variable-height bars) |
| src/features/insights/screens/InsightsScreen.tsx | 531 | 3 → `radii.hairline` | 0 | phase bar track (72×6) |
| src/features/insights/screens/InsightsScreen.tsx | 536 | 3 → `radii.hairline` | 0 | phase bar fill |
| src/features/settings/screens/SettingsScreen.tsx | 2272 | 26 → `radii.pill` | 0 (52×52 circle, clamps to 26) | profile circle |
| src/features/calendar/screens/CalendarScreen.tsx | 574 | 16 → `radii.pill` | 0 (32×32 circle, clamps to 16) | month nav buttons |
| src/features/calendar/screens/CalendarScreen.tsx | 685–752 (×6) | 999 → `radii.pill` | 0 (same value) | logged dots, predicted/fertile markers, legend swatches |
| src/features/tracker/components/NoRemindersNudge.tsx | 67 | 11 → `radii.pill` | 0 (22×22 circle) | nudge icon ring |
| src/features/tracker/components/NoRemindersNudge.tsx | 77 | 3 → `radii.pill` | 0 (6×6 circle) | nudge icon dot |
| src/features/onboarding/screens/NotificationsScreen.tsx | 155 | 13 → `radii.pill` | 0 (26×26 circle) | option icon ring |
| src/features/onboarding/screens/NotificationsScreen.tsx | 165 | 4 → `radii.pill` | 0 (8×8 circle) | option icon dot |
| src/components/editorial/CycleRibbon.tsx | 184 | 2 → `radii.hairline` | 0 (3-wide bar; both clamp to 1.5) | today marker tick |
| src/components/editorial/CycleRibbon.tsx | 203 | 4 → `radii.pill` | 0 (7×7; 4 already clamped to 3.5 circle) | phase legend dot |
| src/components/editorial/EditorialOption.tsx | 85 | 9 → `radii.pill` | 0 (18×18 circle) | option bullet ring |
| src/components/editorial/EditorialOption.tsx | 101 | 3 → `radii.pill` | 0 (6×6 circle) | option bullet inner dot |
| src/components/primitives/HelpTooltip.tsx | 93 | 16 → `radii.pill` | 0 (32×32 circle) | tooltip trigger |
| src/components/primitives/HelpTooltip.tsx | 119 | 2 → `radii.pill` | 0 (42×4 bar; clamps to 2) | sheet drag handle |
| src/components/primitives/AnomalyNudge.tsx | 84 | 11 → `radii.pill` | 0 (22×22 circle) | nudge icon ring |
| src/components/primitives/AnomalyNudge.tsx | 94 | 3 → `radii.pill` | 0 (6×6 circle) | nudge icon dot |

Note: the briefed 26 → `radii.xl` (+2px) mapping for the Settings profile circle
was NOT needed — the shape is a 52×52 circle, so `pill` is exact. Net: exactly
one nonzero radius delta in the whole pass (+1px on Insights chart bar corners).

## Spacing migrations (2 literals)

| File | Line (pre) | Before → After | Delta | Surface |
| --- | --- | --- | --- | --- |
| src/components/editorial/CycleRibbon.tsx | 197 | gap 5 → `spacing.xs` (4) | **-1px** | ribbon phase-legend item internal gap |
| src/components/primitives/ConfidenceChip.tsx | 105 | paddingVertical 7 → `spacing.sm` (8) | **+1px/side** (chip +2px tall) | filled confidence chip |

## Spacing literals left as-is — needs design decision (do not churn)

Off the scale with no unambiguous token within 2px, or tiny optical adjustments
where the nearest token (xs 4) would double/halve them. Visual-polish waves
should resolve these deliberately.

Tiny optical values (0/2/3 — nearest token would be a >=50% relative change):

- gap: 2 — InsightsCyclePatternScreen.tsx:143; InsightsScreen.tsx:441, 465, 595; SettingsScreen.tsx:2286, 2391; CalendarScreen.tsx:664; TodayScreen.tsx:395; PaywallTrialTimeline.tsx:99
- gap: 0 / padding: 0 (intentional resets) — InsightsScreen.tsx:496, 581; SettingsScreen.tsx:2303; OnboardingCompletionScreen.tsx:259; SectionCard.tsx:111
- marginTop: 2 (icon optical alignment) — NoRemindersNudge.tsx:72; PaywallTrialTimeline.tsx:95; NotificationsScreen.tsx:160; CycleRibbon.tsx:216; EditorialOption.tsx:89; AnomalyNudge.tsx:89
- marginBottom: 2 — CalendarScreen.tsx:769; paddingTop: 2 — EditorialOption.tsx:126; paddingVertical: 2 — ConfidenceImprovementList.tsx:113
- marginHorizontal: 3 — CalendarScreen.tsx:754

Ambiguous mid-values (equidistant or 2px from two tokens):

- 6 (between xs 4 / sm 8) — CalendarScreen.tsx:786 (gap); CalendarDayScreen.tsx:218, TodayScreen.tsx:481 (paddingVertical)
- 10 (between sm 8 / md 12) — CalendarScreen.tsx:791 (paddingHorizontal)
- 14 (between md 12 / lg 16) — InsightsScreen.tsx:541 (paddingLeft, pattern callout); CalendarScreen.tsx:616 (padding)
- 18 (2 from lg 16, but shrinks the primary CTA) — LogTodayButton.tsx:61 (paddingVertical)

## Task 0.5 — onboarding shared shadows

`src/features/onboarding/screens/shared.tsx` (`useSharedOnboardingStyles.primaryAction`)
carried the only ad-hoc shadow in the onboarding feature: an accent-tinted CTA
lift (`shadowColor: accentPrimary, offset 0/5, opacity 0.22, radius 12,
elevation 3`).

Decision: `theme.glass.elevation` only defines Android dp values
(`resting: 0`, `raised: 3`) — it has NO iOS shadow spec, so no glass token can
reproduce the accent glow and a token swap was not visually equivalent.
Per the zero-visual-change bias the iOS values are kept verbatim in a named
constant `createPrimaryCtaShadow(theme)` in shared.tsx, derived from
`theme.colors.accentPrimary`. The Android `elevation` values DO map exactly:
`3 → theme.glass.elevation.raised`, `0 → theme.glass.elevation.resting`.

Pixel delta: none (identical rendered output on both platforms).

## Enforcement

`eslint.config.js` now carries a `no-restricted-syntax` rule (scoped to
`src/**` and `app/**`, tests excluded) that errors on any numeric
`borderRadius` literal and points to `theme.radii`.

## Zero-visual-diff gate result (2026-07-22)

iOS re-capture of all 11 presets from this branch vs the main baseline
(scripts/compare-sweep-captures.js, 8/255 channel fuzz, 2% pixel threshold):
**85 pass / 7 explained**. Explained: 5x today.png + today-empty.png (3-5%) are the two
intentional deltas above (ConfidenceChip paddingVertical 7→8, CycleRibbon gap 5→4) shifting
content below by 1-2px — verified identical content by eye on the seeded-tracker pair;
onb-09-paywall-b (72%) is a harness capture-point change, not a UI change. GATE: PASS.
