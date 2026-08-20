import { buildGrandfatheredBillingSnapshot, GRANDFATHER_TRIAL_DAYS } from '@/src/features/billing/grandfatherTrial';
import type { BillingSnapshot } from '@/src/types/domain';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const base: BillingSnapshot = { accessState: 'needs_purchase' };

function daysAgo(now: Date, days: number) {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

describe('buildGrandfatheredBillingSnapshot', () => {
  const now = new Date('2026-06-08T12:00:00.000Z');

  it('grants a trial anchored to onboardingCompletedAt for a recently onboarded user', () => {
    const result = buildGrandfatheredBillingSnapshot({
      snapshot: base,
      hasCompletedOnboarding: true,
      onboardingCompletedAt: daysAgo(now, 10),
      earliestCreatedAt: undefined,
      now,
    });
    expect(result.changed).toBe(true);
    expect(result.snapshot.accessState).toBe('trial_active');
    expect(result.snapshot.grandfatherTrialApplied).toBe(true);
    const trialEnds = new Date(result.snapshot.trialEndsAt!);
    expect(trialEnds.getTime()).toBe(new Date(daysAgo(now, 10)).getTime() + GRANDFATHER_TRIAL_DAYS * MS_PER_DAY);
    expect(result.snapshot.firstChargeAt).toBeUndefined();
  });

  it('marks an already-expired trial for a user onboarded over 30 days ago', () => {
    const result = buildGrandfatheredBillingSnapshot({
      snapshot: base,
      hasCompletedOnboarding: true,
      onboardingCompletedAt: daysAgo(now, 45),
      earliestCreatedAt: undefined,
      now,
    });
    expect(result.changed).toBe(true);
    expect(result.snapshot.grandfatherTrialApplied).toBe(true);
    expect(new Date(result.snapshot.trialEndsAt!).getTime()).toBeLessThan(now.getTime());
  });

  it('falls back to earliestCreatedAt when onboardingCompletedAt is missing', () => {
    const result = buildGrandfatheredBillingSnapshot({
      snapshot: base,
      hasCompletedOnboarding: true,
      onboardingCompletedAt: undefined,
      earliestCreatedAt: daysAgo(now, 5),
      now,
    });
    expect(result.changed).toBe(true);
    expect(new Date(result.snapshot.trialEndsAt!).getTime()).toBe(
      new Date(daysAgo(now, 5)).getTime() + GRANDFATHER_TRIAL_DAYS * MS_PER_DAY,
    );
  });

  it('falls back to now when no anchor is available', () => {
    const result = buildGrandfatheredBillingSnapshot({
      snapshot: base,
      hasCompletedOnboarding: true,
      onboardingCompletedAt: undefined,
      earliestCreatedAt: undefined,
      now,
    });
    expect(result.changed).toBe(true);
    expect(new Date(result.snapshot.trialEndsAt!).getTime()).toBe(now.getTime() + GRANDFATHER_TRIAL_DAYS * MS_PER_DAY);
  });

  it('falls back to now when the stored anchor is an unparseable date', () => {
    const result = buildGrandfatheredBillingSnapshot({
      snapshot: base,
      hasCompletedOnboarding: true,
      onboardingCompletedAt: 'not-a-real-date',
      earliestCreatedAt: undefined,
      now,
    });
    expect(result.changed).toBe(true);
    expect(new Date(result.snapshot.trialEndsAt!).getTime()).toBe(
      now.getTime() + GRANDFATHER_TRIAL_DAYS * MS_PER_DAY,
    );
  });

  it('is a no-op when the marker is already set', () => {
    const result = buildGrandfatheredBillingSnapshot({
      snapshot: { accessState: 'needs_purchase', grandfatherTrialApplied: true },
      hasCompletedOnboarding: true,
      onboardingCompletedAt: daysAgo(now, 10),
      earliestCreatedAt: undefined,
      now,
    });
    expect(result.changed).toBe(false);
    expect(result.snapshot.accessState).toBe('needs_purchase');
  });

  it('cleans a stale charge timestamp from already-applied grandfathered access without a plan', () => {
    const trialEndsAt = daysAgo(now, -20);
    const result = buildGrandfatheredBillingSnapshot({
      snapshot: {
        accessState: 'trial_active',
        trialEndsAt,
        firstChargeAt: trialEndsAt,
        grandfatherTrialApplied: true,
      },
      hasCompletedOnboarding: true,
      onboardingCompletedAt: daysAgo(now, 10),
      earliestCreatedAt: undefined,
      now,
    });

    expect(result.changed).toBe(true);
    expect(result.snapshot.trialEndsAt).toBe(trialEndsAt);
    expect(result.snapshot.firstChargeAt).toBeUndefined();
  });

  it('preserves the charge timestamp for an already-applied grandfather snapshot with a real plan', () => {
    const firstChargeAt = daysAgo(now, -20);
    const snapshot: BillingSnapshot = {
      accessState: 'trial_active',
      planId: 'annual',
      trialEndsAt: firstChargeAt,
      firstChargeAt,
      grandfatherTrialApplied: true,
    };
    const result = buildGrandfatheredBillingSnapshot({
      snapshot,
      hasCompletedOnboarding: true,
      onboardingCompletedAt: daysAgo(now, 10),
      earliestCreatedAt: undefined,
      now,
    });

    expect(result.changed).toBe(false);
    expect(result.snapshot.firstChargeAt).toBe(firstChargeAt);
  });

  it('is a no-op when onboarding is not complete', () => {
    const result = buildGrandfatheredBillingSnapshot({
      snapshot: base,
      hasCompletedOnboarding: false,
      onboardingCompletedAt: daysAgo(now, 10),
      earliestCreatedAt: undefined,
      now,
    });
    expect(result.changed).toBe(false);
  });

  it('is a no-op when the user already has a plan (chose one through the paywall)', () => {
    const result = buildGrandfatheredBillingSnapshot({
      snapshot: { accessState: 'trial_active', planId: 'annual', trialEndsAt: daysAgo(now, -5) },
      hasCompletedOnboarding: true,
      onboardingCompletedAt: daysAgo(now, 10),
      earliestCreatedAt: undefined,
      now,
    });
    expect(result.changed).toBe(false);
  });

  it('is a no-op when the user is already subscribed', () => {
    const result = buildGrandfatheredBillingSnapshot({
      snapshot: { accessState: 'subscribed', planId: 'lifetime' },
      hasCompletedOnboarding: true,
      onboardingCompletedAt: daysAgo(now, 10),
      earliestCreatedAt: undefined,
      now,
    });
    expect(result.changed).toBe(false);
  });
});
