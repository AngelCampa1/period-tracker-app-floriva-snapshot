import type { BillingSnapshot } from '@/src/types/domain';

const GRANDFATHER_TRIAL_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type GrandfatherInput = {
  snapshot: BillingSnapshot;
  hasCompletedOnboarding: boolean;
  onboardingCompletedAt: string | undefined;
  earliestCreatedAt: string | undefined;
  now: Date;
};

function resolveAnchor(
  onboardingCompletedAt: string | undefined,
  earliestCreatedAt: string | undefined,
  now: Date,
): Date {
  const candidate = onboardingCompletedAt ?? earliestCreatedAt;
  if (candidate) {
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return now;
}

/**
 * Grants a one-time 30-day grandfather trial to users who finished onboarding
 * during the no-paywall window. The seeded `trial_active` snapshot must be run
 * through `normalizeBillingSnapshot(now)` by the caller, which downgrades it to
 * `expired` when the anchored trial window has already passed.
 */
export function buildGrandfatheredBillingSnapshot({
  snapshot,
  hasCompletedOnboarding,
  onboardingCompletedAt,
  earliestCreatedAt,
  now,
}: GrandfatherInput): { snapshot: BillingSnapshot; changed: boolean } {
  const alreadyApplied = snapshot.grandfatherTrialApplied === true;
  const hasPlan = Boolean(snapshot.planId);
  const hasPaidState =
    snapshot.accessState === 'subscribed' || snapshot.accessState === 'trial_active';

  if (alreadyApplied && !hasPlan && snapshot.firstChargeAt !== undefined) {
    return {
      snapshot: {
        ...snapshot,
        firstChargeAt: undefined,
      },
      changed: true,
    };
  }

  if (!hasCompletedOnboarding || alreadyApplied || hasPlan || hasPaidState) {
    return { snapshot, changed: false };
  }

  const anchor = resolveAnchor(onboardingCompletedAt, earliestCreatedAt, now);
  const trialEnd = new Date(anchor.getTime() + GRANDFATHER_TRIAL_DAYS * MS_PER_DAY);
  const trialEndsAt = trialEnd.toISOString();

  return {
    snapshot: {
      ...snapshot,
      accessState: 'trial_active',
      trialEndsAt,
      firstChargeAt: undefined,
      grandfatherTrialApplied: true,
    },
    changed: true,
  };
}

export { GRANDFATHER_TRIAL_DAYS };
