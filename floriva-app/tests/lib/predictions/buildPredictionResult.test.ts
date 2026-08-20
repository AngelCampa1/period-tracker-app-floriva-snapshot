import type { DailyLogEntry, UserProfile } from '@/src/types/domain';

import { buildPredictionResult } from '@/src/lib/predictions/buildPredictionResult';

function createLogEntry(
  logDate: string,
  bleeding: DailyLogEntry['bleeding'],
  overrides: Partial<DailyLogEntry> = {},
): DailyLogEntry {
  return {
    id: `${logDate}-${bleeding}`,
    logDate,
    bleeding,
    symptoms: [],
    ...overrides,
  };
}

describe('buildPredictionResult', () => {
  const regularProfile: UserProfile = {
    cycleLengthDays: 28,
    periodLengthDays: 5,
    lastPeriodStartDate: '2026-03-28',
    goals: ['period', 'symptoms'],
    supportsIrregularCycles: false,
    conditionTags: [],
  };

  it('predicts the next cycle from regular bleeding history', () => {
    const result = buildPredictionResult({
      todayIso: '2026-04-20',
      profile: regularProfile,
      logEntries: [
        createLogEntry('2026-02-28', 'medium'),
        createLogEntry('2026-03-01', 'light'),
        createLogEntry('2026-03-28', 'heavy'),
        createLogEntry('2026-03-29', 'medium'),
      ],
    });

    expect(result.cycleLengthDays).toBe(28);
    expect(result.history.startDates).toEqual(['2026-02-28', '2026-03-28']);
    expect(result.current.cycleDay).toBe(24);
    expect(result.nextPeriod.startDate).toBe('2026-04-25');
    expect(result.nextPeriod.lengthDays).toBe(5);
    expect(result.fertileWindow.startDate).toBe('2026-04-06');
    expect(result.fertileWindow.endDate).toBe('2026-04-11');
    // Two starts = a single observed interval, which is not enough to claim a
    // "steady rhythm" — that requires >=2 intervals (>=3 starts).
    expect(result.confidence.level).toBe('medium');
    expect(result.limitationCodes).toEqual(['on-device', 'not-medical-certainty']);
  });

  it('falls back to onboarding seed data when bleeding history is empty', () => {
    const result = buildPredictionResult({
      todayIso: '2026-04-20',
      profile: {
        ...regularProfile,
        cycleLengthDays: 31,
        periodLengthDays: 4,
        lastPeriodStartDate: '2026-04-01',
      },
      logEntries: [],
    });

    expect(result.cycleLengthDays).toBe(31);
    expect(result.history.source).toBe('onboarding-seed');
    expect(result.history.startDates).toEqual(['2026-04-01']);
    expect(result.current.cycleDay).toBe(20);
    expect(result.nextPeriod.startDate).toBe('2026-05-02');
    expect(result.nextPeriod.lengthDays).toBe(4);
    expect(result.confidence.level).toBe('medium');
    expect(result.limitationCodes).toContain('onboarding-seed-active');
  });

  it('does not let spotting start a new cycle when stronger bleeding arrives later', () => {
    const result = buildPredictionResult({
      todayIso: '2026-04-10',
      profile: regularProfile,
      logEntries: [
        createLogEntry('2026-03-01', 'medium'),
        createLogEntry('2026-03-29', 'spotting'),
        createLogEntry('2026-03-30', 'light'),
        createLogEntry('2026-03-31', 'medium'),
      ],
    });

    expect(result.cycleLengthDays).toBe(28);
    expect(result.history.startDates).toEqual(['2026-03-01', '2026-03-30']);
    expect(result.current.activeBleeding.logDate).toBe('2026-03-30');
    expect(result.current.activeBleeding.bleeding).toBe('light');
    expect(result.nextPeriod.startDate).toBe('2026-04-27');
  });

  it('widens limitations and degrades confidence when history is sparse', () => {
    const result = buildPredictionResult({
      todayIso: '2026-04-20',
      profile: regularProfile,
      logEntries: [createLogEntry('2026-04-02', 'medium')],
    });

    expect(result.cycleLengthDays).toBe(28);
    expect(result.history.source).toBe('bleeding-history');
    expect(result.history.startDates).toEqual(['2026-04-02']);
    expect(result.confidence.level).toBe('low');
    expect(result.limitationCodes).toContain('limited-history-shift');
  });

  it('widens limitations and degrades confidence for irregular-cycle support even with history', () => {
    const result = buildPredictionResult({
      todayIso: '2026-04-20',
      profile: {
        ...regularProfile,
        supportsIrregularCycles: true,
      },
      logEntries: [
        createLogEntry('2026-01-01', 'medium'),
        createLogEntry('2026-01-29', 'medium'),
        createLogEntry('2026-03-01', 'medium'),
        createLogEntry('2026-03-31', 'medium'),
      ],
    });

    expect(result.cycleLengthDays).toBe(30);
    expect(result.history.startDates).toEqual([
      '2026-01-01',
      '2026-01-29',
      '2026-03-01',
      '2026-03-31',
    ]);
    expect(result.confidence.level).toBe('medium');
    expect(result.limitationCodes).toContain('irregular-cycle-broader');
  });

  it('does not re-anchor the cycle when a single mid-cycle bleed is logged', () => {
    // Onboarding anchor is 2026-06-01 (29-day cycle). A medium bleed logged on
    // 2026-06-11 (cycle day 11) is mid-cycle spotting, NOT a new period start.
    const result = buildPredictionResult({
      todayIso: '2026-06-12',
      profile: {
        ...regularProfile,
        cycleLengthDays: 29,
        lastPeriodStartDate: '2026-06-01',
      },
      logEntries: [
        createLogEntry('2026-06-01', 'medium'),
        createLogEntry('2026-06-11', 'medium'),
      ],
    });

    // Only one cycle start — the cycle must not be re-anchored to Jun 11.
    expect(result.history.startDates).toEqual(['2026-06-01']);
    expect(result.current.cycleStartDate).toBe('2026-06-01');
    expect(result.current.cycleDay).toBe(12);
    expect(result.nextPeriod.startDate).toBe('2026-06-30');
    // One real start => low confidence, never a regression-inducing re-anchor.
    expect(result.confidence.level).toBe('low');
  });

  it('rolls the cycle forward instead of reporting a cycle day past the cycle length', () => {
    // A single imported start from ~2 months ago with no later logs. The current
    // cycle day must stay within [1, cycleLength] and the next period must be a
    // FUTURE projection, never "cycle day 61 of 29" with a past next-period date.
    const result = buildPredictionResult({
      todayIso: '2026-06-01',
      profile: {
        ...regularProfile,
        cycleLengthDays: 29,
        lastPeriodStartDate: '2026-04-02',
      },
      logEntries: [createLogEntry('2026-04-02', 'medium')],
    });

    // 2026-04-02 + 29 = 05-01, + 29 = 05-30 (<= today < 06-28).
    expect(result.current.cycleStartDate).toBe('2026-05-30');
    expect(result.current.cycleDay).toBe(3);
    expect(result.current.cycleDay).toBeLessThanOrEqual(result.cycleLengthDays);
    expect(result.nextPeriod.startDate).toBe('2026-06-28');
    expect(result.nextPeriod.startDate > '2026-06-01').toBe(true);
    // History still reflects the one real logged start.
    expect(result.history.startDates).toEqual(['2026-04-02']);
    expect(result.limitationCodes).toContain('projected-forward');
  });

  it('requires at least three starts (two intervals) before reporting high confidence', () => {
    const threeStarts = buildPredictionResult({
      todayIso: '2026-04-05',
      profile: regularProfile,
      logEntries: [
        createLogEntry('2026-02-01', 'medium'),
        createLogEntry('2026-03-01', 'medium'),
        createLogEntry('2026-03-29', 'medium'),
      ],
    });

    expect(threeStarts.history.startDates).toEqual([
      '2026-02-01',
      '2026-03-01',
      '2026-03-29',
    ]);
    expect(threeStarts.confidence.level).toBe('high');
  });

  it('uses conservative defaults when onboarding seed lengths are missing', () => {
    const result = buildPredictionResult({
      todayIso: '2026-04-20',
      profile: {
        goals: ['period'],
        supportsIrregularCycles: false,
        conditionTags: [],
      },
      logEntries: [],
    });

    expect(result.cycleLengthDays).toBe(29);
    expect(result.history.source).toBe('onboarding-seed');
    expect(result.current.cycleDay).toBe(1);
    expect(result.nextPeriod.startDate).toBe('2026-05-19');
    expect(result.nextPeriod.lengthDays).toBe(5);
  });
});

// LT-04: direct boundary pins for the `isHistoryStale` trigger computed
// inline in buildPredictionResult.ts:
//   stale = (daysSinceCalendarExpectation > 30) OR (rolledCycles >= 2)
// where daysSinceCalendarExpectation = today - (lastRealStart + typical).
// Each branch is pinned exactly at its boundary (30 vs 31 days; 1 vs 2
// rolls), plus the ordinary one-day-late case that must NOT degrade.
describe('buildPredictionResult -- LT-04 staleness trigger boundaries', () => {
  const baseProfile: UserProfile = {
    goals: ['period'],
    supportsIrregularCycles: false,
    conditionTags: [],
  };

  // 35-day rhythm: 3 starts, intervals [35, 35] -> estimate 35, spread 0.
  // A 35-day typical length keeps rolledCycles pinned at 1 across the
  // 30/31-day overdue boundary (one roll leaves a 30-31 day remainder,
  // which is < 35, so no second roll) -- isolating the overdue branch.
  // Calendar expectation: 2026-03-12 + 35 = 2026-04-16.
  const THIRTY_FIVE_DAY_STARTS = [
    createLogEntry('2026-01-01', 'heavy'),
    createLogEntry('2026-02-05', 'heavy'),
    createLogEntry('2026-03-12', 'heavy'),
  ];

  it('exactly 30 days past the calendar expectation is NOT stale (strict greater-than)', () => {
    const result = buildPredictionResult({
      todayIso: '2026-05-16', // expectation 2026-04-16 + 30; rolledCycles = 1
      profile: baseProfile,
      logEntries: THIRTY_FIVE_DAY_STARTS,
    });

    expect(result.confidence.level).toBe('high');
    expect(result.confidence.reasonCodes).toContain('consistent-recent-bleeding-history');
    expect(result.confidence.reasonCodes).not.toContain('stale-history');
  });

  it('31 days past the calendar expectation IS stale (overdue branch alone; rolledCycles still 1)', () => {
    const result = buildPredictionResult({
      todayIso: '2026-05-17', // expectation 2026-04-16 + 31; rolledCycles = 1
      profile: baseProfile,
      logEntries: THIRTY_FIVE_DAY_STARTS,
    });

    expect(result.confidence.level).toBe('medium');
    expect(result.confidence.reasonCodes).toContain('stale-history');
    expect(result.confidence.reasonCodes).not.toContain('consistent-recent-bleeding-history');
    expect(result.confidence.improvementCodes).toContain('stale-history');
  });

  // 28-day rhythm: 3 starts, intervals [28, 28] -> estimate 28, spread 0.
  // Calendar expectation: 2026-02-26 + 28 = 2026-03-26. The adjacent-day
  // pair below flips rolledCycles from 1 to 2 while the overdue count stays
  // <= 30 (27 -> 28 days), isolating the rolled-cycles branch.
  const TWENTY_EIGHT_DAY_STARTS = [
    createLogEntry('2026-01-01', 'heavy'),
    createLogEntry('2026-01-29', 'heavy'),
    createLogEntry('2026-02-26', 'heavy'),
  ];

  it('rolledCycles = 1 is NOT stale when the overdue count is within 30 days', () => {
    const result = buildPredictionResult({
      todayIso: '2026-04-22', // 55 days after the last start: one roll, 27 days overdue
      profile: baseProfile,
      logEntries: TWENTY_EIGHT_DAY_STARTS,
    });

    expect(result.confidence.level).toBe('high');
    expect(result.confidence.reasonCodes).toContain('consistent-recent-bleeding-history');
    expect(result.confidence.reasonCodes).not.toContain('stale-history');
    expect(result.limitationCodes).toContain('projected-forward'); // one roll DID happen
  });

  it('rolledCycles = 2 IS stale (rolled branch alone; overdue count still <= 30)', () => {
    const result = buildPredictionResult({
      todayIso: '2026-04-23', // 56 days after the last start: two whole 28-day rolls, 28 days overdue
      profile: baseProfile,
      logEntries: TWENTY_EIGHT_DAY_STARTS,
    });

    expect(result.confidence.level).toBe('medium');
    expect(result.confidence.reasonCodes).toContain('stale-history');
    expect(result.confidence.reasonCodes).not.toContain('consistent-recent-bleeding-history');
  });

  it('an ordinary one-day-late user is NOT degraded', () => {
    const result = buildPredictionResult({
      todayIso: '2026-03-27', // 1 day past the 2026-03-26 expectation
      profile: baseProfile,
      logEntries: TWENTY_EIGHT_DAY_STARTS,
    });

    expect(result.confidence.level).toBe('high');
    expect(result.confidence.reasonCodes).toContain('consistent-recent-bleeding-history');
    expect(result.confidence.reasonCodes).not.toContain('stale-history');
    expect(result.confidence.improvementCodes ?? []).not.toContain('stale-history');
  });
});
