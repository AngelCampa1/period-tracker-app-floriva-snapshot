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
  androidOfferTokensById?: Record<string, string>;
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

export function buildDevFallbackCatalogPlans(
  config: typeof florivaRuntimeBillingConfig = florivaRuntimeBillingConfig,
): CatalogPlan[] {
  return [
    {
      planId: 'annual',
      productId: config.annualProductId || 'floriva.plus.annual',
      productType: 'subs',
      title: 'Floriva Plus Annual',
      displayPrice: config.annualPriceLabel ?? '$39.99/year',
      offerTokenAndroid: 'dev-annual-offer',
      androidOfferTokensById: {
        'save-annual-30': 'dev-annual-save-offer',
      },
      freeTrialOfferTokenAndroid: 'dev-annual-trial',
      freeTrialPeriod: { unit: 'month', value: 1 },
      freeTrialPeriodCount: 1,
    },
    {
      planId: 'lifetime',
      productId: config.lifetimeProductId || 'floriva.plus.lifetime',
      productType: 'in-app',
      title: 'Floriva Plus Lifetime',
      displayPrice: config.lifetimePriceLabel ?? '$59.99',
      offerTokenAndroid: null,
      freeTrialOfferTokenAndroid: null,
      freeTrialPeriod: null,
      freeTrialPeriodCount: null,
    },
    {
      planId: 'monthly',
      productId: config.monthlyProductId || 'floriva.plus.monthly',
      productType: 'subs',
      title: 'Floriva Plus Monthly',
      displayPrice: config.monthlyPriceLabel ?? '$5.99/month',
      offerTokenAndroid: 'dev-monthly-offer',
      androidOfferTokensById: {
        'save-monthly-80-3mo': 'dev-monthly-save-offer',
      },
      freeTrialOfferTokenAndroid: 'dev-monthly-trial',
      freeTrialPeriod: { unit: 'month', value: 1 },
      freeTrialPeriodCount: 1,
    },
  ];
}

function isSubscriptionProduct(
  product: Product | ProductSubscription,
): product is ProductSubscription {
  return product.type === 'subs';
}

function getFreeTrialOffer(product: Product | ProductSubscription) {
  if (!isSubscriptionProduct(product)) {
    return undefined;
  }

  return product.subscriptionOffers?.find((offer) => offer.paymentMode === 'free-trial');
}

function pickAndroidOfferToken(product: ProductSubscription) {
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

function mapAndroidOfferTokensById(product: ProductSubscription) {
  return Object.fromEntries(
    (product.subscriptionOffers ?? [])
      .filter((offer) => offer.id && offer.offerTokenAndroid)
      .map((offer) => [offer.id, offer.offerTokenAndroid as string]),
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
          androidOfferTokensById: isSubscriptionProduct(product)
            ? mapAndroidOfferTokensById(product)
            : {},
          freeTrialOfferTokenAndroid: freeTrialOffer?.offerTokenAndroid ?? null,
          freeTrialPeriod: freeTrialOffer?.period ?? null,
          freeTrialPeriodCount: freeTrialOffer?.periodCount ?? null,
        },
      ];
    })
    .sort((left, right) => sortPlan(left.planId) - sortPlan(right.planId));
}

export function mapCatalogProducts(
  plans: CatalogPlan[],
  isPurchaseAvailable = true,
): NativeStoreCatalogProduct[] {
  return plans.map((plan) => ({
    id: plan.productId,
    title: plan.title,
    displayPrice: plan.displayPrice,
    hasFreeTrial:
      plan.freeTrialPeriod != null || (plan.freeTrialOfferTokenAndroid ?? null) != null,
    isPurchaseAvailable,
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

function addSubscriptionPeriodToDate(
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

function buildTrialSnapshotCandidate({
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

function getPurchaseExpirationDate(purchase: Purchase) {
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
