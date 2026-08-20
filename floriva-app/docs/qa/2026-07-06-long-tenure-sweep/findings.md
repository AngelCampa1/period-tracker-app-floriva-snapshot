# Long-Tenure Bug Hunt — Findings Ledger (Workstream E)

Campaign: 1.2.0 long-tenure bug hunt. Seeded by Phase 1 (static-analysis
fan-out with probe tests), executed 2026-07-06/07 on
`feature/1.2.0-smarter-predictions`. See `README.md` in this directory for
Phase 0.

Conventions:

- **CONFIRMED** = demonstrated with a committed probe test (file:line cited)
  or an equivalent executable demonstration. **PLAUSIBLE** = code-level
  evidence exists but the failure mode was not demonstrated end-to-end; the
  blocking reason is stated.
- All probes follow the repo probe convention: they assert **current**
  behavior (suite stays green); fixing a bug flips the probe's assertion.
- Every engine probe is deterministic: `buildTenureDataset(variant, todayIso)`
  is a pure function, and the probes pass a fixed `todayIso = 2026-07-06`.
- Original-suspect disposition values: `fixed-by-1.2.0` / `still-present` /
  `partially-fixed` / `new` (not an original suspect) / `by-design`.
- **Fix status** (Phase 6, group A -- engine/model/copy; group B --
  notifications/hydration/import-policy): `FIXED` means the probe's
  assertion was flipped to the SHOULD-BE behavior, the fix landed, and the
  full suite (259 suites / 4086+ tests) stayed green. Commit SHAs are on
  `feature/1.2.0-smarter-predictions`.

## Open findings

### LT-01 — Calendar grid `cycleDay` unbounded past the current cycle

- **Severity**: medium
- **Status**: CONFIRMED —
  `tests/features/calendar/buildCalendarScreenModel.probe.longTenure.test.ts:36`
  (day 32 of a 28-day cycle on Jul 31 of the *current* month) and `:57`
  (day 96 on a future-month cell).
- **Surface**: Calendar tab month grid → day card ("Cycle day {day}",
  `CalendarScreen.tsx:400`).
- **Detail**: `buildCalendarScreenModel` computes `cycleDay` linearly from
  the rolled current-cycle anchor with no per-cell roll or clamp. Any cell
  after `cycleStart + cycleLengthDays` shows an impossible cycle day.
- **Original-suspect disposition**: partially-fixed. The engine's anchor
  roll fixed Today (`prediction.current.cycleDay`) and CalendarDayScreen;
  the month-grid day card is the remaining unbounded consumer.
- **Fix status**: FIXED (`f9403f3`). Each grid cell now rolls the cycle
  anchor forward by whole cycles (bounded to `[1, cycleLengthDays]`),
  matching the day-level consumers' convention; cells before the resolved
  cycle start are unchanged (`null`). Probe flipped in
  `buildCalendarScreenModel.probe.longTenure.test.ts`. Golden diff (justified):
  `buildCalendarScreenModel.adversarial.test.ts`'s "increments by exactly 1"
  test crossed a real cycle boundary (Apr 3 start + 28 = May 1) -- updated to
  assert the bounded wrap-to-1 instead of unbounded growth.

### LT-02 — Settings hub "cycles logged" stat massively over-counts

- **Severity**: medium (flagship profile stat, wrong for every user; error
  grows with tenure)
- **Status**: CONFIRMED —
  `tests/features/settings/settingsCycleCount.probe.longTenure.test.tsx`
  ("BUG LT-02" describe: ONE fully-logged 5-day period displays
  "3 cycles logged"; the deterministic 13-cycle year displays
  "38 cycles logged").
- **Surface**: Settings hub profile card (`SettingsScreen.tsx:467-487`).
- **Detail**: `loadCycleCount` compares each bleeding day against the last
  counted START (`acc[acc.length - 1]`), not the previous bleeding day, so a
  continuous period spawns a new "cycle" every 2 days. Fix direction: reuse
  `collectPeriodStarts` (`src/lib/predictions/cycleHistory.ts`).
- **Original-suspect disposition**: new.
- **Fix status**: FIXED (`5834421`). `loadCycleCount` now calls
  `collectPeriodStarts` instead of the local comparison-against-last-count
  heuristic -- unified with LT-13 below (see that entry for the shared
  commit and golden-diff justification).

### LT-03 — Anomaly nudge backlog has no age cutoff

- **Severity**: medium
- **Status**: CONFIRMED —
  `tests/lib/predictions/buildPredictionResult.probe.longTenure.test.ts`
  ("BUG LT-03" describe: tenure-12mo-irregular yields long-cycle anomalies
  anchored 2026-06-05, 2026-02-08, 2025-11-02, 2025-08-31; dismissing the
  head promotes a 5-month-old anomaly, and the tail is >300 days old).
- **Surface**: Today anomaly nudge + Insights Observations (B5), via
  `detectAnomalies` + `filterDismissedAnomalies`.
- **Detail**: every completed interval in the full history is re-detected on
  every run and nothing filters by age — a long-tenure user must dismiss a
  parade of stale historical anomalies one by one.
- **Original-suspect disposition**: new (v2-specific; anomalies are a 1.2.0
  feature).
- **Fix status**: FIXED (`9692c18`). Added
  `COMPLETED_INTERVAL_ANOMALY_MAX_AGE_DAYS = 90` in `anomalies.ts`; a
  completed-interval short/long-cycle candidate anchored more than 90 days
  before `todayIso` is dropped before detection. Scoped to completed
  intervals only -- missed-expected-period, the open-cycle long-cycle check,
  and prolonged-bleeding are anchored at/near today by construction and
  stay unaffected. Probe flipped in `buildPredictionResult.probe.longTenure
  .test.ts`; new boundary tests (exactly-90-days-inclusive, 91-days-dropped,
  short-cycle equivalent, and the full "dismiss doesn't resurface stale
  history" scenario) added to `anomalies.adversarial.test.ts`. Interacts
  with LT-11 below on the same fixture -- see that entry. No pre-existing
  golden fixture needed changes (every existing anchor was already <= 90
  days old).

### LT-04 — Staleness never degrades the confidence LEVEL

- **Severity**: low-medium (trust/copy accuracy)
- **Status**: CONFIRMED —
  `tests/lib/predictions/buildPredictionResult.probe.longTenure.test.ts`
  ("BUG LT-04" describe: tenure-lapsed, silent for ~70 days: level `high`
  with reason code `consistent-recent-bleeding-history`).
- **Surface**: confidence badge + confidence info modal on Today, Calendar,
  Insights.
- **Detail**: `resolveConfidence` counts period starts but never consults
  the age of the newest start; only the `projected-forward` LIMITATION code
  records staleness. "Recent" in the reason code is factually wrong for a
  lapsed user.
- **Original-suspect disposition**: partially-fixed ("history never ages
  out" was fixed for the *estimate* via the 12-interval window — see R-C —
  but confidence still ignores recency).
- **Fix status**: FIXED (`d6e51fa`). `resolveConfidence` takes a new
  `isStale` flag; `buildPredictionResult` computes it as true when either
  the un-rolled calendar expectation is >30 days overdue OR the anchor
  rolled forward >= 2 whole cycles. Scoped to the terminal high-confidence
  branch: when stale, level degrades to medium and the reason code swaps
  from `consistent-recent-bleeding-history` to a new `stale-history` code
  (added to `ConfidenceReasonCode`, localized x8, made actionable via
  `confidenceImprovements.ts` -- surfaces a "log your latest period" row).
  Probe flipped in `buildPredictionResult.probe.longTenure.test.ts`.
  LEVELS moved for 2 fixtures in `irregularHistory.realworld.probe
  .adversarial.test.ts` (both `high` -> `medium`) -- justified: both are
  fixture-authoring artifacts where a fixed `todayIso` outlives a bounded
  history-generation loop (73 days and ~121 days/4 cycles past the last
  logged start respectively), i.e. genuinely stale by the new rule, not
  regular/fresh fixtures. All actively-logging tenure datasets and every
  other golden fixture are unaffected (verified via full-suite run).

### LT-05 — Cycle-event reminders are one-shot; a lapsed user gets at most one more notification per kind, ever

- **Severity**: medium (architectural; defeats the re-engagement purpose of
  period reminders for exactly the users who lapse)
- **Status**: CONFIRMED —
  `tests/lib/notifications/buildReminderPlans.probe.longTenure.test.ts`
  ("BUG LT-05" describe: lapsed dataset yields exactly one DATE-trigger plan
  each for period-start and fertile-window). Architectural half (no
  reschedule without app open): code-confirmed —
  `reconcileReminderNotifications` is invoked only from in-app flows;
  nothing OS-side repeats a DATE trigger.
- **Surface**: period-start / fertile-window local notifications.
- **Detail**: after the single scheduled trigger fires, no further
  cycle-event reminders exist until the user opens the app and a reconcile
  runs. Daily-cadence kinds are unaffected (OS repeats them). Fix direction:
  pre-schedule the next N projected occurrences per kind.
- **Original-suspect disposition**: still-present.
- **Fix status**: FIXED (group B, `0b25ca8`). Added
  `REMINDER_OCCURRENCE_HORIZON = 3` in `buildReminderPlans.ts`: cycle-event
  kinds (period-start, fertile-window) now resolve and schedule the next 3
  projected occurrences per kind instead of one. Occurrence 1 keeps the bare
  identifier (`reminder-period-start`) for back-compat with routing and
  in-flight OS notifications; occurrences 2..N get a `#n` suffix
  (`reminder-period-start#2`, `#3`). `reconcileReminderNotifications`
  (`reminderScheduler.ts`) now cancels every base identifier's full possible
  occurrence range on every reconcile (`KNOWN_REMINDER_IDENTIFIERS` expanded
  from 4 to 4 * `REMINDER_OCCURRENCE_HORIZON` = 12 entries), so a shrunk
  horizon or a disabled kind cleans up stale occurrences correctly.
  `resolveNotificationRoute` strips a trailing `#\d+` suffix before matching,
  so whichever occurrence actually fires routes identically (C2 quick-log
  category attachment is unaffected -- it is decided by `kind`, not
  identifier, in `buildReminderContent`). Two UI consumers that assumed "one
  plan per contributing preference" were fixed to filter to occurrence-1
  plans only (`buildReminderCenterModel.ts`'s Settings reminder-center list;
  `PrivateTimelineScreen.tsx`'s reminder summary row) -- both are per-kind
  summaries, not schedule dumps, and needed no test changes since their
  existing tests already encoded the one-row-per-kind contract.
  Discreet copy unaffected (verified: no date is ever interpolated into
  cycle-event notification copy, `notifications.cycleEvent.*` messages).
  Daily-log/birth-control reminders are unaffected (still exactly 1
  OS-repeating DAILY trigger each).

  **iOS 64-pending-notification budget arithmetic**: 2 daily-cadence kinds
  (daily-log, birth-control) -> 1 pending notification each (OS DAILY
  trigger repeats without rescheduling) = 2. 2 cycle-event kinds
  (period-start, fertile-window) -> up to `REMINDER_OCCURRENCE_HORIZON` = 3
  pending DATE triggers each = 6. Plus 1 optional billing reminder
  (`reminder-first-charge`, scheduled separately) = 1. Total = 2 + 6 + 1 = 9,
  far under Apple's 64-notification cap even before accounting for not every
  kind being enabled simultaneously. Horizon has headroom to grow to ~30 per
  cycle-event kind before approaching the cap. Documented inline in
  `buildReminderPlans.ts` next to the constant.

  Probe flipped in `buildReminderPlans.probe.longTenure.test.ts` (now
  "RESOLVED LT-05": asserts `REMINDER_OCCURRENCE_HORIZON` plans per
  cycle-event kind, strictly increasing dates, first occurrence keeps the
  bare identifier). Golden diffs (justified -- every one is the same
  "assumed exactly 1 cycle-event plan" assumption meeting the new horizon):
  `buildReminderPlans.test.ts`, `buildReminderPlans.adversarial.test.ts`,
  `buildReminderPlans.probe.adversarial.test.ts` (all updated from
  `toHaveLength(1)` to `toHaveLength(REMINDER_OCCURRENCE_HORIZON)` or
  equivalent, checking occurrence 1 via `plans[0]` or identifier lookup for
  date-specific assertions), and `reminderScheduler.probe.adversarial
  .test.ts` (cancel-count and schedule-count expectations recomputed for the
  expanded identifier set and multi-occurrence scheduling).

### LT-06 — Insights built from a hardcoded 120-day window while copy implies stored history

- **Severity**: low-medium (trust rule: claim vs implementation)
- **Status**: CONFIRMED —
  `tests/features/insights/buildInsightsScreenModel.probe.longTenure.test.ts`
  ("BUG LT-06" describe: windowed feed reports "5 logged period starts" vs
  14 with full data); window constant at
  `src/features/insights/useInsightsModel.ts:37`.
- **Surface**: Insights tab (cycle pattern card, condition summaries, TTC
  summary), copy "Built from cycle history stored on this device"
  (`src/localization/messages/insights.ts`).
- **Detail**: the hydration hook reads `[-120d, today]`, so a year of stored
  cycles informs neither the pattern readouts nor the engine statistics the
  screen re-runs (which could window to 12 intervals ~= 13 months). Either
  widen the read or qualify the copy.
- **Original-suspect disposition**: still-present.
- **Fix status**: FIXED (group B, `6e4260d`). Per the CLAUDE.md trust rule
  (fix the code, not the claim), widened `useInsightsModel.ts`'s hydration
  from `repositories.dailyLogs.listByDateRange(addDays(todayIso, -120),
  todayIso)` to `repositories.dailyLogs.listAll()` -- the same unbounded read
  `PrivateTimelineScreen.tsx` already uses. Chose "hydrate everything" over
  picking a new, still-arbitrary window size (e.g. `13 * 45 ~= 585` days)
  because (a) it is simpler and has no edge case for irregular users with
  cycles near the 60-day hard cap, where even a 585-day window could still
  under-serve the engine's 12-interval appetite, and (b) LT-10's probe
  measured `buildPrivateTimelineModel` (the same class of pure
  array-filter/reduce transform over `DailyLogEntry[]`) building in <5ms at
  341 rows / 12 months of data (`buildPrivateTimelineModel.probe.longTenure
  .test.ts`), so `buildInsightsScreenModel` doing the same work is not a
  measurable cost concern. `buildMonthlyBriefing` (the "monthly briefing"
  card cited as a sibling consumer) needed no separate fix: it is a pure
  function inside `buildInsightsScreenModel.ts` itself operating on whatever
  `logEntries` the hook passes in, so it inherits the wider window
  automatically -- verified via `InsightsDetailScreens.test.tsx`'s monthly
  briefing test, unchanged and still green. Probe flipped in
  `buildInsightsScreenModel.probe.longTenure.test.ts` (now "RESOLVED LT-06").
  Coverage split, stated precisely: the flipped probe feeds the full dataset
  to the PURE model function (`buildInsightsScreenModel`) and asserts the
  full-data 13-logged-period-starts label and `high` confidence -- it does
  NOT exercise `useInsightsModel`'s hook read path itself. Hook-level
  verification comes from the two screen-level test files whose repository
  mock changed from `listByDateRange` to `listAll`
  (`InsightsScreen.test.tsx`, `InsightsDetailScreens.test.tsx`): the mock
  rename means those suites now fail if the hook ever reverts to a windowed
  read, but no behavioral assertions changed beyond the exact
  `listByDateRange('2025-12-19', '2026-04-18')` call-arg checks becoming
  `listAll` call-count checks (the date-range arguments no longer exist).

### LT-07 — 12-month cutoff asymmetry: file imports unlimited, manual quick-entry capped

- **Severity**: low (product-rule inconsistency, not data corruption)
- **Status**: CONFIRMED —
  `tests/lib/parsing/importParsers.probe.longTenure.test.ts` ("BUG LT-07"
  describe: Clue/Flo rows from 2018/2019 import with zero skips; the manual
  path skips the same-age date with the 12-month-window message). Also
  pinned end-to-end by the committed fixtures in
  `tests/testing/qaFixtures.test.ts` (Phase 0/E2).
- **Surface**: Import flow (Clue/Flo file paths vs manual quick-entry).
- **Detail**: only `parseManualHistoryImport` honours a lookback
  (`ImportFlowProvider.getManualHistoryLookbackStartIso`). Decide one rule
  and apply it consistently; recommendation: drop the manual cap (import is
  strategic; the file paths already accept full history) or surface the cap
  in UI copy on both paths.
- **Original-suspect disposition**: known (E0 discovery), documented.
- **Fix status**: FIXED (group B, `ee8fac7`) as a documented, intentional
  policy -- not a bug. **Decision**: keep both behaviors, make the rationale
  explicit in code. File imports (Clue/Flo) keep accepting history of any
  age: import is a flagship/strategic feature (CLAUDE.md "Import Direction"),
  a long-tenure switcher's full history is exactly what makes switching
  worthwhile, and old data cannot hurt the prediction engine even where it
  cannot help beyond a point (`buildPredictionResult` windows its own
  statistics to the most recent 12 completed intervals regardless of how
  much is stored, `MAX_INTERVAL_WINDOW` in `cycleStatistics.ts`). Manual
  quick-entry's 12-month cap is kept as a deliberate UX simplification of a
  hand-picked-dates flow, not a data-integrity policy -- asking a user to
  hand-enter arbitrarily old dates one at a time via free-text is a bad
  interaction beyond "recent history I forgot to log"; a user with
  genuinely old history should use file import instead.

  **Implementation**: `getManualHistoryLookbackStartIso` (plus its
  `formatLocalIsoDate` helper) was duplicated verbatim in
  `ImportFlowProvider.tsx` (the routed flow) and
  `screens/ImportScreen.tsx` (an unrouted/legacy screen kept only for its
  `formatImportDateRange` export, confirmed via grep that the `ImportScreen`
  component itself is not imported anywhere except its own test). Both
  copies removed; the helper now lives once, exported from
  `src/features/import/model.ts`, with the full policy rationale documented
  as a comment on the export. Both call sites (`previewManualHistory` /
  `previewFileImport` in each file) got short pointer comments back to that
  rationale. Probe updated in `importParsers.probe.longTenure.test.ts` (now
  "RESOLVED LT-07": same assertions, reframed from "suspected bug" to
  "documented policy, duplication removed"). No behavior changed, so every
  existing import test (530 tests across 14 files) passed unchanged.

### LT-08 — Dec→Jan prediction range label omits the year

- **Severity**: low (cosmetic ambiguity)
- **Status**: CONFIRMED —
  `tests/features/calendar/buildCalendarScreenModel.probe.longTenure.test.ts`
  ("BUG LT-08" describe: `formatPredictionRangeLabel('2026-12-30',
  '2027-01-03')` → "Dec 30 to Jan 3").
- **Surface**: next-period range labels (Calendar summary, Today).
- **Detail**: no year is ever rendered, so a window spanning New Year is
  ambiguous, especially in January history views. Include the year when
  start/end years differ.
- **Original-suspect disposition**: still-present.
- **Fix status**: FIXED (`9edd086`). Added `formatMonthDayYearLabel`
  (same `Intl.DateTimeFormat` pattern as the existing month-day helper, plus
  `year: 'numeric'`) and used it for both sides of the range whenever
  start/end years differ; same-year ranges are unchanged. Probe flipped in
  `buildCalendarScreenModel.probe.longTenure.test.ts`; added explicit x8-locale
  coverage (both-years-present on cross-year, no-year on same-year) in
  `presentation.probe2.adversarial.test.ts`. No golden diffs -- every
  pre-existing exact-string assertion uses same-year dates.

### LT-09 — Lapsed user's calendar shades a phantom "predicted period" in a month they never logged

- **Severity**: low
- **Status**: CONFIRMED —
  `tests/features/calendar/buildCalendarScreenModel.probe.longTenure.test.ts`
  ("BUG LT-09" describe: tenure-lapsed: Jun 24–28 shaded `predicted-period`;
  last real log May 1).
- **Surface**: Calendar month grid.
- **Detail**: the rolled synthetic anchor seeds the "current expected
  period" shading; when the anchor was rolled (projected-forward), those
  past shaded days were never confirmed by any log. Suppress or restyle
  when `rolledCycles > 0`.
- **Original-suspect disposition**: partially-fixed (the original "stale
  anchor shades an old month" is gone — the roll moved the artifact rather
  than removing it).
- **Fix status**: FIXED (`d6e51fa`). `buildCalendarScreenModel` checks the
  LT-04 staleness signal (`confidence.reasonCodes` containing
  `stale-history`) and suppresses ALL predicted-period shading while stale
  (both the current-cycle and next-period windows, since both derive from
  the same rolled anchor). Probe flipped in `buildCalendarScreenModel
  .probe.longTenure.test.ts`. No golden diffs -- only lapsed/stale fixtures
  trigger the suppression.

### LT-10 — Private timeline: unbounded read + non-virtualized render at 341 rows/year

- **Severity**: medium (upgraded from low-medium once measured), perf
- **Status**: CONFIRMED (Phase 3 on-device + Phase 5 triage). Model half was
  already CONFIRMED by
  `tests/features/timeline/buildPrivateTimelineModel.probe.longTenure.test.ts`
  (12-month dataset → 341 items; model build <5ms). The render half's
  blocking reason (on-device measurement) was satisfied by the Phase 3
  sweep: `/calendar/timeline` at 12-month volume mounted all 341
  `Pressable` rows eagerly (`PrivateTimelineScreen.tsx`,
  `visibleItems.map(...)` inside the non-virtualized `Screen` ScrollView),
  and that mounted-view count made the app's MAIN thread cost of the
  harness's synchronous scroll gesture effectively unbounded — 100% CPU for
  minutes (see LT-15 for the exact freeze mechanism and the `sample`
  evidence). Render probe:
  `tests/features/timeline/privateTimelineVirtualization.probe.longTenure.test.tsx`
  (pre-fix: 345 mounted rows in one commit; post-fix: bounded window ≤30).
- **Surface**: `/calendar/timeline`.
- **Original-suspect disposition**: still-present (render side); the
  model-build half of the suspicion is cleared.
- **Fix status**: FIXED (Phase 5, workstream E triage). The timeline now
  renders through a virtualized list: `Screen`
  (`src/components/primitives/Screen.tsx`) gained an opt-in
  `virtualizedList` mode — when provided, the screen's header/body content
  becomes a FlatList `ListHeaderComponent` and the rows virtualize
  (`initialNumToRender=12`, `maxToRenderPerBatch=16`, `windowSize=7`,
  `removeClippedSubviews`), preserving the same `${testID}-scroll` testID
  and content styling so every existing scroll-driven test and the Detox
  harness work unchanged. `PrivateTimelineScreen.tsx` passes its items
  through that mode instead of `.map()`-ing them into the ScrollView.
  Verified on-device in the Phase 5 re-sweep: both 12-month timelines
  captured top/mid/bottom cleanly with CPU 3–77% (no 100% pin), scroll
  videos recorded. Probe flipped in
  `privateTimelineVirtualization.probe.longTenure.test.tsx`.

### LT-11 — Long-cycle bound derives from post-rejection spread, flagging an irregular user's own rhythm

- **Severity**: low-medium (design tension; trains users to ignore nudges)
- **Status**: CONFIRMED —
  `tests/lib/predictions/buildPredictionResult.probe.longTenure.test.ts`
  ("BUG LT-11" describe: irregular-support user with recurring 24–60d
  cycles gets 4 long-cycle flags: bound = min(60, 26 + max(7, 2.97)) = 33
  because MAD rejection discarded the long intervals before spread was
  computed).
- **Surface**: anomaly detection (`anomalies.ts` bounds) feeding Today
  nudge / Insights Observations.
- **Detail**: interacts with LT-03 (the 4 flags then never age out). For
  `supportsIrregularCycles` users, consider deriving the bound from the
  pre-rejection observed range or a wider margin. The
  REGULAR_USER_LONG_STOP_DAYS product rule is respected (irregular users
  are exempt from the 38-day hard stop) — this is about the formula bound.
- **Original-suspect disposition**: new (v2-specific).
- **Fix status**: FIXED (`9692c18`; self-masking correction in Phase 6
  batch-review follow-up). For `supportsIrregularCycles` users, each
  completed interval's long-cycle bound now floors at
  `max(marginFloor, spread, observedMaxOfOTHERIntervals - typical)`
  (`collectTopTwoIntervals` in `anomalies.ts`), using the user's own
  pre-MAD-rejection observed range rather than just the post-rejection
  survivor spread. The interval UNDER TEST is excluded from its own floor
  computation -- the batch review caught that the first cut computed the
  max over ALL intervals, which let a record-setting interval raise the
  bound to exactly itself (self-masking): a genuinely new SUB-cap extreme
  (e.g. prior max 45d, new 55d) could never fire post-completion. With the
  exclusion, an interval equal to the observed max is judged against the
  SECOND-largest (identical when the extreme recurs -- the user's own known
  rhythm stays quiet); everything else is judged against the largest, and
  the open-cycle check (not a completed interval) always uses the plain
  largest. A genuinely new extreme now fires both above the 60-day hard cap
  AND below it. Non-irregular users are unaffected (margin stays 0). Probe
  flipped in `buildPredictionResult.probe.longTenure.test.ts`; the floor and
  the self-masking fix are demonstrated directly against `detectAnomalies`
  with controlled recent dates in `anomalies.adversarial.test.ts`
  (own-rhythm-not-flagged, irregular-only-scope, above-cap new extreme,
  SUB-cap new extreme fires, recurring sub-cap extreme stays quiet). On the
  original finding's exact fixture, this fix compounds with LT-03's recency
  cutoff to a fully quiet result (see LT-03 above) -- the fixture's
  "backlog" turned out to be either stale history or the user's own known
  rhythm.

### LT-13 — Three divergent period-start counters disagree on the same data

- **Severity**: low (consistency; LT-02 is the acute case)
- **Status**: CONFIRMED — on the same deterministic 12-month dataset:
  engine `collectPeriodStarts` = 13
  (`settingsCycleCount.probe.longTenure.test.tsx`, fixture assertion),
  insights `countPeriodStarts` = 14
  (`buildInsightsScreenModel.probe.longTenure.test.ts`, LT-13 side note),
  Settings hub = 38 (same settings probe).
- **Surface**: Settings profile card, Insights cycle pattern card, engine.
- **Detail**: `countPeriodStarts` (insights) uses gap>1-day with no minimum
  cycle separation; Settings compares against last start; the engine
  requires 15-day separation + contiguity. Consolidate on
  `collectPeriodStarts`.
- **Original-suspect disposition**: new.
- **Fix status**: FIXED (`5834421`, shared commit with LT-02). Both
  Settings' `loadCycleCount` and Insights' `countPeriodStarts` now defer to
  `collectPeriodStarts` (`cycleHistory.ts`) -- the same canonical detector
  the prediction engine uses. Insights' function is kept as a thin
  `string[]`-returning wrapper so its 3 existing call sites did not need
  structural changes. On the same deterministic 13-cycle dataset, engine,
  Insights, and Settings now all report 13 -- `collectPeriodStarts` is
  documented as the single source of truth for period-start counting.
  Probes flipped in `settingsCycleCount.probe.longTenure.test.tsx` (3/38 ->
  1/13 cycles) and the LT-06 side note in `buildInsightsScreenModel.probe
  .longTenure.test.ts` (14 -> 13 logged period starts on full data). Golden
  diffs (justified -- all are the 15-day `MIN_CYCLE_SEPARATION_DAYS` guard
  now applying where the old ad-hoc heuristics had none):
  `buildInsightsScreenModel.adversarial.test.ts` (a 13-day gap, a 4-day gap,
  and 2 sub-15-day candidates in a 10-date fixture are now correctly merged
  into their prior cycle) and `buildInsightsScreenModel.probe.adversarial
  .test.ts` (a 2-day gap and a 3-day gap with intervening spotting,
  likewise merged).
- **Residual (documented, not fixed)**: the three surfaces now share ONE
  counting method, but not one READ WINDOW -- Settings' `loadCycleCount`
  still reads a fixed 730-day (`listByDateRange(today - 730, today)`)
  window, while Insights is fed the hook's 120-day window (LT-06, still
  open) and the engine consumes whatever its caller loads. The "all three
  report the same number" guarantee therefore holds for tenures <= 2 years;
  a 3+-year user's Settings stat would count only their most recent 2 years
  of cycles. Acceptable for the profile-stat use case today; revisit if the
  stat is ever re-framed as an all-time total.

### LT-14 — "App freeze on old day view" (tenure-lapsed `/calendar/day/2025-06-13`)

- **Severity**: n/a as an app defect — harness-induced; app exonerated.
- **Status**: CONFIRMED as a harness wedge, NOT an app defect (Phase 5
  triage). The Phase 3 "JS thread pinned at 100% CPU on a blank faded day
  screen" is the same freeze class as LT-15: Detox's synchronous
  main-thread scroll action wedging during the capture loop (see LT-15 for
  the mechanism). The app path is exonerated three ways: (1)
  `tests/features/calendar/calendarDayLapsed.probe.longTenure.test.tsx`
  pins the exact hydration input (1 log entry in the 365-day window, a
  profile anchor ~320 days in the future) and proves `buildPredictionResult`
  terminates with `cycleDay = 1` and the full screen renders through the
  real sqlite harness within bounded time; (2) no Hermes/JS frames appeared
  in any freeze sample; (3) three consecutive clean on-device re-runs, plus
  the final Phase 5 re-sweep capture (oldest-day top+bottom in ~8s, CPU
  healthy).
- **Surface**: `/calendar/day/<oldest>` under `tenure-lapsed` — but only
  via the sweep harness.
- **Original-suspect disposition**: new → reclassified harness artifact.
- **Fix status**: FIXED in the harness (`e2e/long-tenure-sweep.e2e.js`):
  an `await settle(800)` before `scrollToTopBestEffort` keeps the scroll
  action from racing screen settle, and the LT-10 virtualization bounds the
  mounted-view count that made the wedge unbounded. Evidence replaced:
  `tenure-lapsed/ios/oldest-day.png` / `-b.png` (clean, fixed bundle);
  original kept as `oldest-day-FROZEN-evidence-before-fix.png`.

### LT-15 — Sweep "app freezes" are Detox's synchronous main-thread scroll, amplified by LT-10

- **Severity**: n/a as an app defect — root cause of the Phase 3 freeze
  evidence; the app-side amplifier is LT-10 (fixed).
- **Status**: CONFIRMED — live reproduction + macOS `sample` of the frozen
  process, committed at
  `triage/timeline-freeze-mainthread-sample.txt` (plus
  `triage/timeline-freeze-cpu-watchdog.log`). 100% of samples sit inside
  Detox's `ScrollToEdgeAction` → `-[UIScrollView(DetoxActions)
  _dtx_scrollWithOffset:...]` → `-[UIWindow safeAreaInsets]` churn on the
  app MAIN thread; the React JS thread is parked in `mach_msg` (idle). The
  per-scroll-step cost scales with the number of mounted views under the
  scroll view, so the 341 eagerly-mounted timeline rows (LT-10) made each
  harness scroll effectively unbounded (>4 min observed). This one
  mechanism explains all three Phase 3 "freeze" defects (timeline both
  variants, lapsed oldest-day intermittent). There is no
  setState-in-render loop in the app: the only reproducible render loop
  found during triage was a jest-mock artifact (per-render `repositories`
  identity), documented in the probes.
- **Surface**: sweep harness scroll captures; user-visible only insofar as
  LT-10 made real scrolling heavy.
- **Original-suspect disposition**: new.
- **Fix status**: FIXED — two-sided. App side: LT-10 virtualization (see
  above). Harness side: `settle(800)` before scroll-to-top in
  `e2e/long-tenure-sweep.e2e.js`. Phase 5 re-sweep of both 12-month
  timelines: clean top/mid/bottom captures, CPU 3–77% throughout, scroll
  videos recorded without stall.

### D5 (watch item) — Intermittent blank timeline viewport after programmatic scroll-to-bottom on Android

- **Severity**: n/a as a CONFIRMED bug — kept as a watch item, not a fixed
  defect, because it did not reliably reproduce.
- **Status**: NOT CONFIRMED as a reproducible defect. One Android capture
  during the long-tenure sweep
  (`tenure-12mo-regular/android/timeline-b-blank-after-scroll-evidence.png`)
  showed a fully blank timeline viewport immediately after a programmatic
  scroll-to-bottom on the LT-10-virtualized `PrivateTimelineScreen`; an
  immediate recapture of the same surface was clean. This is the classic
  FlatList "blank cell" symptom: on a fast/instant scroll (as the harness's
  programmatic scroll is), the viewport can momentarily land on rows outside
  the currently-rendered window before the next render pass fills them in,
  which reads as "blank" for exactly one frame/capture.
- **Surface**: `/calendar/timeline`, Android, LT-10's virtualized `FlatList`
  (`Screen.tsx`'s `virtualizedList` mode).
- **Mitigation applied (cheap hardening only, per this finding's
  instructions — not a fix for a CONFIRMED bug, a narrower safety margin
  against the failure class)**: `Screen.tsx`'s `virtualizedList` FlatList
  tuning widened: `windowSize` raised from 7 to 11 (roughly 2 extra
  screens' worth of pre-rendered rows on each side of the viewport instead
  of ~1), and `updateCellsBatchingPeriod={50}` added alongside the existing
  `maxToRenderPerBatch={16}` so batched cell updates land more predictably
  under fast scrolling. `initialNumToRender` (12) and
  `removeClippedSubviews` (on — already Android-sane default) were left
  unchanged; deliberately did not chase this further (e.g. disabling
  `removeClippedSubviews` on Android, which trades this narrow risk for a
  guaranteed larger native view count — reintroducing exactly what LT-10
  fixed) since the original symptom never reproduced a second time.
- **Verification**: full jest suite green after the tuning change; a new
  `Screen.test.tsx` case pins the tuned FlatList prop values
  (`windowSize=11`, `maxToRenderPerBatch=16`, `updateCellsBatchingPeriod=50`,
  `initialNumToRender=12`, `removeClippedSubviews=true`) so a future edit
  cannot silently narrow the window back down. No new on-device capture was
  attempted to "prove" the mitigation, consistent with this finding's
  instruction to keep this a documented watch item rather than claim a fix
  for an intermittent, unreproduced symptom.
- **Original-suspect disposition**: new (Phase 5 sweep, workstream E group
  3; carried over from the Phase 3 on-device sweep's raw capture evidence).
- **Fix status**: WATCH ITEM — mitigated (`7cae4ac`), not CONFIRMED-fixed.

### LT-16 — `/insights/condition/endometriosis` "never mounts" (tenure-12mo-irregular)

- **Severity**: n/a — by-design redirect; the sweep read it wrong (and the
  pmdd "pass" was a false positive).
- **Status**: CONFIRMED as by-design + harness false positive —
  `tests/features/insights/insightsConditionRedirect.probe.longTenure.test.tsx`
  (4 tests). The irregular variant's profile tags `conditionTags: ['pcos']`
  only, so `buildConditionSummaries` produces a pcos summary only, and
  `InsightsConditionScreen` deliberately self-redirects to `/insights` for
  any conditionKey without a summary (`shouldRedirectToInsights`). In the
  Phase 3 sweep: pcos genuinely rendered; pmdd was deep-linked while the
  pcos condition screen was still mounted, so the shared
  `insights-condition-screen` testID was momentarily visible (62 ms "pass")
  before the redirect landed — the captured `condition-pmdd.png` actually
  shows the Insights hub; endometriosis was deep-linked from the
  post-redirect hub, so the freshly-pushed screen redirected away before
  Detox's first visibility poll → 20 s timeout ("never mounts").
- **Surface**: `/insights/condition/<untagged>` deep links.
- **Original-suspect disposition**: by-design.
- **Fix status**: FIXED in the harness (`e2e/long-tenure-sweep.e2e.js`):
  `TAGGED_CONDITIONS_BY_VARIANT` declares which condition keys each variant
  tags; for untagged keys the sweep now waits for the `insights-screen`
  redirect target, records the timing as `<surface>-redirected`, and
  captures `<surface>-redirected-to-insights.png` instead of asserting the
  condition screen. Phase 5 re-sweep: both
  `condition-pmdd-redirected-to-insights.png` and
  `condition-endometriosis-redirected-to-insights.png` captured (redirect
  landed in 574 ms / 70 ms). Original false-positive evidence kept as
  `condition-pmdd(-b)-before-fix-false-positive.png`.

### LT-17 — January 2026 month grid fades out after Jan 28 (both 12-month variants)

- **Severity**: low-medium (real UX defect: blank month tail after every
  quick month flip, on any month)
- **Status**: CONFIRMED —
  `tests/features/calendar/calendarGridStagger.probe.longTenure.test.tsx`
  (pre-fix: max grid-cell `sequenceIndex` = 34 on the sweep dataset;
  post-fix: ≤ 5). Not a screenshot artifact and not January-specific: every
  grid cell was wrapped in a `MotionView preset="rowShift"` whose
  `sequenceIndex` was the CELL index (`rowIndex * 7 + columnIndex`, up to
  41 for a 6-week month). With `rowShift.delayStep = 50ms`, trailing cells'
  entering animations start up to ~2.1 s after mount, and every month flip
  remounts all cells (keys are ISO dates) — so for ~2.3 s after each flip
  the month tail renders at opacity 0. The sweep captured ~1.6 s after the
  last of six back-navigations, exactly mid-stagger (Jan 29–31 invisible);
  a real user flipping months sees the same blank tail.
- **Surface**: Calendar month grid (`CalendarScreen.tsx`), any month
  reached by flipping.
- **Original-suspect disposition**: new.
- **Fix status**: FIXED — the grid-cell stagger is now per WEEK ROW
  (`sequenceIndex={rowIndex}`, bounded ≤ 5), so a full month grid finishes
  revealing within ~430 ms of a flip while keeping the row-cascade motion.
  Probe flipped in `calendarGridStagger.probe.longTenure.test.tsx`.
  Verified on-device in the Phase 5 re-sweep: January 2026
  (`calendar-minus-6mo.png`) renders all 31 days at full opacity on BOTH
  12-month variants. Originals kept as
  `calendar-minus-6mo(-b)-before-fix.png`.

### LT-18 — Insights cycle-length card's classification copy is hardcoded, ignoring the engine's own statistics

- **Severity**: high (trust violation — CLAUDE.md "never make privacy/claims
  the implementation cannot support" extends to any claim the app makes
  about the user's own body-data patterns)
- **Status**: CONFIRMED —
  `tests/features/insights/buildInsightsScreenModel.probe.longTenure.test.ts`
  (pre-fix "BUG LT-18" behavior, now flipped to "RESOLVED LT-18"). Root
  cause pinned at `src/features/insights/buildInsightsScreenModel.ts`'s old
  `buildCycleLengthData` (fixed English-literal subtitle/footnote) and
  `src/features/insights/screens/InsightsScreen.tsx`'s hardcoded ternary
  (`'Consistent on average' : 'Not enough history yet'`,
  `'Within +/- 2 days...' : 'Starting estimate...'`).
- **Surface**: Insights tab, cycle-length card (subtitle + footnote under
  the bar chart).
- **Detail**: the card said "Consistent on average / Within +/- 2 days of
  your typical cycle" for EVERY user regardless of actual spread —
  reproduced over a genuinely 23–60-day-spread history
  (tenure-12mo-irregular), over a fixture where a 121-day gap interval was
  averaged into a naive mean shown as "60 AVG" (tenure-6mo-gap, before the
  fix the card's `avgDays` was a naive mean of the last 9 raw intervals,
  not the engine's MAD-filtered estimate), and at `n=1` (tenure-1mo-new,
  where "consistent" is meaningless with a single data point). This is
  exactly the class of claim CLAUDE.md's trust rules single out: the app
  asserted a pattern property of the user's own cycle that the underlying
  statistics did not support.
- **Original-suspect disposition**: new (Phase 5 sweep, workstream E group
  1).
- **Fix status**: FIXED, `f5f1d58`. Derived a new
  `CycleLengthConsistencyLevel` (`'not-enough-data' | 'consistent' |
  'somewhat-variable' | 'varies-widely'`,
  `src/features/insights/types.ts`) from the ENGINE's own
  `computeCycleStatistics` output via
  `resolveCycleLengthConsistencyLevel(statistics)`
  (`buildInsightsScreenModel.ts`): `not-enough-data` when
  `sampleSize < 2`; otherwise thresholds on `spreadDays` —
  `CONSISTENT_SPREAD_DAYS_MAX = 2` (consistent, ≤2d), `SOMEWHAT_VARIABLE_
  SPREAD_DAYS_MAX = 6` (somewhat-variable, ≤6d), else varies-widely. Copy
  is now generated per level via `resolveCycleLengthCopy` and 8 new
  locale-keyed strings under `insights.cycleLength.*`
  (`src/localization/messages/insights.ts`, all 8 locales: en, es, de, fr,
  ja, zh-Hans, pt, ru), interpolating the actual rounded `spreadDays` where
  the level supports a number (`consistent`/`somewhat-variable`).
  `InsightsScreen.tsx` now renders `model.cycleLengthData.subtitleLabel`
  / `.footnoteLabel` instead of hardcoded ternaries. Separately,
  `avgDays` was changed from a naive mean of the last 9 raw intervals to
  `prediction.cycleLengthDays` — the engine's own robust (MAD-filtered,
  recency-weighted) estimate — so the discarded 121-day gap interval in
  tenure-6mo-gap is no longer averaged into the displayed number (this
  same change is what resolves LT-21, see below). The chart's `bars` stay
  RAW/unfiltered by design (chart honesty: showing every logged interval,
  filtered or not, is itself informative) — only the summary number and
  classification copy now come from the engine. The PCOS row's existing
  honest "span 57 days" callout was left untouched (it already reported
  actual spread, not a canned claim).
  Copy-guard tests: `tests/localization/insightsMessages.test.ts` (new) —
  every locale defines every level's subtitle+footnote; `{days}`
  placeholder present in consistent/somewhat-variable and absent in
  varies-widely/not-enough-data; no locale's copy implies diagnosis or
  medical certainty; not-enough-data subtitle never claims regularity.
  Golden diffs, justified per-test in
  `buildInsightsScreenModel.adversarial.test.ts`: 5 tests' expected
  `avgDays` changed from naive-mean values to the engine's estimate (e.g.
  a single 41-day observed interval now reports 28 — the engine's
  fallback/floor estimate at `sampleSize < 3`, not the raw observation;
  3-start naive-mean 34 → weighted-median 33; a 365-day-gap survivor
  365 → 28; a leap-day-spanning fixture 30 → 28), each with an inline
  comment explaining why the new number is correct. `InsightsScreen.test
  .tsx` and `InsightsScreenBranches.test.tsx` updated to assert the new
  copy strings and the `consistencyLevel` field on hand-built model mocks.

### LT-21 — Phase-rhythm durations don't sum to the card's stated cycle length

- **Severity**: medium (internal coherence — same trust concern as LT-18,
  narrower blast radius)
- **Status**: CONFIRMED — reproduced pre-fix: phase-rhythm chip durations
  (period/follicular/fertile/luteal) summed to 26 days while the header
  read "34 AVG" (tenure-12mo-irregular). Root cause: the phase-rhythm card
  and the cycle-length card computed their headline numbers from two
  different sources — `buildCyclePhaseBreakdown`
  (`src/lib/predictions/cyclePhaseModel.ts`) waterfall-clamps phases to
  sum EXACTLY to whatever `cycleLengthDays` it's given (so the phase
  breakdown itself was internally consistent), but the OLD
  `buildCycleLengthData` fed the card's headline a naive mean of raw
  intervals instead of that same `cycleLengthDays`, so the two cards
  disagreed with each other even though neither was individually broken.
- **Surface**: Insights tab, phase-rhythm card vs cycle-length card
  (same screen, same data, disagreeing headline numbers).
- **Detail**: see LT-18 — `buildPhaseRhythmData` already derived phases
  from `prediction.cycleLengthDays` (the engine estimate); LT-18's fix
  made `buildCycleLengthData`'s `avgDays` use that SAME field, so the two
  cards are now guaranteed to agree by construction (same input, same
  waterfall-clamped breakdown).
- **Original-suspect disposition**: new (Phase 5 sweep, workstream E group
  1).
- **Fix status**: FIXED as an emergent consequence of LT-18's fix,
  `f5f1d58` — no separate production-code change was needed. Added a
  dedicated probe to prove and pin the invariant rather than rely on
  incidental coverage: "RESOLVED LT-21" in
  `buildInsightsScreenModel.probe.longTenure.test.ts`, `it.each` over all
  6 tenure variants asserting `prediction.cycleLengthDays ===
  model.cycleLengthData.avgDays` AND that the phase-rhythm durations sum
  to that same number, for every fixture.

### LT-22 — Monthly briefing's own numbers don't reconcile with each other, and "so far" appears on months long ended

- **Severity**: medium (internal coherence within a single card)
- **Status**: CONFIRMED — reproduced pre-fix on tenure-6mo-gap: "3 logs
  reviewed" lead sentence vs "3 period days" + "4 tracked signals" chips
  (4 ≠ 3, and "tracked signals" counted distinct signal TYPES logged that
  month, not a quantity relatable to "3 logs"); on tenure-12mo-regular: "5
  logs reviewed" vs "4 period days" + "8 tracked signals". Separately,
  "[Month] shows ... so far" rendered for tenure-1mo-new's June briefing
  and tenure-lapsed's May briefing when `today` was 2026-07-06 — both
  months had already fully ended, so "so far" (implying the month is
  still in progress) was false.
- **Surface**: Insights tab, monthly briefing card
  (`buildMonthlyBriefing` in `buildInsightsScreenModel.ts`).
- **Detail**: the lead sentence cited `signalCounts.size` (count of
  DISTINCT symptom TYPES logged that month) while the chip below it showed
  a different aggregate (days with at least one symptom logged) — two
  different definitions of "how much did you track" presented as if they
  were the same number in the same sentence. The "so far" phrasing was
  unconditional, with no check against the current month.
- **Original-suspect disposition**: new (Phase 5 sweep, workstream E group
  1).
- **Fix status**: FIXED, `f5f1d58`. Two independent changes: (1) the lead
  sentence now cites `symptomDays` (days with at least one symptom
  logged) — the SAME aggregate the `symptomDaysLabel` chip already
  displays — instead of `signalCounts.size`, so the two numbers always
  match by construction; `signalCounts` is still computed and used for
  the separate `topSignals`/`topSignalsLabel` chip (distinct signal
  types remains a meaningful, clearly-labeled number elsewhere on the
  card, just no longer conflated with the lead sentence's count). (2)
  added `isBriefingForCurrentMonth = briefingMonthPrefix ===
  currentMonthPrefix`; the lead now branches on it — present tense +
  "so far" only when the briefing's month IS the current month, otherwise
  past tense with no "so far" (new `monthlyBriefing.leadPastMonth` locale
  key, e.g. en: `'{month} showed {periodDays} period days and
  {symptomDays} symptom days.'` vs the current-month `lead`: `'{month}
  shows {periodDays} period days and {symptomDays} symptom days so
  far.'`). All 8 locales updated (en, es, de, fr, ja, zh-Hans, pt, ru).
  Copy-guard: `tests/localization/insightsMessages.test.ts` —
  `leadPastMonth` defined with the same placeholders as `lead` in every
  locale, and never contains "so far" (en). Probe:
  `buildInsightsScreenModel.probe.longTenure.test.ts` "RESOLVED LT-22" —
  `it.each` reconciliation test across all 6 tenure variants (regex-
  extracts the cited numbers from the lead sentence and the chip labels,
  asserts they match); explicit "so far" gating tests for tenure-1mo-new
  (June, ended → "showed", no "so far") and tenure-lapsed (May, ended);
  `it.each` for tenure-6mo-gap/12mo-regular/12mo-irregular (July =
  current month → "so far" correctly retained). Golden diffs: the fixed
  English `lead` string in `buildInsightsScreenModel.test.ts` and
  `InsightsScreen.test.tsx` ("...tracked signals so far" →
  "...symptom days so far"), justified per-test (the fixtures' numbers
  happened to coincide in the old assertions, masking the definitional
  mismatch); `buildInsightsScreenModel.probe.adversarial.test.ts`'s
  singular-grammar test renamed and re-targeted at "symptom day" instead
  of "tracked signal".

### LT-23 — Today/Calendar/Settings report different period-start counts on the same irregular/lapsed history

- **Severity**: medium (cross-surface inconsistency; LT-13 already fixed
  the more severe version of this)
- **Status**: CONFIRMED — reproduced pre-fix on tenure-12mo-irregular and
  tenure-lapsed: Today, Calendar, and Settings each read
  `repositories.dailyLogs` with a DIFFERENT bounded date range on the same
  underlying history, so a long-tenure/irregular user's older period
  starts could be silently excluded from one surface's count but not
  another's.
- **Surface**: Today tab (history chip), Settings hub ("N cycles logged"
  stat), Calendar tab (recent-cycles derivation).
- **Detail**: LT-13 (see above) already unified the COUNTING METHOD across
  all three surfaces — all defer to `collectPeriodStarts`
  (`src/lib/predictions/cycleHistory.ts`), the same canonical detector the
  prediction engine uses. What LT-13 left open was a residual READ-WINDOW
  divergence: `TodayScreen.tsx` read
  `listByDateRange(todayIso - 365, todayIso)`; `CalendarScreen.tsx` read
  `listByDateRange(monthIso - 365, monthIso + 62)` — anchored to the
  VIEWED month rather than today, so flipping months shifted the window
  and could change the count mid-session; `SettingsScreen.tsx` read
  `listByDateRange(todayIso - 730, todayIso)`. A period start older than a
  given surface's window was silently dropped from THAT surface's count
  only.
- **Original-suspect disposition**: residual of LT-13 (LT-13's fix status
  note explicitly flagged the 730-day-window gap; this finding
  generalizes and closes it across all three surfaces).
- **Fix status**: FIXED, `78754eb`. All three surfaces now read via
  `repositories.dailyLogs.listAll()` — the same fix already applied to
  Insights (LT-06) and proven safe at volume there (and by LT-10's
  measured timeline virtualization). Chosen, documented definition: "total
  period starts on record" — every surface counts every period start in
  the full stored history, with no read-window truncation. The engine's
  own statistics still self-window to the most recent 12 intervals for the
  cycle-length ESTIMATE (`MAX_INTERVAL_WINDOW`,
  `src/lib/predictions/cycleStatistics.ts`) — only the READ window
  changed, not engine behavior. `CalendarHistoryScreen` and the Settings
  reminder-center hydration effect were deliberately left on their
  existing `listByDateRange` reads: neither surfaces a period-start COUNT,
  so they were out of LT-23's scope. Safety of the wider reads was
  verified against each consumer, not assumed: Today's `buildLoggedMarkers`
  is a map-based lookup (safe with extra unused entries); Calendar's
  `historyItems` is bounded by `.slice(0, 6)` downstream; the engine's own
  windowing is unaffected by the size of the input array. New probe:
  `tests/app/crossSurfaceCycleCount.probe.longTenure.test.tsx` — mounts
  the REAL `TodayScreenContent`, `SettingsScreen`, and
  `CalendarScreenContent` against the same `tenure-12mo-irregular` /
  `tenure-lapsed` fixtures and asserts Today and Settings display the
  identical count (matching `collectPeriodStarts` on the fixture directly)
  and that Calendar's hydration calls `listAll()`.
  `settingsCycleCount.probe.longTenure.test.tsx` gained a "RESOLVED LT-23"
  case: a period start from 2020-01-01 (>2000 days before the fixture's
  "today", outside the OLD 730-day window) is still counted. Golden diffs:
  purely mechanical mock renames (`listByDateRange` → `listAll`, or
  addition of a second `listAll` mock alongside the still-used
  `listByDateRange` mock for Settings' separate reminder-center hydration
  path) across `TodayScreen.test.tsx`, `CalendarScreen.test.tsx`,
  `calendarGridStagger.probe.longTenure.test.tsx`, `SettingsScreen.test
  .tsx`, and `settingsCycleCount.probe.longTenure.test.tsx` — no
  behavioral assertions changed beyond the mocked call itself.

### LT-19 — Past-month calendar banner mixes epochs and false-flags staleness

- **Severity**: medium-high
- **Status**: CONFIRMED, closed by LT-27's fix — re-reproduced first
  (per this pass's instructions) with a direct probe comparing the
  prediction banner label rendered for the CURRENT month vs. a PAST month
  on the same `tenure-3mo-regular` / `tenure-12mo-irregular` fixtures:
  `nextPeriodLabel`, `confidenceBasisLabel`, and
  `confidence.reasonCodes` were already byte-identical regardless of
  which month was being viewed, and neither fixture produced a
  `stale-history` reason code. The count-window divergence this finding
  originally reported was already closed by LT-04 (staleness signal
  computed once, engine-side, off the real anchor) and LT-23 (unified
  unbounded read) landing earlier in this campaign — browsing to a past
  month never re-derives the banner from a different epoch or a
  different read window; it reads the same `PredictionResult` the
  current-month view reads.
- **Surface**: Calendar tab month grid → prediction banner
  (`buildCalendarScreenModel.ts` → `formatCalendarPredictionRangeLabel`).
- **Detail**: the only genuinely remaining incoherence was LT-27 (below):
  a STALE user's banner kept announcing specific "Next period expected
  MMM D–D" dates sourced from a rolled-forward synthetic anchor, while
  the grid itself (per LT-09) already refused to draw the corresponding
  predicted-period shading. That is a single coherence gap, not two —
  fixing it (LT-27) is what makes LT-19's "banner mixes epochs" concern
  fully closed: the banner and the grid now agree, in every month, on
  whether a prediction is being asserted at all.
- **Original-suspect disposition**: partially-fixed before this pass
  (LT-04 + LT-23 closed the count/epoch-window divergence);
  fully closed by this pass's LT-27 fix (banner/grid staleness
  coherence). No separate month-scoping UI was needed — the banner was
  never actually re-deriving from the viewed month's data, only from
  the same shared prediction.
- **Fix status**: FIXED via LT-27 (see below). New probe:
  `buildCalendarScreenModel.probe.longTenure.test.ts` — "RESOLVED LT-19"
  describe block (2 tests: regular + irregular tenure, current vs. past
  month banner comparison).

### LT-20 — Bare month/day dates become ambiguous at 12-month+ tenure

- **Severity**: medium-high
- **Status**: CONFIRMED — private timeline rows, the day-view header, and
  calendar history rows all rendered a bare "MMM D" / weekday+month+day
  label with no year, so once a user's history spans more than one
  calendar year the same label (e.g. "Apr 2") is genuinely ambiguous
  between this year and a prior year's entry.
- **Surface**: Private timeline row dates
  (`PrivateTimelineScreen.tsx` → `TimelineItemRow`), calendar day-view
  title (`CalendarDayScreen.tsx` → `formatWeekdayDateTitle`), and
  calendar history rows (`CalendarHistoryScreen.tsx`).
- **Detail**: extended LT-08's convention (established for the
  Calendar-tab prediction range label) to these three list/detail
  surfaces: include the year in the formatted label ONLY when the
  entry's year differs from the reference "today" year, using the
  existing `Intl.DateTimeFormat`-based formatters — no hand-rolled date
  math. Added
  `formatMonthDayLabelWithYearIfNotCurrent(isoDate, currentYearIso,
  locale)` to `src/lib/predictions/presentation.ts`, built on the
  existing `formatMonthDayLabel` / `formatMonthDayYearLabel` pair.
  `CalendarDayScreen`'s title formatter took a second `referenceTodayIso`
  parameter and conditionally adds `year: 'numeric'` to its
  `Intl.DateTimeFormat` options.
- **Original-suspect disposition**: new (not a prior original suspect;
  found via this pass's static/UX sweep of long-tenure list surfaces).
- **Fix status**: FIXED. Files: `src/lib/predictions/presentation.ts`
  (new exports), `src/features/timeline/screens/PrivateTimelineScreen
  .tsx`, `src/features/calendar/screens/CalendarHistoryScreen.tsx`,
  `src/features/calendar/screens/CalendarDayScreen.tsx`. Tests: 4 new
  cases in `tests/features/calendar/CalendarDetailScreens.test.tsx`
  (prior-year vs. same-year for both `CalendarDayScreen` and
  `CalendarHistoryScreen`), 1 new case in `tests/features/timeline/
  PrivateTimelineScreen.test.tsx` (two entries sharing month/day across
  years, verified via `accessibilityLabel` on distinct testIDs — plain
  text-matching false-positived against the pre-existing monthly-briefing
  row that legitimately shares the same date text), plus ×8-locale
  coverage added to `tests/lib/predictions/presentation.probe2
  .adversarial.test.ts`. No other bare-date list surfaces were found in
  this sweep beyond the three fixed here (Insights and Settings do not
  render individual dated rows spanning years).

### LT-24 — Stale prediction asserts fertile-window/cycle-day as present-tense fact

- **Severity**: medium (trust)
- **Status**: CONFIRMED — a tenure-lapsed user (real anchor rolled
  forward by the engine to keep `cycleDay` in range, per LT-01/LT-04) saw
  Today assert "Fertile window active today" and "Cycle day 13 of 29" as
  ordinary present-tense fact, ABOVE the missed-period banner, with no
  hedge that the estimate is built on a rolled synthetic anchor rather
  than the user's actual recent logging. The calendar day-detail screen's
  "Fertile" phase chip had the same problem for any day evaluated while
  the confidence engine had already flagged `stale-history`.
- **Surface**: Today tab phase ribbon + fertile-window headline/caption
  (`TodayScreen.tsx`, `buildTodaySnapshot.ts`); Calendar day-detail phase
  chip (`CalendarDayScreen.tsx`).
- **Detail**: reused the exact `stale-history` reason code LT-04 already
  computes once in `buildPredictionResult.ts` (`isHistoryStale`) —
  the same signal LT-09 already consumes to suppress phantom shading and
  LT-27 (below) now consumes for the calendar banner. `buildTodaySnapshot`
  checks `prediction.confidence.reasonCodes.includes('stale-history')`
  and, when stale, replaces the ordinary
  `formatFertileWindowLabel`/`formatFertileWindowCaption` copy with new
  localized hedge copy (`predictions.today.staleHeadline` /
  `.staleCaption`: "Your local estimate needs a refresh" / "Log your
  latest period to see today's cycle phase again."). `TodayScreen`
  additionally suppresses the entire "This cycle" `CycleRibbon` (the
  numeric cycle-day/phase-progress bar) when stale, rather than showing a
  cycle-day number computed from a synthetic anchor. `CalendarDayScreen`
  suppresses only the "Fertile" phase-chip label when
  `!showFertilityEstimates || isStale`, reusing the same reason-code
  check. The missed-period nudge itself (LT-04's existing degraded
  confidence + anomaly copy) is untouched — only the fertile/cycle-day
  headline claims are hedged.
- **Note on confidence-branch gating**: `resolveConfidence` only reaches
  the `stale-history` check at its terminal `periodStartCount >= 3`
  high-confidence branch — fixtures with fewer than 3 period starts short
  circuit to `low`/`limited-bleeding-history` or `medium` before
  staleness is ever considered. Both new tests use 3-period-start
  fixtures with the most recent entry old enough to roll ≥2 cycles or
  exceed 30 days past calendar expectation, matching LT-04's own
  staleness trigger.
- **Original-suspect disposition**: new.
- **Fix status**: FIXED → **VERIFIED, fully closed** (final fix pass,
  2026-07-07 — see LT-30/LT-31 below). Files: `src/features/tracker/buildTodaySnapshot
  .ts`, `src/features/tracker/screens/TodayScreen.tsx`,
  `src/features/calendar/screens/CalendarDayScreen.tsx`,
  `src/localization/messages/predictions.ts` (new `today.staleHeadline`
  / `today.staleCaption` keys, ×8 locales). Tests: `describe('LT-24:
  stale prediction hedging', ...)` in `tests/features/tracker/
  TodayScreen.test.tsx` (stale + non-stale cases), 1 new case in
  `tests/features/calendar/CalendarDetailScreens.test.tsx` (Fertile chip
  suppressed once stale), copy-guard block in `tests/localization/
  predictionsMessages.test.ts` (non-empty + regex guard against
  fertile/ovulation-adjacent terms in all 8 locales +
  `bannedMedicalTermsByLocale`). Design intentionally mirrors LT-09's
  established "suppress rather than assert-with-caveat" pattern for
  stale predictions, keeping the calm, hedged tone consistent across
  Today, Calendar day-detail, and the Calendar grid/banner (LT-27).
  **Phase 5 re-verification (2026-07-07) found this fix incomplete**: two
  surfaces the fix missed still asserted stale claims — the Today hero
  numeral (LT-30) and the calendar grid's fertile shading + inline day
  card (LT-31). Both were CONFIRMED, then fixed in the same final pass
  using the identical established pattern (no new design), closing the
  gap. LT-24 is now fully closed across every surface: Today headline +
  caption + ribbon + hero, Calendar day-detail chip, Calendar grid +
  banner + inline day card all agree once history is stale.

### LT-26 — Birth-control reminder state contradicts itself across surfaces when a reminder is enabled with no method selected

- **Severity**: low-medium
- **Status**: CONFIRMED — repro via `buildTenureDataset('tenure-12mo-irregular',
  ...)`: its profile has no `birthControlMethod` but its
  `reminderPreferences` (built by the fixture's shared
  `enabledReminderPreferences()` helper) had the birth-control kind
  `enabled: true`. Three surfaces disagreed on the same underlying data:
  Settings hub row said "Birth control: Off" (`formatBirthControlHubSummary`
  is method-first and already correctly short-circuits to "Off" when
  `!method`); the BC detail screen showed "No method selected / Daily at
  8:00 AM / Turn off" (a live-looking schedule, because
  `SettingsBirthControlScreen`'s `reminderEnabled` read
  `birthControlReminder.enabled` in isolation, never consulting
  `selectedMethod`); the private timeline showed "Birth-control reminder /
  Daily at 08:00 / Active local reminder" (`buildReminderCenterModel` ->
  `buildReminderPlans` scheduled a real plan off `preference.enabled` alone).
- **Surface**: Settings hub row, BC detail screen
  (`SettingsBirthControlScreen`), private timeline reminder row
  (`PrivateTimelineScreen` via `buildReminderCenterModel`), and — most
  importantly — the actual OS notification scheduler
  (`reconcileReminderNotifications` -> `buildReminderPlans`), which would
  have scheduled a real "Time to take your birth control" push notification
  with no method on file.
- **Reachability check (done before deciding a fix direction, per this
  finding's instructions)**: traced the actual Settings write path.
  `persistBirthControlMethod` in `SettingsScreen.tsx` DOES turn the
  birth-control reminder off when the method is cleared THROUGH that one
  screen (`isClearingMethod && birthControlReminder.enabled` branch,
  pre-existing code, unchanged by this fix). But that is only one write
  path: nothing at the data-model or persistence layer prevents
  `reminderPreferences` from holding `{ kind: 'birth-control', enabled:
  true }` while `profile.birthControlMethod` is absent — a restored backup
  (which writes the raw preference snapshot back verbatim), an
  in-progress/future migration, or any future mutation of `profile` or
  `reminderPreferences` outside that one screen could still produce it.
  `buildReminderPlans` itself — the single function both the real OS
  scheduler and the Settings reminder-center summary run through — never
  checked `profile.birthControlMethod` at all before this fix, so the
  orphaned combination was live, not just a display glitch. This makes the
  contradictory state a genuine (if narrow) risk, not merely an unreachable
  fixture artifact — see "fixture disposition" below for the one place it
  WAS purely a fixture artifact.
- **Decision**: option (a) per this finding's guidance — clearing/absent
  method auto-disables (and now also PREVENTS) the birth-control reminder
  from ever being scheduled, rather than trying to make three independent
  presentation layers agree on rendering a "reminder on, no method" state
  coherently.
- **Fix status**: FIXED (`b468cfd`). Root-cause guard added at the single
  choke point:
  `buildReminderPlans` (`src/lib/notifications/buildReminderPlans.ts`) now
  skips the `birth-control` branch entirely when `!profile.birthControlMethod`,
  regardless of the stored `enabled` flag. Because both
  `reconcileReminderNotifications` (real OS scheduling,
  `reminderScheduler.ts`) and `buildReminderCenterModel` (Settings/timeline
  reminder-center summary) already call `buildReminderPlans`, this one guard
  self-heals ANY orphaned `reminderPreferences` row on the very next
  reconcile (which fires from essentially every app-shell mount and every
  settings mutation) — no dedicated migration needed; a restored backup or a
  future write path that reintroduces the orphaned combination is
  automatically absorbed. Additionally fixed the one surface that reads the
  raw preference outside that choke point:
  `SettingsBirthControlScreen`'s `reminderEnabled` in
  `src/features/settings/screens/SettingsScreen.tsx` now requires
  `Boolean(selectedMethod) && Boolean(birthControlReminder.enabled)`
  (previously just the latter), so the BC detail screen shows "No method
  selected / Choose a method before turning on the reminder." instead of a
  live-looking "Daily at 8:00 AM" for a reminder that (per the
  `buildReminderPlans` guard) will not actually fire. The
  earlier/later/turn-off action buttons were already correctly
  `disabled={!selectedMethod || ...}` on all three (verified directly —
  this part of the original repro's "muted Turn off but ENABLED ±30min
  buttons" observation did not reproduce against current code). The
  Settings hub row (`formatBirthControlHubSummary`) needed no change — it
  was already method-first and correctly reported "Off" throughout.
- **Fixture disposition**: `src/testing/tenureFixtures.ts`'s
  `enabledReminderPreferences()` helper unconditionally enabled every
  reminder kind including birth-control, regardless of whether the profile
  had a method — an unreachable combination once the guard above lands, so
  fixed at the fixture level too. `enabledReminderPreferences` now takes a
  `hasBirthControlMethod` flag (default `false`) and only enables the
  birth-control kind when the caller passes `true`; only
  `tenure-12mo-regular` (the one variant with `birthControlMethod: 'pill'`)
  passes it. `tenure-12mo-irregular` and the other four variants without a
  method now correctly have their birth-control reminder preference
  `enabled: false`, matching what a real user's settings would actually
  contain. Documented inline on the helper.
- **Original-suspect disposition**: new (Phase 5 sweep, workstream E group
  3).
- **Tests**: `tests/lib/notifications/buildReminderPlans.probe.longTenure
  .test.ts` gained a "RESOLVED LT-26" describe block (3 tests: the fixed
  fixture no longer encodes the orphaned combination; `buildReminderPlans`
  schedules no birth-control plan for a synthetically-orphaned preference
  regardless of its `enabled` flag; a profile WITH a method still schedules
  normally, proving the guard is method-presence-scoped, not a blanket
  suppression). `tests/features/settings/SettingsScreen.test.tsx` gained a
  screen-level case (BC detail screen presents the orphaned state as off,
  with all three action buttons disabled) and a `formatBirthControlHubSummary`
  case (Settings hub already reports "Off" for the same orphaned
  combination — regression-pins the surface that was already correct).
  `tests/features/timeline/PrivateTimelineScreen.test.tsx` gained a case
  proving the timeline no longer surfaces a "Birth-control reminder" row
  for the orphaned combination (self-healed via the `buildReminderPlans`
  choke point, no timeline-specific code change needed). Golden diffs
  (justified — every one is a fixture/shared-profile that needed a
  `birthControlMethod` added to keep exercising birth-control scheduling
  now that it has a real precondition): `buildReminderPlans.test.ts`
  (shared module-level profile), `buildReminderPlans.probe.adversarial
  .test.ts` (2 sites), `reminderScheduler.test.ts` (shared profile),
  `reminderScheduler.probe.adversarial.test.ts` (2 sites),
  `buildReminderCenterModel.test.ts` / `.adversarial.test.ts` /
  `.probe.adversarial.test.ts` (each file's shared base profile constant).

### LT-27 — Stale calendar banner announces dates the grid refuses to draw

- **Severity**: low-medium
- **Status**: CONFIRMED — LT-09 already suppresses the calendar grid's
  predicted-period shading once `stale-history` is set, but left the
  prediction BANNER above the grid still rendering "Next period expected
  MMM D–D" with specific dates sourced from the same stale, rolled
  anchor — a direct visual contradiction: the banner asserts dates the
  grid conspicuously does not shade.
- **Surface**: Calendar tab month grid → prediction banner
  (`buildCalendarScreenModel.ts` → `formatCalendarPredictionRangeLabel`).
- **Detail**: `formatCalendarPredictionRangeLabel` now takes an
  `isPredictionStale: boolean` parameter (derived from the same
  `prediction.confidence.reasonCodes.includes('stale-history')` check
  already computed earlier in `buildCalendarScreenModel`) and, when
  stale, returns a new localized banner string instead of any
  current/next-period date range:
  `formatStalePredictionBannerLabel(locale)` → "Log your latest period
  to update this estimate" (×8 locales), added to
  `src/lib/predictions/presentation.ts`. This reconciles the banner with
  the grid and with Today (LT-24): all three surfaces now tell one
  coherent story when history is stale — no dates are asserted anywhere,
  only a calm prompt to log again.
- **Original-suspect disposition**: residual of LT-09 (LT-09's fix status
  note scoped itself to grid shading only; this finding closes the
  banner half of the same staleness story). Also closes LT-19 (see
  above).
- **Fix status**: FIXED. Files: `src/lib/predictions/presentation.ts`
  (new `formatStalePredictionBannerLabel` export),
  `src/features/calendar/buildCalendarScreenModel.ts`. Tests: "FIXED
  LT-27" describe block in `buildCalendarScreenModel.probe.longTenure
  .test.ts` (2 tests: stale banner shows no digits, non-stale banner
  still shows digits), ×8-locale coverage in `tests/lib/predictions/
  presentation.probe2.adversarial.test.ts`.

### LT-29 — Today's-log empty-state glyph inconsistent across summary boxes

- **Severity**: low (visual polish)
- **Status**: CONFIRMED — the FLOW empty-state box rendered a middle dot
  ("·") while MOOD/ENERGY/SLEEP each rendered a hyphen-minus ("-") — two
  different glyphs for the same "nothing logged yet" state on the same
  card.
- **Surface**: Today tab summary card
  (`src/features/logging/screens/TodaySummaryCard.tsx` via
  `src/localization/messages/tracker.ts`).
- **Detail**: unified all four empty-state keys (`summary.empty`,
  `summary.moodEmpty`, `summary.energyEmpty`, `summary.sleepEmpty`) onto
  the same en dash ("–") glyph, across all 8 locale blocks (32 site
  replacements). En dash was chosen over hyphen-minus/middle-dot as the
  more typographically correct "no value" placeholder and because it was
  already the majority glyph in 3 of the 4 fields pre-fix (adjusted to
  match the visually distinct dash rather than keeping the outlier
  middle-dot).
- **Original-suspect disposition**: new (iOS-triage NIT promoted to a
  tracked/fixed finding per this pass's instructions).
- **Fix status**: FIXED. File: `src/localization/messages/tracker.ts`.
  Golden diffs (justified): `tests/features/logging/TodaySummaryCard
  .test.tsx` (3 sites) and `tests/features/tracker/TodayScreen.test.tsx`
  (1 site) previously asserted a 1-vs-3 split between `'·'` and `'-'`
  across the four boxes; updated to `expect(screen.getAllByText('–'))
  .toHaveLength(4)` now that all four boxes render the identical glyph.

### LT-28 — Paywall copy ignores an already-active free trial

- **Severity**: medium (trust — the paywall's own copy contradicts the
  trial the user is actively in)
- **Status**: CONFIRMED as a real, reachable defect — NOT a dev-preset
  or billing-E2E-mode artifact. Verified by tracing the actual
  navigation path rather than assuming: `resolvePaidAccessGate` never
  force-locks a `trial_active` user (only `needs_purchase`/`expired`
  force-lock), but `SettingsScreen.tsx`'s "Manage subscription" button
  (`subscriptionOpenPaywallButton`, ~line 1804) pushes `/subscribe`
  UNCONDITIONALLY, with no access-state gate. A `trial_active` user who
  taps "Manage subscription" lands on `SubscribeScreen`, which — before
  this fix — had no branch for `trial_active` and fell through to the
  generic `lockedNeedsPurchaseDescription` copy ("Choose a plan to
  unlock Floriva. Start your free trial or pick a plan to begin.") even
  though that user already has an active trial running. This is a real
  UI path reachable in production, unrelated to
  `EXPO_PUBLIC_BILLING_E2E_MODE`.
- **Surface**: `SubscribeScreen.tsx` (paywall), reached voluntarily via
  Settings → Manage subscription while `trial_active`.
- **Detail**: `resolveLockedDescriptionKey` in `SubscribeScreen.tsx`
  gained an explicit `trial_active` branch returning
  `billing.screen.lockedTrialActiveDescription` (new key, ×8 locales,
  added to `src/localization/messages/billing.ts`): "Your free trial is
  active. You can review or change your plan anytime." The `subscribed`
  access state was deliberately left on the existing
  `lockedNeedsPurchaseDescription` fallback — out of this finding's
  scope; a subscribed user reaching this screen is a much rarer path and
  the existing copy, while not perfectly tailored, does not make the
  same active false claim (subscribed users are not mid-trial) that
  `trial_active` did.
- **Original-suspect disposition**: new (iOS-triage NIT; this pass's
  instructions explicitly asked to verify whether it was a dev-preset
  artifact before fixing — it is not).
- **Fix status**: FIXED. Files: `src/features/billing/screens/
  SubscribeScreen.tsx`, `src/localization/messages/billing.ts`. Tests:
  new case in `tests/features/billing/SubscribeScreen.test.tsx`
  ("LT-28: shows trial-active copy instead of the no-access framing for
  a voluntary trial_active visit"), new ×8-locale copy-guard case in
  `tests/localization/translations.test.ts` ("LT-28: gives a
  trial-active paywall visitor copy that acknowledges their active
  trial" — asserts non-empty, distinct from both the expired and
  needs-purchase strings, and clear of `bannedMedicalTermsByLocale`).
  Key-parity across all 8 locales already covered by the existing
  `buildMissingTranslationKeyReport` test in the same file.

## iOS-triage NITs (noted, not fixed this pass)

The Phase 3 iOS on-device sweep surfaced these additional polish/UX
observations. None were blocking or trust-affecting enough to prioritize
in this pass; recorded here so they are not lost. Each is a one-line note
of the observed behavior, not a full finding writeup.

- Today tab: the screen's headline and the subtext immediately below it
  restate overlapping information — visually redundant, not incorrect.
- Settings hub "N cycles" chip counts period STARTS (per LT-13/LT-23's
  chosen definition), not completed cycles — accurate per the documented
  definition, but the chip label itself doesn't make that distinction
  legible to a reader expecting "cycles" to mean "completed cycles."
- Selected-state pills that show a radio dot render measurably taller
  than their unselected siblings in the same row (padding/line-height
  asymmetry introduced by the radio glyph).
- The "Libido changes" symptom chip's label wraps onto a second line in
  a way that clips against/overlaps its own radio circle at default
  Dynamic Type sizes.
- The monthly-briefing chip label duplicates part of its own text and
  wraps awkwardly on narrower widths.
- PMDD condition helper/explainer text still renders underneath already-
  populated user data, rather than only showing before any data exists.
- Future-dated reminders can appear ABOVE (chronologically before) real
  private-history entries in the timeline, which reads oddly since the
  timeline is otherwise a strictly-past historical record.

## Documented behavior (accepted, pinned)

- **LT-12 — DST spring-forward**: a cycle-event trigger inside the skipped
  hour (02:30 on 2026-03-08) normalizes forward within the same calendar
  day (02:30→03:30); no day skip, no invalid Date. Pinned (TZ-robustly) in
  `tests/lib/notifications/buildReminderPlans.probe.longTenure.test.ts`
  ("DOCUMENTED LT-12" describe).
- **Calendar history card caps at 6 bleeding-day items / 3 recent cycles**
  regardless of tenure — by design ("recent" card; full history lives on
  CalendarHistoryScreen). Pinned in
  `buildCalendarScreenModel.probe.longTenure.test.ts` ("DOCUMENTED"
  describe).

## Original suspects resolved by the 1.2.0 rework (acceptance evidence)

| # | Original suspect | Verdict | Probe evidence |
|---|------------------|---------|----------------|
| R-A | Multi-month gap poisons the cycle-length average | fixed-by-1.2.0 (A2 MAD + bounds filter) | `buildPredictionResult.probe.longTenure.test.ts` — tenure-6mo-gap: gap interval discarded (`discardedCount: 1`), estimate stays 30d |
| R-B | "High" confidence despite 24–60d variance | fixed-by-1.2.0 (for opted-in irregular users) | ibid — tenure-12mo-irregular: level `medium`, reason `irregular-cycle-support-enabled`. Residual gap tracked as LT-04 (staleness) |
| R-C | History never ages out of the estimate | fixed-by-1.2.0 (12-interval window) | ibid — 8x40d old + 12x28d recent → estimate 28, sampleSize 12 |
| R-D | `daysBefore > cycleLength` roll-forward loop | fixed (terminates, future trigger) | `buildReminderPlans.probe.longTenure.test.ts` (45d before a 27d cycle; also 400d extreme) |
| R-E | tenure-lapsed should produce missed-expected-period | works as designed | `buildPredictionResult.probe.longTenure.test.ts` — missed-expected-period (un-rolled anchor 2026-05-26) + open-cycle long-cycle |
| R-F | tenure-6mo-gap should produce long-cycle + outlier rejection | works as designed | ibid |
| R-G | Backup at scale (correctness + timing) | no issue | `backupPackage.probe.longTenure.test.ts` — 305-log snapshot round-trips losslessly; create/decrypt ~480ms each (PBKDF2-dominated, volume-insensitive), ~88KB package |
| R-H | Import UTC→local off-by-one | fixed (literal date-prefix preserved) | `importParsers.probe.longTenure.test.ts` — +05:30 midnight-crossing, Z, and year-boundary offsets all keep the written date |
| R-I | "Cycle day 45 of a 29-day cycle" on day surfaces | fixed for Today/CalendarDayScreen (engine anchor roll); grid remains | `buildCalendarScreenModel.probe.longTenure.test.ts` ("RESOLVED" describe); residual tracked as LT-01 |
| R-J | Leap-year / year-boundary date math | no issue (UTC-based) | `dateMath.probe.longTenure.test.ts` — 2028-02-29 arithmetic, 365/366-day years, DST-window diffs |
| R-K | Hormonal-BC user must not get signal-confirmed fertility claims | works as designed | `buildPredictionResult.probe.longTenure.test.ts` — tenure-12mo-regular (pill): gated, no `signal-confirmed` basis |

## Phase 1 tally

- CONFIRMED open findings: **11** (LT-01, LT-02, LT-03, LT-04, LT-05,
  LT-06, LT-07, LT-08, LT-09, LT-11, LT-13 — of which LT-07/LT-08/LT-09/
  LT-13 are low severity)
- PLAUSIBLE: **1** (LT-10 — awaits on-device render measurement in the
  Phase 2 simulator sweep)
- Original suspects resolved by 1.2.0 / no-issue: **11** (R-A … R-K)
- Probe suites added: 9 files, all green (probes document current behavior;
  fixes flip assertions).

## Phase 6 tally (group A — engine/model/copy fixes)

Executed on `feature/1.2.0-smarter-predictions`, HEAD `6c963d5` at start.

- **FIXED (8/8 assigned)**: LT-01, LT-02, LT-03, LT-04, LT-08, LT-09, LT-11,
  LT-13. Each probe's assertion was flipped from CURRENT (buggy) to
  SHOULD-BE behavior; see the per-finding "Fix status" line above for the
  commit SHA, files touched, and any golden-diff justification.
- **NOT in group A's scope**: LT-05, LT-06, LT-07 (since fixed by group B --
  see the group B tally below; LT-13 had already fixed LT-06's
  counting-method side note), LT-10 (render/virtualization perf, needs
  on-device measurement -- still open).
- Commits (logical groups, in order):
  1. `f9403f3` — LT-01 (calendar grid cycleDay bound)
  2. `9edd086` — LT-08 (cross-year range labels)
  3. `5834421` — LT-02 + LT-13 (unify period-start counting)
  4. `9692c18` — LT-03 + LT-11 (anomaly recency cutoff + observed-range
     floor; grouped because they interact on the same fixture)
  5. `d6e51fa` — LT-04 + LT-09 (confidence staleness + phantom-shading
     suppression; grouped because LT-09 reuses LT-04's staleness signal)
- **Batch-review follow-up** (single commit, after the group B tally below
  was written): corrected LT-11's observed-range floor to exclude the
  interval under test from its own floor (self-masking -- see LT-11's fix
  status for the full mechanism); added direct boundary pins for LT-04's
  staleness trigger (overdue 30-vs-31 days, rolledCycles 1-vs-2, ordinary
  one-day-late not degraded) in `buildPredictionResult.test.ts`; fixed two
  stale comments referencing a nonexistent `resolveIsHistoryStale` (the
  actual computation is inline in buildPredictionResult.ts); documented the
  KNOWN LIMITATION on `reminderScheduler.ts`'s horizon-derived cancellation
  list; added the LT-13 730-day-window residual note and corrected LT-06's
  probe-coverage description in this ledger.
- Full suite: 259 suites / 4086 tests green after every commit. Typecheck
  and lint clean throughout (zero warnings).
- Golden/consumer diffs, all justified inline per finding above: LT-01 (1
  cycle-boundary-crossing test), LT-04 (2 fixture-authoring-artifact tests
  in `irregularHistory.realworld.probe.adversarial.test.ts` that turned out
  to be genuinely stale by the new rule), LT-13 (4 sub-15-day-gap tests
  across two Insights test files, now correctly merged per
  `MIN_CYCLE_SEPARATION_DAYS`). LT-02, LT-03, LT-08, LT-09, LT-11 needed no
  changes to pre-existing goldens.

## Phase 6 tally (group B — notifications / hydration / import-policy fixes)

Executed on `feature/1.2.0-smarter-predictions`, HEAD `48ba959` at start.

- **FIXED (3/3 assigned)**: LT-05 (cycle-event reminder occurrence horizon),
  LT-06 (Insights hydration window widened to `listAll()`), LT-07 (import
  age-policy documented + duplication removed). See each finding's "Fix
  status" line above for full rationale, files touched, and golden-diff
  justification.
- Commits (logical groups, in order):
  1. `0b25ca8` — LT-05 (multi-occurrence cycle-event reminder horizon:
     `buildReminderPlans.ts`, `reminderScheduler.ts`,
     `notificationResponseRouting.ts`, `buildReminderCenterModel.ts`,
     `PrivateTimelineScreen.tsx`, plus test updates)
  2. `6e4260d` — LT-06 (widen Insights hydration window:
     `useInsightsModel.ts`, plus screen-level mock updates)
  3. `ee8fac7` — LT-07 (document import age policy, dedupe
     `getManualHistoryLookbackStartIso` into `model.ts`)
- Full suite: 259 suites / 4086 tests green after every commit. Typecheck
  and lint clean throughout (zero warnings).
- Golden/consumer diffs, all justified inline per finding above: LT-05 (4
  test files updated for the horizon expansion: `buildReminderPlans.test.ts`,
  `.adversarial.test.ts`, `.probe.adversarial.test.ts`,
  `reminderScheduler.probe.adversarial.test.ts` — every diff is the same
  "assumed exactly 1 plan per cycle-event preference" assumption meeting the
  new horizon of `REMINDER_OCCURRENCE_HORIZON`). LT-06 (2 screen test files'
  repository mocks renamed from `listByDateRange` to `listAll`,
  mechanical/no behavioral assertion changes beyond the call-arg check
  itself). LT-07 needed no golden changes (pure refactor, no behavior
  change) — all 530 import-related tests passed unchanged.

## Phase 5 tally (workstream E — sweep-defect triage and fixes)

Executed 2026-07-07 on `feature/1.2.0-smarter-predictions`, HEAD `5e8e8b8`
at start. Scope: the 4 defects the Phase 3 iOS sweep itself hit
(README "App defects hit by the sweep itself"), plus resolving LT-10's
PLAUSIBLE status. Every root cause was reproduced/pinned in a jest or
on-device harness BEFORE the fix.

- **LT-10**: PLAUSIBLE → CONFIRMED → FIXED (timeline virtualization via
  `Screen`'s new `virtualizedList` mode).
- **LT-14** (lapsed oldest-day freeze): harness wedge, app exonerated by
  probe + repeated clean on-device runs; harness settle fix.
- **LT-15** (12-month timeline freezes): root cause of all Phase 3
  freezes — Detox's synchronous main-thread scroll action, amplified by
  LT-10's 341 mounted rows; `sample` evidence committed under `triage/`.
  Fixed on both sides (LT-10 virtualization + harness settle).
- **LT-16** (endometriosis "never mounts"): by-design redirect for
  untagged conditions; the pmdd "pass" was a false positive. Harness now
  expects and captures the redirect.
- **LT-17** (Jan 2026 grid truncation): real UX defect — per-cell reveal
  stagger up to ~2.3 s on every month flip; fixed to per-row stagger
  (≤ ~430 ms).

Probe suites added (4 files, campaign convention — each pins the root
cause and would fail/hang if it regressed):
`calendarDayLapsed.probe.longTenure.test.tsx`,
`privateTimelineVirtualization.probe.longTenure.test.tsx`,
`insightsConditionRedirect.probe.longTenure.test.tsx`,
`calendarGridStagger.probe.longTenure.test.tsx`.

Phase 5 re-sweep (fixed bundle, affected surfaces only): tenure-lapsed
oldest-day; tenure-12mo-regular calendar-minus-6mo + timeline (+ scroll
video); tenure-12mo-irregular calendar-minus-6mo + condition-pmdd +
condition-endometriosis + timeline (+ scroll video). All passed; frozen /
false-positive evidence kept with `-before-fix` suffixes alongside the
clean replacements.

## Phase 5 tally (group 1 — Insights trust/coherence)

Executed 2026-07-07 on `feature/1.2.0-smarter-predictions`, HEAD `46526f6`
at start. Scope: the 4 defects triaged into "Insights trust/coherence"
(LT-18, LT-21, LT-22, LT-23) — copy/derivation issues where the app stated
something about the user's own cycle data that the underlying statistics
didn't support, or where two surfaces/cards disagreed about the same
number.

- **FIXED (4/4 assigned)**: LT-18 (cycle-length card now classifies from
  the engine's own `spreadDays`, honest ×8-locale copy, discarded
  intervals no longer silently averaged in), LT-21 (phase-rhythm and
  cycle-length cards now share one source of truth — resolved as an
  emergent consequence of LT-18, confirmed by a dedicated cross-card
  probe), LT-22 (monthly briefing's lead sentence and chips now cite the
  same `symptomDays` aggregate; "so far" gated on the briefing month
  actually being the current month, ×8-locale `leadPastMonth` key added),
  LT-23 (Today/Calendar/Settings unified on `listAll()` — "total period
  starts on record" — closing the read-window residual LT-13 had left
  open). See each finding's "Fix status" line above for full rationale,
  files touched, and golden-diff justification.
- Commits (logical groups, in order):
  1. `f5f1d58` — LT-18 + LT-21 + LT-22 (grouped because LT-18's
     `avgDays` fix is what resolves LT-21, and both touch
     `buildInsightsScreenModel.ts`/`InsightsScreen.tsx`/
     `insights.ts` locale messages in the same pass)
  2. `78754eb` — LT-23 (Today/Calendar/Settings unbounded read)
- Full suite: 265 suites / 4137 tests green after every commit. Typecheck
  and lint clean throughout (zero warnings).
- New probe/copy-guard files: `tests/localization/insightsMessages.test.ts`
  (LT-18 + LT-22 locale copy guards, ×8 locales each), `tests/app/
  crossSurfaceCycleCount.probe.longTenure.test.tsx` (LT-23, real-screen
  cross-surface reconciliation). Existing probes extended in place:
  `buildInsightsScreenModel.probe.longTenure.test.ts` gained "RESOLVED
  LT-18", "RESOLVED LT-21", and "RESOLVED LT-22" describe blocks;
  `settingsCycleCount.probe.longTenure.test.tsx` gained a "RESOLVED LT-23"
  describe block.
- Golden/consumer diffs, all justified inline per finding above: LT-18 (5
  `avgDays`-dependent tests in `buildInsightsScreenModel.adversarial
  .test.ts`, each with an inline before/after/why comment), LT-22 (2
  fixed `lead`-string goldens in `buildInsightsScreenModel.test.ts` and
  `InsightsScreen.test.tsx`, 1 renamed/re-targeted grammar probe in
  `buildInsightsScreenModel.probe.adversarial.test.ts`,
  `InsightsScreenBranches.test.tsx`'s hand-built model mocks extended with
  the new `consistencyLevel`/`subtitleLabel`/`footnoteLabel` fields),
  LT-23 (mechanical `listByDateRange` → `listAll` mock renames/additions
  across 5 test files, no behavioral assertions changed). LT-21 needed no
  goldens beyond its own new probe (no pre-existing test asserted the
  stale disagreement as correct).
- Not yet done: on-device store-style screenshots for the fixed Insights
  card across tenure variants (requested reference captures under
  `docs/qa/2026-07-06-long-tenure-sweep/<variant>/{ios,android}/
  insights*.png`) were not captured in this pass — all evidence above is
  jest-probe-level. Flagging explicitly per this ledger's established
  convention of distinguishing "CONFIRMED with probe" from on-device
  evidence.

## Phase 5 tally (group 2 — calendar/today coherence + date labels)

Executed 2026-07-07 on `feature/1.2.0-smarter-predictions`, HEAD
`abeb64a` at start. Scope: the 5 defects triaged into "calendar/today
coherence + date labels" (LT-19, LT-20, LT-24, LT-27, LT-29), plus
verifying and fixing LT-28 (iOS-triage NIT: paywall copy ignoring an
active trial) and recording the remaining iOS-triage NITs.

- **FIXED (5/5 assigned + LT-28)**: LT-19 (re-reproduced first per this
  pass's instructions; the count/epoch-window divergence it originally
  reported was already closed by LT-04 + LT-23 — fully closed by this
  pass's LT-27 fix), LT-20 (bare "MMM D" dates now gain a year suffix
  once an entry's year differs from today's, across timeline rows, the
  day-view header, and calendar history rows — extends LT-08's
  convention via a new `formatMonthDayLabelWithYearIfNotCurrent`
  helper), LT-24 (Today's fertile-window headline/caption and cycle-day
  ribbon, plus the calendar day-detail "Fertile" chip, now hedge/suppress
  under the same `stale-history` signal LT-04/LT-09 already compute,
  instead of asserting present-tense fact from a rolled synthetic
  anchor), LT-27 (the calendar prediction banner now shows a dateless,
  calm re-log prompt instead of dates when stale, reconciling it with
  LT-09's grid suppression and with LT-24's Today hedge — one coherent
  stale story across all three surfaces), LT-29 (Today's four
  empty-state summary boxes now share one glyph, en dash, instead of a
  1-vs-3 split between middle-dot and hyphen-minus). LT-28 was verified
  by tracing the actual navigation path (not assumed) to be a real,
  reachable defect — a `trial_active` user reaching the paywall via
  Settings' unconditional "Manage subscription" button saw copy that
  ignored their active trial — and fixed with an explicit
  `trial_active` copy branch. See each finding's "Fix status" line
  above for full rationale, files touched, and golden-diff
  justification.
- Commits (logical groups, in order):
  1. `02f3f5e` — LT-19 + LT-20 + LT-27 (grouped because all three touch
     `src/lib/predictions/presentation.ts` and the calendar screens in
     the same pass; LT-19 needed no code change beyond LT-27's fix)
  2. `4dde7ad` — LT-24 (also carries LT-20's `CalendarDayScreen.tsx`
     day-view header fix, landed in the same file/commit since both
     touched that file in this pass)
  3. `6aff4f3` — LT-29 (Today empty-state glyph unification)
  4. `5f6c6d5` — LT-28 (paywall trial-active copy branch)
- Full suite: 265 suites / 4179 tests green after every commit (up from
  265/4137 at the start of this pass — net +42 tests). Typecheck
  (`npx tsc --noEmit -p .`) and lint (`npm run lint -- --max-warnings=0`)
  clean throughout (zero warnings, zero errors).
- New/extended probe and copy-guard files: `buildCalendarScreenModel
  .probe.longTenure.test.ts` gained "RESOLVED LT-19" and "FIXED LT-27"
  describe blocks; `presentation.probe2.adversarial.test.ts` gained
  ×8-locale coverage for both new `presentation.ts` exports;
  `CalendarDetailScreens.test.tsx` gained 4 new cases (2× LT-20, 1×
  LT-20 history-row, 1× LT-24 Fertile-chip suppression);
  `PrivateTimelineScreen.test.tsx` gained 1 LT-20 case;
  `TodayScreen.test.tsx` gained a "LT-24: stale prediction hedging"
  describe block (2 tests); `predictionsMessages.test.ts` gained a
  "today.staleHeadline / today.staleCaption (LT-24)" describe block (3
  tests, including a regex guard against fertile/ovulation-adjacent
  terms and `bannedMedicalTermsByLocale`); `SubscribeScreen.test.tsx`
  gained 1 LT-28 case; `translations.test.ts` gained 1 LT-28 copy-guard
  case (distinctness + `bannedMedicalTermsByLocale` across all 8
  locales — key-parity itself already covered by the file's existing
  `buildMissingTranslationKeyReport` test).
- Golden/consumer diffs, all justified inline per finding above: LT-29
  (3 sites in `TodaySummaryCard.test.tsx` + 1 in `TodayScreen.test.tsx`,
  each switched from a single-glyph match to `getAllByText('–')
  .toHaveLength(4)` now that all four boxes render the identical
  glyph). LT-19, LT-20, LT-24, LT-27, LT-28 needed no changes to
  pre-existing goldens beyond their own new test cases.
- LT-28 scoping note: the `subscribed` access state was deliberately
  left on its existing fallback copy — considered and explicitly ruled
  out of scope (see LT-28's finding entry above for the reasoning), not
  an oversight.
- iOS-triage NITs recorded (not fixed this pass): see the "iOS-triage
  NITs (noted, not fixed this pass)" section above — 7 items, each a
  one-line observation carried over from the Phase 3 on-device sweep.
- Not yet done: on-device store-style reference screenshots for the
  fixed calendar banner, Today stale-state hedge, and day-detail chip
  suppression across tenure variants (requested captures under
  `docs/qa/2026-07-06-long-tenure-sweep/<variant>/{ios,android}/`) were
  not captured in this pass — all evidence above is jest-probe-level,
  consistent with this ledger's established distinction between
  "CONFIRMED with probe" and on-device evidence.

## Phase 5 tally (group 3 — birth-control reminder coherence + timeline scroll hardening)

Executed 2026-07-07 on `feature/1.2.0-smarter-predictions`, HEAD `33d1d2c`
at start. Scope: the last group of Phase 5 triage defects — LT-26
(birth-control reminder state contradicting itself across Settings hub, BC
detail screen, and the private timeline when a reminder is enabled with no
method selected) and the D5 watch item (one intermittent Android capture of
a blank timeline viewport after a programmatic scroll-to-bottom on the
LT-10-virtualized `FlatList`).

- **FIXED (1/1 assigned)**: LT-26. **Decision: option (a)** — a birth-control
  reminder cannot outlive its method. Root cause: `buildReminderPlans`
  (`src/lib/notifications/buildReminderPlans.ts`), the single choke point
  both the real OS scheduler (`reconcileReminderNotifications`) and the
  Settings/timeline reminder-center summary (`buildReminderCenterModel`)
  run through, scheduled the `birth-control` reminder kind off
  `preference.enabled` alone, never checking `profile.birthControlMethod`.
  Reachability was verified before choosing a fix direction: while
  `SettingsScreen.tsx`'s `persistBirthControlMethod` already turns the
  reminder off when its method is cleared THROUGH that one screen, nothing
  at the data-model layer prevented a restored backup, a future migration,
  or any other future write path from producing the orphaned combination —
  so this was a genuine (if narrow) live risk (a real "Time to take your
  birth control" notification with no method on file), not merely a
  fixture artifact. Fixed at the root with a `!profile.birthControlMethod`
  guard in `buildReminderPlans`, which self-heals any orphaned stored state
  on the next reconcile with no dedicated migration needed. Also fixed the
  one surface that reads the raw preference outside that choke point
  (`SettingsBirthControlScreen`'s `reminderEnabled` in `SettingsScreen.tsx`,
  now gated on `selectedMethod` too) so the BC detail screen presents "No
  method selected / Choose a method before turning on the reminder."
  instead of a live-looking scheduled time. The Settings hub row needed no
  change (`formatBirthControlHubSummary` was already method-first and
  correctly reported "Off"). Also fixed the fixture that originally
  surfaced this (`tenureFixtures.ts`'s `enabledReminderPreferences()`
  unconditionally enabled birth-control regardless of method — an
  unreachable combination once the guard lands; now gated on a
  `hasBirthControlMethod` parameter, only passed `true` for
  `tenure-12mo-regular`). See LT-26's finding entry above for full
  rationale, files touched, and golden-diff justification.
- **D5 watch item**: NOT fixed as a CONFIRMED bug (never reliably
  reproduced — a recapture of the same surface was clean). Applied cheap
  FlatList tuning hardening to `Screen.tsx`'s `virtualizedList` mode per
  this item's explicit scope: `windowSize` raised 7 -> 11, and
  `updateCellsBatchingPeriod={50}` added alongside the existing
  `maxToRenderPerBatch={16}`; `initialNumToRender` (12) and
  `removeClippedSubviews` (on) left unchanged. Deliberately not
  over-engineered (e.g. did not disable `removeClippedSubviews` on
  Android, which would reintroduce the unbounded-view-count problem LT-10
  fixed, to guard against an unreproduced symptom). Kept as a documented
  watch item in the ledger, not marked CONFIRMED-fixed. See D5's entry
  above (placed alongside LT-10/LT-15, the related virtualization
  findings) for full detail.
- Commits (logical groups, in order):
  1. `b468cfd` — LT-26 (birth-control reminder method-presence guard:
     `buildReminderPlans.ts`, `SettingsScreen.tsx`, `tenureFixtures.ts`,
     plus test updates across 9 test files)
  2. `7cae4ac` — D5 (FlatList tuning hardening: `Screen.tsx`, plus
     `Screen.test.tsx`)
  3. this commit — ledger update
- Full suite: 265 suites / 4186 tests green after every commit (up from
  265/4179 at the start of this pass — net +7 tests: 3 in
  `buildReminderPlans.probe.longTenure.test.ts`, 2 in
  `SettingsScreen.test.tsx`, 1 in `PrivateTimelineScreen.test.tsx`, 1 in
  `Screen.test.tsx`). Typecheck (`npx tsc --noEmit -p .`) and lint
  (`npm run lint -- --max-warnings=0`) clean throughout (zero warnings,
  zero errors). Coverage on touched production files: `buildReminderPlans
  .ts` 100% statements/100% lines, `tenureFixtures.ts` 97.34%
  statements/98.56% lines, `SettingsScreen.tsx` 96.17% statements/96.55%
  lines (pre-existing large file; the new `reminderEnabled` guard line
  itself is exercised by both branches via the new LT-26 tests) — all
  meet or exceed the 95% touched-file target.
- New/extended probe files: `buildReminderPlans.probe.longTenure.test.ts`
  gained a "RESOLVED LT-26" describe block (3 tests). `SettingsScreen
  .test.tsx` gained 1 screen-level LT-26 case plus 1
  `formatBirthControlHubSummary` regression-pin case.
  `PrivateTimelineScreen.test.tsx` gained 1 LT-26 case. `Screen.test.tsx`
  gained 1 D5 case pinning the tuned FlatList prop values.
- Golden/consumer diffs, all justified inline in LT-26's finding entry
  above: 9 test files needed a `birthControlMethod: 'pill'` added to a
  shared/base profile fixture (module-level `const profile`, or a
  `baseProfile()`/`BASE_PROFILE` helper's default) to keep exercising
  birth-control reminder scheduling now that it has a real precondition —
  every diff is the identical "this profile now needs a method" shape, no
  other behavioral assertions changed. D5's `Screen.tsx` change needed no
  golden diffs (no pre-existing test asserted the old `windowSize`/batching
  values).

## Phase 5 re-verification (final verifier pass, iOS)

Executed 2026-07-07 on `feature/1.2.0-smarter-predictions`, HEAD `598ab5d`,
against the full Phase 5 diff (`46526f6..598ab5d`). Gates at HEAD: 265
suites / 4186 tests green, `tsc --noEmit` clean, lint clean, coverage gate
passing. Non-stale regression proof: `buildTodaySnapshot` +
`buildCalendarScreenModel` outputs for `tenure-12mo-regular`
(todayIso 2026-07-06) dumped at `46526f6` and at `598ab5d` are
**byte-identical** — no non-stale user's Today/Calendar output changed.

On-device captures (iPhone 17 Pro-Detox, one Metro restart per variant with
`EXPO_PUBLIC_DEV_LAUNCH_PRESET` + `EXPO_PUBLIC_BILLING_E2E_MODE=
local-purchase-success`): saved next to the Phase 3/5 evidence with a
`-postfix5` suffix.

Per-surface verdicts:

- **tenure-12mo-irregular / insights — VERIFIED** (LT-18/21/22/23). Card
  reads "Somewhat variable / 26 AVG", footnote "Varying by about +/- 5
  days… tracking the pattern as it settles" — derived (engine spreadDays 5
  is in the (2, 6] somewhat-variable band; the fixture's post-MAD spread is
  NOT >6, so 'varies-widely' would have been wrong), no "treating your
  cycle as regular". Phase rhythm 5+2+6+13 = 26 = displayed AVG (LT-21).
  Bars still honestly show the raw 23–60d range. Monthly briefing: "3 local
  logs reviewed / July shows 3 period days and 2 symptom days so far" —
  lead matches chips, "so far" correct for the in-progress month (LT-22).
- **tenure-6mo-gap / insights — VERIFIED with a documented judgment call**
  (LT-18). AVG is 29, not the pre-fix naive "60" — the 121-day gap bar is
  still drawn (honest raw history) but no longer averaged into the summary.
  NOTE: the card DOES show "Consistent on average / Within about +/- 1
  days… treating your cycle as regular" — this is the classifier working
  as specified (post-MAD survivors 30/29 → spreadDays ≤ 2, sampleSize 2 ≥
  the n≥2 threshold), and the statement is true of the surviving recent
  cycles, but a reviewer expecting "no consistency claim after a discarded
  gap" should know sampleSize=2 is the minimum the classifier accepts.
  Recorded as a watch item (threshold could move to sampleSize ≥ 3), plus
  a copy NIT: "+/- 1 days" / "+/- 0 days" should singularize/degrade
  gracefully ("within about a day").
- **tenure-1mo-new / insights — VERIFIED** (LT-18). "Not enough data yet /
  Log a couple more periods so Floriva can learn your cycle pattern." at
  n=1; avgDays falls back to the profile estimate (28) instead of parroting
  the lone 26-day interval; the single raw bar still shown. June briefing
  (past-month fallback) says "June showed … " with no "so far" (LT-22).
- **tenure-lapsed / today — VERIFIED** (final fix pass, 2026-07-07;
  `today-postfix6.png`). Headline "Your local estimate needs a refresh" +
  caption "Log your latest period to see today's cycle phase again."
  replace the fertile assertion (LT-24 ✓); the "This cycle" ribbon is fully
  suppressed (✓); the missed-period nudge renders untouched (✓); all four
  empty-log boxes show the same en dash (LT-29 ✓). Previously RESIDUAL: the
  hero numeral block asserted "13 / Cycle day 13 of 29" — now shows a red
  dash + "Awaiting an update" (LT-30, FIXED → VERIFIED).
- **tenure-lapsed / calendar-current — VERIFIED** (final fix pass,
  2026-07-07; `calendar-current-postfix6.png` +
  `calendar-current-b-postfix6.png`). Banner reads "Log your latest period
  to update this estimate" with no concrete dates (LT-27 ✓); zero
  predicted-period rings drawn (LT-09 holds ✓). Previously RESIDUAL: the
  grid shaded a green FERTILE run (Jul 5–10) and the inline day card showed
  a "Fertile window" chip — now zero fertile shading anywhere on the grid
  and no "Fertile window" tag on the inline card (LT-31, FIXED →
  VERIFIED); "Cycle day 13" is intentionally retained on the inline card
  per a scope decision matching `CalendarDayScreen`'s existing precedent
  (see LT-31 detail).
- **tenure-12mo-regular / insights + today — VERIFIED, no regression**.
  Insights: "Consistent on average / 28 AVG / +/- 0 days … treating your
  cycle as regular"; phase rhythm sums 5+4+6+13 = 28. Today: "Fertile
  window active today", High confidence, "13 cycles / Based on 13 local
  cycle starts", full THIS CYCLE ribbon (1-5 / 6-9 / 10-15 / 16-28),
  Birth control "Pill · reminder on" (LT-26 method-present path intact).
  Matches the byte-identical model dump above.
- **tenure-12mo-irregular / settings + birth-control — VERIFIED** (LT-26).
  Settings hub: "Birth control — Off" (no phantom "Daily at …"); BC detail:
  "No method selected / Choose a method before turning on the reminder."
  with the Turn on affordance disabled-styled. Account row shows "Trial
  active · Annual plan" (the LT-28 `trial_active` state is a real reachable
  state on this fixture).

### LT-30 — (residual of LT-24) Today hero still asserts "Cycle day N of M" while stale

- **Severity**: medium (trust — same class as LT-24)
- **Status**: CONFIRMED → **FIXED → VERIFIED** (final fix pass,
  2026-07-07). Originally CONFIRMED at Phase 5 re-verification, iOS capture
  `tenure-lapsed/ios/today-postfix5.png`. NOT fixed in `46526f6..598ab5d`;
  fixed in this pass.
- **Surface**: Today tab hero numeral (`TodayScreen.tsx` ~line 228: the
  `snapshot.cycleDay` / `snapshot.cycleDayLabel` / `of {cycleLengthDays}`
  block).
- **Detail**: LT-24's fix hedged the fertile headline/caption and
  suppressed the "This cycle" `CycleRibbon`, but the hero block above them
  was not gated on `stale-history` and still presented "13 / Cycle day 13 of
  29" — a number computed from the same rolled synthetic anchor — as
  present-tense fact, directly above the hedged headline. LT-24's own
  ledger entry text ("rather than showing a cycle-day number computed from
  a synthetic anchor") described an outcome the hero did not yet meet.
- **Fix**: reused the same `isStale` flag `TodayScreen.tsx` already computes
  for the phase-ribbon suppression (LT-24). When stale, the hero numeral now
  renders the same en-dash glyph (`tracker.summary.empty`) LT-29 established
  for "nothing to show" states elsewhere on this screen, and the sub-label
  swaps from `cycleDayLabel` ("Cycle day 13") to a new neutral
  `predictions.today.staleHeroLabel` key ("Awaiting an update") instead of
  inventing new design; the "of N" suffix is hidden entirely (there is no
  honest cycle-length claim to append once the anchor is synthetic). No new
  design was introduced — this is the same "suppress rather than
  assert-with-caveat" pattern LT-09/LT-24/LT-27 already established. Added
  `staleHeroLabel` to all 8 locale catalogs (en/es/de/fr/ja/zh-Hans/pt/ru)
  and two testIDs (`testIds.today.heroNumeral`, `.heroLabel`) for precise,
  unambiguous test targeting (the screen already has other en-dash text
  elsewhere, so a plain text query would have been ambiguous).
- **Files**: `src/features/tracker/screens/TodayScreen.tsx`,
  `src/localization/messages/predictions.ts` (new `today.staleHeroLabel` key
  ×8 locales), `src/testing/testIds.ts` (2 new testIDs).
- **Tests**: extended `describe('LT-24: stale prediction hedging', ...)` in
  `tests/features/tracker/TodayScreen.test.tsx` — added hero-suppression
  assertions to the existing stale case, a new dedicated LT-30 stale case
  asserting the en-dash + "Awaiting an update" placeholder, and a regression
  assertion on the existing non-stale case pinning "24" / "Cycle day 24" /
  "of 28" unchanged.
- **Verification**: full suite 265 suites / 4191 tests green, `tsc --noEmit`
  clean, lint clean. Non-stale regression proof: `buildTodaySnapshot` +
  `buildCalendarScreenModel` JSON dump for `tenure-12mo-regular`
  (todayIso 2026-07-06) compared between pre-fix HEAD (`cd6ec09`, via git
  worktree) and the fixed working tree — **byte-identical**. On-device iOS
  capture (iPhone 17 Pro-Detox) `tenure-lapsed/ios/today-postfix6.png`:
  hero shows a red dash + "Awaiting an update", headline/caption/ribbon
  unaffected (still LT-24's hedge), missed-period nudge and en-dash log
  boxes unchanged (LT-29).

### LT-31 — (gap between LT-09 and LT-24) Calendar grid + inline day card still assert the fertile window while stale

- **Severity**: medium (trust/coherence — the grid asserts exactly what
  Today, the day-detail screen, and the banner now refuse to assert)
- **Status**: CONFIRMED → **FIXED → VERIFIED** (final fix pass,
  2026-07-07). Originally CONFIRMED at Phase 5 re-verification, iOS
  captures `tenure-lapsed/ios/calendar-current-postfix5.png` and
  `…/calendar-current-b-postfix5.png`. NOT fixed in `46526f6..598ab5d`;
  fixed in this pass.
- **Surface**: Calendar month grid `isFertile` shading
  (`buildCalendarScreenModel.ts` ~line 326: was gated only on
  `showFertilityEstimates`, not `isPredictionStale`) and the inline
  selected-day card on `CalendarScreen` (showed a "Fertile window" chip and
  "Cycle day 13" for the stale user; `CalendarDayScreen` — the pushed
  day-detail route — already suppressed its Fertile chip per LT-24, so
  grid, inline card, and pushed detail disagreed).
- **Detail**: with `tenure-lapsed`, the July grid drew a green fertile run
  (Jul 5–10) sourced from `prediction.fertileWindow` — the same rolled
  synthetic anchor whose predicted-period shading LT-09 already suppresses
  and whose fertile claim LT-24 already hedges on Today.
- **Fix**: `isFertile` on each grid cell now also requires
  `!isPredictionStale`, mirroring LT-09's exact gate on predicted-period
  shading in the same function. Since `CalendarScreen.tsx`'s inline
  selected-day card derives its "Fertile window" tag directly from
  `selectedCell.isFertile` (`selectedDateTags`), this single model-level
  change fixes both the grid shading AND the inline chip in one place — no
  separate screen-level change needed. **Scope decision**: `Cycle day N` on
  the inline card is deliberately left untouched, matching the established
  `CalendarDayScreen` precedent (LT-24's own fix kept that screen's `Cycle
  day N` eyebrow visible while stale and suppressed only the "Fertile"
  phase label) — cycle-day-within-cycle is a per-day structural fact
  re-derivable for any date, not a "current status" claim, so it is not the
  same trust violation as the fertile-window assertion.
- **Files**: `src/features/calendar/buildCalendarScreenModel.ts` (one
  added `!isPredictionStale` clause on `isFertile`).
- **Tests**: new `describe('FIXED LT-31 — stale calendar grid no longer
  shades a phantom fertile window', ...)` in
  `tests/features/calendar/buildCalendarScreenModel.probe.longTenure.test.ts`
  (3 cases: stale suppresses all `isFertile` cells reproducing the exact
  Jul 5–10/cycleDay-13 shape from the ledger; non-stale regression pin;
  stale + `showFertilityEstimates: true` explicitly still suppresses). New
  `CalendarScreen.test.tsx` integration case asserting both the grid marker
  testID and the "Fertile window" text are absent while `Cycle day N`
  stays visible.
- **Verification**: full suite 265 suites / 4191 tests green, `tsc --noEmit`
  clean, lint clean. Non-stale regression proof: same byte-identical
  `tenure-12mo-regular` JSON dump as LT-30 (single combined dump covers
  both fixes). On-device iOS captures (iPhone 17 Pro-Detox)
  `tenure-lapsed/ios/calendar-current-postfix6.png` and
  `…/calendar-current-b-postfix6.png`: no green fertile shading anywhere on
  the July grid, inline day card shows only the "Today" tag (no "Fertile
  window"), "Cycle day 13" retained per the scope decision above.
