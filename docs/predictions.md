# The prediction engine

**What this is not:** Floriva's predictions are descriptive statistics over the user's own logged
history. There is no clinical validation artifact in this repo, no reference dataset, and no ground
truth to score against. Nothing here diagnoses, confirms ovulation, or supports contraceptive
decisions.

Every `PredictionResult` carries `not-medical-certainty` as a hard-coded baseline limitation:
`const BASE_LIMITATION_CODES: LimitationCode[] = ['on-device', 'not-medical-certainty']`
([confidence.ts](../floriva-app/src/lib/predictions/confidence.ts):9), which renders as "Floriva shows
estimates, not medical certainty."
([predictions.ts](../floriva-app/src/localization/messages/predictions.ts):93, localized into 7
languages). Most fertility surfaces additionally carry their own info sheet: the fertile-window band
on Calendar and Today
([CalendarScreen.tsx](../floriva-app/src/features/calendar/screens/CalendarScreen.tsx):289,
[TodayScreen.tsx](../floriva-app/src/features/tracker/screens/TodayScreen.tsx):282) and the ovulation
estimate in the logging sheet
([TodayLoggingScreen.tsx](../floriva-app/src/features/logging/screens/TodayLoggingScreen.tsx):587),
whose bodies are fixed strings in
[common.ts](../floriva-app/src/localization/messages/common.ts):10-16: "Use it as planning context, not
as contraception guidance." and "Floriva does not confirm ovulation or diagnose anything."

**Two do not, and it is worth naming them rather than writing "every".**
[InsightsTtcScreen.tsx](../floriva-app/src/features/insights/screens/InsightsTtcScreen.tsx):76 renders
`fertileWindowLabel` as a headline, and
[CalendarDayScreen.tsx](../floriva-app/src/features/calendar/screens/CalendarDayScreen.tsx):193-197
renders a phase pill that can read "Fertile". Neither file contains a `HelpTooltip`, a disclaimer
string, or a limitation code of any kind: the baseline `not-medical-certainty` limitation exists on
the `PredictionResult` these screens are built from, but neither screen displays it. Both are
suppressed when the user turns fertility estimates off, and the calendar pill is additionally
suppressed on stale history (`:167-168`), so the gap is narrower than it could be. It is still a gap.
The rest of this document is the algorithm.

---

## 1. Orchestration

[buildPredictionResult.ts](../floriva-app/src/lib/predictions/buildPredictionResult.ts) is a thin
composition; every decision below lives in a pure, I/O-free module.

```
logEntries ──► collectPeriodStarts ──► historyStartDates ──► resolveCycleLengthDays
                (cycleHistory.ts)                              (robust statistics)
                                                                     │
   effectiveStartDate ◄── roll anchor forward by whole cycles ◄──────┘
        │
        ├──► analyzeCurrentCycleOvulation(open cycle) ──► BBT / OPK / mucus ──► fusion
        ├──► learnLutealLength(historical confirmed ovulations)
        ├──► resolveNextPeriodWindow(anchor, statistics, profile)
        ├──► resolveConfidence / resolveLimitations / selectImprovementCodes
        └──► detectAnomalies(RAW un-rolled view)         → PredictionResult
```

`collectPeriodStarts` ([cycleHistory.ts](../floriva-app/src/lib/predictions/cycleHistory.ts):23-58)
emits a start when bleeding evidence (`light|medium|heavy`) begins a new episode **and**
`diffDays(lastStartDate, entry.logDate) >= MIN_CYCLE_SEPARATION_DAYS` (15). Without the gap guard,
any mid-cycle bleed would re-anchor the whole cycle. It also means the interval series handed to the
statistics module is ≥15 by construction, which matters for the degenerate case in §9.

---

## 2. `cycleStatistics.ts`: robust cycle-length estimation

[cycleStatistics.ts](../floriva-app/src/lib/predictions/cycleStatistics.ts) takes a chronological
array of day-intervals and returns a point estimate plus two dispersion measures (`:121-212`).

**1. Window** to the most recent ≤12 intervals (`MAX_INTERVAL_WINDOW = 12`, `:26`), exported
deliberately, so presentation code claiming to describe "recent cycles" uses the *exact* same slice
rather than hardcoding its own. **2. Hard plausibility bounds:** drop anything outside `[15, 90]`
days (`:27-28`).

**3. MAD outlier rejection** around the bounds-filtered median, with a floor (`:29-38`, `:150-160`):

```ts
const MIN_REJECTION_THRESHOLD_DAYS = 7;
const MAD_REJECTION_MULTIPLIER = 2.5;
const MAD_TO_STD_DEV_SCALE = 1.4826;
...
const rejectionThreshold = Math.max(
  MIN_REJECTION_THRESHOLD_DAYS,
  MAD_REJECTION_MULTIPLIER * mad,
);
const survivors = boundsFiltered.filter(
  (entry) => Math.abs(entry.value - boundsMedian) <= rejectionThreshold,
);
```

MAD rather than standard deviation because with 3 to 12 samples a single 60-day cycle inflates σ
enough to make itself look normal; MAD's 50% breakdown point leaves center and scale unmoved by a
minority of outliers. The 1.4826 factor is the consistency constant making `MAD × 1.4826` an
unbiased estimator of σ under normality (the same constant scipy.stats and R's `mad()` use by
default, cited at `:35-38`), so `spreadDays` reads as "approximately one standard deviation"
downstream.

The 7-day floor exists because MAD collapses toward zero when survivors are nearly identical, and
`2.5 × 0 = 0` would reject *any* deviation; the comment at `:29-33` says the floor "keeps single-day
or few-day noise from being flagged as an outlier." The cost is worth naming: for a very regular user
step 3 degenerates to "reject nothing within ±7 days of the median," so the effective filter is the
hard bounds plus a fixed band.

**4. Recency-weighted median** (`weightedMedian`, `:89-119`). Weights are `1..n` by **original
chronological position** (oldest = 1, newest = n), captured at `:130` *before* any filtering "so
weights survive filtering intact." Survivors are sorted by value carrying their weight; the estimate
is the first value where cumulative weight reaches half the total, with an exact tie averaging into
the next value, mirroring the even-count median convention (`:108-117`). The result tracks recent
behaviour without being a trailing average that one recent outlier can drag.

**5. Two spreads.** Both are `MAD × 1.4826` rounded to 2dp, computed at different points in the
pipeline. This is the most defensible decision in the module. `spreadDays` (post-rejection) sizes
the earliest/latest prediction window, because "outliers must not widen the expected-date range."
`rawSpreadDays` (pre-rejection), plus `madOutlierCount`, is what a consistency claim must be
computed from, because "a CONSISTENCY CLASSIFICATION shown against the user's raw history must not
first discard the very cycles that make that history irregular" (`:44-64`). Otherwise the app
discards the evidence of irregularity and then announces regularity. Insights consumes the raw
pair; the calendar window consumes the filtered one.

---

## 3. From statistics to a cycle length

`resolveCycleLengthDays` ([cycleHistory.ts](../floriva-app/src/lib/predictions/cycleHistory.ts):81-129)
is a three-branch chain: **≥3 starts with ≥1 survivor** → floored robust estimate with `statistics`
attached; **≥3 starts, zero survivors** → plain mean of the *unfiltered* intervals, floored, with no
`statistics` (see §9); **<3 starts** → profile-declared length, else 29 for `onboarding-seed` / 28.
Every branch passes through `applyCycleLengthFloor` (`Math.max(20, Math.round(days))`, `:67-69`),
because ovulation is anchored ~14 days before the next period and the fertile window opens 19 days
before it, so below ~20 days the fertile window would have to start before the cycle does. There is
no corresponding ceiling.

---

## 4. Windows and phases

**`nextPeriodWindow.ts`**
([nextPeriodWindow.ts](../floriva-app/src/lib/predictions/nextPeriodWindow.ts):37-62):

```ts
const maxSpreadCapDays = profile.supportsIrregularCycles ? 7 : 5;
const halfSpreadDays = Math.min(maxSpreadCapDays, Math.ceil(statistics.spreadDays / 2));
```

The window is symmetric around whatever anchor it is handed (calendar projection or
ovulation-re-anchored date), and keeping it a standalone pure function is what makes that an
argument swap rather than orchestrator surgery (`:18-36`). It also encodes an unusual API rule: it
returns `undefined` when `sampleSize <= 0`, and callers must translate that into **fully absent
keys**, not present-with-`undefined`. `statistics`, `earliestStartDate`, and `latestStartDate` must
not appear at all on the seed/fallback path, so JSON round-trips and backups produce shapes
identical to the pre-statistics engine.
`buildPredictionResult.ts:247-256` implements it with conditional spreads; the golden characterization
test enforces it with `toStrictEqual`.

**`cyclePhaseModel.ts`** ([cyclePhaseModel.ts](../floriva-app/src/lib/predictions/cyclePhaseModel.ts))
splits a cycle into period / follicular / fertile / luteal. It is shared by the Today phase ribbon
(via `buildTodaySnapshot.ts` → `CycleRibbon.tsx`) and the Insights phase chart (via
`buildInsightsScreenModel.ts`), so those two can never disagree. It is not, though, the single
source of truth for phase splitting in the app. `CalendarDayScreen.tsx:45-53` computes phases itself
with hardcoded boundaries and never imports this module:

```ts
function resolvePhase(cycleDay: number, cycleLengthDays: number): CyclePhaseLabelKey {
  const periodEnd = Math.min(5, cycleLengthDays);
  const follicularEnd = Math.min(11, cycleLengthDays);
  const fertileEnd = Math.min(17, cycleLengthDays);
```

Those are fixed day numbers, not the cycle-length-scaled waterfall below, and they do not consult the
signal-confirmed fertile window at all. That third implementation is what drives the user-visible
"Fertile" pill on the day-detail screen, the one surface with no disclaimer (see the top of this
document). Constants in `cyclePhaseModel.ts`:
`FERTILE_WINDOW_LENGTH_DAYS = 6`, `DAYS_BEFORE_NEXT_PERIOD_AT_FERTILE_START = 19` (`:15-16`). The
allocation is a clamping waterfall (`:43-64`) rather than four independent formulas, so phases always
sum to exactly `cycleLengthDays`: each is `Math.min(remaining, wanted)` and luteal absorbs the rest.
Degenerate inputs (a period longer than the cycle, or the 20-day floor leaving no room) clamp later
phases instead of over-allocating a fixed-size fertile block that would overflow the ribbon.

---

## 5. Ovulation signals

### `signals/bbtShift.ts`: Marshall's three-over-six rule

[bbtShift.ts](../floriva-app/src/lib/predictions/signals/bbtShift.ts). The valid band
`[35.0, 38.5] °C` (`:51-52`) doubles as a unit-confusion guard: the domain stores Celsius with no unit
field, so a mistyped Fahrenheit `97.8` falls outside and is dropped. Eligibility requires ≥6 valid
readings inside a **10-day calendar** lookback, but the coverline is the max of exactly the **last 6**
of them (`:114-121`):

```ts
const coverlineReadings = priorReadings.slice(-COVERLINE_READINGS);
const coverline = Math.max(...coverlineReadings.map((t) => t.celsius));
if (candidate.celsius < coverline + MIN_SHIFT_RISE_CELSIUS) continue;
```

Splitting eligibility from coverline construction matters: the max of the whole 10-day window would
let a 7-to-10-day-old spike inflate the coverline and suppress a legitimate shift (`:117-119`).
Confirmation then requires the next **two calendar days** (not the next two readings) to exist and
both sit above the coverline (`:124-132`), so a logging gap cannot masquerade as a confirming day.
Ovulation is shift day − 1, since the rise reflects post-ovulatory progesterone. Reports
`uncertaintyDays: 0`, `retrospective: true`.

### `signals/opkSurge.ts`

[opkSurge.ts](../floriva-app/src/lib/predictions/signals/opkSurge.ts):49-55. LH surge → ovulation ≈ +1
day, and a `peak` read outranks a `positive` regardless of chronological order
(`const trigger = firstPeak ?? results.find((r) => r.result === 'positive')`) because peak is the more
specific confirmation. Prospective, `uncertaintyDays: 0`. The fixed +1 day is the consumer-guidance
simplification of a surge-to-ovulation interval of 24 to 36 hours, documented at `:8-11`.

### `signals/mucusPeak.ts`

[mucusPeak.ts](../floriva-app/src/lib/predictions/signals/mucusPeak.ts):67-74. The peak day is the last
egg-white day with **any later logged non-egg-white reading**:
`readings.slice(i + 1).some((later) => later.quality !== 'egg-white')`, i.e. an *observed* drop-off.
Silence is not a dry-up: "treating silence as a dry-up would fabricate a peak day out of missing data"
(`:16-22`), which matters enormously for sparse imported histories. And the scan runs **newest-first**,
opposite to the other two detectors, because fertile mucus returning after an apparent dry-up resets
the peak (`:28-38`). `uncertaintyDays: 2`, the widest of the three, because mucus quality is
subjective.

### `signals/fuseOvulationEstimate.ts`

[fuseOvulationEstimate.ts](../floriva-app/src/lib/predictions/signals/fuseOvulationEstimate.ts).
**Agreement** is one test on the whole set, not a chain of pairwise checks: the widest pairwise span
must be strictly `< 2` days (`:68`, `:147-149`). Three signals spanning 1 day total agree even though
no pair is identical; a 2-day gap (OPK day 14 vs BBT day 16) is a conflict. **Weights** (`:80-85`),
verified verbatim:

```ts
const WEIGHTS: Record<SignalWeightKey, number> = {
  'bbt-shift': 3,
  'opk-peak': 3,
  'opk-positive': 2,
  'mucus-peak': 1,
};
```

These are product-spec assertions about signal specificity, not values fitted against outcome data. On
agreement the fused offset is the weighted median of the per-signal offsets, and uncertainty is
`max(span, largest individual uncertainty)` (`:159-160`): a tight cluster of precise signals does
not inherit mucus's ±2, but a wide-though-agreeing spread is not under-reported either. **Conflict**
resolution is the part worth reading closely (`:162-172`):

```ts
const confirmedBbt = weighted.find((w) => w.signal.kind === 'bbt-shift');
if (!confirmedBbt) {
  // No principled anchor to prefer one non-BBT signal over another --
  // decline to guess.
  return { kind: 'calendar-fallback' };
}
fusedOffsetDays = confirmedBbt.offsetDays;
uncertaintyDays = span;
signalsDisagree = true;
```

With a BBT shift present it anchors there (BBT is the only retrospectively confirmed signal), widens
uncertainty to the full span, and flags `signalsDisagree` so callers cannot read a conflict as
confidence-boosting. Without BBT there is no principled reason to prefer OPK over mucus, so fusion
**declines to guess**; producing a midpoint would have been easy and would have manufactured precision
the inputs do not contain. Finally, a **plausibility clamp** (`:174-180`) requires the fused cycle day
to land in `[8, cycleLengthDays − 7]`, leaving room for a minimum follicular phase and a ≥7-day luteal
phase; outside that band the estimate is presumed a logging error and the caller falls back to the
calendar.

---

## 6. Retrospective honesty, gating, luteal learning

### The retrospective rule

A BBT shift is only detectable after three post-ovulatory readings exist, so by the time it fires
ovulation is already past. It may therefore *confirm* a window that already happened, but must never
*open* one that has not started yet
([ovulationAnalysis.ts](../floriva-app/src/lib/predictions/ovulationAnalysis.ts):337-346):

```ts
const retrospective = isRetrospectiveDate(fused);

if (retrospective) {
  const fertileWindowStart = addDays(fused.ovulationDateIso, -FERTILE_WINDOW_LOOKBACK_DAYS);
  // A purely-retrospective estimate may not open a fertile window that
  // hasn't started yet from today's point of view.
  if (diffDays(todayIso, fertileWindowStart) > 0) {
    return undefined;
  }
}
```

`isRetrospectiveDate` (`:294-307`) covers both ways BBT can determine the date: on the conflict path,
BBT appearing among `contributingSignals` (fusion only ever anchors on BBT there); on the agreement
path, BBT being the **sole** contributor. A conflict where a prospective signal was also logged still
counts as retrospective: the reported date is BBT's after-the-fact confirmation, not the prospective
signal's. This is a temporal-honesty rule enforced in code: the engine refuses to let a definitionally
retrospective signal make a forward-looking claim.

### Hormonal birth-control gate

`resolveHormonalBirthControlGate` (`:110-129`). Pill, implant, ring, and patch always gate: all
signal detection is suppressed. `iud` resolves via the optional `iudType`: copper does **not** gate,
hormonal does, and an **unspecified** sub-type gates by default, with the tradeoff written down at
`:50-61`: gating a copper user who never specified costs a mild loss of signal refinement, whereas
failing to gate a hormonal-IUD user means confidently presenting an ovulation-signal prediction to
someone whose method pharmacologically suppresses ovulation. `'other'` does not gate, since it is not
confirmed hormonal. Note the asymmetry: the gate suppresses *this cycle's* signals, but
[buildPredictionResult.ts](../floriva-app/src/lib/predictions/buildPredictionResult.ts):157-176 still
runs luteal learning across history, so a user who just started hormonal BC does not lose what was
already learned from their pre-BC cycles.

### `lutealLearning.ts`

[lutealLearning.ts](../floriva-app/src/lib/predictions/lutealLearning.ts):71-96. Median of observed
`nextPeriodStart − confirmedOvulation` intervals behind three guards: only confirmations with
`uncertaintyDays ≤ 1` count; lengths must fall in `[9, 17]` days; and ≥2 must survive before the
learned value beats the textbook default of 14. `ovulationAnalysis.ts:212-219` applies the same
uncertainty bar *before* calling: "a second, redundant checkpoint by design." The stricter bar
applies only to learning, not re-anchoring, because
"re-anchoring is a this-cycle-only, self-correcting output, whereas luteal learning compounds across
cycles" (`:76-86`). When a confirmed ovulation exists the next period is re-anchored to
`ovulation + learnedLuteal`
([buildPredictionResult.ts](../floriva-app/src/lib/predictions/buildPredictionResult.ts):182-184), which
can legitimately place the predicted start in the recent past when observed ovulation implies the
period is already late.

---

## 7. Confidence

`resolveConfidence` ([confidence.ts](../floriva-app/src/lib/predictions/confidence.ts):17-90) is a
short ladder returning `{ level, reasonCodes }`, evaluated in order:

| condition | level | reason code |
|---|---|---|
| `onboarding-seed` history | medium | `onboarding-seed` |
| `<2` period starts | low | `limited-bleeding-history` |
| `supportsIrregularCycles` | medium | `irregular-cycle-support-enabled` |
| `<3` period starts | medium | `one-observed-interval` |
| stale history | medium | `stale-history` |
| otherwise | high | `consistent-recent-bleeding-history` |

The `<3` rung is justified in source: "A single interval (two starts) cannot establish a rhythm"
(`:56-57`). The staleness rung is the honest one
([buildPredictionResult.ts](../floriva-app/src/lib/predictions/buildPredictionResult.ts):90-94), with two
independent triggers, either sufficient:

```ts
const daysSinceCalendarExpectation = diffDays(
  addDays(lastLoggedStartDate, cycleLengthDays),
  todayIso,
);
const isHistoryStale = daysSinceCalendarExpectation > 30 || rolledCycles >= 2;
```

The comment is blunt (`:76-84`): "'high confidence, consistent RECENT bleeding history' is dishonest
once the user has gone quiet for a while." Before this, the only hint was a `projected-forward`
limitation code buried in a rarely-opened detail sheet. Three ovulation-derived codes
(`hormonal-birth-control`, `signals-disagree`, `ovulation-signal-confirmed`) are appended *after* the
ladder and never change the level (`buildPredictionResult.ts:134-150`): they explain, they do not
score.

[confidenceImprovements.ts](../floriva-app/src/lib/predictions/confidenceImprovements.ts):25-30 then
filters to the four codes with a concrete follow-up: `onboarding-seed`, `limited-bleeding-history`,
`one-observed-interval`, `stale-history`. Codes with nothing actionable to offer are excluded "by
design, not by omission" (`:32-39`); the engine will not fabricate advice for
`consistent-recent-bleeding-history`.

The engine emits route-agnostic codes; the model layer attaches destinations.
[confidencePresentation.ts](../floriva-app/src/lib/predictions/confidencePresentation.ts):33-43 is a
five-line function mapping each code to a `/calendar/day/{today}` href, kept out of the engine because
routing is not a domain concern. `buildConfidenceInfoModalContent.ts` composes the explanatory modal
as `[intro, general, reasonDetail?]`, with the disclaimer pinned as the stable second element so a
third paragraph can only be appended, never inserted ahead of it (`:15-31`).

---

## 8. Anomalies

[anomalies.ts](../floriva-app/src/lib/predictions/anomalies.ts) detects four kinds: short-cycle,
long-cycle, prolonged-bleeding, missed-expected-period, each threshold justified in prose:

- Short/long bounds derive from typical ± `max(7, spread)`, floored at 21 and capped at 60 days
  (`:92-98`, `:189-191`); the 7-day margin floor stops a razor-thin spread from making unremarkable
  variation look anomalous.
- A hard product rule (`:100-108`): for a user who has *not* opted into irregular support, anything
  past 38 days is long "even if the formula-derived bound would allow more." A wide spread should
  widen the normal range; it should not excuse a genuinely very late period.
- Prolonged bleeding is 8 consecutive light/medium/heavy days, with **spotting breaking a run** rather
  than extending it: spotting is physiologically distinct from flow, so its presence mid-run means
  the heavier bleeding was not continuous (`:126-136`).
- Missed-period grace is `max(7, ceil(spread/2) + 2)`, widened to a 10-day floor for irregular users
  (`:142-152`).
- Completed-interval anomalies older than 90 days are dropped (`:110-124`), because otherwise "a
  long-tenure user's dismissal queue never actually empties: dismissing this cycle's nudge just
  promotes a 5-, 8-, or 10-month-old anomaly to the head, forever."

The architecturally interesting part is the **two-views split**
([buildPredictionResult.ts](../floriva-app/src/lib/predictions/buildPredictionResult.ts):198-233).
Everything else in the function uses the rolled-forward projection so predictions always point forward;
anomalies are deliberately fed the raw, un-rolled `lastLoggedStartDate` and un-rolled expectation,
because the rolled view "would reset the open-cycle clock every cycleLengthDays days: an ongoing
41-day gap would read as a synthetic day-13 cycle." The missed-period detector would be permanently
dead.

Detection always includes already-dismissed anomalies; filtering is presentation, handled by
`filterDismissedAnomalies` ([anomalyPresentation.ts](../floriva-app/src/lib/predictions/anomalyPresentation.ts):46-55), which sorts
most-recent-first so a consumer wanting "at most one nudge" takes the head. `anomalies.ts:80-84` locks
the two shapes together with a bidirectional `Equals` type assertion, so drift between the
presentation `Anomaly` and the inline shape on `PredictionResult` fails compilation rather than
silently forking.

---

## 9. Known weaknesses

### The unfiltered-average fallback

This is the real one, and it was logged rather than hidden.

When there are ≥3 period starts but `computeCycleStatistics` returns `sampleSize === 0` (i.e. every
interval failed the `[15, 90]` bounds),
[cycleHistory.ts](../floriva-app/src/lib/predictions/cycleHistory.ts):100-113 does this:

```ts
// Every interval was discarded by the statistics module (adversarial
// input -- e.g. all intervals outside the [15, 90] plausible-cycle
// bounds). Rather than propagate a degenerate 0-based estimate, fall back
// to the plain average of the raw (unfiltered) intervals: it is at least
// directionally informed by the user's own logged history [...]
const averageInterval =
  intervals.reduce((total, interval) => total + interval, 0) / intervals.length;
return {
  cycleLengthDays: applyCycleLengthFloor(averageInterval),
};
```

The only correction is `applyCycleLengthFloor`: `Math.max(20, Math.round(days))`. There is
**no upper cap**. Since `collectPeriodStarts` already enforces 15-day minimum separation, the
reachable version of this path is the *long* side: a user whose logged starts are far apart (a
year-apart pair, a sparse import of two or three isolated bleeds) yields intervals all >90, all
rejected, and a cycle length equal to their plain mean. A 365- and 400-day pair produces
`cycleLengthDays = 383`.

That value propagates: `nextPeriod.startDate = anchor + 383`, the fertile window becomes
`[next − 19, next − 14]`, and `cyclePhaseModel` allocates a ~360-day follicular phase. Two partial
mitigations exist and neither suffices: no `statistics` object is attached, so no earliest/latest
band is published and the UI cannot render false precision; and the staleness rule will usually
degrade confidence. But nothing in the confidence ladder inspects the *plausibility of the estimate
itself*, so a freshly logged sparse history can reach the `high` rung carrying a nonsense cycle
length. An upper cap mirroring the 20-day floor is the obvious fix and is not implemented.

### Other honest limitations

- **The fusion weights are asserted, not fitted.** BBT 3 / OPK-peak 3 / OPK-positive 2 / mucus 1
  encode a judgment about signal specificity. Validating them would need outcome data the app
  deliberately never collects.
- **No ground truth anywhere.** Every threshold is defended by a prose argument from clinical
  convention, not by measured performance: it is the strongest justification available to an
  offline, no-account, no-telemetry app, and strictly weaker than measurement.
- **The detector caller contract is unenforced.** All three detectors document "pass a single cycle's
  entries; behavior on multi-cycle input is unspecified"
  ([bbtShift.ts](../floriva-app/src/lib/predictions/signals/bbtShift.ts):36-39 and siblings), yet two
  call sites slice cycles independently
  ([ovulationAnalysis.ts](../floriva-app/src/lib/predictions/ovulationAnalysis.ts):157-179 for history,
  `buildPredictionResult.ts:119-122` for the open cycle), kept in agreement by hand. The mucus
  detector's newest-first scan misbehaves most visibly if that slips.
- **The MAD 7-day floor bounds the filter's sensitivity** for regular users, as noted in §2.
- **The OPK +1-day offset is a fixed constant** over a physiological interval of 24 to 36 hours,
  reported with `uncertaintyDays: 0`: a number that describes the *detector*, not the biology.

---

## 10. Test coverage

**978 cases across 37 suites** under
[floriva-app/tests/lib/predictions/](../floriva-app/tests/lib/predictions/), read from a `jest --json`
report: unit tests, `.adversarial` suites written as independent attacks on each module, `.probe`
suites, and `.probe.longTenure` suites exercising multi-year histories.

The counting method matters here, because an earlier draft of this document said "429 `it()` cases"
and then cited a largest file of 67. Both numbers were produced by grep and neither meant what it
looked like. `^\s*it\(` matches 429 declarations, but this directory also has 128 `^\s*test\(`
declarations (the largest files use `test()` exclusively) for 557 declared blocks; and three
`it.each` tables expand those 557 into 978 at runtime. Largest by runtime cases:
`buildPredictionResult.probe.adversarial.test.ts` (321), `presentation.probe2.adversarial.test.ts`
(169), `predictionEngine.probe.adversarial.test.ts` (62), `anomalies.adversarial.test.ts` (40).

`goldenCharacterization.test.ts` is a single `it.each` over a fixture table using `toStrictEqual`,
which makes the additive-field absence contract in §4 enforceable rather than aspirational;
`phaseModelAgreement.test.ts` asserts the Today ribbon and the **Calendar month grid** derive
identical fertile-day sets from the same cycle: Today via
`fertileWindowStartOffsetDays`, Calendar via `fertileWindow.{startDate,endDate}`. It does not cover
the Insights chart, and it does not cover the third phase implementation in `CalendarDayScreen.tsx`
(§4). Coverage is enforced at 95% lines/statements/functions
([jest.config.js](../floriva-app/jest.config.js):78-83) plus a per-file check in
[scripts/check-coverage.js](../floriva-app/scripts/check-coverage.js):14, run locally before a
release, not in CI.
