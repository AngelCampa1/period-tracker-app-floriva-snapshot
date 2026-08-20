import { render, screen } from '@testing-library/react-native';

jest.mock('@/src/localization/LocalizationProvider', () => {
  const mockLocalizedStrings: Record<string, string> = {
    'billing.timeline.title': 'How your free trial works',
    'billing.timeline.today': 'Today',
    'billing.timeline.reminderLabel': 'Trial reminder',
    'billing.timeline.chargeLabel': 'When your trial ends',
    'billing.timeline.todayBody': 'Full access to every feature.',
    'billing.timeline.reminderBody': 'We’ll remind you before the trial ends.',
    'billing.timeline.chargeBody': 'Your plan begins unless you cancel first.',
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
    useLocalization: () => ({ isHydrated: true, resolvedLocale: 'en', t: interpolate }),
  };
});

// eslint-disable-next-line import/first
import { PaywallTrialTimeline } from '@/src/features/billing/components/PaywallTrialTimeline';
// eslint-disable-next-line import/first
import { testIds } from '@/src/testing/testIds';

describe('PaywallTrialTimeline', () => {
  it('renders the title and the today/reminder/charge steps with relative labels', () => {
    render(<PaywallTrialTimeline testID={testIds.billing.trialTimeline} />);

    expect(screen.getByTestId(testIds.billing.trialTimeline)).toBeTruthy();
    expect(screen.getByText('How your free trial works')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Trial reminder')).toBeTruthy();
    expect(screen.getByText('When your trial ends')).toBeTruthy();
    expect(screen.getByText('Full access to every feature.')).toBeTruthy();
    expect(screen.getByText('We’ll remind you before the trial ends.')).toBeTruthy();
    expect(screen.getByText('Your plan begins unless you cancel first.')).toBeTruthy();
  });

  it('asserts no specific calendar day the store offer may not match', () => {
    render(<PaywallTrialTimeline testID={testIds.billing.trialTimeline} />);
    // The intro offer is a calendar "1 month", not a fixed 30 days, and the
    // store-reported duration is not plumbed through — so the timeline must not
    // claim a concrete charge day it cannot back up (honest-claims rule).
    expect(screen.queryByText(/Day \d+/)).toBeNull();
  });
});
