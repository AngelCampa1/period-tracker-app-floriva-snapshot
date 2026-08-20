const mockGetPermissionsAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockSetNotificationChannelAsync = jest.fn();
const mockCancelScheduledNotificationAsync = jest.fn();
const mockScheduleNotificationAsync = jest.fn();

jest.mock('expo-notifications', () => ({
  AndroidImportance: {
    DEFAULT: 5,
  },
  SchedulableTriggerInputTypes: {
    DAILY: 'daily',
    DATE: 'date',
  },
  getPermissionsAsync: () => mockGetPermissionsAsync(),
  requestPermissionsAsync: () => mockRequestPermissionsAsync(),
  setNotificationChannelAsync: (...args: unknown[]) => mockSetNotificationChannelAsync(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) =>
    mockCancelScheduledNotificationAsync(...args),
  scheduleNotificationAsync: (...args: unknown[]) => mockScheduleNotificationAsync(...args),
}));

// eslint-disable-next-line import/first
import type {
  BillingSnapshot,
  DailyLogEntry,
  ReminderPreference,
  UserProfile,
} from '@/src/types/domain';

// eslint-disable-next-line import/first
import {
  BILLING_REMINDER_NOTIFICATION_IDENTIFIER,
  REMINDER_NOTIFICATION_CHANNEL_ID,
  cancelBillingReminderNotification,
  cancelAllLocalNotifications,
  cancelAllReminderNotifications,
  ensureReminderPermissions,
  reconcileBillingReminderNotification,
  reconcileReminderNotifications,
} from '@/src/lib/notifications/reminderScheduler';

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

describe('reminderScheduler', () => {
  const profile: UserProfile = {
    cycleLengthDays: 28,
    periodLengthDays: 5,
    lastPeriodStartDate: '2026-03-28',
    goals: ['period', 'symptoms'],
    supportsIrregularCycles: false,
    conditionTags: [],
    // LT-26: birth-control reminders only schedule when a method is on file.
    birthControlMethod: 'pill',
  };

  const logEntries: DailyLogEntry[] = [
    createLogEntry('2026-02-28', 'medium'),
    createLogEntry('2026-03-28', 'heavy'),
  ];

  beforeEach(() => {
    mockGetPermissionsAsync.mockReset();
    mockRequestPermissionsAsync.mockReset();
    mockSetNotificationChannelAsync.mockReset();
    mockCancelScheduledNotificationAsync.mockReset();
    mockScheduleNotificationAsync.mockReset();
  });

  it('requests notification permission lazily and returns false when access is denied', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'denied' });

    await expect(ensureReminderPermissions()).resolves.toBe(false);
    expect(mockRequestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('cancels known reminder notifications and schedules enabled plans', async () => {
    const preferences: ReminderPreference[] = [
      {
        kind: 'daily-log',
        enabled: true,
        hour: 20,
        minute: 0,
        schedule: {
          cadence: 'daily',
        },
      },
      {
        kind: 'period-start',
        enabled: true,
        hour: 9,
        minute: 0,
        schedule: {
          cadence: 'cycle-event',
          daysBefore: 0,
        },
      },
      {
        kind: 'birth-control',
        enabled: true,
        hour: 21,
        minute: 30,
        schedule: {
          cadence: 'daily',
        },
      },
    ];

    mockScheduleNotificationAsync
      .mockResolvedValueOnce('reminder-daily-log')
      .mockResolvedValueOnce('reminder-period-start')
      .mockResolvedValueOnce('reminder-birth-control');

    await expect(
      reconcileReminderNotifications({
        todayIso: '2026-04-20',
        profile,
        logEntries,
        preferences,
      }),
    ).resolves.toEqual([
      'reminder-daily-log',
      'reminder-period-start',
      'reminder-birth-control',
    ]);

    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('reminder-daily-log');
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('reminder-period-start');
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'reminder-fertile-window',
    );
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'reminder-birth-control',
    );
    expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
      REMINDER_NOTIFICATION_CHANNEL_ID,
      expect.objectContaining({
        name: 'Floriva reminders',
      }),
    );
    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'reminder-daily-log',
        trigger: {
          type: 'daily',
          channelId: REMINDER_NOTIFICATION_CHANNEL_ID,
          hour: 20,
          minute: 0,
        },
      }),
    );
    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'reminder-period-start',
        trigger: expect.objectContaining({
          type: 'date',
          channelId: REMINDER_NOTIFICATION_CHANNEL_ID,
        }),
      }),
    );
    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'reminder-birth-control',
        trigger: {
          type: 'daily',
          channelId: REMINDER_NOTIFICATION_CHANNEL_ID,
          hour: 21,
          minute: 30,
        },
      }),
    );

    const periodScheduleRequest = mockScheduleNotificationAsync.mock.calls.find(
      ([request]) => request.identifier === 'reminder-period-start',
    )?.[0];

    expect(periodScheduleRequest).toBeDefined();
    expectLocalTriggerDate(periodScheduleRequest.trigger.date, {
      year: 2026,
      month: 4,
      day: 25,
      hour: 9,
      minute: 0,
    });
  });

  it('keeps OS notification titles and bodies free of reproductive details', async () => {
    const preferences: ReminderPreference[] = [
      {
        kind: 'daily-log',
        enabled: true,
        hour: 20,
        minute: 0,
        schedule: {
          cadence: 'daily',
        },
      },
      {
        kind: 'period-start',
        enabled: true,
        hour: 9,
        minute: 0,
        schedule: {
          cadence: 'cycle-event',
          daysBefore: 0,
        },
      },
      {
        kind: 'fertile-window',
        enabled: true,
        hour: 9,
        minute: 0,
        schedule: {
          cadence: 'cycle-event',
          daysBefore: 1,
        },
      },
      {
        kind: 'birth-control',
        enabled: true,
        hour: 21,
        minute: 30,
        schedule: {
          cadence: 'daily',
        },
      },
    ];

    mockScheduleNotificationAsync
      .mockResolvedValueOnce('reminder-daily-log')
      .mockResolvedValueOnce('reminder-period-start')
      .mockResolvedValueOnce('reminder-fertile-window')
      .mockResolvedValueOnce('reminder-birth-control');

    await reconcileReminderNotifications({
      todayIso: '2026-04-20',
      profile,
      logEntries,
      preferences,
    });

    const sensitiveTerms =
      /period|fertile|ovulat|birth[- ]?control|contracept|cycle|symptom|mood|cramp|bleed/i;

    for (const [request] of mockScheduleNotificationAsync.mock.calls) {
      expect(request.content.title).not.toMatch(sensitiveTerms);
      expect(request.content.body).not.toMatch(sensitiveTerms);
    }
  });

  it('cancels user reminder identifiers without clearing the billing reminder', async () => {
    await cancelAllReminderNotifications();

    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('reminder-daily-log');
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('reminder-period-start');
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'reminder-fertile-window',
    );
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'reminder-birth-control',
    );
    expect(mockCancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
      BILLING_REMINDER_NOTIFICATION_IDENTIFIER,
    );
  });

  it('schedules a first-charge reminder three days before the stored first charge date', async () => {
    const dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-06-01T12:00:00.000Z').getTime());

    try {
      const billingSnapshot: BillingSnapshot = {
        accessState: 'trial_active',
        planId: 'annual',
        firstChargeAt: '2026-06-09T10:00:00.000Z',
      };

      mockScheduleNotificationAsync.mockResolvedValueOnce(
        BILLING_REMINDER_NOTIFICATION_IDENTIFIER,
      );

      await expect(
        reconcileBillingReminderNotification({
          snapshot: billingSnapshot,
        }),
      ).resolves.toBe(BILLING_REMINDER_NOTIFICATION_IDENTIFIER);

      expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith(
        BILLING_REMINDER_NOTIFICATION_IDENTIFIER,
      );
      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: BILLING_REMINDER_NOTIFICATION_IDENTIFIER,
          trigger: expect.objectContaining({
            type: 'date',
            channelId: REMINDER_NOTIFICATION_CHANNEL_ID,
          }),
        }),
      );

      const billingReminderRequest = mockScheduleNotificationAsync.mock.calls.find(
        ([request]) => request.identifier === BILLING_REMINDER_NOTIFICATION_IDENTIFIER,
      )?.[0];

      expect(billingReminderRequest).toBeDefined();
      expectLocalTriggerDate(billingReminderRequest.trigger.date, {
        year: 2026,
        month: 6,
        day: 6,
        hour: 9,
        minute: 0,
      });
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('cancels the first-charge reminder instead of scheduling when no future first charge exists', async () => {
    await expect(
      reconcileBillingReminderNotification({
        snapshot: {
          accessState: 'needs_purchase',
        },
      }),
    ).resolves.toBeNull();

    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith(
      BILLING_REMINDER_NOTIFICATION_IDENTIFIER,
    );
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('skips scheduling a past-due first-charge reminder after a late restore', async () => {
    const dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-05-08T12:00:00.000Z').getTime());

    try {
      await expect(
        reconcileBillingReminderNotification({
          snapshot: {
            accessState: 'trial_active',
            planId: 'annual',
            firstChargeAt: '2026-05-09T10:00:00.000Z',
          },
        }),
      ).resolves.toBeNull();

      expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith(
        BILLING_REMINDER_NOTIFICATION_IDENTIFIER,
      );
      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('cancels the billing reminder directly during destructive cleanup', async () => {
    await cancelBillingReminderNotification();

    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith(
      BILLING_REMINDER_NOTIFICATION_IDENTIFIER,
    );
  });

  it('cancels user and billing reminders during all-local-notification cleanup', async () => {
    await cancelAllLocalNotifications();

    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('reminder-daily-log');
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith(
      BILLING_REMINDER_NOTIFICATION_IDENTIFIER,
    );
  });
});
