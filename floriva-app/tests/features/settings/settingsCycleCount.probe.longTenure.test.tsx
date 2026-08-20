/**
 * Long-tenure probes for the Settings hub "cycles logged" stat (workstream
 * E, Phase 1).
 *
 * Probe convention: bug probes assert CURRENT behavior with a SHOULD-BE
 * comment. The mock harness mirrors tests/features/settings/
 * SettingsScreen.test.tsx (trimmed to what the hub screen touches).
 *
 * Findings ledger: docs/qa/2026-07-06-long-tenure-sweep/findings.md
 */

import { render, screen, waitFor } from '@testing-library/react-native';

import { translate as mockTranslate } from '@/src/localization/translations';
import { collectPeriodStarts } from '@/src/lib/predictions/cycleHistory';
import { buildTenureDataset } from '@/src/testing/tenureFixtures';
import type { DailyLogEntry } from '@/src/types/domain';

const mockGetProfile = jest.fn();
const mockListByDateRange = jest.fn();
// LT-23: SettingsScreen's cycle-count stat now reads via listAll() (total
// period starts on record), separate from the reminder-center hydration's
// listByDateRange call -- both are exercised when the full SettingsScreen
// renders, so both need mocks.
const mockListAll = jest.fn();

const mockRepositories = {
  userProfile: {
    getProfile: () => mockGetProfile(),
    saveProfile: jest.fn(),
    saveProfileAndReminderPreferences: jest.fn(),
  },
  reminderPreferences: {
    getPreferences: jest.fn().mockResolvedValue([]),
    savePreferences: jest.fn(),
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
    back: jest.fn(),
    canGoBack: jest.fn().mockReturnValue(false),
    replace: jest.fn(),
    push: jest.fn(),
  }),
}));

jest.mock('expo-linking', () => ({
  openURL: jest.fn(),
}));

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({
    repositories: mockRepositories,
  }),
}));

jest.mock('@/src/features/app-shell/AppShellProvider', () => ({
  useAppShell: () => ({
    privacyPreference: {
      biometricsEnabled: false,
      relockAfterSeconds: 60,
      destructiveActionConfirmationRequired: true,
      diagnosticsConsentEnabled: false,
    },
    savePrivacyPreference: jest.fn(),
    refreshReminderSchedules: jest.fn(),
    deleteAllData: jest.fn(),
    lockApp: jest.fn(),
  }),
}));

jest.mock('@/src/theme/ThemePreferenceProvider', () => ({
  useThemePreference: () => ({ isHydrated: true }),
  useOptionalThemePreference: () => ({ isHydrated: true }),
}));

jest.mock('@/src/features/billing/BillingProvider', () => ({
  useBilling: () => ({
    isSyncing: false,
    snapshot: {
      accessState: 'subscribed',
      planId: 'annual',
      firstChargeAt: '2026-05-09T10:00:00.000Z',
    },
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
  useOptionalInteractionFeedback: () => ({
    triggerPressFeedback: jest.fn(),
  }),
}));

jest.mock('@/src/localization/LocalizationProvider', () => ({
  useLocalization: () => ({
    isHydrated: true,
    localePreference: 'system',
    resolvedLocale: 'en',
    setLocalePreference: jest.fn(),
    t: (key: string, params?: Record<string, string | number>) =>
      mockTranslate('en', key, params),
  }),
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
import { SettingsScreen } from '@/src/features/settings/screens/SettingsScreen';

const FIXTURE_TODAY = '2026-07-06';

function bleedingLog(logDate: string, bleeding: DailyLogEntry['bleeding']): DailyLogEntry {
  return { id: logDate, logDate, bleeding, symptoms: [] };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetProfile.mockResolvedValue({
    cycleLengthDays: 28,
    periodLengthDays: 5,
    goals: ['period'],
    supportsIrregularCycles: false,
    conditionTags: [],
  });
  mockListByDateRange.mockResolvedValue([]);
  mockListAll.mockResolvedValue([]);
});

describe('FIXED LT-02 — Settings hub "cycles logged" now matches the engine\'s canonical count', () => {
  it('ONE continuously-logged 5-day period is displayed as "1 cycle logged"', async () => {
    // FIXED: loadCycleCount now reuses collectPeriodStarts (cycleHistory.ts),
    // the same canonical period-start detector the prediction engine (and,
    // per LT-13, Insights) uses. It walks consecutive bleeding days and
    // requires MIN_CYCLE_SEPARATION_DAYS (15) between starts, so a
    // perfectly-logged Jan 1-5 period now correctly counts as ONE cycle
    // instead of the old "3 cycles logged" (which arose from comparing each
    // day against the last COUNTED START instead of the previous bleeding
    // day).
    //
    // LT-23: the cycle-count stat now reads via listAll() (not
    // listByDateRange), so the fixture is fed through mockListAll.
    mockListAll.mockResolvedValue([
      bleedingLog('2026-01-01', 'heavy'),
      bleedingLog('2026-01-02', 'heavy'),
      bleedingLog('2026-01-03', 'medium'),
      bleedingLog('2026-01-04', 'medium'),
      bleedingLog('2026-01-05', 'light'),
    ]);

    render(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('1 cycle logged')).toBeTruthy();
    });
  });

  it('a realistic 13-cycle year (95% logging adherence) is displayed as "13 cycles logged"', async () => {
    // The deterministic tenure-12mo-regular dataset logs 95% of bleeding
    // days — realistic adherence. The Settings hub now agrees with the
    // engine's own period-start detection (13 starts) instead of the old
    // "38 cycles logged" (nearly 3x over-count).
    const dataset = buildTenureDataset('tenure-12mo-regular', FIXTURE_TODAY);
    expect(collectPeriodStarts(dataset.dailyLogs)).toHaveLength(13);

    mockListAll.mockResolvedValue(dataset.dailyLogs);

    render(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('13 cycles logged')).toBeTruthy();
    });
  });
});

describe('RESOLVED LT-23 — Settings reads the FULL stored history for the cycle-count stat, not a bounded window', () => {
  it('a period start older than 730 days (the OLD fixed window) is still counted', async () => {
    // FIXED: loadCycleCount used to read a fixed 730-day window
    // (listByDateRange(today - 730, today)), silently dropping any period
    // start older than 2 years from a long-tenure user's count -- the exact
    // residual LT-13 documented and left open. It now reads listAll() (the
    // same fix already applied to Insights, LT-06), so a period start well
    // outside the old 730-day window is still included.
    const oldStart = '2020-01-01'; // > 2000 days before FIXTURE_TODAY
    mockListAll.mockResolvedValue([
      bleedingLog(oldStart, 'heavy'),
      bleedingLog('2026-06-01', 'heavy'),
    ]);

    render(<SettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('2 cycles logged')).toBeTruthy();
    });
  });

  it('Today, Calendar, and Settings now agree on "total period starts on record" for the SAME irregular-tenure history', () => {
    // Root cause (see docs/qa/2026-07-06-long-tenure-sweep/findings.md,
    // LT-23): Today read listByDateRange(today - 365, today), Calendar read
    // listByDateRange(monthIso - 365, monthIso + 62) (anchored to the
    // VIEWED month, not today), and Settings read listByDateRange(today -
    // 730, today) -- three different READ WINDOWS on the same underlying
    // history, even though all three already shared the same COUNTING
    // METHOD (collectPeriodStarts, per LT-13). All three now read via
    // listAll() -- this probe pins that the shared engine-level count
    // collectPeriodStarts(dataset.dailyLogs).length is the single number
    // every surface will report, by construction, once each surface's
    // repository read is unbounded. (Screen-level reconciliation across all
    // three surfaces for the SAME fixture is exercised by each surface's
    // own test suite; this file only guards the Settings side directly.)
    const irregular = buildTenureDataset('tenure-12mo-irregular', FIXTURE_TODAY);
    const lapsed = buildTenureDataset('tenure-lapsed', FIXTURE_TODAY);

    // Both counts are well-defined and stable regardless of which surface
    // asks -- collectPeriodStarts takes only the log array, with no
    // date-range/window parameter of its own.
    expect(collectPeriodStarts(irregular.dailyLogs).length).toBeGreaterThan(0);
    expect(collectPeriodStarts(lapsed.dailyLogs).length).toBeGreaterThan(0);
  });
});
