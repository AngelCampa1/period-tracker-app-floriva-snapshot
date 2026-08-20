jest.mock('@/src/features/billing/config', () => ({
  florivaRuntimeBillingConfig: {
    monthlyProductId: 'floriva.monthly',
    annualProductId: 'floriva.annual',
    lifetimeProductId: 'floriva.lifetime',
    monthlyPriceLabel: '$5.99/month',
    annualPriceLabel: '$39.99/year',
    lifetimePriceLabel: '$59.99',
    reminderLeadDays: 3,
    reminderHour: 9,
    reminderMinute: 0,
    privacyPolicyUrl: 'https://floriva.app/privacy',
    supportUrl: 'https://floriva.app/support',
    managementUrl: 'https://apps.apple.com/account/subscriptions',
  },
}));

// eslint-disable-next-line import/first
import {
  addSubscriptionPeriodToDate,
  buildBillingOfferingCopy,
  buildConfiguredProductIds,
  buildMissingConfigSnapshot,
  buildProvisionalPurchaseSnapshot,
  buildTrialSnapshotCandidate,
  getPlanConfig,
  getPurchaseExpirationDate,
  mapCatalogPlans,
  mapCatalogProducts,
  pickAndroidOfferToken,
  snapshotUnlocksPaidAccess,
  type CatalogPlan,
} from '@/src/features/billing/providerHelpers';

describe('billing provider helpers', () => {
  const annualPlan: CatalogPlan = {
    planId: 'annual',
    productId: 'floriva.annual',
    productType: 'subs',
    title: 'Annual',
    displayPrice: '$39.99',
    offerTokenAndroid: 'annual-token',
    freeTrialOfferTokenAndroid: 'annual-trial-token',
    freeTrialPeriod: { unit: 'month', value: 1 },
    freeTrialPeriodCount: 1,
  };

  it('builds configured product ids and plan config lookups from runtime billing ids', () => {
    expect(buildConfiguredProductIds()).toEqual([
      'floriva.monthly',
      'floriva.annual',
      'floriva.lifetime',
    ]);
    expect(getPlanConfig('annual')).toBe('floriva.annual');
    expect(getPlanConfig('monthly')).toBe('floriva.monthly');
    expect(getPlanConfig('lifetime')).toBe('floriva.lifetime');
  });

  it('maps and sorts known catalog plans while skipping unrelated products', () => {
    const plans = mapCatalogPlans([
      {
        id: 'unknown.sku',
        title: 'Unknown',
        displayPrice: '$1.00',
        type: 'subs',
        subscriptionOffers: [],
      } as never,
      {
        id: 'floriva.monthly',
        title: 'Monthly',
        displayPrice: '$5.99',
        type: 'subs',
        subscriptionOffers: [
          {
            id: 'monthly-trial',
            displayPrice: '$5.99',
            paymentMode: 'free-trial',
            offerTokenAndroid: 'monthly-trial-token',
            period: { unit: 'month', value: 1 },
            periodCount: 1,
          },
        ],
      } as never,
      {
        id: 'floriva.lifetime',
        title: 'Lifetime',
        displayPrice: '$59.99',
        type: 'in-app',
      } as never,
      {
        id: 'floriva.annual',
        title: 'Annual',
        displayPrice: '$39.99',
        type: 'subs',
        subscriptionOffers: [
          {
            id: 'annual-trial',
            displayPrice: '$39.99',
            paymentMode: 'free-trial',
            offerTokenAndroid: 'annual-trial-token',
            period: { unit: 'month', value: 1 },
            periodCount: 1,
          },
        ],
      } as never,
    ]);

    expect(plans.map((plan) => plan.planId)).toEqual(['annual', 'lifetime', 'monthly']);
    expect(mapCatalogProducts(plans)).toEqual([
      {
        id: 'floriva.annual',
        title: 'Annual',
        displayPrice: '$39.99',
        hasFreeTrial: true,
      },
      {
        id: 'floriva.lifetime',
        title: 'Lifetime',
        displayPrice: '$59.99',
        hasFreeTrial: false,
      },
      {
        id: 'floriva.monthly',
        title: 'Monthly',
        displayPrice: '$5.99',
        hasFreeTrial: true,
      },
    ]);
  });

  it('picks Android offer tokens from free-trial, regular offer, and subscription details fallbacks', () => {
    expect(
      pickAndroidOfferToken({
        type: 'subs',
        subscriptionOffers: [
          {
            paymentMode: 'free-trial',
            offerTokenAndroid: 'trial-token',
          },
        ],
      } as never),
    ).toBe('trial-token');

    expect(
      pickAndroidOfferToken({
        type: 'subs',
        subscriptionOffers: [
          {
            paymentMode: 'pay-as-you-go',
            offerTokenAndroid: 'regular-token',
          },
        ],
      } as never),
    ).toBe('regular-token');

    expect(
      pickAndroidOfferToken({
        type: 'subs',
        subscriptionOffers: [],
        subscriptionOfferDetailsAndroid: [{ offerToken: 'details-token' }],
      } as never),
    ).toBe('details-token');
  });

  it('preserves safe cached access states when billing config is missing', () => {
    expect(buildMissingConfigSnapshot({ accessState: 'subscribed' })).toEqual({
      accessState: 'subscribed',
    });
    expect(buildMissingConfigSnapshot({ accessState: 'needs_purchase' })).toEqual({
      accessState: 'sync_error',
    });
  });

  it('adds subscription periods across supported units and rejects invalid periods', () => {
    const startDate = new Date('2026-04-10T12:00:00.000Z');

    expect(addSubscriptionPeriodToDate(startDate, { unit: 'day', value: 2 })?.toISOString()).toBe(
      '2026-04-12T12:00:00.000Z',
    );
    expect(addSubscriptionPeriodToDate(startDate, { unit: 'week', value: 1 })?.toISOString()).toBe(
      '2026-04-17T12:00:00.000Z',
    );
    expect(addSubscriptionPeriodToDate(startDate, { unit: 'month', value: 1 })?.toISOString()).toBe(
      '2026-05-10T12:00:00.000Z',
    );
    expect(addSubscriptionPeriodToDate(startDate, { unit: 'year', value: 1 })?.toISOString()).toBe(
      '2027-04-10T12:00:00.000Z',
    );
    expect(addSubscriptionPeriodToDate(startDate, { unit: 'month', value: 0 })).toBeNull();
    expect(addSubscriptionPeriodToDate(startDate, { unit: 'era' as never, value: 1 })).toBeNull();
  });

  it('builds trial snapshots for confirmed iOS and Android free-trial purchases', () => {
    const now = new Date('2026-04-10T12:00:00.000Z');

    expect(
      buildTrialSnapshotCandidate({
        purchase: {
          offerIOS: { paymentMode: 'free-trial' },
          expirationDateIOS: Date.parse('2026-05-10T12:00:00.000Z'),
        } as never,
        plan: annualPlan,
        now,
      }),
    ).toEqual({
      accessState: 'trial_active',
      planId: 'annual',
      trialEndsAt: '2026-05-10T12:00:00.000Z',
      firstChargeAt: '2026-05-10T12:00:00.000Z',
      expiresAt: '2026-05-10T12:00:00.000Z',
      lastSyncedAt: '2026-04-10T12:00:00.000Z',
    });

    expect(
      buildTrialSnapshotCandidate({
        purchase: {
          packageNameAndroid: 'app.floriva',
          transactionDate: Date.parse('2026-04-10T12:00:00.000Z'),
        } as never,
        plan: {
          ...annualPlan,
          freeTrialPeriod: { unit: 'week', value: 1 },
        },
        now,
      }),
    ).toEqual({
      accessState: 'trial_active',
      planId: 'annual',
      trialEndsAt: '2026-04-17T12:00:00.000Z',
      firstChargeAt: '2026-04-17T12:00:00.000Z',
      expiresAt: '2026-04-17T12:00:00.000Z',
      lastSyncedAt: '2026-04-10T12:00:00.000Z',
    });
  });

  it('returns undefined for non-trial or incomplete purchase data', () => {
    const now = new Date('2026-04-10T12:00:00.000Z');

    expect(
      buildTrialSnapshotCandidate({
        purchase: {
          expirationDateIOS: Date.parse('2026-05-10T12:00:00.000Z'),
        } as never,
        plan: annualPlan,
        now,
      }),
    ).toBeUndefined();

    expect(
      buildTrialSnapshotCandidate({
        purchase: {
          packageNameAndroid: 'app.floriva',
        } as never,
        plan: {
          ...annualPlan,
          freeTrialOfferTokenAndroid: null,
        },
        now,
      }),
    ).toBeUndefined();

    expect(
      buildTrialSnapshotCandidate({
        purchase: {
          packageNameAndroid: 'app.floriva',
          transactionDate: Date.parse('2026-04-10T12:00:00.000Z'),
        } as never,
        plan: {
          ...annualPlan,
          freeTrialPeriod: { unit: 'era' as never, value: 1 },
        },
        now,
      }),
    ).toBeUndefined();
  });

  it('builds subscribed snapshots and purchase expiration labels when no trial applies', () => {
    const now = new Date('2026-04-10T12:00:00.000Z');
    const purchase = {
      expirationDateIOS: Date.parse('2026-05-10T12:00:00.000Z'),
    } as never;

    expect(getPurchaseExpirationDate({} as never)).toBeUndefined();
    expect(getPurchaseExpirationDate({ expirationDateIOS: null } as never)).toBeUndefined();
    expect(getPurchaseExpirationDate(purchase)).toBe('2026-05-10T12:00:00.000Z');

    expect(
      buildProvisionalPurchaseSnapshot({
        purchase,
        plan: annualPlan,
        now,
      }),
    ).toEqual({
      accessState: 'subscribed',
      planId: 'annual',
      expiresAt: '2026-05-10T12:00:00.000Z',
      lastSyncedAt: '2026-04-10T12:00:00.000Z',
    });
  });

  it('reports which billing snapshots unlock paid access and builds localized copy keys', () => {
    const t = jest.fn((key: string) => key);

    expect(snapshotUnlocksPaidAccess({ accessState: 'trial_active' })).toBe(true);
    expect(snapshotUnlocksPaidAccess({ accessState: 'subscribed' })).toBe(true);
    expect(snapshotUnlocksPaidAccess({ accessState: 'needs_purchase' })).toBe(false);
    expect(snapshotUnlocksPaidAccess(undefined)).toBe(false);
    expect(buildBillingOfferingCopy(t)).toEqual({
      annualTitle: 'settings.subscription.planLabels.annual',
      annualTrialDetail: 'billing.offerings.annualTrialDetail',
      annualStandardDetail: 'billing.offerings.annualStandardDetail',
      lifetimeTitle: 'settings.subscription.planLabels.lifetime',
      lifetimeDetail: 'billing.offerings.lifetimeDetail',
      monthlyTitle: 'settings.subscription.planLabels.monthly',
      monthlyTrialDetail: 'billing.offerings.monthlyTrialDetail',
      monthlyStandardDetail: 'billing.offerings.monthlyStandardDetail',
    });
  });
});
