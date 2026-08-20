import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { florivaThemes } from '@/src/theme/tokens';

const mockUseFonts = jest.fn();
const mockThemeProvider = jest.fn();
const mockStatusBar = jest.fn();
let mockThemeHydrated = true;
let mockInteractionFeedbackHydrated = true;
let consoleWarnSpy: jest.SpyInstance;

jest.mock('@expo/vector-icons/FontAwesome', () => ({
  __esModule: true,
  default: {
    font: {},
  },
}));

jest.mock('expo-font', () => ({
  useFonts: (...args: unknown[]) => mockUseFonts(...args),
}));

jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn(),
  preventAutoHideAsync: jest.fn(),
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: (props: unknown) => {
    mockStatusBar(props);
    return null;
  },
}));

jest.mock('expo-router', () => {
  const React = require('react');
  const { Text: MockText } = require('react-native');
  const MockStack = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  MockStack.displayName = 'MockStack';
  const MockStackScreen = ({ name }: { name: string }) => <MockText>{name}</MockText>;
  MockStackScreen.displayName = 'MockStackScreen';

  MockStack.Screen = MockStackScreen;

  return {
    __esModule: true,
    ErrorBoundary: () => null,
    Stack: MockStack,
  };
});

jest.mock('@react-navigation/native', () => ({
  ThemeProvider: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: unknown;
  }) => {
    mockThemeProvider(value);
    return <>{children}</>;
  },
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/src/db/DatabaseProvider', () => ({
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/src/localization/LocalizationProvider', () => ({
  LocalizationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/src/theme/ThemePreferenceProvider', () => ({
  ThemePreferenceProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useThemePreference: () => ({
    isHydrated: mockThemeHydrated,
  }),
}));

jest.mock('@/src/features/feedback/InteractionFeedbackProvider', () => ({
  InteractionFeedbackProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useInteractionFeedback: () => ({
    isHydrated: mockInteractionFeedbackHydrated,
  }),
}));

jest.mock('@/src/features/app-shell/AppShellProvider', () => ({
  AppShellProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/src/features/app-shell/AppShellRouteGuard', () => ({
  AppShellRouteGuard: () => null,
}));

jest.mock('@/src/features/billing/BillingProvider', () => ({
  BillingProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// eslint-disable-next-line import/first
import RootLayout, { unstable_settings } from '@/app/_layout';

describe('RootLayout', () => {
  beforeAll(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  beforeEach(() => {
    mockUseFonts.mockReset();
    mockThemeProvider.mockReset();
    mockStatusBar.mockReset();
    consoleWarnSpy.mockClear();
    mockThemeHydrated = true;
    mockInteractionFeedbackHydrated = true;
    const splashScreenModule = jest.requireMock('expo-splash-screen') as {
      hideAsync: jest.Mock;
      preventAutoHideAsync: jest.Mock;
    };
    splashScreenModule.hideAsync.mockReset();
  });

  afterAll(() => {
    consoleWarnSpy.mockRestore();
  });

  it('returns null until fonts finish loading', () => {
    mockUseFonts.mockReturnValue([false, null]);

    const { toJSON } = render(<RootLayout />);

    expect(toJSON()).toBeNull();
  });

  it('renders the routed screen stack after app chrome is ready', async () => {
    mockUseFonts.mockReturnValue([true, null]);
    const splashScreenModule = jest.requireMock('expo-splash-screen') as {
      hideAsync: jest.Mock;
      preventAutoHideAsync: jest.Mock;
    };

    render(<RootLayout />);

    expect(screen.getByText('index')).toBeTruthy();
    expect(screen.getByText('(onboarding)')).toBeTruthy();
    expect(screen.getByText('(app)')).toBeTruthy();
    expect(screen.getByText('lock')).toBeTruthy();
    expect(screen.getByText('modal')).toBeTruthy();

    await waitFor(() => {
      expect(splashScreenModule.hideAsync).toHaveBeenCalled();
    });
    expect(splashScreenModule.preventAutoHideAsync).toHaveBeenCalled();
    expect(mockThemeProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        dark: false,
        colors: expect.objectContaining({
          background: florivaThemes.light.colors.background,
          card: florivaThemes.light.colors.surfacePrimary,
          text: florivaThemes.light.colors.textPrimary,
        }),
      }),
    );
  });

  it('uses dark status-bar content on the light app shell', () => {
    mockUseFonts.mockReturnValue([true, null]);

    render(<RootLayout />);

    expect(mockStatusBar).toHaveBeenCalledWith(
      expect.objectContaining({
        style: 'dark',
      }),
    );
  });

  it('anchors the root stack on the app shell route group for reload safety', () => {
    expect(unstable_settings).toEqual({
      initialRouteName: '(app)',
    });
  });

  it('keeps the splash visible until the theme preference hydrates', () => {
    mockUseFonts.mockReturnValue([true, null]);
    mockThemeHydrated = false;
    const splashScreenModule = jest.requireMock('expo-splash-screen') as {
      hideAsync: jest.Mock;
      preventAutoHideAsync: jest.Mock;
    };

    const { queryByText } = render(<RootLayout />);

    expect(queryByText('index')).toBeNull();
    expect(splashScreenModule.hideAsync).not.toHaveBeenCalled();
  });

  it('keeps the splash visible until interaction feedback preferences hydrate', () => {
    mockUseFonts.mockReturnValue([true, null]);
    mockInteractionFeedbackHydrated = false;
    const splashScreenModule = jest.requireMock('expo-splash-screen') as {
      hideAsync: jest.Mock;
      preventAutoHideAsync: jest.Mock;
    };

    const { queryByText } = render(<RootLayout />);

    expect(queryByText('index')).toBeNull();
    expect(splashScreenModule.hideAsync).not.toHaveBeenCalled();
  });

  it('falls back to the system font stack if editorial fonts stall past the timeout', async () => {
    jest.useFakeTimers();
    mockUseFonts.mockReturnValue([false, null]);

    try {
      const { toJSON, rerender } = render(<RootLayout />);
      expect(toJSON()).toBeNull();

      await act(async () => {
        jest.advanceTimersByTime(2_000);
      });
      rerender(<RootLayout />);

      expect(screen.getByText('index')).toBeTruthy();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[floriva] Editorial fonts did not load within 2000ms; rendering with system fallback.',
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('proceeds to render when expo-font reports a load error', () => {
    mockUseFonts.mockReturnValue([false, new Error('font-fetch-failed')]);

    render(<RootLayout />);

    expect(screen.getByText('index')).toBeTruthy();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[floriva] Font load error; falling back to system fonts.',
      expect.any(Error),
    );
  });
});
