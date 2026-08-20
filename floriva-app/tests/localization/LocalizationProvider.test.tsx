import React from 'react';
import { Text } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';

const mockGetPreferences = jest.fn();
const mockSavePreferences = jest.fn();
const mockGetLocales = jest.fn();
let mockStoredLocalePreference:
  | 'system'
  | 'en'
  | 'es'
  | 'de'
  | 'fr'
  | 'ja'
  | 'zh-Hans'
  | 'pt'
  | 'ru' = 'system';

jest.mock('@/src/localization/localizationNative', () => ({
  getSystemLocales: () => mockGetLocales(),
}));

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({
    repositories: {
      appPreferences: {
        getPreferences: (...args: unknown[]) => mockGetPreferences(...args),
        savePreferences: (...args: unknown[]) => mockSavePreferences(...args),
      },
    },
  }),
}));

// eslint-disable-next-line import/first
import {
  LocalizationProvider,
  useLocalization,
} from '@/src/localization/LocalizationProvider';

function LocalizationConsumer() {
  const {
    isHydrated,
    localePreference,
    resolvedLocale,
    setLocalePreference,
    t,
  } = useLocalization();

  return (
    <>
      <Text>hydrated:{String(isHydrated)}</Text>
      <Text>preference:{localePreference}</Text>
      <Text>resolved:{resolvedLocale}</Text>
      <Text>welcome:{t('common.actions.continue')}</Text>
      <Text
        onPress={() => {
          return setLocalePreference('ja');
        }}
      >
        switch-to-ja
      </Text>
    </>
  );
}

describe('LocalizationProvider', () => {
  beforeEach(() => {
    mockGetPreferences.mockReset();
    mockSavePreferences.mockReset();
    mockGetLocales.mockReset();
    mockStoredLocalePreference = 'system';
    mockGetLocales.mockReturnValue([
      {
        languageTag: 'en-US',
        languageCode: 'en',
        regionCode: 'US',
      },
    ]);
    mockGetPreferences.mockResolvedValue({
      hasCompletedOnboarding: true,
      deferredBiometricsSetup: false,
      deferredReminderSetup: false,
      deferredImportSetup: false,
      themePreference: 'system',
      localePreference: mockStoredLocalePreference,
    });
    mockGetPreferences.mockImplementation(async () => ({
      hasCompletedOnboarding: true,
      deferredBiometricsSetup: false,
      deferredReminderSetup: false,
      deferredImportSetup: false,
      themePreference: 'system',
      localePreference: mockStoredLocalePreference,
    }));
    mockSavePreferences.mockImplementation(async (nextPreferences) => {
      mockStoredLocalePreference = nextPreferences.localePreference;
    });
  });

  it('hydrates a saved locale override from storage', async () => {
    mockGetPreferences.mockResolvedValue({
      hasCompletedOnboarding: true,
      deferredBiometricsSetup: false,
      deferredReminderSetup: false,
      deferredImportSetup: false,
      themePreference: 'system',
      localePreference: 'fr',
    });

    render(
      <LocalizationProvider>
        <LocalizationConsumer />
      </LocalizationProvider>,
    );

    await screen.findByText('hydrated:true');
    expect(screen.getByText('preference:fr')).toBeTruthy();
    expect(screen.getByText('resolved:fr')).toBeTruthy();
    expect(screen.getByText('welcome:Continuer')).toBeTruthy();
  });

  it('resolves a supported device locale when the preference follows the system', async () => {
    mockGetLocales.mockReturnValue([
      {
        languageTag: 'es-MX',
        languageCode: 'es',
        regionCode: 'MX',
      },
    ]);

    render(
      <LocalizationProvider>
        <LocalizationConsumer />
      </LocalizationProvider>,
    );

    await screen.findByText('hydrated:true');
    expect(screen.getByText('preference:system')).toBeTruthy();
    expect(screen.getByText('resolved:es')).toBeTruthy();
    expect(screen.getByText('welcome:Continuar')).toBeTruthy();
  });

  it('falls back to English when the device locale is unsupported', async () => {
    mockGetLocales.mockReturnValue([
      {
        languageTag: 'it-IT',
        languageCode: 'it',
        regionCode: 'IT',
      },
    ]);

    render(
      <LocalizationProvider>
        <LocalizationConsumer />
      </LocalizationProvider>,
    );

    await screen.findByText('hydrated:true');
    expect(screen.getByText('resolved:en')).toBeTruthy();
    expect(screen.getByText('welcome:Continue')).toBeTruthy();
  });

  it('persists and applies a new locale override immediately', async () => {
    render(
      <LocalizationProvider>
        <LocalizationConsumer />
      </LocalizationProvider>,
    );

    await screen.findByText('hydrated:true');

    await act(async () => {
      await screen.getByText('switch-to-ja').props.onPress();
    });

    await waitFor(() => {
      expect(mockSavePreferences).toHaveBeenCalledWith({
        hasCompletedOnboarding: true,
        deferredBiometricsSetup: false,
        deferredReminderSetup: false,
        deferredImportSetup: false,
        themePreference: 'system',
        localePreference: 'ja',
      });
      expect(screen.getByText('preference:ja')).toBeTruthy();
      expect(screen.getByText('resolved:ja')).toBeTruthy();
      expect(screen.getByText('welcome:続ける')).toBeTruthy();
    });
  });
});
