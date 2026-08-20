import {
  isAllowedWhileLockedPath,
  resolvePaidAccessGate,
} from '@/src/features/app-shell/resolvePaidAccessGate';
import type { AppShellState } from '@/src/types/domain';

function state(partial: Partial<AppShellState>): AppShellState {
  return {
    hasCompletedOnboarding: true,
    isLocked: false,
    billingAccessState: 'needs_purchase',
    mainAppReady: true,
    pendingEntryRoute: undefined,
    ...partial,
  };
}

describe('resolvePaidAccessGate', () => {
  // Floriva is now free: the products are removed from sale and the paid gate is
  // retired. Every access state must resolve to "not locked" — a user whose
  // subscription lapsed would otherwise be stranded in front of their own
  // on-device data with no purchasable product to escape with.
  it.each([
    'needs_purchase',
    'expired',
    'trial_active',
    'subscribed',
    'sync_error',
  ] as const)('never locks a completed user in %s', (billingAccessState) => {
    expect(resolvePaidAccessGate(state({ billingAccessState }))).toBe(false);
  });

  it('never locks a user who has not completed onboarding', () => {
    expect(
      resolvePaidAccessGate(
        state({ hasCompletedOnboarding: false, billingAccessState: 'needs_purchase' }),
      ),
    ).toBe(false);
  });
});

describe('isAllowedWhileLockedPath', () => {
  it.each([
    '/subscribe',
    '/settings',
    '/settings/subscription',
    '/lock',
    '/backup',
    '/backup/export',
  ])('allows %s while locked', (path) => {
    expect(isAllowedWhileLockedPath(path)).toBe(true);
  });
  it.each(['/today', '/calendar', '/insights', '/import', '/import/clue'])(
    'blocks %s while locked',
    (path) => {
      expect(isAllowedWhileLockedPath(path)).toBe(false);
    },
  );
});
