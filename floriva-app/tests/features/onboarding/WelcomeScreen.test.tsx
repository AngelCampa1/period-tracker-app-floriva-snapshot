import { fireEvent, render, screen } from '@testing-library/react-native';

import { WelcomeScreen } from '@/src/features/onboarding/screens/WelcomeScreen';
import { testIds } from '@/src/testing/testIds';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('WelcomeScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('moves into the start-path decision from the primary CTA', () => {
    render(<WelcomeScreen />);

    fireEvent.press(screen.getByTestId(testIds.onboarding.welcome.startButton));

    expect(mockPush).toHaveBeenCalledWith('./start-path');
  });

  it('keeps the primary welcome actions in the fixed footer on compact iPad viewports', () => {
    render(<WelcomeScreen />);

    expect(screen.getByTestId(`${testIds.onboarding.welcome.screen}-footer`)).toBeTruthy();
    expect(screen.getByTestId(testIds.onboarding.welcome.startButton)).toBeTruthy();
    expect(screen.getByTestId(testIds.onboarding.welcome.privacyButton)).toBeTruthy();
  });

  it('opens and closes the app privacy policy popup', () => {
    render(<WelcomeScreen />);

    fireEvent.press(screen.getByTestId(testIds.onboarding.welcome.privacyButton));

    expect(screen.getByTestId(testIds.privacy.policyModal)).toBeTruthy();
    expect(screen.getByText('App privacy')).toBeTruthy();
    expect(screen.getByText('Privacy policy')).toBeTruthy();
    expect(
      screen.getByText(
        'Floriva is a period tracker built for privacy. It stores your cycle logs, reminders, lock settings, and other tracking data on your device. No account is required to use the app.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/website/i)).toBeNull();
    expect(mockPush).not.toHaveBeenCalledWith('./privacy');
    expect(screen.getByLabelText('Close privacy policy')).toBeTruthy();

    fireEvent.press(screen.getByTestId(testIds.privacy.policyModalCloseButton));

    expect(screen.queryByTestId(testIds.privacy.policyModal)).toBeNull();
  });

  it('frames onboarding around privacy and trust', () => {
    render(<WelcomeScreen />);

    expect(screen.getByText('Floriva')).toBeTruthy();
    expect(screen.getByText('tracker')).toBeTruthy();
    expect(screen.getByText(/A private/)).toBeTruthy();
    expect(screen.getByText(/for your cycle\./)).toBeTruthy();
    expect(screen.getByText('What stays true')).toBeTruthy();
    expect(
      screen.getByText('Setup is short. These things are always true.'),
    ).toBeTruthy();
    expect(screen.getByText('On-device by default')).toBeTruthy();
    expect(screen.getByText('No account required')).toBeTruthy();
    expect(screen.getByText('Fully usable offline')).toBeTruthy();
    expect(screen.queryByText('No account. No tracking. On this device.')).toBeNull();
    expect(screen.queryByText('Before you continue')).toBeNull();
    expect(screen.getByTestId(testIds.onboarding.welcome.privacyButton)).toBeTruthy();
    expect(screen.getByText('Continue')).toBeTruthy();
  });
});
