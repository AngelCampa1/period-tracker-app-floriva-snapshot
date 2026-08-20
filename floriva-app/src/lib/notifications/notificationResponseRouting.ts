import { buildCalendarDayRoute } from '@/src/features/app-shell/resolveAppEntry';
import type { CalendarDayRoute } from '@/src/types/domain';

/**
 * Pure routing logic for turning a tapped local notification into an in-app
 * navigation target.
 *
 * Dispatch key: today, scheduled notification `content` only carries
 * `{ title, body }` (see reminderScheduler.ts / buildReminderPlans.ts) — no
 * `data` payload is attached. That means the only reliable identifying
 * signal on a NotificationResponse is `notification.request.identifier`
 * (one of the `reminder-*` identifiers scheduled by reminderScheduler.ts).
 * We therefore dispatch on the identifier string. `content.data` is still
 * accepted on the shape below for forward-compatibility (a future slice may
 * start attaching a `kind` payload), but nothing reads it yet — do not
 * assume it is populated.
 *
 * Occurrence suffix: LT-05 pre-schedules a horizon of future occurrences for
 * cycle-event reminder kinds (period-start, fertile-window). Occurrence 1
 * keeps the bare identifier (e.g. `reminder-period-start`); occurrences 2..N
 * carry a `#n` suffix (e.g. `reminder-period-start#2`) — see
 * REMINDER_OCCURRENCE_HORIZON in buildReminderPlans.ts. Whichever occurrence
 * actually fires and gets tapped should route the same way, so the suffix is
 * stripped before matching against the known identifier sets below.
 *
 * Action identifiers: `actionIdentifier` is branched on for the "Quick log"
 * action registered on the `florivaLog` category (see
 * registerNotificationCategories.ts). Tapping "Quick log" on a calendar-day
 * intent notification (reminder-daily-log / reminder-period-start) routes to
 * the calendar day with `?quick=period` appended, which pre-selects medium
 * flow on the logging screen without auto-saving. Every other action
 * identifier (including the default plain-tap identifier and the "Open"
 * quick action) routes the same as a plain tap.
 */
export type NotificationResponseLike = {
  notification: {
    request: {
      identifier: string;
      content?: {
        data?: Record<string, unknown> | null;
      } | null;
    };
  };
  actionIdentifier?: string;
};

export type NotificationRoute = CalendarDayRoute | '/today';

const CALENDAR_DAY_INTENT_IDENTIFIERS = new Set(['reminder-daily-log', 'reminder-period-start']);

// Action identifier for the discreet "Quick log" notification action
// registered on the florivaLog category. See
// registerNotificationCategories.ts for registration and
// buildReminderPlans.ts for which reminder kinds carry that category.
export const QUICK_LOG_PERIOD_ACTION_IDENTIFIER = 'quick-log-period';

/**
 * Resolves the in-app route a tapped notification should land on.
 *
 * Returns `null` only when navigating would be wrong or impossible:
 *  - `response` is null/undefined (cold-start "no notification launched the
 *    app" case — nothing to route from).
 *  - the identifier is missing, not a string, or an empty string (no way to
 *    know what was tapped).
 *  - `todayIso` is empty (would otherwise build a broken `/calendar/day/`
 *    href with no date segment).
 *
 * An unrecognized-but-well-formed identifier is NOT malformed — it falls
 * through to the default `/today` route, same as the other known
 * non-calendar-day identifiers.
 */
export function resolveNotificationRoute(
  response: NotificationResponseLike | null | undefined,
  todayIso: string,
): NotificationRoute | null {
  if (!response) {
    return null;
  }

  const rawIdentifier = response.notification?.request?.identifier;

  if (typeof rawIdentifier !== 'string' || rawIdentifier.length === 0) {
    return null;
  }

  if (!todayIso) {
    return null;
  }

  // Strip a trailing `#n` occurrence suffix (LT-05) so occurrence 2, 3, ...
  // of a cycle-event reminder route identically to occurrence 1.
  const identifier = rawIdentifier.replace(/#\d+$/, '');

  if (!CALENDAR_DAY_INTENT_IDENTIFIERS.has(identifier)) {
    // Everything else recognized (reminder-fertile-window,
    // reminder-birth-control, reminder-first-charge) as well as any
    // unrecognized identifier falls back to the default landing route. The
    // quick-log action is only ever registered on calendar-day intents, so
    // it is not checked here.
    return '/today';
  }

  if (response.actionIdentifier === QUICK_LOG_PERIOD_ACTION_IDENTIFIER) {
    return `${buildCalendarDayRoute(todayIso)}?quick=period`;
  }

  return buildCalendarDayRoute(todayIso);
}
