import type {
  DailyLogEntry,
  ReminderPreference,
  SupportedLocale,
  UserProfile,
} from '@/src/types/domain';

import {
  buildReminderPlans,
  REMINDER_OCCURRENCE_HORIZON,
} from '@/src/lib/notifications/buildReminderPlans';
import { supportedLocales } from '@/src/localization/config';
import { translate } from '@/src/localization/translations';

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

function expectLocalTriggerDate(
  value: Date,
  expected: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
  },
) {
  expect(value.getFullYear()).toBe(expected.year);
  expect(value.getMonth()).toBe(expected.month - 1);
  expect(value.getDate()).toBe(expected.day);
  expect(value.getHours()).toBe(expected.hour);
  expect(value.getMinutes()).toBe(expected.minute);
}

describe('buildReminderPlans', () => {
  const profile: UserProfile = {
    cycleLengthDays: 28,
    periodLengthDays: 5,
    lastPeriodStartDate: '2026-03-28',
    goals: ['period', 'symptoms'],
    supportsIrregularCycles: false,
    conditionTags: [],
    // LT-26: a birth-control reminder only schedules when a method is on
    // file (see buildReminderPlans.ts). Several tests in this file exercise
    // the birth-control reminder kind, so the shared fixture profile needs a
    // method for those to still demonstrate scheduling; it has no effect on
    // the daily-log/period-start/fertile-window tests that also use it.
    birthControlMethod: 'pill',
  };

  const logEntries: DailyLogEntry[] = [
    createLogEntry('2026-02-28', 'medium'),
    createLogEntry('2026-03-28', 'heavy'),
  ];

  function expectPrivateNotificationContent(content: { title: string; body: string }) {
    const combinedCopy = `${content.title} ${content.body}`;

    expect(combinedCopy).not.toMatch(
      /period|fertile|ovulat|birth[- ]?control|contracept|cycle|symptom|mood|cramp|bleed|\d{4}-\d{2}-\d{2}/i,
    );
  }

  it('builds a repeating daily reminder plan for enabled daily-log reminders', () => {
    const plans = buildReminderPlans({
      todayIso: '2026-04-20',
      profile,
      logEntries,
      preferences: [
        {
          kind: 'daily-log',
          enabled: true,
          hour: 20,
          minute: 15,
          schedule: {
            cadence: 'daily',
          },
        },
      ],
    });

    expect(plans).toEqual([
      {
        identifier: 'reminder-daily-log',
        kind: 'daily-log',
        content: {
          title: 'Log today in Floriva',
          body: 'Keep your private history current without sending anything off-device.',
          categoryIdentifier: 'florivaLog',
        },
        trigger: {
          type: 'daily',
          hour: 20,
          minute: 15,
        },
      },
    ]);
  });

  it('builds cycle-event reminders from the next predicted period and fertile window', () => {
    const preferences: ReminderPreference[] = [
      {
        kind: 'period-start',
        enabled: true,
        hour: 8,
        minute: 30,
        schedule: {
          cadence: 'cycle-event',
          daysBefore: 0,
        },
      },
      {
        kind: 'fertile-window',
        enabled: true,
        hour: 7,
        minute: 45,
        schedule: {
          cadence: 'cycle-event',
          daysBefore: 2,
        },
      },
    ];

    const plans = buildReminderPlans({
      todayIso: '2026-04-20',
      profile,
      logEntries,
      preferences,
    });

    // LT-05: each cycle-event kind now schedules a horizon of occurrences
    // (see REMINDER_OCCURRENCE_HORIZON in buildReminderPlans.ts), not just
    // one. Occurrence 1 keeps the bare identifier this test always asserted;
    // look it up by identifier rather than positional index so the horizon
    // size is not baked into this test.
    expect(plans).toHaveLength(2 * REMINDER_OCCURRENCE_HORIZON);
    const periodStartPlan = plans.find((plan) => plan.identifier === 'reminder-period-start');
    const fertileWindowPlan = plans.find(
      (plan) => plan.identifier === 'reminder-fertile-window',
    );

    expect(periodStartPlan).toMatchObject({
      identifier: 'reminder-period-start',
      kind: 'period-start',
      content: {
        title: 'Floriva reminder',
        body: 'Open Floriva for a private update.',
        categoryIdentifier: 'florivaLog',
      },
      trigger: {
        type: 'date',
      },
    });
    expect(fertileWindowPlan).toMatchObject({
      identifier: 'reminder-fertile-window',
      kind: 'fertile-window',
      content: {
        title: 'Floriva reminder',
        body: 'Open Floriva for a private update.',
      },
      trigger: {
        type: 'date',
      },
    });
    // fertile-window is a cycle-event kind like period-start but must NOT
    // carry the florivaLog quick-action category (see FLORIVA_LOG_NOTIFICATION_CATEGORY
    // in buildReminderPlans.ts): a quick log makes sense for "did your period
    // start" but not for "your fertile window is opening".
    expect(fertileWindowPlan!.content).not.toHaveProperty('categoryIdentifier');
    expectPrivateNotificationContent(periodStartPlan!.content);
    expectPrivateNotificationContent(fertileWindowPlan!.content);

    if (periodStartPlan!.trigger.type !== 'date' || fertileWindowPlan!.trigger.type !== 'date') {
      throw new Error('Expected date-based reminder plans');
    }

    expectLocalTriggerDate(periodStartPlan!.trigger.date, {
      year: 2026,
      month: 4,
      day: 25,
      hour: 8,
      minute: 30,
    });
    expectLocalTriggerDate(fertileWindowPlan!.trigger.date, {
      year: 2026,
      month: 5,
      day: 2,
      hour: 7,
      minute: 45,
    });
  });

  it('builds a daily birth-control reminder and ignores disabled reminder kinds', () => {
    const plans = buildReminderPlans({
      todayIso: '2026-04-20',
      profile,
      logEntries,
      preferences: [
        {
          kind: 'daily-log',
          enabled: false,
          hour: 20,
          minute: 0,
          schedule: {
            cadence: 'daily',
          },
        },
        {
          kind: 'birth-control',
          enabled: true,
          hour: 21,
          minute: 0,
          schedule: {
            cadence: 'daily',
          },
        },
      ],
    });

    expect(plans).toEqual([
      {
        identifier: 'reminder-birth-control',
        kind: 'birth-control',
        content: {
          title: 'Floriva reminder',
          body: 'Open Floriva for your private check-in.',
        },
        trigger: {
          type: 'daily',
          hour: 21,
          minute: 0,
        },
      },
    ]);
    expectPrivateNotificationContent(plans[0]!.content);
  });

  it('rolls past-due cycle reminders forward using the prediction cycle length, not the profile seed', () => {
    const plans = buildReminderPlans({
      todayIso: '2026-03-25',
      profile: {
        cycleLengthDays: 24,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-03-02',
        goals: ['period'],
        supportsIrregularCycles: false,
        conditionTags: [],
      },
      logEntries: [
        createLogEntry('2026-01-01', 'medium'),
        createLogEntry('2026-01-31', 'medium'),
        createLogEntry('2026-03-02', 'medium'),
      ],
      preferences: [
        {
          kind: 'fertile-window',
          enabled: true,
          hour: 9,
          minute: 0,
          schedule: {
            cadence: 'cycle-event',
            daysBefore: 0,
          },
        },
      ],
    });

    // LT-05: a full occurrence horizon is scheduled; occurrence 1 keeps the
    // bare identifier this test always asserted.
    expect(plans).toHaveLength(REMINDER_OCCURRENCE_HORIZON);
    expect(plans[0]).toMatchObject({
      identifier: 'reminder-fertile-window',
      content: {
        body: 'Open Floriva for a private update.',
      },
      trigger: {
        type: 'date',
      },
    });
    expectPrivateNotificationContent(plans[0]!.content);

    if (plans[0]?.trigger.type !== 'date') {
      throw new Error('Expected a date-based fertile-window reminder plan');
    }

    expectLocalTriggerDate(plans[0].trigger.date, {
      year: 2026,
      month: 4,
      day: 12,
      hour: 9,
      minute: 0,
    });
  });

  it('ignores cycle-event reminders that are misconfigured with a daily cadence', () => {
    const plans = buildReminderPlans({
      todayIso: '2026-04-20',
      profile,
      logEntries,
      preferences: [
        {
          kind: 'period-start',
          enabled: true,
          hour: 9,
          minute: 0,
          schedule: {
            cadence: 'daily',
          },
        },
      ],
    });

    expect(plans).toEqual([]);
  });

  it('ignores unsupported reminder kinds defensively when they bypass typing', () => {
    const plans = buildReminderPlans({
      todayIso: '2026-04-20',
      profile,
      logEntries,
      preferences: [
        {
          kind: 'unsupported' as ReminderPreference['kind'],
          enabled: true,
          hour: 9,
          minute: 0,
          schedule: {
            cadence: 'cycle-event',
            daysBefore: 0,
          },
        },
      ],
    });

    expect(plans).toEqual([]);
  });

  it('does not attach a category identifier to the birth-control reminder', () => {
    const plans = buildReminderPlans({
      todayIso: '2026-04-20',
      profile,
      logEntries,
      preferences: [
        {
          kind: 'birth-control',
          enabled: true,
          hour: 21,
          minute: 0,
          schedule: {
            cadence: 'daily',
          },
        },
      ],
    });

    expect(plans[0]!.content).not.toHaveProperty('categoryIdentifier');
  });

  it('defaults to English content when no locale is provided', () => {
    const plans = buildReminderPlans({
      todayIso: '2026-04-20',
      profile,
      logEntries,
      preferences: [
        {
          kind: 'daily-log',
          enabled: true,
          hour: 20,
          minute: 15,
          schedule: {
            cadence: 'daily',
          },
        },
      ],
    });

    expect(plans[0]!.content).toMatchObject({
      title: 'Log today in Floriva',
      body: 'Keep your private history current without sending anything off-device.',
    });
  });

  describe.each(supportedLocales)('locale threading (%s)', (locale: SupportedLocale) => {
    it('translates daily-log, period-start, and birth-control content into the requested locale', () => {
      const preferences: ReminderPreference[] = [
        {
          kind: 'daily-log',
          enabled: true,
          hour: 20,
          minute: 15,
          schedule: {
            cadence: 'daily',
          },
        },
        {
          kind: 'birth-control',
          enabled: true,
          hour: 21,
          minute: 0,
          schedule: {
            cadence: 'daily',
          },
        },
        {
          kind: 'period-start',
          enabled: true,
          hour: 8,
          minute: 30,
          schedule: {
            cadence: 'cycle-event',
            daysBefore: 0,
          },
        },
      ];

      const plans = buildReminderPlans({
        todayIso: '2026-04-20',
        profile,
        logEntries,
        preferences,
        locale,
      });

      const dailyLogPlan = plans.find((plan) => plan.identifier === 'reminder-daily-log');
      const birthControlPlan = plans.find(
        (plan) => plan.identifier === 'reminder-birth-control',
      );
      const periodStartPlan = plans.find(
        (plan) => plan.identifier === 'reminder-period-start',
      );

      expect(dailyLogPlan?.content).toMatchObject({
        title: translate(locale, 'notifications.dailyLog.title'),
        body: translate(locale, 'notifications.dailyLog.body'),
        categoryIdentifier: 'florivaLog',
      });
      expect(birthControlPlan?.content).toMatchObject({
        title: translate(locale, 'notifications.birthControl.title'),
        body: translate(locale, 'notifications.birthControl.body'),
      });
      expect(periodStartPlan?.content).toMatchObject({
        title: translate(locale, 'notifications.cycleEvent.title'),
        body: translate(locale, 'notifications.cycleEvent.body'),
        categoryIdentifier: 'florivaLog',
      });

      // Discreet register must hold in every supported locale, not just English.
      for (const plan of plans) {
        const combinedCopy = `${plan.content.title} ${plan.content.body}`;

        expect(combinedCopy.toLowerCase()).not.toMatch(
          /period|fertile|ovulat|birth[- ]?control|contracept|cycle|symptom|mood|cramp|bleed/i,
        );
      }
    });
  });
});
