import { Platform } from 'react-native';
import { act, configure, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// SaveOfferScreen is exercised through the REAL BillingProvider so that
// useBilling() resolves the real redeemSaveOffer/openManageSubscriptions, and
// resolveSaveOffer runs against the real save-offer config. The only stand-ins
// are the persistence layer (in-memory snapshot), the native IAP bridge, and
// expo-router navigation — everything billing-specific is real wiring.

const mockGetSnapshot = jest.fn();
const mockSaveSnapshot = jest.fn();
const mockApplyBillingSnapshot = jest.fn();
const mockReconcileBillingReminderNotification = jest.fn();
const mockOpenURL = jest.fn();
const mockSetStringAsync = jest.fn();
const mockPresentCodeRedemptionSheetIOS = jest.fn();
const mockGetActiveSubscriptions = jest.fn();
const mockReportRuntimeDiagnostic = jest.fn();
const mockResolveDevLaunchPreset = jest.fn<string | null, []>(() => null);
const mockHasNativeBillingConfig = jest.fn(() => true);

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockPush = jest.fn();

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

// Localization resolves against the REAL English translation table so the
// screen renders the actual shipped save-offer copy. We only swap the provider
// hook (which would otherwise require a hydrated database) for a thin wrapper.
jest.mock('@/src/localization/LocalizationProvider', () => {
  const { translate } = jest.requireActual('@/src/localization/translations');

  // `t` must keep a stable identity across renders: BillingProvider has an
  // effect that depends on `t`, so a fresh closure each render would re-run it
  // and loop on setOfferings.
  const t = (key: string, params?: Record<string, string | number>) =>
    translate('en', key, params);
  const setLocalePreference = jest.fn();

  return {
    useLocalization: () => ({
      isHydrated: true,
      localePreference: 'system',
      resolvedLocale: 'en',
      setLocalePreference,
      t,
    }),
  };
});

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

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: (...args: unknown[]) => mockReplace(...args),
    back: (...args: unknown[]) => mockBack(...args),
    push: (...args: unknown[]) => mockPush(...args),
  }),
}));

// Native IAP bridge is never reached in these tests: subscribed/trial snapshots
// hydrate from the persisted cache and the redeem path runs in E2E mode.
jest.mock('expo-iap', () => ({
  ErrorCode: { UserCancelled: 'user-cancelled' },
  fetchProducts: jest.fn(() => Promise.resolve([])),
  getAvailablePurchases: jest.fn(() => Promise.resolve([])),
  getActiveSubscriptions: (...args: unknown[]) => mockGetActiveSubscriptions(...args),
  presentCodeRedemptionSheetIOS: (...args: unknown[]) =>
    mockPresentCodeRedemptionSheetIOS(...args),
  useIAP: jest.fn(() => ({
    connected: true,
    reconnect: jest.fn(() => Promise.resolve(true)),
    requestPurchase: jest.fn(() => Promise.resolve(null)),
    finishTransaction: jest.fn(() => Promise.resolve(undefined)),
    restorePurchases: jest.fn(() => Promise.resolve(undefined)),
  })),
}));

// eslint-disable-next-line import/first
import { BillingProvider } from '@/src/features/billing/BillingProvider';
// eslint-disable-next-line import/first
import { SaveOfferScreen } from '@/src/features/billing/screens/SaveOfferScreen';
// eslint-disable-next-line import/first
import { testIds } from '@/src/testing/testIds';

const platformOsDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');

function setPlatformOs(nextOs: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    get: () => nextOs,
  });
}

type SeedSnapshot = {
  accessState: 'subscribed' | 'trial_active';
  planId: 'monthly' | 'annual';
  trialEndsAt?: string;
  firstChargeAt?: string;
  saveOfferRedeemedAt?: string;
};

function renderSaveOffer(snapshot: SeedSnapshot) {
  mockGetSnapshot.mockResolvedValue({
    lastSyncedAt: '2026-04-01T12:00:00.000Z',
    ...snapshot,
  });

  return render(
    <BillingProvider>
      <SaveOfferScreen />
    </BillingProvider>,
  );
}

describe('SaveOfferScreen (real provider integration)', () => {
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
    mockPresentCodeRedemptionSheetIOS.mockReset();
    mockGetActiveSubscriptions.mockReset();
    mockReportRuntimeDiagnostic.mockReset();
    mockResolveDevLaunchPreset.mockReset();
    mockHasNativeBillingConfig.mockReset();
    mockReplace.mockReset();
    mockBack.mockReset();
    mockPush.mockReset();

    mockResolveDevLaunchPreset.mockReturnValue(null);
    mockHasNativeBillingConfig.mockReturnValue(true);
    mockSaveSnapshot.mockResolvedValue(undefined);
    mockSetStringAsync.mockResolvedValue(true);
    mockPresentCodeRedemptionSheetIOS.mockResolvedValue(undefined);
    mockGetActiveSubscriptions.mockResolvedValue([]);

    // Local billing E2E mode keeps the provider off the native StoreKit bridge,
    // so the offer screen renders from the persisted snapshot and the accept
    // path redeems through the real local-success redeem flow. This is the same
    // mode the BillingProvider redeem integration test exercises.
    process.env.EXPO_PUBLIC_BILLING_E2E_MODE = 'local-purchase-success';
    setPlatformOs('ios');
  });

  afterEach(() => {
    if (platformOsDescriptor) {
      Object.defineProperty(Platform, 'OS', platformOsDescriptor);
    }
    jest.restoreAllMocks();
  });

  // The screen now gates on `isHydrated`: it never computes the offer-null
  // redirect during the hydration window, so an ELIGIBLE offer renders after a
  // brief hydration with no spurious bounce. We assert this directly — wait for
  // the offer copy, then confirm no fallback navigation ever happened.
  async function waitForOffer(titlePattern: RegExp) {
    await waitFor(() => {
      expect(screen.getByText(titlePattern)).toBeTruthy();
    });
    // An eligible offer must never trigger the ineligible-entry fallback, even
    // transiently during hydration. These observers are NOT cleared.
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockOpenURL).not.toHaveBeenCalled();
  }

  it('renders the monthly 80%-off offer with the discounted price for a subscribed monthly user', async () => {
    renderSaveOffer({ accessState: 'subscribed', planId: 'monthly' });

    await waitForOffer(/80% off the next 3 months/);

    expect(screen.getByText(/\$1\.20\/month/)).toBeTruthy();
    expect(screen.getByText('Apple offer code')).toBeTruthy();
    expect(screen.getByText(/SAVEMONTHLY/)).toBeTruthy();
    expect(screen.getByText(/copied.*paste.*Apple.*redemption sheet/i)).toBeTruthy();
    expect(screen.getByTestId(testIds.settings.saveOfferAcceptButton)).toBeTruthy();
  });

  // UL-35: the offer-code mechanics are redemption logistics, not pitch — they
  // must follow the decision buttons, not interrupt the pitch above them.
  it('renders the Apple offer-code mechanics after the decision buttons', async () => {
    renderSaveOffer({ accessState: 'subscribed', planId: 'monthly' });

    await waitForOffer(/80% off the next 3 months/);

    const tree = JSON.stringify(screen.toJSON());
    const acceptIndex = tree.indexOf(testIds.settings.saveOfferAcceptButton);
    const declineIndex = tree.indexOf(testIds.settings.saveOfferDeclineButton);
    const codeIndex = tree.indexOf('SAVEMONTHLY');
    expect(acceptIndex).toBeGreaterThan(-1);
    expect(declineIndex).toBeGreaterThan(acceptIndex);
    expect(codeIndex).toBeGreaterThan(declineIndex);
  });

  it('does not render Apple offer-code guidance on Android', async () => {
    setPlatformOs('android');
    renderSaveOffer({ accessState: 'subscribed', planId: 'monthly' });

    await waitForOffer(/80% off the next 3 months/);

    expect(screen.queryByText('Apple offer code')).toBeNull();
    expect(screen.queryByText(/SAVEMONTHLY/)).toBeNull();
  });

  it('renders the annual 30%-off renewal offer for a subscribed annual user', async () => {
    renderSaveOffer({ accessState: 'subscribed', planId: 'annual' });

    await waitForOffer(/30% off your next year/);

    expect(screen.getByText(/\$27\.99/)).toBeTruthy();
  });

  it('renders the annual trial 30%-off first-year offer for a trial-active annual user', async () => {
    renderSaveOffer({
      accessState: 'trial_active',
      planId: 'annual',
      trialEndsAt: '2026-05-13T12:00:00.000Z',
      firstChargeAt: '2026-05-13T12:00:00.000Z',
    });

    await waitForOffer(/30% off your first year/);

    expect(screen.getByText(/\$27\.99/)).toBeTruthy();
  });

  it('falls through to the subscription manager exactly once when no offer is eligible after hydration', async () => {
    // saveOfferRedeemedAt already set -> resolveSaveOffer returns null even for a
    // subscribed user. This is the genuine ineligible-entry case (e.g. a direct
    // deep-link after the offer was redeemed) the fallback effect handles. The
    // fallback must fire only AFTER billing has settled, and only once.
    renderSaveOffer({
      accessState: 'subscribed',
      planId: 'monthly',
      saveOfferRedeemedAt: '2026-04-10T12:00:00.000Z',
    });

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalledTimes(1);
    });

    expect(mockOpenURL).toHaveBeenCalledWith(
      'https://apps.apple.com/account/subscriptions',
    );
    // The offer UI never renders for an ineligible entry.
    expect(screen.queryByTestId(testIds.settings.saveOfferAcceptButton)).toBeNull();
    // Fallback navigation is one-shot — no repeated bounce on re-render.
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('redeems the offer in E2E mode and replaces to settings on accept', async () => {
    renderSaveOffer({ accessState: 'subscribed', planId: 'monthly' });

    await waitForOffer(/80% off the next 3 months/);

    await act(async () => {
      fireEvent.press(screen.getByTestId(testIds.settings.saveOfferAcceptButton));
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/settings');
    });

    // The real redeem path stamped the redeemed flag onto the persisted snapshot,
    // which is what suppresses the offer from ever resurfacing.
    const persisted = mockSaveSnapshot.mock.calls.at(-1)?.[0];
    expect(persisted.saveOfferRedeemedAt).toBe('2026-04-13T12:00:00.000Z');
  });

  it('shows the localized failure status when Apple offer-code copying fails', async () => {
    delete process.env.EXPO_PUBLIC_BILLING_E2E_MODE;
    mockSetStringAsync.mockRejectedValueOnce(new Error('clipboard unavailable'));
    mockGetActiveSubscriptions.mockResolvedValue([
      {
        productId: 'floriva.monthly',
        isActive: true,
        expirationDateIOS: Date.parse('2026-05-13T12:00:00.000Z'),
        transactionDate: Date.parse('2026-04-13T12:00:00.000Z'),
      },
    ]);
    renderSaveOffer({ accessState: 'subscribed', planId: 'monthly' });

    await waitForOffer(/80% off the next 3 months/);

    await act(async () => {
      fireEvent.press(screen.getByTestId(testIds.settings.saveOfferAcceptButton));
    });

    await waitFor(() => {
      expect(
        screen.getByText('That didn’t go through. Try again or continue to cancel.'),
      ).toBeTruthy();
    });
    expect(mockPresentCodeRedemptionSheetIOS).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('opens manage subscriptions and goes back without redeeming on decline', async () => {
    renderSaveOffer({ accessState: 'subscribed', planId: 'monthly' });

    await waitForOffer(/80% off the next 3 months/);

    await act(async () => {
      fireEvent.press(screen.getByTestId(testIds.settings.saveOfferDeclineButton));
    });

    await waitFor(() => {
      expect(mockOpenURL).toHaveBeenCalledWith(
        'https://apps.apple.com/account/subscriptions',
      );
      expect(mockBack).toHaveBeenCalledTimes(1);
    });

    expect(mockReplace).not.toHaveBeenCalledWith('/settings');
    expect(
      mockSaveSnapshot.mock.calls.every(
        (call) => (call[0] as { saveOfferRedeemedAt?: string }).saveOfferRedeemedAt == null,
      ),
    ).toBe(true);
  });
});
