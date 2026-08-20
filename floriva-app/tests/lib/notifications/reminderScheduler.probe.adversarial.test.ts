/**
 * Adversarial probe tests for reconcileReminderNotifications in reminderScheduler.ts.
 *
 * These tests target behaviors NOT yet covered by the existing scheduler tests:
 *  - cancel-before-schedule ordering guarantee
 *  - empty plan array produces no scheduleNotificationAsync calls
 *  - channel setup even for empty plans
 *  - trigger type mapping (daily vs date)
 *  - all known reminder identifiers (base + LT-05 occurrence-horizon suffixes)
 *    are always cancelled (not just enabled ones)
 *  - concurrent/idempotent reconcile: second call cancels before re-scheduling
 *  - notification channel is set before scheduling (not after)
 *  - large plan counts: every plan is forwarded
 *  - permission denial: reconcileReminderNotifications does NOT gate on permissions
 *    (the scheduler itself does not call getPermissionsAsync — that is caller's job)
 *  - fertile-window plans are properly forwarded to Expo
 *  - birth-control DAILY trigger carries correct hour/minute
 *  - period-start DATE trigger carries channelId
 *  - scheduleNotificationAsync rejection propagates (Promise.all semantics)
 */

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
import type { DailyLogEntry, ReminderPreference, UserProfile } from '@/src/types/domain';

// eslint-disable-next-line import/first
import { REMINDER_OCCURRENCE_HORIZON } from '@/src/lib/notifications/buildReminderPlans';
// eslint-disable-next-line import/first
import {
  REMINDER_NOTIFICATION_CHANNEL_ID,
  reconcileReminderNotifications,
} from '@/src/lib/notifications/reminderScheduler';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(logDate: string, bleeding: DailyLogEntry['bleeding'] = 'medium'): DailyLogEntry {
  return { id: `${logDate}-${bleeding}`, logDate, bleeding, symptoms: [] };
}

function baseProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    cycleLengthDays: 28,
    periodLengthDays: 5,
    lastPeriodStartDate: '2026-03-28',
    goals: ['period'],
    supportsIrregularCycles: false,
    conditionTags: [],
    ...overrides,
  };
}

function dailyLogPref(overrides: Partial<ReminderPreference> = {}): ReminderPreference {
  return {
    kind: 'daily-log',
    enabled: true,
    hour: 20,
    minute: 0,
    schedule: { cadence: 'daily' },
    ...overrides,
  };
}

function birthControlPref(overrides: Partial<ReminderPreference> = {}): ReminderPreference {
  return {
    kind: 'birth-control',
    enabled: true,
    hour: 21,
    minute: 30,
    schedule: { cadence: 'daily' },
    ...overrides,
  };
}

function periodStartPref(overrides: Partial<ReminderPreference> = {}): ReminderPreference {
  return {
    kind: 'period-start',
    enabled: true,
    hour: 9,
    minute: 0,
    schedule: { cadence: 'cycle-event', daysBefore: 0 },
    ...overrides,
  };
}

function fertileWindowPref(overrides: Partial<ReminderPreference> = {}): ReminderPreference {
  return {
    kind: 'fertile-window',
    enabled: true,
    hour: 9,
    minute: 0,
    schedule: { cadence: 'cycle-event', daysBefore: 0 },
    ...overrides,
  };
}

const TODAY = '2026-04-20';
const BASE_LOGS = [log('2026-02-28', 'heavy'), log('2026-03-28', 'heavy')];

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('reconcileReminderNotifications — adversarial probe', () => {
  beforeEach(() => {
    mockGetPermissionsAsync.mockReset();
    mockRequestPermissionsAsync.mockReset();
    mockSetNotificationChannelAsync.mockReset().mockResolvedValue(undefined);
    mockCancelScheduledNotificationAsync.mockReset().mockResolvedValue(undefined);
    mockScheduleNotificationAsync.mockReset().mockResolvedValue('ok');
  });

  // ── 1. All known identifiers (base + LT-05 occurrence suffixes) are always
  // cancelled ────────────────────────────────────────────────────────────
  // Even when zero preferences are supplied, every base identifier AND every
  // occurrence-horizon suffix must be cancelled so stale OS notifications
  // from a previous session (including a previous, larger horizon) are
  // always cleared. 4 base identifiers * REMINDER_OCCURRENCE_HORIZON
  // possible occurrences each = 4 * 3 = 12.

  it('cancels all known reminder identifiers (including occurrence-horizon suffixes) even when the plan array is empty', async () => {
    await reconcileReminderNotifications({
      todayIso: TODAY,
      profile: baseProfile(),
      logEntries: BASE_LOGS,
      preferences: [],
    });

    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('reminder-daily-log');
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('reminder-period-start');
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('reminder-period-start#2');
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('reminder-period-start#3');
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('reminder-fertile-window');
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('reminder-fertile-window#2');
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('reminder-fertile-window#3');
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('reminder-birth-control');
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledTimes(4 * REMINDER_OCCURRENCE_HORIZON);
  });

  // ── 2. No scheduleNotificationAsync calls when all preferences are disabled ─

  it('schedules nothing when all preferences are disabled', async () => {
    await reconcileReminderNotifications({
      todayIso: TODAY,
      profile: baseProfile(),
      logEntries: BASE_LOGS,
      preferences: [
        dailyLogPref({ enabled: false }),
        periodStartPref({ enabled: false }),
        birthControlPref({ enabled: false }),
      ],
    });

    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  // ── 3. Channel is set up even when no preferences are enabled ─────────────
  // ensureReminderChannel must run regardless, so Android gets the channel
  // registered before any future notifications.

  it('sets up the notification channel even when no preferences are enabled', async () => {
    await reconcileReminderNotifications({
      todayIso: TODAY,
      profile: baseProfile(),
      logEntries: BASE_LOGS,
      preferences: [],
    });

    expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
      REMINDER_NOTIFICATION_CHANNEL_ID,
      expect.objectContaining({ name: 'Floriva reminders' }),
    );
  });

  // ── 4. Cancel happens BEFORE scheduling (ordering guarantee) ──────────────
  // reconcileReminderNotifications awaits cancelAllReminderNotifications before
  // calling scheduleNotificationAsync. Verify ordering via call-order tracking.

  it('cancels all identifiers before scheduling any new notification', async () => {
    const callOrder: string[] = [];
    mockCancelScheduledNotificationAsync.mockImplementation(async () => {
      callOrder.push('cancel');
    });
    mockScheduleNotificationAsync.mockImplementation(async () => {
      callOrder.push('schedule');
      return 'ok';
    });

    await reconcileReminderNotifications({
      todayIso: TODAY,
      profile: baseProfile(),
      logEntries: BASE_LOGS,
      preferences: [dailyLogPref()],
    });

    // Every cancel must precede every schedule
    const firstSchedule = callOrder.indexOf('schedule');
    const lastCancel = callOrder.lastIndexOf('cancel');
    expect(firstSchedule).toBeGreaterThan(-1);
    expect(lastCancel).toBeGreaterThan(-1);
    expect(lastCancel).toBeLessThan(firstSchedule);
  });

  // ── 5. daily-log plan uses DAILY trigger type, not DATE ───────────────────

  it('schedules daily-log with a DAILY trigger (not a DATE trigger)', async () => {
    await reconcileReminderNotifications({
      todayIso: TODAY,
      profile: baseProfile(),
      logEntries: BASE_LOGS,
      preferences: [dailyLogPref({ hour: 8, minute: 15 })],
    });

    const call = mockScheduleNotificationAsync.mock.calls.find(
      ([req]: [{ identifier: string }]) => req.identifier === 'reminder-daily-log',
    )?.[0];

    expect(call).toBeDefined();
    expect(call.trigger.type).toBe('daily');
    expect(call.trigger.hour).toBe(8);
    expect(call.trigger.minute).toBe(15);
    // DATE triggers would have a `date` field; daily triggers must not
    expect(call.trigger.date).toBeUndefined();
  });

  // ── 6. birth-control plan uses DAILY trigger with correct hour/minute ─────

  it('schedules birth-control with a DAILY trigger carrying the correct time', async () => {
    await reconcileReminderNotifications({
      todayIso: TODAY,
      // LT-26: birth-control reminders only schedule when a method is on file.
      profile: baseProfile({ birthControlMethod: 'pill' }),
      logEntries: BASE_LOGS,
      preferences: [birthControlPref({ hour: 21, minute: 30 })],
    });

    const call = mockScheduleNotificationAsync.mock.calls.find(
      ([req]: [{ identifier: string }]) => req.identifier === 'reminder-birth-control',
    )?.[0];

    expect(call).toBeDefined();
    expect(call.trigger.type).toBe('daily');
    expect(call.trigger.hour).toBe(21);
    expect(call.trigger.minute).toBe(30);
    expect(call.trigger.channelId).toBe(REMINDER_NOTIFICATION_CHANNEL_ID);
  });

  // ── 7. period-start DATE trigger includes channelId ───────────────────────

  it('includes channelId in the DATE trigger for a period-start notification', async () => {
    await reconcileReminderNotifications({
      todayIso: TODAY,
      profile: baseProfile(),
      logEntries: BASE_LOGS,
      preferences: [periodStartPref()],
    });

    const call = mockScheduleNotificationAsync.mock.calls.find(
      ([req]: [{ identifier: string }]) => req.identifier === 'reminder-period-start',
    )?.[0];

    expect(call).toBeDefined();
    expect(call.trigger.channelId).toBe(REMINDER_NOTIFICATION_CHANNEL_ID);
    expect(call.trigger.type).toBe('date');
    expect(call.trigger.date).toBeInstanceOf(Date);
  });

  // ── 8. fertile-window plan is forwarded to Expo ──────────────────────────

  it('schedules a fertile-window notification when that preference is enabled', async () => {
    await reconcileReminderNotifications({
      todayIso: TODAY,
      profile: baseProfile(),
      logEntries: BASE_LOGS,
      preferences: [fertileWindowPref()],
    });

    const call = mockScheduleNotificationAsync.mock.calls.find(
      ([req]: [{ identifier: string }]) => req.identifier === 'reminder-fertile-window',
    )?.[0];

    expect(call).toBeDefined();
    expect(call.trigger.type).toBe('date');
    expect(call.trigger.channelId).toBe(REMINDER_NOTIFICATION_CHANNEL_ID);
  });

  // ── 9. Idempotent reconcile: second call also cancels before scheduling ───

  it('cancels-then-schedules correctly on a second consecutive reconcile call', async () => {
    const prefs = [dailyLogPref()];
    const opts = { todayIso: TODAY, profile: baseProfile(), logEntries: BASE_LOGS, preferences: prefs };

    await reconcileReminderNotifications(opts);
    mockCancelScheduledNotificationAsync.mockClear();
    mockScheduleNotificationAsync.mockClear();

    await reconcileReminderNotifications(opts);

    // On the second call, all four must still be cancelled
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('reminder-daily-log');
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('reminder-period-start');
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('reminder-fertile-window');
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('reminder-birth-control');
    // And the one enabled plan is re-scheduled
    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  // ── 10. Reconcile does NOT call getPermissionsAsync or requestPermissionsAsync

  it('does not touch the permission APIs during reconciliation (caller responsibility)', async () => {
    await reconcileReminderNotifications({
      todayIso: TODAY,
      profile: baseProfile(),
      logEntries: BASE_LOGS,
      preferences: [dailyLogPref()],
    });

    expect(mockGetPermissionsAsync).not.toHaveBeenCalled();
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
  });

  // ── 11. scheduleNotificationAsync rejection propagates ───────────────────
  // Promise.all fails fast on the first rejection. A scheduling error must
  // not be silently swallowed.

  it('propagates a scheduleNotificationAsync rejection to the caller', async () => {
    mockScheduleNotificationAsync.mockRejectedValueOnce(new Error('OS scheduling failed'));

    await expect(
      reconcileReminderNotifications({
        todayIso: TODAY,
        profile: baseProfile(),
        logEntries: BASE_LOGS,
        preferences: [dailyLogPref()],
      }),
    ).rejects.toThrow('OS scheduling failed');
  });

  // ── 12. All plans in a multi-preference list are forwarded ────────────────
  // 2 daily-cadence kinds -> 1 scheduled plan each; 2 cycle-event kinds ->
  // REMINDER_OCCURRENCE_HORIZON scheduled plans each (LT-05).

  it('forwards one scheduleNotificationAsync call per daily plan and a full horizon per cycle-event plan', async () => {
    await reconcileReminderNotifications({
      todayIso: TODAY,
      // LT-26: birth-control reminders only schedule when a method is on file.
      profile: baseProfile({ birthControlMethod: 'pill' }),
      logEntries: BASE_LOGS,
      preferences: [
        dailyLogPref(),
        birthControlPref(),
        periodStartPref(),
        fertileWindowPref(),
      ],
    });

    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(2 + 2 * REMINDER_OCCURRENCE_HORIZON);
  });

  // ── 13. Cycle-event reminder whose anchor day equals todayIso is NOT in the past ─
  //
  // buildPredictionResult rolls the anchor forward while the last period is >= one
  // full cycle ago, so when todayIso is exactly the projected next period date the
  // prediction further advances the next period by another full cycle. The net
  // effect is that the scheduled DATE trigger always lands in the future even when
  // todayIso === reminderDate (daysBefore=0).
  //
  // This test confirms that no DATE trigger lands in the past in this scenario.

  it(
    'does not schedule a period-start notification whose trigger date is already in the past',
    async () => {
      // "today" is April 25; next period is also April 25 (daysBefore=0).
      // Requested hour 08:00 has already passed (now is 14:00 local).
      const fakeNow = new Date(2026, 3, 25, 14, 0, 0).getTime(); // April 25 14:00 local
      const spy = jest.spyOn(Date, 'now').mockReturnValue(fakeNow);

      try {
        await reconcileReminderNotifications({
          todayIso: '2026-04-25',
          profile: baseProfile(), // lastPeriodStartDate: 2026-03-28 + 28 = 2026-04-25
          logEntries: [log('2026-03-28', 'heavy')],
          preferences: [periodStartPref({ hour: 8, minute: 0 })],
        });

        // Gather all DATE trigger dates that were forwarded to Expo
        const pastDates = mockScheduleNotificationAsync.mock.calls.filter(
          ([req]: [{ trigger: { type: string; date?: Date } }]) => {
            return req.trigger.type === 'date' && req.trigger.date instanceof Date &&
              req.trigger.date.getTime() <= Date.now();
          },
        );

        // CORRECT behaviour: no past-date trigger should be scheduled
        expect(pastDates).toHaveLength(0);
      } finally {
        spy.mockRestore();
      }
    },
  );

  // ── 14. FIXED: past-date DATE trigger no longer sent to Expo when daysBefore>0 and hour elapsed ─
  //
  // buildReminderPlans advances reminderDate while (reminderDate < todayIso).
  // When reminderDate === todayIso the loop exits, leaving a reminder for today.
  // If the requested hour has already passed, buildLocalTriggerDate returns a Date
  // that is in the past. reconcileReminderNotifications now drops any DATE trigger
  // that lands on todayIso whose time has already elapsed, rather than forwarding
  // it to Expo (which would reject or fire it immediately). The next reconcile
  // (once todayIso advances past the event) rolls it to the following cycle.
  //
  // Correct behaviour: no DATE trigger with a .date <= Date.now() should reach Expo.
  //
  // Repro: nextPeriod = 2026-04-25, daysBefore=3 → reminderDate = 2026-04-22.
  //        todayIso = 2026-04-22, hour=8, now=14:00 → trigger is in the past.

  it(
    'does not forward a past-date DATE trigger when reminder falls on today and the hour has elapsed',
    async () => {
      const fakeNow = new Date(2026, 3, 22, 14, 0, 0).getTime(); // April 22 14:00 local
      const spy = jest.spyOn(Date, 'now').mockReturnValue(fakeNow);

      try {
        await reconcileReminderNotifications({
          todayIso: '2026-04-22',
          profile: baseProfile(), // lastPeriodStartDate: 2026-03-28 + 28 = 2026-04-25
          logEntries: [log('2026-03-28', 'heavy')],
          // daysBefore=3 → reminderDate = 2026-04-22 = todayIso; hour=8 < 14:00 now
          preferences: [periodStartPref({ hour: 8, minute: 0, schedule: { cadence: 'cycle-event', daysBefore: 3 } })],
        });

        const pastDates = mockScheduleNotificationAsync.mock.calls.filter(
          ([req]: [{ trigger: { type: string; date?: Date } }]) =>
            req.trigger.type === 'date' &&
            req.trigger.date instanceof Date &&
            req.trigger.date.getTime() <= Date.now(),
        );

        // CORRECT behaviour: no past-date trigger should reach Expo
        expect(pastDates).toHaveLength(0);
      } finally {
        spy.mockRestore();
      }
    },
  );

  // ── 15. DAILY trigger correctly carries channelId for daily-log ──────────

  it('includes channelId in the DAILY trigger for a daily-log notification', async () => {
    await reconcileReminderNotifications({
      todayIso: TODAY,
      profile: baseProfile(),
      logEntries: BASE_LOGS,
      preferences: [dailyLogPref()],
    });

    const call = mockScheduleNotificationAsync.mock.calls.find(
      ([req]: [{ identifier: string }]) => req.identifier === 'reminder-daily-log',
    )?.[0];

    expect(call).toBeDefined();
    expect(call.trigger.channelId).toBe(REMINDER_NOTIFICATION_CHANNEL_ID);
  });

  // ── 15. Duplicate preferences: only the first is scheduled ───────────────
  // buildReminderPlans deduplicates by identifier. The scheduler must only
  // call scheduleNotificationAsync once for any given identifier.

  it('schedules only one notification when the same kind appears twice in preferences', async () => {
    await reconcileReminderNotifications({
      todayIso: TODAY,
      profile: baseProfile(),
      logEntries: BASE_LOGS,
      preferences: [
        dailyLogPref({ hour: 8, minute: 0 }),
        dailyLogPref({ hour: 9, minute: 0 }), // duplicate kind
      ],
    });

    const dailyLogCalls = mockScheduleNotificationAsync.mock.calls.filter(
      ([req]: [{ identifier: string }]) => req.identifier === 'reminder-daily-log',
    );
    expect(dailyLogCalls).toHaveLength(1);
    // The first preference wins
    expect(dailyLogCalls[0]?.[0].trigger.hour).toBe(8);
  });
});
