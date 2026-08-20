import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text as MockText } from 'react-native';

import { theme } from '@/src/theme/tokens';

const mockTheme = theme;

const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockReplace = jest.fn();
const mockAppShellState = {
  hasCompletedOnboarding: true,
  isLocked: false,
  billingAccessState: 'trial_active',
  mainAppReady: true,
  pendingEntryRoute: null as string | null,
};

jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
  useRouter: () => ({
    back: (...args: unknown[]) => mockBack(...args),
    canGoBack: (...args: unknown[]) => mockCanGoBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  }),
}));

jest.mock('@/src/components/primitives/Text', () => ({
  Text: ({ children }: { children: ReactNode }) => <MockText>{children}</MockText>,
}));

jest.mock('@/src/features/app-shell/AppShellProvider', () => ({
  useAppShell: () => ({
    state: mockAppShellState,
  }),
}));

jest.mock('@/src/theme/useFlorivaTheme', () => ({
  useFlorivaTheme: () => mockTheme,
}));

// eslint-disable-next-line import/first
import NotFoundScreen from '@/app/+not-found';

describe('not found screen', () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockCanGoBack.mockReset();
    mockReplace.mockReset();
    mockCanGoBack.mockReturnValue(false);
    mockAppShellState.isLocked = false;
    mockAppShellState.billingAccessState = 'trial_active';
    mockAppShellState.pendingEntryRoute = null;
  });

  it('returns through navigation history when available', () => {
    mockCanGoBack.mockReturnValue(true);

    render(<NotFoundScreen />);

    fireEvent.press(screen.getByText('Go back'));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('falls back to the resolved shell entry when there is no history', () => {
    mockAppShellState.isLocked = true;

    render(<NotFoundScreen />);

    fireEvent.press(screen.getByText('Go back'));

    expect(mockReplace).toHaveBeenCalledWith('/lock');
    expect(mockBack).not.toHaveBeenCalled();
  });
});
