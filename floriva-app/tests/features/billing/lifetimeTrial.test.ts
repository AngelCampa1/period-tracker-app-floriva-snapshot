import {
  buildLifetimeTrialSnapshot,
  isLifetimeTransitionAllowed,
  isLifetimeTrialEligible,
  LIFETIME_TRIAL_MONTHS,
} from '@/src/features/billing/lifetimeTrial';
import type { BillingSnapshot } from '@/src/types/domain';

const base: BillingSnapshot = { accessState: 'needs_purchase' };

describe('LIFETIME_TRIAL_MONTHS', () => {
  it('is a one-month window to match the subscription trial length', () => {
    expect(LIFETIME_TRIAL_MONTHS).toBe(1);
  });
});

describe('buildLifetimeTrialSnapshot', () => {
  const now = new Date('2026-07-08T12:00:00.000Z');

  it('grants a one-month lifetime trial anchored to now', () => {
    const result = buildLifetimeTrialSnapshot({ snapshot: base, now });

    expect(result.accessState).toBe('trial_active');
    expect(result.planId).toBe('lifetime');
    expect(result.trialEndsAt).toBe('2026-08-08T12:00:00.000Z');
    expect(result.lifetimeTrialStartedAt).toBe(now.toISOString());
  });

  it.each([
    {
      label: 'a normal target-month date',
      now: new Date(2026, 2, 15, 14, 23, 45, 678),
      expected: { year: 2026, month: 3, day: 15 },
    },
    {
      label: 'January 31 in a common year',
      now: new Date(2025, 0, 31, 14, 23, 45, 678),
      expected: { year: 2025, month: 1, day: 28 },
    },
    {
      label: 'January 31 in a leap year',
      now: new Date(2024, 0, 31, 14, 23, 45, 678),
      expected: { year: 2024, month: 1, day: 29 },
    },
    {
      label: 'August 31',
      now: new Date(2026, 7, 31, 14, 23, 45, 678),
      expected: { year: 2026, month: 8, day: 30 },
    },
  ])('clamps $label while preserving the local clock time', ({ now, expected }) => {
    const result = buildLifetimeTrialSnapshot({ snapshot: base, now });
    const trialEnd = new Date(result.trialEndsAt!);

    expect({
      year: trialEnd.getFullYear(),
      month: trialEnd.getMonth(),
      day: trialEnd.getDate(),
    }).toEqual(expected);
    expect({
      hours: trialEnd.getHours(),
      minutes: trialEnd.getMinutes(),
      seconds: trialEnd.getSeconds(),
      milliseconds: trialEnd.getMilliseconds(),
    }).toEqual({
      hours: now.getHours(),
      minutes: now.getMinutes(),
      seconds: now.getSeconds(),
      milliseconds: now.getMilliseconds(),
    });
  });

  it('clears recurring-only billing metadata because there is no auto-charge', () => {
    const result = buildLifetimeTrialSnapshot({
      snapshot: {
        ...base,
        firstChargeAt: '2026-08-08T12:00:00.000Z',
        expiresAt: '2026-08-08T12:00:00.000Z',
        reminderScheduledFor: '2026-08-05T14:00:00.000Z',
      },
      now,
    });

    expect(result.firstChargeAt).toBeUndefined();
    expect(result.expiresAt).toBeUndefined();
    expect(result.reminderScheduledFor).toBeUndefined();
  });

  it('preserves unrelated durable snapshot fields', () => {
    const result = buildLifetimeTrialSnapshot({
      snapshot: { ...base, saveOfferRedeemedAt: '2026-01-01T00:00:00.000Z' },
      now,
    });

    expect(result.saveOfferRedeemedAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('isLifetimeTrialEligible', () => {
  it('is eligible for a fresh user who has never started the lifetime trial', () => {
    expect(isLifetimeTrialEligible(base)).toBe(true);
  });

  it('is not eligible once the lifetime trial has been started', () => {
    expect(
      isLifetimeTrialEligible({
        accessState: 'trial_active',
        planId: 'lifetime',
        lifetimeTrialStartedAt: '2026-07-08T12:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('remains ineligible after an unused lifetime trial has expired', () => {
    expect(
      isLifetimeTrialEligible({
        accessState: 'expired',
        planId: 'lifetime',
        lifetimeTrialStartedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('is not eligible for a user who already owns lifetime', () => {
    expect(
      isLifetimeTrialEligible({ accessState: 'subscribed', planId: 'lifetime' }),
    ).toBe(false);
  });

  it('is not eligible for a user subscribed to a recurring plan', () => {
    expect(
      isLifetimeTrialEligible({ accessState: 'subscribed', planId: 'annual' }),
    ).toBe(false);
  });

  it('stays eligible once recurring access is verified expired', () => {
    expect(isLifetimeTrialEligible({ accessState: 'expired', planId: 'monthly' })).toBe(true);
  });
});

describe('isLifetimeTransitionAllowed', () => {
  it('blocks Lifetime transitions whenever billing status is uncertain, even without a plan', () => {
    expect(isLifetimeTransitionAllowed({ accessState: 'sync_error' })).toBe(false);
  });

  it.each([
    ['annual', 'trial_active'],
    ['annual', 'subscribed'],
    ['annual', 'sync_error'],
    ['monthly', 'trial_active'],
    ['monthly', 'subscribed'],
    ['monthly', 'sync_error'],
  ] as const)('blocks Lifetime transitions for %s access in %s', (planId, accessState) => {
    expect(isLifetimeTransitionAllowed({ accessState, planId })).toBe(false);
  });

  it.each([
    { accessState: 'needs_purchase' as const },
    { accessState: 'expired' as const, planId: 'annual' as const },
    { accessState: 'expired' as const, planId: 'monthly' as const },
    { accessState: 'trial_active' as const, planId: 'lifetime' as const },
  ])('allows Lifetime transitions for verified-safe snapshot %#', (snapshot) => {
    expect(isLifetimeTransitionAllowed(snapshot)).toBe(true);
  });
});
