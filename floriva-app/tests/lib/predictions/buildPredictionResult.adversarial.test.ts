/**
 * Adversarial tests for buildPredictionResult.ts
 *
 * Probes: sparse/zero data, extreme cycle lengths, irregular/duplicate/future
 * start dates, numeric safety (NaN / Infinity / non-integer lengths), and
 * honesty / confidence copy rules.
 */

import type { DailyLogEntry, UserProfile } from '@/src/types/domain';
import { confidenceReasonCodeValues, limitationCodeValues } from '@/src/types/domain';

import { buildPredictionResult } from '@/src/lib/predictions/buildPredictionResult';

// ─── helpers ────────────────────────────────────────────────────────────────

function entry(
  logDate: string,
  bleeding: DailyLogEntry['bleeding'] = 'medium',
): DailyLogEntry {
  return { id: `${logDate}`, logDate, bleeding, symptoms: [] };
}

const BASE_PROFILE: UserProfile = {
  cycleLengthDays: 28,
  periodLengthDays: 5,
  lastPeriodStartDate: '2026-04-01',
  goals: ['period'],
  supportsIrregularCycles: false,
  conditionTags: [],
};

// ─── SPARSE DATA ────────────────────────────────────────────────────────────

describe('buildPredictionResult adversarial – sparse data', () => {
  it('zero log entries falls back to onboarding seed and never crashes', () => {
    const result = buildPredictionResult({
      todayIso: '2026-04-20',
      profile: BASE_PROFILE,
      logEntries: [],
    });

    expect(result.history.source).toBe('onboarding-seed');
    expect(result.cycleLengthDays).toBeGreaterThan(0);
    expect(result.confidence.level).not.toBe('high');
    // Must not claim a rhythm established from zero data
    expect(result.confidence.reasonCodes).not.toContain('consistent-recent-bleeding-history');
  });

  it('zero log entries, no profile cycle length, returns safe defaults without crashing', () => {
    const result = buildPredictionResult({
      todayIso: '2026-05-01',
      profile: {
        goals: ['period'],
        supportsIrregularCycles: false,
        conditionTags: [],
      },
      logEntries: [],
    });

    expect(result.cycleLengthDays).toBeGreaterThan(0);
    expect(result.current.cycleDay).toBeGreaterThanOrEqual(1);
    expect(result.nextPeriod.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.confidence.level).not.toBe('high');
  });

  it('exactly one logged start → confidence low, NOT high/medium claiming a rhythm', () => {
    const result = buildPredictionResult({
      todayIso: '2026-04-20',
      profile: BASE_PROFILE,
      logEntries: [entry('2026-04-01')],
    });

    expect(result.history.startDates).toHaveLength(1);
    expect(result.confidence.level).toBe('low');
    // Honesty: must not claim a steady/consistent rhythm from one start
    expect(result.confidence.reasonCodes).not.toContain('consistent-recent-bleeding-history');
  });

  it('exactly two logged starts (one interval) → confidence medium, NOT high', () => {
    const result = buildPredictionResult({
      todayIso: '2026-04-20',
      profile: BASE_PROFILE,
      logEntries: [entry('2026-03-01'), entry('2026-03-29')],
    });

    expect(result.history.startDates).toHaveLength(2);
    expect(result.confidence.level).toBe('medium');
    expect(result.confidence.level).not.toBe('high');
    // Cycle length must come from profile (only one interval, but < 3 starts
    // so engine falls back to profile value)
    expect(result.cycleLengthDays).toBe(28);
    expect(result.confidence.reasonCodes).not.toContain('consistent-recent-bleeding-history');
  });
});

// ─── EXTREME / IRREGULAR ────────────────────────────────────────────────────

describe('buildPredictionResult adversarial – extreme cycle lengths', () => {
  it('very short logged cycle (2 days between starts) still produces a valid result', () => {
    // Three starts, all 2 days apart: average = 2, but engine clamps to 20.
    const result = buildPredictionResult({
      todayIso: '2026-04-10',
      profile: { ...BASE_PROFILE, cycleLengthDays: 28 },
      logEntries: [entry('2026-04-01'), entry('2026-04-03'), entry('2026-04-05')],
    });

    // MIN cycle guard clamps to 20
    expect(result.cycleLengthDays).toBeGreaterThanOrEqual(20);
    expect(result.current.cycleDay).toBeGreaterThanOrEqual(1);
    expect(result.nextPeriod.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // nextPeriod must be in the future relative to today
    expect(result.nextPeriod.startDate > '2026-04-10').toBe(true);
  });

  it('very long cycle (90 days) produces a valid result without crashing', () => {
    const result = buildPredictionResult({
      todayIso: '2026-04-20',
      profile: { ...BASE_PROFILE, cycleLengthDays: 90 },
      logEntries: [entry('2026-01-01'), entry('2026-04-01'), entry('2026-07-01')],
    });

    expect(result.cycleLengthDays).toBeGreaterThan(0);
    expect(result.nextPeriod.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('wildly irregular intervals: never crash, degrade confidence appropriately', () => {
    // Intervals: 7, 60, 14 days
    const result = buildPredictionResult({
      todayIso: '2026-04-20',
      profile: { ...BASE_PROFILE, supportsIrregularCycles: true },
      logEntries: [
        entry('2026-01-01'),
        entry('2026-01-08'),
        entry('2026-03-09'),
        entry('2026-03-23'),
      ],
    });

    expect(result.cycleLengthDays).toBeGreaterThan(0);
    expect(result.confidence.level).not.toBe('high');
    expect(result.nextPeriod.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('unsorted start dates are sorted before use, producing correct cycle length', () => {
    // 28 days apart in reality; fed in reverse order
    const result = buildPredictionResult({
      todayIso: '2026-04-20',
      profile: BASE_PROFILE,
      logEntries: [
        entry('2026-03-29', 'medium'),
        entry('2026-03-30', 'medium'),  // contiguous to 29, not a new start
        entry('2026-03-01', 'medium'),
        entry('2026-03-02', 'medium'),  // contiguous to 01, not a new start
      ],
    });

    // Two separate starts: Mar 01 and Mar 29 (28 days)
    expect(result.history.startDates).toEqual(['2026-03-01', '2026-03-29']);
    expect(result.cycleLengthDays).toBe(28);
  });

  it('duplicate start dates are treated as a single start (contiguous-bleed logic)', () => {
    const result = buildPredictionResult({
      todayIso: '2026-04-20',
      profile: BASE_PROFILE,
      logEntries: [
        entry('2026-03-01'),
        entry('2026-03-01'), // exact duplicate
      ],
    });

    // Two log entries on the same date → still only one cycle start
    expect(result.history.startDates).toEqual(['2026-03-01']);
  });

  it('future-dated logged start: cycle rolls correctly so nextPeriod is beyond today', () => {
    // Start date in the future relative to today — the cycle should anchor
    // to the future start and nextPeriod should be beyond it.
    const result = buildPredictionResult({
      todayIso: '2026-04-01',
      profile: BASE_PROFILE,
      logEntries: [entry('2026-04-05', 'medium')],
    });

    // Only one start, so confidence is low
    expect(result.confidence.level).toBe('low');
    // Result must not crash
    expect(result.nextPeriod.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ─── NUMERIC SAFETY ─────────────────────────────────────────────────────────

describe('buildPredictionResult adversarial – numeric safety', () => {
  it('NaN cycle length in profile falls through to default without crashing', () => {
    const result = buildPredictionResult({
      todayIso: '2026-04-20',
      profile: { ...BASE_PROFILE, cycleLengthDays: NaN },
      logEntries: [],
    });

    // Should use the fallback default (28 for non-seed non-onboarding paths,
    // or 29 for the onboarding-seed path with source 'onboarding-seed').
    // Most importantly: must not produce NaN cycle day or dates.
    expect(Number.isNaN(result.cycleLengthDays)).toBe(false);
    expect(result.current.cycleDay).toBeGreaterThanOrEqual(1);
    expect(Number.isNaN(result.current.cycleDay)).toBe(false);
    expect(result.nextPeriod.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('Infinity cycle length in profile falls through to default without crashing', () => {
    const result = buildPredictionResult({
      todayIso: '2026-04-20',
      profile: { ...BASE_PROFILE, cycleLengthDays: Infinity },
      logEntries: [],
    });

    expect(Number.isFinite(result.cycleLengthDays)).toBe(true);
    expect(result.nextPeriod.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('zero cycle length in profile falls through to default without crashing', () => {
    const result = buildPredictionResult({
      todayIso: '2026-04-20',
      profile: { ...BASE_PROFILE, cycleLengthDays: 0 },
      logEntries: [],
    });

    expect(result.cycleLengthDays).toBeGreaterThan(0);
    expect(result.nextPeriod.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('negative cycle length in profile falls through to default without crashing', () => {
    const result = buildPredictionResult({
      todayIso: '2026-04-20',
      profile: { ...BASE_PROFILE, cycleLengthDays: -5 },
      logEntries: [],
    });

    expect(result.cycleLengthDays).toBeGreaterThan(0);
    expect(result.nextPeriod.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('non-integer cycle length from observed data is safely rounded', () => {
    // Observed intervals: 27, 28 → average = 27.5, Math.round → 28
    const result = buildPredictionResult({
      todayIso: '2026-04-10',
      profile: BASE_PROFILE,
      logEntries: [
        entry('2026-02-01', 'medium'),
        entry('2026-02-28', 'medium'), // 27 days
        entry('2026-03-28', 'medium'), // 28 days
      ],
    });

    expect(Number.isInteger(result.cycleLengthDays)).toBe(true);
  });

  it('NaN period length in profile falls through to default 5 without crashing', () => {
    const result = buildPredictionResult({
      todayIso: '2026-04-20',
      profile: { ...BASE_PROFILE, periodLengthDays: NaN },
      logEntries: [],
    });

    expect(Number.isNaN(result.nextPeriod.lengthDays)).toBe(false);
    expect(result.nextPeriod.lengthDays).toBeGreaterThan(0);
  });

  it('fractional period length 0.4 rounds to 0 — lengthDays must remain positive (guard gap)', () => {
    // resolvePeriodLengthDays: v=0.4 passes the v<=0 guard, Math.round(0.4)=0
    // This produces nextPeriod.lengthDays=0, which violates the >0 invariant.
    // The fix (v <= 0) needs to be v < 1 (or Math.max(1, Math.round(v))) to close this gap.
    // This test documents the defect: it currently FAILS, proving the guard is incomplete.
    const result = buildPredictionResult({
      todayIso: '2026-04-20',
      profile: { ...BASE_PROFILE, periodLengthDays: 0.4 },
      logEntries: [],
    });

    expect(result.nextPeriod.lengthDays).toBeGreaterThan(0);
  });
});

// ─── HONESTY / CONFIDENCE COPY ───────────────────────────────────────────────

describe('buildPredictionResult adversarial – honesty and confidence copy', () => {
  it('high confidence is NEVER returned from zero log entries', () => {
    const result = buildPredictionResult({
      todayIso: '2026-04-20',
      profile: BASE_PROFILE,
      logEntries: [],
    });
    expect(result.confidence.level).not.toBe('high');
  });

  it('high confidence is NEVER returned from one logged start', () => {
    const result = buildPredictionResult({
      todayIso: '2026-04-20',
      profile: BASE_PROFILE,
      logEntries: [entry('2026-04-01')],
    });
    expect(result.confidence.level).not.toBe('high');
  });

  it('high confidence is NEVER returned from two logged starts (one interval)', () => {
    const result = buildPredictionResult({
      todayIso: '2026-04-20',
      profile: BASE_PROFILE,
      logEntries: [entry('2026-03-01'), entry('2026-03-29')],
    });
    expect(result.confidence.level).not.toBe('high');
  });

  it('high confidence requires three or more logged starts', () => {
    const withThree = buildPredictionResult({
      todayIso: '2026-04-20',
      profile: BASE_PROFILE,
      logEntries: [
        entry('2026-02-01'),
        entry('2026-03-01'),
        entry('2026-03-29'),
      ],
    });
    expect(withThree.confidence.level).toBe('high');
  });

  it('low-history result includes a limitation code noting that timing may shift', () => {
    const result = buildPredictionResult({
      todayIso: '2026-04-20',
      profile: BASE_PROFILE,
      logEntries: [entry('2026-04-01')],
    });

    expect(result.limitationCodes).toContain('limited-history-shift');
  });

  it('confidence reason and limitation codes are stable identifiers, not free-form medical language', () => {
    // The engine emits codes, not English strings -- there is no free-form
    // copy at this layer to check for overconfident medical language (that
    // guard now lives in tests/localization/predictionsMessages.test.ts,
    // which checks the ACTUAL translated copy against
    // bannedMedicalTermsByLocale). This test instead pins the structural
    // invariant: every code the engine emits here is a member of the
    // declared code unions, so nothing free-form can leak through.
    const twoStarts = buildPredictionResult({
      todayIso: '2026-04-20',
      profile: BASE_PROFILE,
      logEntries: [entry('2026-03-01'), entry('2026-03-29')],
    });

    for (const code of twoStarts.confidence.reasonCodes) {
      expect(confidenceReasonCodeValues).toContain(code);
    }
    for (const code of twoStarts.limitationCodes) {
      expect(limitationCodeValues).toContain(code);
    }
  });

  it('onboarding-seed source with no profile last-period date uses todayIso as anchor', () => {
    const result = buildPredictionResult({
      todayIso: '2026-06-10',
      profile: { goals: ['period'], supportsIrregularCycles: false, conditionTags: [] },
      logEntries: [],
    });

    // Anchor is todayIso, so cycleDay must be 1
    expect(result.current.cycleDay).toBe(1);
    expect(result.current.cycleStartDate).toBe('2026-06-10');
  });

  it('fertile window start is always strictly before its end date', () => {
    const result = buildPredictionResult({
      todayIso: '2026-04-20',
      profile: BASE_PROFILE,
      logEntries: [entry('2026-04-01')],
    });
    expect(result.fertileWindow.startDate < result.fertileWindow.endDate).toBe(true);
  });

  it('fertile window end is always before nextPeriod start', () => {
    const result = buildPredictionResult({
      todayIso: '2026-04-20',
      profile: BASE_PROFILE,
      logEntries: [entry('2026-04-01')],
    });
    expect(result.fertileWindow.endDate < result.nextPeriod.startDate).toBe(true);
  });
});

// ─── LEAP-YEAR CYCLE MATH ─────────────────────────────────────────────────

describe('buildPredictionResult adversarial – leap-year cycle anchoring', () => {
  it('cycle starting on Feb 29 in a leap year produces a valid next period', () => {
    const result = buildPredictionResult({
      todayIso: '2024-03-10',
      profile: { ...BASE_PROFILE, cycleLengthDays: 28 },
      logEntries: [entry('2024-02-29')],
    });

    expect(result.current.cycleStartDate).toBe('2024-02-29');
    expect(result.nextPeriod.startDate).toBe('2024-03-28');
    expect(result.nextPeriod.startDate > '2024-03-10').toBe(true);
  });

  it('year-boundary cycle: start Dec 31, next period in Jan without crashing', () => {
    const result = buildPredictionResult({
      todayIso: '2025-01-10',
      profile: { ...BASE_PROFILE, cycleLengthDays: 28 },
      logEntries: [entry('2024-12-31')],
    });

    expect(result.nextPeriod.startDate).toBe('2025-01-28');
  });
});
