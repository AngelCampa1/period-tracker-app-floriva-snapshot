import type { DailyLogEntry, UserProfile } from '@/src/types/domain';

import { buildCalendarScreenModel } from '@/src/features/calendar/buildCalendarScreenModel';

function createLogEntry(
  logDate: string,
  bleeding: DailyLogEntry['bleeding'],
): DailyLogEntry {
  return {
    id: `${logDate}-${bleeding}`,
    logDate,
    bleeding,
    symptoms: [],
  };
}

describe('buildCalendarScreenModel', () => {
  const profile: UserProfile = {
    cycleLengthDays: 28,
    periodLengthDays: 5,
    lastPeriodStartDate: '2026-03-28',
    goals: ['period', 'symptoms'],
    supportsIrregularCycles: false,
    conditionTags: [],
  };

  it('renders logged spotting and period days distinctly while projecting the next period into the month grid', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile,
      logEntries: [
        // First start a full cycle earlier so the early-April bleed reads as a
        // genuine new cycle start, not mid-cycle bleeding within one period.
        createLogEntry('2026-03-06', 'heavy'),
        createLogEntry('2026-04-02', 'spotting'),
        createLogEntry('2026-04-03', 'light'),
        createLogEntry('2026-04-04', 'heavy'),
      ],
      locale: 'en',
    });

    expect(model.monthLabel).toBe('April 2026');
    expect(model.predictionSummary.nextPeriodLabel).toBe('Next period expected May 1 to 5');
    // Two starts is a single observed interval — medium, not a "steady rhythm".
    expect(model.predictionSummary.confidenceLabel).toBe('Medium confidence');
    expect(model.predictionSummary.confidenceBasisLabel).toBe(
      'Based on 2 local cycle starts',
    );
    expect(model.predictionSummary.confidenceReasonCodes).toEqual(['one-observed-interval']);
    expect(model.historyItems.slice(0, 3)).toEqual([
      { date: '2026-04-04', label: 'Period day', bleeding: 'heavy' },
      { date: '2026-04-03', label: 'Period day', bleeding: 'light' },
      { date: '2026-04-02', label: 'Spotting', bleeding: 'spotting' },
    ]);

    const day2 = model.weeks.flat().find((cell) => cell.date === '2026-04-02');
    const day3 = model.weeks.flat().find((cell) => cell.date === '2026-04-03');
    const day25 = model.weeks.flat().find((cell) => cell.date === '2026-05-01');

    expect(day2?.marker).toBe('spotting');
    expect(day3?.marker).toBe('period');
    expect(day25?.marker).toBe('predicted-period');
  });

  it('describes the prediction as current while today is inside the expected period window', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-05-01',
      monthIso: '2026-05-01',
      profile,
      logEntries: [
        createLogEntry('2026-03-06', 'heavy'),
        createLogEntry('2026-04-03', 'light'),
      ],
      locale: 'en',
    });

    expect(model.predictionSummary.nextPeriodLabel).toBe(
      'Current expected period May 1 to 5',
    );
  });

  it('widens calendar limitations when irregular-cycle support is enabled', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile: {
        ...profile,
        supportsIrregularCycles: true,
      },
      logEntries: [
        createLogEntry('2026-01-01', 'medium'),
        createLogEntry('2026-01-29', 'medium'),
        createLogEntry('2026-03-01', 'medium'),
        createLogEntry('2026-03-31', 'medium'),
      ],
      locale: 'en',
    });

    expect(model.predictionSummary.confidenceLabel).toBe('Medium confidence');
    expect(model.predictionSummary.limitations).toContain(
      'Irregular-cycle support keeps predictions broader when your timing varies.',
    );
  });

  it('keeps non-bleeding days unmarked and out of recent history', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile,
      logEntries: [createLogEntry('2026-04-10', 'none')],
      locale: 'en',
    });

    const day10 = model.weeks.flat().find((cell) => cell.date === '2026-04-10');

    expect(day10?.marker).toBe('none');
    expect(model.historyItems).toEqual([]);
  });

  it('localizes the month grid and history labels for Spanish', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile,
      logEntries: [createLogEntry('2026-04-10', 'spotting')],
      locale: 'es',
    });

    expect(model.historyItems[0]).toEqual({
      date: '2026-04-10',
      label: 'Manchado',
      bleeding: 'spotting',
    });
    expect(model.predictionSummary.limitations).toContain(
      'Floriva muestra estimaciones, no certeza médica.',
    );
  });

  it.each([
    ['es', 'Manchado', 'Día de periodo'],
    ['de', 'Schmierblutung', 'Periodentag'],
    ['fr', 'Saignotement', 'Jour de règles'],
    ['ja', 'スポッティング', '生理の日'],
    ['zh-Hans', '点滴出血', '月经日'],
    ['pt', 'Escape', 'Dia de período'],
    ['ru', 'Мажущие выделения', 'День месячных'],
  ] as const)(
    'localizes spotting and period history labels for %s',
    (locale, spottingLabel, periodLabel) => {
      const model = buildCalendarScreenModel({
        todayIso: '2026-04-20',
        monthIso: '2026-04-01',
        profile,
        logEntries: [
          createLogEntry('2026-04-10', 'spotting'),
          createLogEntry('2026-04-09', 'medium'),
        ],
        locale,
      });

      expect(model.historyItems).toEqual([
        {
          date: '2026-04-10',
          label: spottingLabel,
          bleeding: 'spotting',
        },
        {
          date: '2026-04-09',
          label: periodLabel,
          bleeding: 'medium',
        },
      ]);
    },
  );

  it('exposes confidence improvements derived from the same reasons as the Today snapshot', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile,
      logEntries: [
        createLogEntry('2026-03-06', 'heavy'),
        createLogEntry('2026-04-04', 'heavy'),
      ],
      locale: 'en',
    });

    expect(model.improvements).toEqual([
      {
        code: 'one-observed-interval',
        action: { href: '/calendar/day/2026-04-20' },
      },
    ]);
  });

  describe('band segments (periodBand / predictedBand / fertileBand)', () => {
    function findCell(
      model: ReturnType<typeof buildCalendarScreenModel>,
      date: string,
    ) {
      return model.weeks.flat().find((cell) => cell.date === date);
    }

    it('segments a multi-day logged period run start/mid/end within a single week row', () => {
      // April 2026 rows are Sun-first: Apr 5-11 is one full row. Logging
      // Apr 6-8 keeps the whole run inside that row.
      const model = buildCalendarScreenModel({
        todayIso: '2026-04-20',
        monthIso: '2026-04-01',
        profile,
        logEntries: [
          createLogEntry('2026-03-06', 'heavy'),
          createLogEntry('2026-04-06', 'light'),
          createLogEntry('2026-04-07', 'medium'),
          createLogEntry('2026-04-08', 'heavy'),
        ],
        locale: 'en',
      });

      expect(findCell(model, '2026-04-06')?.periodBand).toBe('start');
      expect(findCell(model, '2026-04-07')?.periodBand).toBe('mid');
      expect(findCell(model, '2026-04-08')?.periodBand).toBe('end');
      // Neighbors outside the run carry no period band.
      expect(findCell(model, '2026-04-05')?.periodBand).toBeNull();
      expect(findCell(model, '2026-04-09')?.periodBand).toBeNull();
      // A logged period day is never simultaneously a predicted band cell.
      expect(findCell(model, '2026-04-06')?.predictedBand).toBeNull();
      expect(findCell(model, '2026-04-07')?.predictedBand).toBeNull();
      expect(findCell(model, '2026-04-08')?.predictedBand).toBeNull();
    });

    it('marks an isolated logged period day as a single-cell band', () => {
      const model = buildCalendarScreenModel({
        todayIso: '2026-04-20',
        monthIso: '2026-04-01',
        profile,
        logEntries: [
          createLogEntry('2026-03-06', 'heavy'),
          createLogEntry('2026-04-06', 'medium'),
        ],
        locale: 'en',
      });

      expect(findCell(model, '2026-04-06')?.periodBand).toBe('single');
    });

    it('clips a run crossing the week boundary: Saturday reads end, Sunday reads start', () => {
      // Apr 3 (Fri) - Apr 7 (Tue) 2026 straddles the Apr 4 (Sat) / Apr 5
      // (Sun) row boundary.
      const model = buildCalendarScreenModel({
        todayIso: '2026-04-20',
        monthIso: '2026-04-01',
        profile,
        logEntries: [
          createLogEntry('2026-03-06', 'heavy'),
          createLogEntry('2026-04-03', 'light'),
          createLogEntry('2026-04-04', 'medium'),
          createLogEntry('2026-04-05', 'heavy'),
          createLogEntry('2026-04-06', 'heavy'),
          createLogEntry('2026-04-07', 'medium'),
        ],
        locale: 'en',
      });

      expect(findCell(model, '2026-04-03')?.periodBand).toBe('start');
      expect(findCell(model, '2026-04-04')?.periodBand).toBe('end');
      expect(findCell(model, '2026-04-05')?.periodBand).toBe('start');
      expect(findCell(model, '2026-04-06')?.periodBand).toBe('mid');
      expect(findCell(model, '2026-04-07')?.periodBand).toBe('end');
    });

    it('splits the predicted band around a logged day inside the predicted stretch', () => {
      // Single anchor Jul 3 + profile cycle 24 puts the next predicted
      // window at Jul 27-31, entirely inside the Jul 26-Aug 1 row. Logged
      // spotting on Jul 29 must split the predicted band in two.
      const model = buildCalendarScreenModel({
        todayIso: '2026-07-22',
        monthIso: '2026-07-01',
        profile: {
          ...profile,
          cycleLengthDays: 24,
          lastPeriodStartDate: '2026-07-03',
        },
        logEntries: [
          createLogEntry('2026-07-03', 'heavy'),
          createLogEntry('2026-07-29', 'spotting'),
        ],
        locale: 'en',
      });

      expect(findCell(model, '2026-07-27')?.predictedBand).toBe('start');
      expect(findCell(model, '2026-07-28')?.predictedBand).toBe('end');
      expect(findCell(model, '2026-07-29')?.marker).toBe('spotting');
      expect(findCell(model, '2026-07-29')?.predictedBand).toBeNull();
      expect(findCell(model, '2026-07-29')?.periodBand).toBeNull();
      expect(findCell(model, '2026-07-30')?.predictedBand).toBe('start');
      expect(findCell(model, '2026-07-31')?.predictedBand).toBe('end');
    });

    it('splits the predicted band around an explicit "none" log the same way', () => {
      const model = buildCalendarScreenModel({
        todayIso: '2026-07-22',
        monthIso: '2026-07-01',
        profile: {
          ...profile,
          cycleLengthDays: 24,
          lastPeriodStartDate: '2026-07-03',
        },
        logEntries: [
          createLogEntry('2026-07-03', 'heavy'),
          createLogEntry('2026-07-29', 'none'),
        ],
        locale: 'en',
      });

      expect(findCell(model, '2026-07-28')?.predictedBand).toBe('end');
      expect(findCell(model, '2026-07-29')?.marker).toBe('none');
      expect(findCell(model, '2026-07-29')?.predictedBand).toBeNull();
      expect(findCell(model, '2026-07-30')?.predictedBand).toBe('start');
    });

    it('keeps the fertile band orthogonal to an overlapping predicted band on the same days', () => {
      // Three starts 21 days apart with the last on Jun 19 roll the anchor
      // once to Jul 10 (not stale: 1 roll, 12 days past expectation). The
      // synthetic current-cycle window paints predicted Jul 10-14 while the
      // fertile window (nextStart Jul 31 - 19/14) covers Jul 12-17 -- the
      // two bands overlap on Jul 12-14 and must each keep their own
      // segmentation.
      const model = buildCalendarScreenModel({
        todayIso: '2026-07-22',
        monthIso: '2026-07-01',
        profile: { ...profile, cycleLengthDays: 21, lastPeriodStartDate: '2026-06-19' },
        logEntries: [
          createLogEntry('2026-05-08', 'heavy'),
          createLogEntry('2026-05-29', 'heavy'),
          createLogEntry('2026-06-19', 'heavy'),
        ],
        locale: 'en',
      });

      expect(model.predictionSummary.confidenceReasonCodes).not.toContain('stale-history');

      // Predicted window Jul 10-14 clipped at the Jul 11/12 row boundary.
      expect(findCell(model, '2026-07-10')?.predictedBand).toBe('start');
      expect(findCell(model, '2026-07-11')?.predictedBand).toBe('end');
      expect(findCell(model, '2026-07-12')?.predictedBand).toBe('start');
      expect(findCell(model, '2026-07-13')?.predictedBand).toBe('mid');
      expect(findCell(model, '2026-07-14')?.predictedBand).toBe('end');
      // Fertile band Jul 12-17 runs independently across the same cells.
      expect(findCell(model, '2026-07-12')?.fertileBand).toBe('start');
      expect(findCell(model, '2026-07-13')?.fertileBand).toBe('mid');
      expect(findCell(model, '2026-07-14')?.fertileBand).toBe('mid');
      expect(findCell(model, '2026-07-15')?.fertileBand).toBe('mid');
      expect(findCell(model, '2026-07-15')?.predictedBand).toBeNull();
      expect(findCell(model, '2026-07-17')?.fertileBand).toBe('end');
    });

    it('keeps the fertile band orthogonal to an overlapping logged period run', () => {
      // 21-day rhythm ending in a logged Jul 3-7 run: fertile window is
      // Jul 5-10 (next start Jul 24), overlapping the logged run tail.
      const model = buildCalendarScreenModel({
        todayIso: '2026-07-22',
        monthIso: '2026-07-01',
        profile: { ...profile, cycleLengthDays: 21, lastPeriodStartDate: '2026-07-03' },
        logEntries: [
          createLogEntry('2026-05-22', 'heavy'),
          createLogEntry('2026-06-12', 'heavy'),
          createLogEntry('2026-07-03', 'light'),
          createLogEntry('2026-07-04', 'medium'),
          createLogEntry('2026-07-05', 'heavy'),
          createLogEntry('2026-07-06', 'medium'),
          createLogEntry('2026-07-07', 'light'),
        ],
        locale: 'en',
      });

      expect(findCell(model, '2026-07-05')?.periodBand).toBe('start');
      expect(findCell(model, '2026-07-05')?.fertileBand).toBe('start');
      expect(findCell(model, '2026-07-07')?.periodBand).toBe('end');
      expect(findCell(model, '2026-07-07')?.fertileBand).toBe('mid');
      expect(findCell(model, '2026-07-10')?.fertileBand).toBe('end');
    });

    it('suppresses predicted and fertile bands entirely under stale-history', () => {
      // Last start Apr 17 with a 21-day rhythm is >2 rolled cycles before
      // Jul 22 -> stale-history fires and LT-09/LT-31 zero predictedDates
      // and isFertile, so the bands come out null everywhere.
      const model = buildCalendarScreenModel({
        todayIso: '2026-07-22',
        monthIso: '2026-07-01',
        profile: { ...profile, cycleLengthDays: 21, lastPeriodStartDate: '2026-04-17' },
        logEntries: [
          createLogEntry('2026-03-06', 'heavy'),
          createLogEntry('2026-03-27', 'heavy'),
          createLogEntry('2026-04-17', 'heavy'),
        ],
        locale: 'en',
      });

      expect(model.predictionSummary.confidenceReasonCodes).toContain('stale-history');
      for (const cell of model.weeks.flat()) {
        expect(cell.predictedBand).toBeNull();
        expect(cell.fertileBand).toBeNull();
      }
    });

    it('never bands spotting runs', () => {
      const model = buildCalendarScreenModel({
        todayIso: '2026-04-20',
        monthIso: '2026-04-01',
        profile,
        logEntries: [
          createLogEntry('2026-03-06', 'heavy'),
          createLogEntry('2026-04-06', 'spotting'),
          createLogEntry('2026-04-07', 'spotting'),
          createLogEntry('2026-04-08', 'spotting'),
        ],
        locale: 'en',
      });

      for (const date of ['2026-04-06', '2026-04-07', '2026-04-08']) {
        const cell = findCell(model, date);
        expect(cell?.marker).toBe('spotting');
        expect(cell?.periodBand).toBeNull();
        expect(cell?.predictedBand).toBeNull();
      }
    });

    it('keeps the logged period band when history is stale', () => {
      // Same stale dataset as above, but viewing April where the last real
      // logged run (Apr 17-19) lives: the logged periodBand must survive
      // while predicted/fertile bands stay suppressed. Apr 17 (Fri) - 19
      // (Sun) also straddles a row boundary, so the run clips to
      // start/end + single.
      const model = buildCalendarScreenModel({
        todayIso: '2026-07-22',
        monthIso: '2026-04-01',
        profile: { ...profile, cycleLengthDays: 21, lastPeriodStartDate: '2026-04-17' },
        logEntries: [
          createLogEntry('2026-03-06', 'heavy'),
          createLogEntry('2026-03-27', 'heavy'),
          createLogEntry('2026-04-17', 'heavy'),
          createLogEntry('2026-04-18', 'heavy'),
          createLogEntry('2026-04-19', 'heavy'),
        ],
        locale: 'en',
      });

      expect(model.predictionSummary.confidenceReasonCodes).toContain('stale-history');
      expect(findCell(model, '2026-04-17')?.periodBand).toBe('start');
      expect(findCell(model, '2026-04-18')?.periodBand).toBe('end');
      expect(findCell(model, '2026-04-19')?.periodBand).toBe('single');
      for (const cell of model.weeks.flat()) {
        expect(cell.predictedBand).toBeNull();
        expect(cell.fertileBand).toBeNull();
      }
    });
  });

  it('omits improvements entirely when confidence reasons have nothing actionable', () => {
    const model = buildCalendarScreenModel({
      todayIso: '2026-04-20',
      monthIso: '2026-04-01',
      profile: {
        ...profile,
        lastPeriodStartDate: '2026-01-01',
        supportsIrregularCycles: false,
      },
      logEntries: [
        createLogEntry('2026-01-01', 'heavy'),
        createLogEntry('2026-01-29', 'heavy'),
        createLogEntry('2026-02-26', 'heavy'),
        createLogEntry('2026-03-26', 'heavy'),
      ],
      locale: 'en',
    });

    expect(model.predictionSummary.confidenceLevel).toBe('high');
    expect(model.improvements).toBeUndefined();
  });
});
