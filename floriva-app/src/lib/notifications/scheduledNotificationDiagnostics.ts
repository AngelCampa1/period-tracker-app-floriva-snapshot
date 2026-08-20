import * as Notifications from 'expo-notifications';

export type ScheduledNotificationDiagnostic = {
  identifier: string;
  title: string;
  body: string;
  trigger: {
    type: string;
    channelId: string | null;
    date: string | null;
    hour: number | null;
    minute: number | null;
    seconds: number | null;
    repeats: boolean | null;
  };
};

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function normalizeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

function normalizeDate(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return typeof value === 'string' ? value : null;
}

function readTriggerValue(trigger: unknown, key: string) {
  return trigger && typeof trigger === 'object'
    ? (trigger as Record<string, unknown>)[key]
    : undefined;
}

function normalizeTrigger(trigger: unknown): ScheduledNotificationDiagnostic['trigger'] {
  return {
    type: normalizeString(readTriggerValue(trigger, 'type')),
    channelId: normalizeString(readTriggerValue(trigger, 'channelId')) || null,
    date: normalizeDate(readTriggerValue(trigger, 'date')),
    hour: normalizeNumber(readTriggerValue(trigger, 'hour')),
    minute: normalizeNumber(readTriggerValue(trigger, 'minute')),
    seconds: normalizeNumber(readTriggerValue(trigger, 'seconds')),
    repeats: normalizeBoolean(readTriggerValue(trigger, 'repeats')),
  };
}

export async function readScheduledNotificationDiagnostics(): Promise<
  ScheduledNotificationDiagnostic[]
> {
  const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();

  return scheduledNotifications
    .filter((notification) => notification.identifier.startsWith('reminder-'))
    .map((notification) => ({
      identifier: notification.identifier,
      title: normalizeString(notification.content.title),
      body: normalizeString(notification.content.body),
      trigger: normalizeTrigger(notification.trigger),
    }))
    .sort((left, right) => left.identifier.localeCompare(right.identifier));
}
