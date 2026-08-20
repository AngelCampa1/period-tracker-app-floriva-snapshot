import * as Notifications from 'expo-notifications';

import { FLORIVA_LOG_NOTIFICATION_CATEGORY } from '@/src/lib/notifications/buildReminderPlans';
import { QUICK_LOG_PERIOD_ACTION_IDENTIFIER } from '@/src/lib/notifications/notificationResponseRouting';
import { fallbackLocale } from '@/src/localization/config';
import { translate } from '@/src/localization/translations';
import type { SupportedLocale } from '@/src/types/domain';

// "Open" reuses Expo's default plain-tap behavior, so no explicit action
// identifier is required for it to route like a normal tap — but we still
// register a visible, localized "Open" button so both actions read as a
// deliberate choice on the lock screen (iOS shows the default action anyway,
// but registering a labeled one keeps behavior explicit and testable).
const OPEN_ACTION_IDENTIFIER = 'open';

// Registration is idempotent by design (re-calling setNotificationCategoryAsync
// with the same identifier simply replaces the category), so callers don't
// need to guard against calling this more than once.
let lastRegisteredLocale: SupportedLocale | null = null;

/**
 * Registers the `florivaLog` notification category with two discreet
 * actions: "Quick log" (pre-selects medium flow on the calendar-day logging
 * screen via `?quick=period`, see notificationResponseRouting.ts) and "Open"
 * (plain-tap behavior). Action titles are deliberately generic — no period,
 * cycle, or fertility words — because iOS can show quick-action titles on the
 * lock screen depending on notification-preview settings.
 *
 * Locale: Floriva supports runtime locale switching (LocalizationProvider /
 * localePreferenceSync), so this must be re-registered whenever the
 * resolved locale changes — a category registered once at cold start would
 * leave quick-action titles in whatever locale was active at first launch.
 * Callers (AppShellProvider) re-invoke this on every localePreferenceSync
 * notification; `lastRegisteredLocale` short-circuits redundant re-registration
 * work when the resolved locale hasn't actually changed (e.g. an unrelated
 * preference write firing the same sync event).
 *
 * Fire-and-forget: category registration is a nice-to-have (lock-screen
 * quick actions), never something app startup should block or crash on if
 * the platform/OS rejects it, so failures are swallowed here.
 */
export async function registerNotificationCategories(
  locale: SupportedLocale = fallbackLocale,
): Promise<void> {
  if (lastRegisteredLocale === locale) {
    return;
  }

  try {
    await Notifications.setNotificationCategoryAsync(FLORIVA_LOG_NOTIFICATION_CATEGORY, [
      {
        identifier: QUICK_LOG_PERIOD_ACTION_IDENTIFIER,
        buttonTitle: translate(locale, 'notifications.quickActions.quickLog'),
      },
      {
        identifier: OPEN_ACTION_IDENTIFIER,
        buttonTitle: translate(locale, 'notifications.quickActions.open'),
      },
    ]);

    lastRegisteredLocale = locale;
  } catch {
    // Best-effort: quick-action registration failing (unsupported platform,
    // Expo Go without a dev client, etc.) must never block app startup or
    // crash the app. The notification itself still works as a plain tap.
  }
}

// Test-only: lets suites reset the idempotency guard between cases.
export function __resetNotificationCategoryRegistrationForTests() {
  lastRegisteredLocale = null;
}
