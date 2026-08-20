import { createDefaultAppShellState } from '@/src/features/app-shell/defaults';
import {
  isCalendarDayEntryRoute,
  resolveAppEntry,
} from '@/src/features/app-shell/resolveAppEntry';

describe('resolveAppEntry', () => {
  it('routes new users into onboarding', () => {
    expect(resolveAppEntry(createDefaultAppShellState())).toBe('/welcome');
  });

  it('resumes incomplete onboarding at /welcome for every billing state (paywall step retired)', () => {
    expect(
      resolveAppEntry(
        createDefaultAppShellState({
          hasCompletedOnboarding: false,
          billingAccessState: 'trial_active',
        }),
      ),
    ).toBe('/welcome');

    expect(
      resolveAppEntry(
        createDefaultAppShellState({
          hasCompletedOnboarding: false,
          billingAccessState: 'subscribed',
        }),
      ),
    ).toBe('/welcome');

    expect(
      resolveAppEntry(
        createDefaultAppShellState({
          hasCompletedOnboarding: false,
          billingAccessState: 'needs_purchase',
        }),
      ),
    ).toBe('/welcome');
  });

  it('routes locked users into the privacy lock screen', () => {
    expect(
      resolveAppEntry(
        createDefaultAppShellState({
          hasCompletedOnboarding: true,
          isLocked: true,
        }),
      ),
    ).toBe('/lock');
  });

  it('routes an onboarded user with no purchase into the tracker shell (app is free)', () => {
    expect(
      resolveAppEntry(
        createDefaultAppShellState({
          hasCompletedOnboarding: true,
          isLocked: false,
          billingAccessState: 'needs_purchase',
          mainAppReady: false,
        }),
      ),
    ).toBe('/today');
  });

  it('routes an onboarded user with expired access into the tracker shell (app is free)', () => {
    expect(
      resolveAppEntry(
        createDefaultAppShellState({
          hasCompletedOnboarding: true,
          isLocked: false,
          billingAccessState: 'expired',
          mainAppReady: false,
        }),
      ),
    ).toBe('/today');
  });

  it('routes a completed formerly-unpaid user into the tracker shell (app is free)', () => {
    expect(
      resolveAppEntry(
        createDefaultAppShellState({
          hasCompletedOnboarding: true,
          isLocked: false,
          billingAccessState: 'expired',
          mainAppReady: true,
          pendingEntryRoute: undefined,
        }),
      ),
    ).toBe('/today');
  });

  it('still routes a locked (biometric) unpaid user to /lock first', () => {
    expect(
      resolveAppEntry(
        createDefaultAppShellState({
          hasCompletedOnboarding: true,
          isLocked: true,
          billingAccessState: 'expired',
          mainAppReady: false,
          pendingEntryRoute: undefined,
        }),
      ),
    ).toBe('/lock');
  });

  it('routes a trialing user to /today', () => {
    expect(
      resolveAppEntry(
        createDefaultAppShellState({
          hasCompletedOnboarding: true,
          isLocked: false,
          billingAccessState: 'trial_active',
          mainAppReady: true,
          pendingEntryRoute: undefined,
        }),
      ),
    ).toBe('/today');
  });

  it('resumes a persisted import-next handoff regardless of billing access', () => {
    expect(
      resolveAppEntry(
        createDefaultAppShellState({
          hasCompletedOnboarding: true,
          isLocked: false,
          billingAccessState: 'needs_purchase',
          mainAppReady: true,
          pendingEntryRoute: '/import',
        }),
      ),
    ).toBe('/import');
  });

  it('resumes a persisted billing-management handoff once billing access is active', () => {
    expect(
      resolveAppEntry(
        createDefaultAppShellState({
          hasCompletedOnboarding: true,
          isLocked: false,
          billingAccessState: 'trial_active',
          mainAppReady: true,
          pendingEntryRoute: '/import',
        }),
      ),
    ).toBe('/import');
  });

  it('resumes a persisted backup restore handoff regardless of billing access', () => {
    expect(
      resolveAppEntry(
        createDefaultAppShellState({
          hasCompletedOnboarding: true,
          isLocked: false,
          billingAccessState: 'needs_purchase',
          mainAppReady: true,
          pendingEntryRoute: '/backup/restore',
        }),
      ),
    ).toBe('/backup/restore');
  });

  it('resumes tracker handoffs regardless of billing access', () => {
    expect(
      resolveAppEntry(
        createDefaultAppShellState({
          hasCompletedOnboarding: true,
          isLocked: false,
          billingAccessState: 'needs_purchase',
          mainAppReady: true,
          pendingEntryRoute: '/today',
        }),
      ),
    ).toBe('/today');
  });

  it('routes trial users into the tracker shell', () => {
    expect(
      resolveAppEntry(
        createDefaultAppShellState({
          hasCompletedOnboarding: true,
          isLocked: false,
          billingAccessState: 'trial_active',
          mainAppReady: false,
        }),
      ),
    ).toBe('/today');
  });

  it('routes subscribed users into the tracker shell', () => {
    expect(
      resolveAppEntry(
        createDefaultAppShellState({
          hasCompletedOnboarding: true,
          isLocked: false,
          billingAccessState: 'subscribed',
          mainAppReady: false,
        }),
      ),
    ).toBe('/today');
  });

  it('respects a pending entry route before deciding whether the main shell is ready', () => {
    expect(
      resolveAppEntry(
        createDefaultAppShellState({
          hasCompletedOnboarding: true,
          isLocked: false,
          billingAccessState: 'subscribed',
          mainAppReady: false,
          pendingEntryRoute: '/import',
        }),
      ),
    ).toBe('/import');
  });

  it('keeps preview builds with missing billing config in the tracker shell', () => {
    expect(
      resolveAppEntry(
        createDefaultAppShellState({
          hasCompletedOnboarding: true,
          isLocked: false,
          billingAccessState: 'sync_error',
          pendingEntryRoute: '/today',
        }),
      ),
    ).toBe('/today');
  });

  it('resumes a pending notification calendar-day handoff once billing access is active', () => {
    expect(
      resolveAppEntry(
        createDefaultAppShellState({
          hasCompletedOnboarding: true,
          isLocked: false,
          billingAccessState: 'subscribed',
          mainAppReady: true,
          pendingEntryRoute: '/calendar/day/2026-07-06',
        }),
      ),
    ).toBe('/calendar/day/2026-07-06');
  });

  it('still routes a locked user to /lock ahead of a pending calendar-day handoff', () => {
    expect(
      resolveAppEntry(
        createDefaultAppShellState({
          hasCompletedOnboarding: true,
          isLocked: true,
          billingAccessState: 'subscribed',
          mainAppReady: false,
          pendingEntryRoute: '/calendar/day/2026-07-06',
        }),
      ),
    ).toBe('/lock');
  });

  it('resumes a pending calendar-day handoff regardless of billing access', () => {
    expect(
      resolveAppEntry(
        createDefaultAppShellState({
          hasCompletedOnboarding: true,
          isLocked: false,
          billingAccessState: 'needs_purchase',
          mainAppReady: true,
          pendingEntryRoute: '/calendar/day/2026-07-06',
        }),
      ),
    ).toBe('/calendar/day/2026-07-06');
  });

});

describe('isCalendarDayEntryRoute', () => {
  it('accepts calendar day routes with a date segment', () => {
    expect(isCalendarDayEntryRoute('/calendar/day/2026-07-06')).toBe(true);
  });

  it('rejects the bare calendar day prefix without a date segment', () => {
    expect(isCalendarDayEntryRoute('/calendar/day/')).toBe(false);
  });

  it('rejects non-calendar entry routes', () => {
    expect(isCalendarDayEntryRoute('/today')).toBe(false);
    expect(isCalendarDayEntryRoute('/import')).toBe(false);
    expect(isCalendarDayEntryRoute('/calendar')).toBe(false);
    expect(isCalendarDayEntryRoute('/backup/restore')).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isCalendarDayEntryRoute(undefined)).toBe(false);
  });
});
