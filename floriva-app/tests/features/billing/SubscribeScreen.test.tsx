import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking, StyleSheet } from 'react-native';

const mockPurchasePlan = jest.fn();
const mockStartLifetimeTrial = jest.fn();
const mockPresentRestorePaywall = jest.fn();
const mockRefreshBilling = jest.fn();
const mockOpenManageSubscriptions = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => false);
let mockLocalSearchParams: { returnTo?: string | string[] } = {};

type MockBillingState = {
  isHydrated: boolean;
  isSyncing: boolean;
  isRefreshing: boolean;
  isRestoring: boolean;
  purchasingPlanId: 'annual' | 'lifetime' | 'monthly' | null;
  statusMessage: string | null;
  snapshot: {
    accessState: 'expired' | 'needs_purchase' | 'subscribed' | 'sync_error' | 'trial_active';
    planId?: 'annual' | 'lifetime' | 'monthly';
  };
  managementUrl: string | null;
  offerings: {
    planId: 'annual' | 'lifetime' | 'monthly';
    title: string;
    priceLabel: string;
    detail: string;
    hasFreeTrial: boolean;
    isPurchaseAvailable: boolean;
  }[];
  lifetimeTrialEligible: boolean;
  purchasePlan: (...args: unknown[]) => unknown;
  startLifetimeTrial: (...args: unknown[]) => unknown;
  presentRestorePaywall: (...args: unknown[]) => unknown;
  openManageSubscriptions: (...args: unknown[]) => unknown;
  refreshBilling: (...args: unknown[]) => unknown;
};

let mockBillingState: MockBillingState;

const mockLocalizedStrings: Record<string, string> = {
  'billing.screen.eyebrow': 'Billing',
  'billing.screen.title': 'Choose Floriva access',
  'billing.screen.loading': 'Checking your purchase status on this device.',
  'billing.screen.lockedNeedsPurchaseDescription':
    'Choose a plan to unlock Floriva. Start your free trial or pick a plan to begin.',
  'billing.screen.lockedExpiredDescription':
    'Your free trial has ended — choose a plan to keep using Floriva.',
  'billing.screen.lockedTrialActiveDescription':
    'Your free trial is active. You can review or change your plan anytime.',
  'billing.overview.title': 'Billing details',
  'billing.overview.description':
    'Review pricing, trial timing, and renewal details before you choose.',
  'billing.overview.trialNote':
    'If a plan includes a free trial, billing starts automatically when the trial ends unless you cancel first.',
  'billing.overview.reminderNote': 'Restoring or refreshing will not change your current plan.',
  'billing.support.title': 'Need help with billing?',
  'billing.support.description': 'Restore first, then refresh if your access still looks wrong.',
  'billing.legal.title': 'Legal',
  'billing.legal.description': 'Review Floriva policies before choosing a plan.',
  'billing.legal.privacyPolicy': 'Privacy Policy',
  'billing.legal.termsOfUse': 'Terms of Use',
  'billing.buttons.annual': 'Choose annual plan',
  'billing.buttons.lifetime': 'Unlock lifetime access',
  'billing.buttons.lifetimeStartTrial': 'Start free trial',
  'billing.offerings.lifetimeTrialDetail': 'Try 1 month free, then a one-time purchase.',
  'billing.buttons.monthly': 'Choose monthly plan',
  'billing.buttons.restore': 'Restore purchases',
  'billing.buttons.refresh': 'Refresh billing status',
  'billing.buttons.retry': 'Retry billing check',
  'billing.buttons.manage': 'Manage subscription',
  'billing.labels.oneTimePrice': 'One-time price',
  'billing.labels.price': 'Price',
  'billing.labels.refreshing': 'Refreshing billing status...',
  'billing.value.eyebrow': 'What you’re paying for',
  'billing.value.body': 'A simple, paid model is what keeps Floriva private.',
  'billing.value.onDevice': 'Stored only on this device',
  'billing.value.noAccount': 'No account required',
  'billing.value.noAds': 'No ads',
  'billing.value.noSelling': 'No data selling',
  'billing.timeline.title': 'How your free trial works',
  'billing.timeline.today': 'Today',
  'billing.timeline.reminderLabel': 'Trial reminder',
  'billing.timeline.chargeLabel': 'When your trial ends',
  'billing.timeline.todayBody': 'Full access to every feature.',
  'billing.timeline.reminderBody': 'We’ll remind you before the trial ends.',
  'billing.timeline.chargeBody': 'Your plan begins unless you cancel first.',
  'billing.plans.bestValueBadge': 'Best value',
  'billing.plans.savings': 'Save {percent}%',
  'billing.plans.perMonth': '{price}/mo',
  'billing.plans.notChargedToday': 'You won’t be charged today.',
  'billing.plans.autoRenewDisclosure': 'Subscriptions auto-renew unless canceled.',
  'settings.subscription.screen.backLabel': 'Back to settings',
};

jest.mock('@/src/localization/LocalizationProvider', () => ({
  useLocalization: () => ({
    isHydrated: true,
    localePreference: 'system',
    resolvedLocale: 'en',
    setLocalePreference: jest.fn(),
    t: (key: string, params?: Record<string, string | number>) => {
      let value = mockLocalizedStrings[key] ?? key;
      if (params) {
        for (const [name, raw] of Object.entries(params)) {
          value = value.replaceAll(`{${name}}`, String(raw));
        }
      }
      return value;
    },
  }),
}));

jest.mock('@/src/features/billing/BillingProvider', () => ({
  useBilling: () => mockBillingState,
}));

let mockAppShellState: { hasCompletedOnboarding: boolean; billingAccessState: string };

jest.mock('@/src/features/app-shell/AppShellProvider', () => ({
  useAppShell: () => ({ state: mockAppShellState }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: (...args: unknown[]) => mockBack(...args),
    canGoBack: () => mockCanGoBack(),
    replace: (...args: unknown[]) => mockReplace(...args),
  }),
  useLocalSearchParams: () => mockLocalSearchParams,
}));

// eslint-disable-next-line import/first
import { resolvePaidAccessGate } from '@/src/features/app-shell/resolvePaidAccessGate';
// eslint-disable-next-line import/first
import { SubscribeScreen } from '@/src/features/billing/screens/SubscribeScreen';
// eslint-disable-next-line import/first
import { testIds } from '@/src/testing/testIds';
// eslint-disable-next-line import/first
import { resolveTheme } from '@/src/theme/tokens';

function buildOfferings() {
  return [
    {
      planId: 'annual' as const,
      title: 'Annual plan',
      priceLabel: '$39.99',
      detail: '1 month free, then billed yearly unless canceled first.',
      hasFreeTrial: true,
      isPurchaseAvailable: true,
    },
    {
      planId: 'lifetime' as const,
      title: 'Lifetime plan',
      priceLabel: '$59.99',
      detail: 'One-time purchase for lifetime access on this store account.',
      hasFreeTrial: false,
      isPurchaseAvailable: true,
    },
    {
      planId: 'monthly' as const,
      title: 'Monthly plan',
      priceLabel: '$5.99',
      detail: '1 month free, then billed monthly unless canceled first.',
      hasFreeTrial: true,
      isPurchaseAvailable: true,
    },
  ];
}

describe('SubscribeScreen (full-lock paywall)', () => {
  const lightTheme = resolveTheme('light');

  beforeEach(() => {
    mockPurchasePlan.mockReset();
    mockPresentRestorePaywall.mockReset();
    mockRefreshBilling.mockReset();
    mockOpenManageSubscriptions.mockReset();
    mockBack.mockReset();
    mockReplace.mockReset();
    mockCanGoBack.mockReset();
    mockCanGoBack.mockReturnValue(false);
    mockLocalSearchParams = {};
    mockAppShellState = {
      hasCompletedOnboarding: true,
      billingAccessState: 'needs_purchase',
    };
    mockPurchasePlan.mockResolvedValue(undefined);
    mockPresentRestorePaywall.mockResolvedValue(undefined);
    mockRefreshBilling.mockResolvedValue(undefined);
    mockOpenManageSubscriptions.mockResolvedValue(undefined);
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    mockBillingState = {
      isHydrated: true,
      isSyncing: false,
      isRefreshing: false,
      isRestoring: false,
      purchasingPlanId: null,
      statusMessage: null,
      snapshot: {
        accessState: 'needs_purchase',
      },
      managementUrl: null,
      offerings: buildOfferings(),
      lifetimeTrialEligible: false,
      purchasePlan: (...args: unknown[]) => mockPurchasePlan(...args),
      startLifetimeTrial: (...args: unknown[]) => mockStartLifetimeTrial(...args),
      presentRestorePaywall: (...args: unknown[]) => mockPresentRestorePaywall(...args),
      openManageSubscriptions: (...args: unknown[]) => mockOpenManageSubscriptions(...args),
      refreshBilling: (...args: unknown[]) => mockRefreshBilling(...args),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders every configured offering as a selectable card with one shared purchase CTA', () => {
    render(<SubscribeScreen />);

    expect(screen.getByTestId(testIds.billing.screen)).toBeTruthy();
    expect(screen.getByText('Annual plan')).toBeTruthy();
    expect(screen.getByText('Lifetime plan')).toBeTruthy();
    expect(screen.getByText('Monthly plan')).toBeTruthy();
    expect(screen.getByTestId(testIds.billing.planCardAnnual)).toBeTruthy();
    expect(screen.getByTestId(testIds.billing.planCardLifetime)).toBeTruthy();
    expect(screen.getByTestId(testIds.billing.planCardMonthly)).toBeTruthy();

    // A single shared CTA replaces the legacy per-card purchase buttons.
    expect(screen.getByTestId(testIds.billing.purchaseSelectedButton)).toBeTruthy();
    expect(screen.queryByTestId(testIds.billing.purchaseAnnualButton)).toBeNull();
    expect(screen.queryByTestId(testIds.billing.purchaseLifetimeButton)).toBeNull();
    expect(screen.queryByTestId(testIds.billing.purchaseMonthlyButton)).toBeNull();
  });

  it('pre-selects the annual plan and surfaces the Best value badge', () => {
    render(<SubscribeScreen />);

    expect(screen.getByTestId(testIds.billing.bestValueBadge)).toBeTruthy();
    // Annual is the default selection, so the CTA targets the annual plan.
    expect(screen.getByText('Choose annual plan')).toBeTruthy();
  });

  it('shows the first-purchase choose-a-plan description for a needs_purchase lock', () => {
    render(<SubscribeScreen />);

    expect(
      screen.getByText(
        'Choose a plan to unlock Floriva. Start your free trial or pick a plan to begin.',
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        'Your free trial has ended — choose a plan to keep using Floriva.',
      ),
    ).toBeNull();
  });

  it('shows expired copy when the trial has ended', () => {
    mockBillingState.snapshot = { accessState: 'expired' };

    render(<SubscribeScreen />);

    expect(
      screen.getByText('Your free trial has ended — choose a plan to keep using Floriva.'),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        'Choose a plan to unlock Floriva. Start your free trial or pick a plan to begin.',
      ),
    ).toBeNull();
  });

  it('falls back to the first-purchase description for other non-expired locked states', () => {
    mockBillingState.snapshot = { accessState: 'sync_error' };

    render(<SubscribeScreen />);

    expect(
      screen.getByText(
        'Choose a plan to unlock Floriva. Start your free trial or pick a plan to begin.',
      ),
    ).toBeTruthy();
  });

  it('LT-28: shows trial-active copy instead of the no-access framing for a voluntary trial_active visit', () => {
    // SubscribeScreen is reachable from Settings' "Manage subscription" button
    // regardless of access state. A trial_active visitor previously fell
    // through to the generic needs-purchase copy ("Pick a plan to unlock
    // Floriva...") even though they already have an active trial.
    mockBillingState.snapshot = { accessState: 'trial_active' };

    render(<SubscribeScreen />);

    expect(
      screen.getByText('Your free trial is active. You can review or change your plan anytime.'),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        'Choose a plan to unlock Floriva. Start your free trial or pick a plan to begin.',
      ),
    ).toBeNull();
    expect(
      screen.queryByText('Your free trial has ended — choose a plan to keep using Floriva.'),
    ).toBeNull();
  });

  it('renders restore and manage subscription affordances', () => {
    render(<SubscribeScreen />);

    expect(screen.getByTestId(testIds.billing.restoreButton)).toBeTruthy();
    expect(screen.getByTestId(testIds.billing.manageButton)).toBeTruthy();
    expect(screen.getByText('Manage subscription')).toBeTruthy();
  });

  it('opens platform subscription management when manage is pressed', async () => {
    render(<SubscribeScreen />);

    fireEvent.press(screen.getByTestId(testIds.billing.manageButton));

    await waitFor(() => {
      expect(mockOpenManageSubscriptions).toHaveBeenCalledTimes(1);
    });
  });

  it('does not render any dismiss, close, skip, or continue-without control when locked (needs_purchase)', () => {
    render(<SubscribeScreen />);

    expect(screen.queryByText('Back to settings')).toBeNull();
    expect(screen.queryByTestId(testIds.billing.backButton)).toBeNull();
    expect(screen.queryByTestId('screen-back-button')).toBeNull();
    expect(screen.queryByText(/continue without/i)).toBeNull();
    expect(screen.queryByText(/skip/i)).toBeNull();
    expect(screen.queryByText(/close/i)).toBeNull();
    expect(screen.queryByText(/maybe later/i)).toBeNull();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('does not render any dismiss control when locked after an expired trial', () => {
    mockBillingState.snapshot = { accessState: 'expired' };
    mockAppShellState.billingAccessState = 'expired';

    render(<SubscribeScreen />);

    expect(screen.queryByText('Back to settings')).toBeNull();
    expect(screen.queryByTestId(testIds.billing.backButton)).toBeNull();
    expect(screen.queryByTestId('screen-back-button')).toBeNull();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('does not render a dismiss control on the loading shell while locked', () => {
    mockBillingState.isHydrated = false;

    render(<SubscribeScreen />);

    expect(screen.getByTestId(testIds.billing.loadingState)).toBeTruthy();
    expect(screen.queryByText('Back to settings')).toBeNull();
    expect(screen.queryByTestId(testIds.billing.backButton)).toBeNull();
    expect(screen.queryByTestId('screen-back-button')).toBeNull();
  });

  it('renders a back affordance for a non-locked sync_error user', () => {
    mockBillingState.snapshot = { accessState: 'sync_error' };
    mockAppShellState.billingAccessState = 'sync_error';
    mockCanGoBack.mockReturnValue(true);

    render(<SubscribeScreen />);

    expect(screen.getByTestId(testIds.billing.backButton)).toBeTruthy();
    expect(screen.getByText('Back to settings')).toBeTruthy();
  });

  it('renders a back affordance on the loading shell for a non-locked sync_error user', () => {
    mockBillingState.isHydrated = false;
    mockBillingState.snapshot = { accessState: 'sync_error' };
    mockAppShellState.billingAccessState = 'sync_error';
    mockCanGoBack.mockReturnValue(true);

    render(<SubscribeScreen />);

    expect(screen.getByTestId(testIds.billing.loadingState)).toBeTruthy();
    expect(screen.getByTestId(testIds.billing.backButton)).toBeTruthy();
  });

  it('returns the non-locked user to the prior screen via router.back when possible', () => {
    mockBillingState.snapshot = { accessState: 'sync_error' };
    mockAppShellState.billingAccessState = 'sync_error';
    mockCanGoBack.mockReturnValue(true);

    render(<SubscribeScreen />);

    fireEvent.press(screen.getByTestId(testIds.billing.backButton));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('replaces to the resolved return href when the non-locked user cannot go back', () => {
    mockBillingState.snapshot = { accessState: 'sync_error' };
    mockAppShellState.billingAccessState = 'sync_error';
    mockCanGoBack.mockReturnValue(false);
    mockLocalSearchParams = { returnTo: 'settings' };

    render(<SubscribeScreen />);

    fireEvent.press(screen.getByTestId(testIds.billing.backButton));

    expect(mockReplace).toHaveBeenCalledWith('/settings');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('replaces to the paywall return href when requested by a non-locked user', () => {
    mockBillingState.snapshot = { accessState: 'sync_error' };
    mockAppShellState.billingAccessState = 'sync_error';
    mockCanGoBack.mockReturnValue(false);
    mockLocalSearchParams = { returnTo: 'paywall' };

    render(<SubscribeScreen />);

    fireEvent.press(screen.getByTestId(testIds.billing.backButton));

    expect(mockReplace).toHaveBeenCalledWith('/paywall');
  });

  it('treats a throwing canGoBack as no navigation history for a non-locked user', () => {
    mockBillingState.snapshot = { accessState: 'sync_error' };
    mockAppShellState.billingAccessState = 'sync_error';
    mockCanGoBack.mockImplementation(() => {
      throw new Error('router not ready');
    });
    mockLocalSearchParams = { returnTo: 'settings' };

    render(<SubscribeScreen />);

    fireEvent.press(screen.getByTestId(testIds.billing.backButton));

    expect(mockReplace).toHaveBeenCalledWith('/settings');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('hides the back affordance for a non-locked sync_error user with no return path', () => {
    mockBillingState.snapshot = { accessState: 'sync_error' };
    mockAppShellState.billingAccessState = 'sync_error';
    mockCanGoBack.mockReturnValue(false);
    mockLocalSearchParams = {};

    render(<SubscribeScreen />);

    expect(screen.queryByTestId(testIds.billing.backButton)).toBeNull();
  });

  it('purchases the selected plan via the shared CTA', async () => {
    render(<SubscribeScreen />);

    // Default selection is annual.
    fireEvent.press(screen.getByTestId(testIds.billing.purchaseSelectedButton));
    // Switch to lifetime, then monthly, purchasing each via the shared CTA.
    fireEvent.press(screen.getByTestId(testIds.billing.planCardLifetime));
    fireEvent.press(screen.getByTestId(testIds.billing.purchaseSelectedButton));
    fireEvent.press(screen.getByTestId(testIds.billing.planCardMonthly));
    fireEvent.press(screen.getByTestId(testIds.billing.purchaseSelectedButton));

    await waitFor(() => {
      expect(mockPurchasePlan).toHaveBeenNthCalledWith(1, 'annual');
      expect(mockPurchasePlan).toHaveBeenNthCalledWith(2, 'lifetime');
      expect(mockPurchasePlan).toHaveBeenNthCalledWith(3, 'monthly');
    });
  });

  it('starts the app-level lifetime trial via the shared CTA when eligible', async () => {
    mockBillingState.lifetimeTrialEligible = true;
    render(<SubscribeScreen />);

    fireEvent.press(screen.getByTestId(testIds.billing.planCardLifetime));
    expect(screen.getByText('Start free trial')).toBeTruthy();

    fireEvent.press(screen.getByTestId(testIds.billing.purchaseSelectedButton));

    await waitFor(() => {
      expect(mockStartLifetimeTrial).toHaveBeenCalledTimes(1);
    });
    expect(mockPurchasePlan).not.toHaveBeenCalled();
  });

  it.each([
    ['trial_active', 'annual'],
    ['subscribed', 'monthly'],
    ['sync_error', 'annual'],
  ] as const)('hides Lifetime for %s recurring %s access', (accessState, planId) => {
    mockBillingState.snapshot = { accessState, planId };
    mockBillingState.lifetimeTrialEligible = true;

    render(<SubscribeScreen />);

    expect(screen.queryByTestId(testIds.billing.planCardLifetime)).toBeNull();
    expect(screen.queryByText('Lifetime plan')).toBeNull();
    expect(screen.getByTestId(testIds.billing.planCardAnnual)).toBeTruthy();
    expect(screen.getByTestId(testIds.billing.planCardMonthly)).toBeTruthy();
  });

  it('hides Lifetime while a no-plan billing snapshot is in sync_error', () => {
    mockBillingState.snapshot = { accessState: 'sync_error' };
    mockBillingState.lifetimeTrialEligible = true;

    render(<SubscribeScreen />);

    expect(screen.queryByTestId(testIds.billing.planCardLifetime)).toBeNull();
    expect(screen.queryByText('Lifetime plan')).toBeNull();
  });

  it('keeps Lifetime available after recurring access is verified expired', () => {
    mockBillingState.snapshot = { accessState: 'expired', planId: 'annual' };

    render(<SubscribeScreen />);

    expect(screen.getByTestId(testIds.billing.planCardLifetime)).toBeTruthy();
  });

  it('keeps restore and refresh available', async () => {
    render(<SubscribeScreen />);

    fireEvent.press(screen.getByTestId(testIds.billing.restoreButton));
    fireEvent.press(screen.getByTestId(testIds.billing.refreshButton));

    await waitFor(() => {
      expect(mockPresentRestorePaywall).toHaveBeenCalledTimes(1);
      expect(mockRefreshBilling).toHaveBeenCalledTimes(1);
    });
  });

  it('includes functional privacy policy and terms links', () => {
    render(<SubscribeScreen />);

    fireEvent.press(screen.getByTestId(testIds.billing.privacyPolicyButton));
    fireEvent.press(screen.getByTestId(testIds.billing.termsOfUseButton));

    expect(Linking.openURL).toHaveBeenNthCalledWith(1, 'https://floriva.app/privacy');
    expect(Linking.openURL).toHaveBeenNthCalledWith(
      2,
      'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
    );
  });

  it('renders the loading shell before billing hydration completes', () => {
    mockBillingState.isHydrated = false;

    render(<SubscribeScreen />);

    expect(screen.getByTestId(testIds.billing.screen)).toBeTruthy();
    expect(screen.getByTestId(testIds.billing.loadingState)).toBeTruthy();
    expect(screen.queryByTestId(testIds.billing.purchaseSelectedButton)).toBeNull();
  });

  it('disables purchase, restore, manage, and refresh while a refresh is in flight', () => {
    mockBillingState.isSyncing = true;
    mockBillingState.isRefreshing = true;

    render(<SubscribeScreen />);

    expect(
      screen.getByTestId(testIds.billing.purchaseSelectedButton).props.accessibilityState,
    ).toEqual({
      disabled: true,
    });
    expect(screen.getByTestId(testIds.billing.restoreButton).props.accessibilityState).toEqual({
      disabled: true,
    });
    expect(screen.getByTestId(testIds.billing.manageButton).props.accessibilityState).toEqual({
      disabled: true,
    });
    expect(screen.getByTestId(testIds.billing.refreshButton).props.accessibilityState).toEqual({
      disabled: true,
    });
    expect(screen.getByText('Refreshing billing status...')).toBeTruthy();
  });

  it('disables the shared purchase CTA while a purchase is in flight', () => {
    mockBillingState.isSyncing = true;
    mockBillingState.purchasingPlanId = 'annual';

    render(<SubscribeScreen />);

    expect(
      screen.getByTestId(testIds.billing.purchaseSelectedButton).props.accessibilityState,
    ).toEqual({
      disabled: true,
    });
  });

  it('keeps plan cards visible while disabling the CTA when the selected plan is unavailable', () => {
    mockBillingState.offerings = mockBillingState.offerings.map((offering) => ({
      ...offering,
      isPurchaseAvailable: false,
    }));

    render(<SubscribeScreen />);

    expect(screen.getByText('Annual plan')).toBeTruthy();
    // Annual is selected by default; with it unavailable, the shared CTA is disabled.
    expect(
      screen.getByTestId(testIds.billing.purchaseSelectedButton).props.accessibilityState,
    ).toEqual({
      disabled: true,
    });
    expect(screen.getByTestId(testIds.billing.restoreButton).props.accessibilityState).toEqual({
      disabled: false,
    });

    fireEvent.press(screen.getByTestId(testIds.billing.purchaseSelectedButton));

    expect(mockPurchasePlan).not.toHaveBeenCalled();
  });

  it('uses the retry label when billing is currently in sync_error', () => {
    mockBillingState.snapshot = { accessState: 'sync_error' };

    render(<SubscribeScreen />);

    expect(screen.getByText('Retry billing check')).toBeTruthy();
  });

  it('renders the trial timeline and not-charged-today reassurance when a trial is offered', () => {
    render(<SubscribeScreen />);

    expect(screen.getByTestId(testIds.billing.trialTimeline)).toBeTruthy();
    expect(screen.getByTestId(testIds.billing.notChargedToday)).toBeTruthy();
  });

  it('hides the trial timeline when the catalog has no free trial offers', () => {
    mockBillingState.offerings = buildOfferings().map((offering) => ({
      ...offering,
      hasFreeTrial: false,
    }));

    render(<SubscribeScreen />);

    expect(screen.queryByTestId(testIds.billing.trialTimeline)).toBeNull();
    expect(screen.queryByTestId(testIds.billing.notChargedToday)).toBeNull();
  });

  it('highlights the selected plan card with an accent border while keeping others unselected', () => {
    render(<SubscribeScreen />);

    fireEvent.press(screen.getByTestId(testIds.billing.planCardLifetime));

    const selectedStyle = StyleSheet.flatten(
      screen.getByTestId(testIds.billing.planCardLifetime).props.style,
    );
    const unselectedStyle = StyleSheet.flatten(
      screen.getByTestId(testIds.billing.planCardAnnual).props.style,
    );

    expect(selectedStyle.borderColor).toBe(lightTheme.colors.accentPrimary);
    expect(unselectedStyle.borderColor).toBe(lightTheme.colors.borderPrimary);
  });

  it('never force-locks an expired user onto the paywall (paid gate retired)', () => {
    mockBillingState.snapshot = { accessState: 'expired' };
    mockAppShellState = {
      hasCompletedOnboarding: true,
      billingAccessState: 'expired',
    };
    // No history and no returnTo: previously the force-lock case with no escape.
    mockCanGoBack.mockReturnValue(false);
    mockLocalSearchParams = {};

    const view = render(<SubscribeScreen />);
    view.rerender(<SubscribeScreen />);

    // The screen is now purely informational — it must never trap the user,
    // and it must not hijack navigation on its own.
    expect(mockReplace).not.toHaveBeenCalled();
    expect(resolvePaidAccessGate(mockAppShellState as never)).toBe(false);
  });

  it('does not auto-route an entitled user who opened the paywall voluntarily', () => {
    mockBillingState.snapshot = { accessState: 'trial_active' };
    mockAppShellState = {
      hasCompletedOnboarding: true,
      billingAccessState: 'trial_active',
    };
    mockCanGoBack.mockReturnValue(true);

    const view = render(<SubscribeScreen />);
    view.rerender(<SubscribeScreen />);

    expect(mockReplace).not.toHaveBeenCalledWith('/today');
  });

  it('renders the billing status message when present', () => {
    mockBillingState.statusMessage = 'Billing is unavailable on this device.';

    render(<SubscribeScreen />);

    expect(screen.getByTestId(testIds.billing.statusMessage)).toBeTruthy();
    expect(screen.getByText('Billing is unavailable on this device.')).toBeTruthy();
  });
});
