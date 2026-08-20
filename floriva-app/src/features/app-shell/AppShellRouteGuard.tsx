import { useCallback, useEffect, useRef } from 'react';
import type { Href } from 'expo-router';
import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';

import { useAppShell } from '@/src/features/app-shell/AppShellProvider';
import {
  isCalendarDayEntryRoute,
  resolveAppEntry,
} from '@/src/features/app-shell/resolveAppEntry';
import {
  isAllowedWhileLockedPath,
  resolvePaidAccessGate,
} from '@/src/features/app-shell/resolvePaidAccessGate';

const onboardingRoutes = new Set([
  '/welcome',
  '/privacy-details',
  '/start-path',
  '/basics',
  '/goals',
  '/last-period-start',
  '/cycle-length',
  '/period-length',
  '/cycle-variability',
  '/symptom-logging',
  '/ttc',
  '/ttc-setup',
  '/ttc-expectations',
  '/ttc-preset',
  '/notifications',
  '/setup-later',
  '/paywall',
  '/billing-options',
  '/completion',
  '/import',
  '/restore',
]);

function isOnboardingPath(pathname: string) {
  if (onboardingRoutes.has(pathname)) {
    return true;
  }

  return pathname.startsWith('/import/');
}

export function AppShellRouteGuard() {
  const router = useRouter();
  const pathname = usePathname();
  // Read the dev-only bypass flag from the global params: this guard is
  // mounted at the root layout, where a deep-linked child route's query
  // param (e.g. floriva://backup/export?disableOnboarding=1) is only
  // surfaced globally - useLocalSearchParams is scoped to the root segment
  // and would never see it.
  const { disableOnboarding } = useGlobalSearchParams<{
    disableOnboarding?: string | string[];
  }>();
  const { clearPendingEntryRoute, isHydrated, state } = useAppShell();
  const { hasCompletedOnboarding, isLocked, mainAppReady, pendingEntryRoute, pendingEntryRouteSource } =
    state;
  // Marks a pendingEntryRoute whose push is already in flight, so a state
  // change re-running this effect before the pathname catches up cannot push
  // the same route twice. Re-armed whenever the pending route clears
  // (arrival, screen-side clear, or a fresh tap after consumption).
  const inFlightNotificationRouteRef = useRef<string | null>(null);

  // Notification-tap handoff: a calendar-day pendingEntryRoute, or a '/today'
  // route tagged as having arrived from a notification tap, is consumed here
  // — navigate (push, so back returns to where the user was) and clear it so
  // later entry resolutions can't teleport to a stale day or re-fire a stale
  // push. Called last in the effect below: the lock, onboarding, and
  // paid-access branches there all win, which is what defers a locked or
  // unpaid tap until the shell is actually open.
  //
  // '/today' is deliberately handled differently depending on its source:
  // the onboarding-completion handoff (a PostOnboardingRoute) already has its
  // own screen-side self-clear contract in TodayScreen and must not be
  // force-navigated here — completeOnboarding already lands the user on
  // '/today' via its own state update, so a guard-side push would be a
  // redundant/late second navigation with no source tag to distinguish it
  // from a legitimate notification tap. A '/today' that arrived from a live
  // or cold-start notification tap (pendingEntryRouteSource ===
  // 'notification') has no such initial navigation to piggyback on — without
  // this branch a warm tap on a non-calendar-day reminder (e.g.
  // reminder-fertile-window) while the user is on some other screen would
  // silently park '/today' and never actually take them there. Only the
  // tagged case is pushed; an untagged '/today' is left to its existing
  // self-clear contract, same as every other PostOnboardingRoute.
  const consumePendingNotificationRoute = useCallback(() => {
    const isNotificationToday =
      pendingEntryRoute === '/today' && pendingEntryRouteSource === 'notification';

    if (!isCalendarDayEntryRoute(pendingEntryRoute) && !isNotificationToday) {
      // Nothing pushable pending: re-arm so the next tap navigates even if it
      // targets the same route as a previously consumed one.
      inFlightNotificationRouteRef.current = null;
      return;
    }

    // hasCompletedOnboarding is normally guaranteed here, but the dev-only
    // disableOnboarding bypass can fall through the onboarding block above
    // with onboarding incomplete — keep the tap parked in that case too.
    if (isLocked || resolvePaidAccessGate(state) || !hasCompletedOnboarding) {
      return;
    }

    // usePathname() strips search params, so a query-bearing pending route
    // (the quick-log `/calendar/day/{date}?quick=period` variant) must be
    // compared by its path portion. Comparing the full route here would make
    // an arrival via the lock-exit replace or index redirect fail the
    // equality check and re-push the same screen before the async self-clear
    // lands.
    const pendingPathname = pendingEntryRoute.split('?')[0];

    if (pathname === pendingPathname) {
      // Arrived some other way (lock-exit replace, index redirect): just clear.
      inFlightNotificationRouteRef.current = null;
      void clearPendingEntryRoute();
      return;
    }

    // clearPendingEntryRoute is async (SecureStore first, setState after), so
    // the pending route can survive several effect re-runs after the push. The
    // in-flight marker keeps those re-runs from pushing the same route again.
    if (inFlightNotificationRouteRef.current === pendingEntryRoute) {
      return;
    }

    inFlightNotificationRouteRef.current = pendingEntryRoute;
    router.push(pendingEntryRoute as Href);
    void clearPendingEntryRoute();
  }, [
    clearPendingEntryRoute,
    hasCompletedOnboarding,
    isLocked,
    pathname,
    pendingEntryRoute,
    pendingEntryRouteSource,
    router,
    state,
  ]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const onboardingBypassRequested =
      __DEV__ &&
      (Array.isArray(disableOnboarding)
        ? disableOnboarding[0] === '1'
        : disableOnboarding === '1');

    if (!hasCompletedOnboarding && !onboardingBypassRequested) {
      // Floriva is free: onboarding has no billing step, so a mid-onboarding
      // user is never bounced to the retired paywall. Anyone who lands on a
      // billing surface during onboarding is sent back to the flow instead.
      if (pathname === '/subscribe' || pathname === '/billing-options') {
        router.replace('/welcome');
        return;
      }

      if (!isOnboardingPath(pathname)) {
        router.replace('/welcome');
      }

      return;
    }

    const targetEntry = resolveAppEntry({
      hasCompletedOnboarding,
      isLocked,
      billingAccessState: state.billingAccessState,
      mainAppReady,
      pendingEntryRoute,
    });

    if (isLocked && pathname !== '/lock') {
      router.replace('/lock');
      return;
    }

    if (!isLocked && pathname === '/lock') {
      if (router.canGoBack()) {
        return;
      }

      router.replace(targetEntry);
      return;
    }

    // Full-lock paid-access gate. Dev bypass (disableOnboarding=1) respected.
    if (
      !onboardingBypassRequested &&
      !isLocked &&
      resolvePaidAccessGate(state) &&
      !isAllowedWhileLockedPath(pathname)
    ) {
      router.replace('/subscribe');
      return;
    }

    consumePendingNotificationRoute();
  }, [
    clearPendingEntryRoute,
    consumePendingNotificationRoute,
    disableOnboarding,
    state,
    state.billingAccessState,
    hasCompletedOnboarding,
    isHydrated,
    isLocked,
    mainAppReady,
    pendingEntryRoute,
    pendingEntryRouteSource,
    pathname,
    router,
  ]);

  return null;
}
