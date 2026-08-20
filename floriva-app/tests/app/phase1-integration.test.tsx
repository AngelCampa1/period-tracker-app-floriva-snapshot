import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { createWave5AcceptanceHarness } from '@/tests/helpers/createWave5AcceptanceHarness';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockOpenURL = jest.fn();
const mockRefreshReminderSchedules = jest.fn();
const mockSavePrivacyPreference = jest.fn();
const mockDeleteAllData = jest.fn();
const mockLockApp = jest.fn();
const mockOpenManageSubscriptions = jest.fn();
const mockPresentRestorePaywall = jest.fn();
const mockEnsureReminderPermissions = jest.fn();
const mockArmBiometricLock = jest.fn();
const mockGetBiometricAvailability = jest.fn();
const mockClearPendingEntryRoute = jest.fn();

let mockCurrentHarness: Awaited<ReturnType<typeof createWave5AcceptanceHarness>> | null = null;

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  }),
}));

jest.mock('expo-linking', () => ({
  openURL: (...args: unknown[]) => mockOpenURL(...args),
}));

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => {
    if (!mockCurrentHarness) {
      throw new Error('Wave 5 test harness has not been initialized');
    }

    return {
      repositories: mockCurrentHarness.repositories,
    };
  },
}));

jest.mock('@/src/features/app-shell/AppShellProvider', () => ({
  useAppShell: () => ({
    clearPendingEntryRoute: (...args: unknown[]) => mockClearPendingEntryRoute(...args),
    refreshReminderSchedules: (...args: unknown[]) => mockRefreshReminderSchedules(...args),
    privacyPreference: {
      biometricsEnabled: false,
      relockAfterSeconds: 300,
      destructiveActionConfirmationRequired: true,
      diagnosticsConsentEnabled: false,
    },
    savePrivacyPreference: (...args: unknown[]) => mockSavePrivacyPreference(...args),
    deleteAllData: (...args: unknown[]) => mockDeleteAllData(...args),
    lockApp: (...args: unknown[]) => mockLockApp(...args),
    state: {
      pendingEntryRoute: undefined,
    },
  }),
}));

jest.mock('@/src/features/billing/BillingProvider', () => ({
  useBilling: () => ({
    snapshot: {
      accessState: 'trial_active',
      planId: 'annual',
      trialEndsAt: '2026-05-09T10:00:00.000Z',
      firstChargeAt: '2026-05-09T10:00:00.000Z',
    },
    managementUrl: 'https://apps.apple.com/account/subscriptions',
    presentRestorePaywall: (...args: unknown[]) => mockPresentRestorePaywall(...args),
    openManageSubscriptions: (...args: unknown[]) => mockOpenManageSubscriptions(...args),
    refreshBilling: jest.fn(),
  }),
}));

jest.mock('@/src/features/billing/config', () => ({
  florivaRuntimeBillingConfig: {
    privacyPolicyUrl: 'https://floriva.app/privacy',
    supportUrl: 'https://floriva.app/support',
  },
}));

jest.mock('@/src/lib/notifications/reminderScheduler', () => ({
  ensureReminderPermissions: (...args: unknown[]) => mockEnsureReminderPermissions(...args),
}));

jest.mock('@/src/lib/security/biometricLock', () => ({
  armBiometricLock: (...args: unknown[]) => mockArmBiometricLock(...args),
  getBiometricAvailability: (...args: unknown[]) => mockGetBiometricAvailability(...args),
}));

jest.mock('@/src/localization/LocalizationProvider', () => {
  const { createMockLocalization } = require('../helpers/mockLocalizationProvider');

  return {
    useLocalization: () => createMockLocalization(),
  };
});

// eslint-disable-next-line import/first
import { CalendarScreenContent } from '@/src/features/calendar/screens/CalendarScreen';
// eslint-disable-next-line import/first
import { SettingsRemindersScreen } from '@/src/features/settings/screens/SettingsScreen';
// eslint-disable-next-line import/first
import { TodayLoggingScreen } from '@/src/features/logging/screens/TodayLoggingScreen';
// eslint-disable-next-line import/first
import { TodayScreenContent } from '@/src/features/tracker/screens/TodayScreen';
// eslint-disable-next-line import/first
import {
  buildCalendarDayCellTestId,
  buildCalendarBandSegmentTestId,
  buildSettingsReminderActionTestId,
  testIds,
} from '@/src/testing/testIds';

describe('Wave 5 repo-backed screen integration', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockReplace.mockReset();
    mockOpenURL.mockReset();
    mockRefreshReminderSchedules.mockReset();
    mockSavePrivacyPreference.mockReset();
    mockDeleteAllData.mockReset();
    mockLockApp.mockReset();
    mockOpenManageSubscriptions.mockReset();
    mockPresentRestorePaywall.mockReset();
    mockEnsureReminderPermissions.mockReset();
    mockArmBiometricLock.mockReset();
    mockGetBiometricAvailability.mockReset();
    mockClearPendingEntryRoute.mockReset();
    mockRefreshReminderSchedules.mockResolvedValue(undefined);
    mockSavePrivacyPreference.mockResolvedValue(undefined);
    mockDeleteAllData.mockResolvedValue(undefined);
    mockEnsureReminderPermissions.mockResolvedValue(true);
    mockArmBiometricLock.mockResolvedValue(undefined);
    mockGetBiometricAvailability.mockResolvedValue({
      available: true,
      reason: 'available',
    });
    mockClearPendingEntryRoute.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    mockCurrentHarness?.close();
    mockCurrentHarness = null;
  });

  it('persists TTC and birth-control details from the repo-backed today flow', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    await mockCurrentHarness.repositories.userProfile.saveProfile({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-04-01',
      goals: ['period', 'symptoms', 'trying-to-conceive'],
      supportsIrregularCycles: false,
      conditionTags: ['pcos'],
      birthControlMethod: 'pill',
      ttcTrackingPreferences: {
        sex: true,
        ovulationTest: true,
        cervicalMucus: true,
        basalBodyTemperature: false,
      },
    });
    await mockCurrentHarness.repositories.reminderPreferences.savePreferences([
      {
        kind: 'daily-log',
        enabled: true,
        hour: 21,
        minute: 15,
        schedule: {
          cadence: 'daily',
        },
      },
      {
        kind: 'period-start',
        enabled: false,
        hour: 9,
        minute: 0,
        schedule: {
          cadence: 'cycle-event',
          daysBefore: 0,
        },
      },
      {
        kind: 'fertile-window',
        enabled: true,
        hour: 7,
        minute: 30,
        schedule: {
          cadence: 'cycle-event',
          daysBefore: 1,
        },
      },
      {
        kind: 'birth-control',
        enabled: true,
        hour: 8,
        minute: 0,
        schedule: {
          cadence: 'daily',
        },
      },
    ]);

    render(<TodayLoggingScreen logDate="2026-04-10" />);

    await waitFor(() => {
      expect(screen.getByTestId(testIds.today.ttcLoggingControls)).toBeTruthy();
      expect(screen.getByTestId(testIds.today.birthControlLoggingControls)).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Peak test'));
    fireEvent.press(screen.getByText('Sex logged'));
    fireEvent.press(screen.getByText('Pill'));
    fireEvent.press(screen.getByText('Late dose'));
    fireEvent.press(screen.getByText("Save today's log"));

    await waitFor(async () => {
      const savedEntry = await mockCurrentHarness?.repositories.dailyLogs.getEntryByDate(
        '2026-04-10',
      );

      expect(savedEntry).toMatchObject({
        logDate: '2026-04-10',
        ttcObservation: {
          ovulationTest: 'peak',
          sexLogged: true,
        },
        birthControlEvent: {
          method: 'pill',
          lateDose: true,
        },
      });
    });
  });

  it('keeps today focused on logging even when deferred setup flags are still persisted', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    await mockCurrentHarness.repositories.appPreferences.savePreferences({
      hasCompletedOnboarding: true,
      deferredCycleSetup: true,
      deferredTrackingSetup: false,
      deferredBiometricsSetup: false,
      deferredReminderSetup: true,
      deferredImportSetup: false,
      dismissedTailoringChecklist: false,
      hapticsEnabled: true,
      tapSoundEnabled: false,
      showFertilityEstimates: true,
      themePreference: 'system',
      localePreference: 'system',
    });

    render(<TodayScreenContent todayIso="2026-04-10" />);
    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText('Log today')).toBeTruthy();
      expect(screen.getByTestId('today-snapshot-card')).toBeTruthy();
    });

    expect(screen.queryByText('Finish tailoring Floriva')).toBeNull();
    expect(screen.queryByTestId(testIds.today.tailoringCard)).toBeNull();
  });

  it('hydrates the calendar from persisted local history without the full app router tree', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    await mockCurrentHarness.repositories.userProfile.saveProfile({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-04-01',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: [],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
    });
    await mockCurrentHarness.repositories.dailyLogs.saveEntry({
      id: 'log-2026-03-04',
      logDate: '2026-03-04',
      bleeding: 'medium',
      symptoms: ['cramps', 'fatigue'],
      mood: 'sensitive',
      notes: 'Earlier period start from local history.',
    });
    await mockCurrentHarness.repositories.dailyLogs.saveEntry({
      id: 'log-2026-04-01',
      logDate: '2026-04-01',
      bleeding: 'heavy',
      symptoms: ['cramps', 'bloating'],
      mood: 'low',
      notes: 'Most recent period start from local history.',
    });

    render(<CalendarScreenContent todayIso="2026-04-10" />);
    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText('April 2026')).toBeTruthy();
      expect(screen.getByTestId(buildCalendarDayCellTestId('2026-04-01'))).toBeTruthy();
      // Quiet Bands (Phase 2c): the predicted run renders as a dashed band
      // layer, not the classic predicted disc marker.
      expect(
        screen.getByTestId(buildCalendarBandSegmentTestId('predicted', '2026-04-29')),
      ).toBeTruthy();
      expect(screen.getByTestId(testIds.calendar.recentHistoryCard)).toBeTruthy();
      expect(screen.getByText('Why the estimate can move')).toBeTruthy();
    });
  });

  it('shows and updates persisted reminder settings, including birth-control reminders', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();

    await mockCurrentHarness.repositories.reminderPreferences.savePreferences([
      {
        kind: 'daily-log',
        enabled: false,
        hour: 20,
        minute: 0,
        schedule: {
          cadence: 'daily',
        },
      },
      {
        kind: 'period-start',
        enabled: false,
        hour: 9,
        minute: 0,
        schedule: {
          cadence: 'cycle-event',
          daysBefore: 0,
        },
      },
      {
        kind: 'fertile-window',
        enabled: false,
        hour: 9,
        minute: 0,
        schedule: {
          cadence: 'cycle-event',
          daysBefore: 1,
        },
      },
      {
        kind: 'birth-control',
        enabled: true,
        hour: 7,
        minute: 30,
        schedule: {
          cadence: 'daily',
        },
      },
    ]);

    render(<SettingsRemindersScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId(buildSettingsReminderActionTestId('birth-control', 'edit'))).toBeTruthy();
      expect(screen.getAllByText('Scheduled for 7:30 AM').length).toBeGreaterThan(0);
    });

    fireEvent.press(screen.getByTestId(buildSettingsReminderActionTestId('birth-control', 'edit')));
    fireEvent.press(screen.getByText('Later by 30 min'));

    await waitFor(async () => {
      const preferences = await mockCurrentHarness?.repositories.reminderPreferences.getPreferences();
      expect(preferences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'birth-control',
            enabled: true,
            hour: 8,
            minute: 0,
          }),
        ]),
      );
    });

    expect(mockRefreshReminderSchedules).toHaveBeenCalledTimes(1);
  });
});
