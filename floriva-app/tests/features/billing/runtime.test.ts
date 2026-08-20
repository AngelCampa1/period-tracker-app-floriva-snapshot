import type { Product, ProductSubscription, Purchase } from 'expo-iap';

jest.mock('@/src/features/billing/config', () => ({
  florivaRuntimeBillingConfig: {
    monthlyProductId: 'floriva.monthly',
    annualProductId: 'floriva.annual',
    lifetimeProductId: 'floriva.lifetime',
  },
}));

const {
  buildConfiguredProductIds,
  buildMissingConfigSnapshot,
  buildProvisionalPurchaseSnapshot,
  buildBillingOfferingCopy,
  getPlanConfig,
  mapCatalogPlans,
  mapCatalogProducts,
  snapshotUnlocksPaidAccess,
} = require('@/src/features/billing/runtime');

describe('billing runtime helpers', () => {
  it('filters blank configured product identifiers', () => {
    expect(buildConfiguredProductIds()).toEqual([
      'floriva.monthly',
      'floriva.annual',
      'floriva.lifetime',
    ]);
  });

  it('maps and sorts catalog plans while preserving Android offer metadata', () => {
    const products = [
      {
        id: 'floriva.monthly',
        title: 'Monthly',
        displayPrice: '$5.99',
        type: 'subs',
        subscriptionOffers: [
          {
            id: 'monthly-standard',
            displayPrice: '$5.99',
            paymentMode: 'pay-as-you-go',
            offerTokenAndroid: 'monthly-standard-token',
            period: { unit: 'month', value: 1 },
            periodCount: 1,
          },
          {
            id: 'monthly-trial',
            displayPrice: '$5.99',
            paymentMode: 'free-trial',
            offerTokenAndroid: 'monthly-trial-token',
            period: { unit: 'month', value: 1 },
            periodCount: 1,
          },
        ],
      },
      {
        id: 'floriva.lifetime',
        title: 'Lifetime',
        displayPrice: '$59.99',
        type: 'in-app',
      },
      {
        id: 'floriva.annual',
        title: 'Annual',
        displayPrice: '$39.99',
        type: 'subs',
        subscriptionOffers: [
          {
            id: 'annual-standard',
            displayPrice: '$39.99',
            paymentMode: 'pay-as-you-go',
            offerTokenAndroid: 'annual-standard-token',
            period: { unit: 'year', value: 1 },
            periodCount: 1,
          },
        ],
        subscriptionOfferDetailsAndroid: [
          {
            offerToken: 'annual-fallback-token',
          },
        ],
      },
      {
        id: 'ignored.sku',
        title: 'Ignored',
        displayPrice: '$0.99',
        type: 'in-app',
      },
    ] as (Product | ProductSubscription)[];

    const plans = mapCatalogPlans(products);

    expect(plans).toEqual([
      expect.objectContaining({
        planId: 'annual',
        productId: 'floriva.annual',
        offerTokenAndroid: 'annual-standard-token',
        androidOfferTokensById: {
          'annual-standard': 'annual-standard-token',
        },
        freeTrialOfferTokenAndroid: null,
      }),
      expect.objectContaining({
        planId: 'lifetime',
        productId: 'floriva.lifetime',
        offerTokenAndroid: null,
      }),
      expect.objectContaining({
        planId: 'monthly',
        productId: 'floriva.monthly',
        offerTokenAndroid: 'monthly-trial-token',
        androidOfferTokensById: {
          'monthly-standard': 'monthly-standard-token',
          'monthly-trial': 'monthly-trial-token',
        },
        freeTrialOfferTokenAndroid: 'monthly-trial-token',
        freeTrialPeriod: { unit: 'month', value: 1 },
        freeTrialPeriodCount: 1,
      }),
    ]);
    expect(mapCatalogProducts(plans)).toEqual([
      {
        id: 'floriva.annual',
        title: 'Annual',
        displayPrice: '$39.99',
        hasFreeTrial: false,
        isPurchaseAvailable: true,
      },
      {
        id: 'floriva.lifetime',
        title: 'Lifetime',
        displayPrice: '$59.99',
        hasFreeTrial: false,
        isPurchaseAvailable: true,
      },
      {
        id: 'floriva.monthly',
        title: 'Monthly',
        displayPrice: '$5.99',
        hasFreeTrial: true,
        isPurchaseAvailable: true,
      },
    ]);
  });

  it('keeps safe cached access states when billing config is unavailable', () => {
    expect(
      buildMissingConfigSnapshot({
        accessState: 'subscribed',
        planId: 'annual',
      }),
    ).toEqual({
      accessState: 'subscribed',
      planId: 'annual',
    });
    expect(
      buildMissingConfigSnapshot({
        accessState: 'expired',
        expiresAt: '2026-05-01T00:00:00.000Z',
      }),
    ).toEqual({
      accessState: 'expired',
      expiresAt: '2026-05-01T00:00:00.000Z',
    });
    expect(
      buildMissingConfigSnapshot({
        accessState: 'needs_purchase',
      }),
    ).toEqual({
      accessState: 'sync_error',
    });
  });

  it('resolves per-plan product identifiers and paid-access eligibility', () => {
    expect(getPlanConfig('annual')).toBe('floriva.annual');
    expect(getPlanConfig('monthly')).toBe('floriva.monthly');
    expect(getPlanConfig('lifetime')).toBe('floriva.lifetime');
    expect(snapshotUnlocksPaidAccess({ accessState: 'trial_active' })).toBe(true);
    expect(snapshotUnlocksPaidAccess({ accessState: 'subscribed' })).toBe(true);
    expect(snapshotUnlocksPaidAccess({ accessState: 'needs_purchase' })).toBe(false);
    expect(snapshotUnlocksPaidAccess(undefined)).toBe(false);
  });

  it('builds provisional snapshots for iOS trials, Android trials, and paid purchases', () => {
    const now = new Date('2026-04-13T12:00:00.000Z');
    const annualPlan = {
      planId: 'annual',
      productId: 'floriva.annual',
      productType: 'subs',
      title: 'Annual',
      displayPrice: '$39.99',
      freeTrialOfferTokenAndroid: 'annual-trial-token',
      freeTrialPeriod: { unit: 'month', value: 1 },
      freeTrialPeriodCount: 1,
    } as const;

    expect(
      buildProvisionalPurchaseSnapshot({
        purchase: {
          id: 'ios-trial',
          productId: 'floriva.annual',
          transactionDate: Date.parse('2026-04-13T12:00:00.000Z'),
          expirationDateIOS: Date.parse('2026-05-13T12:00:00.000Z'),
          offerIOS: {
            paymentMode: 'free-trial',
          },
        } as Purchase,
        plan: annualPlan,
        now,
      }),
    ).toEqual({
      accessState: 'trial_active',
      planId: 'annual',
      trialEndsAt: '2026-05-13T12:00:00.000Z',
      firstChargeAt: '2026-05-13T12:00:00.000Z',
      expiresAt: '2026-05-13T12:00:00.000Z',
      lastSyncedAt: '2026-04-13T12:00:00.000Z',
    });

    expect(
      buildProvisionalPurchaseSnapshot({
        purchase: {
          id: 'android-trial',
          productId: 'floriva.annual',
          transactionDate: Date.parse('2026-04-13T12:00:00.000Z'),
          packageNameAndroid: 'com.anonymous.floriva',
        } as Purchase,
        plan: annualPlan,
        now,
      }),
    ).toEqual({
      accessState: 'trial_active',
      planId: 'annual',
      trialEndsAt: '2026-05-13T12:00:00.000Z',
      firstChargeAt: '2026-05-13T12:00:00.000Z',
      expiresAt: '2026-05-13T12:00:00.000Z',
      lastSyncedAt: '2026-04-13T12:00:00.000Z',
    });

    expect(
      buildProvisionalPurchaseSnapshot({
        purchase: {
          id: 'ios-paid',
          productId: 'floriva.lifetime',
          transactionDate: Date.parse('2026-04-13T12:00:00.000Z'),
          expirationDateIOS: Date.parse('2026-06-13T12:00:00.000Z'),
        } as Purchase,
        plan: {
          planId: 'lifetime',
          productId: 'floriva.lifetime',
          productType: 'in-app',
          title: 'Lifetime',
          displayPrice: '$59.99',
        },
        now,
      }),
    ).toEqual({
      accessState: 'subscribed',
      planId: 'lifetime',
      expiresAt: '2026-06-13T12:00:00.000Z',
      lastSyncedAt: '2026-04-13T12:00:00.000Z',
    });
  });

  it('builds localized offering copy labels from translation keys', () => {
    const translate = (key: string) => `t:${key}`;

    expect(buildBillingOfferingCopy(translate)).toEqual({
      annualTitle: 't:settings.subscription.planLabels.annual',
      annualTrialDetail: 't:billing.offerings.annualTrialDetail',
      annualStandardDetail: 't:billing.offerings.annualStandardDetail',
      lifetimeTitle: 't:settings.subscription.planLabels.lifetime',
      lifetimeDetail: 't:billing.offerings.lifetimeDetail',
      monthlyTitle: 't:settings.subscription.planLabels.monthly',
      monthlyTrialDetail: 't:billing.offerings.monthlyTrialDetail',
      monthlyStandardDetail: 't:billing.offerings.monthlyStandardDetail',
    });
  });

  it('falls back to alternate Android offer sources and ignores unknown catalog products', () => {
    const plans = mapCatalogPlans([
      {
        id: 'ignored.sku',
        title: 'Ignored',
        displayPrice: '$0.99',
        type: 'in-app',
      },
      {
        id: 'floriva.monthly',
        title: 'Monthly',
        displayPrice: '$5.99',
        type: 'subs',
        subscriptionOffers: [
          {
            id: 'monthly-standard',
            displayPrice: '$5.99',
            paymentMode: 'pay-as-you-go',
            offerTokenAndroid: 'monthly-standard-token',
            period: { unit: 'month', value: 1 },
            periodCount: 1,
          },
        ],
      },
      {
        id: 'floriva.annual',
        title: 'Annual',
        displayPrice: '$39.99',
        type: 'subs',
        subscriptionOffers: [],
        subscriptionOfferDetailsAndroid: [
          {
            offerToken: 'annual-derived-token',
          },
        ],
      },
    ] as (Product | ProductSubscription)[]);

    expect(plans).toEqual([
      expect.objectContaining({
        planId: 'annual',
        offerTokenAndroid: 'annual-derived-token',
      }),
      expect.objectContaining({
        planId: 'monthly',
        offerTokenAndroid: 'monthly-standard-token',
      }),
    ]);
  });

  it('covers non-trial purchase fallbacks and alternate Android trial periods', () => {
    const now = new Date('2026-04-13T12:00:00.000Z');

    expect(
      buildProvisionalPurchaseSnapshot({
        purchase: {
          id: 'ios-paid-no-expiry',
          productId: 'floriva.annual',
        } as Purchase,
        plan: {
          planId: 'annual',
          productId: 'floriva.annual',
          productType: 'subs',
          title: 'Annual',
          displayPrice: '$39.99',
        },
        now,
      }),
    ).toEqual({
      accessState: 'subscribed',
      planId: 'annual',
      expiresAt: undefined,
      lastSyncedAt: '2026-04-13T12:00:00.000Z',
    });

    expect(
      buildProvisionalPurchaseSnapshot({
        purchase: {
          id: 'android-weekly-trial',
          productId: 'floriva.monthly',
          transactionDate: Date.parse('2026-04-13T12:00:00.000Z'),
          packageNameAndroid: 'com.anonymous.floriva',
        } as Purchase,
        plan: {
          planId: 'monthly',
          productId: 'floriva.monthly',
          productType: 'subs',
          title: 'Monthly',
          displayPrice: '$5.99',
          freeTrialOfferTokenAndroid: 'monthly-trial-token',
          freeTrialPeriod: { unit: 'week', value: 1 },
          freeTrialPeriodCount: 2,
        },
        now,
      }),
    ).toEqual(
      expect.objectContaining({
        accessState: 'trial_active',
        trialEndsAt: '2026-04-27T12:00:00.000Z',
      }),
    );

    expect(
      buildProvisionalPurchaseSnapshot({
        purchase: {
          id: 'android-yearly-trial',
          productId: 'floriva.annual',
          transactionDate: Date.parse('2026-04-13T12:00:00.000Z'),
          packageNameAndroid: 'com.anonymous.floriva',
        } as Purchase,
        plan: {
          planId: 'annual',
          productId: 'floriva.annual',
          productType: 'subs',
          title: 'Annual',
          displayPrice: '$39.99',
          freeTrialOfferTokenAndroid: 'annual-trial-token',
          freeTrialPeriod: { unit: 'year', value: 1 },
          freeTrialPeriodCount: 1,
        },
        now,
      }),
    ).toEqual(
      expect.objectContaining({
        accessState: 'trial_active',
        trialEndsAt: '2027-04-13T12:00:00.000Z',
      }),
    );
  });

  it('covers additional Android trial period branches', () => {
    const now = new Date('2026-04-13T12:00:00.000Z');

    expect(
      buildProvisionalPurchaseSnapshot({
        purchase: {
          id: 'android-daily-trial',
          productId: 'floriva.monthly',
          transactionDate: Date.parse('2026-04-13T12:00:00.000Z'),
          packageNameAndroid: 'com.anonymous.floriva',
        } as Purchase,
        plan: {
          planId: 'monthly',
          productId: 'floriva.monthly',
          productType: 'subs',
          title: 'Monthly',
          displayPrice: '$5.99',
          freeTrialOfferTokenAndroid: 'monthly-trial-token',
          freeTrialPeriod: { unit: 'day', value: 3 },
          freeTrialPeriodCount: 1,
        },
        now,
      }),
    ).toEqual(
      expect.objectContaining({
        trialEndsAt: '2026-04-16T12:00:00.000Z',
      }),
    );

    expect(
      buildProvisionalPurchaseSnapshot({
        purchase: {
          id: 'android-invalid-trial',
          productId: 'floriva.monthly',
          transactionDate: Date.parse('2026-04-13T12:00:00.000Z'),
          packageNameAndroid: 'com.anonymous.floriva',
        } as Purchase,
        plan: {
          planId: 'monthly',
          productId: 'floriva.monthly',
          productType: 'subs',
          title: 'Monthly',
          displayPrice: '$5.99',
          freeTrialOfferTokenAndroid: 'monthly-trial-token',
          freeTrialPeriod: { unit: 'fortnight' as 'day', value: 1 },
          freeTrialPeriodCount: 1,
        },
        now,
      }),
    ).toEqual({
      accessState: 'subscribed',
      planId: 'monthly',
      expiresAt: undefined,
      lastSyncedAt: '2026-04-13T12:00:00.000Z',
    });
  });
});
