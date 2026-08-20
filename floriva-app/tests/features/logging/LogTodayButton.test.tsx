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
import { LogTodayButton } from '@/src/features/logging/components/LogTodayButton';

describe('LogTodayButton', () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it('renders the "Log today" call to action', () => {
    render(<LogTodayButton logDate="2026-04-20" />);

    expect(screen.getByText('Log today')).toBeTruthy();
    expect(screen.getByTestId('today-log-today-button')).toBeTruthy();
  });

  it('routes to the day detail for the given log date when pressed', () => {
    render(<LogTodayButton logDate="2026-04-20" />);

    fireEvent.press(screen.getByText('Log today'));

    expect(mockPush).toHaveBeenCalledWith('/calendar/day/2026-04-20');
  });
});
