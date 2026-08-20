import type { DailyLogEntry, UserProfile } from '@/src/types/domain';

import { buildTodaySnapshot } from '@/src/features/tracker/buildTodaySnapshot';

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

describe('buildTodaySnapshot', () => {
  it('maps a prediction result into the Today snapshot copy', () => {
    const profile: UserProfile = {
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: [],
    };

    const snapshot = buildTodaySnapshot({
      todayIso: '2026-04-20',
      profile,
      logEntries: [
        createLogEntry('2026-02-28', 'medium'),
        createLogEntry('2026-03-28', 'heavy'),
      ],
      locale: 'en',
    });

    expect(snapshot).toEqual({
      cycleDay: 24,
      cycleLengthDays: 28,
      periodLengthDays: 5,
      cycleDayLabel: 'Cycle day 24',
      nextPeriodStartIso: '2026-04-25',
      fertileWindowLabel: 'Fertile window ended 9 days ago',
      fertileWindowCaption: 'Was open Apr 6 to 11.',
      fertileWindowStartOffsetDays: 9,
      confidenceLevel: 'medium',
      confidenceLabel: 'Medium confidence',
      confidenceBasisLabel: 'Based on 2 local cycle starts',
      confidenceReasonCodes: ['one-observed-interval'],
      historyChipLabel: '2 cycles',
      limitations: [
        'Predictions stay on this device and adapt as more entries are logged.',
        'Floriva shows estimates, not medical certainty.',
      ],
      improvements: [
        {
          code: 'one-observed-interval',
          action: { href: '/calendar/day/2026-04-20' },
        },
      ],
    });
  });

  it('uses singular day copy when the fertile window is one day away', () => {
    const profile: UserProfile = {
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: [],
    };

    const snapshot = buildTodaySnapshot({
      todayIso: '2026-04-05',
      profile,
      logEntries: [
        createLogEntry('2026-02-28', 'medium'),
        createLogEntry('2026-03-28', 'heavy'),
      ],
      locale: 'en',
    });

    expect(snapshot.fertileWindowLabel).toBe('Fertile window opens in 1 day');
  });

  it('formats the snapshot copy for another supported locale', () => {
    const profile: UserProfile = {
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: [],
    };

    const snapshot = buildTodaySnapshot({
      todayIso: '2026-04-20',
      profile,
      logEntries: [
        createLogEntry('2026-02-28', 'medium'),
        createLogEntry('2026-03-28', 'heavy'),
      ],
      locale: 'es',
    });

    expect(snapshot.cycleDayLabel).toBe('Día del ciclo 24');
    expect(snapshot.fertileWindowLabel).toBe('La ventana fértil terminó hace 9 días');
    expect(snapshot.confidenceLabel).toBe('Confianza media');
    expect(snapshot.confidenceBasisLabel).toBe('Basado en 2 inicios de ciclo locales');
  });

  it('omits improvements entirely once confidence reasons have nothing actionable', () => {
    const profile: UserProfile = {
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-01-01',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: [],
    };

    const snapshot = buildTodaySnapshot({
      todayIso: '2026-04-20',
      profile,
      logEntries: [
        createLogEntry('2026-01-01', 'heavy'),
        createLogEntry('2026-01-29', 'heavy'),
        createLogEntry('2026-02-26', 'heavy'),
        createLogEntry('2026-03-26', 'heavy'),
      ],
      locale: 'en',
    });

    expect(snapshot.confidenceLevel).toBe('high');
    expect(snapshot.improvements).toBeUndefined();
  });

  it('derives an onboarding-seed improvement pointing at today\'s log route', () => {
    const profile: UserProfile = {
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-04-01',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: [],
    };

    const snapshot = buildTodaySnapshot({
      todayIso: '2026-04-20',
      profile,
      logEntries: [],
      locale: 'en',
    });

    expect(snapshot.confidenceReasonCodes).toEqual(['onboarding-seed']);
    expect(snapshot.improvements).toEqual([
      {
        code: 'onboarding-seed',
        action: { href: '/calendar/day/2026-04-20' },
      },
    ]);
  });

  // --- B5: anomaly threading (at most one, head-of-filtered-list) ---
  //
  // Reuses the exact fixture from
  // tests/lib/predictions/buildPredictionResult.anomalies.test.ts (a regular
  // 28-day user, 41 days into an open cycle): the engine reports BOTH
  // missed-expected-period (2026-03-30) and long-cycle (2026-03-02).
  // `filterDismissedAnomalies` sorts most-recent-anchor-first, so
  // missed-expected-period naturally sorts ahead of long-cycle -- no extra
  // priority logic needed. See buildTodaySnapshot.ts for the wiring.
  const ANOMALY_PROFILE: UserProfile = {
    cycleLengthDays: 28,
    periodLengthDays: 5,
    lastPeriodStartDate: '2026-03-02',
    goals: ['period'],
    supportsIrregularCycles: false,
    conditionTags: [],
  };
  const ANOMALY_ENTRIES = [
    createLogEntry('2026-01-05', 'medium'),
    createLogEntry('2026-02-02', 'medium'),
    createLogEntry('2026-03-02', 'medium'),
  ];

  describe('anomaly threading', () => {
    it('surfaces the head-of-list anomaly (missed-expected-period) when both co-occur', () => {
      const snapshot = buildTodaySnapshot({
        todayIso: '2026-04-12',
        profile: ANOMALY_PROFILE,
        logEntries: ANOMALY_ENTRIES,
        locale: 'en',
        dismissedAnomalyIds: [],
      });

      expect(snapshot.anomaly).toEqual({
        id: 'missed-expected-period:2026-03-30',
        kind: 'missed-expected-period',
        anchorDateIso: '2026-03-30',
      });
    });

    it('falls through to the next anomaly once the head has been dismissed', () => {
      const snapshot = buildTodaySnapshot({
        todayIso: '2026-04-12',
        profile: ANOMALY_PROFILE,
        logEntries: ANOMALY_ENTRIES,
        locale: 'en',
        dismissedAnomalyIds: ['missed-expected-period:2026-03-30'],
      });

      expect(snapshot.anomaly).toEqual({
        id: 'long-cycle:2026-03-02',
        kind: 'long-cycle',
        anchorDateIso: '2026-03-02',
      });
    });

    it('omits anomaly entirely once every detected anomaly has been dismissed', () => {
      const snapshot = buildTodaySnapshot({
        todayIso: '2026-04-12',
        profile: ANOMALY_PROFILE,
        logEntries: ANOMALY_ENTRIES,
        locale: 'en',
        dismissedAnomalyIds: [
          'missed-expected-period:2026-03-30',
          'long-cycle:2026-03-02',
        ],
      });

      expect(snapshot.anomaly).toBeUndefined();
      expect('anomaly' in snapshot).toBe(false);
    });

    it('omits anomaly entirely when the engine detected none', () => {
      const profile: UserProfile = {
        cycleLengthDays: 28,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-03-28',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: false,
        conditionTags: [],
      };

      const snapshot = buildTodaySnapshot({
        todayIso: '2026-04-20',
        profile,
        logEntries: [
          createLogEntry('2026-02-28', 'medium'),
          createLogEntry('2026-03-28', 'heavy'),
        ],
        locale: 'en',
        dismissedAnomalyIds: [],
      });

      expect(snapshot.anomaly).toBeUndefined();
      expect('anomaly' in snapshot).toBe(false);
    });

    it('defaults dismissedAnomalyIds to empty when the option is omitted', () => {
      const snapshot = buildTodaySnapshot({
        todayIso: '2026-04-12',
        profile: ANOMALY_PROFILE,
        logEntries: ANOMALY_ENTRIES,
        locale: 'en',
      });

      expect(snapshot.anomaly).toEqual({
        id: 'missed-expected-period:2026-03-30',
        kind: 'missed-expected-period',
        anchorDateIso: '2026-03-30',
      });
    });
  });
});
