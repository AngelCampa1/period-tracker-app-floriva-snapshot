import { useLayoutEffect, useRef } from 'react';
import { Platform, Text } from 'react-native';
import {
  act,
  configure,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

const mockGetSnapshot = jest.fn();
const mockSaveSnapshot = jest.fn();
const mockApplyBillingSnapshot = jest.fn();
const mockReconcileBillingReminderNotification = jest.fn();
const mockOpenURL = jest.fn();
const mockSetStringAsync = jest.fn();
const mockReportRuntimeDiagnostic = jest.fn();
const mockResolveDevLaunchPreset = jest.fn<string | null, []>(() => null);
const mockT = jest.fn((key: string) => key);
const mockFetchProducts = jest.fn();
const mockGetAvailablePurchases = jest.fn();
const mockGetActiveSubscriptions = jest.fn();
const mockUseIAP = jest.fn();
const mockPresentCodeRedemptionSheetIOS = jest.fn();
let latestUseIAPOptions:
  | {
      onError?: (error: { message?: string } | string) => void;
    }
  | undefined;
const mockReconnect = jest.fn();
const mockRequestPurchase = jest.fn();
const mockFinishTransaction = jest.fn();
const mockRestorePurchases = jest.fn();
const mockHasNativeBillingConfig = jest.fn(() => true);
const mockPrivacyPreference = {
  biometricsEnabled: false,
  relockAfterSeconds: 60,
  diagnosticsConsentEnabled: false,
};

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({
    repositories: {
      billingSnapshot: {
        getSnapshot: () => mockGetSnapshot(),
        saveSnapshot: (...args: unknown[]) => mockSaveSnapshot(...args),
      },
    },
  }),
}));

jest.mock('@/src/features/app-shell/AppShellProvider', () => ({
  useAppShell: () => ({
    applyBillingSnapshot: (...args: unknown[]) => mockApplyBillingSnapshot(...args),
    privacyPreference: mockPrivacyPreference,
  }),
}));

jest.mock('@/src/localization/LocalizationProvider', () => ({
  useLocalization: () => ({
    t: mockT,
  }),
}));

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
    saveOffers: {
      monthly: {
        discountedPriceLabel: '$1.20/month',
        iosOfferCode: 'SAVEMONTHLY',
        androidOfferId: 'save-monthly-80-3mo',
      },
      annual: {
        discountedPriceLabel: '$27.99',
        iosOfferCode: 'SAVEANNUAL',
        androidOfferId: 'save-annual-30',
      },
    },
  },
  getManageSubscriptionUrlFallback: () => 'https://apps.apple.com/account/subscriptions',
  hasNativeBillingConfig: () => mockHasNativeBillingConfig(),
}));

jest.mock('@/src/lib/notifications/reminderScheduler', () => ({
  reconcileBillingReminderNotification: (...args: unknown[]) =>
    mockReconcileBillingReminderNotification(...args),
}));

jest.mock('expo-linking', () => ({
  openURL: (...args: unknown[]) => mockOpenURL(...args),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: (...args: unknown[]) => mockSetStringAsync(...args),
}));

jest.mock('@/src/lib/diagnostics/runtimeDiagnostics', () => ({
  reportRuntimeDiagnostic: (...args: unknown[]) => mockReportRuntimeDiagnostic(...args),
}));

jest.mock('@/src/testing/devLaunchPreset', () => ({
  resolveDevLaunchPreset: () => mockResolveDevLaunchPreset(),
}));

jest.mock('expo-iap', () => ({
  ErrorCode: {
    UserCancelled: 'user-cancelled',
  },
  fetchProducts: (...args: unknown[]) => mockFetchProducts(...args),
  getAvailablePurchases: (...args: unknown[]) => mockGetAvailablePurchases(...args),
  getActiveSubscriptions: (...args: unknown[]) => mockGetActiveSubscriptions(...args),
  presentCodeRedemptionSheetIOS: (...args: unknown[]) =>
    mockPresentCodeRedemptionSheetIOS(...args),
  useIAP: (...args: unknown[]) => mockUseIAP(...args),
}));

function installUseIapMock(connected = true) {
  mockUseIAP.mockImplementation(
    (options?: { onError?: (error: { message?: string } | string) => void }) => {
      latestUseIAPOptions = options;

      return {
        connected,
        reconnect: (...args: unknown[]) => mockReconnect(...args),
        requestPurchase: (...args: unknown[]) => mockRequestPurchase(...args),
        finishTransaction: (...args: unknown[]) => mockFinishTransaction(...args),
        restorePurchases: (...args: unknown[]) => mockRestorePurchases(...args),
      };
    },
  );
}

installUseIapMock();

// eslint-disable-next-line import/first
import { BillingProvider, useBilling } from '@/src/features/billing/BillingProvider';
// eslint-disable-next-line import/first
import { florivaRuntimeBillingConfig } from '@/src/features/billing/config';
// eslint-disable-next-line import/first
import { resolveSaveOffer } from '@/src/features/billing/saveOffer/model';
// eslint-disable-next-line import/first
import type { SaveOffer } from '@/src/features/billing/saveOffer/types';
// eslint-disable-next-line import/first
import type { RedeemResult } from '@/src/features/billing/saveOffer/redeem';

const platformOsDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');

function setPlatformOs(nextOs: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    get: () => nextOs,
  });
}

let pendingSaveOffer: SaveOffer | null = null;
let lastRedeemResult: RedeemResult | null = null;

function BillingProbe() {
  const billing = useBilling();

  return (
    <>
      <Text testID="status">{billing.snapshot.accessState}</Text>
      <Text testID="is-hydrated">{String(billing.isHydrated)}</Text>
      <Text testID="plan">{billing.snapshot.planId ?? 'none'}</Text>
      <Text testID="save-offer-redeemed-at">
        {billing.snapshot.saveOfferRedeemedAt ?? 'none'}
      </Text>
      <Text
        testID="redeem-save-offer"
        onPress={() => {
          if (pendingSaveOffer) {
            void billing.redeemSaveOffer(pendingSaveOffer).then((result) => {
              lastRedeemResult = result;
            });
          }
        }}
      >
        redeem save offer
      </Text>
      <Text testID="offerings">{String(billing.offerings.length)}</Text>
      <Text testID="offering-availability">
        {billing.offerings
          .map((offering) => `${offering.planId}:${String(offering.isPurchaseAvailable)}`)
          .join(',')}
      </Text>
      <Text testID="message">{billing.statusMessage ?? 'none'}</Text>
      <Text testID="is-refreshing">{String(billing.isRefreshing)}</Text>
      <Text testID="is-restoring">{String(billing.isRestoring)}</Text>
      <Text testID="purchasing-plan">{billing.purchasingPlanId ?? 'none'}</Text>
      <Text
        testID="buy-annual"
        onPress={() => {
          void billing.purchasePlan('annual');
        }}
      >
        buy annual
      </Text>
      <Text
        testID="buy-lifetime"
        onPress={() => {
          void billing.purchasePlan('lifetime');
        }}
      >
        buy lifetime
      </Text>
      <Text testID="lifetime-eligible">{String(billing.lifetimeTrialEligible)}</Text>
      <Text testID="lifetime-trial-started-at">
        {billing.snapshot.lifetimeTrialStartedAt ?? 'none'}
      </Text>
      <Text
        testID="start-lifetime-trial"
        onPress={() => {
          void billing.startLifetimeTrial();
        }}
      >
        start lifetime trial
      </Text>
      <Text
        testID="restore"
        onPress={() => {
          void billing.presentRestorePaywall();
        }}
      >
        restore
      </Text>
      <Text
        testID="refresh"
        onPress={() => {
          void billing.refreshBilling();
        }}
      >
        refresh
      </Text>
      <Text
        testID="manage"
        onPress={() => {
          void billing.openManageSubscriptions();
        }}
      >
        manage
      </Text>
    </>
  );
}

function DirectBillingActionProbe({ offer }: { offer: SaveOffer }) {
  const billing = useBilling();

  return (
    <>
      <Text testID="direct-buy-annual" onPress={() => billing.purchasePlan('annual')}>
        buy annual directly
      </Text>
      <Text testID="direct-buy-monthly" onPress={() => billing.purchasePlan('monthly')}>
        buy monthly directly
      </Text>
      <Text testID="direct-restore" onPress={() => billing.presentRestorePaywall()}>
        restore directly
      </Text>
      <Text testID="direct-redeem" onPress={() => billing.redeemSaveOffer(offer)}>
        redeem directly
      </Text>
    </>
  );
}

function HydratedLayoutEffectPurchaseProbe() {
  const { isHydrated, purchasePlan } = useBilling();
  const didPurchaseRef = useRef(false);

  useLayoutEffect(() => {
    if (!isHydrated || didPurchaseRef.current) {
      return;
    }

    didPurchaseRef.current = true;
    void purchasePlan('annual');
  }, [isHydrated, purchasePlan]);

  return <Text testID="layout-hydrated">{String(isHydrated)}</Text>;
}

function HydratedLayoutEffectLifetimeActionProbe({
  action,
}: {
  action: 'start' | 'purchase';
}) {
  const { isHydrated, purchasePlan, startLifetimeTrial } = useBilling();
  const didActRef = useRef(false);

  useLayoutEffect(() => {
    if (!isHydrated || didActRef.current) {
      return;
    }

    didActRef.current = true;
    if (action === 'start') {
      void startLifetimeTrial();
      return;
    }

    void purchasePlan('lifetime');
  }, [action, isHydrated, purchasePlan, startLifetimeTrial]);

  return <Text testID="layout-hydrated">{String(isHydrated)}</Text>;
}

const annualSaveOffer: SaveOffer = {
  kind: 'annual30',
  planId: 'annual',
  discountedPriceLabel: '$27.99',
  fullPriceLabel: '$39.99/year',
  redemption: { platform: 'ios', offerCode: 'SAVEANNUAL' },
};

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
}

const catalogProducts = {
  annual: {
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
      {
        id: 'save-annual-30',
        displayPrice: '$27.99',
        paymentMode: 'single-payment',
        offerTokenAndroid: 'annual-save-token',
        period: { unit: 'year', value: 1 },
        periodCount: 1,
      },
    ],
  },
  lifetime: {
    id: 'floriva.lifetime',
    title: 'Lifetime',
    displayPrice: '$59.99',
    type: 'in-app',
  },
  monthly: {
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
      {
        id: 'save-monthly-80-3mo',
        displayPrice: '$1.20',
        paymentMode: 'pay-as-you-go',
        offerTokenAndroid: 'monthly-save-token',
        period: { unit: 'month', value: 1 },
        periodCount: 3,
      },
    ],
  },
};

function installCatalogFetchMock() {
  mockFetchProducts.mockImplementation(({ type }: { type: string }) => {
    if (type === 'subs') {
      return Promise.resolve([catalogProducts.annual, catalogProducts.monthly]);
    }

    if (type === 'in-app') {
      return Promise.resolve([catalogProducts.lifetime]);
    }

    return Promise.resolve([]);
  });
}

describe('BillingProvider', () => {
  beforeAll(() => {
    configure({ asyncUtilTimeout: 5000 });
  });

  beforeEach(() => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-04-13T12:00:00.000Z').getTime());
    mockGetSnapshot.mockReset();
    mockSaveSnapshot.mockReset();
    mockApplyBillingSnapshot.mockReset();
    mockReconcileBillingReminderNotification.mockReset();
    mockOpenURL.mockReset();
    mockSetStringAsync.mockReset();
    mockReportRuntimeDiagnostic.mockReset();
    mockResolveDevLaunchPreset.mockReset();
    mockT.mockClear();
    mockFetchProducts.mockReset();
    mockGetAvailablePurchases.mockReset();
    mockGetActiveSubscriptions.mockReset();
    mockUseIAP.mockClear();
    mockPresentCodeRedemptionSheetIOS.mockReset();
    latestUseIAPOptions = undefined;
    delete process.env.EXPO_PUBLIC_BILLING_E2E_MODE;
    delete process.env.EXPO_PUBLIC_BILLING_ANDROID_NATIVE_QA;
    mockReconnect.mockReset();
    mockRequestPurchase.mockReset();
    mockFinishTransaction.mockReset();
    mockRestorePurchases.mockReset();
    mockHasNativeBillingConfig.mockReset();

    mockGetSnapshot.mockResolvedValue({
      accessState: 'needs_purchase',
    });
    mockHasNativeBillingConfig.mockReturnValue(true);
    installCatalogFetchMock();
    mockGetAvailablePurchases.mockResolvedValue([]);
    mockGetActiveSubscriptions.mockResolvedValue([]);
    mockPresentCodeRedemptionSheetIOS.mockResolvedValue(undefined);
    mockSetStringAsync.mockResolvedValue(true);
    mockReconnect.mockResolvedValue(true);
    mockRequestPurchase.mockResolvedValue(null);
    mockFinishTransaction.mockResolvedValue(undefined);
    mockRestorePurchases.mockResolvedValue(undefined);
    installUseIapMock();
    setPlatformOs('ios');
    pendingSaveOffer = null;
    lastRedeemResult = null;
  });

  afterEach(() => {
    if (platformOsDescriptor) {
      Object.defineProperty(Platform, 'OS', platformOsDescriptor);
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('hydrates the stored snapshot, loads offerings, and syncs active subscriptions into local access', async () => {
    mockGetActiveSubscriptions.mockResolvedValue([
      {
        productId: 'floriva.annual',
        isActive: true,
        expirationDateIOS: Date.parse('2026-05-13T12:00:00.000Z'),
        transactionDate: Date.parse('2026-04-13T12:00:00.000Z'),
      },
    ]);

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('subscribed');
    });

    expect(screen.getByTestId('plan').props.children).toBe('annual');
    expect(screen.getByTestId('offerings').props.children).toBe('3');
    expect(mockFetchProducts).toHaveBeenCalledWith({
      skus: ['floriva.monthly', 'floriva.annual'],
      type: 'subs',
    });
    expect(mockFetchProducts).toHaveBeenCalledWith({
      skus: ['floriva.lifetime'],
      type: 'in-app',
    });
    expect(mockSaveSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        accessState: 'subscribed',
        planId: 'annual',
      }),
    );
    expect(mockApplyBillingSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        accessState: 'subscribed',
        planId: 'annual',
      }),
    );
  });

  it('preserves seeded dev access without querying the store', async () => {
    mockResolveDevLaunchPreset.mockReturnValue('seeded-tracker');
    mockGetSnapshot.mockResolvedValue({
      accessState: 'trial_active',
      planId: 'annual',
      trialEndsAt: '2026-06-09T10:00:00.000Z',
      firstChargeAt: '2026-06-09T10:00:00.000Z',
    });

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('trial_active');
    });

    expect(mockFetchProducts).not.toHaveBeenCalled();
    expect(mockGetAvailablePurchases).not.toHaveBeenCalled();
    expect(mockGetActiveSubscriptions).not.toHaveBeenCalled();
  });

  it('does not reconcile the billing reminder at hydrate (AppShellProvider owns that)', async () => {
    mockResolveDevLaunchPreset.mockReturnValue('seeded-tracker');
    const grandfatheredSnapshot = {
      accessState: 'trial_active' as const,
      firstChargeAt: '2026-06-28T09:00:00.000Z',
      trialEndsAt: '2026-06-28T09:00:00.000Z',
      grandfatherTrialApplied: true,
    };
    mockGetSnapshot.mockResolvedValue(grandfatheredSnapshot);

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('trial_active');
    });

    // Hydrate no longer reconciles with the raw stored snapshot; that is the
    // AppShellProvider's job. Any reconcile here flows through persistSnapshot,
    // which always stamps a reminderScheduledFor field on the snapshot.
    expect(mockReconcileBillingReminderNotification).not.toHaveBeenCalledWith({
      snapshot: grandfatheredSnapshot,
    });
  });

  it.each(['start-lifetime-trial', 'buy-lifetime'] as const)(
    'blocks %s before billing hydration and lets recurring entitlement hydration win',
    async (actionTestId) => {
      const hydrationGate = createDeferred<{
        accessState: 'subscribed';
        planId: 'annual';
        expiresAt: string;
      }>();
      const recurringSnapshot = {
        accessState: 'subscribed' as const,
        planId: 'annual' as const,
        expiresAt: '2026-05-13T12:00:00.000Z',
      };
      mockGetSnapshot
        .mockImplementationOnce(() => hydrationGate.promise)
        .mockResolvedValue(recurringSnapshot);
      mockGetActiveSubscriptions.mockResolvedValue([
        {
          productId: 'floriva.annual',
          isActive: true,
          expirationDateIOS: Date.parse(recurringSnapshot.expiresAt),
        },
      ]);

      render(
        <BillingProvider>
          <BillingProbe />
        </BillingProvider>,
      );

      await act(async () => {
        await screen.getByTestId(actionTestId).props.onPress();
      });

      expect(mockSaveSnapshot).not.toHaveBeenCalled();
      expect(mockRequestPurchase).not.toHaveBeenCalled();

      hydrationGate.resolve(recurringSnapshot);

      await waitFor(() => {
        expect(screen.getByTestId('status').props.children).toBe('subscribed');
        expect(screen.getByTestId('plan').props.children).toBe('annual');
      });
    },
  );

  it.each(['annual', 'monthly'] as const)(
    'blocks a pre-hydration %s purchase before any store or persistence work',
    async (planId) => {
      const hydrationGate = createDeferred<{ accessState: 'needs_purchase' }>();
      mockGetSnapshot.mockImplementationOnce(() => hydrationGate.promise);

      render(
        <BillingProvider>
          <DirectBillingActionProbe offer={annualSaveOffer} />
        </BillingProvider>,
      );

      await act(async () => {
        await screen.getByTestId(`direct-buy-${planId}`).props.onPress();
      });

      expect(mockFetchProducts).not.toHaveBeenCalled();
      expect(mockRequestPurchase).not.toHaveBeenCalled();
      expect(mockSaveSnapshot).not.toHaveBeenCalled();
    },
  );

  it('blocks restore before hydration without touching the store or persistence', async () => {
    const hydrationGate = createDeferred<{ accessState: 'needs_purchase' }>();
    mockGetSnapshot.mockImplementationOnce(() => hydrationGate.promise);

    render(
      <BillingProvider>
        <DirectBillingActionProbe offer={annualSaveOffer} />
      </BillingProvider>,
    );

    await act(async () => {
      await screen.getByTestId('direct-restore').props.onPress();
    });

    expect(mockRestorePurchases).not.toHaveBeenCalled();
    expect(mockFetchProducts).not.toHaveBeenCalled();
    expect(mockSaveSnapshot).not.toHaveBeenCalled();
  });

  it('fails save-offer redemption before hydration without clipboard, store, or persistence work', async () => {
    const hydrationGate = createDeferred<{ accessState: 'needs_purchase' }>();
    mockGetSnapshot.mockImplementationOnce(() => hydrationGate.promise);
    let result: RedeemResult | undefined;

    render(
      <BillingProvider>
        <DirectBillingActionProbe offer={annualSaveOffer} />
      </BillingProvider>,
    );

    await act(async () => {
      result = await screen.getByTestId('direct-redeem').props.onPress();
    });

    expect(result).toEqual({
      status: 'failed',
      message: 'Billing is not available right now. Try refreshing.',
    });
    expect(mockSetStringAsync).not.toHaveBeenCalled();
    expect(mockPresentCodeRedemptionSheetIOS).not.toHaveBeenCalled();
    expect(mockRequestPurchase).not.toHaveBeenCalled();
    expect(mockSaveSnapshot).not.toHaveBeenCalled();
  });

  it('publishes the hydrated snapshot ref before a layout-effect consumer can purchase', async () => {
    mockResolveDevLaunchPreset.mockReturnValue('billing-fallback');
    mockGetSnapshot.mockResolvedValue({
      accessState: 'needs_purchase',
      lifetimeTrialStartedAt: '2026-03-01T12:00:00.000Z',
    });

    render(
      <BillingProvider>
        <HydratedLayoutEffectPurchaseProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(
        mockSaveSnapshot.mock.calls.some(
          ([candidate]) =>
            (candidate as { accessState?: string; planId?: string }).accessState ===
              'subscribed' &&
            (candidate as { accessState?: string; planId?: string }).planId === 'annual',
        ),
      ).toBe(true);
    });

    const subscribedAnnualSave = mockSaveSnapshot.mock.calls.find(
      ([candidate]) =>
        (candidate as { accessState?: string; planId?: string }).accessState === 'subscribed' &&
        (candidate as { accessState?: string; planId?: string }).planId === 'annual',
    )?.[0];
    expect(subscribedAnnualSave).toEqual(
      expect.objectContaining({
        lifetimeTrialStartedAt: '2026-03-01T12:00:00.000Z',
      }),
    );
  });

  it('reconciles the billing reminder via persistSnapshot when a store sync changes access', async () => {
    mockGetActiveSubscriptions.mockResolvedValue([
      {
        productId: 'floriva.annual',
        isActive: true,
        expirationDateIOS: Date.parse('2026-05-13T12:00:00.000Z'),
        transactionDate: Date.parse('2026-04-13T12:00:00.000Z'),
      },
    ]);

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('subscribed');
    });

    expect(mockReconcileBillingReminderNotification).toHaveBeenCalledWith({
      snapshot: expect.objectContaining({
        accessState: 'subscribed',
        planId: 'annual',
      }),
    });
  });

  it('refreshes from the persisted snapshot before revalidating billing after an external restore', async () => {
    mockHasNativeBillingConfig.mockReturnValue(false);
    mockGetSnapshot.mockResolvedValue({
      accessState: 'subscribed',
      planId: 'annual',
      lastSyncedAt: '2026-04-01T12:00:00.000Z',
    });

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('subscribed');
      expect(screen.getByTestId('plan').props.children).toBe('annual');
    });

    mockSaveSnapshot.mockClear();
    mockGetSnapshot.mockResolvedValue({
      accessState: 'needs_purchase',
      lastSyncedAt: '2026-05-13T12:00:00.000Z',
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('refresh'));
    });

    await waitFor(() => {
      expect(mockSaveSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          accessState: 'sync_error',
          lastSyncedAt: '2026-05-13T12:00:00.000Z',
        }),
      );
    });
    expect(mockSaveSnapshot).not.toHaveBeenCalledWith(
      expect.objectContaining({
        accessState: 'subscribed',
        planId: 'annual',
      }),
    );
  });

  it('renders the dev billing fallback paywall without querying the store', async () => {
    setPlatformOs('android');
    mockResolveDevLaunchPreset.mockReturnValue('billing-fallback');

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('needs_purchase');
    });

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
    });

    expect(screen.getByTestId('message').props.children).toBe('none');
    expect(mockUseIAP).not.toHaveBeenCalled();
    expect(mockFetchProducts).not.toHaveBeenCalled();
    expect(mockGetAvailablePurchases).not.toHaveBeenCalled();
    expect(mockGetActiveSubscriptions).not.toHaveBeenCalled();
  });

  it('simulates a local purchase in the dev billing fallback preset', async () => {
    setPlatformOs('android');
    mockResolveDevLaunchPreset.mockReturnValue('billing-fallback');

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
    });

    await act(async () => {
      await screen.getByTestId('buy-annual').props.onPress();
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('subscribed');
      expect(screen.getByTestId('plan').props.children).toBe('annual');
      expect(screen.getByTestId('message').props.children).toContain(
        'Dev purchase simulated',
      );
    });
    expect(mockRequestPurchase).not.toHaveBeenCalled();
    expect(mockSaveSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        accessState: 'subscribed',
        planId: 'annual',
      }),
    );
  });

  it('keeps configured purchase options visible but unavailable when the native catalog returns no products', async () => {
    mockFetchProducts.mockResolvedValue([]);

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('message').props.children).toBe(
        'Billing is not available right now. Try refreshing.',
      );
    });

    expect(screen.getByTestId('offerings').props.children).toBe('3');
    expect(screen.getByTestId('offering-availability').props.children).toBe(
      'annual:false,lifetime:false,monthly:false',
    );
    expect(screen.getByTestId('status').props.children).toBe('needs_purchase');
    expect(mockReportRuntimeDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'billing_catalog_unavailable',
        payload: expect.objectContaining({
          requestedProductIds: ['floriva.monthly', 'floriva.annual', 'floriva.lifetime'],
          returnedProductCount: 0,
        }),
      }),
    );
  });

  it('keeps legacy complimentary access usable until its cached end date passes during automatic refresh', async () => {
    mockGetSnapshot.mockResolvedValue({
      accessState: 'complimentary_active',
      expiresAt: '2026-06-09T10:00:00.000Z',
      lastSyncedAt: '2026-04-10T12:00:00.000Z',
    });

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('subscribed');
    });

    expect(screen.getByTestId('plan').props.children).toBe('none');
    expect(mockSaveSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        accessState: 'subscribed',
        expiresAt: '2026-06-09T10:00:00.000Z',
      }),
    );
  });

  it('falls back to sync_error when native billing is not configured and there is no safe cache', async () => {
    mockHasNativeBillingConfig.mockReturnValue(false);

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('sync_error');
    });

    expect(mockUseIAP).not.toHaveBeenCalled();
    expect(screen.getByTestId('message').props.children).toContain(
      'Billing is not set up for this build. Store product IDs must be added before purchases or restores will work.',
    );
  });

  it('keeps Android development builds off the native billing bridge unless a billing QA mode opts in', async () => {
    setPlatformOs('android');

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('message').props.children).toBe(
        'Billing is not available right now. Try refreshing.',
      );
    });

    expect(screen.getByTestId('offerings').props.children).toBe('3');
    expect(screen.getByTestId('offering-availability').props.children).toBe(
      'annual:false,lifetime:false,monthly:false',
    );
    expect(mockUseIAP).not.toHaveBeenCalled();
    expect(mockFetchProducts).not.toHaveBeenCalled();
    expect(mockGetAvailablePurchases).not.toHaveBeenCalled();
    expect(mockGetActiveSubscriptions).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('buy-annual'));
    await waitFor(() => {
      expect(screen.getByTestId('message').props.children).toBe(
        'Billing is not available right now. Try refreshing.',
      );
    });
    expect(mockRequestPurchase).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('restore'));
    await waitFor(() => {
      expect(screen.getByTestId('message').props.children).toBe(
        'Billing is not available right now. Try refreshing.',
      );
    });
    expect(mockRestorePurchases).not.toHaveBeenCalled();
  });

  it('allows Android development billing QA to opt into the native store bridge explicitly', async () => {
    setPlatformOs('android');
    process.env.EXPO_PUBLIC_BILLING_ANDROID_NATIVE_QA = '1';

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
    });

    expect(mockUseIAP).toHaveBeenCalled();
    expect(mockFetchProducts).toHaveBeenCalledWith({
      skus: ['floriva.monthly', 'floriva.annual'],
      type: 'subs',
    });
    expect(mockFetchProducts).toHaveBeenCalledWith({
      skus: ['floriva.lifetime'],
      type: 'in-app',
    });
    expect(screen.getByTestId('message').props.children).toBe('none');
  });

  it('can simulate a dev billing fallback purchase after provider hydration', async () => {
    mockResolveDevLaunchPreset.mockReturnValue('billing-fallback');
    mockHasNativeBillingConfig.mockReturnValue(false);

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-hydrated').props.children).toBe('true');
    });

    fireEvent.press(screen.getByTestId('buy-annual'));

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('subscribed');
      expect(screen.getByTestId('plan').props.children).toBe('annual');
    });

    expect(mockUseIAP).not.toHaveBeenCalled();
    expect(mockRequestPurchase).not.toHaveBeenCalled();
  });

  it('finishes native purchases and persists the restored lifetime unlock', async () => {
    mockGetAvailablePurchases
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          productId: 'floriva.lifetime',
          transactionDate: Date.parse('2026-04-13T12:00:00.000Z'),
        },
      ]);
    mockRequestPurchase.mockResolvedValue({
      id: 'purchase-1',
      productId: 'floriva.lifetime',
      transactionDate: Date.parse('2026-04-13T12:00:00.000Z'),
      purchaseState: 'purchased',
      isAutoRenewing: false,
      quantity: 1,
      store: 'app-store',
      platform: 'ios',
    });

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
    });

    fireEvent.press(screen.getByTestId('buy-lifetime'));
    await flushMicrotasks();

    await waitFor(() => {
      expect(mockFinishTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          purchase: expect.objectContaining({
            productId: 'floriva.lifetime',
          }),
          isConsumable: false,
        }),
      );
      expect(screen.getByTestId('status').props.children).toBe('subscribed');
      expect(screen.getByTestId('plan').props.children).toBe('lifetime');
    });
  });

  it('completes purchases locally in explicit billing E2E mode without opening native StoreKit', async () => {
    process.env.EXPO_PUBLIC_BILLING_E2E_MODE = 'local-purchase-success';

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
    });

    expect(mockUseIAP).not.toHaveBeenCalled();
    expect(mockFetchProducts).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('buy-annual'));
    await flushMicrotasks();

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('trial_active');
      expect(screen.getByTestId('plan').props.children).toBe('annual');
      expect(screen.getByTestId('message').props.children).toBe('Access updated.');
    });

    expect(mockRequestPurchase).not.toHaveBeenCalled();
    expect(mockFinishTransaction).not.toHaveBeenCalled();
    expect(mockSaveSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({
        accessState: 'trial_active',
        planId: 'annual',
      }),
    );
  });

  it('completes local billing E2E purchases when the platform store product id is unset', async () => {
    process.env.EXPO_PUBLIC_BILLING_E2E_MODE = 'local-purchase-success';
    const mockedConfig = jest.requireMock('@/src/features/billing/config')
      .florivaRuntimeBillingConfig as { annualProductId: string };
    const originalAnnualProductId = mockedConfig.annualProductId;
    mockedConfig.annualProductId = '';

    try {
      render(
        <BillingProvider>
          <BillingProbe />
        </BillingProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('offerings').props.children).toBe('3');
      });

      fireEvent.press(screen.getByTestId('buy-annual'));
      await flushMicrotasks();

      await waitFor(() => {
        expect(screen.getByTestId('status').props.children).toBe('trial_active');
        expect(screen.getByTestId('plan').props.children).toBe('annual');
        expect(screen.getByTestId('message').props.children).toBe(
          'Access updated.',
        );
      });
    } finally {
      mockedConfig.annualProductId = originalAnnualProductId;
    }
  });

  it('preserves an expired grandfathered snapshot in local billing E2E mode instead of collapsing to needs_purchase', async () => {
    process.env.EXPO_PUBLIC_BILLING_E2E_MODE = 'local-purchase-success';
    mockResolveDevLaunchPreset.mockReturnValue('grandfathered-expired');
    // trial_active with a past trialEndsAt normalizes to `expired` (now = 2026-04-13).
    mockGetSnapshot.mockResolvedValue({
      accessState: 'trial_active',
      planId: undefined,
      trialEndsAt: '2026-03-01T10:00:00.000Z',
      firstChargeAt: '2026-03-01T10:00:00.000Z',
      grandfatherTrialApplied: true,
    });

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('expired');
    });

    expect(mockSaveSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({
        accessState: 'expired',
      }),
    );
  });

  it('uses local billing E2E mode for lifetime purchases and restore messaging', async () => {
    process.env.EXPO_PUBLIC_BILLING_E2E_MODE = 'local-purchase-success';

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
    });

    fireEvent.press(screen.getByTestId('restore'));
    await flushMicrotasks();

    await waitFor(() => {
      expect(screen.getByTestId('message').props.children).toBe(
        'No previous purchases found for this account.',
      );
    });

    fireEvent.press(screen.getByTestId('buy-lifetime'));
    await flushMicrotasks();

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('subscribed');
      expect(screen.getByTestId('plan').props.children).toBe('lifetime');
    });

    expect(mockRequestPurchase).not.toHaveBeenCalled();
    expect(mockFinishTransaction).not.toHaveBeenCalled();
  });

  it('starts an app-level lifetime trial locally without opening the native store', async () => {
    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
      expect(screen.getByTestId('lifetime-eligible').props.children).toBe('true');
    });

    await act(async () => {
      await screen.getByTestId('start-lifetime-trial').props.onPress();
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('trial_active');
      expect(screen.getByTestId('plan').props.children).toBe('lifetime');
      expect(screen.getByTestId('lifetime-eligible').props.children).toBe('false');
    });

    // The trial is app-level: no store purchase or transaction is finalized.
    expect(mockRequestPurchase).not.toHaveBeenCalled();
    expect(mockFinishTransaction).not.toHaveBeenCalled();

    const savedTrial = mockSaveSnapshot.mock.calls
      .map(([snapshot]) => snapshot)
      .reverse()
      .find((snapshot) => snapshot.accessState === 'trial_active');
    expect(savedTrial).toMatchObject({
      accessState: 'trial_active',
      planId: 'lifetime',
      lifetimeTrialStartedAt: '2026-04-13T12:00:00.000Z',
    });
    // No auto-charge, so no first-charge date is recorded.
    expect(savedTrial?.firstChargeAt).toBeUndefined();
  });

  it.each([
    ['trial_active', 'annual', 'start'] as const,
    ['subscribed', 'monthly', 'start'] as const,
    ['sync_error', 'annual', 'start'] as const,
    ['trial_active', 'annual', 'purchase'] as const,
    ['subscribed', 'monthly', 'purchase'] as const,
    ['sync_error', 'annual', 'purchase'] as const,
  ])(
    'blocks direct Lifetime transitions for %s recurring %s access via %s',
    async (accessState, planId, action) => {
      const storedSnapshot = {
        accessState,
        planId,
        ...(accessState === 'trial_active'
          ? {
              trialEndsAt: '2026-05-13T12:00:00.000Z',
              firstChargeAt: '2026-05-13T12:00:00.000Z',
            }
          : {}),
      };
      mockGetSnapshot.mockResolvedValue(storedSnapshot);

      if (accessState === 'sync_error') {
        mockGetActiveSubscriptions.mockReturnValue(new Promise(() => {}));
      } else {
        mockResolveDevLaunchPreset.mockReturnValue('seeded-tracker');
      }

      render(
        <BillingProvider>
          <BillingProbe />
        </BillingProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('status').props.children).toBe(accessState);
      });

      mockSaveSnapshot.mockClear();
      mockRequestPurchase.mockClear();

      await act(async () => {
        await screen
          .getByTestId(action === 'start' ? 'start-lifetime-trial' : 'buy-lifetime')
          .props.onPress();
      });

      expect(mockSaveSnapshot).not.toHaveBeenCalled();
      expect(mockRequestPurchase).not.toHaveBeenCalled();
      expect(screen.getByTestId('status').props.children).toBe(accessState);
      expect(screen.getByTestId('plan').props.children).toBe(planId);
    },
  );

  it.each(['start', 'purchase'] as const)(
    'blocks a direct Lifetime %s while a no-plan billing snapshot is in sync_error',
    async (action) => {
      mockGetSnapshot.mockResolvedValue({ accessState: 'sync_error' });
      mockRequestPurchase.mockResolvedValue(null);

      render(
        <BillingProvider>
          <HydratedLayoutEffectLifetimeActionProbe action={action} />
        </BillingProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('layout-hydrated').props.children).toBe('true');
      });

      await waitFor(() => {
        expect(mockRequestPurchase).not.toHaveBeenCalled();
        expect(
          mockSaveSnapshot.mock.calls.some(
            ([snapshot]) =>
              snapshot.accessState === 'trial_active' && snapshot.planId === 'lifetime',
          ),
        ).toBe(false);
      });
    },
  );

  it('keeps an in-progress app-level lifetime trial through an automatic store refresh', async () => {
    mockGetSnapshot.mockResolvedValue({
      accessState: 'trial_active',
      planId: 'lifetime',
      trialEndsAt: '2026-05-13T12:00:00.000Z',
      lifetimeTrialStartedAt: '2026-04-13T12:00:00.000Z',
    });

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
    });

    // The initial automatic refresh derives from native state (no purchases); the
    // app-level trial must survive rather than collapse to expired/needs_purchase.
    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('trial_active');
      expect(screen.getByTestId('plan').props.children).toBe('lifetime');
    });
    expect(mockRequestPurchase).not.toHaveBeenCalled();
  });

  it('refuses to start the lifetime trial again once it has been used', async () => {
    mockGetSnapshot.mockResolvedValue({
      accessState: 'expired',
      planId: 'lifetime',
      trialEndsAt: '2026-04-01T12:00:00.000Z',
      lifetimeTrialStartedAt: '2026-03-01T12:00:00.000Z',
    });

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
      expect(screen.getByTestId('lifetime-eligible').props.children).toBe('false');
    });

    await act(async () => {
      await screen.getByTestId('start-lifetime-trial').props.onPress();
    });

    // Ineligible: the durable marker blocks a second trial; access stays expired.
    expect(screen.getByTestId('status').props.children).toBe('expired');
    expect(
      mockSaveSnapshot.mock.calls.some(
        ([snapshot]) => snapshot.accessState === 'trial_active',
      ),
    ).toBe(false);
  });

  it('lets a user buy lifetime after an app-level trial to unlock permanent access', async () => {
    process.env.EXPO_PUBLIC_BILLING_E2E_MODE = 'local-purchase-success';

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
    });

    await act(async () => {
      await screen.getByTestId('start-lifetime-trial').props.onPress();
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('trial_active');
      expect(screen.getByTestId('plan').props.children).toBe('lifetime');
    });

    fireEvent.press(screen.getByTestId('buy-lifetime'));
    await flushMicrotasks();

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('subscribed');
      expect(screen.getByTestId('plan').props.children).toBe('lifetime');
    });
  });

  it('preserves a consumed Lifetime trial marker when a recurring purchase catches up natively', async () => {
    const lifetimeTrialStartedAt = '2026-03-01T12:00:00.000Z';
    mockGetSnapshot.mockResolvedValue({
      accessState: 'expired',
      planId: 'lifetime',
      trialEndsAt: '2026-04-01T12:00:00.000Z',
      lifetimeTrialStartedAt,
    });
    mockGetActiveSubscriptions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          productId: 'floriva.annual',
          isActive: true,
          expirationDateIOS: Date.parse('2026-05-13T12:00:00.000Z'),
        },
      ]);
    mockRequestPurchase.mockResolvedValue({
      id: 'purchase-annual-caught-up',
      productId: 'floriva.annual',
      transactionDate: Date.parse('2026-04-13T12:00:00.000Z'),
      purchaseState: 'purchased',
      isAutoRenewing: true,
      quantity: 1,
      store: 'app-store',
      platform: 'ios',
    });

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
      expect(screen.getByTestId('status').props.children).toBe('expired');
    });

    await act(async () => {
      await screen.getByTestId('buy-annual').props.onPress();
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('subscribed');
      expect(screen.getByTestId('plan').props.children).toBe('annual');
      expect(screen.getByTestId('lifetime-trial-started-at').props.children).toBe(
        lifetimeTrialStartedAt,
      );
    });
    expect(mockSaveSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({ lifetimeTrialStartedAt }),
    );
  });

  it('preserves a consumed Lifetime trial marker through provisional fallback persistence', async () => {
    const lifetimeTrialStartedAt = '2026-03-01T12:00:00.000Z';
    mockGetSnapshot.mockResolvedValue({
      accessState: 'expired',
      planId: 'lifetime',
      trialEndsAt: '2026-04-01T12:00:00.000Z',
      lifetimeTrialStartedAt,
    });
    mockGetActiveSubscriptions
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('native sync unavailable'));
    mockRequestPurchase.mockResolvedValue({
      id: 'purchase-annual-provisional',
      productId: 'floriva.annual',
      transactionDate: Date.parse('2026-04-13T12:00:00.000Z'),
      purchaseState: 'purchased',
      isAutoRenewing: true,
      quantity: 1,
      store: 'app-store',
      platform: 'ios',
    });

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
      expect(screen.getByTestId('status').props.children).toBe('expired');
    });

    await act(async () => {
      await screen.getByTestId('buy-annual').props.onPress();
    });

    await waitFor(() => {
      expect(screen.getByTestId('plan').props.children).toBe('annual');
      expect(screen.getByTestId('lifetime-trial-started-at').props.children).toBe(
        lifetimeTrialStartedAt,
      );
    });
    expect(mockSaveSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({ lifetimeTrialStartedAt }),
    );
  });

  it.each(['local-e2e', 'dev-fallback'] as const)(
    'preserves a consumed Lifetime trial marker through %s purchase persistence',
    async (mode) => {
      const lifetimeTrialStartedAt = '2026-03-01T12:00:00.000Z';
      mockGetSnapshot.mockResolvedValue({
        accessState: 'expired',
        planId: 'lifetime',
        trialEndsAt: '2026-04-01T12:00:00.000Z',
        lifetimeTrialStartedAt,
      });

      if (mode === 'local-e2e') {
        process.env.EXPO_PUBLIC_BILLING_E2E_MODE = 'local-purchase-success';
      } else {
        mockResolveDevLaunchPreset.mockReturnValue('billing-fallback');
      }

      render(
        <BillingProvider>
          <BillingProbe />
        </BillingProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('offerings').props.children).toBe('3');
      });

      await act(async () => {
        await screen.getByTestId('buy-annual').props.onPress();
      });

      await waitFor(() => {
        expect(screen.getByTestId('plan').props.children).toBe('annual');
        expect(screen.getByTestId('lifetime-trial-started-at').props.children).toBe(
          lifetimeTrialStartedAt,
        );
      });
      expect(mockSaveSnapshot).toHaveBeenLastCalledWith(
        expect.objectContaining({ lifetimeTrialStartedAt }),
      );
    },
  );

  it('keeps recurring access locally when purchase succeeds before the store query catches up', async () => {
    mockRequestPurchase.mockResolvedValue({
      id: 'purchase-annual-1',
      productId: 'floriva.annual',
      transactionDate: Date.parse('2026-04-13T12:00:00.000Z'),
      purchaseState: 'purchased',
      isAutoRenewing: true,
      quantity: 1,
      store: 'app-store',
      platform: 'ios',
    });

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
    });

    await act(async () => {
      await screen.getByTestId('buy-annual').props.onPress();
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('subscribed');
      expect(screen.getByTestId('plan').props.children).toBe('annual');
      expect(screen.getByTestId('message').props.children).toContain(
        'Purchase recorded. Floriva will check with the store shortly.',
      );
    });
  });

  it('does not mark an iOS subscription as trial_active unless the purchase payload confirms a free trial', async () => {
    mockRequestPurchase.mockResolvedValue({
      id: 'purchase-annual-paid-1',
      productId: 'floriva.annual',
      transactionDate: Date.parse('2026-04-13T12:00:00.000Z'),
      expirationDateIOS: Date.parse('2026-05-13T12:00:00.000Z'),
      purchaseState: 'purchased',
      isAutoRenewing: true,
      quantity: 1,
      store: 'apple',
      platform: 'ios',
    });

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
    });

    await act(async () => {
      await screen.getByTestId('buy-annual').props.onPress();
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('subscribed');
      expect(screen.getByTestId('plan').props.children).toBe('annual');
    });
  });

  it('treats empty purchase responses as a cancelled sheet instead of a completed purchase', async () => {
    mockRequestPurchase.mockResolvedValue(null);

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
    });

    mockSaveSnapshot.mockClear();
    mockApplyBillingSnapshot.mockClear();
    mockFinishTransaction.mockClear();

    await act(async () => {
      await screen.getByTestId('buy-annual').props.onPress();
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('needs_purchase');
      expect(screen.getByTestId('message').props.children).toBe(
        'Purchase was cancelled.',
      );
    });

    expect(mockFinishTransaction).not.toHaveBeenCalled();
    expect(mockSaveSnapshot).not.toHaveBeenCalled();
    expect(mockApplyBillingSnapshot).not.toHaveBeenCalled();
  });

  it('keeps Android trial timing locally when a free-trial annual purchase succeeds before store sync catches up', async () => {
    mockRequestPurchase.mockResolvedValue({
      id: 'purchase-android-monthly-1',
      productId: 'floriva.monthly',
      transactionDate: Date.parse('2026-04-13T12:00:00.000Z'),
      purchaseState: 'purchased',
      isAutoRenewing: true,
      quantity: 1,
      store: 'google',
      platform: 'android',
      packageNameAndroid: 'com.anonymous.floriva',
    });

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
    });

    await act(async () => {
      await screen.getByTestId('buy-annual').props.onPress();
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('trial_active');
      expect(screen.getByTestId('plan').props.children).toBe('annual');
      expect(mockSaveSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          accessState: 'trial_active',
          planId: 'annual',
          trialEndsAt: '2026-05-13T12:00:00.000Z',
          firstChargeAt: '2026-05-13T12:00:00.000Z',
        }),
      );
    });
  });

  it('reports when restore finds no previous purchases on the current store account', async () => {
    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
    });

    fireEvent.press(screen.getByTestId('restore'));
    await flushMicrotasks();

    await waitFor(() => {
      expect(screen.getByTestId('message').props.children).toBe(
        'No previous purchases found for this account.',
      );
    });
  });

  it('opens the store management url from the billing context', async () => {
    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
    });

    fireEvent.press(screen.getByTestId('manage'));

    await waitFor(() => {
      expect(mockOpenURL).toHaveBeenCalledWith(
        'https://apps.apple.com/account/subscriptions',
      );
    });
  });

  it('reports native store bridge errors with redacted billing diagnostics', async () => {
    mockGetSnapshot.mockReturnValue(new Promise(() => {}));

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    latestUseIAPOptions?.onError?.({ message: 'store unavailable' });

    await waitFor(() => {
      expect(mockReportRuntimeDiagnostic).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'billing_store_error',
          payload: expect.objectContaining({
            feature: 'billing',
            error: 'store unavailable',
          }),
        }),
      );
    });
  });

  it('keeps a safe cached access snapshot when refresh fails after hydration', async () => {
    mockGetSnapshot.mockResolvedValue({
      accessState: 'subscribed',
      planId: 'annual',
      expiresAt: '2026-06-13T12:00:00.000Z',
    });
    mockFetchProducts.mockRejectedValueOnce(new Error('catalog offline'));

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('message').props.children).toContain(
        'Billing could not refresh right now. Your last known access is still active.',
      );
      expect(screen.getByTestId('status').props.children).toBe('subscribed');
    });

    expect(mockReportRuntimeDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'billing_refresh_failed',
      }),
    );
  });

  it('surfaces the config warning when purchase is attempted without native product ids', async () => {
    mockHasNativeBillingConfig.mockReturnValue(false);

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-hydrated').props.children).toBe('true');
    });

    fireEvent.press(screen.getByTestId('buy-annual'));

    await waitFor(() => {
      expect(screen.getByTestId('message').props.children).toContain(
        'Billing is not set up for this build. Store product IDs must be added before purchases or restores will work.',
      );
    });
  });

  it('surfaces the config warning when restore is attempted without native product ids', async () => {
    mockHasNativeBillingConfig.mockReturnValue(false);

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-hydrated').props.children).toBe('true');
    });

    fireEvent.press(screen.getByTestId('restore'));

    await waitFor(() => {
      expect(screen.getByTestId('message').props.children).toContain(
        'Billing is not set up for this build. Store product IDs must be added before purchases or restores will work.',
      );
    });
    expect(mockRestorePurchases).not.toHaveBeenCalled();
  });

  it('surfaces recoverable purchase messaging when the user cancels the native purchase sheet', async () => {
    mockRequestPurchase.mockRejectedValueOnce({
      code: 'user-cancelled',
    });

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
    });

    await act(async () => {
      await screen.getByTestId('buy-annual').props.onPress();
    });

    await waitFor(() => {
      expect(screen.getByTestId('message').props.children).toBe(
        'Purchase was cancelled.',
      );
    });
  });

  it('reports purchase failures when no provisional access was recorded', async () => {
    mockRequestPurchase.mockRejectedValueOnce(new Error('purchase failed'));

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
    });

    await act(async () => {
      await screen.getByTestId('buy-annual').props.onPress();
    });

    await waitFor(() => {
      expect(screen.getByTestId('message').props.children).toBe(
        'Something went wrong. The purchase did not go through.',
      );
    });
    expect(mockReportRuntimeDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'billing_purchase_failed',
        payload: expect.objectContaining({
          planId: 'annual',
          error: 'purchase failed',
        }),
      }),
    );
  });

  it('shows a stable restore error when the store restore call rejects', async () => {
    mockRestorePurchases.mockRejectedValueOnce(new Error('restore failed'));

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
    });

    fireEvent.press(screen.getByTestId('restore'));
    await flushMicrotasks();

    await waitFor(() => {
      expect(screen.getByTestId('message').props.children).toBe(
        'Something went wrong. Purchases could not be restored.',
      );
    });
  });

  it('ignores duplicate refresh requests while a refresh is already in flight', async () => {
    const refreshGate = createDeferred<never>();
    mockGetActiveSubscriptions
      .mockResolvedValueOnce([])
      .mockImplementationOnce(() => refreshGate.promise);

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
    });

    mockFetchProducts.mockClear();

    fireEvent.press(screen.getByTestId('refresh'));
    fireEvent.press(screen.getByTestId('refresh'));

    await waitFor(() => {
      expect(mockFetchProducts).toHaveBeenCalledTimes(2);
    });

    refreshGate.reject(new Error('refresh still failing'));

    await waitFor(() => {
      expect(screen.getByTestId('message').props.children).toContain(
        'Billing could not refresh right now. Your last known access is still active.',
      );
    });
  });

  it('starts a purchase while the initial billing refresh is still in flight', async () => {
    const refreshGate = createDeferred<[]>();
    mockGetActiveSubscriptions
      .mockImplementationOnce(() => refreshGate.promise)
      .mockResolvedValueOnce([]);
    mockRequestPurchase.mockResolvedValue({
      id: 'purchase-annual-during-refresh',
      productId: 'floriva.annual',
      transactionDate: Date.parse('2026-04-13T12:00:00.000Z'),
      purchaseState: 'purchased',
      isAutoRenewing: true,
      quantity: 1,
      store: 'app-store',
      platform: 'ios',
    });

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
      expect(screen.getByTestId('is-refreshing').props.children).toBe('true');
    });

    await act(async () => {
      await screen.getByTestId('buy-annual').props.onPress();
    });

    await waitFor(() => {
      expect(mockRequestPurchase).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'subs',
          request: expect.objectContaining({
            apple: { sku: 'floriva.annual' },
          }),
        }),
      );
      expect(screen.getByTestId('status').props.children).toBe('subscribed');
      expect(screen.getByTestId('plan').props.children).toBe('annual');
    });

    refreshGate.resolve([]);
    await flushMicrotasks();
  });

  it.each([
    ['start-lifetime-trial', 'annual'] as const,
    ['buy-lifetime', 'annual'] as const,
    ['start-lifetime-trial', 'monthly'] as const,
    ['buy-lifetime', 'monthly'] as const,
  ])(
    'blocks %s during a pending native refresh that resolves %s recurring access',
    async (actionTestId, planId) => {
      const refreshGate = createDeferred<
        {
          productId: string;
          isActive: boolean;
          expirationDateIOS: number;
        }[]
      >();
      mockGetActiveSubscriptions.mockImplementationOnce(() => refreshGate.promise);

      render(
        <BillingProvider>
          <BillingProbe />
        </BillingProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('offerings').props.children).toBe('3');
        expect(screen.getByTestId('is-refreshing').props.children).toBe('true');
      });

      mockSaveSnapshot.mockClear();
      mockRequestPurchase.mockClear();

      await act(async () => {
        await screen.getByTestId(actionTestId).props.onPress();
      });

      expect(mockSaveSnapshot).not.toHaveBeenCalled();
      expect(mockRequestPurchase).not.toHaveBeenCalled();

      refreshGate.resolve([
        {
          productId: `floriva.${planId}`,
          isActive: true,
          expirationDateIOS: Date.parse('2026-05-13T12:00:00.000Z'),
        },
      ]);

      await waitFor(() => {
        expect(screen.getByTestId('is-refreshing').props.children).toBe('false');
        expect(screen.getByTestId('status').props.children).toBe('subscribed');
        expect(screen.getByTestId('plan').props.children).toBe(planId);
      });
    },
  );

  it('does not let a stale refresh overwrite a purchase snapshot', async () => {
    const refreshGate = createDeferred<[]>();
    mockGetActiveSubscriptions
      .mockImplementationOnce(() => refreshGate.promise)
      .mockResolvedValueOnce([]);
    mockRequestPurchase.mockResolvedValue({
      id: 'purchase-annual-before-stale-refresh',
      productId: 'floriva.annual',
      transactionDate: Date.parse('2026-04-13T12:00:00.000Z'),
      purchaseState: 'purchased',
      isAutoRenewing: true,
      quantity: 1,
      store: 'app-store',
      platform: 'ios',
    });

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
      expect(screen.getByTestId('is-refreshing').props.children).toBe('true');
    });

    await act(async () => {
      await screen.getByTestId('buy-annual').props.onPress();
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('subscribed');
      expect(screen.getByTestId('plan').props.children).toBe('annual');
    });

    mockSaveSnapshot.mockClear();
    mockApplyBillingSnapshot.mockClear();

    refreshGate.resolve([]);
    await waitFor(() => {
      expect(screen.getByTestId('is-refreshing').props.children).toBe('false');
    });

    expect(screen.getByTestId('status').props.children).toBe('subscribed');
    expect(screen.getByTestId('plan').props.children).toBe('annual');
    expect(mockSaveSnapshot).not.toHaveBeenCalled();
    expect(mockApplyBillingSnapshot).not.toHaveBeenCalled();
  });

  it('reconnects before refreshing and before starting a purchase when the store bridge is disconnected', async () => {
    installUseIapMock(false);
    mockRequestPurchase.mockResolvedValue({
      id: 'purchase-lifetime-reconnect',
      productId: 'floriva.lifetime',
      transactionDate: Date.parse('2026-04-13T12:00:00.000Z'),
      purchaseState: 'purchased',
      isAutoRenewing: false,
      quantity: 1,
      store: 'app-store',
      platform: 'ios',
    });

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
    });

    await flushMicrotasks();
    mockReconnect.mockClear();

    await act(async () => {
      await screen.getByTestId('refresh').props.onPress();
    });

    expect(mockReconnect).toHaveBeenCalledTimes(1);
    mockReconnect.mockClear();

    await act(async () => {
      await screen.getByTestId('buy-lifetime').props.onPress();
    });

    expect(mockReconnect).toHaveBeenCalledTimes(1);
  });

  it('keeps purchase unavailable when the disconnected store bridge cannot reconnect', async () => {
    installUseIapMock(false);
    mockReconnect.mockResolvedValue(false);

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
    });

    await act(async () => {
      await screen.getByTestId('buy-annual').props.onPress();
    });

    expect(screen.getByTestId('message').props.children).toBe(
      'Billing is not available right now. Try refreshing.',
    );
    expect(mockRequestPurchase).not.toHaveBeenCalled();
  });

  it('keeps provisional paid access when purchase finalization succeeds but native sync fails', async () => {
    mockRequestPurchase.mockResolvedValue({
      id: 'purchase-lifetime-offline',
      productId: 'floriva.lifetime',
      transactionDate: Date.parse('2026-04-13T12:00:00.000Z'),
      purchaseState: 'purchased',
      isAutoRenewing: false,
      quantity: 1,
      store: 'app-store',
      platform: 'ios',
    });
    mockGetActiveSubscriptions
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('native sync unavailable'));

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
    });

    await act(async () => {
      await screen.getByTestId('buy-lifetime').props.onPress();
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('subscribed');
      expect(screen.getByTestId('plan').props.children).toBe('lifetime');
      expect(screen.getByTestId('message').props.children).toContain(
        'Purchase recorded. Floriva will check with the store shortly.',
      );
    });
  });

  it('reports unavailable billing options when the selected plan is missing from the catalog', async () => {
    mockFetchProducts.mockImplementation(({ type }: { type: string }) =>
      Promise.resolve(type === 'in-app' ? [catalogProducts.lifetime] : []),
    );

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('1');
    });

    await act(async () => {
      await screen.getByTestId('buy-annual').props.onPress();
    });

    await waitFor(() => {
      expect(screen.getByTestId('message').props.children).toBe(
        'Billing is not available right now. Try refreshing.',
      );
    });
    expect(mockRequestPurchase).not.toHaveBeenCalled();
    expect(mockReportRuntimeDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'billing_purchase_unavailable',
        payload: expect.objectContaining({
          planId: 'annual',
          returnedProductCount: 1,
        }),
      }),
    );
  });

  it('reconnects before restore and reports restored purchases when access is recovered', async () => {
    installUseIapMock(false);
    mockGetActiveSubscriptions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          productId: 'floriva.annual',
          isActive: true,
          expirationDateIOS: Date.parse('2026-05-13T12:00:00.000Z'),
          transactionDate: Date.parse('2026-04-13T12:00:00.000Z'),
        },
      ]);

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
    });

    await flushMicrotasks();
    mockReconnect.mockClear();

    await act(async () => {
      await screen.getByTestId('restore').props.onPress();
    });

    await waitFor(() => {
      expect(mockReconnect).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('message').props.children).toBe('Purchases restored.');
      expect(screen.getByTestId('status').props.children).toBe('subscribed');
    });
  });

  it('keeps restore taps idempotent while a restore call is still pending', async () => {
    const restoreGate = createDeferred<void>();
    mockRestorePurchases.mockImplementationOnce(() => restoreGate.promise);

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
    });

    fireEvent.press(screen.getByTestId('restore'));
    fireEvent.press(screen.getByTestId('restore'));

    await waitFor(() => {
      expect(mockRestorePurchases).toHaveBeenCalledTimes(1);
    });

    restoreGate.reject(new Error('restore still failing'));

    await waitFor(() => {
      expect(screen.getByTestId('message').props.children).toBe(
        'Something went wrong. Purchases could not be restored.',
      );
    });
  });

  it('does not apply late hydration state after the provider unmounts', async () => {
    const hydrationGate = createDeferred<{ accessState: 'needs_purchase' }>();
    mockGetSnapshot.mockImplementationOnce(() => hydrationGate.promise);

    const view = render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    mockApplyBillingSnapshot.mockClear();
    view.unmount();

    hydrationGate.resolve({ accessState: 'needs_purchase' });
    await flushMicrotasks();

    expect(mockApplyBillingSnapshot).not.toHaveBeenCalled();
  });

  it('redeems a save offer in E2E mode, stamps the redeemed flag, and suppresses future offers', async () => {
    process.env.EXPO_PUBLIC_BILLING_E2E_MODE = 'local-purchase-success';
    mockGetSnapshot.mockResolvedValue({
      accessState: 'subscribed',
      planId: 'monthly',
      expiresAt: '2026-05-13T12:00:00.000Z',
      lastSyncedAt: '2026-04-01T12:00:00.000Z',
    });

    pendingSaveOffer = {
      kind: 'monthly80',
      planId: 'monthly',
      discountedPriceLabel: '$1.20/month',
      fullPriceLabel: '$5.99/month',
      redemption: { platform: 'ios', offerCode: 'SAVEMONTHLY' },
    };

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('subscribed');
      expect(screen.getByTestId('plan').props.children).toBe('monthly');
    });

    await act(async () => {
      await screen.getByTestId('redeem-save-offer').props.onPress();
    });

    await waitFor(() => {
      expect(screen.getByTestId('save-offer-redeemed-at').props.children).not.toBe('none');
    });

    expect(lastRedeemResult).toEqual({ status: 'redeemed' });

    const persistedSnapshot = mockSaveSnapshot.mock.calls.at(-1)?.[0];
    expect(persistedSnapshot.saveOfferRedeemedAt).toBe('2026-04-13T12:00:00.000Z');
    expect(typeof persistedSnapshot.saveOfferRedeemedAt).toBe('string');

    expect(
      resolveSaveOffer(persistedSnapshot, 'ios', florivaRuntimeBillingConfig),
    ).toBeNull();
  });

  it('redeems an iOS save offer through the native code redemption sheet', async () => {
    mockGetSnapshot.mockResolvedValue({
      accessState: 'subscribed',
      planId: 'monthly',
      expiresAt: '2026-05-13T12:00:00.000Z',
      lastSyncedAt: '2026-04-01T12:00:00.000Z',
    });

    pendingSaveOffer = {
      kind: 'monthly80',
      planId: 'monthly',
      discountedPriceLabel: '$1.19/month',
      fullPriceLabel: '$5.99/month',
      redemption: { platform: 'ios', offerCode: 'SAVEMONTHLY' },
    };

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
    });

    mockSaveSnapshot.mockClear();

    await act(async () => {
      await screen.getByTestId('redeem-save-offer').props.onPress();
    });

    await waitFor(() => {
      expect(mockSetStringAsync).toHaveBeenCalledWith('SAVEMONTHLY');
      expect(mockPresentCodeRedemptionSheetIOS).toHaveBeenCalledTimes(1);
      expect(lastRedeemResult).toEqual({ status: 'redeemed' });
      expect(mockSaveSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          planId: 'monthly',
          saveOfferRedeemedAt: '2026-04-13T12:00:00.000Z',
        }),
      );
    });

    expect(mockSetStringAsync.mock.invocationCallOrder[0]).toBeLessThan(
      mockPresentCodeRedemptionSheetIOS.mock.invocationCallOrder[0],
    );
  });

  it('redeems an Android save offer with the selected Play offer token', async () => {
    mockGetSnapshot.mockResolvedValue({
      accessState: 'subscribed',
      planId: 'monthly',
      expiresAt: '2026-05-13T12:00:00.000Z',
      lastSyncedAt: '2026-04-01T12:00:00.000Z',
    });

    pendingSaveOffer = {
      kind: 'monthly80',
      planId: 'monthly',
      discountedPriceLabel: '$1.20/month',
      fullPriceLabel: '$5.99/month',
      redemption: { platform: 'android', offerId: 'save-monthly-80-3mo' },
    };

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
    });

    mockSaveSnapshot.mockClear();

    await act(async () => {
      await screen.getByTestId('redeem-save-offer').props.onPress();
    });

    await waitFor(() => {
      expect(mockRequestPurchase).toHaveBeenCalledWith({
        type: 'subs',
        request: {
          google: {
            skus: ['floriva.monthly'],
            subscriptionOffers: [
              { sku: 'floriva.monthly', offerToken: 'monthly-save-token' },
            ],
          },
        },
      });
      expect(lastRedeemResult).toEqual({ status: 'redeemed' });
      expect(mockSaveSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          saveOfferRedeemedAt: '2026-04-13T12:00:00.000Z',
        }),
      );
    });
  });

  it('does not stamp an Android save offer when the Play offer token is missing', async () => {
    mockGetSnapshot.mockResolvedValue({
      accessState: 'subscribed',
      planId: 'monthly',
      lastSyncedAt: '2026-04-01T12:00:00.000Z',
    });
    mockFetchProducts.mockImplementation(({ type }: { type: string }) => {
      if (type === 'subs') {
        return Promise.resolve([
          catalogProducts.annual,
          {
            ...catalogProducts.monthly,
            subscriptionOffers: [],
          },
        ]);
      }

      if (type === 'in-app') {
        return Promise.resolve([catalogProducts.lifetime]);
      }

      return Promise.resolve([]);
    });

    pendingSaveOffer = {
      kind: 'monthly80',
      planId: 'monthly',
      discountedPriceLabel: '$1.20/month',
      fullPriceLabel: '$5.99/month',
      redemption: { platform: 'android', offerId: 'save-monthly-80-3mo' },
    };

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
    });

    mockSaveSnapshot.mockClear();

    await act(async () => {
      await screen.getByTestId('redeem-save-offer').props.onPress();
    });

    await waitFor(() => {
      expect(lastRedeemResult).toEqual({
        status: 'failed',
        message: 'No Android offer token for save offer save-monthly-80-3mo.',
      });
    });
    expect(mockRequestPurchase).not.toHaveBeenCalled();
    expect(mockSaveSnapshot).not.toHaveBeenCalled();
  });

  it('does not stamp an Android save offer when native billing cannot request purchases', async () => {
    mockGetSnapshot.mockResolvedValue({
      accessState: 'subscribed',
      planId: 'monthly',
      expiresAt: '2026-05-13T12:00:00.000Z',
      lastSyncedAt: '2026-04-01T12:00:00.000Z',
    });
    mockUseIAP.mockImplementation(
      (options?: { onError?: (error: { message?: string } | string) => void }) => {
        latestUseIAPOptions = options;

        return {
          connected: true,
          reconnect: (...args: unknown[]) => mockReconnect(...args),
          requestPurchase: null,
          finishTransaction: (...args: unknown[]) => mockFinishTransaction(...args),
          restorePurchases: (...args: unknown[]) => mockRestorePurchases(...args),
        };
      },
    );

    pendingSaveOffer = {
      kind: 'monthly80',
      planId: 'monthly',
      discountedPriceLabel: '$1.20/month',
      fullPriceLabel: '$5.99/month',
      redemption: { platform: 'android', offerId: 'save-monthly-80-3mo' },
    };

    render(
      <BillingProvider>
        <BillingProbe />
      </BillingProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('offerings').props.children).toBe('3');
    });

    mockSaveSnapshot.mockClear();

    await act(async () => {
      await screen.getByTestId('redeem-save-offer').props.onPress();
    });

    await waitFor(() => {
      expect(lastRedeemResult).toEqual({
        status: 'failed',
        message: 'Android billing is not available for save-offer redemption.',
      });
    });
    expect(mockRequestPurchase).not.toHaveBeenCalled();
    expect(mockSaveSnapshot).not.toHaveBeenCalled();
  });

  it('throws when the billing hook is used outside the provider', () => {
    function InvalidProbe() {
      useBilling();

      return null;
    }

    expect(() => render(<InvalidProbe />)).toThrow(
      'useBilling must be used within BillingProvider',
    );
  });
});
