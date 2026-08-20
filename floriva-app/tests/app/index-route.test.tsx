import { render, screen } from '@testing-library/react-native';

const mockUseAppShell = jest.fn();
const mockResolveAppEntry = jest.fn();
const mockRedirect = jest.fn<null, [unknown]>(() => null);

jest.mock('expo-router', () => ({
  Redirect: (props: unknown) => {
    mockRedirect(props);

    return null;
  },
}));

jest.mock('@/src/features/app-shell/AppShellProvider', () => ({
  useAppShell: () => mockUseAppShell(),
}));

jest.mock('@/src/features/app-shell/resolveAppEntry', () => ({
  resolveAppEntry: (state: unknown) => mockResolveAppEntry(state),
}));

// eslint-disable-next-line import/first
import IndexRoute from '@/app/index';

describe('IndexRoute', () => {
  beforeEach(() => {
    mockUseAppShell.mockReset();
    mockResolveAppEntry.mockReset();
    mockRedirect.mockClear();
  });

  it('renders nothing until the app shell hydrates', () => {
    mockUseAppShell.mockReturnValue({
      isHydrated: false,
      state: {
        hasCompletedOnboarding: false,
        isLocked: false,
        billingAccessState: 'needs_purchase',
        mainAppReady: false,
      },
    });

    render(<IndexRoute />);

    expect(screen.getByText('Loading Floriva...')).toBeTruthy();
    expect(mockResolveAppEntry).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('redirects once the app shell is hydrated', () => {
    const state = {
      hasCompletedOnboarding: true,
      isLocked: false,
      billingAccessState: 'subscribed',
      mainAppReady: true,
    };

    mockUseAppShell.mockReturnValue({
      isHydrated: true,
      state,
    });
    mockResolveAppEntry.mockReturnValue('/today');

    render(<IndexRoute />);

    expect(mockResolveAppEntry).toHaveBeenCalledWith(state);
    expect(mockRedirect).toHaveBeenCalledWith({ href: '/today' });
  });
});
