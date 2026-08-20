/**
 * Probe-adversarial tests for buildCalendarScreenModel.
 *
 * Every expected value is computed from documented logic; divergence from
 * correct behavior makes the test FAIL so real bugs are surfaced.
 *
 * Coverage areas not already in the existing adversarial / unit suites:
 *  A. Dec→Jan year-rollover grid (predicted period straddles Dec 31 / Jan 1)
 *  B. Fertile window straddling a month boundary
 *  C. Explicit 'none' log on a date that falls inside the predicted window
 *     (BUG CANDIDATE: should suppress predicted-period marker)
 *  D. Far-future month navigation (>1 cycle ahead of today — no predicted cells)
 *  E. Far-past month navigation (past month viewed today, currentCycleWindow lands mid-grid)
 *  F. Today = exact last day of cycle (day 28 of 28), no roll yet
 *  G. Today = exact first day of a new cycle (diff=28, roll fires, effectiveStart advances)
 *  H. Very short cycle floored to 20 days from profile
 *  I. Very long cycle (90 days)
 *  J. Single log entry (bleeding-history source with periodStartCount<2, low confidence)
 *  K. Profile with future lastPeriodStartDate (no logs, onboarding-seed path)
 *  L. Leap-year Feb 29 gets correct marker when a cycle start lands on it
 *  M. recentCycles: exactly 2 period starts yields exactly 1 cycle entry
 *  N. historyItems cap: 7 entries → returns exactly 6 (most recent 6)
 *  O. Spotting entry on a date inside the next-period predicted window overrides it
 *  P. monthIso with non-01 day normalizes to month start correctly
 *  Q. Today at far-past month boundary edge (isToday=false for all cells)
 */

import type { DailyLogEntry, UserProfile } from '@/src/types/domain';
import { buildCalendarScreenModel } from '@/src/features/calendar/buildCalendarScreenModel';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function entry(logDate: string, bleeding: DailyLogEntry['bleeding']): DailyLogEntry {
  return { id: `${logDate}-${bleeding}`, logDate, bleeding, symptoms: [] };
}

const baseProfile: UserProfile = {
  cycleLengthDays: 28,
  periodLengthDays: 5,
  lastPeriodStartDate: '2026-03-28',
  goals: ['period'],
  supportsIrregularCycles: false,
  conditionTags: [],
};

// ---------------------------------------------------------------------------
// A. Dec→Jan year-rollover: predicted period straddles Dec 31 / Jan 1
// ---------------------------------------------------------------------------
describe('A – Dec/Jan year-rollover boundary', () => {
  /**
   * Setup:
   *   today = 2025-12-20
   *   one logged period start = 2025-12-03
   *   cycleLen = 28 (profile)
   *   diff(2025-12-03, 2025-12-20) = 17 < 28 → no rolling
   *   effectiveStart = 2025-12-03
   *   nextPeriodStart = addDays(2025-12-03, 28) = 2025-12-31
   *   periodLength = 5 → predicted dates: Dec 31, Jan 1, Jan 2, Jan 3, Jan 4
   *   currentCycleWindow: Dec 3..7 (already past, not in Dec grid overlap region)
   *
   * Dec 2025 grid:
   *   Dec 1 = Monday (weekday 1) → gridStart = Nov 30 (Sunday)
   *   Dec 31 = Wednesday (weekday 3) → endOffset = (6-3+7)%7 = 3 → gridEnd = Jan 3 2026
   *
   * Jan 2026 grid:
   *   Jan 1 = Thursday (weekday 4) → gridStart = Dec 28 (Sunday)
   *   Jan 31 = Saturday (weekday 6) → endOffset = 0 → gridEnd = Jan 31
   */
  const profile: UserProfile = {
    ...baseProfile,
    lastPeriodStartDate: '2025-12-03',
  };
  const logEntries = [entry('2025-12-03', 'heavy')];
  const todayIso = '2025-12-20';

  it('Dec 31 is marked predicted-period in December grid', () => {
    const model = buildCalendarScreenModel({
      todayIso,
      monthIso: '2025-12-01',
      profile,
      logEntries,
      locale: 'en',
    });
    const dec31 = model.weeks.flat().find((c) => c.date === '2025-12-31');
    expect(dec31).toBeDefined();
    expect(dec31?.marker).toBe('predicted-period');
  });

  it('Jan 1 padding cell (in December grid) is marked predicted-period', () => {
    const model = buildCalendarScreenModel({
      todayIso,
      monthIso: '2025-12-01',
      profile,
      logEntries,
      locale: 'en',
    });
    // Jan 1-3 should be padding cells in the December grid (endOffset=3)
    const jan1 = model.weeks.flat().find((c) => c.date === '2026-01-01');
    expect(jan1).toBeDefined();
    expect(jan1?.inMonth).toBe(false);
    expect(jan1?.marker).toBe('predicted-period');
  });

  it('Jan 1 is also marked predicted-period when viewing January grid', () => {
    const model = buildCalendarScreenModel({
      todayIso,
      monthIso: '2026-01-01',
      profile,
      logEntries,
      locale: 'en',
    });
    const jan1 = model.weeks.flat().find((c) => c.date === '2026-01-01');
    expect(jan1).toBeDefined();
    expect(jan1?.inMonth).toBe(true);
    expect(jan1?.marker).toBe('predicted-period');
  });

  it('Dec 30 (day before predicted period) is NOT predicted-period', () => {
    const model = buildCalendarScreenModel({
      todayIso,
      monthIso: '2025-12-01',
      profile,
      logEntries,
      locale: 'en',
    });
    const dec30 = model.weeks.flat().find((c) => c.date === '2025-12-30');
    expect(dec30?.marker).toBe('none');
  });

  it('Jan 5 (one day after predicted period ends) is NOT predicted-period', () => {
    const model = buildCalendarScreenModel({
      todayIso,
      monthIso: '2026-01-01',
      profile,
      logEntries,
      locale: 'en',
    });
    const jan5 = model.weeks.flat().find((c) => c.date === '2026-01-05');
    expect(jan5?.marker).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// B. Fertile window straddling a month boundary
// ---------------------------------------------------------------------------
describe('B – fertile window straddling March/April boundary', () => {
  /**
   * Setup:
   *   effectiveStart = 2026-03-22 (logged period, today=2026-03-28)
   *   diff(2026-03-22, 2026-03-28) = 6 < 28 → no rolling
   *   nextPeriodStart = addDays(2026-03-22, 28) = 2026-04-19
   *   fertileWindow = [addDays(2026-04-19,-19), addDays(2026-04-19,-14)]
   *                 = [2026-03-31, 2026-04-05]
   *
   * March 2026 grid:
   *   Mar 1 = Sunday (weekday 0) → gridStart = Mar 1
   *   Mar 31 = Tuesday (weekday 2) → endOffset = (6-2+7)%7 = 4 → gridEnd = Apr 4
   *
   * So Mar grid covers Mar 1 – Apr 4; fertileWindow Mar 31 – Apr 4 is IN the grid.
   * (Apr 5 is OUTSIDE the March grid but inside the April grid.)
   *
   * April 2026 grid:
   *   Apr 1 = Wednesday (weekday 3) → gridStart = Mar 29
   *   Apr 30 = Thursday (weekday 4) → endOffset = (6-4+7)%7 = 2 → gridEnd = May 2
   *
   * So April grid covers Mar 29 – May 2; fertileWindow Mar 31 – Apr 5 is entirely inside.
   */
  const profile: UserProfile = { ...baseProfile, lastPeriodStartDate: '2026-03-22' };
  const logEntries = [entry('2026-03-22', 'heavy')];
  const todayIso = '2026-03-28';

  it('Mar 31 is fertile in March grid', () => {
    const model = buildCalendarScreenModel({
      todayIso,
      monthIso: '2026-03-01',
      profile,
      logEntries,
      locale: 'en',
      showFertilityEstimates: true,
    });
    const mar31 = model.weeks.flat().find((c) => c.date === '2026-03-31');
    expect(mar31?.isFertile).toBe(true);
  });

  it('Apr 4 (last cell of March grid, within fertile window) is fertile', () => {
    const model = buildCalendarScreenModel({
      todayIso,
      monthIso: '2026-03-01',
      profile,
      logEntries,
      locale: 'en',
      showFertilityEstimates: true,
    });
    const apr4 = model.weeks.flat().find((c) => c.date === '2026-04-04');
    expect(apr4).toBeDefined(); // Apr 4 is a trailing padding cell in March grid
    expect(apr4?.inMonth).toBe(false);
    expect(apr4?.isFertile).toBe(true);
  });

  it('Apr 5 (in April grid, last day of fertile window) is fertile', () => {
    const model = buildCalendarScreenModel({
      todayIso,
      monthIso: '2026-04-01',
      profile,
      logEntries,
      locale: 'en',
      showFertilityEstimates: true,
    });
    const apr5 = model.weeks.flat().find((c) => c.date === '2026-04-05');
    expect(apr5?.isFertile).toBe(true);
  });

  it('Apr 6 (day after fertile window ends) is NOT fertile', () => {
    const model = buildCalendarScreenModel({
      todayIso,
      monthIso: '2026-04-01',
      profile,
      logEntries,
      locale: 'en',
      showFertilityEstimates: true,
    });
    const apr6 = model.weeks.flat().find((c) => c.date === '2026-04-06');
    expect(apr6?.isFertile).toBe(false);
  });

  it('Mar 30 (day before fertile window starts) is NOT fertile', () => {
    const model = buildCalendarScreenModel({
      todayIso,
      monthIso: '2026-03-01',
      profile,
      logEntries,
      locale: 'en',
      showFertilityEstimates: true,
    });
    const mar30 = model.weeks.flat().find((c) => c.date === '2026-03-30');
    expect(mar30?.isFertile).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// C. BUG CANDIDATE: explicit 'none' log on a date inside the predicted window
// ---------------------------------------------------------------------------
describe('C – explicit none log inside predicted-period window', () => {
  /**
   * Setup:
   *   lastPeriodStartDate = 2026-03-28, cycleLen=28
   *   today = 2026-04-20
   *   nextPeriodStart = 2026-04-25
   *   periodLength = 5 → predicted window: Apr 25-29
   *
   *   User explicitly logs 2026-04-25 as 'none' (confirmed no bleeding).
   *
   * CORRECT BEHAVIOR (what the UX should do):
   *   An explicit 'none' log means "I checked, and there is no bleeding."
   *   The marker for that cell should be 'none', not 'predicted-period'.
   *   The prediction should be acknowledged as having been checked.
   *
   * CURRENT CODE BEHAVIOR (potential bug):
   *   buildLoggedMarkers sets markers.get('2026-04-25') = 'none'
   *   Grid cell: marker='none', condition: marker && marker !== 'none' = false
   *   Falls through to: predictedDates.has('2026-04-25') = true → 'predicted-period'
   *
   *   So an explicit 'none' log does NOT suppress the predicted-period marker.
   *   The assertion below reflects CORRECT expected behavior.
   *   If the test FAILS, it confirms this is a real bug.
   */
  it('explicit none log on predicted-period date should suppress the predicted-period marker', () => {
    const profile: UserProfile = { ...baseProfile, lastPeriodStartDate: '2026-03-28' };
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile,
      logEntries: [
        entry('2026-03-28', 'heavy'), // anchors cycle
        entry('2026-04-25', 'none'),  // explicit "no bleeding" on predicted start
      ],
      locale: 'en',
    });

    const cell = model.weeks.flat().find((c) => c.date === '2026-04-25');
    expect(cell).toBeDefined();
    // The logged 'none' entry should suppress the predicted-period marker.
    // If this fails it is a confirmed bug: the code lets 'predicted-period'
    // override an explicit user confirmation of no bleeding.
    expect(cell?.marker).toBe('none');
  });

  it('explicit none log on a date in the current-cycle window should also suppress predicted-period', () => {
    /**
     * currentCycleWindow = cycleStartDate to cycleStartDate+4
     * With effectiveStart=2026-03-28, currentCycleWindow = Mar 28..Apr 1
     * User logs 2026-03-28 as 'none' (no bleeding despite profile saying period starts there)
     *
     * CORRECT: cell for 2026-03-28 should show 'none'
     * BUG: cell shows 'predicted-period' because 'none' doesn't suppress it
     */
    const profile: UserProfile = {
      ...baseProfile,
      lastPeriodStartDate: '2026-03-28',
      cycleLengthDays: 28,
    };
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-01',
      monthIso: '2026-03-01',
      profile,
      logEntries: [entry('2026-03-28', 'none')], // explicitly no bleeding on cycle-start date
      locale: 'en',
    });

    // effectiveStart derived from onboarding-seed: logEntries has 'none' only, not period evidence
    // So historySource = 'onboarding-seed', lastLoggedStartDate = profile.lastPeriodStartDate = 2026-03-28
    // currentCycleWindow = 2026-03-28..2026-04-01
    const mar28 = model.weeks.flat().find((c) => c.date === '2026-03-28');
    expect(mar28).toBeDefined();
    // CORRECT expected behavior: none log should suppress predicted-period
    // This WILL FAIL if the bug is present (current code shows 'predicted-period')
    expect(mar28?.marker).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// D. Far-future month: more than 1 cycle ahead of today
// ---------------------------------------------------------------------------
describe('D – far-future month navigation (no predicted cells)', () => {
  /**
   * today=2026-04-20, profile cycleLen=28, lastPeriodStart=2026-03-28
   * effectiveStart = 2026-03-28, nextPeriod = 2026-04-25
   * Viewing October 2026 (grid: Sep 27 to Oct 31)
   * nextPeriod (Apr 25) is entirely before Oct grid start (Sep 27)
   * currentCycleWindow = Mar 28..Apr 1 is also entirely before Sep 27
   * → No predicted-period cells should appear in October grid
   */
  it('far-future month has no predicted-period markers', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-10-01',
      profile: baseProfile,
      logEntries: [entry('2026-03-28', 'heavy')],
      locale: 'en',
    });
    const predictedCells = model.weeks.flat().filter((c) => c.marker === 'predicted-period');
    expect(predictedCells).toHaveLength(0);
  });

  it('far-future month has no fertile cells', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-10-01',
      profile: baseProfile,
      logEntries: [entry('2026-03-28', 'heavy')],
      locale: 'en',
      showFertilityEstimates: true,
    });
    const fertileCells = model.weeks.flat().filter((c) => c.isFertile);
    expect(fertileCells).toHaveLength(0);
  });

  it('far-future month does not crash', () => {
    expect(() =>
      buildCalendarScreenModel({
        todayIso: '2026-04-20',
        monthIso: '2028-01-01',
        profile: baseProfile,
        logEntries: [],
        locale: 'en',
      }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// E. Far-past month: currentCycleWindow (rolled-forward effective start) lands mid-grid
// ---------------------------------------------------------------------------
describe('E – past month where currentCycleWindow is in the grid', () => {
  /**
   * today=2026-06-10, profile cycleLen=28, lastPeriodStart=2026-03-28
   * Rolling: diff(2026-03-28, 2026-06-10) = 74 ≥ 28 → roll
   *   after 1 roll: 2026-04-25, diff(2026-04-25, 2026-06-10) = 46 ≥ 28 → roll
   *   after 2 rolls: 2026-05-23, diff(2026-05-23, 2026-06-10) = 18 < 28 → stop
   * effectiveStart = 2026-05-23
   * nextPeriod = addDays(2026-05-23, 28) = 2026-06-20
   *
   * currentCycleWindow = 2026-05-23..2026-05-27
   * May 2026 grid: Apr 26 to Jun 6
   * → currentCycleWindow (May 23-27) IS in the May grid
   * → Those cells get marker='predicted-period' (no logs for those dates)
   *
   * nextPeriodWindow = 2026-06-20..2026-06-24 → outside May grid (grid ends Jun 6)
   */
  it('currentCycleWindow (rolled-forward) appears as predicted-period in past month grid', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-06-10',
      monthIso: '2026-05-01',
      profile: baseProfile,
      logEntries: [], // no logs so no logged markers
      locale: 'en',
    });
    // May 23-27 should be predicted-period (currentCycleWindow without any log)
    const may23 = model.weeks.flat().find((c) => c.date === '2026-05-23');
    expect(may23?.marker).toBe('predicted-period');
    const may27 = model.weeks.flat().find((c) => c.date === '2026-05-27');
    expect(may27?.marker).toBe('predicted-period');
  });

  it('May 28 (outside currentCycleWindow) is NOT predicted-period', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-06-10',
      monthIso: '2026-05-01',
      profile: baseProfile,
      logEntries: [],
      locale: 'en',
    });
    const may28 = model.weeks.flat().find((c) => c.date === '2026-05-28');
    expect(may28?.marker).toBe('none');
  });

  it('nextPeriodWindow (Jun 20-24) is NOT in the May grid', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-06-10',
      monthIso: '2026-05-01',
      profile: baseProfile,
      logEntries: [],
      locale: 'en',
    });
    // Jun cells in May grid are only Jun 1-6 (trailing padding)
    const jun20 = model.weeks.flat().find((c) => c.date === '2026-06-20');
    expect(jun20).toBeUndefined(); // not in grid at all
  });
});

// ---------------------------------------------------------------------------
// F. Today = exact last day of cycle (day 28, no roll fires yet)
// ---------------------------------------------------------------------------
describe('F – today is the last day of the current cycle', () => {
  /**
   * lastPeriodStartDate = 2026-03-28
   * today = 2026-04-24 (diff=27 < 28 → no rolling)
   * effectiveStart = 2026-03-28
   * cycleDay on 2026-04-24 = 28
   * nextPeriodStart = 2026-04-25
   */
  it('cycleDay for today (last cycle day) is 28', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-24',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [entry('2026-03-28', 'heavy')],
      locale: 'en',
    });
    const today = model.weeks.flat().find((c) => c.date === '2026-04-24');
    expect(today?.cycleDay).toBe(28);
  });

  it('tomorrow (nextPeriodStart) is predicted-period', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-24',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [entry('2026-03-28', 'heavy')],
      locale: 'en',
    });
    const tomorrow = model.weeks.flat().find((c) => c.date === '2026-04-25');
    expect(tomorrow?.marker).toBe('predicted-period');
  });

  it('predictionSummary label says "Next period" (not "Current expected")', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-24',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [entry('2026-03-28', 'heavy')],
      locale: 'en',
    });
    expect(model.predictionSummary.nextPeriodLabel).toContain('Next period');
  });
});

// ---------------------------------------------------------------------------
// G. Today = exact first day of new cycle (diff=28, rolling fires, effectiveStart advances)
// ---------------------------------------------------------------------------
describe('G – today is the first day of a new cycle (roll fires)', () => {
  /**
   * lastPeriodStartDate = 2026-03-28
   * today = 2026-04-25 (diff=28 ≥ 28 → roll fires)
   * effectiveStart = addDays(2026-03-28, 28) = 2026-04-25 = today
   * cycleDay = diff(2026-04-25, 2026-04-25) + 1 = 1
   * nextPeriodStart = addDays(2026-04-25, 28) = 2026-05-23
   * currentPeriodEnd = addDays(2026-04-25, 4) = 2026-04-29
   * todayIso >= currentPeriodStartIso (2026-04-25) && <= currentPeriodEndIso (2026-04-29)
   * → label = "Current expected period Apr 25 to 29"
   */
  it('cycleDay for today (first day of new cycle) is 1', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-25',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [entry('2026-03-28', 'heavy')],
      locale: 'en',
    });
    const today = model.weeks.flat().find((c) => c.date === '2026-04-25');
    expect(today?.cycleDay).toBe(1);
  });

  it('today is shown as predicted-period (no log yet for new cycle start)', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-25',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [entry('2026-03-28', 'heavy')],
      locale: 'en',
    });
    // currentCycleWindow = Apr 25..29
    const today = model.weeks.flat().find((c) => c.date === '2026-04-25');
    expect(today?.marker).toBe('predicted-period');
  });

  it('predictionSummary label says "Current expected period" since today is inside the window', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-25',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [entry('2026-03-28', 'heavy')],
      locale: 'en',
    });
    expect(model.predictionSummary.nextPeriodLabel).toContain('Current expected period');
  });

  it('nextPeriodStart after roll is 2026-05-23', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-25',
      monthIso: '2026-05-01',
      profile: baseProfile,
      logEntries: [entry('2026-03-28', 'heavy')],
      locale: 'en',
    });
    // In May grid, May 23-27 are the nextPeriod predicted cells
    const may23 = model.weeks.flat().find((c) => c.date === '2026-05-23');
    expect(may23?.marker).toBe('predicted-period');
  });
});

// ---------------------------------------------------------------------------
// H. Very short cycle floored to 20 days from profile
// ---------------------------------------------------------------------------
describe('H – very short cycle floored to 20 days', () => {
  /**
   * profile.cycleLengthDays = 10 → resolves to max(20, 10) = 20
   * lastPeriodStartDate = 2026-04-01, today = 2026-04-15
   * diff(2026-04-01, 2026-04-15) = 14 < 20 → no rolling
   * nextPeriodStart = addDays(2026-04-01, 20) = 2026-04-21
   * fertileWindow = [addDays(2026-04-21,-19), addDays(2026-04-21,-14)]
   *              = [2026-04-02, 2026-04-07]
   */
  const shortProfile: UserProfile = {
    ...baseProfile,
    cycleLengthDays: 10,
    periodLengthDays: 3,
    lastPeriodStartDate: '2026-04-01',
  };

  it('does not crash with a below-minimum cycle length', () => {
    expect(() =>
      buildCalendarScreenModel({
        todayIso: '2026-04-15',
        monthIso: '2026-04-01',
        profile: shortProfile,
        logEntries: [],
        locale: 'en',
      }),
    ).not.toThrow();
  });

  it('nextPeriodStart is 20 days from effectiveStart (floor applied)', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-15',
      monthIso: '2026-04-01',
      profile: shortProfile,
      logEntries: [],
      locale: 'en',
    });
    // nextPeriodStart = addDays(2026-04-01, 20) = 2026-04-21
    const apr21 = model.weeks.flat().find((c) => c.date === '2026-04-21');
    expect(apr21?.marker).toBe('predicted-period');
  });

  it('fertile window starts at [nextPeriodStart-19] = 2026-04-02', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-15',
      monthIso: '2026-04-01',
      profile: shortProfile,
      logEntries: [],
      locale: 'en',
      showFertilityEstimates: true,
    });
    const apr2 = model.weeks.flat().find((c) => c.date === '2026-04-02');
    expect(apr2?.isFertile).toBe(true);
  });

  it('fertile window ends at [nextPeriodStart-14] = 2026-04-07', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-15',
      monthIso: '2026-04-01',
      profile: shortProfile,
      logEntries: [],
      locale: 'en',
      showFertilityEstimates: true,
    });
    const apr7 = model.weeks.flat().find((c) => c.date === '2026-04-07');
    const apr8 = model.weeks.flat().find((c) => c.date === '2026-04-08');
    expect(apr7?.isFertile).toBe(true);
    expect(apr8?.isFertile).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// I. Very long cycle (90 days)
// ---------------------------------------------------------------------------
describe('I – very long cycle (90 days)', () => {
  /**
   * profile.cycleLengthDays = 90, today=2026-04-20, lastPeriodStartDate=2026-03-28
   * diff(2026-03-28, 2026-04-20) = 23 < 90 → no rolling
   * nextPeriodStart = addDays(2026-03-28, 90) = 2026-06-26
   * fertileWindow = [addDays(2026-06-26,-19), addDays(2026-06-26,-14)]
   *              = [2026-06-07, 2026-06-12]
   */
  const longProfile: UserProfile = {
    ...baseProfile,
    cycleLengthDays: 90,
    periodLengthDays: 7,
    lastPeriodStartDate: '2026-03-28',
  };

  it('does not crash with a 90-day cycle', () => {
    expect(() =>
      buildCalendarScreenModel({
        todayIso: '2026-04-20',
        monthIso: '2026-04-01',
        profile: longProfile,
        logEntries: [],
        locale: 'en',
      }),
    ).not.toThrow();
  });

  it('April grid has no predicted-period (nextPeriod is in June)', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile: longProfile,
      logEntries: [],
      locale: 'en',
    });
    // currentCycleWindow = Mar 28..Apr 3 (7 days period length)
    // Those may be in the April grid (Apr starts Mar 29)
    // but Mar 28 is NOT in the April grid (Apr grid starts Mar 29)
    // Mar 29..Apr 3 IS in the April grid
    const apr1 = model.weeks.flat().find((c) => c.date === '2026-04-01');
    // The current cycle window for profile seed goes Mar 28..Apr 3 (7 days)
    // Apr 1 is within that window → predicted-period
    expect(apr1?.marker).toBe('predicted-period');
  });

  it('June grid contains nextPeriodStart (2026-06-26) as predicted-period', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-06-01',
      profile: longProfile,
      logEntries: [],
      locale: 'en',
    });
    const jun26 = model.weeks.flat().find((c) => c.date === '2026-06-26');
    expect(jun26?.marker).toBe('predicted-period');
  });
});

// ---------------------------------------------------------------------------
// J. Single log entry → low confidence
// ---------------------------------------------------------------------------
describe('J – single log entry (low confidence)', () => {
  it('single heavy entry yields low confidence', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [entry('2026-04-05', 'heavy')],
      locale: 'en',
    });
    // historySource = 'bleeding-history', periodStartCount = 1 < 2 → 'low'
    expect(model.predictionSummary.confidenceLevel).toBe('low');
  });

  it('single log entry does not crash', () => {
    expect(() =>
      buildCalendarScreenModel({
        todayIso: '2026-04-20',
        monthIso: '2026-04-01',
        profile: baseProfile,
        logEntries: [entry('2026-04-05', 'heavy')],
        locale: 'en',
      }),
    ).not.toThrow();
  });

  it('recentCycles is empty with only 1 logged start', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [entry('2026-04-05', 'heavy')],
      locale: 'en',
    });
    expect(model.recentCycles).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// K. Profile with future lastPeriodStartDate (onboarding-seed, no logs)
// ---------------------------------------------------------------------------
describe('K – future lastPeriodStartDate in profile (no logs)', () => {
  /**
   * today=2026-01-01, profile.lastPeriodStartDate=2026-02-01 (future)
   * historySource = 'onboarding-seed'
   * historyStartDates = ['2026-02-01']
   * lastLoggedStartDate = '2026-02-01'
   * diff(2026-02-01, 2026-01-01) = -31 < 28 → no rolling (negative diff)
   * effectiveStart = 2026-02-01
   * nextPeriodStart = addDays(2026-02-01, 29) = 2026-03-02 (source=onboarding-seed → default 29)
   * currentCycleWindow = 2026-02-01..2026-02-05
   *   These are in January grid? Jan grid ends Jan 31 → Feb 1 is NOT in Jan grid.
   *   So Jan grid shows no predicted-period cells.
   */
  const futureProfile: UserProfile = {
    ...baseProfile,
    lastPeriodStartDate: '2026-02-01',
    cycleLengthDays: 28,
  };

  it('does not crash when lastPeriodStartDate is in the future', () => {
    expect(() =>
      buildCalendarScreenModel({
        todayIso: '2026-01-01',
        monthIso: '2026-01-01',
        profile: futureProfile,
        logEntries: [],
        locale: 'en',
      }),
    ).not.toThrow();
  });

  it('January grid shows no predicted-period (future period start is outside grid)', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-01-01',
      monthIso: '2026-01-01',
      profile: futureProfile,
      logEntries: [],
      locale: 'en',
    });
    // Jan grid ends Jan 31; effectiveStart Feb 1 and its window are outside
    const predictedCells = model.weeks.flat().filter((c) => c.marker === 'predicted-period');
    expect(predictedCells).toHaveLength(0);
  });

  it('February grid shows the future period start as predicted-period', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-01-01',
      monthIso: '2026-02-01',
      profile: futureProfile,
      logEntries: [],
      locale: 'en',
    });
    const feb1 = model.weeks.flat().find((c) => c.date === '2026-02-01');
    expect(feb1?.marker).toBe('predicted-period');
  });

  it('all cells before effectiveStart have null cycleDay in January grid', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-01-01',
      monthIso: '2026-01-01',
      profile: futureProfile,
      logEntries: [],
      locale: 'en',
    });
    // All Jan cells are before Feb 1, so all cycleDay should be null
    for (const cell of model.weeks.flat()) {
      if (cell.date < '2026-02-01') {
        expect(cell.cycleDay).toBeNull();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// L. Leap year Feb 29 gets correct predicted-period marker
// ---------------------------------------------------------------------------
describe('L – leap year Feb 29 as cycle start', () => {
  /**
   * today = 2024-03-01 (day after leap day)
   * lastPeriodStartDate = 2024-02-29 (the leap day)
   * diff(2024-02-29, 2024-03-01) = 1 < 28 → no rolling
   * effectiveStart = 2024-02-29
   * nextPeriodStart = addDays(2024-02-29, 28) = 2024-03-28
   * currentCycleWindow = 2024-02-29..2024-03-04
   * Feb 2024 grid: Jan 28 to Mar 2
   * Feb 29 is in the Feb grid → predicted-period (no log)
   */
  const leapProfile: UserProfile = {
    ...baseProfile,
    lastPeriodStartDate: '2024-02-29',
  };

  it('Feb 29 is marked predicted-period in leap year grid', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2024-03-01',
      monthIso: '2024-02-01',
      profile: leapProfile,
      logEntries: [],
      locale: 'en',
    });
    const leapDay = model.weeks.flat().find((c) => c.date === '2024-02-29');
    expect(leapDay).toBeDefined();
    expect(leapDay?.marker).toBe('predicted-period');
  });

  it('Feb 29 cycleDay is 1', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2024-03-01',
      monthIso: '2024-02-01',
      profile: leapProfile,
      logEntries: [],
      locale: 'en',
    });
    const leapDay = model.weeks.flat().find((c) => c.date === '2024-02-29');
    expect(leapDay?.cycleDay).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// M. recentCycles: exactly 2 period starts yields exactly 1 cycle
// ---------------------------------------------------------------------------
describe('M – recentCycles with exactly 2 period starts', () => {
  it('returns exactly 1 cycle entry', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [
        entry('2026-02-01', 'heavy'),
        entry('2026-03-01', 'heavy'),
      ],
      locale: 'en',
    });
    expect(model.recentCycles).toHaveLength(1);
  });

  it('single cycle entry has correct lengthDays', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [
        entry('2026-02-01', 'heavy'),
        entry('2026-03-01', 'heavy'),
      ],
      locale: 'en',
    });
    // diff(2026-02-01, 2026-03-01) = 28
    expect(model.recentCycles[0]?.lengthDays).toBe(28);
  });

  it('single cycle entry endDate = day before second start', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [
        entry('2026-02-01', 'heavy'),
        entry('2026-03-01', 'heavy'),
      ],
      locale: 'en',
    });
    expect(model.recentCycles[0]?.endDate).toBe('2026-02-28');
  });
});

// ---------------------------------------------------------------------------
// N. historyItems cap: 7 entries → exactly 6 returned (most recent 6)
// ---------------------------------------------------------------------------
describe('N – historyItems cap at 6', () => {
  it('returns exactly 6 entries when 7 are provided', () => {
    const logEntries = Array.from({ length: 7 }, (_, i) =>
      entry(`2026-04-${String(i + 1).padStart(2, '0')}`, 'heavy'),
    );
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries,
      locale: 'en',
    });
    expect(model.historyItems).toHaveLength(6);
  });

  it('the 6 returned entries are the 6 most recent', () => {
    const logEntries = Array.from({ length: 7 }, (_, i) =>
      entry(`2026-04-${String(i + 1).padStart(2, '0')}`, 'heavy'),
    );
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries,
      locale: 'en',
    });
    // Sorted descending: Apr 7, 6, 5, 4, 3, 2 (Apr 1 is dropped)
    expect(model.historyItems[0]?.date).toBe('2026-04-07');
    expect(model.historyItems[5]?.date).toBe('2026-04-02');
    // Apr 1 should be absent
    expect(model.historyItems.find((h) => h.date === '2026-04-01')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// O. Spotting inside next-period predicted window overrides predicted-period
// ---------------------------------------------------------------------------
describe('O – spotting inside predicted-period window overrides it', () => {
  /**
   * nextPeriodStart = 2026-04-25 (5-day window: Apr 25-29)
   * User logs Apr 26 as 'spotting'
   * Expected: Apr 26 cell shows 'spotting', not 'predicted-period'
   * Apr 25 (no log) shows 'predicted-period'
   */
  it('spotting log on a date inside predicted window shows spotting marker', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-27',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [
        entry('2026-03-28', 'heavy'),
        entry('2026-04-26', 'spotting'),
      ],
      locale: 'en',
    });
    const apr26 = model.weeks.flat().find((c) => c.date === '2026-04-26');
    expect(apr26?.marker).toBe('spotting');
  });

  it('adjacent unlogged date in predicted window still shows predicted-period', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-27',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [
        entry('2026-03-28', 'heavy'),
        entry('2026-04-26', 'spotting'),
      ],
      locale: 'en',
    });
    const apr25 = model.weeks.flat().find((c) => c.date === '2026-04-25');
    expect(apr25?.marker).toBe('predicted-period');
  });
});

// ---------------------------------------------------------------------------
// P. monthIso with non-01 day normalizes to month start
// ---------------------------------------------------------------------------
describe('P – monthIso normalization', () => {
  it('monthIso with day=15 produces the same grid as monthIso with day=01', () => {
    const opts = {
      todayIso: '2026-04-20',
      profile: baseProfile,
      logEntries: [] as DailyLogEntry[],
      locale: 'en' as const,
    };
    const model1 = buildCalendarScreenModel({ ...opts, monthIso: '2026-04-01' });
    const model2 = buildCalendarScreenModel({ ...opts, monthIso: '2026-04-15' });
    // Same grid structure
    expect(model1.weeks.length).toBe(model2.weeks.length);
    expect(model1.weeks[0]![0]!.date).toBe(model2.weeks[0]![0]!.date);
    expect(model1.monthLabel).toBe(model2.monthLabel);
  });
});

// ---------------------------------------------------------------------------
// Q. Today at far-past / far-future boundary: isToday absent from grid
// ---------------------------------------------------------------------------
describe('Q – isToday boundary: today not in grid', () => {
  it('isToday is false for all cells when today is 3 months before the viewed month', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-01-15',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [],
      locale: 'en',
    });
    const todayCells = model.weeks.flat().filter((c) => c.isToday);
    expect(todayCells).toHaveLength(0);
  });

  it('isToday is false for all cells when today is 3 months after the viewed month', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-07-15',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [],
      locale: 'en',
    });
    const todayCells = model.weeks.flat().filter((c) => c.isToday);
    expect(todayCells).toHaveLength(0);
  });

  it('isToday is true for exactly one cell when today is the last day of month (month end)', () => {
    // Jan 31 2026 is Saturday → gridEnd = Jan 31 (no trailing padding)
    // so isToday must be exactly one cell
    const model = buildCalendarScreenModel({
      todayIso: '2026-01-31',
      monthIso: '2026-01-01',
      profile: baseProfile,
      logEntries: [],
      locale: 'en',
    });
    const todayCells = model.weeks.flat().filter((c) => c.isToday);
    expect(todayCells).toHaveLength(1);
    expect(todayCells[0]?.date).toBe('2026-01-31');
  });

  it('isToday is true for a padding cell when today falls in the leading padding days', () => {
    // April 2026: gridStart = Mar 29, so Mar 29..31 are padding cells
    const model = buildCalendarScreenModel({
      todayIso: '2026-03-30',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [],
      locale: 'en',
    });
    const todayCells = model.weeks.flat().filter((c) => c.isToday);
    expect(todayCells).toHaveLength(1);
    expect(todayCells[0]?.date).toBe('2026-03-30');
    expect(todayCells[0]?.inMonth).toBe(false); // it's a padding cell
  });
});

// ---------------------------------------------------------------------------
// R. Empty state (no logs, no profile lastPeriodStartDate): must not crash
// ---------------------------------------------------------------------------
describe('R – empty state robustness', () => {
  it('empty logEntries and minimal profile does not crash', () => {
    expect(() =>
      buildCalendarScreenModel({
        todayIso: '2026-04-20',
        monthIso: '2026-04-01',
        profile: {
          cycleLengthDays: 28,
          periodLengthDays: 5,
          lastPeriodStartDate: '2026-03-28',
          goals: [],
          supportsIrregularCycles: false,
          conditionTags: [],
        },
        logEntries: [],
        locale: 'en',
      }),
    ).not.toThrow();
  });

  it('empty state produces no logged markers (period or spotting)', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [],
      locale: 'en',
    });
    const loggedCells = model.weeks.flat().filter(
      (c) => c.marker === 'period' || c.marker === 'spotting',
    );
    expect(loggedCells).toHaveLength(0);
  });

  it('empty state produces no historyItems', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [],
      locale: 'en',
    });
    expect(model.historyItems).toHaveLength(0);
  });

  it('empty state produces empty recentCycles', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [],
      locale: 'en',
    });
    expect(model.recentCycles).toHaveLength(0);
  });
});
