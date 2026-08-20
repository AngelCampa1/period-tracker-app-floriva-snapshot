import { fireEvent, render, screen } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => false);

jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');

  return {
    Redirect: ({ href }: { href: string }) => React.createElement(Text, null, `redirect:${href}`),
    Stack: {
      Screen: ({ options }: { options: { title?: string } }) =>
        React.createElement(Text, null, options.title ?? 'stack-screen'),
    },
    useRouter: () => ({
      back: (...args: unknown[]) => mockBack(...args),
      canGoBack: () => mockCanGoBack(),
      replace: (...args: unknown[]) => mockReplace(...args),
    }),
    useLocalSearchParams: () => ({}),
  };
});

jest.mock('@/src/features/app-shell/AppShellProvider', () => ({
  useAppShell: () => ({
    state: {
      hasCompletedOnboarding: true,
      isLocked: false,
      billingAccessState: 'subscribed',
      mainAppReady: true,
      pendingEntryRoute: null,
    },
  }),
}));

jest.mock('@/src/localization/LocalizationProvider', () => {
  const { createMockLocalization } = require('../helpers/mockLocalizationProvider');

  return {
    useLocalization: () => createMockLocalization(),
  };
});

// eslint-disable-next-line import/first
import BackupRoute from '@/app/(app)/backup';
// eslint-disable-next-line import/first
import ModalRoute from '@/app/modal';
// eslint-disable-next-line import/first
import NotFoundRoute from '@/app/+not-found';

describe('misc app routes', () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockCanGoBack.mockReset();
    mockReplace.mockReset();
    mockCanGoBack.mockReturnValue(false);
  });

  it('redirects the backup index route into export mode', () => {
    render(<BackupRoute />);

    expect(screen.getByText('redirect:/backup/export')).toBeTruthy();
  });

  it('renders the modal route and returns to the shell from both actions', () => {
    render(<ModalRoute />);

    fireEvent.press(screen.getAllByText('Done')[0]);
    fireEvent.press(screen.getByText('Back'));

    expect(mockReplace).toHaveBeenNthCalledWith(1, '/today');
    expect(mockReplace).toHaveBeenNthCalledWith(2, '/today');
  });

  it('renders the not-found screen and routes back to the shell', () => {
    render(<NotFoundRoute />);

    expect(screen.getByText('Oops!')).toBeTruthy();
    expect(screen.getByText('This path is not set up yet. Tap Go back to return somewhere safe.')).toBeTruthy();

    fireEvent.press(screen.getByText('Go back'));

    expect(mockReplace).toHaveBeenCalledWith('/today');
  });
});
