import type { BillingSnapshot, SubscriptionPlanId } from '@/src/types/domain';

export type BillingConfig = {
  monthlyProductId?: string;
  annualProductId?: string;
  lifetimeProductId?: string;
  annualPriceLabel?: string;
  monthlyPriceLabel?: string;
  lifetimePriceLabel?: string;
  reminderLeadDays: number;
  reminderHour: number;
  reminderMinute: number;
};

export type BillingOffering = {
  planId: SubscriptionPlanId;
  title: string;
  priceLabel: string;
  detail: string;
  hasFreeTrial: boolean;
  isPurchaseAvailable: boolean;
};

export type BillingOfferingCopy = {
  annualTitle: string;
  annualTrialDetail: string;
  annualStandardDetail: string;
  lifetimeTitle: string;
  lifetimeDetail: string;
  monthlyTitle: string;
  monthlyTrialDetail: string;
  monthlyStandardDetail: string;
};

export type NativeStoreCatalogProduct = {
  id: string;
  title: string;
  displayPrice: string;
  hasFreeTrial?: boolean;
  isPurchaseAvailable?: boolean;
};

export type NativeStorePurchaseRecord = {
  productId: string;
  transactionDate?: number;
};

export type NativeStoreActiveSubscription = {
  productId: string;
  isActive: boolean;
  expirationDate?: number | null;
  transactionDate?: number;
};

type DeriveBillingSnapshotArgs = {
  syncStatus?: 'ready' | 'error';
  activeSubscriptions?: NativeStoreActiveSubscription[];
  availablePurchases?: NativeStorePurchaseRecord[];
  previousSnapshot?: BillingSnapshotInput;
  config: Pick<BillingConfig, 'annualProductId' | 'monthlyProductId' | 'lifetimeProductId'>;
  now?: Date;
};

type BillingSnapshotInput = Omit<BillingSnapshot, 'accessState'> & {
  accessState: BillingSnapshot['accessState'] | 'complimentary_active';
};

const predefinedPlanIdByIdentifier: Record<string, SubscriptionPlanId> = {
  annual: 'annual',
  yearly: 'annual',
  monthly: 'monthly',
  lifetime: 'lifetime',
};

function isSafeCachedAccessState(accessState: BillingSnapshot['accessState']) {
  return (
    accessState === 'trial_active' ||
    accessState === 'subscribed' ||
    accessState === 'expired'
  );
}

function shouldPreserveLegacyTimedAccess(snapshot: BillingSnapshot | undefined, now: Date) {
  return Boolean(
    snapshot?.accessState === 'subscribed' &&
      !snapshot.planId &&
      snapshot.expiresAt &&
      isTimestampInFuture(snapshot.expiresAt, now),
  );
}

function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}

function isoFromMillis(timestamp?: number | null) {
  if (!timestamp) {
    return undefined;
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

function parseTimestamp(isoTimestamp?: string) {
  if (!isoTimestamp) {
    return null;
  }

  const timestamp = Date.parse(isoTimestamp);

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return timestamp;
}

function isTimestampInFuture(isoTimestamp: string | undefined, now: Date) {
  const timestamp = parseTimestamp(isoTimestamp);

  if (timestamp == null) {
    return false;
  }

  return timestamp > now.getTime();
}

function getTrialExpirationTimestamp(snapshot: Pick<BillingSnapshot, 'trialEndsAt' | 'expiresAt' | 'firstChargeAt'>) {
  return snapshot.trialEndsAt ?? snapshot.expiresAt ?? snapshot.firstChargeAt;
}

function sortPlanIds(planId: SubscriptionPlanId) {
  switch (planId) {
    case 'annual':
      return 0;
    case 'lifetime':
      return 1;
    case 'monthly':
      return 2;
  }
}

export function resolvePlanIdFromProductIdentifier(
  productIdentifier: string,
  config: Pick<BillingConfig, 'annualProductId' | 'monthlyProductId' | 'lifetimeProductId'>,
): SubscriptionPlanId | undefined {
  const normalizedIdentifier = normalizeIdentifier(productIdentifier);

  if (normalizedIdentifier.length === 0) {
    return undefined;
  }

  if (config.annualProductId && productIdentifier === config.annualProductId) {
    return 'annual';
  }

  if (config.monthlyProductId && productIdentifier === config.monthlyProductId) {
    return 'monthly';
  }

  if (config.lifetimeProductId && productIdentifier === config.lifetimeProductId) {
    return 'lifetime';
  }

  const predefinedPlanId = predefinedPlanIdByIdentifier[normalizedIdentifier];

  if (predefinedPlanId) {
    return predefinedPlanId;
  }

  if (normalizedIdentifier.includes('annual') || normalizedIdentifier.includes('year')) {
    return 'annual';
  }

  if (normalizedIdentifier.includes('month')) {
    return 'monthly';
  }

  if (normalizedIdentifier.includes('lifetime')) {
    return 'lifetime';
  }

  return undefined;
}

function findMostRelevantActiveSubscription(
  activeSubscriptions: NativeStoreActiveSubscription[],
  config: Pick<BillingConfig, 'annualProductId' | 'monthlyProductId' | 'lifetimeProductId'>,
) {
  return activeSubscriptions
    .flatMap((subscription) => {
      if (!subscription.isActive) {
        return [];
      }

      const planId = resolvePlanIdFromProductIdentifier(subscription.productId, config);

      if (!planId || planId === 'lifetime') {
        return [];
      }

      return [{ planId, subscription }];
    })
    .sort((left, right) => sortPlanIds(left.planId) - sortPlanIds(right.planId))[0];
}

function findMostRelevantPurchase(
  purchases: NativeStorePurchaseRecord[],
  config: Pick<BillingConfig, 'annualProductId' | 'monthlyProductId' | 'lifetimeProductId'>,
) {
  return purchases
    .flatMap((purchase) => {
      const planId = resolvePlanIdFromProductIdentifier(purchase.productId, config);

      if (!planId) {
        return [];
      }

      return [{ planId, purchase }];
    })
    .sort((left, right) => {
      const timestampDelta =
        (right.purchase.transactionDate ?? 0) - (left.purchase.transactionDate ?? 0);

      if (timestampDelta !== 0) {
        return timestampDelta;
      }

      return sortPlanIds(left.planId) - sortPlanIds(right.planId);
    })[0];
}

export function deriveBillingSnapshotFromNativeState({
  syncStatus = 'ready',
  activeSubscriptions = [],
  availablePurchases = [],
  previousSnapshot,
  config,
  now = new Date(Date.now()),
}: DeriveBillingSnapshotArgs): BillingSnapshot {
  const normalizedPreviousSnapshot = previousSnapshot
    ? normalizeBillingSnapshot(previousSnapshot, now)
    : undefined;
  const previousTrialSnapshot =
    normalizedPreviousSnapshot?.accessState === 'trial_active'
      ? normalizedPreviousSnapshot
      : undefined;
  const durableLifetimeTrialMarker = normalizedPreviousSnapshot?.lifetimeTrialStartedAt
    ? { lifetimeTrialStartedAt: normalizedPreviousSnapshot.lifetimeTrialStartedAt }
    : {};
  const lastSyncedAt = now.toISOString();

  if (syncStatus === 'error') {
    if (
      normalizedPreviousSnapshot &&
      isSafeCachedAccessState(normalizedPreviousSnapshot.accessState)
    ) {
      return {
        ...normalizedPreviousSnapshot,
        lastSyncedAt,
      };
    }

    return {
      accessState: 'sync_error',
      ...durableLifetimeTrialMarker,
      lastSyncedAt,
    };
  }

  const activeSubscription = findMostRelevantActiveSubscription(activeSubscriptions, config);

  if (activeSubscription) {
    const previousTrialForPlan =
      previousTrialSnapshot?.planId === activeSubscription.planId
        ? previousTrialSnapshot
        : undefined;

    if (
      previousTrialForPlan &&
      isTimestampInFuture(getTrialExpirationTimestamp(previousTrialForPlan), now)
    ) {
      return {
        ...previousTrialForPlan,
        expiresAt:
          isoFromMillis(activeSubscription.subscription.expirationDate) ??
          previousTrialForPlan.expiresAt,
        lastSyncedAt,
      };
    }

    return {
      accessState: 'subscribed',
      planId: activeSubscription.planId,
      expiresAt: isoFromMillis(activeSubscription.subscription.expirationDate),
      ...durableLifetimeTrialMarker,
      lastSyncedAt,
    };
  }

  const latestKnownPurchase = findMostRelevantPurchase(availablePurchases, config);

  const hasLifetimePurchase = availablePurchases.some(
    (purchase) => resolvePlanIdFromProductIdentifier(purchase.productId, config) === 'lifetime',
  );

  if (hasLifetimePurchase) {
    return {
      accessState: 'subscribed',
      planId: 'lifetime',
      ...durableLifetimeTrialMarker,
      lastSyncedAt,
    };
  }

  // The Lifetime free trial is app-level: it has no store purchase backing it, so the
  // generic "safe cached state -> expired" fallback below would wrongly end it on the next
  // refresh. Preserve a still-valid Lifetime trial (identified by its durable marker) until
  // `normalizeBillingSnapshot` expires it on its own once the window passes. A real Lifetime
  // purchase is handled above and supersedes it.
  if (
    previousTrialSnapshot?.planId === 'lifetime' &&
    previousTrialSnapshot.lifetimeTrialStartedAt &&
    isTimestampInFuture(getTrialExpirationTimestamp(previousTrialSnapshot), now)
  ) {
    return {
      ...previousTrialSnapshot,
      lastSyncedAt,
    };
  }

  if (normalizedPreviousSnapshot && shouldPreserveLegacyTimedAccess(normalizedPreviousSnapshot, now)) {
    return {
      ...normalizedPreviousSnapshot,
      lastSyncedAt,
    };
  }

  if (
    latestKnownPurchase ||
    (normalizedPreviousSnapshot && isSafeCachedAccessState(normalizedPreviousSnapshot.accessState))
  ) {
    return {
      ...normalizedPreviousSnapshot,
      accessState: 'expired',
      planId: latestKnownPurchase?.planId ?? normalizedPreviousSnapshot?.planId,
      lastSyncedAt,
    };
  }

  return {
    accessState: 'needs_purchase',
    ...durableLifetimeTrialMarker,
    lastSyncedAt,
  };
}

export function sortBillingProductsAnnualFirst(
  products: NativeStoreCatalogProduct[],
  config: Pick<BillingConfig, 'annualProductId' | 'monthlyProductId' | 'lifetimeProductId'>,
) {
  return products
    .flatMap((product) => {
      const planId = resolvePlanIdFromProductIdentifier(product.id, config);

      if (!planId) {
        return [];
      }

      return [{ planId, product }];
    })
    .sort((left, right) => sortPlanIds(left.planId) - sortPlanIds(right.planId));
}

export function buildBillingOfferings(
  products: NativeStoreCatalogProduct[],
  config: BillingConfig,
  copy: BillingOfferingCopy,
): BillingOffering[] {
  return sortBillingProductsAnnualFirst(products, config).map(({ planId, product }) => {
    const hasFreeTrial = Boolean(product.hasFreeTrial);

    return {
      planId,
      title:
        planId === 'annual'
          ? copy.annualTitle
          : planId === 'lifetime'
            ? copy.lifetimeTitle
            : copy.monthlyTitle,
      priceLabel: product.displayPrice.trim().length > 0 ? product.displayPrice : product.title,
      detail:
        planId === 'annual'
          ? hasFreeTrial
            ? copy.annualTrialDetail
            : copy.annualStandardDetail
          : planId === 'lifetime'
            ? copy.lifetimeDetail
            : hasFreeTrial
              ? copy.monthlyTrialDetail
              : copy.monthlyStandardDetail,
      hasFreeTrial,
      isPurchaseAvailable: product.isPurchaseAvailable ?? true,
    };
  });
}

export function buildFirstChargeReminderDate(
  snapshot: BillingSnapshot,
  config: Pick<BillingConfig, 'reminderLeadDays' | 'reminderHour' | 'reminderMinute'>,
  now = new Date(Date.now()),
): Date | null {
  if (snapshot.planId === 'lifetime' || !snapshot.firstChargeAt) {
    return null;
  }

  // Parse the ISO charge date and validate it before proceeding.
  const chargeMillis = Date.parse(snapshot.firstChargeAt);
  if (Number.isNaN(chargeMillis)) {
    return null;
  }

  // Use the UTC calendar date of the first charge as the reference point so
  // that lead-day subtraction is timezone-independent.  If we called
  // getDate() on the local representation, a charge timestamp at e.g. 01:00Z
  // would appear as the previous calendar day in UTC-4, shifting the reminder
  // one day too early.
  const chargeUtc = new Date(chargeMillis);
  const utcYear = chargeUtc.getUTCFullYear();
  const utcMonth = chargeUtc.getUTCMonth();
  const utcDay = chargeUtc.getUTCDate();

  // Construct the reminder in local time from the UTC calendar date.
  const reminderDate = new Date(utcYear, utcMonth, utcDay);
  reminderDate.setDate(reminderDate.getDate() - config.reminderLeadDays);
  reminderDate.setHours(config.reminderHour, config.reminderMinute, 0, 0);

  if (reminderDate.getTime() <= now.getTime()) {
    return null;
  }

  return reminderDate;
}

export function normalizeBillingSnapshot(
  snapshot: BillingSnapshotInput,
  now = new Date(Date.now()),
): BillingSnapshot {
  if (snapshot.accessState === 'complimentary_active') {
    return {
      ...snapshot,
      accessState:
        snapshot.expiresAt && !isTimestampInFuture(snapshot.expiresAt, now)
          ? 'expired'
          : 'subscribed',
    };
  }

  if (snapshot.accessState === 'trial_active') {
    const expirationAt = getTrialExpirationTimestamp(snapshot);

    if (!expirationAt) {
      return snapshot as BillingSnapshot;
    }

    if (isTimestampInFuture(expirationAt, now)) {
      return snapshot as BillingSnapshot;
    }

    return {
      ...snapshot,
      accessState: 'expired',
    } satisfies BillingSnapshot;
  }

  if (
    snapshot.accessState === 'subscribed' &&
    snapshot.planId !== 'lifetime' &&
    snapshot.expiresAt &&
    !isTimestampInFuture(snapshot.expiresAt, now)
  ) {
    return {
      ...snapshot,
      accessState: 'expired',
    } satisfies BillingSnapshot;
  }

  return snapshot as BillingSnapshot;
}
