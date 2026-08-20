# UI-Lift Phase 1 — Visual Audit Findings Ledger (iOS)

Sweep: 2026-07-22 baseline, iPhone 17 Pro / iOS 26.4, 92 captures across 11 presets.
Reviewers: 5 taste-critique agents (rubric: hierarchy, spacing, alignment, color, typography,
native idiom, density, delight) + orchestrator verification.
Status: CONFIRMED = orchestrator personally verified in the cited pixels. PLAUSIBLE = reported,
not yet verified. REJECTED = verified false, reason given.
Severity: P0 broken/unusable-looking · P1 clearly wrong · P2 noticeably off · P3 nitpick.

> **Fix log:** UL-01 + UL-49 + UL-69 (+ the iOS half of UL-83) FIXED in merge 66f86381
> (bone scrim 0.85 inside the glass bar, iOS-only; three-column bar layout with ellipsized
> back label). Evidence: docs/qa/2026-07-22-ui-lift/fixes/UL-01-sticky-header/. UL-51 (naked
> scroll edge on sub-pages that lack a ScreenScrollHeader entirely) remains OPEN — those
> screens need the header adopted or an equivalent edge treatment (Wave A/C).

## P0 — must fix

- **UL-01 [P0][native-idiom] Sticky collapsed header renders with NO glass backing — text
  superimposed on content.** CONFIRMED (orchestrator, backup-export-b.png: "‹ Back to data
  controls" + "Export backup" composite directly over "Restore preview / This will replace all
  current Floriva data…"; agent also cites timeline-mid.png, timeline-b.png "Feb 6 / Private
  note" THROUGH the header, insights-ttc-b, paywall-b "Get Floriva" over legal text).
  Surfaces: ScreenScrollHeader consumers (timeline, backup export/restore, subscribe, insights
  sub-screens). Likely `ScreenScrollHeader` GlassSurface not painting its frost/fallback.
  Evidence: baseline/backup-ready/ios/backup-export-b.png, qa-rich-history/ios/timeline-b.png.

- **UL-02 [P0][correctness-copy] Irregular cycles described as regular.** CONFIRMED
  (orchestrator, tenure-12mo-irregular/ios/insights.png): bars 27,38,26,27,45,26,31,64,21 under
  headline "Consistent on average" and footer "Within about +/- 1 days across your recent logged
  cycles. Floriva is treating your cycle as regular." Copy gaslights the user's own visible data
  on the exact scenario built to test it. Domain: variability classification or copy binding.

- **UL-03 [P0][copy-template] "Built from cycle history stored on this device." rendered as
  content in multiple slots.** PLAUSIBLE→likely (3 independent agents): appears twice
  consecutively on insights/cycle-pattern (subtitle + bold), and as the PATTERN NOTICED
  editorial quote on Insights across presets (a privacy footnote in the flagship pattern slot).
  Evidence: qa-rich-history/ios/insights-cycle-pattern.png, tenure-*/ios/insights.png.

## P1 — clearly wrong

- **UL-04 [P1][native-idiom] Glass tab bar ghosting/staining: content without clearance bleeds
  through and around the floating pill.** CONFIRMED (orchestrator, tenure-12mo-regular/ios/
  calendar.png: day-card "Edit log"/"View" buttons stain right half of pill pink). Agents:
  worst on calendar (all presets), also today.png ("Log today" clipped, orphaned "See all"),
  insights.png (briefing card beheaded, ghost text), settings.png. Needs bottom-clearance rules
  + possibly scrim. Surfaces: all four tabs' scroll content.

- **UL-05 [P1][correctness] Follicular phase math renders broken states.** CONFIRMED
  (orchestrator saw "Follicular 0d" empty track on tenure-12mo-irregular/ios/insights.png;
  agent also cites qa-rich-history/ios/today.png "FOLLICULAR 7-6" inverted range next to
  FERTILE 7-12). Zero-length/inverted phase needs designed treatment AND the math checked.

- **UL-06 [P1][hierarchy] Prediction banner inverts hierarchy: "High/Medium confidence" is the
  big bold line, the payload ("Next period expected Aug 11 to 15") is the small line.**
  CONFIRMED (orchestrator, tenure-12mo-regular/ios/calendar.png). All calendar presets.

- **UL-07 [P1][density-copy] Headline/subtitle same-fact stutter on Today.** PLAUSIBLE (2
  agents, all presets): "Fertile window ended 1 day ago" + "Window closed 1 day ago."
  immediately below. Also lapsed: banner heading restated verbatim in body.

- **UL-08 [P1][delight] Lapsed Today hero shows an oxblood rectangle next to "Awaiting an
  update" — reads as redaction bar/broken asset in the comeback moment.** PLAUSIBLE.
  Evidence: tenure-lapsed/ios/today.png.

- **UL-09 [P1][trust] Lapsed Insights presents months-stale analysis as live (present tense,
  no staleness cue) while Today on the same device admits staleness.** PLAUSIBLE.
  Evidence: tenure-lapsed/ios/insights.png. (Calendar suppresses via stale gate; Insights
  seemingly doesn't.)

- **UL-10 [P1][hierarchy] Paywall (/subscribe) has no visible purchase CTA in top OR bottom
  capture — buy action is mid-scroll only.** PLAUSIBLE (needs live check; plan cards may be
  tappable CTAs). App's own idiom (pinned glass footer) absent on the conversion screen.
  Evidence: billing-fallback/ios/paywall.png + -b.

- **UL-11 [P1][trust] Restore consent gate invisible: "I understand this replaces current
  data" has no checkbox/switch chrome; "Restore this backup" muted rose reads
  ambiguous-disabled.** CONFIRMED visually (orchestrator, backup-export-b.png) — state
  illegible from pixels; needs live interaction check for actual behavior.

- **UL-12 [P1][information-arch] Export backup route scrolls into the full restore flow
  (passphrase → "Restore preview" → destructive warnings) under an "Export backup" title.**
  CONFIRMED (orchestrator, backup-export-b.png).

- **UL-13 [P1][hierarchy] Import source screens dead-end visually after file selection: no
  continue/preview CTA visible; only "Choose file" (points backward). Flo screen shows a
  clue-named fixture with no mismatch cue.** PLAUSIBLE (fixture artifact possible; validation
  absence is the finding). Evidence: import-ready/ios/import-source-*.png.

- **UL-14 [P1][data] Insights-TTC contradicts itself: "Logged on 0 of 6 fertile-window days"
  above four cards of logs dated inside that window.** PLAUSIBLE.
  Evidence: qa-rich-history/ios/insights-ttc.png.

- **UL-15 [P1][density] Calendar-history: 6 rows all subtitled "Period day", then 40% empty,
  in the rich preset; title promises "Cycles logged." but lists bleeding days.** PLAUSIBLE.

- **UL-16 [P1][billing-copy] Subscription settings status card self-contradicts: "No
  subscription" + "No active plan" + "Trial ends August 21, 2026" stacked.** PLAUSIBLE.
  Evidence: billing-fallback/ios/settings-subscription.png.

- **UL-17 [P1][onboarding] Paywall scrolled-to-bottom: primary CTA pill renders overlapping
  the collapsed header title/Back affordance at top of screen.** CONFIRMED (orchestrator,
  phase-1/evidence/paywall-bottom-cta-overlaps-header-ios.png; discovered during harness runs —
  reproducible via scrollTo bottom on onboarding paywall). Related to UL-01 family.

- **UL-18 [P1][density] Lock screen states the unlock instruction 4x (subtitle, card footer,
  UNLOCK PATH, RECOVERY PATH); page subtitle sentence duplicated verbatim in card.**
  PLAUSIBLE. Evidence: locked-app/ios/lock.png.

- **UL-19 [P1][density] Timeline filter row: "All" is an oxblood circle chip, all other
  filters are bare bold text, ragging across three rows with "Backups" orphaned.** PLAUSIBLE.
  Evidence: qa-rich-history/ios/timeline.png.

## P2 — noticeably off (batched by surface for polish waves)

- **UL-20 [P2][color] Pure-black UI elements fight the warm palette: "High/Medium confidence"
  chips (Today, all presets) and the black today-disc on Calendar (not in the legend).**
  CONFIRMED (orchestrator saw both in tenure captures).
- **UL-21 [P2][spacing] Calendar header dead zone: chevrons float far right in an empty band
  below "July 2026"; month title in sans while sibling display slots are serif.** CONFIRMED.
- **UL-22 [P2][density] Label-restates-value tic, systemic: "27 / 27 private timeline
  entries", "4 / 4 cycles logged", "PERIOD DAYS / 2 period days", "13 cycles" pill + "Based on
  13 local cycle starts". One rule fixes a dozen instances.** PLAUSIBLE (multiple agents).
- **UL-23 [P2][typography] "+/- N days" ASCII + "1 days" grammar; mono numerals promised by
  the system absent from stats/prices (backup stats, paywall prices, BBT).** CONFIRMED (saw
  "+/- 1 days").
- **UL-24 [P2][spacing] Phase legend wraps 3+1 leaving LUTEAL orphaned (Today, multiple
  presets).** PLAUSIBLE.
- **UL-25 [P2][hierarchy] Insights chart: only saturated element is the current/shortest bar,
  fighting "AVG" as the summary; bare mono labels lack time anchor.** PLAUSIBLE.
- **UL-26 [P2][alignment] Cycle-pattern stat cards ragged bottoms (TIMING wraps 3 lines vs
  HISTORY USED).** PLAUSIBLE.
- **UL-27 [P2][density] Cycle-pattern page ~55-70% void; regular preset gets NO observations
  section at all (structure changes between presets) vs an "all clear" state.** PLAUSIBLE.
- **UL-28 [P2][trust] Timeline privacy reassurance 3x per row × 27 rows ("Private" badge +
  "Only stored on this device" meta + header promise).** PLAUSIBLE.
- **UL-29 [P2][native-idiom] "Back to X" chip-styled pills read as filter chips not
  navigation; duplicate back systems on scrolled screens.** PLAUSIBLE (import, settings
  sub-screens, insights children).
- **UL-30 [P2][alignment] Backup form column indented ~28px right of the page's own text
  margin (two competing margins).** PLAUSIBLE.
- **UL-31 [P2][hierarchy] Paywall plan selection state is a hairline border only; three
  numeral styles in one price card; BEST VALUE badge crowds title.** PLAUSIBLE.
- **UL-32 [P2][density] Import rows lead with "Clue JSON"/"Flo JSON" jargon; no privacy
  reassurance line on the most sensitive flow; no recommended-path signal.** PLAUSIBLE.
- **UL-33 [P2][hierarchy] Monthly briefing: stat values restate labels; sibling cards
  mismatched fills/heights; empty-state coaching leads the Top signals card in the rich
  preset.** PLAUSIBLE.
- **UL-34 [P2][hierarchy] Calendar predicted-days show unexplained third marker (pink dash);
  day 18 hybrid glyph (outlined circle + dash + green dot) not decodable from legend.**
  PLAUSIBLE (irregular + rich presets).
- **UL-35 [P2][trust] Save-offer: Apple offer-code mechanics exposition mid-pitch; decision
  zone top-shelved with 45% dead space below.** PLAUSIBLE.
- **UL-36 [P2][cross-preset] History-size claims disagree between tabs ("last nine cycles" vs
  "13 cycles"/"11 cycles").** PLAUSIBLE.
- **UL-37 [P2][a11y-contrast] Washed dusty-rose disabled CTAs ("Create backup file", "Restore
  this backup") ambiguous between disabled/quiet; lowest-contrast text on most dangerous
  buttons.** PLAUSIBLE.
- **UL-38 [P2][spacing] Lock screen: content crowds top 55%, CTA strands mid-screen; no brand
  motif on the daily-ritual screen.** PLAUSIBLE.

## P3 — nitpicks (opportunistic only)

- UL-39 concentric-circle motif crops at awkward tangent (Today). UL-40 "of 28" floats with no
  baseline relationship to giant numeral. UL-41 predicted-ring pink dash absent from legend
  (see UL-34). UL-42 hairline separators between about-estimates bullets read web-like.
  UL-43 history dates not in mono. UL-44 "Refresh billing status" vs "Refresh access" naming
  drift. UL-45 filename not mono in import. UL-46 timeline lacks terminus/colophon. UL-47
  settings "Biometric lock off · 1 min · off" reads as debug output. UL-48 birth-control row
  icon is a bell (describes side-effect not noun).

## Protect list (do NOT regress in polish waves)

- Giant oxblood serif numeral + "— RIGHT NOW" kicker on Today (signature).
- THIS CYCLE phase bar with mono day-ranges; calendar disc system + mono grid numerals.
- Editorial headline formula ("What your last nine cycles say.", "Your almanac, your way.",
  "Bring your history with you.", "How Floriva predicts.").
- Serif stat cards (cycle-pattern, backup preview table with blush highlight).
- Trial timeline (Today/Reminder/Trial ends) anti-dark-pattern block; lifetime "No
  auto-charge" honesty; save-offer full price arc + equal-width "Continue to cancel".
- Honest lapsed copy ("Your local estimate needs a refresh"); May briefing keeping its May
  label; stale-gate suppression on Calendar.
- Timeline date-gutter ledger layout; settings grouped cards + circled-numeral badge.
- Glass-over-paper idiom where it works (tab bar on Today over cream content).

## Additional findings (seeded-tracker + fresh-install reports)

- **UL-49 [P0][native-idiom] Sticky header collision also on calendar-day (logging) screen.**
  PLAUSIBLE (agent: calendar-day-today-b.png — "Back to calendar" + "Wednesday, July 22" +
  underlying chips collide in transparent header strip). Folds into UL-01 (same root).
- **UL-50 [P1][interaction-grammar] Selected state wears the primary-CTA costume, systemic:**
  full oxblood filled pills mean both "tap me" (Log today) and "currently chosen" (language
  "System default", privacy-lock "1 minute" segment). Selection needs its own token; current
  outline-weight selection (cycle-setup, tracking-setup, onboarding chips) too weak to read.
  CONFIRMED (orchestrator, settings-language-b.png: selected "System default" is
  pixel-identical to primary-CTA treatment).
- **UL-51 [P1][native-idiom] Naked scroll edge on sub-pages WITHOUT sticky headers:** content
  slices mid-letterform under the status bar on privacy-explainer-b, settings-language-b,
  settings-birth-control-b, settings-tracking-setup-b, insights-ttc-b. One shared treatment
  with UL-01 fixes the family. CONFIRMED (orchestrator, settings-language-b.png: "Current
  language" heading sliced mid-letterform at top edge, no glass/fade/solid backing).
- **UL-52 [P1][flow] Onboarding chrome instability:** Back pill present→absent (06,07)→present;
  progress bar jumps to screen top and back; completion renders it as a thick trackless rule;
  notifications step flips the primary button to bottom-LEFT. PLAUSIBLE (fresh-install walk).
- **UL-53 [P1][interaction] Onboarding choice cards (start-path, symptom-logging, ttc) have
  ZERO selection affordance + muted low-contrast disabled Continue; cycle-length hides a
  second question below the fold so an answered-looking screen has a disabled CTA.**
  CONFIRMED (orchestrator, onb-02-start-path.png: three identical cards, no selected state,
  washed dusty-rose Continue with white text, duplicate Back pill + footer Back).
- **UL-54 [P1][copy-dup] Settings duplicate-label disease:** "Current language" heading
  touching "CURRENT LANGUAGE" eyebrow; "Current plan" twice in one card; reminders summary
  card verbatim-duplicates the detail card below it; "TRYING TO CONCEIVE / Trying to
  conceive." CONFIRMED (orchestrator, settings-language-b.png shows the language pair).
- **UL-55 [P1][billing-copy] Subscription date wall: "Trial ends Aug 21 / Billing starts Aug
  21 / Access ends Aug 21" — same date 3 lines, logically contradictory pair.** PLAUSIBLE
  (seeded-tracker/settings-subscription).
- **UL-56 [P1][trust] Destructive "Delete all local data" is a neutral bone outline pill,
  visually identical to harmless buttons; zero red on the one true destructive action.**
  PLAUSIBLE.
- **UL-57 [P1][insights] "Not enough data yet" beside giant confident oxblood "29 EST" —
  strongest visual contradicts strongest words (fresh + seeded presets).** PLAUSIBLE.
- **UL-58 [P1][onboarding] Completion screen: unlabeled solid oxblood blob (~55x75pt) floats
  above STARTING POINT — reads as broken image placeholder on the victory screen.** PLAUSIBLE
  (also echoes UL-08 lapsed hero rectangle — possibly same component).
- **UL-59 [P1][onboarding] Welcome screen composition adrift: app icon tile reads as stray
  home-screen icon, hollow center band.** PLAUSIBLE.
- **UL-60 [P2][settings] Feedback screen shows the support email unlabeled, styled like a
  filled input — reads like a logged-in identity in a no-account app.** PLAUSIBLE.
- **UL-61 [P2][settings] Tracking-setup: lone filled dark ⓘ button floats on its own line in
  three cards, attached to nothing.** PLAUSIBLE. Related: dark info-chip strays fight the
  palette across Today/Calendar/Insights/onb-07 (folds into UL-20 family).
- **UL-62 [P2][onboarding] Value duplication: cycle-length shows "29" three ways (hero, text
  field, chip); period-length same; quick chips wrap 3+1 orphaning "14 days ago"; selection
  grammar flips oxblood-fill (calendar) vs black-outline (chips) between adjacent steps.**
  PLAUSIBLE.
- **UL-63 [P2][settings] Reminders: On/Off-as-buttons instead of switches; "Off" states bare
  unstyled text; -b shows 8 near-identical pills in a wall. Sounds screen uses plainest
  "Haptics: On" text while privacy-lock uses elegant serif tiles — two systems, one job.**
  PLAUSIBLE.
- **UL-64 [P2][day-log] Chip grid sawtooth; "Libido changes" chip wraps to two-decker with
  dropped checkbox; disabled Save is muddy dusty-rose (same family as UL-37); "PMDD patterns"
  chip lacks checkbox affordance of siblings.** PLAUSIBLE.
- **UL-65 [P2][fresh-day-one] Insights + Settings greet new users with zeros ("0 local logs
  reviewed", "0 cycles logged") and triple "not enough data" nagging; Today's "No reminders
  set" callout reads as pink error on first arrival; TODAY'S LOG bare en-dashes read broken.**
  PLAUSIBLE.
- **UL-66 [P2][settings] Title-pattern inconsistency: "Sounds & haptics", "Subscription",
  "Delete local data" drop the accent-word + period formula their siblings use.** PLAUSIBLE.
- **UL-67 [P3][artifact-note] Info modal default state ("More on this / There's nothing more
  to show here right now") captured via bare deep link — this is the no-params fallback, NOT
  a user-reachable dead end (no ⓘ in the app routes to /modal yet). REJECTED as P1 dead-end;
  retained as P3: the fallback copy exists and the sheet is full-height for two lines.
  Agent's claim that tracking-setup ⓘ opens this sheet was inference, not pixels — those open
  HelpTooltip sheets.

## Parity findings (iOS vs Android, 12 pairs compared)

- **UL-68 [P0-context] Android does NOT have the sticky-header collision — its header is an
  opaque bone surface with a hard bottom edge (timeline-b, backup-export-b). Android is the
  behavioral target for UL-01: iOS's glass bar must render frost/scrim, never clear.**
- **UL-69 [P1][shared] Back-label/title collision INSIDE the header bar on BOTH platforms:**
  "‹ Back to data controlsExport backup" renders with zero gap when the back label is long
  (backup-export-b both OSes). Distinct from UL-01 transparency; needs truncation or
  leading-aligned title.
- **UL-70 [P1][systemic] Serif accent split: oxblood accent words upright on iOS, italic on
  Android ("ago", "almanac", "nudges", "refresh", "with you", Pattern-noticed quote). Brand
  voice differs per platform. Direction: italic reads designed for display headlines/quotes;
  roman safer for inline sentence accents; verify Android loads true Newsreader Italic. Unify.**
- **UL-71 [P1][android] Calendar header double-render: sticky "July 2026" app bar over a
  half-clipped large "July 2026" page title; CALENDAR eyebrow lost. iOS single display header
  is the target.**
- **UL-72 [P2][android] Reminders card CTAs wrap to two lines ("Turn off daily log /
  reminder") where iOS holds one — Android button type runs hot relative to container.**
- **UL-73 [P3][android] Bleeding chip "Heavy" pill/label vertical misalignment (day-log).**
- **UL-74 [P3][android] Lock screen "fingerprint, face unlock…" lowercase where iOS
  capitalizes — trust-screen typo feel.**
- **UL-75 [P3][icon] Insights tab icon metaphor differs (iOS chart-with-arrow vs Android
  sparkle) — beyond filled/outline convention; iOS metaphor clearer.**
- Faithful-sibling verdicts: today, insights, settings, calendar-day, paywall (best pair),
  lapsed-today, lock, import. Chrome divergence (glass vs Material) intentional and good.

## Android-specific findings (77 captures reviewed)

- **UL-76 [P1][android-idiom] Binary settings rendered as verb-button pills + status text
  instead of M3 switches** (sounds, reminders, privacy-lock, tracking-setup, birth-control) —
  biggest "not actually Material" tell; costs 2-3x vertical space. Includes "On" chip vs
  bare-text "Off" inconsistency (folds with UL-63 which is cross-platform).
- **UL-77 [P1][android-copy] "Face ID" (Apple branding) twice in Android privacy-lock settings
  copy, while the lock screen correctly says "face unlock".** One-line fix, high embarrassment,
  on the trust surface.
- **UL-78 [P1][android-idiom] Gesture-bar overlap of tappables:** "Lock now" button under the
  system gesture pill (privacy-lock), content at backup-export bottom, tight paywall clearance
  — bottom insets missing on non-tab screens.
- **UL-79 [P1][android] Save-offer primary CTA has a grey rectangular box peeking behind the
  rounded oxblood pill — render artifact on the retention flow's key button.** (Candidate:
  GlassSurface Android elevated-solid backdrop behind a button?)
- **UL-80 [P1][chart][cross-platform] Insights cycle-length chart: highlighted current bar
  extends BELOW the shared baseline of the pale bars** (qa-rich + tenure-irregular, Android;
  re-inspection of the iOS irregular capture shows the same). Baseline misalignment reads as
  broken data.
- **UL-81 [P1][data] Reversed phase ranges occur on multiple presets: "FOLLICULAR 7-6"
  (qa-rich) and "FOLLICULAR 6-5" (tenure-irregular) — a formula/formatting bug, not a
  one-off** (upgrades UL-05 scope).
- **UL-82 [P2][android] Non-Material back affordance: floating "Back to X" pill (grey fill
  variant on import-source, bottom-placed on ttc-expectations) — ingredient in the sticky
  collision defect** (folds with UL-29).
- **UL-83 [P2][android] Sticky header on backup screens: label collision WORSE on Android —
  "‹ Back to data controlsExport backup" glyphs touching** (confirms UL-69 severity).
- Android confirms cross-platform: UL-02 (P0 regular-claim), UL-03, UL-04 (tab-bar slicing),
  UL-05, UL-14, UL-16, UL-20 (black elements), UL-21 (chevrons), UL-22, UL-54, UL-55, UL-56
  (delete not destructive-colored), UL-57, UL-13 (import dead-end), UL-12 (restore-on-export),
  UL-11 (checkbox-less consent), UL-08 (lapsed rectangle), UL-51 (naked scroll edge).
- Android protect list: native M3 tab bar with pill indicator (best-in-sweep idiom), paywall
  (strongest screen — do not redesign), lock screen register, honest save-offer framing.

## Verified-capture notes (harness)

- onb-09-paywall-b was byte-identical to top frame (annual card visible in first viewport →
  visibility-driven scroll no-oped). Harness fixed to capture one viewport down; recapture
  needed for the plans/CTA region. The billing-fallback /subscribe captures cover the same
  paywall content meanwhile.
- import-source -b, calendar-history -b, about-estimates -b, cycle-pattern -b, monthly-
  briefing -b, lock -b: pixel-identical to parents (screens don't scroll) — harmless.

## Pending

- seeded-tracker + fresh-install critique reports (agents running).
- Android sweep + parity review (sweep running).
- Cross-preset consistency agent + iOS/Android parity agent (after Android lands).
- Live verification needed before fixing: UL-01 (which screens' headers), UL-10 (tap a plan
  card), UL-11 (consent interaction), UL-13 (post-selection flow), UL-02/05/14 (domain data).

## Wave A fix-log (2026-07-22, merged 93573c78 — evidence in ../wave-a/)

- FIXED: UL-47, UL-50, UL-54, UL-55+16, UL-56, UL-60, UL-61, UL-63+76+72, UL-77,
  UL-18+38+74, UL-11+12, UL-32. Critique gate GATE-PASS (all verified in pixels, both
  platforms).
- NOT-REPRODUCED (closed): UL-13 (file selection auto-navigates to review), UL-78 (tab
  clearance guard 770affd predates), UL-04-on-settings.
- ESCALATED to primitives pass (ui-lift/primitives-pass): UL-51 (Screen stickyTitle
  fallback), UL-29+82 (back-pill quiet-navigation restyle), UL-37 (ActionButton disabled
  treatment).
- NEW follow-ups from gate review:
  - **UL-84 [P3][both] Toggle-row label doubles its card title ("Haptics"/"Haptics",
    "Diagnostics"/"Diagnostics") after switch conversion — give rows verb-phrase labels
    ("Use haptics", "Allow diagnostics").**
  - **UL-85 [P3][both] UL-61's three "More about ..." captions are English-only;
    SettingsTrackingSetupScreen needs its overdue i18n pass.**
  - **UL-86 [P3][android] Native switch off-state thumb/track contrast is weak on cream
    cards — check during physical-device sign-off (token vs native render interaction).**
- UL-70 (roman vs italic serif accents across platforms) re-confirmed live during Wave A;
  remains open, spans all waves.

## Primitives-pass fix-log (2026-07-22, merged post-Wave-A — evidence in ../primitives-pass/)

- FIXED: UL-51 (Screen stickyTitle fallback; 12 ItalicTitle screens wired), UL-29+82 (back
  pill → quiet chevron+label navigation, app-wide via primitive), UL-37 (ActionButton
  disabled = muted surface + tertiary label). Ripple containment proven (string-title
  screens pixel-identical). Sticky-bar mid-transition ghosting verified identical to
  string-title behavior (existing UL-01 scrim design, not a regression).

## Wave B fix-log (2026-07-22, branch ui-lift/wave-b — evidence in ../wave-b/)

Scope: Today + logging + calendar sub-routes (grid/bands/legend untouched — Phase 2 design).

- FIXED: UL-71 (Android calendar double title: root cause was NOT a native
  header — the Screen primitive's sticky collapse bar initializes scroll
  tracking from `initialScrollOffsetY`, but RN only honors `contentOffset` on
  iOS, so Android showed an opaque revealed bar over unscrolled content;
  Calendar now requests the offset on iOS only), UL-21 (chevrons seated
  beside the serif month title via headerActions; dead band removed), UL-06
  (prediction banner leads with the next-period payload), UL-07 (fertile
  caption now carries the window dates instead of restating the headline),
  UL-08 (stale hero drops the 88px en-dash "redaction bar" for a serif
  status line), UL-20 Today-half (confidence chip fill warmed from ink to
  espresso via screen-level token override), UL-24 (phase legend pinned to a
  2x2 grid, no LUTEAL orphan), UL-19 (timeline filters wear SelectionChip
  grammar), UL-22 timeline instance (summary numeral labeled, not restated;
  new `entryCountLabel` string in all 8 locales), UL-28 (per-row privacy
  reassurance metas removed; informative metas kept; privacy strings
  untouched), UL-15+43 (history rows labeled by bleeding intensity via
  existing timeline strings; ledger dates in mono), UL-64 partial
  (condition-context tags de-chipped to eyebrow labels), UL-42 (P3,
  about-estimates hairlines dropped).
- NOT-REPRODUCED (closed for these surfaces): UL-04 on Today — scrolled to
  the true bottom, the last card clears the floating pill with room to
  spare (tab-clearance guard 770affd holds; evidence
  ../wave-b/UL-04/not-reproduced-bottom-clearance-*.png). Mid-scroll
  refraction under the glass pill is the protected glass-over-paper idiom.
- ESCALATE-PRIMITIVE (SelectionChip, frozen): UL-73 + UL-64 chip-internal
  misalignment — chips with short labels ("Heavy", "Low", "Positive test",
  "Sticky") render the label riding high / the chip inflated because the
  reserved (invisible) indicator slot wraps inside the chip's
  `flexWrap: 'wrap'` content row; long labels ("Libido changes") double-deck
  the checkbox. Fix belongs in SelectionChip's content row (no wrap;
  reserve indicator inline). Evidence: ../wave-b/UL-73-escalation/.
- ESCALATE-PRIMITIVE (Screen, frozen): `initialScrollOffsetY` is applied via
  iOS-only `contentOffset` while `scrollY`/the sticky bar assume it applied
  — root cause behind UL-71, worked around at the Calendar feature level.
  Screen should apply the offset cross-platform (scrollTo on mount) or not
  pre-seed `scrollY` with an unapplied offset.
- ESCALATE-PRIMITIVE (ConfidenceChip, frozen): the `filled` variant's ink
  fill is what UL-20 flagged; Today now overrides per-call-site — a warm
  filled variant belongs in the primitive.
- SKIPPED (out of scope / other waves): UL-02/05/81/14/36 (domain logic),
  UL-34+41 (grid legend/markers — Phase 2 design), UL-57 (insights, Wave C),
  UL-65 (fresh-install preset outside this wave's harness; en-dash empties
  are the LT-29 convention), UL-46 (P3 terminus — declined, new copy across
  8 locales for a nitpick), UL-39/40 (P3 hero protect-list adjacencies).
- UL-70 re-confirmed again (iOS "ago" upright vs Android italic on Today);
  still open, spans all waves.
- New observation (not fixed, out of finding set): TodayLoggingScreen
  hardcodes the English strings 'Sex' and 'Ovulation test' as inline
  labels (src/features/logging/screens/TodayLoggingScreen.tsx) — i18n gap
  in the TTC section, sibling of UL-85.

## Wave B gate follow-ups (critic, non-blocking)

- **UL-87 [P3][both] UL-07's three fertile-window caption strings are en-only hardcodes in
  src/lib/predictions/presentation.ts (formatFertileWindowCaption) — non-en locales get no
  caption. Fold into the UL-85 i18n-pass family with TodayLoggingScreen's 'Sex'/'Ovulation
  test' hardcodes.**
- UL-19 residual: "Backups" filter chip wraps alone on row 3 — revisit if the filter set
  grows.
- UL-15 residual: "Cycles logged." page still ~40% empty below the ledger — density half
  remains open for a later wave.

## Wave C fix log (insights + onboarding + billing, 2026-07-23)

Branch `ui-lift/wave-c` (NOT merged). Evidence: ../wave-c/<UL-id>/ (before/after,
both platforms). Onboarding walks: ../wave-c/onb-before/ and ../wave-c/onb-after/
(iOS Detox walk + Android pixel-tap walk, fresh-install).

- UL-03 FIXED (b37fba8f): the PATTERN NOTICED callout that dressed the privacy
  line as an insight is gone; the privacy readout stays verbatim, relocated as a
  quiet footnote under the Explore card on Insights (and remains the
  cycle-pattern page description). No privacy string changed or softened.
- UL-57 FIXED (8927f75d): estimate-state AVG numeral drops to textSecondary so
  observed vs estimated reads at a glance; serif numeral kept.
- UL-80 FIXED (0f309745): chart bars pixel-snapped to a shared 42px track with a
  4px minimum — bar baselines now align exactly (measured 977/977/977 iOS,
  836/836/836 Android).
- UL-33 + UL-26 FIXED (67d8b598): monthly-briefing stat values are bare counts
  (labels stop restating values); sibling stat cards stretch to equal heights.
- UL-27 FIXED (a8fc245d): Observations section persists across presets with an
  all-clear body (`insights.observations.allClear`, 8 locales) instead of
  appearing/disappearing.
- UL-09 FIXED (24ef403b): stale-history note (existing
  formatStalePredictionBannerLabel strings) surfaces above the chart on lapsed
  presets.
- UL-10 FIXED + UL-31 partially (ab2e0233): selected plan states "Selected" in
  words via a badge (`billing.plans.selectedBadge`, 8 locales); annual card's
  savings line drops to caption scale (one serif price + quiet captions).
  UL-31's "hairline selection" clause NOT-REPRODUCED live (2px accent border +
  fill present; evidence ../wave-c/UL-31/).
- UL-35 FIXED (88638579): Apple offer-code exposition moves below the
  save-offer decision zone as an unframed footnote; honest framing and decline
  copy untouched, still visible pre-tap.
- UL-79 NOT-REPRODUCED: no grey box behind the save-offer CTA on Android
  (evidence ../wave-c/UL-79/).
- UL-52 + UL-53 + UL-62 FIXED (e235c203, cluster): every onboarding step now
  carries the top back pill (added to symptom-logging, TTC decision, TTC
  preset, cycle-variability); OnboardingFooter no longer renders a duplicate
  Back button — the pill is the single back affordance
  (`onboarding-start-path-back-button` moved onto the pill; e2e suites
  untouched contract-wise); notifications footer reordered secondary-left /
  primary-right; last-period-start joins the shared fixed footer; completion
  drops the 100% progress bar (rendered as a thick trackless rule);
  cycle-length hero numeral panel removed ("29" was stated three ways) —
  "Average: 21-35" kept as a caption by the input and the required Variability
  choice now sits above the fold. E2e arrival markers moved from
  `cycle-length-numeral` to `onboarding-cycle-length-input` (4 specs).
- UL-58 FIXED (0c469990): completion Petal ornament 0.95 → 0.14 opacity, joins
  the Arc wash family instead of reading as a solid oxblood blob.
- UL-59 FIXED (5b8500ff): welcome logo tile chrome removed — bare mark +
  wordmark caption; label color moved to the canonical textPrimary token.
- UL-17 RESOLVED/NOT-A-USER-DEFECT (6682eae4, diagnosis + evidence
  ../wave-c/UL-17/repro/): live repro on current HEAD shows (a) the original
  CTA-over-header collision was the transparent sticky bar — already fixed by
  UL-01's scrim (66f86381); the bottom state now renders legibly; (b) after
  Detox `scrollTo('bottom')` Detox's own scroll/scrollTo fail ("View is not
  scrollable at the given start point") and cannot recover — but a synthesized
  finger swipe recovers instantly, so real users are never stuck. Harness
  artifact; sweep keeps its no-deep-scroll workaround with a corrected comment.
- UL-34 + UL-41 FIXED (821590f7): 'Spotting' legend entry wired into the
  quiet-bands calendar key (label was already localized in 8 locales; the
  hollow-dot swatch already existed) — the last grid marker not decodable from
  the key. Repro: tenure-12mo-irregular April 2026 day-17 spotting dot.
- UL-25 SKIPPED (assessed live, ../wave-c/_live/ios-insights-chart-crop-big.png):
  the saturated latest bar is a deliberate recency emphasis paired with the AVG
  summary; adding time anchors to the mono labels is a design-wave call that
  trades against the page's calm density. UL-80/UL-57 already tightened this
  chart's geometry and numeral hierarchy.
- UL-65 (insights half) SKIPPED: fresh-state zeros are the honest-counts /
  LT-29 en-dash convention; copy redesign spans 8 locales and belongs to a
  content pass. New observation for that pass: the empty CYCLE LENGTH card
  states the same coaching twice back-to-back ("Log more periods to see cycle
  history." + "Log a couple more periods so Floriva can learn your cycle
  pattern.") — one should go.
- UL-23 (paywall-prices clause) REJECTED for this surface: paywall serif
  numerals are protect-listed; the mono-numeral system promise does not apply
  to the paywall's editorial price treatment.
- Residuals / new observations:
  - Notifications footer: "Allow notifications" wraps to two lines on iOS at
    half-width, so the two footer pills render unequal heights (Android fits on
    one line). Consider a shorter label ("Allow") in a copy pass.
  - Completion data rows still restate labels in their values ("Next period
    est." → "Next period expected Aug 21 to 25") — UL-22 family; values come
    from shared prediction formatters, left for the copy pass.
  - Onboarding paywall deep-scroll: Detox cannot recover scroll after
    scrollTo('bottom') (see UL-17 above) — keep using incremental scrolls in
    any future harness work.

## Primitives-pass-2 fix log (2026-07-23, branch ui-lift/primitives-pass-2 — evidence in ../primitives-pass-2/)

Scope: the three Wave B/C primitive escalations (SelectionChip + Screen frozen
during the waves). Evidence naming: before-/after-<surface>-<platform>.png.

- FIXED: UL-71 root (069ac22f) — Screen now applies `initialScrollOffsetY`
  cross-platform: the `contentOffset` prop stays the iOS path; everywhere else
  the same request runs as an imperative scrollTo right after mount (mirroring
  iOS's at-mount clamp semantics for screens that hydrate async), and scroll
  tracking (`scrollY` + ScreenScrollHeader's initial reveal) is seeded with the
  offset the platform actually renders on its first frame — never an unapplied
  request. The Wave B calendar workaround is removed: CalendarScreen requests
  its compact nudge unconditionally again and the `platformOsOverride` test
  seam is gone. Proof: after-calendar-mount-android byte-identical to before
  (top mount, single title, no revealed bar) and to iOS behavior;
  after-calendar-mount-ios pixel-identical to before except a 127x4px
  home-indicator strip (content region byte-stable). Cross-platform mid-scroll
  honoring proven via a temporary (uncommitted) 300px offset on Settings:
  after-initial-offset-demo-{android,ios}.png mount at the same mid-scroll
  position on both platforms.
  - Investigation note: live captures show the calendar's requested offset
    ALSO clamps to 0 on iOS today (the screen hydrates async, so content is
    short when the ScrollView mounts). The visible UL-71 defect was therefore
    entirely the pre-seeded sticky-bar tracking, which is what the fix
    removes; mount visuals stay identical on both platforms.
- FIXED: UL-73 + UL-64 residual (c2d48f6c) — SelectionChip's content row no
  longer flexWraps, so the reserved (invisible) indicator slot cannot break
  onto its own line; the label flex-shrinks and wraps internally as text
  instead. "Heavy"/"Sticky"/"Low"/"Positive test" now sit flush with row
  siblings and "Libido changes" keeps its checkbox inline on both platforms
  (after-day-log-{top,mid,bottom}-*.png vs before-*).
- FIXED: UL-20 root (6138d88b) — ConfidenceChip's `filled` variant now uses
  the warm espresso (textSecondary) fill in the primitive itself; the Wave B
  Today call-site override is removed. Calendar + Insights use the `inline`
  variant (unchanged, verified in after-calendar-confidence-*.png /
  after-insights-cycle-pattern-*.png); no surface uses the old ink fill, so no
  ink escape hatch was kept.
- Full jest suite green after all three items (285 suites / 4548 tests, no
  snapshot changes). Touched files: Screen.tsx 100% stmts, SelectionChip.tsx
  100%/100%, ConfidenceChip.tsx 100%/100%.

## Fix log — domain-logic cluster (2026-07-23)

Worktree: ui-lift/domain-logic. Evidence: docs/qa/2026-07-22-ui-lift/domain-logic/
(before-*/after-* pairs, iOS iPhone 17 Pro + Android Pixel 9 API 35). UL-14 and
UL-36 (both PLAUSIBLE) were reproduced live in the exact ledger state before
fixing. The tenure fixtures are date-seeded, so on the 2026-07-23 capture day the
exact P0 states did NOT reproduce verbatim: the committed UL-02 before frame shows
the milder "Somewhat variable / +/- 6 days over 21–60d bars" (same dishonesty
family, not the ledger's "Consistent / +/- 1 days"), and the UL-81 tenure-irregular
before/after pair shows a legitimate 1-day "FOLLICULAR 6-6" — that pair is a
PROTECT-CHECK proving 1-day phases survive the filter, not defect evidence. The
actual inverted-range repro is the UL-05 qa-rich pair. The exact ledger states that
could not be re-captured live (27,38,26,27,45,26,31,64,21 classification;
"FOLLICULAR 6-5" inversion) are pinned as unit-test fixtures instead.

- FIXED: UL-02 (P0) — root cause: `resolveCycleLengthConsistencyLevel`
  (buildInsightsScreenModel.ts) classified on `statistics.spreadDays`, the MAD
  spread of the post-outlier-rejection SURVIVORS (cycleStatistics.ts step 5).
  On the ledger data (27,38,26,27,45,26,31,64,21) the MAD step rejects
  38/45/64 as outliers; the surviving 21–31 cluster spreads 0.74 → rounded to
  "+/- 1 days" and labelled "Consistent on average" over visibly irregular
  bars. Fix: `computeCycleStatistics` now also reports `rawSpreadDays`
  (pre-rejection MAD spread), `madOutlierCount`, and `boundsSampleSize`;
  classification runs on the raw spread with an escalation to 'varies-widely'
  when >= 2 intervals and >= 1/3 of the bounds-plausible set were rejected as
  outliers (when a third of your cycles are "outliers", the outliers are the
  pattern). Survivor spread still drives prediction windows (unchanged
  engine). The ledger sequence now classifies 'varies-widely'; the live
  irregular preset shows "Varies widely / Ranging widely..." on both
  platforms. Regular preset stays "Consistent on average" (calm copy
  protected; single-lapse histories also stay consistent — median-based raw
  spread ignores one anomaly). Pluralization sibling: consistent footnote now
  floors the cited spread at 1 and uses a new singular catalog string
  `insights.cycleLength.footnoteConsistentOne` in all 8 locales — the live
  "+/- 0 days" (regular preset) and "+/- 1 days" states are both gone.
  Evidence: before/after-UL-02-tenure-irregular-insights-{ios,android}.png,
  after-UL-36-tenure-regular-insights-{ios,android}.png ("+/- 1 day" line).

- FIXED: UL-05 + UL-81 (P1) — root cause: the phase MATH is correct
  (buildCyclePhaseBreakdown clamps: a 25-day cycle with a 6-day period and
  fertile offset 6 legitimately has ZERO follicular days), but both renderers
  drew the zero-length phase anyway: CycleRibbon's legend derives startDay =
  prevEnd + 1, so a zero-width phase always prints an inverted "7-6"/"6-5"
  range, and the Insights phase-rhythm card printed "Follicular 0d" with an
  empty track. Designed treatment (deliberate, tested): omit zero-length
  phases from the ribbon segments, the ribbon legend, and the phase-rhythm
  rows — remaining ranges stay contiguous (PERIOD 1-6 / FERTILE 7-12 /
  LUTEAL 13-25) and only phases that occur in this cycle are claimed.
  Non-zero phases (e.g. the irregular preset's 1-day "FOLLICULAR 6-6") stay.
  Evidence: before/after-UL-05-qa-rich-today-{ios,android}.png (inverted
  range gone), before-UL-05-qa-rich-insights-android.png +
  before-UL-36-qa-rich-insights-ios.png vs
  after-UL-05-qa-rich-insights-{ios,android}.png ("Follicular 0d" row gone).

- FIXED: UL-14 (P1) — reproduced live (was PLAUSIBLE): "Logged on 0 of 6
  fertile-window days." directly above four cards dated Apr 12–14 on
  insights/ttc (qa-rich-history, both platforms). Root cause: the description
  counts TTC-observation days inside `prediction.fertileWindow` (the CURRENT,
  rolled-forward window — Jul 16–21 at capture time), while
  `latestHighlights` were simply the most recent observations from ANY date,
  rendered inside the same "Current fertile window" card. Fix:
  `buildTtcHighlights` (buildInsightsScreenModel.ts) now filters to the same
  window the count describes, so the claim and the cards beneath it can never
  disagree; out-of-window observations still appear, dated, in the separate
  "Recent TTC logs" card (unchanged). Evidence:
  before/after-UL-14-qa-rich-insights-ttc-{ios,android}.png.

- FIXED: UL-36 (P2) — reproduced live (was PLAUSIBLE): Insights "What your
  last nine cycles say." vs Today chip "11 cycles" / Settings "11 cycles
  logged" (tenure-irregular) and "13 cycles" (tenure-regular). Root cause:
  THREE windows were in play — the chart's arbitrary `slice(-9)`, the
  engine's 12-interval statistics window (MAX_INTERVAL_WINDOW, which the
  card's avgDays + classification are computed over), and the LT-23
  "total period starts on record" convention shared by Today/Calendar/
  Settings. Fix: the chart now shows the engine's own window
  (`slice(-MAX_INTERVAL_WINDOW)`, constant now exported from
  cycleStatistics.ts so they cannot drift) and the English headline word list
  extends to twelve — so the title, the bars, and the classification all
  describe ONE window ("last twelve cycles" over 12 bars on the regular
  preset, "last ten" over 10 on irregular). Today/Settings deliberately keep
  the LT-23 totals ("13 cycles" = started cycles on record, qualified by
  "Based on 13 local cycle starts" / "logged"); the remaining
  started-vs-completed off-by-one is two explicitly-worded windows, not an
  arbitrary third. Evidence: before/after-UL-36-tenure-regular-insights-ios,
  after-UL-36-tenure-regular-insights-android,
  before/after-UL-36-tenure-irregular-settings-ios,
  before/after-UL-02-tenure-irregular-insights-* (title+bars),
  before-UL-36-qa-rich-{insights,settings}-ios.

- Suite: 286 suites / 4570 tests green; typecheck + lint clean. Touched files
  100% line coverage (cycleStatistics.ts, buildInsightsScreenModel.ts,
  formatObservedCycleCount.ts, CycleRibbon.tsx, InsightsScreen.tsx,
  messages/insights.ts). Notes: the plural `footnoteConsistent` branch is now
  defensively unreachable with integer day intervals (consistent implies
  rounded spread <= 1 after flooring) but kept for robustness; the
  buildInsightsScreenModel branch % is dominated by pre-existing per-locale
  ternary ladders untouched by this cluster.

## Fix log — Phase 4 adversarial panel (2026-07-23)

The final dual-platform sweep (docs/qa/2026-07-22-ui-lift/phase-4/, iOS 92 +
Android 77 captures, all presets) fed a 4-lens adversarial panel (ui-fidelity,
accessibility, correctness, android-idiom). Orchestrator personally verified every
flagged item in the pixels. Exactly ONE new actionable defect survived to CONFIRMED;
the rest were downgraded, closed as artifacts, or ledgered as P2/P3 deferrals (below).

- FIXED: **UL-88 [P1][correctness-copy] "Nothing unusual" contradicts a
  varies-widely verdict.** The cycle-pattern detail screen
  (InsightsCyclePatternScreen) renders `model.observations` (discrete anomalies
  from the prediction engine) and, when that list is empty, fell back to
  `insights.observations.allClear` = "Nothing unusual in your recent logged
  cycles." — UNCONDITIONALLY. On tenure-12mo-irregular (cycles 21–60d, sibling
  cycle-length card reads "Varies widely") the current cycle tripped no discrete
  anomaly, so the screen told an irregular user nothing was unusual — the exact
  UL-02 honesty violation in a code path the domain-logic cluster's headline fix
  never touched. The far *less* variable qa-rich preset correctly flags "A longer
  cycle than usual", confirming it is a real miss, not calm framing. Root cause:
  the all-clear line was not conditioned on the cycle-length classification.
  Fix: `buildInsightsScreenModel` now derives `observationsAllClear: 'calm' |
  'varies-widely'` from `cycleLengthData.consistencyLevel` (escalates ONLY on
  'varies-widely'; 'somewhat-variable' and calmer keep the reassuring line); the
  screen picks `insights.observations.allClearVariesWidely` ("Your recent cycles
  have varied quite a bit in length. Cycles vary for lots of everyday reasons." —
  calm, non-medical) over `allClear` accordingly. New i18n key added in ALL 8
  locales. TDD: buildInsightsScreenModel.uiLiftDomainLogic.test.ts (+3:
  varies-widely→'varies-widely', consistent→'calm', somewhat-variable→'calm');
  InsightsDetailScreens.test.tsx (+1 end-to-end: a varies-widely, anomaly-free
  history renders the honest line and NOT "nothing unusual"). Verified live on
  BOTH platforms (before/after-UL-88-tenure-irregular-cycle-pattern-{ios,android}.png
  under phase-4/ul88-fix/). Full suite 286/4574 green, tsc + lint clean.

### Panel findings NOT fixed (verified, downgraded or deferred)

- **android-idiom "iOS-style pill switches, not M3" (agent P1 → downgraded P3):**
  false alarm on the "faux-iOS" framing — the Android control IS the native RN
  `<Switch>` (thinner track, overhanging thumb), visibly DIFFERENT from the iOS
  UISwitch, not a pixel-identical faux-iOS port. It is simply not the newest M3
  large-thumb variant, which RN's built-in Switch does not provide without a
  custom component (out of scope). Off-state track contrast on bone is the real
  residual → folds into UL-86 (physical-device sign-off).
- **correctness "Flo import shows clue-export-fixture.json" (P2 → NOT-A-DEFECT):**
  QA-harness artifact. The import gallery pre-seeds one fixture file for both the
  Clue and Flo source screens; real users pick their own file, so the
  source-label vs selected-file "contradiction" is not user-reachable.
- **correctness cross-tab "N cycles" vs "N−1 cycles" (P3, deferred):** the
  intentional two-window convention from the domain-logic cluster (Today/Settings
  = period-starts total; Insights = completed-interval window). Both qualified
  ("Based on N local cycle starts" / "What your last N cycles say"). UL-36 family;
  documented, not a contradiction.
- **ui-fidelity info-modal "Done" ghost pill (P3, deferred):** intentional quiet
  ActionButton variant; the empty state seen is largely the no-params deep-link
  fallback (real modal has content above the button).
- **UL-70 serif accent italic-on-Android vs roman-on-iOS (P2/P3, deferred):**
  re-confirmed systemic across Today/Insights/settings heroes; pre-existing,
  known, ledgered for a dedicated cross-platform typography pass.
- **accessibility tertiary-grey contrast, small info dots, sage Luteal meter fill
  (P2/P3, deferred):** all borderline pixel-estimates, none a clear AA fail on
  primary content; batched for a future contrast pass with sampled ratios.
- Panel EXCELLENT list (protect): onb-01-welcome, insights-monthly-briefing,
  settings-reminders cards, paywall plan cards, insights-cycle-pattern two-panel.

---

## Phase-4 follow-up fixes (post-panel, user-directed 2026-07-23)

After the Phase-4 adversarial panel, the user chose to resolve three of the
deferred items now (rest stay deferred with sign-off). All landed on
`ui-lift/phase4-followups`, verified live on BOTH platforms, full suite green
(286 suites / 4575 tests), tsc + lint clean.

- **Detox smoke hardening (4b9e28f0):** the iOS smoke spec asserted the paywall
  headline via `by.text('Start your free trial.')`, which Detox resolved to the
  screen-spanning SafeAreaView container (~27% visible < 75% threshold) and
  timed out on `toBeVisible` even though the title was plainly rendered
  (root-caused via DETOX_VISIBILITY mask + testDone.png). NOT a product bug — a
  matcher false-negative. Fix: `Screen` now stamps its large string title with
  `${testID}-title` (distinct from the collapsed sticky `-sticky-header-title`),
  and smoke.e2e.js:434 asserts `by.id('onboarding-paywall-screen-title')`.
  Screen.test.tsx gains a test that the title is exposed under that id.
- **UL-70 true italic serif accent (e752e901):** the editorial accent words
  (ItalicTitle + 7 screen heroes) used `fontStyle:'italic'` on the roman-only
  Newsreader face. iOS declined to synthesise (rendered upright); Android faked
  a slant — a genuine cross-platform divergence. Fix: load the real
  Newsreader_{400,500,600}_Italic faces, add `serif*Italic` fontFamilies + an
  `italicSerifFamily()` mapper, and set the italic family directly (dropping
  `fontStyle` so Android does not double-slant). Now true italic, identical on
  both platforms. Evidence: phase-4/ul70-fix/.
- **Contrast pass (583a4872):** (a) `bone.inkMute` #7A6A5E→#6A5A4E — tertiary
  body text measured 3.97:1 on cards / 4.42:1 on bg (below AA 4.5:1), now
  5.05–6.08:1. (b) InsightsScreen `phaseBarFill` gains a hairline boundary so
  the pale Follicular/Luteal meter fills (~1.1:1 vs track) have a legible
  extent, without recolouring the sage shared with the protected calendar bands
  (3:1 non-text contrast is unachievable in-palette for those pale fills).
  Evidence: phase-4/contrast-fix/ (before+after Insights, iOS + Android).

Still deferred (user-signed): UL-86 Android switch off-state track contrast +
physical-device sign-off; info-modal quiet "Done" variant; remaining borderline
info-dot sizing. Physical-device frost sign-off from the glass refresh also
remains an outstanding human step. No store screenshots (no release cut).
