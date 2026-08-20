/**
 * LT-17 probe (Phase 5 triage of the Phase 3 iOS sweep, workstream E).
 *
 * The Phase 3 sweep's `calendar-minus-6mo` capture (January 2026,
 * tenure-12mo-regular AND tenure-12mo-irregular) showed the month grid
 * fading out after Jan 28 with days 29-31 fully invisible. Root cause: every
 * grid cell was wrapped in a `MotionView preset="rowShift"` whose
 * `sequenceIndex` was the CELL index (`rowIndex * 7 + columnIndex`, up to 41
 * for a 6-week month). With `rowShift.delayStep = 50ms`, the trailing cells'
 * entering animations start up to ~2.1s after mount and every month-flip
 * remounts all cells (keys are ISO dates) — so for ~2.3s after each flip the
 * tail of the month is at opacity 0. The sweep captured ~1.6s after the last
 * flip, exactly mid-stagger; a real user flipping months sees the same blank
 * tail.
 *
 * SHOULD-BE (this probe asserts the FIXED behavior, per the campaign's
 * flipped-probe convention): the stagger is per WEEK ROW (`sequenceIndex =
 * rowIndex`, bounded by 5 for a 6-week month), so a full month grid finishes
 * revealing within ~430ms of a month flip.
 */
import { render, screen, waitFor } from '@testing-library/react-native';

const mockGetProfile = jest.fn();
const mockListAll = jest.fn();
const mockGetAppPreferences = jest.fn();

jest.mock('@/src/features/logging/date', () => ({
  getLocalTodayLogDate: () => '2026-07-06',
}));

// Stable repository identity across renders (hydration-effect dependency).
const mockRepositories = {
  userProfile: { getProfile: () => mockGetProfile() },
  // LT-23: CalendarScreen now reads via listAll(), not listByDateRange.
  dailyLogs: { listAll: (...args: unknown[]) => mockListAll(...args) },
  appPreferences: { getPreferences: () => mockGetAppPreferences() },
};

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({ repositories: mockRepositories }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/src/localization/LocalizationProvider', () => {
  const { createMockLocalization } = require('../../helpers/mockLocalizationProvider');

  return { useLocalization: () => createMockLocalization() };
});

// eslint-disable-next-line import/first
import { CalendarScreen } from '@/src/features/calendar/screens/CalendarScreen';
// eslint-disable-next-line import/first
import { MotionView } from '@/src/features/motion/MotionView';
// eslint-disable-next-line import/first
import { buildTenureDataset } from '@/src/testing/tenureFixtures';
// eslint-disable-next-line import/first
import { defaultAppPreferences } from '@/src/db/domainDefaults';
// eslint-disable-next-line import/first
import { testIds } from '@/src/testing/testIds';

describe('RESOLVED LT-17 — month-grid reveal stagger is bounded per week row', () => {
  it('gives every grid-cell MotionView a sequenceIndex bounded by its week row (< 6), not its cell index (up to 41)', async () => {
    const dataset = buildTenureDataset('tenure-12mo-regular', '2026-07-06');
    mockGetProfile.mockResolvedValue(dataset.profile);
    mockListAll.mockResolvedValue(dataset.dailyLogs);
    mockGetAppPreferences.mockResolvedValue(defaultAppPreferences);

    render(<CalendarScreen />);

    await waitFor(() => {
      expect(screen.getByTestId(testIds.calendar.screen)).toBeTruthy();
    });

    const motionViews = screen.UNSAFE_getAllByType(MotionView);
    const gridCellSequenceIndexes = motionViews
      .filter((instance) => instance.props.preset === 'rowShift' && instance.props.style)
      .map((instance) => instance.props.sequenceIndex ?? 0);

    // A month grid renders 35 or 42 cells (5 or 6 week rows).
    expect(gridCellSequenceIndexes.length).toBeGreaterThanOrEqual(35);

    // Week-row stagger: the highest sequenceIndex must be the last ROW index
    // (<= 5), which bounds the total reveal to delay 5 * 50ms + 180ms
    // duration = 430ms. The pre-fix per-cell stagger produced indexes up to
    // 41 (2.23s), leaving the tail of the month invisible after a flip.
    expect(Math.max(...gridCellSequenceIndexes)).toBeLessThanOrEqual(5);
  });
});
