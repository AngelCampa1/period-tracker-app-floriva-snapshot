import { buildReminderCenterModel } from '@/src/features/settings/buildReminderCenterModel';
import type { DailyLogEntry, ReminderPreference, UserProfile } from '@/src/types/domain';

function createLogEntry(logDate: string, bleeding: DailyLogEntry['bleeding']): DailyLogEntry {
  return {
    id: `${logDate}-${bleeding}`,
    logDate,
    bleeding,
    symptoms: [],
  };
}

describe('buildReminderCenterModel', () => {
  const profile: UserProfile = {
    cycleLengthDays: 28,
    periodLengthDays: 5,
    lastPeriodStartDate: '2026-03-28',
    goals: ['period'],
    supportsIrregularCycles: false,
    conditionTags: [],
    // LT-26: birth-control reminders only schedule when a method is on file.
    birthControlMethod: 'pill',
  };

  it('summarizes active local reminders and inactive preferences', () => {
    const preferences: ReminderPreference[] = [
      {
        kind: 'daily-log',
        enabled: true,
        hour: 20,
        minute: 0,
        schedule: { cadence: 'daily' },
      },
      {
        kind: 'period-start',
        enabled: true,
        hour: 9,
        minute: 30,
        schedule: { cadence: 'cycle-event', daysBefore: 1 },
      },
      {
        kind: 'fertile-window',
        enabled: true,
        hour: 8,
        minute: 0,
        schedule: { cadence: 'cycle-event', daysBefore: 2 },
      },
      {
        kind: 'birth-control',
        enabled: true,
        hour: 7,
        minute: 15,
        schedule: { cadence: 'daily' },
      },
    ];

    const model = buildReminderCenterModel({
      todayIso: '2026-04-20',
      profile,
      logEntries: [
        createLogEntry('2026-02-28', 'medium'),
        createLogEntry('2026-03-28', 'heavy'),
      ],
      preferences,
      locale: 'en',
    });

    expect(model.activeCount).toBe(4);
    expect(model.inactiveCount).toBe(0);
    expect(model.rows).toEqual([
      {
        identifier: 'reminder-daily-log',
        kind: 'daily-log',
        detail: expect.stringContaining('8:00'),
      },
      {
        identifier: 'reminder-period-start',
        kind: 'period-start',
        detail: expect.stringContaining('Apr 24'),
      },
      {
        identifier: 'reminder-fertile-window',
        kind: 'fertile-window',
        detail: expect.any(String),
      },
      {
        identifier: 'reminder-birth-control',
        kind: 'birth-control',
        detail: expect.stringContaining('7:15'),
      },
    ]);
  });

  it('formats cycle-event reminder dates from the local scheduled day', () => {
    const model = buildReminderCenterModel({
      todayIso: '2026-04-20',
      profile,
      logEntries: [
        createLogEntry('2026-02-28', 'medium'),
        createLogEntry('2026-03-28', 'heavy'),
      ],
      preferences: [
        {
          kind: 'period-start',
          enabled: true,
          hour: 23,
          minute: 30,
          schedule: { cadence: 'cycle-event', daysBefore: 1 },
        },
      ],
      locale: 'en',
    });

    expect(model.rows).toEqual([
      expect.objectContaining({
        identifier: 'reminder-period-start',
        detail: expect.stringContaining('Apr 24'),
      }),
    ]);
  });
});
