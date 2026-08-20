/**
 * Adversarial tests for reminderScheduler — specifically
 * reconcileBillingReminderNotification and the first-charge reminder date
 * integration with buildFirstChargeReminderDate.
 *
 * These fixtures cover: null/empty snapshots, no-trial scenarios, invalid
 * firstChargeAt, and timezone-sensitive reminder scheduling.
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
import type { BillingSnapshot } from '@/src/types/domain';

// eslint-disable-next-line import/first
import {
  BILLING_REMINDER_NOTIFICATION_IDENTIFIER,
  REMINDER_NOTIFICATION_CHANNEL_ID,
  reconcileBillingReminderNotification,
} from '@/src/lib/notifications/reminderScheduler';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function snap(overrides: Partial<BillingSnapshot>): BillingSnapshot {
  return { accessState: 'needs_purchase', ...overrides } as BillingSnapshot;
}

describe('reconcileBillingReminderNotification — adversarial inputs', () => {
  beforeEach(() => {
    mockGetPermissionsAsync.mockReset();
    mockRequestPermissionsAsync.mockReset();
    mockSetNotificationChannelAsync.mockReset();
    mockCancelScheduledNotificationAsync.mockReset();
    mockScheduleNotificationAsync.mockReset();
  });

  // ── No firstChargeAt ──────────────────────────────────────────────────────

  it('cancels and returns null for needs_purchase with no firstChargeAt', async () => {
    const result = await reconcileBillingReminderNotification({
      snapshot: snap({ accessState: 'needs_purchase' }),
    });

    expect(result).toBeNull();
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith(
      BILLING_REMINDER_NOTIFICATION_IDENTIFIER,
    );
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('cancels and returns null for a subscribed lifetime snapshot with a firstChargeAt', async () => {
    const result = await reconcileBillingReminderNotification({
      snapshot: snap({
        accessState: 'subscribed',
        planId: 'lifetime',
        firstChargeAt: '2026-12-01T10:00:00.000Z',
      }),
    });

    expect(result).toBeNull();
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith(
      BILLING_REMINDER_NOTIFICATION_IDENTIFIER,
    );
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('cancels and returns null for a subscribed annual snapshot without firstChargeAt', async () => {
    const result = await reconcileBillingReminderNotification({
      snapshot: snap({ accessState: 'subscribed', planId: 'annual' }),
    });

    expect(result).toBeNull();
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('cancels and returns null for an expired snapshot even when firstChargeAt is set', async () => {
    const dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-06-10T12:00:00.000Z').getTime());

    try {
      // firstChargeAt in the past → reminder date would be in the past → null
      const result = await reconcileBillingReminderNotification({
        snapshot: snap({
          accessState: 'expired',
          planId: 'annual',
          firstChargeAt: '2026-05-01T10:00:00.000Z',
        }),
      });

      expect(result).toBeNull();
      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  // ── Invalid firstChargeAt ─────────────────────────────────────────────────

  it('does not crash and cancels without scheduling when firstChargeAt is not a valid date string', async () => {
    await expect(
      reconcileBillingReminderNotification({
        snapshot: snap({
          accessState: 'trial_active',
          planId: 'annual',
          firstChargeAt: 'not-a-date',
        }),
      }),
    ).resolves.toBeNull();

    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith(
      BILLING_REMINDER_NOTIFICATION_IDENTIFIER,
    );
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  // ── Timezone: early-UTC firstChargeAt must produce correct local day ───────
  //
  // This exercises the fix for the timezone off-by-one bug:
  // a firstChargeAt at 01:00 UTC is still the same UTC calendar day but may
  // be the previous local day in UTC-4.  The scheduler must fire 3 local days
  // before the UTC charge date, not 4.

  it('schedules the reminder on the correct local day when firstChargeAt is at 01:00 UTC', async () => {
    // Mock Date.now() to be well before the reminder date
    const dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-05-01T12:00:00.000Z').getTime());

    try {
      mockScheduleNotificationAsync.mockResolvedValueOnce(BILLING_REMINDER_NOTIFICATION_IDENTIFIER);

      await reconcileBillingReminderNotification({
        snapshot: snap({
          accessState: 'trial_active',
          planId: 'annual',
          // Charge on May 9 UTC at 01:00 — previous local day in UTC-4
          firstChargeAt: '2026-05-09T01:00:00.000Z',
        }),
      });

      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: BILLING_REMINDER_NOTIFICATION_IDENTIFIER,
          trigger: expect.objectContaining({
            type: 'date',
            channelId: REMINDER_NOTIFICATION_CHANNEL_ID,
          }),
        }),
      );

      const call = mockScheduleNotificationAsync.mock.calls[0]?.[0];
      expect(call).toBeDefined();
      const triggerDate: Date = call.trigger.date;

      // The reminder date must be on the 6th of May local time (UTC charge date
      // May 9, minus 3 lead days = May 6), not May 5.
      expect(triggerDate.getDate()).toBe(6);
      expect(triggerDate.getMonth()).toBe(4); // May (0-indexed)
      expect(triggerDate.getHours()).toBe(9);
      expect(triggerDate.getMinutes()).toBe(0);
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  // ── Reminder date in the past → cancel without scheduling ────────────────

  it('cancels without scheduling when the reminder date has already passed', async () => {
    // Now is May 8; charge was May 9; reminder would be May 6 — already past.
    const dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-05-08T12:00:00.000Z').getTime());

    try {
      const result = await reconcileBillingReminderNotification({
        snapshot: snap({
          accessState: 'trial_active',
          planId: 'monthly',
          firstChargeAt: '2026-05-09T10:00:00.000Z',
        }),
      });

      expect(result).toBeNull();
      expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith(
        BILLING_REMINDER_NOTIFICATION_IDENTIFIER,
      );
      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  // ── Reminder always cancels first, even on error paths ────────────────────

  it('always cancels the existing reminder before any scheduling attempt', async () => {
    await reconcileBillingReminderNotification({
      snapshot: snap({ accessState: 'needs_purchase' }),
    });

    // Cancel must be called regardless of whether scheduling follows
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith(
      BILLING_REMINDER_NOTIFICATION_IDENTIFIER,
    );
  });
});
