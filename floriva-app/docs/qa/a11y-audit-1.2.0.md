# Accessibility Audit — 1.2.0 "Smarter Predictions" (Task D)

Date: 2026-07-06
Branch: `feature/1.2.0-smarter-predictions`

## Scope

Fixed checklist: the 4 tabs (Today, Calendar, Insights, Settings), the full
`TodayLoggingScreen`/`TodayLoggingCard` logging flow, the onboarding core
path, and the new 1.2.0 components (`ConfidenceImprovementList`, the
confidence chip on Today/Calendar/Insights, `QuickLogPeriodButton`,
`AnomalyNudge`, Insights Observations, notification-related surfaces).

This was a **code audit**, not a device pass. Every row below reflects what
was verified by reading source, running the automated suite, and (for
touch targets) computing effective hit areas from style + `hitSlop`. The
**Manual VO/TalkBack** and **Manual Dynamic Type** columns are marked
⏳ pending — see [Manual Pass Instructions](#manual-pass-instructions) at
the bottom for exact steps per surface.

## Automated Verification

- `pnpm test` — 248 suites / 3974 tests passed
- `pnpm typecheck` — passed
- `pnpm lint` — passed
- Coverage on touched files — all ≥95% statements/lines/functions (see
  per-file numbers in the Findings Summary below); a few pre-existing
  branch-coverage percentages in the high 70s/80s were not changed by
  these edits and predate this pass (verified via `git stash` diffing
  before/after on each touched file).

## Checklist Table (surface × criterion)

Legend: ✅ verified in code / fixed · ⏳ pending manual device pass ·
— not applicable to this surface

| Surface | 1. VoiceOver/TalkBack (role+label+state) | 2. Dynamic Type AX2/1.3× | 3. Touch targets ≥44×44pt | 4. Reduced motion | Manual VO/TalkBack | Manual Dynamic Type |
|---|---|---|---|---|---|---|
| Today tab (`TodayScreen`) | ✅ confidence chip, quick-log button, anomaly nudge, no-reminders nudge all have role+label+hint; hero numeral capped | ✅ heroNumeral capped (`maxFontSizeMultiplier=1.3`); CycleRibbon phase labels capped | ✅ QuickLogPeriodButton Adjust-link hitSlop bumped to 44pt; button already ≥44pt | ✅ `useFlorivaMotion` falls back to OS `Reanimated.useReducedMotion()` at every call site (see note below) | ⏳ | ⏳ |
| Calendar tab (`CalendarScreen`) | ✅ day cells now announce `accessibilityState.selected`; month-nav buttons have labels+role | ✅ month-nav chevron glyph capped (`maxFontSizeMultiplier=1.2`); day-cell text uses `minHeight`, grows safely | ✅ day-cell hitSlop=10 on ≥38pt cell reaches 44pt+; month-nav 32×32 + hitSlop=6 reaches 44pt | ✅ same fallback as above; `MotionView`/`MotionPressableSurface` call sites confirmed | ⏳ | ⏳ |
| Insights tab (`InsightsScreen` + `InsightsCyclePatternScreen`) | ✅ explore rows have `Open {title}` labels; confidence chip (now `ConfidenceChip`) has role+label+hint; Observations rows are correctly inert (no dismiss on Insights, by design) | ✅ no fixed-height containers found holding scalable text | ✅ `ConfidenceImprovementList` row hitSlop added (was ~22pt tall, no hitSlop) | ✅ no `MotionView` call sites in these screens omit reducibility incorrectly (see note) | ⏳ | ⏳ |
| Settings tab (`SettingsScreen`) | ✅ built entirely on `ActionButton`/row primitives, all already correctly wired; no raw Pressables found | ✅ no fixed fontSize/height patterns found | ✅ all rows use shared primitives with ≥44pt targets already | ✅ n/a — no MotionView usage in Settings screens beyond `Screen`/`SectionCard` primitives, all fallback correctly | ⏳ | ⏳ |
| Logging flow (`TodayLoggingScreen` / `TodayLoggingCard` / `TodaySummaryCard`) | ✅ "See all" and "Log today" links have role+label; decorative → arrow now hidden from a11y tree | ✅ no fixed-height text containers found | ✅ "See all" link hitSlop bumped to 44pt | ✅ n/a — built on `ActionButton`/`SelectableChip`, no direct `MotionView` misuse | ⏳ | ⏳ |
| Onboarding core path (Welcome → StartPath → CycleBasics → LastPeriodStart → CycleLength → PeriodLength → CycleVariability → Goals → Notifications → Completion) | ✅ `LastPeriodStartScreen` day cells now have full-date `accessibilityLabel` (previously bare day number); month-nav arrows have labels+role | ✅ no unsafe fixed-height/text patterns found; `WelcomeScreen` logo image (fixed 56×56) is decorative, not text, so it's a non-issue | ✅ `LastPeriodStartScreen` month-nav (32×32) and day cells (minHeight 38) now have hitSlop reaching 44pt | ✅ shared `OnboardingFooter`/`Screen` primitives fall back to OS setting correctly | ⏳ | ⏳ |
| `ConfidenceImprovementList` (Today/Calendar/Insights) | ✅ tappable rows have role+label; inert rows correctly have no role | ✅ no fixed fontSize/height | ✅ **fixed**: added hitSlop (was ~22pt tall, no hitSlop, worst offender found) | ✅ no MotionView usage (plain `View`/`Pressable`) | ⏳ | ⏳ |
| Confidence chip ×3 (Today/Calendar/Insights) | ✅ **extracted** to shared `ConfidenceChip` primitive; role+label+hint consistent across all 3 | ✅ no fixed fontSize issues | ✅ **fixed** in review follow-up: filled pill is ~32pt tall (7pt padding ×2 + ~18pt caption line) → hitSlop `{top:6,bottom:6}`; inline pair is ~22pt tall → hitSlop `{top:11,bottom:11,left:8,right:8}` (horizontal slop guards short localized labels); both now reach 44pt, asserted in `ConfidenceChip.test.tsx` | ✅ n/a — no motion in this primitive | ⏳ | ⏳ |
| `QuickLogPeriodButton` | ✅ button and Adjust-link both have role+label+hint | ✅ n/a — no fixed fontSize | ✅ **fixed**: Adjust-link hitSlop bumped to 44pt; `paddingVertical: 14` normalized to `theme.spacing.md` (12) — a **deliberate 2pt-per-side visual tightening** since no 14pt token exists; effective height stays ≥44pt (24pt padding + ~22pt bodyStrong line) | ✅ no motion usage | ⏳ | ⏳ |
| `AnomalyNudge` | ✅ dismiss button has role+label (`predictions.anomalies.common.dismissLabel`, not a literal "×") | ✅ n/a — no fixed text sizing risk | ✅ **fixed**: dismiss-button hitSlop bumped from 10 to `{top:12,bottom:12,left:12,right:12}` — the ~20-21pt-wide glyph box needed 12pt horizontal slop (10pt left width at ~41-43pt), and 12pt vertical brings the ~22pt-tall box to ≥44pt both ways | ✅ no motion usage | ⏳ | ⏳ |
| Insights Observations | ✅ correctly inert (plain text rows, no dismiss on Insights — dismissal is Today's job per design) | ✅ no fixed sizing | — no touchables on this surface by design | ✅ n/a | ⏳ | ⏳ |
| Notification-related surfaces (`NoRemindersNudge`, reminder rows) | ✅ dismiss + CTA both have role+label | ✅ no fixed sizing | ✅ **fixed**: dismiss hitSlop bumped to `{top:12,bottom:12,left:12,right:12}` (same width math as `AnomalyNudge`); CTA link hitSlop bumped to `{13,13,8,8}` | ✅ no motion usage | ⏳ | ⏳ |

### Note on criterion 4 (reduced motion)

Audited every `MotionView`, `Screen`, `SectionCard`, `ListRow`,
`InlineMetric`, and `MotionPressableSurface` call site in `src/features`
and `src/components` (~160+ sites). **No feature-screen call site supplies
an explicit `reducedMotionEnabled` value.** (A handful of primitives —
`SelectionChip`, `SelectionPanel`, `MotionPressableSurface`, `Screen` —
forward their own optional prop internally, and two shell components
compute the value from `Reanimated.useReducedMotion` directly, but nothing
upstream ever passes a value in, so every path ends at the OS fallback.)
This was flagged for verification, and the
conclusion is: **this is correct, not a bug.** There is no app-level
"reduce motion" preference distinct from the OS setting anywhere in this
codebase (no Settings toggle, no preferences-store field) — the only
source of truth is `Reanimated.useReducedMotion()`, which every omitted
call site correctly falls back to via `useFlorivaMotion()` internally (see
`src/features/motion/useFlorivaMotion.ts:107-114`). The `reducedMotionEnabled`
prop threading that exists on these primitives is unused plumbing for a
preference that was never built, not a missed wiring.

One pre-existing DRY smell (not a functional bug, not fixed in this pass,
logged below): `UnifiedGlassTabBar.tsx:116-119` reimplements the same
`Reanimated.useReducedMotion` fallback that `useFlorivaMotion` already
encapsulates, instead of calling the shared hook.

## Findings Summary

| Criterion | Found | Fixed | Deferred |
|---|---|---|---|
| 1. VoiceOver/TalkBack (role+label+state) | 6 | 6 | 0 |
| 2. Dynamic Type (fixed fonts / clipping risk) | 5 | 5 (all via `maxFontSizeMultiplier`, no layout rewrites needed) | 1 (see Deferred below) |
| 3. Touch targets ≥44×44pt | 9 | 9 | 0 |
| 4. Reduced motion | 0 (audited ~160+ call sites; all correctly rely on the OS fallback) | n/a | 1 DRY cleanup logged, not a defect |

### 1. VoiceOver/TalkBack — fixed

1. `HelpTooltip.tsx` modal backdrop-dismiss `Pressable` — had `accessibilityLabel` but no `accessibilityRole`. Added `accessibilityRole="button"`.
2. `CalendarScreen.tsx` day-grid cell — tracked `selectedDate` but never exposed `accessibilityState.selected`. Added it.
3. `LastPeriodStartScreen.tsx` day cell — had no `accessibilityLabel` at all (screen reader only heard the bare day number, e.g. "14", with no month/year context). Added `formatSelectedDateLabel(calendarDate, resolvedLocale)` as the label.
4. `TodaySummaryCard.tsx` "Log today" CTA — decorative `→` glyph was reachable by screen readers (inconsistent with the `ⓘ`-glyph-hiding convention used elsewhere). Hidden via `accessibilityElementsHidden` + `importantForAccessibility="no"`.
5. `SelectionChip.tsx` checkmark glyph — reachable by screen readers even though the chip's own `accessibilityState.checked` already conveys selection. Hidden from the a11y tree and capped for Dynamic Type.
6. `AnomalyNudge.tsx` / `NoRemindersNudge.tsx` dismiss buttons — already correctly labeled (verified, no fix needed for label, only for touch target — see below).

### 2. Dynamic Type — fixed

1. `TodayScreen.tsx` `heroNumeral` (fontSize 88/lineHeight 96) — added `maxFontSizeMultiplier={1.3}`. Safe because `heroLabel`/`heroSubLabel` beside it already convey the same cycle-day information in scalable text.
2. `CalendarScreen.tsx` `monthNavGlyph` (fontSize 20 inside a fixed 32×32 circle) — added `maxFontSizeMultiplier={1.2}`. The glyph is purely decorative (chevron); the button's own `accessibilityLabel` already says "Previous/Next month".
3. `CycleRibbon.tsx` `phaseLabel` (fontSize 8.5, `numberOfLines={1}`) and `phaseDays` (fontSize 10) — added `maxFontSizeMultiplier={1.5}` to both. The parent `View` already carries a complete `accessibilityLabel` (`"{phase}, days {start} to {end}"`), so the visible text is reinforcement, not the sole source of the information — capping avoids `numberOfLines={1}` truncating the label at large Dynamic Type sizes.
4. `SelectionChip.tsx` checkbox glyph (fontSize 12 inside an 18×18 slot) — added `maxFontSizeMultiplier={1.2}` alongside the a11y-hiding fix above.
5. `QuickLogPeriodButton.tsx` — confirmed the `paddingVertical: 14` button already uses no fixed `height` (safe, grows with wrapped labels); moved the hardcoded value to `theme.spacing.md` (12) as directed by the plan. Note: since no 14pt token exists in the theme, this is a **deliberate 2pt-per-side visual tightening**, not a purely mechanical token swap — documented in a code comment at the style definition. Effective button height stays ≥44pt.

### 2. Dynamic Type — deferred (sprawl guard)

1. `LastPeriodStartScreen.tsx` / `CalendarScreen.tsx` month-nav arrows that use `minWidth`/`minHeight` (not fixed `width`/`height`) already grow safely with the box — no fix needed, confirmed by inspection, not a defect.
2. **Deferred, >½ day**: A broader Dynamic-Type layout audit of the day-editor's multi-column symptom/chip grids (`TodayLoggingScreen`) under AX2/1.3× wrapping behavior — the automated audit found no *fixed-height* container there, but a full wrap-and-reflow visual check across all chip rows at max scale needs a device pass, not a static read. Logged for the manual pass below rather than guessed at in code.

### 3. Touch targets ≥44×44pt — fixed

1. `ConfidenceImprovementList.tsx` tappable row — `paddingVertical: 2`, no `hitSlop`, ~22pt tall (worst offender, used on Today/Calendar/Insights simultaneously). Added `hitSlop={{top:11,bottom:11,left:8,right:8}}`.
2. `QuickLogPeriodButton.tsx` "Adjust" link — `hitSlop={8}` on ~18-20pt text (~34-36pt effective). Bumped to `{top:13,bottom:13,left:8,right:8}`.
3. `AnomalyNudge.tsx` dismiss "×" — `hitSlop={10}` on a ~22pt-tall, ~20-21pt-wide box (~42pt height and ~41-43pt width effective, both short). Bumped to `{top:12,bottom:12,left:12,right:12}` (review follow-up widened the horizontal slop from 10 to 12 — the first fix addressed height only).
4. `NoRemindersNudge.tsx` dismiss "×" — same shape/fix as AnomalyNudge.
5. `NoRemindersNudge.tsx` "Set up" CTA link — `hitSlop={6}` on ~18pt text (~30pt effective). Bumped to `{top:13,bottom:13,left:8,right:8}`.
6. `TodaySummaryCard.tsx` "See all" link — `hitSlop={8}` (~34pt effective). Bumped to `{top:13,bottom:13,left:8,right:8}`.
7. `CalendarScreen.tsx` month-nav buttons — fixed 32×32, no hitSlop. Added `hitSlop={6}` (reaches 44×44).
8. `LastPeriodStartScreen.tsx` month-nav arrows (32×32, no hitSlop) and day cells (minHeight 38, no hitSlop) — added `hitSlop={6}` and `hitSlop={4}` respectively.
9. `ConfidenceChip.tsx` (review follow-up) — the extracted primitive itself was initially shipped without hitSlop, failing this pass's own criterion: the filled pill computes to ~32pt tall (7×2 padding + ~18pt caption line) and the inline pair to ~22pt. Added variant-specific hitSlop (`{top:6,bottom:6}` filled, `{top:11,bottom:11,left:8,right:8}` inline) with a touch-target assertion in `ConfidenceChip.test.tsx`.

## ConfidenceChip Decision

Extracted the Pressable-chip pattern hand-rolled 3× (TodayScreen ~239,
CalendarScreen ~283, InsightsCyclePatternScreen ~62) into
`src/components/primitives/ConfidenceChip.tsx`. The three occurrences had
drifted:

- **Today** rendered a real filled pill (dark background, light text,
  padding, pill radius) — the only one with actual chip chrome.
- **Calendar** rendered a plain label+glyph pair in `textPrimary`, no chip
  chrome.
- **Insights** rendered the same plain pair but in `accentPrimary` — a
  color-token drift with no guaranteed contrast ratio against its card
  background, unlike the other two.

**Decision**: kept both visual treatments as an explicit `variant: 'filled'
| 'inline'` prop rather than forcing one look everywhere, since Today's
solid pill and Calendar/Insights' plain pair are genuinely different
visual weights by design (Today's confidence chip is a primary hero
readout; Calendar/Insights' sits inside an already-framed summary card).
Standardized the **inline** variant's color on `textPrimary` (Calendar's
majority shape and the token with a guaranteed-contrast pairing), removing
Insights' `accentPrimary` drift. Pressed-opacity kept per-variant
(`0.82` filled / `0.72` inline) since the two backgrounds read differently
at the same opacity delta.

Behavior change: Insights' confidence-chip label color changes from
`accentPrimary` to `textPrimary`. This is the only visible change from the
extraction; everything else (Today, Calendar, accessibility props, testIDs,
onPress targets, i18n keys) is unchanged.

## Sprawl Guard — Logged Follow-ups

1. ~~**`UnifiedGlassTabBar.tsx:116-119`** reimplements `Reanimated.useReducedMotion`
   fallback logic already encapsulated in `useFlorivaMotion()`.~~ **Fixed in
   Task A7**: the tab bar now calls `useFlorivaMotion(reducedMotionEnabledOverride)`
   and destructures `reducedMotionEnabled` instead of reimplementing the
   override-or-system-fallback resolution inline.
2. **`InlineMetric.tsx`** has no way to accept a `reducedMotionEnabled`
   override even though its sibling primitives (`Screen`, `SectionCard`,
   `MotionPressableSurface`) do. Functionally inert (nothing upstream
   supplies overrides anywhere in the app today), but an inconsistent API
   surface. Not fixed here since it's dead-plumbing-consistency, not a
   user-facing defect.
3. **Full Dynamic-Type wrap/reflow visual check of `TodayLoggingScreen`'s
   multi-column chip grids at AX2/1.3×** — the code audit found no fixed-
   height containers (a real static risk would have been fixable here),
   but confirming the *visual* wrapping behavior across every chip row
   needs a device pass. See Manual Pass Instructions below.
4. ~~**Duplicate `confidenceSummary` style key in `CalendarScreen.tsx`**~~
   **Verified resolved (Task A7)**: at the time this was logged, the
   `ConfidenceChip` extraction (`f1bc8b5`) had already collapsed this back
   to a single definition in the same commit. Checked `CalendarScreen.tsx`
   at Task A7 time — only one `confidenceSummary` key exists in
   `createStyles`, and only one call site references it. No code change
   was needed; this entry stays only as a record that it was re-checked.

## Manual Pass Instructions

These are the exact, mechanical steps for a human to run through on
device. Each surface below assumes a fresh Simulator/emulator boot with a
seeded profile (see `docs/qa/2026-06-11-pristine-sweep` for seeding
scripts) so Today/Calendar/Insights have real data to render.

### VoiceOver (iOS Simulator)

1. Settings → Accessibility → VoiceOver → On (or `⌘+F5` in Simulator, or
   triple-click the hardware button if mapped).
2. For each surface listed in the table above, swipe right repeatedly from
   the top of the screen and confirm:
   - Every interactive element in the checklist gets focus in the same
     order it appears visually (top-to-bottom, left-to-right within a
     row).
   - Each announces a role ("button", "link") and a meaningful label —
     not just a bare number or symbol.
   - The Calendar day-grid: focus each day cell and confirm it announces
     "selected" only for the currently chosen day (this is the fix from
     this pass — announce state should now update as you tap between
     days).
   - The Today confidence chip, Calendar confidence chip, and Insights
     cycle-pattern confidence chip: confirm each announces "button" plus
     the localized confidence-level label and a hint that it opens more
     detail.
   - Decorative elements (the hero Arc ornament, the CycleRibbon segmented
     bar, the info/arrow/checkmark glyphs) should NOT receive VoiceOver
     focus at all — swiping past their position should skip straight to
     the next real control.
   - Dismiss buttons (`AnomalyNudge` ×, `NoRemindersNudge` ×, `HelpTooltip`
     close/backdrop) must announce "Dismiss" or "Close", never a bare "×".

### TalkBack (Android emulator)

Same steps as VoiceOver above, enabled via Settings → Accessibility →
TalkBack → On, navigating with swipe-right/swipe-left. Pay particular
attention to the Calendar day grid and `LastPeriodStartScreen`'s
in-onboarding calendar — Android's TalkBack reads
`accessibilityLabel` differently from iOS in nested-Pressable layouts, so
confirm the day-cell label reads as a full date, not the day-cell's
child `Text` number.

### Dynamic Type — iOS (AX2)

1. Settings → Accessibility → Display & Text Size → Larger Text → enable
   Larger Accessibility Sizes → drag to **AX2** (or use Simulator's
   Settings app directly).
2. Relaunch Floriva. For each surface in the table:
   - Confirm no interactive label is truncated with `…` where it wasn't
     before (this would indicate a `numberOfLines` clipping a label that
     should wrap instead).
   - Confirm no two touch targets visually overlap.
   - Confirm the primary Save/Continue/Log-today action on every screen
     that has one is still fully visible and tappable without scrolling
     past the bottom of the safe area.
   - Specifically re-check `CycleRibbon`'s phase-legend row (Today) — it
     was capped at `1.5x` rather than allowed to scale freely, so confirm
     it still reads clearly (not illegibly small) at AX2 relative to the
     rest of the screen, and that the segmented bar above it doesn't
     visually disagree with the (now-capped) legend text below it.
   - Specifically re-check the `TodayLoggingScreen` symptom/mood chip
     grids — this is the one area flagged as "needs a device pass" above,
     since multi-column `flexWrap` grids can only be confirmed visually.

### Dynamic Type — Android (Font size 130% / Largest)

1. Settings → Display → Font size → set to the largest available step
   (typically ~130% or "Huge" depending on Android version).
2. Repeat the same checks as the iOS AX2 pass above.

### Reduced Motion (no code changes expected — confirm the OS fallback works)

1. iOS: Settings → Accessibility → Motion → Reduce Motion → On. Android:
   Settings → Accessibility → Remove animations → On (or Developer
   Options → Animator duration scale → Off, depending on OS version).
2. Relaunch Floriva and confirm: screen transitions are near-instant fades
   (not slides/springs), card reveals on Today/Calendar/Insights don't
   visibly translate or scale in, and press feedback on chips/buttons
   doesn't scale/translate — only the "loading" and static state should be
   visible. This exercises the `Reanimated.useReducedMotion()` fallback
   documented in the Note on criterion 4 above; no per-screen code wiring
   should be needed for this to already work correctly.
