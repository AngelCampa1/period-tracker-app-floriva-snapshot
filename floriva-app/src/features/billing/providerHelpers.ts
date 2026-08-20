import type {
  Product,
  ProductSubscription,
  Purchase,
  SubscriptionPeriod,
} from 'expo-iap';

import { florivaRuntimeBillingConfig } from '@/src/features/billing/config';
import {
  resolvePlanIdFromProductIdentifier,
  type BillingOfferingCopy,
  type NativeStoreCatalogProduct,
} from '@/src/features/billing/model';
import type { BillingSnapshot, SubscriptionPlanId } from '@/src/types/domain';

export type CatalogPlan = {
  planId: SubscriptionPlanId;
  productId: string;
  productType: 'in-app' | 'subs';
  title: string;
  displayPrice: string;
  offerTokenAndroid?: string | null;
  freeTrialOfferTokenAndroid?: string | null;
  freeTrialPeriod?: SubscriptionPeriod | null;
  freeTrialPeriodCount?: number | null;
};

function isSafeCachedAccessState(accessState: BillingSnapshot['accessState']) {
  return (
    accessState === 'trial_active' ||
    accessState === 'subscribed' ||
    accessState === 'expired'
  );
}

function sortPlan(planId: SubscriptionPlanId) {
  switch (planId) {
    case 'annual':
      return 0;
    case 'lifetime':
      return 1;
    case 'monthly':
      return 2;
  }
}

export function buildConfiguredProductIds() {
  return [
    florivaRuntimeBillingConfig.monthlyProductId,
    florivaRuntimeBillingConfig.annualProductId,
    florivaRuntimeBillingConfig.lifetimeProductId,
  ].filter((productId): productId is string => productId.trim().length > 0);
}

export function isSubscriptionProduct(
  product: Product | ProductSubscription,
): product is ProductSubscription {
  return product.type === 'subs';
}

export function getFreeTrialOffer(product: Product | ProductSubscription) {
  if (!isSubscriptionProduct(product)) {
    return undefined;
  }

  return product.subscriptionOffers?.find((offer) => offer.paymentMode === 'free-trial');
}

export function pickAndroidOfferToken(product: ProductSubscription) {
  const freeTrialOffer = getFreeTrialOffer(product);

  if (freeTrialOffer?.offerTokenAndroid) {
    return freeTrialOffer.offerTokenAndroid;
  }

  if (!('subscriptionOfferDetailsAndroid' in product)) {
    return (
      product.subscriptionOffers?.find((offer) => offer.offerTokenAndroid)?.offerTokenAndroid ??
      null
    );
  }

  return (
    product.subscriptionOffers?.find((offer) => offer.offerTokenAndroid)?.offerTokenAndroid ??
    product.subscriptionOfferDetailsAndroid?.[0]?.offerToken ??
    null
  );
}

export function mapCatalogPlans(products: (Product | ProductSubscription)[]): CatalogPlan[] {
  return products
    .flatMap((product) => {
      const planId = resolvePlanIdFromProductIdentifier(
        product.id,
        florivaRuntimeBillingConfig,
      );

      if (!planId) {
        return [];
      }

      const freeTrialOffer = getFreeTrialOffer(product);

      return [
        {
          planId,
          productId: product.id,
          productType: product.type,
          title: product.title,
          displayPrice: product.displayPrice,
          offerTokenAndroid: isSubscriptionProduct(product)
            ? pickAndroidOfferToken(product)
            : null,
          freeTrialOfferTokenAndroid: freeTrialOffer?.offerTokenAndroid ?? null,
          freeTrialPeriod: freeTrialOffer?.period ?? null,
          freeTrialPeriodCount: freeTrialOffer?.periodCount ?? null,
        },
      ];
    })
    .sort((left, right) => sortPlan(left.planId) - sortPlan(right.planId));
}

export function mapCatalogProducts(plans: CatalogPlan[]): NativeStoreCatalogProduct[] {
  return plans.map((plan) => ({
    id: plan.productId,
    title: plan.title,
    displayPrice: plan.displayPrice,
    hasFreeTrial:
      plan.freeTrialPeriod != null || (plan.freeTrialOfferTokenAndroid ?? null) != null,
  }));
}

export function buildMissingConfigSnapshot(snapshot: BillingSnapshot) {
  if (isSafeCachedAccessState(snapshot.accessState)) {
    return snapshot;
  }

  return {
    ...snapshot,
    accessState: 'sync_error' as const,
  };
}

export function getPlanConfig(planId: SubscriptionPlanId) {
  switch (planId) {
    case 'annual':
      return florivaRuntimeBillingConfig.annualProductId;
    case 'lifetime':
      return florivaRuntimeBillingConfig.lifetimeProductId;
    case 'monthly':
      return florivaRuntimeBillingConfig.monthlyProductId;
  }
}

export function buildBillingOfferingCopy(
  t: (key: string, params?: Record<string, string | number>) => string,
): BillingOfferingCopy {
  return {
    annualTitle: t('settings.subscription.planLabels.annual'),
    annualTrialDetail: t('billing.offerings.annualTrialDetail'),
    annualStandardDetail: t('billing.offerings.annualStandardDetail'),
    lifetimeTitle: t('settings.subscription.planLabels.lifetime'),
    lifetimeDetail: t('billing.offerings.lifetimeDetail'),
    monthlyTitle: t('settings.subscription.planLabels.monthly'),
    monthlyTrialDetail: t('billing.offerings.monthlyTrialDetail'),
    monthlyStandardDetail: t('billing.offerings.monthlyStandardDetail'),
  };
}

export function addSubscriptionPeriodToDate(
  startDate: Date,
  period?: SubscriptionPeriod | null,
  periodCount = 1,
) {
  if (!period || period.value <= 0 || periodCount <= 0) {
    return null;
  }

  const nextDate = new Date(startDate.getTime());
  const totalUnits = period.value * periodCount;

  switch (period.unit) {
    case 'day':
      nextDate.setDate(nextDate.getDate() + totalUnits);
      return nextDate;
    case 'week':
      nextDate.setDate(nextDate.getDate() + totalUnits * 7);
      return nextDate;
    case 'month':
      nextDate.setMonth(nextDate.getMonth() + totalUnits);
      return nextDate;
    case 'year':
      nextDate.setFullYear(nextDate.getFullYear() + totalUnits);
      return nextDate;
    default:
      return null;
  }
}

export function buildTrialSnapshotCandidate({
  purchase,
  plan,
  now,
}: {
  purchase: Purchase;
  plan: CatalogPlan;
  now: Date;
}): BillingSnapshot | undefined {
  if (
    'offerIOS' in purchase &&
    purchase.offerIOS?.paymentMode === 'free-trial' &&
    purchase.expirationDateIOS
  ) {
    const trialEndsAt = new Date(purchase.expirationDateIOS).toISOString();

    return {
      accessState: 'trial_active',
      planId: plan.planId,
      trialEndsAt,
      firstChargeAt: trialEndsAt,
      expiresAt: trialEndsAt,
      lastSyncedAt: now.toISOString(),
    };
  }

  if (!('packageNameAndroid' in purchase)) {
    return undefined;
  }

  if (!plan.freeTrialOfferTokenAndroid || !purchase.transactionDate) {
    return undefined;
  }

  const trialEndDate = addSubscriptionPeriodToDate(
    new Date(purchase.transactionDate),
    plan.freeTrialPeriod,
    plan.freeTrialPeriodCount ?? 1,
  );

  if (!trialEndDate) {
    return undefined;
  }

  const trialEndsAt = trialEndDate.toISOString();

  return {
    accessState: 'trial_active',
    planId: plan.planId,
    trialEndsAt,
    firstChargeAt: trialEndsAt,
    expiresAt: trialEndsAt,
    lastSyncedAt: now.toISOString(),
  };
}

export function getPurchaseExpirationDate(purchase: Purchase) {
  if (!('expirationDateIOS' in purchase)) {
    return undefined;
  }

  const expirationDateIOS = purchase.expirationDateIOS ?? null;

  if (!expirationDateIOS) {
    return undefined;
  }

  return new Date(expirationDateIOS).toISOString();
}

export function buildProvisionalPurchaseSnapshot({
  purchase,
  plan,
  now,
}: {
  purchase: Purchase;
  plan: CatalogPlan;
  now: Date;
}): BillingSnapshot {
  return (
    buildTrialSnapshotCandidate({
      purchase,
      plan,
      now,
    }) ?? {
      accessState: 'subscribed',
      planId: plan.planId,
      expiresAt: getPurchaseExpirationDate(purchase),
      lastSyncedAt: now.toISOString(),
    }
  );
}

export function snapshotUnlocksPaidAccess(snapshot: BillingSnapshot | undefined) {
  return snapshot?.accessState === 'trial_active' || snapshot?.accessState === 'subscribed';
}
