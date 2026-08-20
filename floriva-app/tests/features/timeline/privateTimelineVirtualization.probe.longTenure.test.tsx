/**
 * LT-10 / LT-15 probe (Phase 5 triage of the Phase 3 iOS sweep, workstream E).
 *
 * Phase 3 confirmed LT-10 on-device: opening `/calendar/timeline` with a
 * 12-month dataset (341 items) pinned the app's MAIN thread at 100% CPU for
 * minutes with no recovery, on both 12-month variants. A live `sample` of
 * the reproduced freeze (`docs/qa/2026-07-06-long-tenure-sweep/triage/
 * timeline-freeze-mainthread-sample.txt`) shows 100% of samples inside
 * Detox's `ScrollToEdgeAction` -> `-[UIScrollView(DetoxActions)
 * _dtx_scrollWithOffset:...]` -> `-[UIWindow safeAreaInsets]` churn — i.e.
 * the harness's scroll gesture, whose per-step cost scales with the number
 * of MOUNTED views under the scroll view. The app-side amplifier is exactly
 * LT-10: `PrivateTimelineScreen` mounted all 341 rows eagerly via
 * `visibleItems.map(...)` inside the Screen's plain ScrollView. There is no
 * setState-in-render loop (the model hydrates once; a hang in app JS would
 * show Hermes frames in the sample — none are present).
 *
 * SHOULD-BE (this probe asserts the FIXED behavior): the timeline renders
 * through a virtualized list, so at 12-month volume only a bounded window of
 * rows is mounted at once.
 */
import { render, screen, waitFor } from '@testing-library/react-native';

const mockGetProfile = jest.fn();
const mockListAllDailyLogs = jest.fn();
const mockGetReminderPreferences = jest.fn();
const mockListImportSessions = jest.fn();
const mockListBackupEvents = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

jest.mock('@/src/features/logging/date', () => ({
  getLocalTodayLogDate: () => '2026-07-06',
}));

// Stable repository identity across renders — the screen's hydration effect
// depends on `repositories.*`, so a mock that rebuilds the object per render
// would re-run hydration forever (a harness artifact, not the defect under
// probe).
const mockRepositories = {
  userProfile: { getProfile: (...args: unknown[]) => mockGetProfile(...args) },
  dailyLogs: { listAll: (...args: unknown[]) => mockListAllDailyLogs(...args) },
  reminderPreferences: {
    getPreferences: (...args: unknown[]) => mockGetReminderPreferences(...args),
  },
  importSessions: { listSessions: (...args: unknown[]) => mockListImportSessions(...args) },
  backupEvents: { listEvents: (...args: unknown[]) => mockListBackupEvents(...args) },
};

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({ repositories: mockRepositories }),
}));

jest.mock('@/src/localization/LocalizationProvider', () => {
  const { createMockLocalization } = require('../../helpers/mockLocalizationProvider');

  return { useLocalization: () => createMockLocalization() };
});

// eslint-disable-next-line import/first
import { PrivateTimelineScreen } from '@/src/features/timeline/screens/PrivateTimelineScreen';
// eslint-disable-next-line import/first
import { buildPrivateTimelineModel } from '@/src/features/timeline/buildPrivateTimelineModel';
// eslint-disable-next-line import/first
import { buildTenureDataset } from '@/src/testing/tenureFixtures';
// eslint-disable-next-line import/first
import { testIds } from '@/src/testing/testIds';

const TODAY_ISO = '2026-07-06';

describe('RESOLVED LT-10 — private timeline is virtualized at 12-month volume', () => {
  beforeEach(() => {
    mockGetProfile.mockReset();
    mockListAllDailyLogs.mockReset();
    mockGetReminderPreferences.mockReset();
    mockListImportSessions.mockReset();
    mockListBackupEvents.mockReset();
  });

  it('mounts only a bounded window of rows for a ~330-log year, not all of them', async () => {
    const dataset = buildTenureDataset('tenure-12mo-regular', TODAY_ISO);
    // Pin the fixture volume this probe is about: a long-tenure year of logs.
    expect(dataset.dailyLogs.length).toBeGreaterThanOrEqual(290);
    const totalItems = buildPrivateTimelineModel({
      dailyLogs: dataset.dailyLogs,
      imports: [],
      reminders: [],
    }).items.length;
    expect(totalItems).toBeGreaterThanOrEqual(290);

    mockGetProfile.mockResolvedValue(dataset.profile);
    mockListAllDailyLogs.mockResolvedValue(dataset.dailyLogs);
    mockGetReminderPreferences.mockResolvedValue(dataset.reminderPreferences);
    mockListImportSessions.mockResolvedValue([]);
    mockListBackupEvents.mockResolvedValue([]);

    render(<PrivateTimelineScreen todayIso={TODAY_ISO} />);

    await waitFor(() => {
      expect(screen.getByTestId(testIds.calendar.timelineScreen)).toBeTruthy();
    });
    // Hydration has landed once at least one row is mounted. The generous
    // timeout is for the PRE-fix shape of this screen, where a single commit
    // mounted all 300+ rows and could take several seconds in jest.
    await waitFor(
      () => {
        expect(screen.queryAllByTestId(/private-timeline-item-/).length).toBeGreaterThan(0);
      },
      { timeout: 20000 },
    );

    const mountedRows = screen.queryAllByTestId(/private-timeline-item-/);

    // The whole point of virtualization: mounted rows are a render WINDOW
    // (FlatList initialNumToRender + batching), not the entire dataset. The
    // pre-fix `.map()` mounted every one of the 300+ rows in a single
    // commit.
    expect(mountedRows.length).toBeGreaterThan(0);
    expect(mountedRows.length).toBeLessThanOrEqual(30);
  });
});
