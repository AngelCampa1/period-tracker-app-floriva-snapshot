import { fireEvent, render, screen, within } from '@testing-library/react-native';

jest.mock('@/src/localization/LocalizationProvider', () => {
  const mockLocalizedStrings: Record<string, string> = {
    'billing.labels.price': 'Price',
    'billing.labels.oneTimePrice': 'One-time price',
    'billing.buttons.annual': 'Choose annual plan',
    'billing.buttons.monthly': 'Choose monthly plan',
    'billing.buttons.lifetime': 'Unlock lifetime access',
    'billing.buttons.lifetimeStartTrial': 'Start free trial',
    'billing.offerings.lifetimeTrialDetail': 'Try 1 month free, then a one-time purchase.',
    'billing.plans.bestValueBadge': 'Best value',
    'billing.plans.notChargedToday': 'You won’t be charged today.',
    'billing.plans.autoRenewDisclosure': 'Subscriptions auto-renew unless canceled.',
    'billing.plans.savings': 'Save {percent}%',
    'billing.plans.selectedBadge': 'Selected',
    'billing.plans.perMonth': '{price}/mo',
  };
  const interpolate = (key: string, params?: Record<string, string | number>) => {
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
      resolvedLocale: 'en',
      t: interpolate,
    }),
  };
});

// eslint-disable-next-line import/first
import { PaywallPlanSelector } from '@/src/features/billing/components/PaywallPlanSelector';
// eslint-disable-next-line import/first
import { testIds } from '@/src/testing/testIds';

const OFFERINGS = [
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

const SELECTOR_TEST_IDS = {
  planCardAnnual: testIds.billing.planCardAnnual,
  planCardMonthly: testIds.billing.planCardMonthly,
  planCardLifetime: testIds.billing.planCardLifetime,
  bestValueBadge: testIds.billing.bestValueBadge,
  purchaseButton: testIds.billing.purchaseSelectedButton,
  notChargedToday: testIds.billing.notChargedToday,
};

function renderSelector(overrides: Partial<React.ComponentProps<typeof PaywallPlanSelector>> = {}) {
  const onSelect = jest.fn();
  const onPurchase = jest.fn();
  render(
    <PaywallPlanSelector
      offerings={OFFERINGS}
      selectedPlanId="annual"
      onSelect={onSelect}
      onPurchase={onPurchase}
      purchasingPlanId={null}
      actionsDisabled={false}
      testIds={SELECTOR_TEST_IDS}
      {...overrides}
    />,
  );
  return { onSelect, onPurchase };
}

describe('PaywallPlanSelector', () => {
  it('shows the Best value badge and savings only on the annual card', () => {
    renderSelector();
    expect(screen.getByTestId(SELECTOR_TEST_IDS.bestValueBadge)).toBeTruthy();
    expect(screen.getByText('Save 44%')).toBeTruthy();
    expect(screen.getByText('$3.33/mo')).toBeTruthy();
  });

  // UL-10: the chosen plan must be stated in words on the card itself,
  // not carried by border-weight alone.
  it('marks the selected card with a visible Selected badge', () => {
    renderSelector();

    const annualCard = screen.getByTestId(SELECTOR_TEST_IDS.planCardAnnual);
    expect(within(annualCard).getByText('Selected')).toBeTruthy();
    const monthlyCard = screen.getByTestId(SELECTOR_TEST_IDS.planCardMonthly);
    expect(within(monthlyCard).queryByText('Selected')).toBeNull();
  });

  it('moves the Selected badge with the selection', () => {
    renderSelector({ selectedPlanId: 'monthly' });

    const monthlyCard = screen.getByTestId(SELECTOR_TEST_IDS.planCardMonthly);
    expect(within(monthlyCard).getByText('Selected')).toBeTruthy();
    const annualCard = screen.getByTestId(SELECTOR_TEST_IDS.planCardAnnual);
    expect(within(annualCard).queryByText('Selected')).toBeNull();
  });

  it('does not render a purchase button per card — only one shared CTA', () => {
    renderSelector();
    expect(screen.queryByTestId(testIds.billing.purchaseAnnualButton)).toBeNull();
    expect(screen.queryByTestId(testIds.billing.purchaseMonthlyButton)).toBeNull();
    expect(screen.queryByTestId(testIds.billing.purchaseLifetimeButton)).toBeNull();
    expect(screen.getByTestId(SELECTOR_TEST_IDS.purchaseButton)).toBeTruthy();
  });

  it('labels the CTA from the selected plan and purchases the selected plan', () => {
    const { onPurchase } = renderSelector({ selectedPlanId: 'annual' });
    expect(screen.getByText('Choose annual plan')).toBeTruthy();
    fireEvent.press(screen.getByTestId(SELECTOR_TEST_IDS.purchaseButton));
    expect(onPurchase).toHaveBeenCalledWith('annual');
  });

  it('reflects a different selection in the CTA label and target', () => {
    const { onPurchase } = renderSelector({ selectedPlanId: 'lifetime' });
    expect(screen.getByText('Unlock lifetime access')).toBeTruthy();
    fireEvent.press(screen.getByTestId(SELECTOR_TEST_IDS.purchaseButton));
    expect(onPurchase).toHaveBeenCalledWith('lifetime');
  });

  it('calls onSelect when a different card is tapped', () => {
    const { onSelect } = renderSelector({ selectedPlanId: 'annual' });
    fireEvent.press(screen.getByTestId(SELECTOR_TEST_IDS.planCardMonthly));
    expect(onSelect).toHaveBeenCalledWith('monthly');
  });

  it('shows the not-charged-today reassurance when the selected plan has a trial', () => {
    renderSelector({ selectedPlanId: 'annual' });
    expect(screen.getByTestId(SELECTOR_TEST_IDS.notChargedToday)).toBeTruthy();
  });

  it('hides the not-charged-today reassurance for a no-trial plan', () => {
    renderSelector({ selectedPlanId: 'lifetime' });
    expect(screen.queryByTestId(SELECTOR_TEST_IDS.notChargedToday)).toBeNull();
  });

  it('derives savings and per-month from the live offering prices, not static config', () => {
    // Offering prices: annual $39.99, monthly $5.99 => 12*5.99=71.88, save 44%;
    // $39.99 / 12 = $3.33/mo. Both lines must match the prices shown on the cards.
    renderSelector({
      offerings: [
        { ...OFFERINGS[0], priceLabel: '$30.00' },
        OFFERINGS[1],
        { ...OFFERINGS[2], priceLabel: '$5.00' },
      ],
    });
    // 12*5.00 = 60.00; annual 30.00 => save 50%; 30/12 = 2.50.
    expect(screen.getByText('Save 50%')).toBeTruthy();
    expect(screen.getByText('$2.50/mo')).toBeTruthy();
  });

  it('shows the auto-renew disclosure when a subscription plan is selected', () => {
    renderSelector({ selectedPlanId: 'annual' });
    expect(screen.getByText('Subscriptions auto-renew unless canceled.')).toBeTruthy();
  });

  it('hides the auto-renew disclosure when the lifetime plan is selected', () => {
    renderSelector({ selectedPlanId: 'lifetime' });
    expect(screen.queryByText('Subscriptions auto-renew unless canceled.')).toBeNull();
  });

  it('shows the lifetime trial framing on the lifetime card when the trial is eligible', () => {
    renderSelector({ selectedPlanId: 'lifetime', lifetimeTrialEligible: true });
    expect(screen.getByText('Try 1 month free, then a one-time purchase.')).toBeTruthy();
    expect(
      screen.queryByText('One-time purchase for lifetime access on this store account.'),
    ).toBeNull();
  });

  it('turns the CTA into a free-trial start when eligible lifetime is selected', () => {
    const onStartLifetimeTrial = jest.fn();
    const { onPurchase } = renderSelector({
      selectedPlanId: 'lifetime',
      lifetimeTrialEligible: true,
      onStartLifetimeTrial,
    });

    expect(screen.getByText('Start free trial')).toBeTruthy();
    fireEvent.press(screen.getByTestId(SELECTOR_TEST_IDS.purchaseButton));

    expect(onStartLifetimeTrial).toHaveBeenCalledTimes(1);
    expect(onPurchase).not.toHaveBeenCalled();
  });

  it('shows the not-charged-today reassurance for an eligible lifetime trial', () => {
    renderSelector({ selectedPlanId: 'lifetime', lifetimeTrialEligible: true });
    expect(screen.getByTestId(SELECTOR_TEST_IDS.notChargedToday)).toBeTruthy();
  });

  it('keeps the standard lifetime purchase CTA when the trial is not eligible', () => {
    const onStartLifetimeTrial = jest.fn();
    const { onPurchase } = renderSelector({
      selectedPlanId: 'lifetime',
      lifetimeTrialEligible: false,
      onStartLifetimeTrial,
    });

    expect(screen.getByText('Unlock lifetime access')).toBeTruthy();
    fireEvent.press(screen.getByTestId(SELECTOR_TEST_IDS.purchaseButton));

    expect(onPurchase).toHaveBeenCalledWith('lifetime');
    expect(onStartLifetimeTrial).not.toHaveBeenCalled();
    expect(screen.queryByTestId(SELECTOR_TEST_IDS.notChargedToday)).toBeNull();
  });
});
