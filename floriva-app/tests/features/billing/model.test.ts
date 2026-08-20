import {
  buildBillingOfferings,
  buildFirstChargeReminderDate,
  deriveBillingSnapshotFromNativeState,
  normalizeBillingSnapshot,
  resolvePlanIdFromProductIdentifier,
} from '@/src/features/billing/model';
import type { BillingSnapshot } from '@/src/types/domain';

const billingConfig = {
  monthlyProductId: 'floriva.monthly',
  annualProductId: 'floriva.annual',
  lifetimeProductId: 'floriva.lifetime',
  reminderLeadDays: 3,
  reminderHour: 9,
  reminderMinute: 0,
  monthlyPriceLabel: '$5.99/month',
  annualPriceLabel: '$39.99/year',
  lifetimePriceLabel: '$59.99',
} as const;

const billingOfferingCopy = {
  annualTitle: 'Annual plan',
  annualTrialDetail: '1 month free, then billed yearly unless canceled first.',
  annualStandardDetail: 'Billed yearly unless canceled before the next renewal.',
  lifetimeTitle: 'Lifetime plan',
  lifetimeDetail: 'One-time purchase for lifetime access on this store account.',
  monthlyTitle: 'Monthly plan',
  monthlyTrialDetail: '1 month free, then billed monthly unless canceled first.',
  monthlyStandardDetail: 'Billed monthly unless canceled before the next renewal.',
} as const;

function createBillingState(
  overrides: Partial<{
    syncStatus: 'ready' | 'error';
    activeSubscriptions: {
      productId: string;
      isActive: boolean;
      expirationDate?: number | null;
      transactionDate?: number;
    }[];
    availablePurchases: {
      productId: string;
      transactionDate?: number;
    }[];
  }> = {},
) {
  return {
    syncStatus: 'ready' as const,
    activeSubscriptions: [] as {
      productId: string;
      isActive: boolean;
      expirationDate?: number | null;
      transactionDate?: number;
    }[],
    availablePurchases: [] as {
      productId: string;
      transactionDate?: number;
    }[],
    ...overrides,
  };
}

function createSnapshot(overrides: Partial<BillingSnapshot> = {}): BillingSnapshot {
  return {
    accessState: 'needs_purchase',
    ...overrides,
  };
}

describe('billing model', () => {
  it('derives a subscribed snapshot from an active native subscription', () => {
    expect(
      deriveBillingSnapshotFromNativeState({
        ...createBillingState({
          activeSubscriptions: [
            {
              productId: 'floriva.annual',
              isActive: true,
              expirationDate: Date.parse('2026-05-13T12:00:00.000Z'),
            },
          ],
        }),
        config: billingConfig,
        now: new Date('2026-04-13T12:00:00.000Z'),
      }),
    ).toEqual({
      accessState: 'subscribed',
      planId: 'annual',
      expiresAt: '2026-05-13T12:00:00.000Z',
      lastSyncedAt: '2026-04-13T12:00:00.000Z',
    });
  });

  it('preserves a locally cached trial snapshot while the native store still reports active access', () => {
    expect(
      deriveBillingSnapshotFromNativeState({
        ...createBillingState({
          activeSubscriptions: [
            {
              productId: 'floriva.annual',
              isActive: true,
            },
          ],
        }),
        previousSnapshot: createSnapshot({
          accessState: 'trial_active',
          planId: 'annual',
          trialEndsAt: '2026-05-09T10:00:00.000Z',
          firstChargeAt: '2026-05-09T10:00:00.000Z',
          expiresAt: '2026-05-09T10:00:00.000Z',
        }),
        config: billingConfig,
        now: new Date('2026-04-13T12:00:00.000Z'),
      }),
    ).toEqual({
      accessState: 'trial_active',
      planId: 'annual',
      trialEndsAt: '2026-05-09T10:00:00.000Z',
      firstChargeAt: '2026-05-09T10:00:00.000Z',
      expiresAt: '2026-05-09T10:00:00.000Z',
      lastSyncedAt: '2026-04-13T12:00:00.000Z',
    });
  });

  it('promotes an expired local trial snapshot to subscribed when the native store still reports the same plan as active', () => {
    expect(
      deriveBillingSnapshotFromNativeState({
        ...createBillingState({
          activeSubscriptions: [
            {
              productId: 'floriva.annual',
              isActive: true,
              expirationDate: Date.parse('2026-06-13T12:00:00.000Z'),
            },
          ],
        }),
        previousSnapshot: createSnapshot({
          accessState: 'trial_active',
          planId: 'annual',
          trialEndsAt: '2026-04-09T10:00:00.000Z',
          firstChargeAt: '2026-04-09T10:00:00.000Z',
          expiresAt: '2026-04-09T10:00:00.000Z',
        }),
        config: billingConfig,
        now: new Date('2026-04-13T12:00:00.000Z'),
      }),
    ).toEqual({
      accessState: 'subscribed',
      planId: 'annual',
      expiresAt: '2026-06-13T12:00:00.000Z',
      lastSyncedAt: '2026-04-13T12:00:00.000Z',
    });
  });

  it('preserves a consumed lifetime-trial marker when native state reconciles active recurring access', () => {
    expect(
      deriveBillingSnapshotFromNativeState({
        ...createBillingState({
          activeSubscriptions: [
            {
              productId: 'floriva.monthly',
              isActive: true,
              expirationDate: Date.parse('2026-06-13T12:00:00.000Z'),
            },
          ],
        }),
        previousSnapshot: createSnapshot({
          accessState: 'expired',
          planId: 'lifetime',
          trialEndsAt: '2026-04-01T12:00:00.000Z',
          lifetimeTrialStartedAt: '2026-03-01T12:00:00.000Z',
        }),
        config: billingConfig,
        now: new Date('2026-04-13T12:00:00.000Z'),
      }),
    ).toEqual({
      accessState: 'subscribed',
      planId: 'monthly',
      expiresAt: '2026-06-13T12:00:00.000Z',
      lifetimeTrialStartedAt: '2026-03-01T12:00:00.000Z',
      lastSyncedAt: '2026-04-13T12:00:00.000Z',
    });
  });

  it('marks previously active access as expired when the native store reports no active subscription', () => {
    expect(
      deriveBillingSnapshotFromNativeState({
        ...createBillingState({
          availablePurchases: [{ productId: 'floriva.annual' }],
        }),
        previousSnapshot: createSnapshot({
          accessState: 'subscribed',
          planId: 'annual',
          expiresAt: '2026-04-09T10:00:00.000Z',
        }),
        config: billingConfig,
        now: new Date('2026-04-13T12:00:00.000Z'),
      }),
    ).toEqual({
      accessState: 'expired',
      planId: 'annual',
      expiresAt: '2026-04-09T10:00:00.000Z',
      lastSyncedAt: '2026-04-13T12:00:00.000Z',
    });
  });

  it('returns needs_purchase when the native store reports no active access and there is no access history', () => {
    expect(
      deriveBillingSnapshotFromNativeState({
        ...createBillingState(),
        config: billingConfig,
        now: new Date('2026-04-13T12:00:00.000Z'),
      }),
    ).toEqual({
      accessState: 'needs_purchase',
      lastSyncedAt: '2026-04-13T12:00:00.000Z',
    });
  });

  it('returns sync_error when the native store cannot determine status and no safe cache exists', () => {
    expect(
      deriveBillingSnapshotFromNativeState({
        ...createBillingState({
          syncStatus: 'error',
        }),
        config: billingConfig,
        now: new Date('2026-04-13T12:00:00.000Z'),
      }),
    ).toEqual({
      accessState: 'sync_error',
      lastSyncedAt: '2026-04-13T12:00:00.000Z',
    });
  });

  it('keeps a safe cached access state when native billing status is temporarily unavailable', () => {
    expect(
      deriveBillingSnapshotFromNativeState({
        ...createBillingState({
          syncStatus: 'error',
        }),
        previousSnapshot: createSnapshot({
          accessState: 'subscribed',
          planId: 'lifetime',
        }),
        config: billingConfig,
        now: new Date('2026-04-13T12:00:00.000Z'),
      }),
    ).toEqual({
      accessState: 'subscribed',
      planId: 'lifetime',
      lastSyncedAt: '2026-04-13T12:00:00.000Z',
    });
  });

  it('derives lifetime access from a non-consumable purchase record', () => {
    expect(
      deriveBillingSnapshotFromNativeState({
        ...createBillingState({
          availablePurchases: [{ productId: 'floriva.lifetime' }],
        }),
        config: billingConfig,
        now: new Date('2026-04-13T12:00:00.000Z'),
      }),
    ).toEqual({
      accessState: 'subscribed',
      planId: 'lifetime',
      lastSyncedAt: '2026-04-13T12:00:00.000Z',
    });
  });

  it('preserves future-dated legacy timed access when the native store has no matching purchase history yet', () => {
    expect(
      deriveBillingSnapshotFromNativeState({
        ...createBillingState(),
        previousSnapshot: {
          accessState: 'complimentary_active',
          expiresAt: '2026-05-09T10:00:00.000Z',
          lastSyncedAt: '2026-04-10T12:00:00.000Z',
        },
        config: billingConfig,
        now: new Date('2026-04-13T12:00:00.000Z'),
      }),
    ).toEqual({
      accessState: 'subscribed',
      expiresAt: '2026-05-09T10:00:00.000Z',
      lastSyncedAt: '2026-04-13T12:00:00.000Z',
    });
  });

  it('preserves an Android trial snapshot while the native store still reports the same plan as active', () => {
    expect(
      deriveBillingSnapshotFromNativeState({
        ...createBillingState({
          activeSubscriptions: [
            {
              productId: 'floriva.monthly',
              isActive: true,
              transactionDate: Date.parse('2026-04-13T12:00:00.000Z'),
            },
          ],
        }),
        previousSnapshot: createSnapshot({
          accessState: 'trial_active',
          planId: 'monthly',
          trialEndsAt: '2026-05-13T12:00:00.000Z',
          firstChargeAt: '2026-05-13T12:00:00.000Z',
          expiresAt: '2026-05-13T12:00:00.000Z',
        }),
        config: billingConfig,
        now: new Date('2026-04-13T12:00:00.000Z'),
      }),
    ).toEqual({
      accessState: 'trial_active',
      planId: 'monthly',
      trialEndsAt: '2026-05-13T12:00:00.000Z',
      firstChargeAt: '2026-05-13T12:00:00.000Z',
      expiresAt: '2026-05-13T12:00:00.000Z',
      lastSyncedAt: '2026-04-13T12:00:00.000Z',
    });
  });

  it('keeps lifetime access even when newer recurring purchase history is also present', () => {
    expect(
      deriveBillingSnapshotFromNativeState({
        ...createBillingState({
          availablePurchases: [
            {
              productId: 'floriva.monthly',
              transactionDate: Date.parse('2026-04-13T12:00:00.000Z'),
            },
            {
              productId: 'floriva.lifetime',
              transactionDate: Date.parse('2026-04-01T12:00:00.000Z'),
            },
          ],
        }),
        config: billingConfig,
        now: new Date('2026-04-13T12:00:00.000Z'),
      }),
    ).toEqual({
      accessState: 'subscribed',
      planId: 'lifetime',
      lastSyncedAt: '2026-04-13T12:00:00.000Z',
    });
  });

  it('preserves a non-expired app-level lifetime trial across a store sync with no purchase', () => {
    expect(
      deriveBillingSnapshotFromNativeState({
        ...createBillingState(),
        previousSnapshot: createSnapshot({
          accessState: 'trial_active',
          planId: 'lifetime',
          trialEndsAt: '2026-08-08T12:00:00.000Z',
          lifetimeTrialStartedAt: '2026-07-08T12:00:00.000Z',
        }),
        config: billingConfig,
        now: new Date('2026-07-10T12:00:00.000Z'),
      }),
    ).toEqual({
      accessState: 'trial_active',
      planId: 'lifetime',
      trialEndsAt: '2026-08-08T12:00:00.000Z',
      lifetimeTrialStartedAt: '2026-07-08T12:00:00.000Z',
      lastSyncedAt: '2026-07-10T12:00:00.000Z',
    });
  });

  it('lets a real lifetime purchase supersede an in-progress app-level lifetime trial', () => {
    expect(
      deriveBillingSnapshotFromNativeState({
        ...createBillingState({
          availablePurchases: [{ productId: 'floriva.lifetime' }],
        }),
        previousSnapshot: createSnapshot({
          accessState: 'trial_active',
          planId: 'lifetime',
          trialEndsAt: '2026-08-08T12:00:00.000Z',
          lifetimeTrialStartedAt: '2026-07-08T12:00:00.000Z',
        }),
        config: billingConfig,
        now: new Date('2026-07-10T12:00:00.000Z'),
      }),
    ).toEqual({
      accessState: 'subscribed',
      planId: 'lifetime',
      lifetimeTrialStartedAt: '2026-07-08T12:00:00.000Z',
      lastSyncedAt: '2026-07-10T12:00:00.000Z',
    });
  });

  it('does not preserve an expired app-level lifetime trial, keeping the durable marker', () => {
    expect(
      deriveBillingSnapshotFromNativeState({
        ...createBillingState(),
        previousSnapshot: createSnapshot({
          accessState: 'trial_active',
          planId: 'lifetime',
          trialEndsAt: '2026-07-08T12:00:00.000Z',
          lifetimeTrialStartedAt: '2026-06-08T12:00:00.000Z',
        }),
        config: billingConfig,
        now: new Date('2026-07-10T12:00:00.000Z'),
      }),
    ).toEqual({
      accessState: 'expired',
      planId: 'lifetime',
      trialEndsAt: '2026-07-08T12:00:00.000Z',
      lifetimeTrialStartedAt: '2026-06-08T12:00:00.000Z',
      lastSyncedAt: '2026-07-10T12:00:00.000Z',
    });
  });

  it('does not extend the lifetime-trial preservation to markerless cached trials', () => {
    expect(
      deriveBillingSnapshotFromNativeState({
        ...createBillingState(),
        previousSnapshot: createSnapshot({
          accessState: 'trial_active',
          trialEndsAt: '2026-08-08T12:00:00.000Z',
        }),
        config: billingConfig,
        now: new Date('2026-07-10T12:00:00.000Z'),
      }),
    ).toEqual({
      accessState: 'expired',
      trialEndsAt: '2026-08-08T12:00:00.000Z',
      lastSyncedAt: '2026-07-10T12:00:00.000Z',
    });
  });

  it('normalizes expired trial access before the app trusts the cache locally', () => {
    expect(
      normalizeBillingSnapshot(
        createSnapshot({
          accessState: 'trial_active',
          planId: 'monthly',
          trialEndsAt: '2026-04-10T10:00:00.000Z',
          firstChargeAt: '2026-04-10T10:00:00.000Z',
        }),
        new Date('2026-04-13T12:00:00.000Z'),
      ),
    ).toEqual({
      accessState: 'expired',
      planId: 'monthly',
      trialEndsAt: '2026-04-10T10:00:00.000Z',
      firstChargeAt: '2026-04-10T10:00:00.000Z',
    });
  });

  it('normalizes expired recurring subscriptions before the app trusts the cache locally', () => {
    expect(
      normalizeBillingSnapshot(
        createSnapshot({
          accessState: 'subscribed',
          planId: 'monthly',
          expiresAt: '2026-04-10T10:00:00.000Z',
        }),
        new Date('2026-04-13T12:00:00.000Z'),
      ),
    ).toEqual({
      accessState: 'expired',
      planId: 'monthly',
      expiresAt: '2026-04-10T10:00:00.000Z',
    });
  });

  it('normalizes legacy complimentary snapshots into active paid access when they have not expired', () => {
    expect(
      normalizeBillingSnapshot(
        {
          accessState: 'complimentary_active',
          expiresAt: '2026-05-10T10:00:00.000Z',
        },
        new Date('2026-04-13T12:00:00.000Z'),
      ),
    ).toEqual({
      accessState: 'subscribed',
      expiresAt: '2026-05-10T10:00:00.000Z',
    });
  });

  it('sorts native billing offerings annual-first and ignores unknown products', () => {
    expect(
      buildBillingOfferings(
        [
          {
            id: 'unknown.product',
            title: 'Unknown',
            displayPrice: '$0.00',
          },
          {
            id: 'floriva.monthly',
            title: 'Monthly',
            displayPrice: '$5.99',
          },
          {
            id: 'floriva.lifetime',
            title: 'Lifetime',
            displayPrice: '$59.99',
          },
          {
            id: 'floriva.annual',
            title: 'Annual',
            displayPrice: '$39.99',
          },
        ],
        billingConfig,
        billingOfferingCopy,
      ).map((offering) => offering.planId),
    ).toEqual(['annual', 'lifetime', 'monthly']);
  });

  it('builds a first-charge reminder relative to the stored first charge date', () => {
    const expectedLocalReminderDate = new Date(2026, 4, 6, 9, 0, 0, 0);

    expect(
      buildFirstChargeReminderDate(
        createSnapshot({
          accessState: 'trial_active',
          planId: 'annual',
          firstChargeAt: '2026-05-09T10:00:00.000Z',
        }),
        billingConfig,
        new Date('2026-04-13T12:00:00.000Z'),
      )?.toISOString(),
    ).toBe(expectedLocalReminderDate.toISOString());
  });

  it('schedules a first-charge reminder for a grandfathered trial snapshot without a plan id', () => {
    const expectedLocalReminderDate = new Date(2026, 5, 25, 9, 0, 0, 0);

    expect(
      buildFirstChargeReminderDate(
        createSnapshot({
          accessState: 'trial_active',
          planId: undefined,
          firstChargeAt: '2026-06-28T09:00:00.000Z',
        }),
        billingConfig,
        new Date('2026-06-08T12:00:00.000Z'),
      )?.toISOString(),
    ).toBe(expectedLocalReminderDate.toISOString());
  });

  it('does not schedule a reminder for an expired grandfathered trial with a past first charge', () => {
    expect(
      buildFirstChargeReminderDate(
        createSnapshot({
          accessState: 'expired',
          planId: undefined,
          firstChargeAt: '2026-05-09T09:00:00.000Z',
        }),
        billingConfig,
        new Date('2026-06-08T12:00:00.000Z'),
      ),
    ).toBeNull();
  });

  it('does not schedule a first-charge reminder for lifetime access', () => {
    expect(
      buildFirstChargeReminderDate(
        createSnapshot({
          accessState: 'subscribed',
          planId: 'lifetime',
          firstChargeAt: '2026-05-09T10:00:00.000Z',
        }),
        billingConfig,
        new Date('2026-04-13T12:00:00.000Z'),
      ),
    ).toBeNull();
  });

  it('does not schedule a first-charge reminder when there is no trustworthy first-charge date', () => {
    expect(
      buildFirstChargeReminderDate(
        createSnapshot({
          accessState: 'subscribed',
          planId: 'annual',
        }),
        billingConfig,
        new Date('2026-04-13T12:00:00.000Z'),
      ),
    ).toBeNull();
  });

  it('resolves plan ids from explicit, predefined, and fuzzy identifiers', () => {
    expect(resolvePlanIdFromProductIdentifier('', billingConfig)).toBeUndefined();
    expect(resolvePlanIdFromProductIdentifier('yearly', billingConfig)).toBe('annual');
    expect(resolvePlanIdFromProductIdentifier('annual plan', billingConfig)).toBe('annual');
    expect(resolvePlanIdFromProductIdentifier('monthly plan', billingConfig)).toBe('monthly');
    expect(resolvePlanIdFromProductIdentifier('lifetime access', billingConfig)).toBe('lifetime');
  });

  it('prefers active recurring subscriptions and ignores inactive or lifetime entries', () => {
    expect(
      deriveBillingSnapshotFromNativeState({
        ...createBillingState({
          activeSubscriptions: [
            {
              productId: 'floriva.annual',
              isActive: false,
              expirationDate: Date.parse('2026-06-13T12:00:00.000Z'),
            },
            {
              productId: 'floriva.lifetime',
              isActive: true,
            },
            {
              productId: 'floriva.monthly',
              isActive: true,
              transactionDate: Date.parse('2026-04-12T12:00:00.000Z'),
            },
            {
              productId: 'floriva.annual',
              isActive: true,
              expirationDate: Number.NaN as number,
            },
          ],
        }),
        config: billingConfig,
        now: new Date('2026-04-13T12:00:00.000Z'),
      }),
    ).toEqual({
      accessState: 'subscribed',
      planId: 'annual',
      lastSyncedAt: '2026-04-13T12:00:00.000Z',
    });
  });

  it('falls back to the newest known purchase and uses plan priority for ties', () => {
    expect(
      deriveBillingSnapshotFromNativeState({
        ...createBillingState({
          availablePurchases: [
            {
              productId: 'unknown.product',
              transactionDate: Date.parse('2026-04-13T12:00:00.000Z'),
            },
            {
              productId: 'floriva.monthly',
              transactionDate: Date.parse('2026-04-13T12:00:00.000Z'),
            },
            {
              productId: 'floriva.annual',
              transactionDate: Date.parse('2026-04-13T12:00:00.000Z'),
            },
          ],
        }),
        config: billingConfig,
        now: new Date('2026-04-13T12:00:00.000Z'),
      }),
    ).toEqual({
      accessState: 'expired',
      planId: 'annual',
      lastSyncedAt: '2026-04-13T12:00:00.000Z',
    });
  });

  it('returns the unexpired trial snapshot unchanged when no expiration date is available', () => {
    expect(
      normalizeBillingSnapshot(
        {
          accessState: 'trial_active',
          planId: 'annual',
        },
        new Date('2026-04-13T12:00:00.000Z'),
      ),
    ).toEqual({
      accessState: 'trial_active',
      planId: 'annual',
    });
  });

  it('does not schedule a reminder once the reminder date has already passed', () => {
    expect(
      buildFirstChargeReminderDate(
        createSnapshot({
          accessState: 'trial_active',
          planId: 'annual',
          firstChargeAt: '2026-04-14T10:00:00.000Z',
        }),
        billingConfig,
        new Date('2026-04-13T12:00:00.000Z'),
      ),
    ).toBeNull();
  });
});
