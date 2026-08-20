import type { BillingSnapshot } from '@/src/types/domain';

const LIFETIME_TRIAL_MONTHS = 1;

type LifetimeTrialInput = {
  snapshot: BillingSnapshot;
  now: Date;
};

function addCalendarMonths(date: Date, months: number) {
  const next = new Date(date.getTime());
  const originalDay = next.getDate();

  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDayOfTargetMonth = new Date(
    next.getFullYear(),
    next.getMonth() + 1,
    0,
  ).getDate();
  next.setDate(Math.min(originalDay, lastDayOfTargetMonth));

  return next;
}

export function isLifetimeTransitionAllowed(snapshot: BillingSnapshot): boolean {
  // A failed store sync cannot prove that recurring access is absent. The plan ID
  // may also be missing, so uncertainty alone must block a Lifetime transition.
  if (snapshot.accessState === 'sync_error') {
    return false;
  }

  const hasRecurringPlan = snapshot.planId === 'annual' || snapshot.planId === 'monthly';
  const hasActiveAccess =
    snapshot.accessState === 'trial_active' || snapshot.accessState === 'subscribed';

  return !(hasRecurringPlan && hasActiveAccess);
}

/**
 * Builds the app-level Lifetime free-trial snapshot. Lifetime is a non-consumable and
 * cannot carry a store trial, so the trial is granted entirely in-app: full access now,
 * a one-month window, and a durable `lifetimeTrialStartedAt` marker. There is deliberately
 * NO `firstChargeAt` — nothing auto-charges; when the window passes `normalizeBillingSnapshot`
 * downgrades the snapshot to `expired` and the user must manually purchase Lifetime.
 */
export function buildLifetimeTrialSnapshot({ snapshot, now }: LifetimeTrialInput): BillingSnapshot {
  const trialEndsAt = addCalendarMonths(now, LIFETIME_TRIAL_MONTHS).toISOString();

  return {
    ...snapshot,
    accessState: 'trial_active',
    planId: 'lifetime',
    trialEndsAt,
    firstChargeAt: undefined,
    expiresAt: undefined,
    reminderScheduledFor: undefined,
    lifetimeTrialStartedAt: now.toISOString(),
  };
}

/**
 * The Lifetime trial is one-time: eligible only when it has never been started, the user does
 * not already own Lifetime, and recurring access is verified inactive or expired.
 */
export function isLifetimeTrialEligible(snapshot: BillingSnapshot): boolean {
  if (!isLifetimeTransitionAllowed(snapshot) || snapshot.lifetimeTrialStartedAt) {
    return false;
  }

  return !(snapshot.accessState === 'subscribed' && snapshot.planId === 'lifetime');
}

export { LIFETIME_TRIAL_MONTHS };
