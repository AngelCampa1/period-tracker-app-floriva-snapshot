import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';

import type { DomainRepositories } from '@/src/db/contracts';
import { getLocalTodayLogDate } from '@/src/features/logging/date';
import { resolveNotificationRoute } from '@/src/lib/notifications/notificationResponseRouting';
import { registerNotificationCategories } from '@/src/lib/notifications/registerNotificationCategories';
import { resolveCurrentLocale } from '@/src/localization/locale';
import { subscribeToLocalePreferenceChanges } from '@/src/localization/localePreferenceSync';
import type { PendingEntryRouteSource } from '@/src/types/domain';

type UseNotificationSetupOptions = {
  repositories: Pick<DomainRepositories, 'appPreferences'>;
  isHydrated: boolean;
  // Captured at mount: the listener and cold-start effects below are
  // deliberately mount-only, so they close over the first onNotificationRoute
  // they see. Callers must pass a closure that never goes stale — e.g. one
  // that uses the functional setState pattern — rather than one that reads
  // captured render-scope state.
  onNotificationRoute: (
    route: NonNullable<ReturnType<typeof resolveNotificationRoute>>,
    source: PendingEntryRouteSource,
  ) => void;
};

/**
 * Owns every effect in AppShellProvider that deals with local notifications:
 * category registration (re-run on locale-preference change), the live
 * notification-tap listener, and the cold-start launch check. Extracted
 * verbatim out of AppShellProvider — no behavior change, same effects, same
 * dependencies, same guards.
 */
export function useNotificationSetup({
  repositories,
  isHydrated,
  onNotificationRoute,
}: UseNotificationSetupOptions) {
  const appPreferencesRepository = repositories.appPreferences;

  // Notification quick-action category registration. Runtime-only (no config
  // plugin, no native rebuild): registers the `florivaLog` category with
  // localized "Quick log" / "Open" action titles via
  // Notifications.setNotificationCategoryAsync. Registration itself is
  // fire-and-forget and error-swallowing (see registerNotificationCategories),
  // so this effect never blocks app startup or surfaces a hydration error.
  //
  // Floriva supports runtime locale switching (LocalizationProvider /
  // localePreferenceSync), so registering once at cold start is not enough —
  // this re-registers whenever a locale-preference change is broadcast, in
  // addition to the initial registration on mount.
  useEffect(() => {
    let isCancelled = false;

    async function registerForCurrentLocale() {
      try {
        const locale = await resolveCurrentLocale(appPreferencesRepository);

        if (!isCancelled) {
          await registerNotificationCategories(locale);
        }
      } catch {
        // Best-effort, same as registerNotificationCategories itself: a
        // failure to read the persisted locale preference (or any other
        // unexpected error) must never surface as a hydration failure or
        // block startup. Category registration is a nice-to-have.
      }
    }

    void registerForCurrentLocale();

    const unsubscribe = subscribeToLocalePreferenceChanges(() => {
      void registerForCurrentLocale();
    });

    return () => {
      isCancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Notification-tap routing: registers the live tap listener on mount, and
  // separately checks for a cold-start launch (app opened by tapping a
  // notification). Both paths route through the same pure
  // resolveNotificationRoute helper (via applyNotificationResponse below) and
  // land on the ephemeral, in-memory pendingEntryRoute — never persisted to
  // SecureStore, since this isn't the onboarding handoff flow. This effect
  // intentionally does not read state.isLocked: AppShellRouteGuard is what
  // defers the actual navigation until the shell unlocks.
  function applyNotificationResponse(
    response: Parameters<typeof resolveNotificationRoute>[0],
  ) {
    const todayIso = getLocalTodayLogDate();
    const route = resolveNotificationRoute(response, todayIso);

    if (route) {
      onNotificationRoute(route, 'notification');
    }
  }

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      applyNotificationResponse(response as Parameters<typeof resolveNotificationRoute>[0]);
    });

    return () => {
      subscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cold-start check: hydration performs a wholesale setState() once its
  // repositories resolve, which would clobber a pendingEntryRoute set by the
  // effect above if both raced on mount. Waiting for isHydrated avoids that
  // race while still covering the "app launched by tapping a notification"
  // case (Expo persists the last response for us to read here).
  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    let isCancelled = false;

    async function checkColdStartNotificationResponse() {
      try {
        const response = await Notifications.getLastNotificationResponseAsync();

        if (isCancelled || !response) {
          return;
        }

        applyNotificationResponse(response as Parameters<typeof resolveNotificationRoute>[0]);
      } catch {
        // Best-effort: a failure to read the cold-start response should never
        // block app startup.
      }
    }

    checkColdStartNotificationResponse();

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated]);
}
