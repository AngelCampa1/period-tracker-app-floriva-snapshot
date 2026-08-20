/**
 * Golden characterization tests for the prediction engine.
 *
 * Purpose: pin the CURRENT, observed behavior of `buildPredictionResult` for a
 * representative spread of histories BEFORE any internal refactor. Slice A1
 * extracts `collectPeriodStarts`/cycle-history logic and confidence
 * computation into their own modules with ZERO behavior change — these
 * goldens are the proof. Every field of `PredictionResult` is snapshotted (via
 * a plain deep-equality object, not `toMatchSnapshot`, so the expected values
 * are visible and reviewable in this file rather than hidden in a `.snap`
 * file) so any drift in cycle length, dates, confidence, or limitations is
 * caught immediately.
 *
 * Do NOT "fix" a golden to make it pass after the refactor — if a golden
 * fails post-extraction, the extraction introduced a behavior change and must
 * be corrected instead.
 */

import type { DailyLogEntry, PredictionResult, UserProfile } from '@/src/types/domain';

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

const BASE_PROFILE: UserProfile = {
  goals: ['period'],
  supportsIrregularCycles: false,
  conditionTags: [],
};

type GoldenCase = {
  name: string;
  todayIso: string;
  profile: UserProfile;
  logEntries: DailyLogEntry[];
  expected: PredictionResult;
};

const cases: GoldenCase[] = [
  {
    // 1. Empty / no data at all: no log entries, no profile cycle info.
    // Falls back fully to onboarding-seed defaults anchored on todayIso.
    name: 'empty history, no profile data',
    todayIso: '2026-04-20',
    profile: BASE_PROFILE,
    logEntries: [],
    expected: {
      cycleLengthDays: 29,
      history: {
        source: 'onboarding-seed',
        startDates: ['2026-04-20'],
      },
      current: {
        cycleDay: 1,
        cycleStartDate: '2026-04-20',
        activeBleeding: {
          logDate: '2026-04-20',
          bleeding: 'light',
        },
      },
      nextPeriod: {
        startDate: '2026-05-19',
        lengthDays: 5,
      },
      fertileWindow: {
        startDate: '2026-04-30',
        endDate: '2026-05-05',
      },
      confidence: {
        level: 'medium',
        reasonCodes: ['onboarding-seed'],
        improvementCodes: ['onboarding-seed'],
      },
      limitationCodes: ['on-device', 'not-medical-certainty', 'onboarding-seed-active'],
    },
  },
  {
    // 2. Single period logged: exactly one bleeding-evidence start.
    name: 'single period start (low confidence)',
    todayIso: '2026-04-20',
    profile: {
      ...BASE_PROFILE,
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-04-01',
    },
    logEntries: [createLogEntry('2026-04-01', 'medium')],
    expected: {
      cycleLengthDays: 28,
      history: {
        source: 'bleeding-history',
        startDates: ['2026-04-01'],
      },
      current: {
        cycleDay: 20,
        cycleStartDate: '2026-04-01',
        activeBleeding: {
          logDate: '2026-04-01',
          bleeding: 'medium',
        },
      },
      nextPeriod: {
        startDate: '2026-04-29',
        lengthDays: 5,
      },
      fertileWindow: {
        startDate: '2026-04-10',
        endDate: '2026-04-15',
      },
      confidence: {
        level: 'low',
        reasonCodes: ['limited-bleeding-history'],
        improvementCodes: ['limited-bleeding-history'],
      },
      limitationCodes: ['on-device', 'not-medical-certainty', 'limited-history-shift'],
    },
  },
  {
    // 3. Regular cycles: several stable ~28-day intervals -> high confidence.
    name: 'regular stable cycles (high confidence)',
    todayIso: '2026-04-05',
    profile: {
      ...BASE_PROFILE,
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-29',
    },
    logEntries: [
      createLogEntry('2026-02-01', 'medium'),
      createLogEntry('2026-03-01', 'medium'),
      createLogEntry('2026-03-29', 'medium'),
    ],
    expected: {
      cycleLengthDays: 28,
      history: {
        source: 'bleeding-history',
        startDates: ['2026-02-01', '2026-03-01', '2026-03-29'],
      },
      current: {
        cycleDay: 8,
        cycleStartDate: '2026-03-29',
        activeBleeding: {
          logDate: '2026-03-29',
          bleeding: 'medium',
        },
      },
      // New in A2: >=3 starts now runs robust cycle statistics
      // (src/lib/predictions/cycleStatistics.ts). Intervals here are Feb 1 ->
      // Mar 1 = 28 days and Mar 1 -> Mar 29 = 28 days -- perfectly regular, so
      // both survive the [15,90] bounds filter and MAD outlier rejection
      // untouched (MAD = 0, both intervals equal the median), the recency-
      // weighted median of [28, 28] is still 28 (identical values -> spread is
      // 0), and cycleLengthDays is unchanged from the old mean-based result
      // (28). Because sampleSize > 0, the engine now also attaches
      // `statistics` and next-period earliest/latest bounds; with spreadDays
      // 0 the earliest/latest bounds collapse to the point estimate itself.
      nextPeriod: {
        startDate: '2026-04-26',
        lengthDays: 5,
        earliestStartDate: '2026-04-26',
        latestStartDate: '2026-04-26',
      },
      fertileWindow: {
        startDate: '2026-04-07',
        endDate: '2026-04-12',
      },
      confidence: {
        level: 'high',
        reasonCodes: ['consistent-recent-bleeding-history'],
      },
      limitationCodes: ['on-device', 'not-medical-certainty'],
      statistics: {
        spreadDays: 0,
        sampleSize: 2,
        discardedCount: 0,
      },
    },
  },
  {
    // 4. Irregular cycles: high variance intervals (7, 60, 14 days) plus the
    // profile's irregular-cycle support flag enabled.
    name: 'irregular cycles, high variance, supportsIrregularCycles enabled',
    todayIso: '2026-04-20',
    profile: {
      ...BASE_PROFILE,
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-23',
      supportsIrregularCycles: true,
    },
    logEntries: [
      createLogEntry('2026-01-01', 'medium'),
      createLogEntry('2026-01-08', 'medium'),
      createLogEntry('2026-03-09', 'medium'),
      createLogEntry('2026-03-23', 'medium'),
    ],
    expected: {
      // Note: Jan 1 -> Jan 8 is only a 7-day gap, below MIN_CYCLE_SEPARATION_DAYS
      // (15), so Jan 8 is NOT counted as a distinct period start — it collapses
      // into the Jan 1 start. Only 2 real starts remain (Jan 1, Mar 9), so
      // cycleLengthDays falls back to the profile default (28) rather than an
      // observed average, and the anchor rolls forward from Mar 9 (the last
      // recognized start) rather than Mar 23.
      cycleLengthDays: 28,
      history: {
        source: 'bleeding-history',
        startDates: ['2026-01-01', '2026-03-09'],
      },
      current: {
        cycleDay: 15,
        cycleStartDate: '2026-04-06',
        activeBleeding: {
          logDate: '2026-03-09',
          bleeding: 'medium',
        },
      },
      nextPeriod: {
        startDate: '2026-05-04',
        lengthDays: 5,
      },
      fertileWindow: {
        startDate: '2026-04-15',
        endDate: '2026-04-20',
      },
      confidence: {
        level: 'medium',
        reasonCodes: ['irregular-cycle-support-enabled'],
      },
      limitationCodes: [
        'on-device',
        'not-medical-certainty',
        'irregular-cycle-broader',
        'projected-forward',
      ],
    },
  },
  {
    // 5. Long gap: a single old logged start requires rolling the anchor
    // forward by whole cycles so cycleDay stays within [1, cycleLengthDays]
    // and nextPeriod is a genuine future projection.
    name: 'long gap since last logged start (forward-rolled anchor)',
    todayIso: '2026-06-01',
    profile: {
      ...BASE_PROFILE,
      cycleLengthDays: 29,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-04-02',
    },
    logEntries: [createLogEntry('2026-04-02', 'medium')],
    expected: {
      cycleLengthDays: 29,
      history: {
        source: 'bleeding-history',
        startDates: ['2026-04-02'],
      },
      current: {
        cycleDay: 3,
        cycleStartDate: '2026-05-30',
        activeBleeding: {
          logDate: '2026-04-02',
          bleeding: 'medium',
        },
      },
      nextPeriod: {
        startDate: '2026-06-28',
        lengthDays: 5,
      },
      fertileWindow: {
        startDate: '2026-06-09',
        endDate: '2026-06-14',
      },
      confidence: {
        level: 'low',
        reasonCodes: ['limited-bleeding-history'],
        improvementCodes: ['limited-bleeding-history'],
      },
      limitationCodes: [
        'on-device',
        'not-medical-certainty',
        'limited-history-shift',
        'projected-forward',
      ],
    },
  },
  {
    // 6. Onboarding-seeded / minimal history: no bleeding log entries at all,
    // relying entirely on onboarding-provided profile fields.
    name: 'onboarding-seeded minimal history (no log entries, full profile)',
    todayIso: '2026-04-20',
    profile: {
      ...BASE_PROFILE,
      cycleLengthDays: 31,
      periodLengthDays: 4,
      lastPeriodStartDate: '2026-04-01',
    },
    logEntries: [],
    expected: {
      cycleLengthDays: 31,
      history: {
        source: 'onboarding-seed',
        startDates: ['2026-04-01'],
      },
      current: {
        cycleDay: 20,
        cycleStartDate: '2026-04-01',
        activeBleeding: {
          logDate: '2026-04-01',
          bleeding: 'light',
        },
      },
      nextPeriod: {
        startDate: '2026-05-02',
        lengthDays: 4,
      },
      fertileWindow: {
        startDate: '2026-04-13',
        endDate: '2026-04-18',
      },
      confidence: {
        level: 'medium',
        reasonCodes: ['onboarding-seed'],
        improvementCodes: ['onboarding-seed'],
      },
      limitationCodes: ['on-device', 'not-medical-certainty', 'onboarding-seed-active'],
    },
  },
];

describe('prediction engine golden characterization', () => {
  it.each(cases)('$name', ({ todayIso, profile, logEntries, expected }) => {
    const result = buildPredictionResult({ todayIso, profile, logEntries });

    // Strict deep-equality on the full result covers every field the engine
    // produces — including undefined-valued keys, which a JSON round-trip
    // would silently strip — so any drift in cycle length, dates, confidence,
    // or limitations fails this test rather than slipping through.
    expect(result).toStrictEqual(expected);
  });
});
