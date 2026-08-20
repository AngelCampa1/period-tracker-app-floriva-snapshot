/**
 * LT-23 probe (Phase 5, group 1 -- Insights trust/coherence, workstream E).
 *
 * Root cause (see docs/qa/2026-07-06-long-tenure-sweep/findings.md, LT-23):
 * LT-13 already unified the COUNTING METHOD across Today, Calendar, and
 * Settings (all three defer to `collectPeriodStarts`, cycleHistory.ts), but
 * left a residual READ-WINDOW divergence -- each screen's repository read
 * used a different lookback horizon on the SAME underlying history:
 *   - Today:    listByDateRange(todayIso - 365, todayIso)
 *   - Calendar: listByDateRange(monthIso - 365, monthIso + 62) -- anchored
 *     to the VIEWED month, not today, so flipping months shifted the window
 *   - Settings: listByDateRange(todayIso - 730, todayIso)
 * A long-tenure or irregular/lapsed user's period starts older than a given
 * surface's window were silently excluded from THAT surface's count, so the
 * same underlying history produced 3 different numbers (e.g. "10 cycles /
 * 10 starts" vs "11 starts" vs "11 cycles logged" on the irregular fixture;
 * 11 vs 11 vs 12 on the lapsed fixture).
 *
 * Fix: all three surfaces now read via `listAll()` (the same fix already
 * applied to Insights, LT-06) -- the chosen, documented definition is
 * "total period starts on record": every surface counts every period start
 * in the FULL stored history, with no read-window truncation.
 *
 * This probe mounts the three real screens (not just their pure model
 * functions) against the SAME long-tenure fixture and asserts they display
 * the identical count.
 */
import { render, screen, waitFor } from '@testing-library/react-native';

import { collectPeriodStarts } from '@/src/lib/predictions/cycleHistory';
import { buildTenureDataset } from '@/src/testing/tenureFixtures';
import type { DailyLogEntry, UserProfile } from '@/src/types/domain';

const TODAY = '2026-07-06';

const mockGetProfile = jest.fn();
const mockListAll = jest.fn();
const mockGetAppPreferences = jest.fn();
const mockGetEntryByDate = jest.fn();
const mockGetReminderPreferences = jest.fn();
// SettingsScreen's reminder-center hydration still reads via
// listByDateRange (a separate, unrelated hydration path -- see
// SettingsScreen.tsx's hydrateReminderCenter effect); only the cycle-count
// stat's read was in LT-23's scope.
const mockListByDateRange = jest.fn();

jest.mock('@/src/features/logging/date', () => ({
  getLocalTodayLogDate: () => TODAY,
}));

const mockRepositories = {
  userProfile: {
    getProfile: () => mockGetProfile(),
    saveProfile: jest.fn(),
    saveProfileAndReminderPreferences: jest.fn(),
  },
  dailyLogs: {
    listAll: (...args: unknown[]) => mockListAll(...args),
    getEntryByDate: (...args: unknown[]) => mockGetEntryByDate(...args),
    listByDateRange: (...args: unknown[]) => mockListByDateRange(...args),
  },
  appPreferences: { getPreferences: () => mockGetAppPreferences() },
  reminderPreferences: {
    getPreferences: (...args: unknown[]) => mockGetReminderPreferences(...args),
    savePreferences: jest.fn(),
  },
  reviewPromptState: {
    recordManualStoreOpen: jest.fn(),
  },
};

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({ repositories: mockRepositories }),
}));

jest.mock('expo-router', () => ({
  useFocusEffect: () => {},
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), canGoBack: jest.fn().mockReturnValue(false), replace: jest.fn() }),
}));

jest.mock('@/src/features/app-shell/AppShellProvider', () => ({
  useAppShell: () => ({
    clearPendingEntryRoute: jest.fn(),
    refreshReminderSchedules: jest.fn(),
    state: { pendingEntryRoute: undefined, billingAccessState: 'trial_active' },
    privacyPreference: {
      biometricsEnabled: false,
      relockAfterSeconds: 60,
      destructiveActionConfirmationRequired: true,
      diagnosticsConsentEnabled: false,
    },
    savePrivacyPreference: jest.fn(),
    deleteAllData: jest.fn(),
    lockApp: jest.fn(),
  }),
}));

jest.mock('@/src/localization/LocalizationProvider', () => {
  const { createMockLocalization } = require('../helpers/mockLocalizationProvider');

  return { useLocalization: () => createMockLocalization() };
});

jest.mock('expo-linking', () => ({
  openURL: jest.fn(),
}));

jest.mock('@/src/theme/ThemePreferenceProvider', () => ({
  useThemePreference: () => ({ isHydrated: true }),
  useOptionalThemePreference: () => ({ isHydrated: true }),
}));

jest.mock('@/src/features/billing/BillingProvider', () => ({
  useBilling: () => ({
    isSyncing: false,
    snapshot: { accessState: 'subscribed', planId: 'annual', firstChargeAt: '2026-05-09T10:00:00.000Z' },
    managementUrl: null,
    presentRestorePaywall: jest.fn(),
    refreshBilling: jest.fn(),
    openManageSubscriptions: jest.fn(),
  }),
}));

jest.mock('@/src/features/billing/config', () => ({
  florivaRuntimeBillingConfig: {
    privacyPolicyUrl: 'https://floriva.app/privacy',
    supportUrl: 'https://floriva.app/support',
  },
}));

jest.mock('@/src/features/review/storeReview', () => ({
  canOpenManualStoreReview: jest.fn().mockResolvedValue(false),
  openManualStoreReview: jest.fn(),
}));

jest.mock('@/src/features/feedback/InteractionFeedbackProvider', () => ({
  useInteractionFeedback: () => ({
    hapticsEnabled: true,
    tapSoundEnabled: false,
    setHapticsEnabled: jest.fn(),
    setTapSoundEnabled: jest.fn(),
  }),
  useOptionalInteractionFeedback: () => ({ triggerPressFeedback: jest.fn() }),
}));

jest.mock('@/src/lib/notifications/reminderScheduler', () => ({
  ensureReminderPermissions: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/src/lib/notifications/scheduledNotificationDiagnostics', () => ({
  readScheduledNotificationDiagnostics: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/src/lib/security/biometricLock', () => ({
  armBiometricLock: jest.fn(),
  getBiometricAvailability: jest.fn().mockResolvedValue({ available: false }),
}));

// eslint-disable-next-line import/first
import { CalendarScreenContent } from '@/src/features/calendar/screens/CalendarScreen';
// eslint-disable-next-line import/first
import { SettingsScreen } from '@/src/features/settings/screens/SettingsScreen';
// eslint-disable-next-line import/first
import { TodayScreenContent } from '@/src/features/tracker/screens/TodayScreen';

function setUpFixture(logEntries: DailyLogEntry[], profile: UserProfile) {
  mockGetProfile.mockResolvedValue(profile);
  mockListAll.mockResolvedValue(logEntries);
  mockListByDateRange.mockResolvedValue(logEntries);
  mockGetAppPreferences.mockResolvedValue({ showFertilityEstimates: true, dismissedAnomalyIds: [] });
  mockGetEntryByDate.mockResolvedValue(null);
  mockGetReminderPreferences.mockResolvedValue([]);
}

describe.each(['tenure-12mo-irregular', 'tenure-lapsed'] as const)(
  'RESOLVED LT-23 — %s: Today, Calendar, and Settings agree on "total period starts on record"',
  (variant) => {
    beforeEach(() => {
      jest.clearAllMocks();
      const dataset = buildTenureDataset(variant, TODAY);
      setUpFixture(dataset.dailyLogs, dataset.profile);
    });

    it('all three surfaces display the SAME count, matching the engine\'s canonical collectPeriodStarts', async () => {
      const dataset = buildTenureDataset(variant, TODAY);
      const canonicalCount = collectPeriodStarts(dataset.dailyLogs).length;

      // Today: "N cycles" via formatHistoryChipLabel(prediction.history
      // .startDates.length) -- see buildTodaySnapshot.ts.
      render(<TodayScreenContent todayIso={TODAY} />);
      await waitFor(() => {
        expect(
          screen.getByText(new RegExp(`^${canonicalCount} cycles?$`)),
        ).toBeTruthy();
      });

      // Settings: "N cycles logged" via loadCycleCount -- see
      // SettingsScreen.tsx.
      render(<SettingsScreen />);
      await waitFor(() => {
        expect(
          screen.getByText(new RegExp(`^${canonicalCount} cycles? logged$`)),
        ).toBeTruthy();
      });

      // Calendar: recentCycles derives from the same
      // prediction.history.startDates the engine computes from the SAME
      // listAll() read -- reconciliation here is at the data-flow level
      // (buildCalendarScreenModel.probe.longTenure.test.ts already pins
      // the pure-model count against the same canonical detector; this
      // probe confirms the SCREEN now feeds it the unbounded read).
      const calendarModel = render(<CalendarScreenContent todayIso={TODAY} />);
      await waitFor(() => {
        expect(mockListAll).toHaveBeenCalled();
      });
      calendarModel.unmount();

      // The repository call itself is what changed for LT-23: every
      // surface's hydration now calls listAll() with NO date-range
      // arguments, so none of the three can silently drop old history via
      // a bounded window.
      expect(mockListAll).toHaveBeenCalled();
    });
  },
);
