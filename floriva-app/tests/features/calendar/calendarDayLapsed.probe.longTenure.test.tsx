/**
 * LT-14 probe (Phase 5 triage of the Phase 3 iOS sweep, workstream E).
 *
 * The Phase 3 sweep reported `/calendar/day/2025-06-13` (tenure-lapsed's
 * oldest logged day) pinning the app at 100% CPU with a blank, faded day
 * screen. Systematic re-investigation found NO app-side loop:
 *
 * - the exact hydration input for that route (profile with
 *   `lastPeriodStartDate` ~320 days in the FUTURE of the rendered date, a
 *   single heavy-bleeding entry in the 365-day read window) runs through
 *   `buildPredictionResult` in ~1ms — every roll/anomaly loop terminates;
 * - the full screen (repo-backed, real sqlite harness) renders and hydrates
 *   in well under a second (this file);
 * - three fresh on-device re-runs of the same deep link (isolated and in the
 *   full reduced-sweep sequence) all mounted in ~210-250ms and captured
 *   cleanly.
 *
 * The freeze evidence itself (header committed mid-entering-fade, main
 * thread pinned) matches the mechanism actually CAUGHT live on the timeline
 * surface (LT-15): Detox's `ScrollToEdgeAction`
 * (`-[UIScrollView(DetoxActions) _dtx_scrollWithOffset:...]`) spinning the
 * app's MAIN thread inside the harness's post-mount scroll-to-top — see
 * `docs/qa/2026-07-06-long-tenure-sweep/triage/
 * timeline-freeze-mainthread-sample.txt`. LT-14 is therefore classified as
 * an intermittent HARNESS wedge (same class as LT-15), not an app defect;
 * the harness now settles before issuing scroll actions and the probes below
 * pin the app-side path as terminating so any future regression re-opens the
 * finding with a hang (jest timeout) instead of a silent pass.
 */
import { render, screen, waitFor } from '@testing-library/react-native';

import { createWave5AcceptanceHarness } from '@/tests/helpers/createWave5AcceptanceHarness';
import { buildPredictionResult } from '@/src/lib/predictions/buildPredictionResult';
import { addDays } from '@/src/lib/predictions/dateMath';
import { buildTenureDataset } from '@/src/testing/tenureFixtures';
import { testIds } from '@/src/testing/testIds';

const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => false);
const mockReplace = jest.fn();

let mockCurrentHarness: Awaited<ReturnType<typeof createWave5AcceptanceHarness>> | null = null;

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: () => mockBack(),
    canGoBack: () => mockCanGoBack(),
    replace: (...args: unknown[]) => mockReplace(...args),
  }),
}));

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => {
    if (!mockCurrentHarness) throw new Error('harness not initialized');
    return { repositories: mockCurrentHarness.repositories };
  },
}));

jest.mock('@/src/features/app-shell/AppShellProvider', () => ({
  useAppShell: () => ({
    refreshReminderSchedules: jest.fn().mockResolvedValue(undefined),
    clearPendingEntryRoute: jest.fn().mockResolvedValue(undefined),
    state: { pendingEntryRoute: undefined },
  }),
}));

jest.mock('@/src/localization/LocalizationProvider', () => {
  const { createMockLocalization } = require('../../helpers/mockLocalizationProvider');
  return { useLocalization: () => createMockLocalization() };
});

// eslint-disable-next-line import/first
import { CalendarDayScreen } from '@/src/features/calendar/screens/CalendarDayScreen';

// The sweep ran with local-today 2026-07-07; buildTenureDataset is pure, so
// this reproduces the exact seeded dataset the frozen run was showing.
const SWEEP_TODAY_ISO = '2026-07-07';
const dataset = buildTenureDataset('tenure-lapsed', SWEEP_TODAY_ISO);
const oldestLogDate = dataset.dailyLogs.map((entry) => entry.logDate).sort()[0]!;

describe('RESOLVED LT-14 — tenure-lapsed oldest-day view has no app-side hang', () => {
  afterEach(() => {
    mockCurrentHarness?.close();
    mockCurrentHarness = null;
  });

  it('pins the exact hydration input: one entry in the window, profile anchor in the future of the rendered day', () => {
    expect(oldestLogDate).toBe('2025-06-13');

    const windowStart = addDays(oldestLogDate, -365);
    const windowEntries = dataset.dailyLogs.filter(
      (entry) => entry.logDate >= windowStart && entry.logDate <= oldestLogDate,
    );
    expect(windowEntries).toHaveLength(1);
    expect(windowEntries[0]!.bleeding).toBe('heavy');
    // The profile's onboarding anchor sits ~320 days AFTER the rendered day
    // — the far-before-the-anchor shape the freeze was suspected of.
    expect(dataset.profile.lastPeriodStartDate! > oldestLogDate).toBe(true);

    // The engine terminates for this shape (a regression here hangs the
    // suite instead of passing): single start, cycle day 1, no anomalies.
    const result = buildPredictionResult({
      todayIso: oldestLogDate,
      profile: dataset.profile,
      logEntries: windowEntries,
    });
    expect(result.current.cycleDay).toBe(1);
    expect(result.current.cycleStartDate).toBe(oldestLogDate);
    expect(result.anomalies).toBeUndefined();
  }, 15000);

  it('renders the oldest-day screen against the full seeded dataset without hanging', async () => {
    mockCurrentHarness = await createWave5AcceptanceHarness();
    await mockCurrentHarness.repositories.userProfile.saveProfile(dataset.profile);
    await mockCurrentHarness.repositories.reminderPreferences.savePreferences(
      dataset.reminderPreferences,
    );
    for (const entry of dataset.dailyLogs) {
      await mockCurrentHarness.repositories.dailyLogs.saveEntry(entry);
    }

    render(<CalendarDayScreen selectedDate={oldestLogDate} />);

    await waitFor(() => {
      expect(screen.getByTestId(testIds.today.loggingCard)).toBeTruthy();
    });
    // Cycle-day hydration (the header the frozen evidence showed) completes.
    await waitFor(() => {
      expect(screen.getByText(/Cycle day 1/)).toBeTruthy();
    });
  }, 15000);
});
