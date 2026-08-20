import type { AppShellState } from '@/src/types/domain';

/**
 * Retired gate: Floriva is now free.
 *
 * This used to be a full lock — a user with `needs_purchase` or `expired`
 * access was blocked from the whole app until they subscribed. All Floriva
 * products have since been removed from sale, so no user can purchase their
 * way out of that lock; keeping it would strand people in front of their own
 * on-device cycle data behind a paywall with nothing to buy.
 *
 * The function is retained (rather than deleted at every call site) so the
 * routing contract in `resolveAppEntry` and `AppShellRouteGuard` stays intact
 * and this decision lives in exactly one place.
 */
export function resolvePaidAccessGate(_state: AppShellState): boolean {
  return false;
}

/** Paths a fully-locked user may still reach: billing, settings, lock, and data export. */
export function isAllowedWhileLockedPath(pathname: string): boolean {
  return (
    pathname === '/subscribe' ||
    pathname === '/lock' ||
    pathname === '/settings' ||
    pathname.startsWith('/settings/') ||
    pathname === '/backup' ||
    pathname.startsWith('/backup/')
  );
}
