import { render, screen } from '@testing-library/react-native';

jest.mock('@/src/localization/LocalizationProvider', () => {
  const mockLocalizedStrings: Record<string, string> = {
    'billing.value.eyebrow': 'What you’re paying for',
    'billing.value.body': 'A simple, paid model is what keeps Floriva private.',
    'billing.value.onDevice': 'Stored only on this device',
    'billing.value.noAccount': 'No account required',
    'billing.value.noAds': 'No ads',
    'billing.value.noSelling': 'No data selling',
  };
  return {
    useLocalization: () => ({
      isHydrated: true,
      resolvedLocale: 'en',
      t: (key: string) => mockLocalizedStrings[key] ?? key,
    }),
  };
});

// eslint-disable-next-line import/first
import { PaywallPrivacyValue } from '@/src/features/billing/components/PaywallPrivacyValue';
// eslint-disable-next-line import/first
import { testIds } from '@/src/testing/testIds';

describe('PaywallPrivacyValue', () => {
  it('renders the eyebrow, body, and each honest privacy value point', () => {
    render(<PaywallPrivacyValue testID={testIds.billing.privacyValue} />);

    expect(screen.getByTestId(testIds.billing.privacyValue)).toBeTruthy();
    expect(screen.getByText('What you’re paying for')).toBeTruthy();
    expect(screen.getByText('A simple, paid model is what keeps Floriva private.')).toBeTruthy();
    expect(screen.getByText('Stored only on this device')).toBeTruthy();
    expect(screen.getByText('No account required')).toBeTruthy();
    expect(screen.getByText('No ads')).toBeTruthy();
    expect(screen.getByText('No data selling')).toBeTruthy();
  });
});
