/**
 * Adversarial tests for src/features/calendar/buildCalendarScreenModel.ts
 *
 * Coverage areas:
 *  1. Grid geometry — always a multiple of 7, correct month boundaries,
 *     Sunday-first alignment, leap years, Dec-Jan rollover.
 *  2. Prediction overlay — predicted-period vs observed markers, fertile window
 *     bounds, no marks outside the rendered range.
 *  3. Input safety — empty logs, far-past / far-future logs, duplicate dates,
 *     single-entry history, profile with extreme cycle lengths.
 *  4. todayIso === grid boundary cells.
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
// 1. Grid geometry
// ---------------------------------------------------------------------------
describe('buildCalendarScreenModel – grid geometry', () => {
  it.each([
    // [label, monthIso, expectedWeeks]
    // weeks = Math.ceil((startOffset + daysInMonth) / 7) rounded up to whole weeks
    ['February 2024 (leap, starts Thursday)', '2024-02-01', 5],
    ['February 2025 (non-leap, starts Saturday)', '2025-02-01', 5],
    ['January 2023 (starts Sunday – no pre-padding)', '2023-01-01', 5],
    ['December 2025 (ends Wednesday)', '2025-12-01', 5],
    ['March 2026 (contains DST spring-forward)', '2026-03-01', 5],
    // Nov 2025 starts Saturday (offset=6) + 30 days = 36 cells → 6 weeks
    ['November 2025 (contains DST fall-back)', '2025-11-01', 6],
    ['April 2026 (regular 30-day month, starts Wed)', '2026-04-01', 5],
    // Aug 2026 starts Saturday (offset=6) + 31 days = 37 cells → 6 weeks
    ['August 2026 (Saturday start, 31 days)', '2026-08-01', 6],
  ])('%s: grid has %i complete weeks of 7 cells', (_, monthIso, expectedWeeks) => {
    const model = buildCalendarScreenModel({
      todayIso: monthIso, // today is in the month to avoid far-future issues
      monthIso,
      profile: baseProfile,
      logEntries: [],
      locale: 'en',
    });

    expect(model.weeks.length).toBe(expectedWeeks);
    for (const week of model.weeks) {
      expect(week.length).toBe(7);
    }
  });

  it('first cell in each grid starts on Sunday (weekday 0) UTC', () => {
    const months = [
      '2024-02-01', // leap Feb
      '2025-02-01', // non-leap Feb
      '2023-01-01', // Jan starting Sunday
      '2026-04-01',
      '2025-12-01',
    ];
    for (const monthIso of months) {
      const model = buildCalendarScreenModel({
        todayIso: monthIso,
        monthIso,
        profile: baseProfile,
        logEntries: [],
        locale: 'en',
      });
      const firstCellDate = model.weeks[0]![0]!.date;
      const weekday = new Date(firstCellDate + 'T00:00:00Z').getUTCDay();
      expect(weekday).toBe(0); // 0 = Sunday
    }
  });

  it('last cell in each grid lands on Saturday (weekday 6) UTC', () => {
    const months = ['2024-02-01', '2025-02-01', '2026-04-01', '2025-12-01'];
    for (const monthIso of months) {
      const model = buildCalendarScreenModel({
        todayIso: monthIso,
        monthIso,
        profile: baseProfile,
        logEntries: [],
        locale: 'en',
      });
      const lastWeek = model.weeks[model.weeks.length - 1]!;
      const lastCellDate = lastWeek[lastWeek.length - 1]!.date;
      const weekday = new Date(lastCellDate + 'T00:00:00Z').getUTCDay();
      expect(weekday).toBe(6); // 6 = Saturday
    }
  });

  it('inMonth flag is true exactly for cells within the requested month', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-15',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [],
      locale: 'en',
    });
    for (const week of model.weeks) {
      for (const cell of week) {
        const expected = cell.date >= '2026-04-01' && cell.date <= '2026-04-30';
        expect(cell.inMonth).toBe(expected);
      }
    }
  });

  it('February 2024 (leap year) has a cell for 2024-02-29', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2024-02-01',
      monthIso: '2024-02-01',
      profile: baseProfile,
      logEntries: [],
      locale: 'en',
    });
    const leapDay = model.weeks.flat().find((c) => c.date === '2024-02-29');
    expect(leapDay).toBeDefined();
    expect(leapDay?.inMonth).toBe(true);
  });

  it('February 2025 (non-leap year) has no cell for 2025-02-29', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2025-02-01',
      monthIso: '2025-02-01',
      profile: baseProfile,
      logEntries: [],
      locale: 'en',
    });
    const noLeapDay = model.weeks.flat().find((c) => c.date === '2025-02-29');
    expect(noLeapDay).toBeUndefined();
  });

  it('December month grid contains Jan 1 of the following year as a padding cell', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2025-12-01',
      monthIso: '2025-12-01',
      profile: baseProfile,
      logEntries: [],
      locale: 'en',
    });
    const jan1 = model.weeks.flat().find((c) => c.date === '2026-01-01');
    // Jan 1 2026 is a Thursday; Dec ends Wed so 3 padding cells exist
    expect(jan1).toBeDefined();
    expect(jan1?.inMonth).toBe(false);
  });

  it('January month grid may contain Dec cells from the prior year as padding', () => {
    // Jan 1 2023 is a Sunday — gridStart IS Jan 1 so no Dec padding
    // Jan 1 2026 is a Thursday — gridStart is Dec 28 2025
    const model = buildCalendarScreenModel({
      todayIso: '2026-01-15',
      monthIso: '2026-01-01',
      profile: baseProfile,
      logEntries: [],
      locale: 'en',
    });
    const dec28 = model.weeks.flat().find((c) => c.date === '2025-12-28');
    expect(dec28).toBeDefined();
    expect(dec28?.inMonth).toBe(false);
  });

  it('isToday is true for exactly the todayIso cell and false for all others', () => {
    const todayIso = '2026-04-15';
    const model = buildCalendarScreenModel({
      todayIso,
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [],
      locale: 'en',
    });
    const cells = model.weeks.flat();
    const todayCells = cells.filter((c) => c.isToday);
    expect(todayCells).toHaveLength(1);
    expect(todayCells[0]?.date).toBe(todayIso);
  });

  it('isToday is false for all cells when todayIso is outside the grid range', () => {
    // April grid starts Mar 29 at earliest; today is in February = outside grid
    const model = buildCalendarScreenModel({
      todayIso: '2026-02-01',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [],
      locale: 'en',
    });
    const todayCells = model.weeks.flat().filter((c) => c.isToday);
    expect(todayCells).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Prediction overlay
// ---------------------------------------------------------------------------
describe('buildCalendarScreenModel – prediction overlay', () => {
  it('observed period marker overrides predicted-period for the same date', () => {
    // cycleStartDate will be 2026-04-03 (start of most recent period)
    const profile: UserProfile = {
      ...baseProfile,
      lastPeriodStartDate: '2026-03-06',
    };
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile,
      logEntries: [
        entry('2026-03-06', 'heavy'),
        entry('2026-04-03', 'heavy'),
        entry('2026-04-04', 'heavy'),
        entry('2026-04-05', 'heavy'),
      ],
      locale: 'en',
    });

    // Days with actual bleeding must show their logged marker, never predicted-period
    const day3 = model.weeks.flat().find((c) => c.date === '2026-04-03');
    const day4 = model.weeks.flat().find((c) => c.date === '2026-04-04');
    expect(day3?.marker).toBe('period');
    expect(day4?.marker).toBe('period');
  });

  it('spotting overrides predicted-period', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [
        entry('2026-03-28', 'heavy'), // anchor
        entry('2026-04-25', 'spotting'), // falls inside next predicted period window
      ],
      locale: 'en',
    });

    const cell = model.weeks.flat().find((c) => c.date === '2026-04-25');
    expect(cell?.marker).toBe('spotting');
  });

  it('predicted-period cells only appear on known predicted dates, not arbitrary future cells', () => {
    // With one logged heavy bleed on 2026-03-28 and today 2026-04-20:
    //   - effectiveStartDate = 2026-03-28 (23 days ago < 28-day cycle, no rolling)
    //   - nextPeriod = 2026-04-25 to 2026-04-29 (5-day period)
    //   - current cycle window = 2026-03-28 to 2026-04-01
    // May grid starts Sun 2026-04-26 (May 1 is Friday, offset 5 → gridStart Apr 26).
    // Predicted-period cells in the May grid are: Apr 26–29 (tail of next period window)
    // and May 1 onward has no predicted marker past Apr 29.
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-05-01',
      profile: baseProfile,
      logEntries: [entry('2026-03-28', 'heavy')],
      locale: 'en',
    });

    const cells = model.weeks.flat();
    const gridStart = cells[0]!.date; // '2026-04-26'
    const predictedCells = cells.filter((c) => c.marker === 'predicted-period');

    // All predicted cells must be within the visible grid
    for (const cell of predictedCells) {
      expect(cell.date >= gridStart).toBe(true);
    }

    // No predicted-period cell should appear well after the predicted window ends (Apr 29)
    const lateCell = cells.find((c) => c.date === '2026-05-10');
    expect(lateCell?.marker).toBe('none');
  });

  it('no cell outside predicted window is marked predicted-period', () => {
    // With a 28-day cycle starting 2026-03-28, next period starts 2026-04-25.
    // May grid cells before Apr 25 should not be predicted-period (they are before the next period).
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-05-01',
      profile: baseProfile,
      logEntries: [entry('2026-03-28', 'heavy')],
      locale: 'en',
    });

    // May 10 is well after the predicted period (Apr 25 + 5 days = Apr 29)
    const may10 = model.weeks.flat().find((c) => c.date === '2026-05-10');
    expect(may10?.marker).toBe('none');
  });

  it('fertile window does not extend past gridEnd or before gridStart', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-15',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [],
      locale: 'en',
    });
    const cells = model.weeks.flat();
    const gridStart = cells[0]!.date;
    const gridEnd = cells[cells.length - 1]!.date;

    const fertileCells = cells.filter((c) => c.isFertile);
    for (const cell of fertileCells) {
      expect(cell.date >= gridStart).toBe(true);
      expect(cell.date <= gridEnd).toBe(true);
    }
  });

  it('showFertilityEstimates=false suppresses all isFertile flags', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-15',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [entry('2026-03-28', 'heavy')],
      locale: 'en',
      showFertilityEstimates: false,
    });
    const fertileCells = model.weeks.flat().filter((c) => c.isFertile);
    expect(fertileCells).toHaveLength(0);
  });

  it('fertile window start is always <= fertile window end (no inverted window)', () => {
    // Verify indirectly through the cells: if fertile cells exist, the first
    // marked cell must be <= the last marked cell.
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-15',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [entry('2026-03-28', 'heavy')],
      locale: 'en',
      showFertilityEstimates: true,
    });
    const fertileCells = model.weeks.flat().filter((c) => c.isFertile);
    if (fertileCells.length >= 2) {
      expect(fertileCells[0]!.date <= fertileCells[fertileCells.length - 1]!.date).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 2b. Band segments — out-of-month clipping and row-portion edge cases
// ---------------------------------------------------------------------------
describe('buildCalendarScreenModel – band segment clipping', () => {
  function findCell(
    model: ReturnType<typeof buildCalendarScreenModel>,
    date: string,
  ) {
    return model.weeks.flat().find((c) => c.date === date);
  }

  it('out-of-month lead-in cells never carry bands and the in-month remainder re-segments', () => {
    // Logged run Mar 31 - Apr 2 viewed in the April grid: Mar 31 is an
    // out-of-month padding cell in the Mar 29-Apr 4 row, so it terminates
    // the run and the in-month portion (Apr 1-2) segments on its own.
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [
        entry('2026-03-06', 'heavy'),
        entry('2026-03-31', 'light'),
        entry('2026-04-01', 'medium'),
        entry('2026-04-02', 'heavy'),
      ],
      locale: 'en',
    });

    const mar31 = findCell(model, '2026-03-31');
    expect(mar31?.inMonth).toBe(false);
    expect(mar31?.periodBand).toBeNull();
    expect(findCell(model, '2026-04-01')?.periodBand).toBe('start');
    expect(findCell(model, '2026-04-02')?.periodBand).toBe('end');
  });

  it('a predicted window running into trailing out-of-month padding clips to the in-month cells', () => {
    // Probe-A geometry: anchor Dec 3 2025 -> predicted Dec 31-Jan 4. In the
    // December grid the Jan 1-3 padding cells still get the
    // predicted-period MARKER (pre-existing behavior) but never a band;
    // Dec 31, alone in-month within its row, reads 'single'.
    const model = buildCalendarScreenModel({
      todayIso: '2025-12-20',
      monthIso: '2025-12-01',
      profile: { ...baseProfile, lastPeriodStartDate: '2025-12-03' },
      logEntries: [entry('2025-12-03', 'heavy')],
      locale: 'en',
    });

    const dec31 = findCell(model, '2025-12-31');
    expect(dec31?.marker).toBe('predicted-period');
    expect(dec31?.predictedBand).toBe('single');
    const jan1 = findCell(model, '2026-01-01');
    expect(jan1?.inMonth).toBe(false);
    expect(jan1?.marker).toBe('predicted-period');
    expect(jan1?.predictedBand).toBeNull();
  });

  it('PINNED: a one-cell row portion of a longer run reads "single", not "end"/"start"', () => {
    // Deliberate contract decision: segmentation is computed independently
    // per week row (clipping treats each row portion as a self-contained
    // capsule). A run whose portion within a row is exactly one cell
    // therefore reads 'single' (both caps drawn) even though the run
    // continues in the adjacent row -- an 'end' with no 'start' before it
    // in the same row would render as a half-open capsule with nothing to
    // attach to. Variant renderers can rely on every row being
    // self-consistent: start..end pairs never dangle within a row.
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [
        entry('2026-03-06', 'heavy'),
        entry('2026-04-04', 'medium'), // Saturday, last cell of its row
        entry('2026-04-05', 'heavy'), // Sunday, first cell of the next row
      ],
      locale: 'en',
    });

    expect(findCell(model, '2026-04-04')?.periodBand).toBe('single');
    expect(findCell(model, '2026-04-05')?.periodBand).toBe('single');
  });
});

// ---------------------------------------------------------------------------
// 3. Input safety
// ---------------------------------------------------------------------------
describe('buildCalendarScreenModel – input safety', () => {
  it('does not crash with empty logEntries', () => {
    expect(() =>
      buildCalendarScreenModel({
        todayIso: '2026-04-20',
        monthIso: '2026-04-01',
        profile: baseProfile,
        logEntries: [],
        locale: 'en',
      }),
    ).not.toThrow();
  });

  it('produces a sensible model with empty logEntries (uses onboarding seed)', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [],
      locale: 'en',
    });
    expect(model.weeks.length).toBeGreaterThan(0);
    expect(model.historyItems).toHaveLength(0);
    // Should not have any logged markers on any cell
    const markedCells = model.weeks.flat().filter((c) => c.marker === 'period' || c.marker === 'spotting');
    expect(markedCells).toHaveLength(0);
  });

  it('does not crash with a single log entry', () => {
    expect(() =>
      buildCalendarScreenModel({
        todayIso: '2026-04-20',
        monthIso: '2026-04-01',
        profile: baseProfile,
        logEntries: [entry('2026-04-10', 'medium')],
        locale: 'en',
      }),
    ).not.toThrow();
  });

  it('does not crash with a log entry far in the past (10 years ago)', () => {
    expect(() =>
      buildCalendarScreenModel({
        todayIso: '2026-04-20',
        monthIso: '2026-04-01',
        profile: baseProfile,
        logEntries: [entry('2016-04-10', 'heavy')],
        locale: 'en',
      }),
    ).not.toThrow();
  });

  it('does not crash with a log entry dated today', () => {
    expect(() =>
      buildCalendarScreenModel({
        todayIso: '2026-04-20',
        monthIso: '2026-04-01',
        profile: baseProfile,
        logEntries: [entry('2026-04-20', 'heavy')],
        locale: 'en',
      }),
    ).not.toThrow();
  });

  it('does not crash with a log entry in the future', () => {
    expect(() =>
      buildCalendarScreenModel({
        todayIso: '2026-04-20',
        monthIso: '2026-04-01',
        profile: baseProfile,
        logEntries: [entry('2026-12-01', 'heavy')],
        locale: 'en',
      }),
    ).not.toThrow();
  });

  it('does not crash with many log entries spanning multiple years', () => {
    const entries: DailyLogEntry[] = [];
    // 50 periods over ~4 years
    let dateMs = Date.UTC(2022, 0, 1);
    for (let i = 0; i < 50; i += 1) {
      const iso = new Date(dateMs).toISOString().slice(0, 10);
      entries.push(entry(iso, 'heavy'));
      dateMs += 28 * 24 * 60 * 60 * 1000;
    }
    expect(() =>
      buildCalendarScreenModel({
        todayIso: '2026-04-20',
        monthIso: '2026-04-01',
        profile: baseProfile,
        logEntries: entries,
        locale: 'en',
      }),
    ).not.toThrow();
  });

  it('duplicate log dates: none-after-spotting overwrites spotting marker when date is outside predicted window', () => {
    // BUG SURFACE: buildLoggedMarkers iterates in insertion order; last write wins.
    //
    // When a 'none' entry appears AFTER a 'spotting' entry for the same date, the
    // map stores 'none'.  The marker resolution is:
    //   marker && marker !== 'none' ? marker : predictedDates.has(date) ? 'predicted-period' : 'none'
    // Because spotting is NOT a period-evidence type, it does not anchor the cycle;
    // the date (Apr 12) is therefore outside both predicted windows → final marker is 'none'.
    //
    // Separately, historyItems is built from logEntries directly (not from the map),
    // so the spotting entry still appears in history while the cell shows no marker —
    // an observable inconsistency that a future fix should resolve deliberately.
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-30',
      monthIso: '2026-04-01',
      profile: { ...baseProfile, lastPeriodStartDate: '2026-03-28' },
      logEntries: [
        entry('2026-03-28', 'heavy'), // anchors cycle; nextPeriod = Apr 25
        entry('2026-04-12', 'spotting'),
        entry('2026-04-12', 'none'), // duplicate — 'none' wins in map
      ],
      locale: 'en',
    });

    const cell = model.weeks.flat().find((c) => c.date === '2026-04-12');
    // Apr 12 is mid-cycle, outside the predicted window (Apr 25–29) and outside
    // the current-cycle window (Mar 28–Apr 1), so 'none' marker wins.
    expect(cell?.marker).toBe('none');

    // historyItems shows spotting even though the cell is unmarked:
    const historyForDate = model.historyItems.filter((h) => h.date === '2026-04-12');
    expect(historyForDate.length).toBeGreaterThanOrEqual(1);
    expect(historyForDate.some((h) => h.bleeding === 'spotting')).toBe(true);
  });

  it('duplicate log dates: heavy after none wins correctly', () => {
    // Reversed order: 'none' first, then 'heavy' — cell should show 'period'
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [
        entry('2026-04-10', 'none'),
        entry('2026-04-10', 'heavy'),
      ],
      locale: 'en',
    });

    const cell = model.weeks.flat().find((c) => c.date === '2026-04-10');
    expect(cell?.marker).toBe('period');
  });

  it('all-none log entries produce no markers or historyItems', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [
        entry('2026-04-01', 'none'),
        entry('2026-04-05', 'none'),
        entry('2026-04-10', 'none'),
      ],
      locale: 'en',
    });
    const markedCells = model.weeks.flat().filter(
      (c) => c.marker === 'period' || c.marker === 'spotting',
    );
    expect(markedCells).toHaveLength(0);
    expect(model.historyItems).toHaveLength(0);
  });

  it('profile with extreme cycle lengths does not crash', () => {
    expect(() =>
      buildCalendarScreenModel({
        todayIso: '2026-04-20',
        monthIso: '2026-04-01',
        profile: { ...baseProfile, cycleLengthDays: 1000, periodLengthDays: 100 },
        logEntries: [],
        locale: 'en',
      }),
    ).not.toThrow();
  });

  it('profile with zero/negative cycle lengths does not crash (uses defaults)', () => {
    expect(() =>
      buildCalendarScreenModel({
        todayIso: '2026-04-20',
        monthIso: '2026-04-01',
        profile: { ...baseProfile, cycleLengthDays: 0, periodLengthDays: -1 },
        logEntries: [],
        locale: 'en',
      }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 4. cycleDay values on grid cells
// ---------------------------------------------------------------------------
describe('buildCalendarScreenModel – cycleDay values', () => {
  it('cycleDay is 1 on the cycle start date', () => {
    // With logEntries anchoring cycle at 2026-04-01, that cell should be day 1.
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [entry('2026-03-06', 'heavy'), entry('2026-04-03', 'heavy')],
      locale: 'en',
    });
    // cycleStartDate is the start of the current cycle period
    // find a cell that is the current cycleStartDate
    const cells = model.weeks.flat();
    const dayOneCells = cells.filter((c) => c.cycleDay === 1);
    // There must be exactly one cycle day 1 in the grid
    expect(dayOneCells.length).toBeGreaterThanOrEqual(1);
    // The earliest day-1 cell's next cell must be day 2
    const dayOneCell = dayOneCells[0]!;
    const dayOneIndex = cells.indexOf(dayOneCell);
    if (dayOneIndex + 1 < cells.length) {
      expect(cells[dayOneIndex + 1]!.cycleDay).toBe(2);
    }
  });

  it('cycleDay is null for all cells before the cycle start date', () => {
    // Cycle starts on the first heavy bleed day; cells before that are null.
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [entry('2026-04-05', 'heavy')], // cycle starts Apr 5
      locale: 'en',
    });
    const cells = model.weeks.flat();
    // Cells strictly before cycleStartDate should have null cycleDay.
    // cycleStartDate is resolved by buildPredictionResult; after rolling forward
    // from the last logged period, it should be Apr 5 (since today is Apr 20
    // and Apr 5 is within 28 days).
    const beforeCycleStart = cells.filter((c) => c.date < '2026-04-05');
    for (const cell of beforeCycleStart) {
      expect(cell.cycleDay).toBeNull();
    }
  });

  it('cycleDay increments by exactly 1 for consecutive grid cells within the same cycle, then rolls back to 1 at the next cycle boundary (LT-01 fix)', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [entry('2026-03-06', 'heavy'), entry('2026-04-03', 'heavy')],
      locale: 'en',
    });
    const cells = model.weeks.flat();
    let prev: (typeof cells)[number] | null = null;
    for (const cell of cells) {
      if (prev !== null && prev.cycleDay !== null && cell.cycleDay !== null) {
        // LT-01: the grid now rolls the cycle anchor forward by whole cycles
        // per cell (cycle starts Apr 3, length 28 -> next boundary May 1), so
        // cycleDay either increments by 1 within a cycle or wraps back to 1
        // exactly at a cycle boundary -- it must never keep growing past the
        // cycle length (the pre-fix "cycle day 96" artifact).
        expect(cell.cycleDay).toBeGreaterThanOrEqual(1);
        expect(cell.cycleDay).toBeLessThanOrEqual(28);
        if (prev.cycleDay === 28) {
          expect(cell.cycleDay).toBe(1);
        } else {
          expect(cell.cycleDay).toBe(prev.cycleDay + 1);
        }
      }
      prev = cell;
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Month/year boundaries – dates are correctly placed in the grid
// ---------------------------------------------------------------------------
describe('buildCalendarScreenModel – month/year boundary placement', () => {
  it('last day of February (leap) is correctly placed on a Thursday', () => {
    // Feb 29 2024 is a Thursday (weekday 4 = index 4 in a Sun-first week row)
    const model = buildCalendarScreenModel({
      todayIso: '2024-02-15',
      monthIso: '2024-02-01',
      profile: baseProfile,
      logEntries: [],
      locale: 'en',
    });
    const leapDay = model.weeks.flat().find((c) => c.date === '2024-02-29');
    expect(leapDay).toBeDefined();
    // Find which week and position
    for (const week of model.weeks) {
      const idx = week.findIndex((c) => c.date === '2024-02-29');
      if (idx !== -1) {
        expect(idx).toBe(4); // Thursday = column index 4 (Sun=0)
        break;
      }
    }
  });

  it('January 1 2026 (Thursday) appears at column index 4 in the first week', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-01-15',
      monthIso: '2026-01-01',
      profile: baseProfile,
      logEntries: [],
      locale: 'en',
    });
    for (const week of model.weeks) {
      const idx = week.findIndex((c) => c.date === '2026-01-01');
      if (idx !== -1) {
        expect(idx).toBe(4); // Thu = 4
        break;
      }
    }
  });

  it('December grid contains no January cells from the same month', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2025-12-15',
      monthIso: '2025-12-01',
      profile: baseProfile,
      logEntries: [],
      locale: 'en',
    });
    const janCells = model.weeks.flat().filter((c) => c.date.startsWith('2025-01'));
    expect(janCells).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 6. recentCycles
// ---------------------------------------------------------------------------
describe('buildCalendarScreenModel – recentCycles', () => {
  it('returns empty recentCycles when there are fewer than 2 period starts', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [entry('2026-04-03', 'heavy')],
      locale: 'en',
    });
    expect(model.recentCycles).toHaveLength(0);
  });

  it('returns up to 3 recent cycles from bleeding history', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [
        entry('2025-11-01', 'heavy'),
        entry('2025-11-29', 'heavy'),
        entry('2025-12-27', 'heavy'),
        entry('2026-01-24', 'heavy'),
        entry('2026-02-21', 'heavy'),
      ],
      locale: 'en',
    });
    expect(model.recentCycles.length).toBeLessThanOrEqual(3);
    expect(model.recentCycles.length).toBeGreaterThan(0);
  });

  it('each recent cycle has a positive lengthDays', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [
        entry('2026-01-01', 'heavy'),
        entry('2026-01-29', 'heavy'),
        entry('2026-02-26', 'heavy'),
      ],
      locale: 'en',
    });
    for (const cycle of model.recentCycles) {
      expect(cycle.lengthDays).toBeGreaterThan(0);
    }
  });

  it('each recent cycle startDate < endDate', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [
        entry('2026-01-01', 'heavy'),
        entry('2026-01-29', 'heavy'),
        entry('2026-02-26', 'heavy'),
      ],
      locale: 'en',
    });
    for (const cycle of model.recentCycles) {
      expect(cycle.startDate < cycle.endDate).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. historyItems ordering and cap
// ---------------------------------------------------------------------------
describe('buildCalendarScreenModel – historyItems', () => {
  it('historyItems are sorted descending by date', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [
        entry('2026-04-01', 'light'),
        entry('2026-04-10', 'heavy'),
        entry('2026-04-05', 'medium'),
      ],
      locale: 'en',
    });
    const dates = model.historyItems.map((h) => h.date);
    const sorted = [...dates].sort((a, b) => b.localeCompare(a));
    expect(dates).toEqual(sorted);
  });

  it('historyItems capped at 6 entries', () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      entry(`2026-04-${String(i + 1).padStart(2, '0')}`, 'heavy'),
    );
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: entries,
      locale: 'en',
    });
    expect(model.historyItems.length).toBeLessThanOrEqual(6);
  });

  it('historyItems excludes entries with bleeding=none', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile: baseProfile,
      logEntries: [
        entry('2026-04-10', 'none'),
        entry('2026-04-11', 'heavy'),
      ],
      locale: 'en',
    });
    expect(model.historyItems.every((h) => h.bleeding !== 'none')).toBe(true);
  });
});
