const mockGetAllScheduledNotificationsAsync = jest.fn();

jest.mock('expo-notifications', () => ({
  getAllScheduledNotificationsAsync: () => mockGetAllScheduledNotificationsAsync(),
}));

// eslint-disable-next-line import/first
import { readScheduledNotificationDiagnostics } from '@/src/lib/notifications/scheduledNotificationDiagnostics';

describe('scheduledNotificationDiagnostics', () => {
  beforeEach(() => {
    mockGetAllScheduledNotificationsAsync.mockReset();
  });

  it('returns only redacted Floriva reminder scheduling details for e2e diagnostics', async () => {
    mockGetAllScheduledNotificationsAsync.mockResolvedValue([
      {
        identifier: 'unrelated',
        content: {
          title: 'Other app state',
          body: 'Ignored',
          data: { sensitive: 'not returned' },
        },
        trigger: {
          type: 'daily',
          hour: 8,
          minute: 0,
        },
      },
      {
        identifier: 'reminder-period-start',
        content: {
          title: 'Floriva reminder',
          body: 'Open Floriva for a private update.',
          data: { eventDate: '2026-04-25' },
        },
        trigger: {
          type: 'date',
          channelId: 'floriva-reminders',
          date: new Date('2026-04-25T09:00:00.000Z'),
        },
      },
      {
        identifier: 'reminder-daily-log',
        content: {
          title: 'Log today in Floriva',
          body: 'Keep your private history current without sending anything off-device.',
        },
        trigger: {
          type: 'daily',
          channelId: 'floriva-reminders',
          hour: 20,
          minute: 0,
        },
      },
    ]);

    await expect(readScheduledNotificationDiagnostics()).resolves.toEqual([
      {
        identifier: 'reminder-daily-log',
        title: 'Log today in Floriva',
        body: 'Keep your private history current without sending anything off-device.',
        trigger: {
          type: 'daily',
          channelId: 'floriva-reminders',
          date: null,
          hour: 20,
          minute: 0,
          seconds: null,
          repeats: null,
        },
      },
      {
        identifier: 'reminder-period-start',
        title: 'Floriva reminder',
        body: 'Open Floriva for a private update.',
        trigger: {
          type: 'date',
          channelId: 'floriva-reminders',
          date: '2026-04-25T09:00:00.000Z',
          hour: null,
          minute: null,
          seconds: null,
          repeats: null,
        },
      },
    ]);
  });
});
