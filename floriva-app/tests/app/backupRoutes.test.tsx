import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';

const mockBackupScreen = jest.fn();

jest.mock('@/src/features/backup/screens/BackupScreen', () => ({
  BackupScreen: (...args: unknown[]) => mockBackupScreen(...args),
}));

jest.mock('@/src/localization/LocalizationProvider', () => ({
  useLocalization: () => ({
    isHydrated: true,
    localePreference: 'system',
    resolvedLocale: 'en',
    setLocalePreference: jest.fn(),
    t: (key: string) => (key === 'backup.screen.backToWelcome' ? 'Back to welcome' : key),
  }),
}));

jest.mock('@/src/localization/localizationContext', () => ({
  useLocalization: () => ({
    isHydrated: true,
    localePreference: 'system',
    resolvedLocale: 'en',
    setLocalePreference: jest.fn(),
    t: (key: string) => (key === 'backup.screen.backToWelcome' ? 'Back to welcome' : key),
  }),
}));

// eslint-disable-next-line import/first
import BackupRoute from '@/app/(app)/backup';
// eslint-disable-next-line import/first
import BackupExportRoute from '@/app/(app)/backup/export';
// eslint-disable-next-line import/first
import BackupRestoreRoute from '@/app/(app)/backup/restore';
// eslint-disable-next-line import/first
import RestoreBackupRoute from '@/app/(onboarding)/restore';

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text: MockText } = require('react-native');

    return <MockText>{`redirect:${href}`}</MockText>;
  },
}));

describe('backup routes', () => {
  beforeEach(() => {
    mockBackupScreen.mockReset();
    mockBackupScreen.mockImplementation(({ mode }: { mode: string }) => screenMode(mode));
  });

  it('renders the export-only route inside the main app group', () => {
    render(<BackupExportRoute />);

    expect(screen.getByText('mode:export-only')).toBeTruthy();
    expect(mockBackupScreen).toHaveBeenCalledWith(
      {
        mode: 'export-only',
      },
      undefined,
    );
  });

  it('redirects the backup root route into export', () => {
    render(<BackupRoute />);

    expect(screen.getByText('redirect:/backup/export')).toBeTruthy();
  });

  it('renders the restore-only route inside the main app group', () => {
    render(<BackupRestoreRoute />);

    expect(screen.getByText('mode:restore-only')).toBeTruthy();
    expect(mockBackupScreen).toHaveBeenCalledWith(
      {
        mode: 'restore-only',
        resultHref: '/settings/data',
      },
      undefined,
    );
  });

  it('renders the restore-only route inside onboarding', () => {
    render(<RestoreBackupRoute />);

    expect(screen.getByText('mode:restore-only')).toBeTruthy();
    expect(mockBackupScreen).toHaveBeenCalledWith(
      {
        backHref: '/start-path',
        backLabel: 'Back to path choice',
        mode: 'restore-only',
        resultHref: '/notifications',
      },
      undefined,
    );
  });
});

function screenMode(mode: string) {
  return <Text>{`mode:${mode}`}</Text>;
}
