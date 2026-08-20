import { ScrollView, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { translate as mockTranslate } from '@/src/localization/translations';
import {
  buildSettingsBirthControlMethodTestId,
  buildSettingsIudTypeTestId,
  buildSettingsReminderActionTestId,
  buildSettingsReminderCenterRowTestId,
  testIds,
} from '@/src/testing/testIds';
import { theme } from '@/src/theme/tokens';
import { expectAccessiblePressables } from '@/tests/helpers/expectAccessiblePressables';

const mockGetReminderPreferences = jest.fn();
const mockSaveReminderPreferences = jest.fn();
const mockGetProfile = jest.fn();
const mockSaveProfile = jest.fn();
const mockSaveProfileAndReminderPreferences = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockEnsureReminderPermissions = jest.fn();
const mockReadScheduledNotificationDiagnostics = jest.fn();
const mockArmBiometricLock = jest.fn();
const mockGetBiometricAvailability = jest.fn();
const mockRefreshReminderSchedules = jest.fn();
const mockDeleteAllData = jest.fn();
const mockSavePrivacyPreference = jest.fn();
const mockLockApp = jest.fn();
const mockOpenManageSubscriptions = jest.fn();
const mockPresentRestorePaywall = jest.fn();
const mockRefreshBilling = jest.fn();
const mockOpenURL = jest.fn();
const mockCanOpenURL = jest.fn();
const mockSetLocalePreference = jest.fn();
const mockOpenManualStoreReview = jest.fn();
const mockCanOpenManualStoreReview = jest.fn();
const mockSetHapticsEnabled = jest.fn();
const mockSetTapSoundEnabled = jest.fn();
const mockListByDateRange = jest.fn();
// LT-23: SettingsScreen now reads the cycle-count stat via listAll()
// (total period starts on record), separate from the reminder-center
// hydration's listByDateRange call -- these must be independent mocks so
// each hydration path can be driven separately in tests.
const mockListAll = jest.fn();
let mockLocalePreference:
  | 'system'
  | 'en'
  | 'es'
  | 'de'
  | 'fr'
  | 'ja'
  | 'zh-Hans'
  | 'pt'
  | 'ru' = 'system';
let mockResolvedLocale:
  | 'en'
  | 'es'
  | 'de'
  | 'fr'
  | 'ja'
  | 'zh-Hans'
  | 'pt'
  | 'ru' = 'en';
let mockHapticsEnabled = true;
let mockTapSoundEnabled = false;

let mockPrivacyPreference = {
  biometricsEnabled: false,
  relockAfterSeconds: 60,
  destructiveActionConfirmationRequired: true,
  diagnosticsConsentEnabled: false,
};

let mockBillingState: {
  isSyncing?: boolean;
  snapshot: {
    accessState: string;
    planId?: string;
    trialEndsAt?: string;
    firstChargeAt?: string;
    expiresAt?: string;
  };
  managementUrl: string | null;
  presentRestorePaywall: (...args: unknown[]) => unknown;
  refreshBilling: (...args: unknown[]) => unknown;
  openManageSubscriptions: (...args: unknown[]) => unknown;
} = {
  isSyncing: false,
  snapshot: {
    accessState: 'trial_active',
    planId: 'annual',
    trialEndsAt: '2026-05-09T10:00:00.000Z',
    firstChargeAt: '2026-05-09T10:00:00.000Z',
  },
  managementUrl: 'https://apps.apple.com/account/subscriptions',
  presentRestorePaywall: (...args: unknown[]) => mockPresentRestorePaywall(...args),
  refreshBilling: (...args: unknown[]) => mockRefreshBilling(...args),
  openManageSubscriptions: (...args: unknown[]) => mockOpenManageSubscriptions(...args),
};

const mockRepositories = {
  userProfile: {
    getProfile: () => mockGetProfile(),
    saveProfile: (...args: unknown[]) => mockSaveProfile(...args),
    saveProfileAndReminderPreferences: (...args: unknown[]) =>
      mockSaveProfileAndReminderPreferences(...args),
  },
  reminderPreferences: {
    getPreferences: () => mockGetReminderPreferences(),
    savePreferences: (...args: unknown[]) => mockSaveReminderPreferences(...args),
  },
  reviewPromptState: {
    recordManualStoreOpen: jest.fn(),
  },
  dailyLogs: {
    listByDateRange: (...args: unknown[]) => mockListByDateRange(...args),
    listAll: (...args: unknown[]) => mockListAll(...args),
  },
};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: (...args: unknown[]) => mockBack(...args),
    canGoBack: (...args: unknown[]) => mockCanGoBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    push: (...args: unknown[]) => mockPush(...args),
  }),
}));

jest.mock('expo-linking', () => ({
  openURL: (...args: unknown[]) => mockOpenURL(...args),
  canOpenURL: (...args: unknown[]) => mockCanOpenURL(...args),
}));

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({
    repositories: mockRepositories,
  }),
}));

jest.mock('@/src/features/app-shell/AppShellProvider', () => ({
  useAppShell: () => ({
    privacyPreference: mockPrivacyPreference,
    savePrivacyPreference: (...args: unknown[]) => mockSavePrivacyPreference(...args),
    refreshReminderSchedules: (...args: unknown[]) => mockRefreshReminderSchedules(...args),
    deleteAllData: (...args: unknown[]) => mockDeleteAllData(...args),
    lockApp: (...args: unknown[]) => mockLockApp(...args),
  }),
}));

jest.mock('@/src/theme/ThemePreferenceProvider', () => ({
  useThemePreference: () => ({ isHydrated: true }),
  useOptionalThemePreference: () => ({ isHydrated: true }),
}));

jest.mock('@/src/features/billing/BillingProvider', () => ({
  useBilling: () => mockBillingState,
}));

jest.mock('@/src/features/billing/config', () => ({
  florivaRuntimeBillingConfig: {
    privacyPolicyUrl: 'https://floriva.app/privacy',
    supportUrl: 'https://floriva.app/support',
    supportEmail: 'support@floriva.app',
  },
}));

jest.mock('@/src/features/review/storeReview', () => ({
  canOpenManualStoreReview: (...args: unknown[]) => mockCanOpenManualStoreReview(...args),
  openManualStoreReview: (...args: unknown[]) => mockOpenManualStoreReview(...args),
}));

jest.mock('@/src/features/feedback/InteractionFeedbackProvider', () => ({
  useInteractionFeedback: () => ({
    hapticsEnabled: mockHapticsEnabled,
    tapSoundEnabled: mockTapSoundEnabled,
    setHapticsEnabled: (...args: unknown[]) => mockSetHapticsEnabled(...args),
    setTapSoundEnabled: (...args: unknown[]) => mockSetTapSoundEnabled(...args),
  }),
  useOptionalInteractionFeedback: () => ({
    triggerPressFeedback: jest.fn(),
  }),
}));

jest.mock('@/src/localization/LocalizationProvider', () => ({
  useLocalization: () => ({
    isHydrated: true,
    localePreference: mockLocalePreference,
    resolvedLocale: mockResolvedLocale,
    setLocalePreference: (...args: unknown[]) => mockSetLocalePreference(...args),
    t: (key: string, params?: Record<string, string | number>) =>
      mockLocalizedStrings[key] ??
      mockTranslate('en', key, params),
  }),
}));

jest.mock('@/src/lib/notifications/reminderScheduler', () => ({
  ensureReminderPermissions: (...args: unknown[]) => mockEnsureReminderPermissions(...args),
}));

jest.mock('@/src/lib/notifications/scheduledNotificationDiagnostics', () => ({
  readScheduledNotificationDiagnostics: (...args: unknown[]) =>
    mockReadScheduledNotificationDiagnostics(...args),
}));

jest.mock('@/src/lib/security/biometricLock', () => ({
  armBiometricLock: (...args: unknown[]) => mockArmBiometricLock(...args),
  getBiometricAvailability: (...args: unknown[]) => mockGetBiometricAvailability(...args),
}));

// eslint-disable-next-line import/first
import {
  formatBirthControlHubSummary,
  formatReminderSummary,
  formatTtcHubSummary,
  SettingsDataScreen,
  SettingsDeleteDataScreen,
  SettingsBirthControlScreen,
  SettingsFeedbackScreen,
  SettingsSoundsScreen,
  SettingsLanguageScreen,
  SettingsPrivacyLockScreen,
  SettingsRemindersScreen,
  SettingsScreen,
  SettingsSubscriptionScreen,
} from '@/src/features/settings/screens/SettingsScreen';

const mockLocalizedStrings: Record<string, string> = {
  'settings.hub.eyebrow': 'Settings',
  'settings.hub.title': 'Settings',
  'settings.hub.description': 'Choose what you want to adjust.',
  'settings.hub.appearanceTitle': 'Appearance',
  'settings.hub.appearanceDescription':
    'Choose whether Floriva follows this device appearance or stays fixed in one mode.',
  'settings.hub.appearanceSummary': 'Following system appearance on this device.',
  'settings.hub.currentModeLabel': 'Current mode',
  'settings.hub.followSystem': 'Follow system',
  'settings.hub.light': 'Light',
  'settings.hub.dark': 'Dark',
  'settings.appearance.eyebrow': 'Settings',
  'settings.appearance.title': 'Appearance',
  'settings.appearance.description':
    'Choose whether Floriva follows this device appearance or stays fixed in one mode.',
  'settings.appearance.currentTitle': 'Current appearance',
  'settings.appearance.choicesTitle': 'Appearance preference',
  'settings.appearance.backLabel': 'Back to settings',
  'settings.hub.privacyAndRemindersTitle': 'Privacy and reminders',
  'settings.hub.privacyAndRemindersDescription':
    'Privacy, reminders, and trying-to-conceive settings stay close together.',
  'settings.hub.privacyLockTitle': 'Privacy & lock',
  'settings.hub.privacyLockSummary':
    'Biometric lock off. Relocks after 1 minute. Diagnostics off.',
  'settings.hub.feedbackTitle': 'Feedback',
  'settings.hub.remindersTitle': 'Reminders',
  'settings.hub.remindersSummary': '1 reminder active on this device.',
  'settings.hub.ttcTitle': 'Trying to conceive',
  'settings.hub.ttcSummaryOff': 'Off',
  'settings.hub.ttcSummaryOn': 'On',
  'settings.hub.ttcSummaryOnDetail': 'On · {flags}',
  'onboarding.ttcSetup.chips.sex': 'Sex',
  'onboarding.ttcSetup.chips.ovulationTest': 'Ovulation test',
  'onboarding.ttcSetup.chips.cervicalMucus': 'Cervical mucus',
  'onboarding.ttcSetup.chips.basalBodyTemperature': 'BBT',
  'settings.hub.languageTitle': 'Language',
  'settings.hub.languageSummary': 'System default · English',
  'settings.hub.billingAndDataTitle': 'Billing and data',
  'settings.hub.billingAndDataDescription':
    'Billing, backups, imports, and destructive actions stay separated from daily controls.',
  'settings.hub.subscriptionTitle': 'Subscription',
  'settings.hub.subscriptionSummary': 'Trial active. Annual plan.',
  'settings.hub.rateAppTitle': 'Rate Floriva',
  'settings.hub.rateAppSummary':
    'Open the store review page when you want to support Floriva.',
  'settings.hub.dataTitle': 'Data & import',
  'settings.hub.dataSummary': 'Backup, restore, import, and privacy notes stay grouped together.',
  'settings.hub.deleteDataTitle': 'Delete local data',
  'settings.hub.deleteDataSummary':
    'Erase everything on this device only after a dedicated confirmation step.',
  'settings.subscription.current.description':
    'Review the latest billing snapshot stored for this device.',
  'settings.subscription.screen.descriptionRecurring':
    'Review your current billing state, restore purchases, or open the store subscription manager.',
  'settings.subscription.screen.descriptionOneTime':
    'Review your current billing state or restore purchases for this one-time unlock.',
  'settings.language.eyebrow': 'Settings',
  'settings.language.title': 'Language',
  'settings.language.description': 'Choose the language Floriva uses on this device.',
  'settings.language.currentLabel': 'Current language',
  'settings.language.currentSummary': 'System default · English',
  'settings.language.choicesTitle': 'Available languages',
  'settings.language.systemDefault': 'System default',
  'settings.language.english': 'English',
  'settings.language.spanish': 'Spanish',
  'settings.language.german': 'German',
  'settings.language.french': 'French',
  'settings.language.japanese': 'Japanese',
  'settings.language.simplifiedChinese': 'Simplified Chinese',
  'settings.language.portuguese': 'Portuguese',
  'settings.language.russian': 'Russian',
  'settings.language.selectedLabel': 'Currently selected',
  'settings.language.backLabel': 'Back to settings',
  'settings.feedback.eyebrow': 'Settings',
  'settings.feedback.title': 'Send feedback',
  'settings.feedback.description':
    "Questions, bugs, or ideas? Email us. Floriva keeps your data on this device, so we can't see it.",
  'settings.feedback.backLabel': 'Back to settings',
  'settings.feedback.emailButton': 'Email us',
  'settings.feedback.emailSubject': 'Floriva feedback',
  'settings.feedback.emailBodyIntro': "What's working or what's broken:",
  // `emailUnavailable` interpolates {email}; leave it out of the static map so it
  // resolves through the real catalog (which performs interpolation).
  'settings.sounds.eyebrow': 'Settings',
  'settings.sounds.title': 'Sounds & haptics',
  'settings.sounds.description':
    'Pick if Floriva responds to taps with vibration, sound, or both.',
  'settings.sounds.backLabel': 'Back to settings',
  'settings.sounds.haptics.title': 'Haptics',
  'settings.sounds.haptics.description':
    'Use subtle touch feedback for successful taps throughout Floriva.',
  'settings.sounds.haptics.on': 'On',
  'settings.sounds.haptics.off': 'Off',
  'settings.sounds.haptics.turnOn': 'Turn on haptics',
  'settings.sounds.haptics.turnOff': 'Turn off haptics',
  'settings.sounds.haptics.savedOn': 'Haptics are on.',
  'settings.sounds.haptics.savedOff': 'Haptics are off.',
  'settings.sounds.tapSound.title': 'Tap sounds',
  'settings.sounds.tapSound.description':
    'Play a soft tap sound when device audio settings allow it.',
  'settings.sounds.tapSound.on': 'On',
  'settings.sounds.tapSound.off': 'Off',
  'settings.sounds.tapSound.turnOn': 'Turn on tap sounds',
  'settings.sounds.tapSound.turnOff': 'Turn off tap sounds',
  'settings.sounds.tapSound.savedOn': 'Tap sounds are on.',
  'settings.sounds.tapSound.savedOff': 'Tap sounds are off.',
};

describe('formatTtcHubSummary', () => {
  const strings = {
    off: 'Off',
    on: 'On',
    onDetailTemplate: 'On · {flags}',
    chips: {
      sex: 'Sex',
      ovulationTest: 'Ovulation test',
      cervicalMucus: 'Cervical mucus',
      basalBodyTemperature: 'BBT',
    },
  };

  it('returns the off label when the profile is null', () => {
    expect(formatTtcHubSummary(null, strings)).toBe('Off');
  });

  it('returns the off label when goals do not include trying-to-conceive', () => {
    expect(
      formatTtcHubSummary(
        { goals: ['period', 'symptoms'], ttcTrackingPreferences: undefined },
        strings,
      ),
    ).toBe('Off');
  });

  it('returns the bare on label when TTC is enabled but ttcTrackingPreferences is undefined', () => {
    expect(
      formatTtcHubSummary(
        { goals: ['trying-to-conceive'], ttcTrackingPreferences: undefined },
        strings,
      ),
    ).toBe('On');
  });

  it('returns the bare on label when TTC is enabled but no flags are set', () => {
    expect(
      formatTtcHubSummary(
        {
          goals: ['trying-to-conceive'],
          ttcTrackingPreferences: {
            sex: false,
            ovulationTest: false,
            cervicalMucus: false,
            basalBodyTemperature: false,
          },
        },
        strings,
      ),
    ).toBe('On');
  });

  it('joins active TTC chip labels into the detail template', () => {
    expect(
      formatTtcHubSummary(
        {
          goals: ['trying-to-conceive'],
          ttcTrackingPreferences: {
            sex: false,
            ovulationTest: false,
            cervicalMucus: true,
            basalBodyTemperature: true,
          },
        },
        strings,
      ),
    ).toBe('On · Cervical mucus, BBT');
  });
});

describe('formatBirthControlHubSummary', () => {
  it('summarizes the birth-control method and reminder state for the settings hub', () => {
    expect(
      formatBirthControlHubSummary({
        locale: 'en',
        method: undefined,
        reminder: undefined,
        reminderHydrationState: 'ready',
      }),
    ).toBe('Off');
    expect(
      formatBirthControlHubSummary({
        locale: 'en',
        method: 'pill',
        reminder: undefined,
        reminderHydrationState: 'loading',
      }),
    ).toBe('Pill · checking reminder');
    expect(
      formatBirthControlHubSummary({
        locale: 'en',
        method: 'pill',
        reminder: { kind: 'birth-control', enabled: false, hour: 8, minute: 0, schedule: { cadence: 'daily' } },
        reminderHydrationState: 'error',
      }),
    ).toBe('Pill · reminder off');
    expect(
      formatBirthControlHubSummary({
        locale: 'en',
        method: 'pill',
        reminder: { kind: 'birth-control', enabled: true, hour: 7, minute: 45, schedule: { cadence: 'daily' } },
        reminderHydrationState: 'ready',
      }),
    ).toBe('Pill · 7:45 AM');
  });

  it('LT-26: reports Off for an orphaned reminder (enabled with no method on file), never a stale time', () => {
    expect(
      formatBirthControlHubSummary({
        locale: 'en',
        method: undefined,
        reminder: { kind: 'birth-control', enabled: true, hour: 8, minute: 0, schedule: { cadence: 'daily' } },
        reminderHydrationState: 'ready',
      }),
    ).toBe('Off');
  });
});

describe('SettingsScreen', () => {
  beforeEach(() => {
    mockGetReminderPreferences.mockReset();
    mockSaveReminderPreferences.mockReset();
    mockGetProfile.mockReset();
    mockSaveProfile.mockReset();
    mockSaveProfileAndReminderPreferences.mockReset();
    mockBack.mockReset();
    mockCanGoBack.mockReset();
    mockReplace.mockReset();
    mockPush.mockReset();
    mockEnsureReminderPermissions.mockReset();
    mockReadScheduledNotificationDiagnostics.mockReset();
    mockArmBiometricLock.mockReset();
    mockGetBiometricAvailability.mockReset();
    mockRefreshReminderSchedules.mockReset();
    mockDeleteAllData.mockReset();
    mockSavePrivacyPreference.mockReset();
    mockLockApp.mockReset();
    mockSetHapticsEnabled.mockReset();
    mockSetTapSoundEnabled.mockReset();
    mockOpenManualStoreReview.mockReset();
    mockCanOpenManualStoreReview.mockReset();
    mockOpenManageSubscriptions.mockReset();
    mockPresentRestorePaywall.mockReset();
    mockRefreshBilling.mockReset();
    mockOpenURL.mockReset();
    mockOpenURL.mockResolvedValue(undefined);
    mockCanOpenURL.mockReset();
    mockCanOpenURL.mockResolvedValue(true);
    mockSetLocalePreference.mockReset();
    mockListByDateRange.mockReset();
    mockListByDateRange.mockResolvedValue([]);
    mockListAll.mockReset();
    mockListAll.mockResolvedValue([]);
    delete process.env.EXPO_PUBLIC_E2E_SCHEDULED_NOTIFICATIONS;
    mockPrivacyPreference = {
      biometricsEnabled: false,
      relockAfterSeconds: 60,
      destructiveActionConfirmationRequired: true,
      diagnosticsConsentEnabled: false,
    };
    mockLocalePreference = 'system';
    mockResolvedLocale = 'en';
    mockHapticsEnabled = true;
    mockTapSoundEnabled = false;
    mockCanGoBack.mockReturnValue(false);
    mockBillingState = {
      snapshot: {
        accessState: 'trial_active',
        planId: 'annual',
        trialEndsAt: '2026-05-09T10:00:00.000Z',
        firstChargeAt: '2026-05-09T10:00:00.000Z',
      },
      managementUrl: 'https://apps.apple.com/account/subscriptions',
      presentRestorePaywall: (...args: unknown[]) => mockPresentRestorePaywall(...args),
      refreshBilling: (...args: unknown[]) => mockRefreshBilling(...args),
      openManageSubscriptions: (...args: unknown[]) => mockOpenManageSubscriptions(...args),
    };

    mockGetProfile.mockResolvedValue(null);
    mockReadScheduledNotificationDiagnostics.mockResolvedValue([]);
    mockSaveProfile.mockResolvedValue(undefined);
    mockSaveProfileAndReminderPreferences.mockResolvedValue(undefined);
    mockGetReminderPreferences.mockResolvedValue([
      {
        kind: 'daily-log',
        enabled: true,
        hour: 20,
        minute: 0,
        schedule: { cadence: 'daily' },
      },
      {
        kind: 'period-start',
        enabled: false,
        hour: 9,
        minute: 0,
        schedule: { cadence: 'cycle-event', daysBefore: 0 },
      },
      {
        kind: 'fertile-window',
        enabled: false,
        hour: 9,
        minute: 0,
        schedule: { cadence: 'cycle-event', daysBefore: 1 },
      },
      {
        kind: 'birth-control',
        enabled: false,
        hour: 8,
        minute: 0,
        schedule: { cadence: 'daily' },
      },
    ]);
    mockRefreshReminderSchedules.mockResolvedValue(undefined);
    mockDeleteAllData.mockResolvedValue(undefined);
    mockSavePrivacyPreference.mockResolvedValue(undefined);
    mockArmBiometricLock.mockResolvedValue(undefined);
    mockCanOpenManualStoreReview.mockReturnValue(true);
    mockOpenManualStoreReview.mockResolvedValue(true);
  });

  it('renders a concise settings hub with destination rows instead of inline control groups', async () => {
    const view = render(<SettingsScreen />);

    await screen.findByTestId(testIds.settings.screen);

    expect(screen.queryByText('Choose what you want to adjust.')).toBeNull();
    expect(screen.queryByTestId(testIds.settings.appearanceRow)).toBeNull();
    expect(screen.getByText('Tracking')).toBeTruthy();
    expect(screen.getByText('Privacy & data')).toBeTruthy();
    expect(screen.getByText('Account')).toBeTruthy();
    expect(screen.getByTestId(testIds.settings.privacyLockRow)).toBeTruthy();
    expect(screen.getByTestId(testIds.settings.feedbackRow)).toBeTruthy();
    expect(screen.getByTestId(testIds.settings.remindersRow)).toBeTruthy();
    expect(screen.getByTestId(testIds.settings.ttcRow)).toBeTruthy();
    expect(screen.getByTestId(testIds.settings.birthControlRow)).toBeTruthy();
    expect(screen.getByTestId(testIds.settings.subscriptionRow)).toBeTruthy();
    expect(screen.getByTestId(testIds.settings.dataRow)).toBeTruthy();
    expect(screen.getByTestId(testIds.settings.deleteDataRow)).toBeTruthy();
    expect(screen.getByTestId(testIds.settings.languageRow)).toBeTruthy();
    expect(screen.queryByTestId(testIds.settings.rateAppRow)).toBeNull();
    expect(await screen.findByText('1 reminder active on this device.')).toBeTruthy();
    expect(screen.getByText('Biometric lock off · Diagnostics off')).toBeTruthy();
    expect(within(screen.getByTestId(testIds.settings.ttcRow)).getByText('Off')).toBeTruthy();
    expect(within(screen.getByTestId(testIds.settings.birthControlRow)).getByText('Off')).toBeTruthy();
    expect(screen.getByText('Ideas, bugs, feature requests')).toBeTruthy();
    expect(screen.queryByTestId(testIds.settings.themeSystemButton)).toBeNull();
    expect(screen.queryByTestId(testIds.settings.themeLightButton)).toBeNull();
    expect(screen.queryByTestId(testIds.settings.themeDarkButton)).toBeNull();
    expect(screen.queryByText('Set up biometric lock')).toBeNull();
    expect(screen.queryByText('Delete all local data')).toBeNull();

    expectAccessiblePressables(view.UNSAFE_root);
  });

  it('does not self-reserve tab space (clearance now comes from the tab layout)', async () => {
    const view = render(<SettingsScreen />);

    await screen.findByTestId(testIds.settings.screen);

    const scrollView = view.UNSAFE_getByType(ScrollView);
    const contentContainerStyle = Array.isArray(scrollView.props.contentContainerStyle)
      ? Object.assign({}, ...scrollView.props.contentContainerStyle)
      : scrollView.props.contentContainerStyle;

    // Rendered standalone (outside the (tabs) provider), so no tab clearance is
    // added; the (tabs) layout supplies it in the running app.
    expect(contentContainerStyle.paddingBottom).toBe(theme.spacing.xxl + 24);
  });

  it('routes from the settings hub into each focused detail screen', async () => {
    render(<SettingsScreen />);

    await screen.findByTestId(testIds.settings.screen);

    fireEvent.press(screen.getByTestId(testIds.settings.privacyLockRow));
    fireEvent.press(screen.getByTestId(testIds.settings.feedbackRow));
    fireEvent.press(screen.getByTestId(testIds.settings.soundsRow));
    fireEvent.press(screen.getByTestId(testIds.settings.remindersRow));
    fireEvent.press(screen.getByTestId(testIds.settings.ttcRow));
    fireEvent.press(screen.getByTestId(testIds.settings.birthControlRow));
    fireEvent.press(screen.getByTestId(testIds.settings.subscriptionRow));
    fireEvent.press(screen.getByTestId(testIds.settings.dataRow));
    fireEvent.press(screen.getByTestId(testIds.settings.deleteDataRow));
    fireEvent.press(screen.getByTestId(testIds.settings.languageRow));
    fireEvent.press(screen.getByTestId('settings-cycle-setup-row'));
    fireEvent.press(screen.getByTestId('settings-tracking-setup-row'));

    expect(mockPush).toHaveBeenCalledWith('/settings/privacy-lock');
    expect(mockPush).toHaveBeenCalledWith('/settings/feedback');
    expect(mockPush).toHaveBeenCalledWith('/settings/sounds');
    expect(mockPush).toHaveBeenCalledWith('/settings/reminders');
    expect(mockPush).toHaveBeenCalledWith('/settings/ttc-setup');
    expect(mockPush).toHaveBeenCalledWith('/settings/birth-control');
    expect(mockPush).toHaveBeenCalledWith('/settings/subscription');
    expect(mockPush).toHaveBeenCalledWith('/settings/data');
    expect(mockPush).toHaveBeenCalledWith('/settings/delete-data');
    expect(mockPush).toHaveBeenCalledWith('/settings/language');
    expect(mockPush).toHaveBeenCalledWith('/settings/cycle-setup');
    expect(mockPush).toHaveBeenCalledWith('/settings/tracking-setup');
  });

  it('routes tracking setup rows and renders the local cycle count', async () => {
    mockListAll.mockResolvedValueOnce([
      {
        id: '2026-02-28-heavy',
        logDate: '2026-02-28',
        bleeding: 'heavy',
        symptoms: [],
      },
      {
        id: '2026-03-01-light',
        logDate: '2026-03-01',
        bleeding: 'light',
        symptoms: [],
      },
      {
        id: '2026-03-28-medium',
        logDate: '2026-03-28',
        bleeding: 'medium',
        symptoms: [],
      },
      {
        id: '2026-04-16-spotting',
        logDate: '2026-04-16',
        bleeding: 'spotting',
        symptoms: [],
      },
    ]);

    render(<SettingsScreen />);

    await screen.findByTestId(testIds.settings.screen);

    await waitFor(() => {
      expect(screen.getByText('2 cycles logged')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('settings-cycle-setup-row'));
    fireEvent.press(screen.getByTestId('settings-tracking-setup-row'));

    expect(mockPush).toHaveBeenCalledWith('/settings/cycle-setup');
    expect(mockPush).toHaveBeenCalledWith('/settings/tracking-setup');
  });

  it('falls back to zero cycles when the local cycle count cannot load', async () => {
    mockListAll.mockRejectedValueOnce(new Error('logs failed'));

    render(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('0 cycles logged')).toBeTruthy();
    });
  });

  it('persists the selected language from the dedicated language screen', async () => {
    render(<SettingsLanguageScreen />);

    await screen.findByTestId(testIds.settings.languageScreen);

    fireEvent.press(screen.getByText('Español'));

    await waitFor(() => {
      expect(mockSetLocalePreference).toHaveBeenCalledWith('es');
    });
  });

  it('UL-51: reveals a sticky glass header with plain text on the ItalicTitle-titled language screen', async () => {
    render(<SettingsLanguageScreen />);

    await screen.findByTestId(testIds.settings.languageScreen);

    fireEvent.scroll(screen.getByTestId(`${testIds.settings.languageScreen}-scroll`), {
      nativeEvent: { contentOffset: { x: 0, y: 400 } },
    });

    expect(
      screen.getByTestId(`${testIds.settings.languageScreen}-sticky-header-title`).props.children,
    ).toBe('Choose your language.');
  });

  it('UL-50: renders language choices as selection chips, not primary-CTA pills', async () => {
    render(<SettingsLanguageScreen />);

    await screen.findByTestId(testIds.settings.languageScreen);

    // The current choice announces itself as selected...
    const systemDefault = screen.getByLabelText('System default');
    expect(systemDefault.props.accessibilityState?.selected).toBe(true);
    // ...and the alternatives announce themselves as unselected options.
    const spanish = screen.getByLabelText('Español');
    expect(spanish.props.accessibilityState?.selected).toBe(false);
  });

  it('summarizes an explicitly selected language on the settings hub', async () => {
    mockLocalePreference = 'es';
    mockResolvedLocale = 'es';

    render(<SettingsScreen />);

    await screen.findByTestId(testIds.settings.screen);

    expect(screen.getByText('Español')).toBeTruthy();
  });

  it('opens a support email from the feedback screen', async () => {
    render(<SettingsFeedbackScreen />);

    await screen.findByTestId(testIds.settings.feedbackScreen);

    fireEvent.press(screen.getByTestId(testIds.settings.feedbackEmailButton));

    await waitFor(() => {
      expect(mockOpenURL).toHaveBeenCalledWith(
        expect.stringContaining('mailto:support@floriva.app'),
      );
    });
    // The screen must wire the localized subject/body through to the helper,
    // not just any mailto — assert the composed subject survives.
    const composedUrl = mockOpenURL.mock.calls[0][0] as string;
    expect(composedUrl).toContain('subject=Floriva%20feedback');
    expect(composedUrl).toContain('body=');
  });

  it('shows the support address as a fallback when no mail app is available', async () => {
    mockCanOpenURL.mockResolvedValue(false);

    render(<SettingsFeedbackScreen />);

    await screen.findByTestId(testIds.settings.feedbackScreen);

    // The fallback status message must not be present before the press.
    expect(screen.queryByText(/No email app is set up/)).toBeNull();

    fireEvent.press(screen.getByTestId(testIds.settings.feedbackEmailButton));

    // Assert the interpolated fallback sentence (with the address) rendered —
    // this is the status message, not the always-present address card.
    await waitFor(() => {
      expect(
        screen.getByText(/No email app is set up.*support@floriva\.app/),
      ).toBeTruthy();
    });
    expect(mockOpenURL).not.toHaveBeenCalled();
  });

  it('clears the fallback message once a retry opens the mail composer', async () => {
    mockCanOpenURL.mockResolvedValueOnce(false);

    render(<SettingsFeedbackScreen />);

    await screen.findByTestId(testIds.settings.feedbackScreen);

    fireEvent.press(screen.getByTestId(testIds.settings.feedbackEmailButton));

    await waitFor(() => {
      expect(screen.getByText(/No email app is set up/)).toBeTruthy();
    });

    // Second press succeeds (canOpenURL default true); the stale banner must clear.
    fireEvent.press(screen.getByTestId(testIds.settings.feedbackEmailButton));

    await waitFor(() => {
      expect(mockOpenURL).toHaveBeenCalled();
    });
    expect(screen.queryByText(/No email app is set up/)).toBeNull();
  });

  it('returns to settings from the feedback screen', async () => {
    render(<SettingsFeedbackScreen />);

    await screen.findByTestId(testIds.settings.feedbackScreen);

    fireEvent.press(screen.getByText('Back to settings'));

    expect(mockReplace).toHaveBeenCalledWith('/settings');
  });

  it('persists the interaction toggles from the sounds screen', async () => {
    render(<SettingsSoundsScreen />);

    await screen.findByTestId(testIds.settings.soundsScreen);

    fireEvent(screen.getByTestId(testIds.settings.soundsHapticsButton), 'valueChange', false);
    fireEvent(screen.getByTestId(testIds.settings.soundsTapSoundButton), 'valueChange', true);

    await waitFor(() => {
      expect(mockSetHapticsEnabled).toHaveBeenCalledWith(false);
      expect(mockSetTapSoundEnabled).toHaveBeenCalledWith(true);
    });
  });

  it('shows save failures and returns to settings from the sounds screen', async () => {
    mockSetHapticsEnabled.mockRejectedValueOnce(new Error('save failed'));

    render(<SettingsSoundsScreen />);

    await screen.findByTestId(testIds.settings.soundsScreen);

    fireEvent(screen.getByTestId(testIds.settings.soundsHapticsButton), 'valueChange', false);

    await waitFor(() => {
      expect(screen.getByText("Couldn't save changes. Try again.")).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Back to settings'));

    expect(mockReplace).toHaveBeenCalledWith('/settings');
  });

  it('lets the language screen return to settings and follow the device language', async () => {
    render(<SettingsLanguageScreen />);

    await screen.findByTestId(testIds.settings.languageScreen);

    fireEvent.press(screen.getByText('System default'));

    await waitFor(() => {
      expect(mockSetLocalePreference).toHaveBeenCalledWith('system');
    });

    fireEvent.press(screen.getByText('Back to settings'));

    expect(mockReplace).toHaveBeenCalledWith('/settings');
  });

  it('manages privacy lock and diagnostics inside the dedicated privacy screen', async () => {
    mockGetBiometricAvailability.mockResolvedValue({
      available: true,
      reason: 'available',
    });

    render(<SettingsPrivacyLockScreen />);

    await screen.findByText(/Lock when/);

    fireEvent(screen.getByTestId(testIds.settings.setupBiometricLockButton), 'valueChange', true);

    await waitFor(() => {
      expect(mockArmBiometricLock).toHaveBeenCalledTimes(1);
      expect(mockSavePrivacyPreference).toHaveBeenCalledWith({
        biometricsEnabled: true,
        relockAfterSeconds: 60,
        destructiveActionConfirmationRequired: true,
        diagnosticsConsentEnabled: false,
      });
    });

    fireEvent(screen.getByTestId(testIds.settings.diagnosticsToggleButton), 'valueChange', true);

    await waitFor(() => {
      expect(mockSavePrivacyPreference).toHaveBeenCalledWith({
        biometricsEnabled: false,
        relockAfterSeconds: 60,
        destructiveActionConfirmationRequired: true,
        diagnosticsConsentEnabled: true,
      });
    });
  });

  it('surfaces privacy lock edge cases without leaving the dedicated screen', async () => {
    mockPrivacyPreference = {
      biometricsEnabled: true,
      relockAfterSeconds: 300,
      destructiveActionConfirmationRequired: true,
      diagnosticsConsentEnabled: true,
    };
    mockGetBiometricAvailability.mockResolvedValueOnce({
      available: false,
      reason: 'missing-enrollment',
    });

    render(<SettingsPrivacyLockScreen />);

    await screen.findByText(/Lock when/);

    fireEvent(screen.getByTestId(testIds.settings.setupBiometricLockButton), 'valueChange', false);
    fireEvent.press(screen.getByTestId(testIds.settings.relockOneMinuteButton));
    fireEvent.press(screen.getByTestId(testIds.settings.relockFiveMinutesButton));

    await waitFor(() => {
      expect(mockSavePrivacyPreference).toHaveBeenCalledWith({
        biometricsEnabled: false,
        relockAfterSeconds: 300,
        destructiveActionConfirmationRequired: true,
        diagnosticsConsentEnabled: true,
      });
      expect(mockSavePrivacyPreference).toHaveBeenCalledWith({
        biometricsEnabled: true,
        relockAfterSeconds: 60,
        destructiveActionConfirmationRequired: true,
        diagnosticsConsentEnabled: true,
      });
      expect(mockSavePrivacyPreference).toHaveBeenCalledWith({
        biometricsEnabled: true,
        relockAfterSeconds: 300,
        destructiveActionConfirmationRequired: true,
        diagnosticsConsentEnabled: true,
      });
    });

    fireEvent.press(screen.getByTestId(testIds.settings.lockNowButton));

    await waitFor(() => {
      expect(mockGetBiometricAvailability).toHaveBeenCalledTimes(1);
      expect(screen.getByText(
        'Floriva can only lock when biometric lock is on and Face ID, fingerprint, or device passcode is available.',
      )).toBeTruthy();
      expect(mockLockApp).not.toHaveBeenCalled();
    });
  });

  it('UL-77: keeps Apple branding out of privacy-lock copy on Android', async () => {
    const { Platform } = jest.requireActual<typeof import('react-native')>('react-native');
    const restoreOS = jest.replaceProperty(Platform, 'OS', 'android');

    try {
      render(<SettingsPrivacyLockScreen />);

      await screen.findByText(/Lock when/);

      expect(screen.queryByText(/Face ID/)).toBeNull();
      expect(
        screen.getAllByText(/fingerprint, face unlock, or device passcode/).length,
      ).toBeGreaterThan(0);
    } finally {
      restoreOS.restore();
    }
  });

  it('renders the automatic relock helper with the selected duration label', async () => {
    mockPrivacyPreference = {
      biometricsEnabled: true,
      relockAfterSeconds: 300,
      destructiveActionConfirmationRequired: true,
      diagnosticsConsentEnabled: false,
    };

    render(<SettingsPrivacyLockScreen />);

    await screen.findByText(/Lock when/);

    expect(
      screen.getByText('Floriva relocks after 5 minutes away from the app.'),
    ).toBeTruthy();
  });

  it('renders the automatic relock helper with the stored minute count when it is not one of the quick presets', async () => {
    mockPrivacyPreference = {
      biometricsEnabled: true,
      relockAfterSeconds: 120,
      destructiveActionConfirmationRequired: true,
      diagnosticsConsentEnabled: false,
    };

    render(<SettingsPrivacyLockScreen />);

    await screen.findByText(/Lock when/);

    expect(
      screen.getByText('Floriva relocks after 2 minutes away from the app.'),
    ).toBeTruthy();
  });

  it('shows a privacy-save failure when relock updates cannot be stored', async () => {
    mockSavePrivacyPreference.mockRejectedValueOnce(new Error('save failed'));

    render(<SettingsPrivacyLockScreen />);

    await screen.findByText(/Lock when/);

    fireEvent.press(screen.getByTestId(testIds.settings.relockFiveMinutesButton));

    await waitFor(() => {
      expect(screen.getByText("Couldn't save changes. Try again.")).toBeTruthy();
    });
  });

  it('shows an enrollment warning before enabling biometric lock on unsupported devices', async () => {
    mockGetBiometricAvailability.mockResolvedValueOnce({
      available: false,
      reason: 'missing-enrollment',
    });

    render(<SettingsPrivacyLockScreen />);

    await screen.findByText(/Lock when/);

    fireEvent(screen.getByTestId(testIds.settings.setupBiometricLockButton), 'valueChange', true);

    await waitFor(() => {
      expect(
        screen.getByText(
          "This device has no biometric unlock set up.",
        ),
      ).toBeTruthy();
      expect(mockArmBiometricLock).not.toHaveBeenCalled();
    });
  });

  it('locks immediately when biometric lock is already enabled and available', async () => {
    mockPrivacyPreference = {
      biometricsEnabled: true,
      relockAfterSeconds: 60,
      destructiveActionConfirmationRequired: true,
      diagnosticsConsentEnabled: false,
    };
    mockGetBiometricAvailability.mockResolvedValueOnce({
      available: true,
      reason: 'available',
    });

    render(<SettingsPrivacyLockScreen />);

    await screen.findByText(/Lock when/);

    fireEvent.press(screen.getByTestId(testIds.settings.lockNowButton));

    await waitFor(() => {
      expect(mockLockApp).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/lock');
    });
  });

  it('keeps reminder editing inside the dedicated reminder screen', async () => {
    mockEnsureReminderPermissions.mockResolvedValue(true);

    render(<SettingsRemindersScreen />);

    await screen.findByTestId(testIds.settings.reminderCenter);
    await waitFor(() => {
      expect(screen.queryByText('Loading saved reminder settings...')).toBeNull();
    });
    await screen.findByTestId(testIds.settings.reminderCenter);

    fireEvent(screen.getByTestId(buildSettingsReminderActionTestId('daily-log', 'toggle')), 'valueChange', false);

    await waitFor(() => {
      expect(mockSaveReminderPreferences).toHaveBeenCalled();
    });

    fireEvent.press(screen.getByTestId(buildSettingsReminderActionTestId('daily-log', 'edit')));

    await waitFor(() => {
      expect(screen.getByTestId(buildSettingsReminderActionTestId('daily-log', 'earlier'))).toBeTruthy();
      expect(screen.getByTestId(buildSettingsReminderActionTestId('daily-log', 'later'))).toBeTruthy();
    });
  });

  it('shows the IUD sub-type control only for an IUD method and saves the copper selection', async () => {
    mockGetProfile.mockResolvedValue({
      goals: ['period'],
      supportsIrregularCycles: false,
      conditionTags: [],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
      birthControlMethod: 'iud',
    });

    render(<SettingsBirthControlScreen />);

    await screen.findByTestId(testIds.settings.birthControlScreen);
    await waitFor(() => {
      expect(screen.getByTestId(testIds.settings.iudTypeControls)).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId(buildSettingsIudTypeTestId('copper')));

    await waitFor(() => {
      expect(mockSaveProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          birthControlMethod: 'iud',
          iudType: 'copper',
        }),
      );
    });
  });

  it('hides the IUD sub-type control for a non-IUD method', async () => {
    mockGetProfile.mockResolvedValue({
      goals: ['period'],
      supportsIrregularCycles: false,
      conditionTags: [],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
      birthControlMethod: 'pill',
    });

    render(<SettingsBirthControlScreen />);

    await screen.findByTestId(testIds.settings.birthControlScreen);
    await waitFor(() => {
      expect(screen.queryByText('Loading birth-control setup...')).toBeNull();
    });

    expect(screen.queryByTestId(testIds.settings.iudTypeControls)).toBeNull();
  });

  it('clears the IUD sub-type when the method is switched away from IUD', async () => {
    mockGetProfile.mockResolvedValue({
      goals: ['period'],
      supportsIrregularCycles: false,
      conditionTags: [],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
      birthControlMethod: 'iud',
      iudType: 'copper',
    });

    render(<SettingsBirthControlScreen />);

    await screen.findByTestId(testIds.settings.birthControlScreen);
    await waitFor(() => {
      expect(mockGetReminderPreferences).toHaveBeenCalled();
    });

    fireEvent.press(screen.getByTestId(buildSettingsBirthControlMethodTestId('pill')));

    await waitFor(() => {
      expect(mockSaveProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          birthControlMethod: 'pill',
          iudType: undefined,
        }),
      );
    });
  });

  it('saves birth-control setup and controls the local daily reminder', async () => {
    mockEnsureReminderPermissions.mockResolvedValue(true);
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 29,
      periodLengthDays: 5,
      goals: ['period'],
      supportsIrregularCycles: true,
      conditionTags: [],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
    });

    render(<SettingsBirthControlScreen />);

    await screen.findByTestId(testIds.settings.birthControlScreen);
    await waitFor(() => {
      expect(screen.queryByText('Loading birth-control setup...')).toBeNull();
    });
    await waitFor(() => {
      expect(mockGetReminderPreferences).toHaveBeenCalled();
    });

    const reminderAdjustmentRow = screen.getByTestId(
      testIds.settings.birthControlReminderAdjustmentRow,
    );
    const earlierReminderButton = screen.getByTestId(testIds.settings.birthControlReminderEarlier);
    const laterReminderButton = screen.getByTestId(testIds.settings.birthControlReminderLater);
    expect(within(reminderAdjustmentRow).getByTestId(testIds.settings.birthControlReminderEarlier))
      .toBeTruthy();
    expect(within(reminderAdjustmentRow).getByTestId(testIds.settings.birthControlReminderLater))
      .toBeTruthy();
    expect(StyleSheet.flatten(reminderAdjustmentRow.props.style)).toEqual(
      expect.objectContaining({ flexDirection: 'row' }),
    );
    expect(StyleSheet.flatten(earlierReminderButton.props.style)).toEqual(
      expect.objectContaining({ minHeight: 48 }),
    );
    expect(StyleSheet.flatten(laterReminderButton.props.style)).toEqual(
      expect.objectContaining({ minHeight: 48 }),
    );

    fireEvent.press(screen.getByTestId(buildSettingsBirthControlMethodTestId('pill')));

    await waitFor(() => {
      expect(mockSaveProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          birthControlMethod: 'pill',
        }),
      );
    });

    fireEvent(screen.getByTestId(testIds.settings.birthControlReminderToggle), 'valueChange', true);

    await waitFor(() => {
      expect(mockSaveReminderPreferences).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'birth-control',
            enabled: true,
            hour: 8,
            minute: 0,
          }),
        ]),
      );
      expect(mockRefreshReminderSchedules).toHaveBeenCalled();
    });

    fireEvent.press(screen.getByTestId(testIds.settings.birthControlReminderLater));

    await waitFor(() => {
      expect(mockSaveReminderPreferences).toHaveBeenLastCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'birth-control',
            hour: 8,
            minute: 30,
          }),
        ]),
      );
    });
  });

  it('turns off the local birth-control reminder when the selected method is cleared', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 29,
      periodLengthDays: 5,
      goals: ['period'],
      supportsIrregularCycles: true,
      conditionTags: [],
      birthControlMethod: 'pill',
    });
    mockGetReminderPreferences.mockResolvedValue([
      {
        kind: 'daily-log',
        enabled: true,
        hour: 20,
        minute: 0,
        schedule: { cadence: 'daily' },
      },
      {
        kind: 'period-start',
        enabled: false,
        hour: 9,
        minute: 0,
        schedule: { cadence: 'cycle-event', daysBefore: 0 },
      },
      {
        kind: 'fertile-window',
        enabled: false,
        hour: 9,
        minute: 0,
        schedule: { cadence: 'cycle-event', daysBefore: 1 },
      },
      {
        kind: 'birth-control',
        enabled: true,
        hour: 8,
        minute: 0,
        schedule: { cadence: 'daily' },
      },
    ]);

    render(<SettingsBirthControlScreen />);

    await waitFor(() => {
      expect(screen.queryByText('Loading birth-control setup...')).toBeNull();
    });

    fireEvent.press(screen.getByTestId(buildSettingsBirthControlMethodTestId('pill')));

    await waitFor(() => {
      expect(mockSaveProfileAndReminderPreferences).toHaveBeenCalledWith(
        expect.objectContaining({
          birthControlMethod: undefined,
        }),
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'birth-control',
            enabled: false,
          }),
        ]),
      );
      expect(mockRefreshReminderSchedules).toHaveBeenCalled();
      expect(mockSaveProfile).not.toHaveBeenCalled();
      expect(mockSaveReminderPreferences).not.toHaveBeenCalled();
    });
  });

  it('LT-26: presents an orphaned birth-control reminder (enabled with no method on file) as off, with its action buttons disabled', async () => {
    // A reminder can be `enabled: true` with no `birthControlMethod` on the
    // stored data without ever going through this screen's own
    // clear-method flow (e.g. a restored backup, or any future mutation
    // path). This screen must present that data coherently rather than
    // showing "Daily at 8:00 AM" with live-looking earlier/later controls
    // for a reminder that (per buildReminderPlans' LT-26 guard) will not
    // actually be scheduled.
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 29,
      periodLengthDays: 5,
      goals: ['period'],
      supportsIrregularCycles: true,
      conditionTags: [],
      birthControlMethod: undefined,
    });
    mockGetReminderPreferences.mockResolvedValue([
      {
        kind: 'birth-control',
        enabled: true,
        hour: 8,
        minute: 0,
        schedule: { cadence: 'daily' },
      },
    ]);

    render(<SettingsBirthControlScreen />);

    await screen.findByTestId(testIds.settings.birthControlScreen);
    await waitFor(() => {
      expect(screen.queryByText('Loading birth-control setup...')).toBeNull();
    });
    await waitFor(() => {
      expect(mockGetReminderPreferences).toHaveBeenCalled();
    });

    expect(screen.getByText('No method selected')).toBeTruthy();
    expect(screen.getByText('Choose a method before turning on the reminder.')).toBeTruthy();
    expect(screen.queryByText(/Daily at/)).toBeNull();

    const toggleButton = screen.getByTestId(testIds.settings.birthControlReminderToggle);
    const earlierButton = screen.getByTestId(testIds.settings.birthControlReminderEarlier);
    const laterButton = screen.getByTestId(testIds.settings.birthControlReminderLater);

    expect(toggleButton.props.disabled).toBe(true);
    expect(earlierButton.props.accessibilityState?.disabled).toBe(true);
    expect(laterButton.props.accessibilityState?.disabled).toBe(true);
  });

  it('waits for reminder hydration before birth-control method changes are actionable', async () => {
    let resolveReminderPreferences:
      | ((preferences: Awaited<ReturnType<typeof mockGetReminderPreferences>>) => void)
      | undefined;
    const reminderPreferencesPromise = new Promise((resolve) => {
      resolveReminderPreferences = resolve;
    });

    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 29,
      periodLengthDays: 5,
      goals: ['period'],
      supportsIrregularCycles: true,
      conditionTags: [],
      birthControlMethod: 'pill',
    });
    mockGetReminderPreferences.mockReturnValue(reminderPreferencesPromise);

    render(<SettingsBirthControlScreen />);

    await waitFor(() => {
      expect(screen.queryByText('Loading birth-control setup...')).toBeNull();
    });

    expect(
      screen.getByTestId(buildSettingsBirthControlMethodTestId('pill')).props
        .accessibilityState,
    ).toMatchObject({ disabled: true });
    fireEvent.press(screen.getByTestId(buildSettingsBirthControlMethodTestId('pill')));
    expect(mockSaveProfile).not.toHaveBeenCalled();
    expect(mockSaveProfileAndReminderPreferences).not.toHaveBeenCalled();

    resolveReminderPreferences?.([
      {
        kind: 'birth-control',
        enabled: true,
        hour: 8,
        minute: 0,
        schedule: { cadence: 'daily' },
      },
    ]);

    await waitFor(() => {
      expect(screen.getByText('Daily at 8:00 AM')).toBeTruthy();
      expect(
        screen.getByTestId(buildSettingsBirthControlMethodTestId('pill')).props
          .accessibilityState,
      ).toMatchObject({ disabled: false });
    });

    fireEvent.press(screen.getByTestId(buildSettingsBirthControlMethodTestId('pill')));

    await waitFor(() => {
      expect(mockSaveProfileAndReminderPreferences).toHaveBeenCalledWith(
        expect.objectContaining({
          birthControlMethod: undefined,
        }),
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'birth-control',
            enabled: false,
          }),
        ]),
      );
    });
  });

  it('rolls profile state back if clearing the method cannot disable the reminder', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 29,
      periodLengthDays: 5,
      goals: ['period'],
      supportsIrregularCycles: true,
      conditionTags: [],
      birthControlMethod: 'pill',
    });
    mockGetReminderPreferences.mockResolvedValue([
      {
        kind: 'birth-control',
        enabled: true,
        hour: 8,
        minute: 0,
        schedule: { cadence: 'daily' },
      },
    ]);
    mockSaveProfileAndReminderPreferences.mockRejectedValueOnce(new Error('combined failed'));

    render(<SettingsBirthControlScreen />);

    await waitFor(() => {
      expect(screen.queryByText('Loading birth-control setup...')).toBeNull();
    });

    fireEvent.press(screen.getByTestId(buildSettingsBirthControlMethodTestId('pill')));

    await waitFor(() => {
      expect(mockSaveProfileAndReminderPreferences).toHaveBeenCalledWith(
        expect.objectContaining({
          birthControlMethod: undefined,
        }),
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'birth-control',
            enabled: false,
          }),
        ]),
      );
      expect(mockSaveProfile).not.toHaveBeenCalled();
      expect(mockSaveReminderPreferences).not.toHaveBeenCalled();
      expect(screen.getByText("Couldn't save birth-control setup. Try again.")).toBeTruthy();
    });
  });

  it('keeps saved birth-control clearing state visible when reminder refresh fails afterward', async () => {
    mockRefreshReminderSchedules.mockRejectedValueOnce(new Error('refresh failed'));
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 29,
      periodLengthDays: 5,
      goals: ['period'],
      supportsIrregularCycles: true,
      conditionTags: [],
      birthControlMethod: 'pill',
    });
    mockGetReminderPreferences.mockResolvedValue([
      {
        kind: 'birth-control',
        enabled: true,
        hour: 8,
        minute: 0,
        schedule: { cadence: 'daily' },
      },
    ]);

    render(<SettingsBirthControlScreen />);

    await waitFor(() => {
      expect(screen.queryByText('Loading birth-control setup...')).toBeNull();
    });

    fireEvent.press(screen.getByTestId(buildSettingsBirthControlMethodTestId('pill')));

    await waitFor(() => {
      expect(mockSaveProfileAndReminderPreferences).toHaveBeenCalledWith(
        expect.objectContaining({
          birthControlMethod: undefined,
        }),
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'birth-control',
            enabled: false,
          }),
        ]),
      );
      expect(
        screen.getByText(
          'Saved reminder setup could not refresh right now. Reopen Birth control and try again.',
        ),
      ).toBeTruthy();
    });

    expect(screen.getByText('No method selected')).toBeTruthy();
    expect(screen.getByText('Choose a method before turning on the reminder.')).toBeTruthy();
    expect(
      screen.getByTestId(buildSettingsBirthControlMethodTestId('pill')).props.accessibilityState,
    ).not.toMatchObject({ selected: true });
  });

  it('surfaces birth-control setup load and save failures inside the hub', async () => {
    mockGetProfile.mockRejectedValueOnce(new Error('profile failed'));
    mockSaveProfile.mockRejectedValueOnce(new Error('save failed'));

    render(<SettingsBirthControlScreen />);

    await waitFor(() => {
      expect(screen.getByText('Floriva could not load saved setup right now.')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId(buildSettingsBirthControlMethodTestId('pill')));

    await waitFor(() => {
      expect(screen.getByText("Couldn't save birth-control setup. Try again.")).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Back to settings'));

    expect(mockReplace).toHaveBeenCalledWith('/settings');
  });

  it('keeps birth-control reminders local when permission is denied', async () => {
    mockEnsureReminderPermissions.mockResolvedValue(false);
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 29,
      periodLengthDays: 5,
      goals: ['period'],
      supportsIrregularCycles: true,
      conditionTags: [],
      birthControlMethod: 'pill',
    });

    render(<SettingsBirthControlScreen />);

    await waitFor(() => {
      expect(screen.queryByText('Loading birth-control setup...')).toBeNull();
    });

    fireEvent(screen.getByTestId(testIds.settings.birthControlReminderToggle), 'valueChange', true);

    await waitFor(() => {
      expect(mockEnsureReminderPermissions).toHaveBeenCalledTimes(1);
      expect(mockSaveReminderPreferences).not.toHaveBeenCalled();
      expect(
        screen.getByText(
          'Notifications are off for Floriva. Enable them in device settings before turning reminders on.',
        ),
      ).toBeTruthy();
    });
  });

  it('shows birth-control reminder save failures from time adjustments', async () => {
    mockEnsureReminderPermissions.mockResolvedValue(true);
    mockSaveReminderPreferences.mockRejectedValueOnce(new Error('save failed'));
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 29,
      periodLengthDays: 5,
      goals: ['period'],
      supportsIrregularCycles: true,
      conditionTags: [],
      birthControlMethod: 'pill',
    });
    mockGetReminderPreferences.mockResolvedValue([
      {
        kind: 'birth-control',
        enabled: true,
        hour: 8,
        minute: 0,
        schedule: { cadence: 'daily' },
      },
    ]);

    render(<SettingsBirthControlScreen />);

    await waitFor(() => {
      expect(screen.queryByText('Loading birth-control setup...')).toBeNull();
    });

    fireEvent.press(screen.getByTestId(testIds.settings.birthControlReminderEarlier));

    await waitFor(() => {
      expect(mockSaveReminderPreferences).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'birth-control',
            hour: 7,
            minute: 30,
          }),
        ]),
      );
      expect(
        screen.getByText(
          'Saved reminder setup could not refresh right now. Reopen Birth control and try again.',
        ),
      ).toBeTruthy();
    });
  });

  it('shows reminder loading state while saved preferences are still hydrating', async () => {
    mockGetReminderPreferences.mockImplementation(
      () =>
        new Promise(() => {
          return undefined;
        }),
    );

    render(<SettingsRemindersScreen />);

    expect(screen.getByText('Loading saved reminder settings...')).toBeTruthy();
  });

  it('shows a no-reminders summary on the hub when every reminder is disabled', async () => {
    mockGetReminderPreferences.mockResolvedValue([
      {
        kind: 'daily-log',
        enabled: false,
        hour: 20,
        minute: 0,
        schedule: { cadence: 'daily' },
      },
      {
        kind: 'period-start',
        enabled: false,
        hour: 9,
        minute: 0,
        schedule: { cadence: 'cycle-event', daysBefore: 0 },
      },
      {
        kind: 'fertile-window',
        enabled: false,
        hour: 9,
        minute: 0,
        schedule: { cadence: 'cycle-event', daysBefore: 1 },
      },
      {
        kind: 'birth-control',
        enabled: false,
        hour: 8,
        minute: 0,
        schedule: { cadence: 'daily' },
      },
    ]);

    render(<SettingsScreen />);

    await screen.findByTestId(testIds.settings.screen);

    await waitFor(() => {
      expect(screen.getByText('No reminders active on this device.')).toBeTruthy();
    });
  });

  it('falls back to zero tracked cycles when the hub cannot load local logs', async () => {
    mockListAll.mockRejectedValueOnce(new Error('logs failed'));

    render(<SettingsScreen />);

    await screen.findByTestId(testIds.settings.screen);

    await waitFor(() => {
      expect(screen.getByText('0 cycles logged')).toBeTruthy();
    });
  });

  it('shows reminder load errors when saved preferences cannot hydrate', async () => {
    mockGetReminderPreferences.mockRejectedValueOnce(new Error('load failed'));

    render(<SettingsRemindersScreen />);

    await waitFor(() => {
      expect(
        screen.getByText(
          'Reminder settings could not load right now. Reopen Settings and try again.',
        ),
      ).toBeTruthy();
    });
  });

  it('shows a reminder load error summary on the settings hub when hydration fails', async () => {
    mockGetReminderPreferences.mockRejectedValueOnce(new Error('load failed'));

    render(<SettingsScreen />);

    await screen.findByTestId(testIds.settings.screen);

    await waitFor(() => {
      expect(screen.getByText('Reminder timing could not load right now.')).toBeTruthy();
    });
  });

  it('keeps reminder changes local when notification permission is denied', async () => {
    mockEnsureReminderPermissions.mockResolvedValue(false);

    render(<SettingsRemindersScreen />);

    await screen.findByTestId(testIds.settings.reminderCenter);
    await waitFor(() => {
      expect(screen.queryByText('Loading saved reminder settings...')).toBeNull();
    });
    await screen.findByTestId(testIds.settings.reminderCenter);

    fireEvent(screen.getByTestId(buildSettingsReminderActionTestId('period-start', 'toggle')), 'valueChange', true);

    await waitFor(() => {
      expect(mockEnsureReminderPermissions).toHaveBeenCalledTimes(1);
      expect(mockSaveReminderPreferences).not.toHaveBeenCalled();
      expect(
        screen.getByText(
          'Notifications are off for Floriva. Enable them in device settings before turning reminders on.',
        ),
      ).toBeTruthy();
    });
  });

  it('saves cycle-event reminder timing adjustments and status changes', async () => {
    mockEnsureReminderPermissions.mockResolvedValue(true);

    render(<SettingsRemindersScreen />);

    await screen.findByTestId(testIds.settings.reminderCenter);
    await waitFor(() => {
      expect(screen.queryByText('Loading saved reminder settings...')).toBeNull();
    });
    await screen.findByTestId(testIds.settings.reminderCenter);

    fireEvent.press(screen.getByTestId(buildSettingsReminderActionTestId('period-start', 'edit')));
    fireEvent.press(screen.getByTestId(buildSettingsReminderActionTestId('period-start', 'less-notice')));
    fireEvent.press(screen.getByTestId(buildSettingsReminderActionTestId('period-start', 'more-notice')));
    fireEvent.press(screen.getByTestId(buildSettingsReminderActionTestId('daily-log', 'edit')));
    fireEvent.press(screen.getByTestId(buildSettingsReminderActionTestId('daily-log', 'earlier')));
    fireEvent.press(screen.getByTestId(buildSettingsReminderActionTestId('daily-log', 'later')));

    await waitFor(() => {
      expect(mockSaveReminderPreferences).toHaveBeenCalled();
      expect(mockRefreshReminderSchedules).toHaveBeenCalled();
    });
  });

  it('shows a local reminder center summary without duplicating the reminder cards (UL-54)', async () => {
    render(<SettingsRemindersScreen />);

    await screen.findByTestId(testIds.settings.reminderCenter);

    await waitFor(() => {
      const reminderCenter = within(screen.getByTestId(testIds.settings.reminderCenter));
      // The active count is the summary's own information...
      expect(reminderCenter.getByText('1 reminder active on this device.')).toBeTruthy();
      // ...but the per-reminder rows no longer verbatim-duplicate the
      // editable reminder cards rendered directly below this summary.
      expect(screen.queryByTestId(buildSettingsReminderCenterRowTestId('daily-log'))).toBeNull();
      expect(reminderCenter.queryByText('Daily log reminder')).toBeNull();
    });
  });

  it('exposes scheduled notification diagnostics only for explicit e2e runs', async () => {
    const scheduledDiagnostics = [
      {
        identifier: 'reminder-daily-log',
        title: 'Log today in Floriva',
        body: 'Keep your private history current without sending anything off-device.',
        trigger: {
          type: 'daily',
          channelId: 'floriva-reminders',
          date: null,
          hour: 20,
          minute: 0,
        },
      },
    ];
    mockReadScheduledNotificationDiagnostics.mockResolvedValue(scheduledDiagnostics);
    process.env.EXPO_PUBLIC_E2E_SCHEDULED_NOTIFICATIONS = '1';

    const enabledRender = render(<SettingsRemindersScreen />);

    await waitFor(() => {
      expect(
        screen.getByTestId(testIds.settings.scheduledNotificationsDiagnostics).props
          .accessibilityLabel,
      ).toBe(JSON.stringify(scheduledDiagnostics));
    });
    await screen.findByTestId(testIds.settings.reminderCenter);
    await waitFor(() => {
      expect(mockListByDateRange).toHaveBeenCalledTimes(1);
    });

    enabledRender.unmount();
    process.env.EXPO_PUBLIC_E2E_SCHEDULED_NOTIFICATIONS = '0';
    render(<SettingsRemindersScreen />);

    await screen.findByTestId(testIds.settings.reminderCenter);
    await waitFor(() => {
      expect(mockListByDateRange).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByTestId(testIds.settings.scheduledNotificationsDiagnostics)).toBeNull();
  });

  it('refreshes scheduled notification diagnostics after reminder reconciliation completes', async () => {
    const billingDiagnostic = {
      identifier: 'reminder-first-charge',
      title: 'Floriva Plus reminder',
      body: 'Your Floriva Plus trial is ending soon.',
      trigger: {
        type: 'date',
        channelId: 'floriva-reminders',
        date: '2026-05-08T09:00:00.000Z',
        hour: null,
        minute: null,
        seconds: null,
        repeats: null,
      },
    };
    const periodStartDiagnostic = {
      identifier: 'reminder-period-start',
      title: 'Floriva reminder',
      body: 'Open Floriva for a private update.',
      trigger: {
        type: 'date',
        channelId: 'floriva-reminders',
        date: '2026-05-10T09:00:00.000Z',
        hour: null,
        minute: null,
        seconds: null,
        repeats: null,
      },
    };
    let resolveReconciliation!: () => void;
    let reconciliationComplete = false;
    mockRefreshReminderSchedules.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveReconciliation = () => {
            reconciliationComplete = true;
            resolve();
          };
        }),
    );
    mockReadScheduledNotificationDiagnostics.mockImplementation(async () =>
      reconciliationComplete ? [periodStartDiagnostic] : [billingDiagnostic],
    );
    mockEnsureReminderPermissions.mockResolvedValue(true);
    process.env.EXPO_PUBLIC_E2E_SCHEDULED_NOTIFICATIONS = '1';

    render(<SettingsRemindersScreen />);

    await screen.findByTestId(testIds.settings.reminderCenter);
    await waitFor(() => {
      expect(
        screen.getByTestId(testIds.settings.scheduledNotificationsDiagnostics).props
          .accessibilityLabel,
      ).toBe(JSON.stringify([billingDiagnostic]));
    });

    fireEvent(screen.getByTestId(buildSettingsReminderActionTestId('period-start', 'toggle')), 'valueChange', true);

    await waitFor(() => {
      expect(mockRefreshReminderSchedules).toHaveBeenCalledTimes(1);
      expect(screen.getByText('2 reminders active on this device.')).toBeTruthy();
      expect(
        screen.getByTestId(testIds.settings.scheduledNotificationsDiagnostics).props
          .accessibilityLabel,
      ).toBe(JSON.stringify([billingDiagnostic]));
    });
    const diagnosticReadsBeforeReconciliation =
      mockReadScheduledNotificationDiagnostics.mock.calls.length;

    await act(async () => {
      resolveReconciliation();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockReadScheduledNotificationDiagnostics.mock.calls.length).toBeGreaterThan(
        diagnosticReadsBeforeReconciliation,
      );
      expect(
        screen.getByTestId(testIds.settings.scheduledNotificationsDiagnostics).props
          .accessibilityLabel,
      ).toBe(JSON.stringify([periodStartDiagnostic]));
    });
  });

  it('shows a reminder save failure when timing edits cannot be stored', async () => {
    mockSaveReminderPreferences.mockRejectedValueOnce(new Error('save failed'));

    render(<SettingsRemindersScreen />);

    await screen.findByText('Daily log reminder');
    await waitFor(() => {
      expect(screen.queryByText('Loading saved reminder settings...')).toBeNull();
    });
    await screen.findByTestId(testIds.settings.reminderCenter);

    fireEvent(screen.getByTestId(buildSettingsReminderActionTestId('daily-log', 'toggle')), 'valueChange', false);

    await waitFor(() => {
      expect(screen.getByText("Couldn't save changes. Try again.")).toBeTruthy();
    });
  });

  it('formats enabled cycle-event reminder summaries for same-day and offset schedules', () => {
    expect(
      formatReminderSummary(
        {
          kind: 'period-start',
          enabled: true,
          hour: 9,
          minute: 0,
          schedule: { cadence: 'cycle-event', daysBefore: 0 },
        },
        'en',
      ),
    ).toContain('predicted day');

    expect(
      formatReminderSummary(
        {
          kind: 'fertile-window',
          enabled: true,
          hour: 9,
          minute: 0,
          schedule: { cadence: 'cycle-event', daysBefore: 3 },
        },
        'en',
      ),
    ).toContain('3 days before');
  });

  it('shows subscription actions inside the dedicated subscription screen', async () => {
    render(<SettingsSubscriptionScreen />);

    await screen.findByText('Subscription');
    expect(
      screen.getByText('Review the latest billing snapshot stored for this device.'),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        'Billing, backups, imports, and destructive actions stay separated from daily controls.',
      ),
    ).toBeNull();

    fireEvent.press(screen.getByTestId(testIds.settings.subscriptionRestoreButton));
    fireEvent.press(screen.getByTestId(testIds.settings.subscriptionManageButton));
    fireEvent.press(screen.getByTestId(testIds.settings.subscriptionPrivacyPolicyButton));
    fireEvent.press(screen.getByTestId(testIds.settings.subscriptionSupportButton));

    expect(mockPresentRestorePaywall).toHaveBeenCalledTimes(1);
    expect(mockOpenManageSubscriptions).toHaveBeenCalledTimes(1);
    expect(mockOpenURL).toHaveBeenCalledWith('https://floriva.app/privacy');
    await waitFor(() => {
      expect(mockOpenURL).toHaveBeenCalledWith(
        expect.stringContaining('mailto:support@floriva.app'),
      );
    });
  });

  it('shows the support address on the subscription screen when no mail app is available', async () => {
    mockCanOpenURL.mockResolvedValue(false);

    render(<SettingsSubscriptionScreen />);

    await screen.findByText('Subscription');

    fireEvent.press(screen.getByTestId(testIds.settings.subscriptionSupportButton));

    await waitFor(() => {
      expect(
        screen.getByText(/support@floriva\.app/, { exact: false }),
      ).toBeTruthy();
    });
    expect(mockOpenURL).not.toHaveBeenCalled();
  });

  it('disables subscription restore and refresh actions while billing sync is in flight', async () => {
    mockBillingState = {
      ...mockBillingState,
      isSyncing: true,
      snapshot: {
        accessState: 'needs_purchase',
      },
      managementUrl: null,
    };

    render(<SettingsSubscriptionScreen />);

    await screen.findByText('Subscription');

    expect(
      screen.getByTestId(testIds.settings.subscriptionRefreshAccessButton).props
        .accessibilityState.disabled,
    ).toBe(true);
    expect(
      screen.getByTestId(testIds.settings.subscriptionRestoreButton).props
        .accessibilityState.disabled,
    ).toBe(true);

    fireEvent.press(screen.getByTestId(testIds.settings.subscriptionRefreshAccessButton));
    fireEvent.press(screen.getByTestId(testIds.settings.subscriptionRestoreButton));

    expect(mockRefreshBilling).not.toHaveBeenCalled();
    expect(mockPresentRestorePaywall).not.toHaveBeenCalled();
  });

  it('UL-55: shows trial dates without a contradictory access-end line during an active trial', async () => {
    mockBillingState = {
      ...mockBillingState,
      snapshot: {
        accessState: 'trial_active',
        planId: 'annual',
        trialEndsAt: '2026-08-21T10:00:00.000Z',
        firstChargeAt: '2026-08-21T10:00:00.000Z',
        expiresAt: '2026-08-21T10:00:00.000Z',
      },
    };

    render(<SettingsSubscriptionScreen />);

    await screen.findByText('Subscription');

    expect(screen.getByText(/Trial ends/)).toBeTruthy();
    expect(screen.getByText(/Billing starts/)).toBeTruthy();
    // "Billing starts Aug 21" + "Access ends Aug 21" is a logical
    // contradiction — the access-end line stays hidden while a trial runs.
    expect(screen.queryByText(/Access ends/)).toBeNull();
  });

  it('UL-16: shows no stale trial or billing dates when the device has no subscription', async () => {
    mockBillingState = {
      ...mockBillingState,
      snapshot: {
        accessState: 'needs_purchase',
        trialEndsAt: '2026-08-21T10:00:00.000Z',
        firstChargeAt: '2026-08-21T10:00:00.000Z',
        expiresAt: '2026-08-21T10:00:00.000Z',
      },
      managementUrl: null,
    };

    render(<SettingsSubscriptionScreen />);

    await screen.findByText('Subscription');

    // "No subscription" + "Trial ends ..." stacked in one card self-contradicts.
    expect(screen.queryByText(/Trial ends/)).toBeNull();
    expect(screen.queryByText(/Billing starts/)).toBeNull();
    expect(screen.queryByText(/Access ends/)).toBeNull();
  });

  it('keeps the access-end date visible for expired access', async () => {
    mockBillingState = {
      ...mockBillingState,
      snapshot: {
        accessState: 'expired',
        planId: 'monthly',
        expiresAt: '2026-05-19T10:00:00.000Z',
      },
      managementUrl: null,
    };

    render(<SettingsSubscriptionScreen />);

    await screen.findByText('Subscription');

    expect(screen.getByText(/Access ends/)).toBeTruthy();
  });

  it('shows fallback subscription messaging for expired monthly access without a manage URL', async () => {
    mockBillingState = {
      snapshot: {
        accessState: 'expired',
        planId: 'monthly',
        expiresAt: '2026-05-19T10:00:00.000Z',
      },
      managementUrl: null,
      presentRestorePaywall: (...args: unknown[]) => mockPresentRestorePaywall(...args),
      refreshBilling: (...args: unknown[]) => mockRefreshBilling(...args),
      openManageSubscriptions: (...args: unknown[]) => mockOpenManageSubscriptions(...args),
    };
    mockCanGoBack.mockReturnValue(true);

    render(<SettingsSubscriptionScreen />);

    await screen.findByText('Subscription');

    expect(screen.getByText('Monthly plan')).toBeTruthy();
    expect(screen.getByText('Expired')).toBeTruthy();
    expect(
      screen.getByText(
        'If no direct store link is available, Floriva opens the platform subscription page.',
      ),
    ).toBeTruthy();
    expect(screen.getByText(/Access ends/)).toBeTruthy();

    fireEvent.press(screen.getByText('Back to settings'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('shows a no-subscription summary on the settings hub when no plan is active', async () => {
    mockBillingState = {
      snapshot: {
        accessState: 'sync_error',
      },
      managementUrl: null,
      presentRestorePaywall: (...args: unknown[]) => mockPresentRestorePaywall(...args),
      refreshBilling: (...args: unknown[]) => mockRefreshBilling(...args),
      openManageSubscriptions: (...args: unknown[]) => mockOpenManageSubscriptions(...args),
    };

    render(<SettingsScreen />);

    await screen.findByTestId(testIds.settings.screen);

    expect(screen.getByText('No subscription · No active plan')).toBeTruthy();
  });

  it('groups import, backup, and privacy links inside the dedicated data screen', async () => {
    render(<SettingsDataScreen />);

    await screen.findByText(/Your data, /);

    fireEvent.press(screen.getByTestId(testIds.settings.openBackupExportButton));
    fireEvent.press(screen.getByTestId(testIds.settings.openBackupRestoreButton));
    fireEvent.press(screen.getByTestId(testIds.settings.openImportButton));
    fireEvent.press(screen.getByTestId(testIds.settings.openPrivacyExplainerButton));
    fireEvent.press(screen.getByTestId(testIds.settings.deleteDataButton));

    expect(mockPush).toHaveBeenCalledWith('/backup/export');
    expect(mockPush).toHaveBeenCalledWith('/backup/restore');
    expect(mockPush).toHaveBeenCalledWith('/import');
    expect(mockPush).toHaveBeenCalledWith('/privacy');
    expect(mockPush).toHaveBeenCalledWith('/settings/delete-data');
  });

  it('returns from the dedicated data screen when no back stack exists', async () => {
    render(<SettingsDataScreen />);

    await screen.findByText(/Your data, /);

    fireEvent.press(screen.getByText('Back to settings'));

    expect(mockReplace).toHaveBeenCalledWith('/settings');
  });

  it('returns from privacy and reminders screens when no back stack exists', async () => {
    const { unmount } = render(<SettingsPrivacyLockScreen />);

    await screen.findByText(/Lock when/);

    fireEvent.press(screen.getByText('Back to settings'));

    expect(mockReplace).toHaveBeenCalledWith('/settings');

    unmount();
    mockReplace.mockClear();

    render(<SettingsRemindersScreen />);

    await screen.findByText(/Quiet, useful /);
    await screen.findByTestId(testIds.settings.reminderCenter);

    fireEvent.press(screen.getByText('Back to settings'));

    expect(mockReplace).toHaveBeenCalledWith('/settings');
  });

  it('uses back stack navigation from settings detail screens when available', async () => {
    mockCanGoBack.mockReturnValue(true);

    render(<SettingsDataScreen />);

    fireEvent.press(screen.getByText('Back to settings'));

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  it('keeps destructive confirmation isolated on the delete-data screen', async () => {
    render(<SettingsDeleteDataScreen />);

    await screen.findByTestId(testIds.settings.deleteDataButton);

    fireEvent.press(screen.getByTestId(testIds.settings.deleteDataButton));

    expect(screen.getByTestId(testIds.settings.confirmDeleteDataButton)).toBeTruthy();
    fireEvent.press(screen.getByTestId(testIds.settings.confirmDeleteDataButton));

    await waitFor(() => {
      expect(mockDeleteAllData).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/welcome');
    });
  });

  it('presents the final delete-data confirmation as destructive and locks it while deleting', async () => {
    let resolveDelete: (() => void) | undefined;
    mockDeleteAllData.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      }),
    );

    render(<SettingsDeleteDataScreen />);

    await screen.findByTestId(testIds.settings.deleteDataButton);

    fireEvent.press(screen.getByTestId(testIds.settings.deleteDataButton));

    const confirmButton = screen.getByTestId(testIds.settings.confirmDeleteDataButton);
    const confirmStyle = StyleSheet.flatten(confirmButton.props.style);
    expect(confirmStyle.backgroundColor).toBe(theme.colors.buttonDestructiveFill);
    expect(confirmStyle.borderColor).toBe(theme.colors.buttonDestructiveBorder);

    fireEvent.press(confirmButton);

    await waitFor(() => {
      expect(
        screen.getByTestId(testIds.settings.confirmDeleteDataButton).props.accessibilityState
          .disabled,
      ).toBe(true);
    });

    fireEvent.press(screen.getByTestId(testIds.settings.confirmDeleteDataButton));

    expect(mockDeleteAllData).toHaveBeenCalledTimes(1);

    resolveDelete?.();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/welcome');
    });
  });

  it('keeps users on delete-data and shows an error when local deletion fails', async () => {
    mockDeleteAllData.mockRejectedValueOnce(new Error('disk unavailable'));

    render(<SettingsDeleteDataScreen />);

    await screen.findByTestId(testIds.settings.deleteDataButton);

    fireEvent.press(screen.getByTestId(testIds.settings.deleteDataButton));
    fireEvent.press(screen.getByTestId(testIds.settings.confirmDeleteDataButton));

    await screen.findByText('Floriva could not delete local data right now. Try again.');

    expect(mockReplace).not.toHaveBeenCalledWith('/welcome');
    expect(
      screen.getByTestId(testIds.settings.confirmDeleteDataButton).props.accessibilityState
        .disabled,
    ).toBe(false);
  });

  it('lets delete-data users back out before confirming and return to settings', async () => {
    render(<SettingsDeleteDataScreen />);

    await screen.findByTestId(testIds.settings.deleteDataButton);

    fireEvent.press(screen.getByTestId(testIds.settings.deleteDataButton));

    expect(
      screen.getByText(
        'This removes your cycle history, reminders, imports, and lock settings from this device. You cannot undo this.',
      ),
    ).toBeTruthy();

    fireEvent.press(screen.getByTestId(testIds.settings.cancelDeleteDataButton));

    expect(screen.queryByTestId(testIds.settings.confirmDeleteDataButton)).toBeNull();

    fireEvent.press(screen.getByText('Back to settings'));

    expect(mockReplace).toHaveBeenCalledWith('/settings');
  });

  it('formats lifetime access without subscription renewal language', async () => {
    mockBillingState = {
      snapshot: {
        accessState: 'subscribed',
        planId: 'lifetime',
      },
      managementUrl: null,
      presentRestorePaywall: (...args: unknown[]) => mockPresentRestorePaywall(...args),
      refreshBilling: (...args: unknown[]) => mockRefreshBilling(...args),
      openManageSubscriptions: (...args: unknown[]) => mockOpenManageSubscriptions(...args),
    };

    render(<SettingsSubscriptionScreen />);

    await screen.findByText('Subscription');

    expect(screen.getByText('Lifetime plan')).toBeTruthy();
    expect(screen.getByText('Premium active')).toBeTruthy();
    expect(
      screen.getByText(
        'Lifetime access is a one-time purchase. It does not renew.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/Access ends/)).toBeNull();
    expect(screen.queryByText(/Billing starts/)).toBeNull();
    expect(screen.queryByTestId(testIds.settings.subscriptionManageButton)).toBeNull();
  });

  it('omits invalid billing dates instead of showing raw store values', async () => {
    mockBillingState = {
      snapshot: {
        accessState: 'sync_error',
        trialEndsAt: 'not-a-date',
      },
      managementUrl: 'https://apps.apple.com/account/subscriptions',
      presentRestorePaywall: (...args: unknown[]) => mockPresentRestorePaywall(...args),
      refreshBilling: (...args: unknown[]) => mockRefreshBilling(...args),
      openManageSubscriptions: (...args: unknown[]) => mockOpenManageSubscriptions(...args),
    };

    render(<SettingsSubscriptionScreen />);

    await screen.findByText('Subscription');

    expect(screen.queryByText(/Trial ends/)).toBeNull();
    expect(screen.queryByText(/Billing starts/)).toBeNull();
    expect(screen.queryByText(/Access ends/)).toBeNull();
    expect(screen.queryByTestId(testIds.settings.subscriptionManageButton)).toBeNull();
  });

  it('hides recurring subscription management actions when the device has no store purchase yet', async () => {
    mockBillingState = {
      snapshot: {
        accessState: 'needs_purchase',
      },
      managementUrl: 'https://apps.apple.com/account/subscriptions',
      presentRestorePaywall: (...args: unknown[]) => mockPresentRestorePaywall(...args),
      refreshBilling: (...args: unknown[]) => mockRefreshBilling(...args),
      openManageSubscriptions: (...args: unknown[]) => mockOpenManageSubscriptions(...args),
    };

    render(<SettingsSubscriptionScreen />);

    await screen.findByText('Subscription');

    expect(screen.queryByTestId(testIds.settings.subscriptionManageButton)).toBeNull();
    // A device with no purchase yet must not be told this is a one-time unlock —
    // the offered plans are recurring subscriptions.
    expect(
      screen.queryByText('Review your current billing state or restore purchases for this one-time unlock.'),
    ).toBeNull();
    expect(
      screen.getByText('Review your current billing state, restore purchases, or open the store subscription manager.'),
    ).toBeTruthy();
  });

  it('describes the one-time unlock language only for the lifetime plan', async () => {
    mockBillingState = {
      snapshot: {
        accessState: 'subscribed',
        planId: 'lifetime',
      },
      managementUrl: null,
      presentRestorePaywall: (...args: unknown[]) => mockPresentRestorePaywall(...args),
      refreshBilling: (...args: unknown[]) => mockRefreshBilling(...args),
      openManageSubscriptions: (...args: unknown[]) => mockOpenManageSubscriptions(...args),
    };

    render(<SettingsSubscriptionScreen />);

    await screen.findByText('Subscription');

    expect(
      screen.getByText('Review your current billing state or restore purchases for this one-time unlock.'),
    ).toBeTruthy();
  });

  it('does not show the rate app row since it was removed from the hub', async () => {
    render(<SettingsScreen />);

    await screen.findByTestId(testIds.settings.screen);

    expect(screen.queryByTestId(testIds.settings.rateAppRow)).toBeNull();
  });

  it('shows expired recurring access with restore and refresh, but no buy action', async () => {
    mockBillingState = {
      snapshot: {
        accessState: 'expired',
        planId: 'annual',
        expiresAt: '2026-05-09T10:00:00.000Z',
      },
      managementUrl: null,
      presentRestorePaywall: (...args: unknown[]) => mockPresentRestorePaywall(...args),
      refreshBilling: (...args: unknown[]) => mockRefreshBilling(...args),
      openManageSubscriptions: (...args: unknown[]) => mockOpenManageSubscriptions(...args),
    };

    render(<SettingsSubscriptionScreen />);

    await screen.findByText('Subscription');

    expect(screen.getAllByText('Annual plan').length).toBeGreaterThan(0);
    expect(screen.getByText(/Access ends/)).toBeTruthy();
    expect(screen.queryByTestId(testIds.settings.subscriptionManageButton)).toBeNull();
    expect(screen.getByTestId(testIds.settings.subscriptionRestoreButton)).toBeTruthy();
    // Nothing is purchasable any more, so the buy CTA is gone and the
    // retirement notice explains why.
    expect(screen.queryByTestId(testIds.settings.subscriptionOpenPaywallButton)).toBeNull();
    expect(screen.getByTestId(testIds.settings.subscriptionRetiredNotice)).toBeTruthy();

    fireEvent.press(screen.getByTestId('settings-subscription-refresh-access-button'));
    fireEvent.press(screen.getByTestId(testIds.settings.subscriptionRestoreButton));

    await waitFor(() => {
      expect(mockRefreshBilling).toHaveBeenCalledTimes(1);
      expect(mockPresentRestorePaywall).toHaveBeenCalledTimes(1);
      expect(mockPush).not.toHaveBeenCalledWith('/subscribe');
    });
  });

  it('shows no-plan access without management or buy actions', async () => {
    mockBillingState = {
      snapshot: {
        accessState: 'needs_purchase',
      },
      managementUrl: null,
      presentRestorePaywall: (...args: unknown[]) => mockPresentRestorePaywall(...args),
      refreshBilling: (...args: unknown[]) => mockRefreshBilling(...args),
      openManageSubscriptions: (...args: unknown[]) => mockOpenManageSubscriptions(...args),
    };

    render(<SettingsSubscriptionScreen />);

    await screen.findByText('Subscription');

    expect(screen.getAllByText('No active plan').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Billing starts/)).toBeNull();
    expect(screen.queryByText(/Access ends/)).toBeNull();
    expect(screen.queryByTestId(testIds.settings.subscriptionManageButton)).toBeNull();
    expect(screen.queryByTestId(testIds.settings.subscriptionOpenPaywallButton)).toBeNull();
    expect(screen.getByTestId(testIds.settings.subscriptionRetiredNotice)).toBeTruthy();
  });
});
