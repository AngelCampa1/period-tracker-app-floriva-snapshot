# Long-Tenure Bug Hunt — Phase 0 Findings (Workstream E)

Campaign planned 2026-07-06 (1.2.0, workstream E). This document was executed
today; the underlying dates below are computed dynamically relative to the
runtime "today" at execution time, never hardcoded to a fixed calendar date.

## 1. Does import block data older than 12 months?

**Answer: No — not for file-based Clue/Flo imports. Only the manual
quick-entry period-start path enforces a 12-month lookback.**

Evidence:

- `src/lib/parsing/importParsers.ts` (`parseClueImport`, `parseFloImport`,
  and the shared `parseAdaptedRows`/`normalizeImportRow` pipeline they call)
  contains **no date-age check anywhere**. The only date validation is
  `isIsoDate`/`coerceIsoDate`, which reject malformed calendar dates, not old
  ones.
- A scratch test (`parseClueImport`/`parseFloImport` fed a row dated
  `2021-01-15`, ~5.5 years before today, and another dated `1976-03-01`) was
  run against the real parser and both rows were accepted into `entries`
  with zero `skippedRows`. The scratch test was deleted after confirming the
  result (not part of the shipped test suite — this was a one-off
  verification, per Phase 0 scope).
- The 12-month cutoff that *does* exist lives in
  `src/features/import/ImportFlowProvider.tsx` (`getManualHistoryLookbackStartIso`,
  also duplicated in `src/features/import/screens/ImportScreen.tsx`) and is
  wired only into the **manual** import path: it's passed as
  `lookbackStartIso` on the `ManualHistoryPeriod` payload, which
  `parseManualHistoryImport` (in `importParsers.ts`) uses to skip period-start
  entries older than one year (`reason: 'unsupported'`, message: "Row N is
  older than Floriva's 12-month manual import window.").
- Net effect: a Clue or Flo export file containing years of history will
  import **all of it**, however old. Only the "type dates in manually"
  fallback path is capped at 12 months back from today. This is a real
  asymmetry worth exercising in the sweep — Phase 2's tenure fixtures
  therefore include an intentionally >12-month-old Clue/Flo import file (see
  `scripts/generate-qa-fixtures.ts` changes) to prove the file-import path
  actually ingests it, and the existing manual-history 12-month skip message
  remains covered by its own pre-existing tests (unchanged here).

## 2. Route inventory relevant to the sweep

Read directly from `app/` (Expo Router file-based routing).

- **Timeline route**: `app/(app)/calendar/timeline.tsx` → renders
  `PrivateTimelineScreen` (`src/features/timeline/screens/PrivateTimelineScreen`).
  Path segment: `/calendar/timeline`. Reached from the Calendar tab
  (`app/(app)/(tabs)/calendar.tsx`).
- **Condition-insight screen**: `app/(app)/insights/condition/[conditionKey].tsx`
  → renders `InsightsConditionScreen` with `conditionKey` read via
  `useLocalSearchParams<{ conditionKey?: string }>()`. Path:
  `/insights/condition/[conditionKey]`. Valid `conditionKey` values are the
  `ConditionKey` union in `src/types/domain.ts`: `'pcos' | 'pmdd' |
  'endometriosis'` — e.g. `/insights/condition/pcos`.
- **Oldest-day deep-link format**: `app/(app)/calendar/day/[date].tsx` →
  renders `CalendarDayScreen` with `selectedDate` (from the `date` param) and
  `quick` (from the `quick` param), both read via
  `useLocalSearchParams<{ date?: string; quick?: string }>()`. Path:
  `/calendar/day/[date]`, e.g. `/calendar/day/2025-07-01`. The `date` segment
  is a plain ISO (`YYYY-MM-DD`) string, matching `CalendarDayRoute =
  \`/calendar/day/${string}\`` in `src/types/domain.ts`. `quick=1` (or any
  truthy string) triggers the quick-log fast path (see C3, already shipped).
  For the long-tenure sweep, the "oldest day" deep link for a seeded tenure
  dataset is simply `/calendar/day/<earliest logDate in the dataset>`.

## Directory skeleton

This directory (`docs/qa/2026-07-06-long-tenure-sweep/`) holds Phase 0
findings now, and will hold Phase 3 sweep execution notes/screenshots once
that phase starts. Phase 2 (tenure fixture tooling: `src/testing/tenureFixtures.ts`,
new dev-launch presets, `scripts/generate-qa-fixtures.ts` additions) lives in
source/test trees, not this docs directory — this README's scope is Phase 0
only.

---

# Phase 3 — iOS Visual Sweep (executed 2026-07-07)

## Harness

- `e2e/long-tenure-sweep.e2e.js` — Detox spec adapted from
  `e2e/store-screenshots.e2e.js` (same deep-link `openRoute` driver, clean
  9:41 status-bar override, `simctl` native captures). Gated behind
  `FLORIVA_TENURE_SWEEP=1`. Per surface it captures top-of-screen and
  after-scroll-to-bottom (`-b.png`; timeline also gets `-mid.png`), and
  appends `variant,platform,surface,ms` rows to `timings.csv` where `ms` is
  `openRoute()` → first visible assertion. `FLORIVA_SWEEP_SKIP` is a
  comma-separated surface deny-list for screens known to hang the app.
  The capture loop is resilient: a failing surface is recorded and skipped,
  the rest of the sweep continues, and the test fails at the end with the
  aggregated list.
- `scripts/run-tenure-sweep.sh` — per-variant driver. The app binary is
  built once; presets are inlined into the JS bundle at Metro transform time
  (`EXPO_PUBLIC_DEV_LAUNCH_PRESET` is read by `resolveDevLaunchPreset` from
  `process.env`, which babel-preset-expo bakes into the served bundle), so
  the driver restarts Metro with `--clear` per variant instead of rebuilding.
  It also sets `EXPO_PUBLIC_BILLING_E2E_MODE=local-purchase-success`.
- `scripts/print-tenure-oldest-date.ts` — resolves the oldest seeded
  `logDate` for a variant (same `buildTenureDataset` + local-today anchor the
  app uses) so the driver can deep-link the oldest-day surface.

## Environment

- Device: `iPhone 17 Pro-Detox` simulator
  (`4A7C7BCA-623D-4745-BAEB-135DDC257C71`), iOS 26.4, config `ios.sim.debug`.
- Binary: existing Detox debug build from 2026-06-12 reused —
  `ios/Podfile.lock` unchanged since (verified via git); JS served by Metro.
- Branch `feature/1.2.0-smarter-predictions`, HEAD `814bd54` at run time.

## What ran

Full 17-surface set for the two 12-month variants; reduced 7-surface set
(today, calendar-current, insights, timeline, settings, oldest-day, backup)
for the other four. 123 PNGs total, 60 timing rows in `timings.csv`.

| Variant | Set | Captured | Notes |
| --- | --- | --- | --- |
| tenure-1mo-new | reduced | 7/7 surfaces (15 PNGs) | clean pass |
| tenure-3mo-regular | reduced | 7/7 (15 PNGs) | clean pass |
| tenure-6mo-gap | reduced | 7/7 (15 PNGs) | clean pass |
| tenure-12mo-regular | full | 16/17 (32 PNGs + freeze evidence) | timeline froze the app (see defects) |
| tenure-12mo-irregular | full | 15/17 (30 PNGs + freeze evidence) | timeline froze; condition-endometriosis never mounted |
| tenure-lapsed | reduced | 6/7 (13 PNGs + freeze evidence) | oldest-day froze the app |

Scroll videos (12-month variants only) in `video/`:

- `tenure-12mo-regular-calendar-history.mp4` (1.4 MB, committed)
- `tenure-12mo-irregular-calendar-history.mp4` (1.4 MB, committed)
- `tenure-12mo-regular-timeline.mp4` (235 MB, NOT committed — recording ran
  ~150 s against a largely stalled timeline; kept locally at
  `docs/qa/2026-07-06-long-tenure-sweep/video/`)
- `tenure-12mo-irregular-timeline.mp4` (37 MB, NOT committed — same local
  path; this recording came from a pass where the timeline scrolled)

## App defects hit by the sweep itself (Phase 5 triage input — all four resolved, see the Phase 5 section below and `findings.md` LT-14..LT-17)

1. **App freeze on old day view (tenure-lapsed).** Deep-linking
   `/calendar/day/2025-06-13` (oldest logged day, ~12.8 months back) mounted
   a mostly blank, faded day screen and pinned the JS thread at 100% CPU for
   7+ minutes with no recovery; run killed. Evidence:
   `tenure-lapsed/ios/oldest-day-FROZEN-evidence.png`. The same surface is
   fine for 1mo/3mo/6mo variants and for 12mo-regular (2025-07-24) and
   12mo-irregular (2025-06-30), so age alone is not the trigger.
2. **App freeze on Private timeline (both 12-month variants).** Opening
   `/calendar/timeline` in the capture loop (after monthly-briefing) pinned
   the app at 100% CPU for 8+ minutes; killed both times. Evidence:
   `tenure-12mo-regular/ios/timeline-FROZEN-evidence.png` and
   `tenure-12mo-irregular/ios/timeline-FROZEN-evidence.png`. Intermittent:
   an isolated timeline open during the video pass scrolled normally for
   12mo-irregular, and tenure-lapsed's timeline passes — suggesting the
   hang depends on dense 12-month data plus prior navigation state.
3. **Condition screen never mounts: endometriosis (tenure-12mo-irregular).**
   Deep-linking `/insights/condition/endometriosis` right after
   condition-pmdd timed out at 20 s twice in a row (screen never became
   visible; transient JS stall — the next surface then loaded fine). The
   same route mounts in 63 ms for tenure-12mo-regular. The irregular
   variant's profile has `conditionTags: ['pcos']` only.
4. **Observation (not verified):** the calendar month grid for January 2026
   (`tenure-12mo-regular/ios/calendar-minus-6mo.png`) fades and truncates
   after Jan 28 — days 29–31 are not rendered; December 2025 renders all 31
   days. Screenshots capture it; needs Phase 5 verification.

Timing rows exist for `timeline` on both 12-month variants (272 ms to first
visible) because the screen mounts before the freeze sets in; the missing
`timeline*.png` captures are the freeze artifacts.

## Reproduction

```
pnpm detox:build:ios   # once, if no current debug build
DETOX_IOS_DEVICE_ID=4A7C7BCA-623D-4745-BAEB-135DDC257C71 \
  scripts/run-tenure-sweep.sh                # all six variants
FLORIVA_SWEEP_SKIP=timeline \
  scripts/run-tenure-sweep.sh tenure-12mo-regular   # skip a hanging surface
```

---

# Phase 5 — Sweep-defect triage (executed 2026-07-07)

All four Phase 3 defects were root-caused before fixing; full detail in
`findings.md` (LT-14, LT-15, LT-16, LT-17; LT-10 flipped PLAUSIBLE →
CONFIRMED → FIXED). Summary:

1. **Old-day-view freeze (defect 1) = LT-14**: harness wedge, app
   exonerated. Same mechanism as (2).
2. **Timeline freezes (defect 2) = LT-15 + LT-10**: a live `sample` of the
   frozen process (`triage/timeline-freeze-mainthread-sample.txt`) shows
   Detox's synchronous `ScrollToEdgeAction` pinning the app MAIN thread
   (JS thread idle); its per-step cost scales with mounted-view count, and
   the non-virtualized timeline (LT-10, 341 mounted rows) made it
   effectively unbounded. Fixed both sides: the timeline now virtualizes
   through `Screen`'s new `virtualizedList` mode, and the harness settles
   before scrolling.
3. **Endometriosis "never mounts" (defect 3) = LT-16**: by-design redirect
   — the irregular variant tags only `pcos`, and untagged condition deep
   links self-redirect to `/insights`. The pmdd "pass" was a false positive
   (captured the hub). The harness now expects the redirect and captures
   `<surface>-redirected-to-insights.png` for untagged keys.
4. **Jan 2026 grid truncation (defect 4) = LT-17**: real UX defect — the
   grid's per-CELL reveal stagger (up to ~2.3 s after every month flip)
   left the month tail at opacity 0; the sweep captured mid-stagger. Fixed
   to per-ROW stagger (≤ ~430 ms).

## Evidence updates

- Frozen/false-positive Phase 3 captures kept with `-before-fix` suffixes:
  `tenure-lapsed/ios/oldest-day-FROZEN-evidence-before-fix.png`,
  `tenure-12mo-{regular,irregular}/ios/timeline-FROZEN-evidence-before-fix.png`,
  `tenure-12mo-{regular,irregular}/ios/calendar-minus-6mo(-b)-before-fix.png`,
  `tenure-12mo-irregular/ios/condition-pmdd(-b)-before-fix-false-positive.png`.
- Clean replacements captured in a re-sweep of ONLY the affected surfaces
  with the fixed bundle: lapsed `oldest-day(-b).png`; both 12-month
  variants' `timeline(.png/-mid/-b)` and `calendar-minus-6mo(-b).png`
  (January 2026 renders all 31 days); irregular
  `condition-{pmdd,endometriosis}-redirected-to-insights.png`.
- New timeline scroll videos recorded without stall (CPU 3–77%, no 100%
  pin): `tenure-12mo-regular-timeline.mp4` (39 MB) and
  `tenure-12mo-irregular-timeline.mp4` (30 MB) — NOT committed (size), kept
  locally at `docs/qa/2026-07-06-long-tenure-sweep/video/`, replacing the
  Phase 3 recordings at the same paths.
- `timings.csv` gained re-sweep rows, including
  `condition-{pmdd,endometriosis}-redirected` (574/70 ms to the redirect
  target) and healthy `timeline` rows (301–320 ms to first visible).

## Probe tests added (campaign convention)

- `tests/features/calendar/calendarDayLapsed.probe.longTenure.test.tsx` (LT-14)
- `tests/features/timeline/privateTimelineVirtualization.probe.longTenure.test.tsx` (LT-10/15)
- `tests/features/insights/insightsConditionRedirect.probe.longTenure.test.tsx` (LT-16)
- `tests/features/calendar/calendarGridStagger.probe.longTenure.test.tsx` (LT-17)

---

# Phase 4 — Android Visual Sweep (executed 2026-07-07)

Same sweep as Phase 3, on Android, with the Phase 5 harness fixes already in
place (settle-before-scroll, tagged-conditions redirect map, deny-list).

## Environment

- AVD `Pixel_9_API_35` (API 35, 1080x2424), Detox config `android.emu.debug`.
- Binary: existing debug APK pair reused — `app-debug.apk` built 2026-06-13,
  `app-debug-androidTest.apk` 2026-06-01. The only `android/` change since is
  the 1.1.4 version-code bump in `build.gradle` (verified via git); no native
  dependency changes, JS served by Metro per variant.
- Branch `feature/1.2.0-smarter-predictions`, HEAD `c621fb3` at run time.
- Driver already supported `FLORIVA_SWEEP_PLATFORM=android`; detox needs
  `ANDROID_SDK_ROOT` exported (`~/Library/Android/sdk`).

## Harness changes for Android (same spec, `e2e/long-tenure-sweep.e2e.js`)

- Paywall surface marked `iosOnly: true` and skipped on Android, matching the
  `e2e/store-screenshots.e2e.js` convention — Android full set is therefore
  16 surfaces, not 17.
- Clean status bar via SystemUI demo mode (9:41 clock, full battery/wifi, no
  notification icons) — the Android counterpart of the `simctl status_bar`
  override; best-effort.
- Scroll videos via on-device `adb shell screenrecord` (3-min hard cap per
  file — the scroll pass fits in one), stopped with an on-device SIGINT so
  the MP4 finalizes, then pulled. Android files carry an `-android` suffix
  so they never clobber the iOS recordings in `video/`.
- Month-navigation taps settle 700 ms on Android (vs 400 ms): a 6-tap
  previous-month sequence dropped one tap once (see observations).

## What ran

All six variants passed. Full 16-surface Android set for the two 12-month
variants; reduced 7-surface set for the rest. 127 PNGs under
`<variant>/android/` (124 sweep/re-capture + 3 kept evidence copies), 62
`platform=android` rows appended to `timings.csv` (60 sweep + 2 re-capture).

| Variant | Set | Captured | Notes |
| --- | --- | --- | --- |
| tenure-1mo-new | reduced | 7/7 (15 PNGs) | clean pass |
| tenure-3mo-regular | reduced | 7/7 (15 PNGs) | clean pass |
| tenure-6mo-gap | reduced | 7/7 (15 PNGs) | clean pass |
| tenure-12mo-regular | full | 16/16 (33 PNGs, 2 surfaces re-captured, + 3 evidence copies) | see observations 1 and 2 |
| tenure-12mo-irregular | full | 16/16 (31 PNGs) | pmdd/endometriosis correctly captured as `-redirected-to-insights` |
| tenure-lapsed | reduced | 7/7 (15 PNGs) | clean pass — oldest-day (2025-06-13) renders fine on Android too (LT-14 fix holds) |

Scroll videos (12-month variants) in `video/`:

- `tenure-12mo-{regular,irregular}-calendar-history-android.mp4` (~55 KB,
  committed) — each contains a SINGLE frame: the calendar-history surface
  fits on one screen for these datasets (short "recent bleeding days" list),
  nothing scrolls, and `screenrecord` only encodes on screen updates. Same
  static content the iOS recordings show; not a defect.
- `tenure-12mo-regular-timeline-android.mp4` (156 MB, 91 s) and
  `tenure-12mo-irregular-timeline-android.mp4` (14 MB, 25 s) — NOT committed
  (>10 MB, iOS precedent), kept locally at
  `docs/qa/2026-07-06-long-tenure-sweep/video/`. Both show the timeline
  scrolling with rows rendering continuously — no LT-15-style stall.

## Android-specific observations (Phase 5 triage input — none fixed here)

1. **Intermittent blank timeline viewport after scroll-to-bottom
   (tenure-12mo-regular, 348 rows).** The first sweep's bottom capture came
   out completely blank (background only) after `scrollTo('bottom')` plus an
   800 ms settle — evidence kept as
   `tenure-12mo-regular/android/timeline-b-blank-after-scroll-evidence.png`.
   A re-run of the same surface captured the bottom correctly
   (`timeline-b.png`, oldest Jul 2025 entries visible), and the 91 s scroll
   video of the same screen shows rows rendering the whole way down. Looks
   like the virtualized list's blank-cell window outrunning render on a fast
   programmatic scroll-to-edge (Android/debug JS only; iOS bottom captures
   were never blank). Worth a look at the `virtualizedList` windowing props
   from LT-10/15 before dismissing as emulator-speed noise.
2. **Harness flake, not an app defect: one dropped previous-month tap.** The
   first pass's `calendar-minus-6mo` landed on February 2026 instead of
   January (evidence:
   `calendar-minus-6mo(-b)-dropped-tap-feb2026-evidence.png`); the irregular
   variant's same 6-tap sequence landed on January correctly. Re-captured
   clean after bumping the Android tap settle to 700 ms. The clean January
   2026 captures show all 31 days on Android — LT-17's per-row stagger fix
   holds here too.
3. **Emulator environment caveats.** (a) The AVD has "reduced motion"
   enabled (Reanimated warns at bundle load), so entering/stagger animations
   are largely disabled — LT-17-class mid-stagger defects would be
   under-detected on this emulator. (b) The demo-mode wifi icon renders with
   an exclamation mark (no-internet badge) — cosmetic, ignore in captures.
   (c) Detox replaced the manually booted emulator with its own instance
   (`emulator-13824`) partway through the batch; no impact on artifacts.
4. **Persistence:** nothing anomalous observed (cf.
   `docs/qa/2026-06-11-pristine-sweep/android/persistence-debug/`). Every
   variant launch used `delete: true` + fresh install and the seeded dataset
   mounted correctly each time; this sweep does not exercise cold-relaunch
   persistence.

## Timings vs iOS

Median `openRoute()` → first-visible, Android vs iOS: fresh screen mounts are
uniformly 3–7x slower on Android (debug build + emulator), worst absolute
~1.9 s (monthly-briefing 1937 ms, condition-pcos 1907 ms, calendar-history
1867 ms). No surface approached the 20 s wait or hung. Re-opening an
already-mounted screen (calendar month variants, second/third condition
surface) is on par with iOS (~50–100 ms). Nothing pathological; the gap is
the expected debug-mode delta, not an app defect.

## Reproduction

```
export ANDROID_SDK_ROOT=~/Library/Android/sdk
pnpm detox:build:android   # once, if no current debug APK pair
emulator -avd Pixel_9_API_35 -no-snapshot -no-audio -no-boot-anim &
FLORIVA_SWEEP_PLATFORM=android scripts/run-tenure-sweep.sh   # all six variants
```

## Phase 5 re-verification

Final verifier pass over the Phase 5 fix batch (`46526f6..598ab5d`),
2026-07-07, iOS (iPhone 17 Pro-Detox). Gates: 265 suites / 4186 tests,
tsc, lint, coverage all green; `tenure-12mo-regular` Today/Calendar model
output proven byte-identical to pre-batch `46526f6` (no non-stale
regression). Captures live beside the originals with a `-postfix5` suffix:

- `tenure-12mo-irregular/ios/{insights,settings,birth-control}*-postfix5.png`
  — LT-18/21/22/23 + LT-26 VERIFIED ("Somewhat variable / 26 AVG", phases
  sum to 26, briefing numbers agree, BC "Off / No method selected").
- `tenure-6mo-gap/ios/insights*-postfix5.png` — LT-18 VERIFIED (AVG 29,
  gap bar still drawn, not averaged in). Watch item: sampleSize=2 survivors
  still earn "Consistent on average"; copy NIT "+/- 1 days".
- `tenure-1mo-new/ios/insights*-postfix5.png` — LT-18 VERIFIED
  (not-enough-data framing at n=1).
- `tenure-lapsed/ios/{today,calendar-current}*-postfix5.png` — LT-24/27/29
  claims verified (hedged headline, ribbon suppressed, dateless banner, no
  predicted rings, en dashes) BUT two residuals found and ledgered:
  **LT-30** (hero still says "Cycle day 13 of 29" while stale) and
  **LT-31** (grid still shades the fertile window + inline day card still
  shows "Fertile window" chip while stale).
- `tenure-12mo-regular/ios/{insights,today}*-postfix5.png` — regression
  check VERIFIED (still "Consistent on average", High confidence, full
  ribbon, unchanged banner).

See "Phase 5 re-verification" in `findings.md` for per-surface detail and
the two new residual findings.
