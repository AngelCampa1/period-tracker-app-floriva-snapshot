import { useEffect, useRef } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { OnboardingProvider, useOnboarding } from '@/src/features/onboarding/OnboardingProvider';
import { OnboardingPaywallScreen } from '@/src/features/onboarding/screens/OnboardingPaywallScreen';
import { testIds } from '@/src/testing/testIds';

function EnableTtc() {
  const { setTtcEnabled } = useOnboarding();
  const hasRun = useRef(false);
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    setTtcEnabled(true);
  });
  return null;
}

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockPresentOnboardingPaywall = jest.fn();
const mockPresentRestorePaywall = jest.fn();
const mockPurchasePlan = jest.fn();
const mockStartLifetimeTrial = jest.fn();
const mockRefreshBilling = jest.fn();
const mockUseBilling = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: (...args: unknown[]) => mockReplace(...args),
    push: (...args: unknown[]) => mockPush(...args),
    back: (...args: unknown[]) => mockBack(...args),
  }),
}));

jest.mock('@/src/features/billing/BillingProvider', () => ({
  useBilling: () => mockUseBilling(),
}));

jest.mock('@/src/localization/LocalizationProvider', () => {
  const mockLocalizedStrings: Record<string, string> = {
    'billing.legal.title': 'Localized legal',
    'billing.legal.description': 'Localized legal description.',
    'billing.legal.privacyPolicy': 'Localized privacy policy',
    'billing.legal.termsOfUse': 'Localized terms of use',
    'billing.buttons.annual': 'Choose annual plan',
    'billing.buttons.monthly': 'Choose monthly plan',
    'billing.buttons.lifetime': 'Unlock lifetime access',
    'billing.labels.oneTimePrice': 'One-time price',
    'billing.labels.price': 'Price',
    'billing.value.eyebrow': 'What you are paying for',
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
    'billing.plans.notChargedToday': 'You won’t be charged today.',
    'billing.plans.autoRenewDisclosure': 'Subscriptions auto-renew unless canceled.',
    'billing.onboarding.eyebrow': 'Floriva access',
    'billing.onboarding.title': 'Choose how to try Floriva.',
    'billing.onboarding.needsPurchase':
      'Pick a plan to start your free trial. You can switch or cancel anytime before the trial ends.',
    'billing.onboarding.expired':
      'Your trial has ended — choose a plan to keep your data and predictions.',
  };
  const interpolate = (key: string, params?: Record<string, unknown>) => {
    let value = mockLocalizedStrings[key] ?? key;
    if (params) {
      for (const [name, raw] of Object.entries(params)) {
        value = value.replaceAll(`{${name}}`, String(raw));
      }
    }
    return value;
  };
  return {
    useLocalization: () => ({
      isHydrated: true,
      localePreference: 'system',
      resolvedLocale: 'en',
      setLocalePreference: jest.fn(),
      t: (key: string, params?: Record<string, unknown>) => interpolate(key, params),
    }),
  };
});

describe('OnboardingPaywallScreen', () => {
  function createBillingState(overrides: Record<string, unknown> = {}) {
    return {
      isHydrated: true,
      isSyncing: false,
      isRefreshing: false,
      isRestoring: false,
      purchasingPlanId: null,
      offerings: [
        {
          planId: 'annual',
          title: 'Annual plan',
          priceLabel: '$39.99',
          detail: '1 month free, then billed yearly unless canceled first.',
          hasFreeTrial: true,
          isPurchaseAvailable: true,
        },
        {
          planId: 'lifetime',
          title: 'Lifetime plan',
          priceLabel: '$59.99',
          detail: 'One-time purchase for lifetime access on this store account.',
          hasFreeTrial: false,
          isPurchaseAvailable: true,
        },
        {
          planId: 'monthly',
          title: 'Monthly plan',
          priceLabel: '$5.99',
          detail: '1 month free, then billed monthly unless canceled first.',
          hasFreeTrial: true,
          isPurchaseAvailable: true,
        },
      ],
      lifetimeTrialEligible: true,
      purchasePlan: (...args: unknown[]) => mockPurchasePlan(...args),
      presentOnboardingPaywall: (...args: unknown[]) => mockPresentOnboardingPaywall(...args),
      presentRestorePaywall: (...args: unknown[]) => mockPresentRestorePaywall(...args),
      refreshBilling: (...args: unknown[]) => mockRefreshBilling(...args),
      startLifetimeTrial: (...args: unknown[]) => mockStartLifetimeTrial(...args),
      snapshot: {
        accessState: 'needs_purchase',
      },
      statusMessage: null,
      ...overrides,
    };
  }

  function renderScreen(extraChildren?: React.ReactNode) {
    return render(
      <OnboardingProvider>
        {extraChildren}
        <OnboardingPaywallScreen />
      </OnboardingProvider>,
    );
  }

  beforeEach(() => {
    mockReplace.mockReset();
    mockPush.mockReset();
    mockBack.mockReset();
    mockPresentOnboardingPaywall.mockReset();
    mockPresentRestorePaywall.mockReset();
    mockPurchasePlan.mockReset();
    mockPurchasePlan.mockResolvedValue(undefined);
    mockStartLifetimeTrial.mockReset();
    mockStartLifetimeTrial.mockResolvedValue(undefined);
    mockRefreshBilling.mockReset();
    mockRefreshBilling.mockResolvedValue(undefined);
    mockUseBilling.mockReset();
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not render any skip-without-purchase button', () => {
    mockUseBilling.mockReturnValue(createBillingState());

    renderScreen();

    expect(
      screen.queryByTestId(testIds.onboarding.paywall.continueWithoutTrialButton),
    ).toBeNull();
    expect(screen.queryByTestId(testIds.onboarding.paywall.continuePreviewButton)).toBeNull();
  });

  it('still offers restore and refresh on sync_error without a skip path', () => {
    mockUseBilling.mockReturnValue(
      createBillingState({
        snapshot: {
          accessState: 'sync_error',
        },
        statusMessage: 'Billing status could not refresh.',
      }),
    );

    renderScreen();

    expect(screen.getByTestId(testIds.onboarding.paywall.restoreButton)).toBeTruthy();
    expect(screen.getByTestId(testIds.onboarding.paywall.refreshButton)).toBeTruthy();
    expect(
      screen.queryByTestId(testIds.onboarding.paywall.continueWithoutTrialButton),
    ).toBeNull();
    expect(screen.queryByTestId(testIds.onboarding.paywall.continuePreviewButton)).toBeNull();
  });

  it('uses copy without a continue-without-trial implication on sync_error', () => {
    const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    try {
      mockUseBilling.mockReturnValue(
        createBillingState({
          snapshot: {
            accessState: 'sync_error',
          },
          statusMessage: 'Billing status could not refresh.',
        }),
      );

      renderScreen();

      expect(
        screen.getByText(
          'Billing could not refresh. You can try again or restore a purchase.',
        ),
      ).toBeTruthy();
      expect(screen.queryByText('Billing status could not refresh.')).toBeNull();
    } finally {
      (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
    }
  });

  it('renders selectable plan cards with a single shared call to action', () => {
    mockUseBilling.mockReturnValue(createBillingState());

    renderScreen();

    expect(screen.getByText('Annual plan')).toBeTruthy();
    expect(screen.getByText('Lifetime plan')).toBeTruthy();
    expect(screen.getByText('Monthly plan')).toBeTruthy();
    // Annual is pre-selected, so the single CTA reflects the annual plan.
    expect(
      screen.getByTestId(testIds.onboarding.paywall.purchaseSelectedButton),
    ).toHaveTextContent('Choose annual plan');
    expect(screen.getByTestId(testIds.onboarding.paywall.bestValueBadge)).toBeTruthy();
  });

  it('disables the shared call to action when the store has no offerings', () => {
    mockUseBilling.mockReturnValue(
      createBillingState({
        offerings: [],
      }),
    );

    renderScreen();

    expect(
      screen.getByTestId(testIds.onboarding.paywall.purchaseSelectedButton).props
        .accessibilityState.disabled,
    ).toBe(true);
  });

  it('keeps the paywall focused by dropping redundant explainer sections', () => {
    mockUseBilling.mockReturnValue(createBillingState());

    renderScreen();

    expect(screen.queryByText('What happens next')).toBeNull();
    expect(screen.queryByText('Billing terms')).toBeNull();
    expect(screen.queryByText('Before you continue')).toBeNull();
    expect(screen.queryByText('Billing details')).toBeNull();
    expect(screen.getByText('What you are paying for')).toBeTruthy();
    expect(screen.getByText('Stored only on this device')).toBeTruthy();
    expect(screen.getByText('No ads')).toBeTruthy();
    expect(screen.getByText('No data selling')).toBeTruthy();
  });

  it('purchases the pre-selected annual plan from the single call to action', () => {
    mockUseBilling.mockReturnValue(createBillingState());

    renderScreen();

    fireEvent.press(screen.getByTestId(testIds.onboarding.paywall.purchaseSelectedButton));

    expect(mockPurchasePlan).toHaveBeenCalledTimes(1);
    expect(mockPurchasePlan).toHaveBeenCalledWith('annual');
    expect(mockPush).not.toHaveBeenCalledWith('./billing-options?returnTo=paywall');
  });

  it('purchases a different plan after selecting its card', () => {
    mockUseBilling.mockReturnValue(createBillingState());

    renderScreen();

    fireEvent.press(screen.getByTestId(testIds.onboarding.paywall.purchaseMonthlyButton));
    fireEvent.press(screen.getByTestId(testIds.onboarding.paywall.purchaseSelectedButton));

    expect(mockPurchasePlan).toHaveBeenCalledTimes(1);
    expect(mockPurchasePlan).toHaveBeenCalledWith('monthly');
  });

  it('starts the app-level Lifetime trial from fresh onboarding', () => {
    mockUseBilling.mockReturnValue(createBillingState());

    renderScreen();

    fireEvent.press(screen.getByTestId(testIds.onboarding.paywall.purchaseLifetimeButton));
    fireEvent.press(screen.getByTestId(testIds.onboarding.paywall.purchaseSelectedButton));

    expect(mockStartLifetimeTrial).toHaveBeenCalledTimes(1);
    expect(mockPurchasePlan).not.toHaveBeenCalled();
  });

  it('purchases Lifetime when the app-level trial is not eligible', () => {
    mockUseBilling.mockReturnValue(
      createBillingState({
        lifetimeTrialEligible: false,
      }),
    );

    renderScreen();

    fireEvent.press(screen.getByTestId(testIds.onboarding.paywall.purchaseLifetimeButton));
    fireEvent.press(screen.getByTestId(testIds.onboarding.paywall.purchaseSelectedButton));

    expect(mockPurchasePlan).toHaveBeenCalledTimes(1);
    expect(mockPurchasePlan).toHaveBeenCalledWith('lifetime');
    expect(mockStartLifetimeTrial).not.toHaveBeenCalled();
  });

  it.each([
    ['trial_active', 'annual'],
    ['subscribed', 'monthly'],
    ['sync_error', 'annual'],
  ] as const)('hides Lifetime for %s recurring %s access', (accessState, planId) => {
    mockUseBilling.mockReturnValue(
      createBillingState({
        lifetimeTrialEligible: true,
        snapshot: { accessState, planId },
      }),
    );

    renderScreen();

    expect(
      screen.queryByTestId(testIds.onboarding.paywall.purchaseLifetimeButton),
    ).toBeNull();
    expect(screen.queryByText('Lifetime plan')).toBeNull();
    expect(screen.getByTestId(testIds.onboarding.paywall.purchaseAnnualButton)).toBeTruthy();
    expect(screen.getByTestId(testIds.onboarding.paywall.purchaseMonthlyButton)).toBeTruthy();
  });

  it('hides Lifetime while a no-plan billing snapshot is in sync_error', () => {
    mockUseBilling.mockReturnValue(
      createBillingState({
        lifetimeTrialEligible: true,
        snapshot: { accessState: 'sync_error' },
      }),
    );

    renderScreen();

    expect(
      screen.queryByTestId(testIds.onboarding.paywall.purchaseLifetimeButton),
    ).toBeNull();
    expect(screen.queryByText('Lifetime plan')).toBeNull();
  });

  it('keeps Lifetime available after recurring access is verified expired', () => {
    mockUseBilling.mockReturnValue(
      createBillingState({
        snapshot: { accessState: 'expired', planId: 'monthly' },
      }),
    );

    renderScreen();

    expect(
      screen.getByTestId(testIds.onboarding.paywall.purchaseLifetimeButton),
    ).toBeTruthy();
  });

  it('includes functional privacy policy and terms links in the purchase flow', () => {
    mockUseBilling.mockReturnValue(createBillingState());

    renderScreen();

    expect(screen.getByText('Localized legal')).toBeTruthy();
    expect(screen.getByText('Localized legal description.')).toBeTruthy();
    expect(screen.getByText('Localized privacy policy')).toBeTruthy();
    expect(screen.getByText('Localized terms of use')).toBeTruthy();

    fireEvent.press(screen.getByTestId(testIds.onboarding.paywall.privacyPolicyButton));
    fireEvent.press(screen.getByTestId(testIds.onboarding.paywall.termsOfUseButton));

    expect(Linking.openURL).toHaveBeenNthCalledWith(1, 'https://floriva.app/privacy');
    expect(Linking.openURL).toHaveBeenNthCalledWith(
      2,
      'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
    );
  });

  it('returns to the previous onboarding step when back is pressed', () => {
    mockUseBilling.mockReturnValue(createBillingState());

    renderScreen();

    fireEvent.press(screen.getByText('Back'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('keeps restore purchases visible', () => {
    mockUseBilling.mockReturnValue(createBillingState());

    renderScreen();

    expect(screen.getByText('Refresh billing')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Restore purchases'));
    fireEvent.press(screen.getByTestId(testIds.onboarding.paywall.restoreButton));

    expect(mockPresentRestorePaywall).toHaveBeenCalledTimes(2);
  });

  it('ignores the inline restore affordance while billing is syncing', () => {
    mockUseBilling.mockReturnValue(
      createBillingState({
        isSyncing: true,
      }),
    );

    renderScreen();

    fireEvent.press(screen.getByLabelText('Restore purchases'));

    expect(mockPresentRestorePaywall).not.toHaveBeenCalled();
  });

  it('keeps refresh available from the normal purchase state', () => {
    mockUseBilling.mockReturnValue(createBillingState());

    renderScreen();

    fireEvent.press(screen.getByTestId(testIds.onboarding.paywall.refreshButton));

    expect(mockRefreshBilling).toHaveBeenCalledTimes(1);
  });

  it('shows the trial timeline only when trial offers are available', () => {
    mockUseBilling.mockReturnValue(createBillingState());

    renderScreen();

    expect(screen.getByTestId(testIds.onboarding.paywall.trialTimeline)).toBeTruthy();
    expect(screen.getByText('How your free trial works')).toBeTruthy();
  });

  it('hides the trial timeline when no trial offers are available', () => {
    mockUseBilling.mockReturnValue(
      createBillingState({
        offerings: [
          {
            planId: 'annual',
            title: 'Annual plan',
            priceLabel: '$39.99',
            detail: 'Billed yearly unless canceled before the next renewal.',
            hasFreeTrial: false,
            isPurchaseAvailable: true,
          },
        ],
      }),
    );

    renderScreen();

    expect(screen.queryByTestId(testIds.onboarding.paywall.trialTimeline)).toBeNull();
  });

  it('disables the billing actions while billing is already syncing', () => {
    mockUseBilling.mockReturnValue(
      createBillingState({
        isSyncing: true,
      }),
    );

    renderScreen();

    expect(
      screen.getByTestId(testIds.onboarding.paywall.purchaseAnnualButton).props.accessibilityState
        .disabled,
    ).toBe(true);
    expect(
      screen.getByTestId(testIds.onboarding.paywall.purchaseSelectedButton).props
        .accessibilityState.disabled,
    ).toBe(true);
    expect(
      screen.getByTestId(testIds.onboarding.paywall.restoreButton).props.accessibilityState
        .disabled,
    ).toBe(true);
    expect(
      screen.getByTestId(testIds.onboarding.paywall.restoreInlineLink).props.accessibilityState
        .disabled,
    ).toBe(true);

    fireEvent.press(screen.getByTestId(testIds.onboarding.paywall.purchaseSelectedButton));
    fireEvent.press(screen.getByTestId(testIds.onboarding.paywall.restoreButton));
    fireEvent.press(screen.getByTestId(testIds.onboarding.paywall.restoreInlineLink));

    expect(mockPresentOnboardingPaywall).not.toHaveBeenCalled();
    expect(mockPresentRestorePaywall).not.toHaveBeenCalled();
    expect(mockPurchasePlan).not.toHaveBeenCalled();
  });

  it('disables the shared call to action while a purchase is in flight', () => {
    mockUseBilling.mockReturnValue(
      createBillingState({
        purchasingPlanId: 'annual',
      }),
    );

    renderScreen();

    expect(
      screen.getByTestId(testIds.onboarding.paywall.purchaseSelectedButton).props
        .accessibilityState.disabled,
    ).toBe(true);
  });

  it('moves entitled users straight to completion', async () => {
    mockUseBilling.mockReturnValue(
      createBillingState({
        snapshot: {
          accessState: 'trial_active',
        },
      }),
    );

    renderScreen();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('./completion');
    });
  });

  it('shows a loading shell before billing hydration completes', () => {
    mockUseBilling.mockReturnValue(
      createBillingState({
        isHydrated: false,
      }),
    );

    renderScreen();

    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('labels a non-trial monthly offering as a plan choice rather than a trial', () => {
    mockUseBilling.mockReturnValue(
      createBillingState({
        offerings: [
          {
            planId: 'monthly',
            title: 'Monthly plan',
            priceLabel: '$5.99',
            detail: 'Billed monthly unless canceled before the next renewal.',
            hasFreeTrial: false,
            isPurchaseAvailable: true,
          },
        ],
      }),
    );

    renderScreen();

    expect(
      screen.getByTestId(testIds.onboarding.paywall.purchaseSelectedButton),
    ).toHaveTextContent('Choose monthly plan');
    expect(screen.queryByText('Start monthly trial')).toBeNull();
  });

  it('shows a working label on the refresh action while billing refreshes', () => {
    mockUseBilling.mockReturnValue(
      createBillingState({
        isRefreshing: true,
      }),
    );

    renderScreen();

    expect(
      screen.getByTestId(testIds.onboarding.paywall.refreshButton),
    ).toHaveTextContent('Working…');
    expect(screen.queryByText('Refresh billing status')).toBeNull();
  });

  it('extends the progress total when trying-to-conceive tracking is enabled', async () => {
    mockUseBilling.mockReturnValue(createBillingState());

    renderScreen(<EnableTtc />);

    await waitFor(() => {
      expect(
        screen.getByTestId('screen-progress-track').props.accessibilityValue,
      ).toEqual({ min: 0, max: 10, now: 9 });
    });
  });

  it('supports the paywall back affordance', () => {
    mockUseBilling.mockReturnValue(createBillingState());

    renderScreen();

    fireEvent.press(screen.getByText('Back'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
