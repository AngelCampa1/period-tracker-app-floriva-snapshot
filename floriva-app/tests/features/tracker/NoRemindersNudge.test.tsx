import { fireEvent, render, screen } from '@testing-library/react-native';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => mockPush(...args),
  }),
}));

jest.mock('@/src/localization/LocalizationProvider', () => {
  const { createMockLocalization } = require('../../helpers/mockLocalizationProvider');

  return {
    useLocalization: () => createMockLocalization(),
  };
});

// eslint-disable-next-line import/first
import { NoRemindersNudge } from '@/src/features/tracker/components/NoRemindersNudge';

describe('NoRemindersNudge', () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it('routes to reminder settings and lets the user dismiss the nudge', () => {
    const onDismiss = jest.fn();

    render(<NoRemindersNudge onDismiss={onDismiss} />);

    fireEvent.press(screen.getByText('Set up reminders'));
    fireEvent.press(screen.getByLabelText('Dismiss'));

    expect(mockPush).toHaveBeenCalledWith('/(app)/settings/reminders');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
