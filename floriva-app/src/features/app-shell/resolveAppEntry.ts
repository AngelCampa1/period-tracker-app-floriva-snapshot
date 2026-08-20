import type { AppShellState, CalendarDayRoute } from '@/src/types/domain';

const CALENDAR_DAY_ROUTE_PREFIX = '/calendar/day/';

/**
 * Builds the `/calendar/day/{dateIso}` route string. This is the single
 * source of truth for that route shape — notificationResponseRouting.ts,
 * this file's own prefix constant, and CalendarDayScreen's self-clear all
 * derive from it instead of re-spelling the literal, so a future change to
 * the route shape (e.g. adding a query param) only has to happen here.
 */
export function buildCalendarDayRoute(dateIso: string): CalendarDayRoute {
  return `${CALENDAR_DAY_ROUTE_PREFIX}${dateIso}`;
}

/**
 * Notification-tap handoffs park a `/calendar/day/{date}` route on
 * `pendingEntryRoute`. Requires a non-empty date segment — the bare prefix
 * would navigate to a broken route and is treated as not-a-calendar-day.
 */
export function isCalendarDayEntryRoute(
  route: string | undefined,
): route is CalendarDayRoute {
  return (
    typeof route === 'string' &&
    route.startsWith(CALENDAR_DAY_ROUTE_PREFIX) &&
    route.length > CALENDAR_DAY_ROUTE_PREFIX.length
  );
}

export function isBillingManagementPath(pathname: string) {
  return (
    pathname === '/subscribe' ||
    pathname === '/import' ||
    pathname.startsWith('/import/') ||
    pathname === '/settings' ||
    pathname.startsWith('/settings/') ||
    pathname === '/privacy' ||
    pathname === '/backup' ||
    pathname.startsWith('/backup/')
  );
}

export function resolveAppEntry(state: AppShellState) {
  // Onboarding no longer has a billing step, so an incomplete draft always
  // resumes at the start of the flow rather than at the retired paywall.
  if (!state.hasCompletedOnboarding) {
    return '/welcome';
  }

  if (state.isLocked) {
    return '/lock';
  }

  // The paid access gate is retired (Floriva is free), so there is no longer a
  // branch that diverts a completed, unlocked user to `/subscribe`.

  if (state.pendingEntryRoute && isBillingManagementPath(state.pendingEntryRoute)) {
    return state.pendingEntryRoute;
  }

  if (state.pendingEntryRoute) {
    return state.pendingEntryRoute;
  }

  if (state.mainAppReady) {
    return '/today';
  }

  return '/today';
}
