import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text as MockText } from 'react-native';

import { testIds } from '@/src/testing/testIds';
import { theme } from '@/src/theme/tokens';

const mockTheme = theme;

const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockReplace = jest.fn();
let mockParams: Record<string, string | string[]> = {};
const mockAppShellState = {
  hasCompletedOnboarding: true,
  isLocked: false,
  billingAccessState: 'trial_active',
  mainAppReady: true,
  pendingEntryRoute: null as string | null,
};

const localizedStrings: Record<string, string> = {
  'navigation.modal.backAction': 'Back',
  'navigation.modal.eyebrow': 'Good to know',
  'navigation.modal.title': 'More on this',
  'navigation.modal.defaultBody': 'Nothing more to show here. Tap Done to go back.',
  'navigation.modal.doneLabel': 'Done',
};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: (...args: unknown[]) => mockBack(...args),
    canGoBack: (...args: unknown[]) => mockCanGoBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock('@/src/components/primitives/Text', () => ({
  Text: ({ children }: { children: ReactNode }) => <MockText>{children}</MockText>,
}));

jest.mock('@/src/features/app-shell/AppShellProvider', () => ({
  useAppShell: () => ({
    state: mockAppShellState,
  }),
}));

jest.mock('@/src/localization/LocalizationProvider', () => ({
  useLocalization: () => ({
    t: (key: string) => localizedStrings[key] ?? key,
  }),
}));

jest.mock('@/src/theme/useFlorivaTheme', () => ({
  useFlorivaTheme: () => mockTheme,
}));

// eslint-disable-next-line import/first
import ModalScreen from '@/app/modal';

describe('info modal screen', () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockCanGoBack.mockReset();
    mockReplace.mockReset();
    mockCanGoBack.mockReturnValue(false);
    mockParams = {};
    mockAppShellState.isLocked = false;
    mockAppShellState.billingAccessState = 'trial_active';
    mockAppShellState.pendingEntryRoute = null;
  });

  it('renders the title, eyebrow, and body paragraphs from params', () => {
    mockParams = {
      title: 'Fertile window',
      eyebrow: 'How this works',
      body: ['Estimated from your logs.', 'It moves as you log more.'],
    };

    render(<ModalScreen />);

    expect(screen.getByText('Fertile window')).toBeTruthy();
    expect(screen.getByText('How this works')).toBeTruthy();
    expect(screen.getByText('Estimated from your logs.')).toBeTruthy();
    expect(screen.getByText('It moves as you log more.')).toBeTruthy();
    expect(screen.getByTestId(testIds.infoModal.screen)).toBeTruthy();
    expect(screen.getByTestId(testIds.infoModal.dismissButton)).toBeTruthy();
  });

  it('renders a single string body as one paragraph', () => {
    mockParams = { title: 'Heads up', body: 'Just one calm line.' };

    render(<ModalScreen />);

    expect(screen.getByText('Just one calm line.')).toBeTruthy();
  });

  it('falls back to localized defaults when opened without params', () => {
    render(<ModalScreen />);

    expect(screen.getByText('More on this')).toBeTruthy();
    expect(screen.getByText('Good to know')).toBeTruthy();
    expect(screen.getByText('Nothing more to show here. Tap Done to go back.')).toBeTruthy();
  });

  it('ignores blank params and uses defaults', () => {
    mockParams = { title: '   ', body: '   ' };

    render(<ModalScreen />);

    expect(screen.getByText('More on this')).toBeTruthy();
    expect(screen.getByText('Nothing more to show here. Tap Done to go back.')).toBeTruthy();
  });

  it('dismisses back through history when a stack entry exists', () => {
    mockCanGoBack.mockReturnValue(true);

    render(<ModalScreen />);

    fireEvent.press(screen.getByText('Back'));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('falls back to the resolved shell entry when no history exists', () => {
    mockAppShellState.billingAccessState = 'trial_active';
    mockAppShellState.pendingEntryRoute = '/import';

    render(<ModalScreen />);

    fireEvent.press(screen.getByText('Done'));

    expect(mockReplace).toHaveBeenCalledWith('/import');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('returns a formerly-unpaid user to their pending route when no history exists', () => {
    mockAppShellState.billingAccessState = 'needs_purchase';
    mockAppShellState.pendingEntryRoute = '/import';

    render(<ModalScreen />);

    fireEvent.press(screen.getByText('Done'));

    // The paid gate is retired, so Done resolves to the real app entry rather
    // than funnelling the user to a paywall with nothing to buy.
    expect(mockReplace).toHaveBeenCalledWith('/import');
    expect(mockBack).not.toHaveBeenCalled();
  });
});
