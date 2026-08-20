import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Platform, ScrollView, StyleSheet } from 'react-native';

const mockGetProfile = jest.fn();
const mockListAll = jest.fn();
const mockGetAppPreferences = jest.fn();
const mockPush = jest.fn();
const mockTriggerPressFeedback = jest.fn();

jest.mock('@/src/features/logging/date', () => ({
  getLocalTodayLogDate: () => '2026-04-20',
}));

const mockRepositories = {
  userProfile: {
    getProfile: () => mockGetProfile(),
  },
  dailyLogs: {
    // LT-23: CalendarScreen now reads via listAll() (total period starts on
    // record), not a monthIso-anchored listByDateRange window -- see
    // CalendarScreen.tsx's hydrateCalendar effect.
    listAll: (...args: unknown[]) => mockListAll(...args),
  },
  appPreferences: {
    getPreferences: () => mockGetAppPreferences(),
  },
};

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({
    repositories: mockRepositories,
  }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => mockPush(...args),
  }),
}));

jest.mock('@/src/features/feedback/InteractionFeedbackProvider', () => ({
  useOptionalInteractionFeedback: () => ({
    triggerPressFeedback: (...args: unknown[]) => mockTriggerPressFeedback(...args),
  }),
}));

jest.mock('@/src/localization/LocalizationProvider', () => {
  const { createMockLocalization } = require('../../helpers/mockLocalizationProvider');

  return {
    useLocalization: () => createMockLocalization(),
  };
});

// eslint-disable-next-line import/first
import {
  CalendarScreen,
  CalendarScreenContent,
} from '@/src/features/calendar/screens/CalendarScreen';
// eslint-disable-next-line import/first
import { defaultAppPreferences } from '@/src/db/domainDefaults';
// eslint-disable-next-line import/first
import {
  buildCalendarBandSegmentTestId,
  buildCalendarDayCellFrameTestId,
  buildCalendarDayCellTestId,
  testIds,
} from '@/src/testing/testIds';
// eslint-disable-next-line import/first
import { resolveTheme } from '@/src/theme/tokens';
// eslint-disable-next-line import/first
import { expectAccessiblePressables } from '../../helpers/expectAccessiblePressables';

describe('CalendarScreen', () => {
  beforeEach(() => {
    mockGetProfile.mockReset();
    mockListAll.mockReset();
    mockGetAppPreferences.mockReset();
    mockPush.mockReset();
    mockTriggerPressFeedback.mockReset();
    mockGetAppPreferences.mockResolvedValue(defaultAppPreferences);
  });

  it('renders the wrapper shell while repository hydration is still in flight', () => {
    mockGetProfile.mockReturnValue(new Promise(() => {}));
    mockListAll.mockReturnValue(new Promise(() => {}));

    render(<CalendarScreen />);

    expect(screen.getByTestId(testIds.calendar.screen)).toBeTruthy();
    expect(screen.queryByText('Your timeline and next estimate in one monthly view.')).toBeNull();
  });

  it('uses the local today helper for the wrapper default date', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListAll.mockResolvedValue([]);

    render(<CalendarScreen />);

    await waitFor(() => {
      expect(screen.getByText('April 2026')).toBeTruthy();
    });
  });

  it('renders the month timeline while routing history and estimate detail out of the root screen', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: [],
    });
    mockListAll.mockResolvedValue([
      {
        // A full cycle earlier so the early-April bleed reads as a new cycle
        // start rather than mid-cycle bleeding within a single period.
        id: '2026-03-06-heavy',
        logDate: '2026-03-06',
        bleeding: 'heavy',
        symptoms: [],
      },
      {
        id: '2026-04-02-spotting',
        logDate: '2026-04-02',
        bleeding: 'spotting',
        symptoms: [],
      },
      {
        id: '2026-04-03-light',
        logDate: '2026-04-03',
        bleeding: 'light',
        symptoms: [],
      },
      {
        id: '2026-04-04-heavy',
        logDate: '2026-04-04',
        bleeding: 'heavy',
        symptoms: [],
      },
    ]);

    const view = render(<CalendarScreenContent todayIso="2026-04-20" />);

    await waitFor(() => {
      expect(screen.getByText('April 2026')).toBeTruthy();
      expect(screen.getAllByText('Recent cycles').length).toBeGreaterThan(0);
      expect(screen.getByText('Why the estimate can move')).toBeTruthy();
      expect(screen.getByTestId(testIds.calendar.confidenceSummary)).toBeTruthy();
      expect(screen.getByText('Based on 2 local cycle starts')).toBeTruthy();
      expect(screen.getByText('Fertile')).toBeTruthy();
      expect(screen.getByTestId('calendar-fertile-window-help')).toBeTruthy();
      expect(screen.queryByText('Logged days and upcoming estimates stay in one view.')).toBeNull();
      expect(screen.queryByText('Recent logged bleeding days shaping this estimate.')).toBeNull();
      expect(screen.queryByText('Apr 2')).toBeNull();
      expect(screen.queryAllByText('Pred.')).toHaveLength(0);
      expect(screen.queryByTestId(buildCalendarBandSegmentTestId('predicted', '2026-05-01'))).toBeNull();
      expect(screen.getByTestId(buildCalendarDayCellTestId('2026-04-02'))).toBeTruthy();
      expect(screen.getByTestId(buildCalendarDayCellTestId('2026-04-03'))).toBeTruthy();
      // Quiet Bands: the logged Apr 3-4 period run renders as a rose band,
      // not the classic filled disc.
      expect(screen.getByTestId(buildCalendarBandSegmentTestId('period', '2026-04-03'))).toBeTruthy();
      // Fertile window (Apr 12–17) is shaded directly on the grid as a
      // mossSoft band, not just summarised in the legend.
      expect(screen.getByTestId(buildCalendarBandSegmentTestId('fertile', '2026-04-13'))).toBeTruthy();
    });

    expectAccessiblePressables(view.UNSAFE_root);
  });

  it('announces day states in the grid cell accessibility labels', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: [],
    });
    mockListAll.mockResolvedValue([
      { id: '2026-03-06-heavy', logDate: '2026-03-06', bleeding: 'heavy', symptoms: [] },
      { id: '2026-04-02-spotting', logDate: '2026-04-02', bleeding: 'spotting', symptoms: [] },
      { id: '2026-04-03-light', logDate: '2026-04-03', bleeding: 'light', symptoms: [] },
      { id: '2026-04-04-heavy', logDate: '2026-04-04', bleeding: 'heavy', symptoms: [] },
    ]);

    render(<CalendarScreenContent todayIso="2026-04-20" />);

    await screen.findByText('April 2026');

    // Quiet Bands paints these states visually only, so the pressable label
    // must carry them for screen readers (calendar.a11y.* fragments).
    expect(
      screen.getByTestId(buildCalendarDayCellTestId('2026-04-03')).props.accessibilityLabel,
    ).toBe('Open log for 2026-04-03, logged period day');
    expect(
      screen.getByTestId(buildCalendarDayCellTestId('2026-04-02')).props.accessibilityLabel,
    ).toBe('Open log for 2026-04-02, spotting day');
    expect(
      screen.getByTestId(buildCalendarDayCellTestId('2026-04-13')).props.accessibilityLabel,
    ).toBe('Open log for 2026-04-13, fertile window day');
    expect(
      screen.getByTestId(buildCalendarDayCellTestId('2026-04-20')).props.accessibilityLabel,
    ).toBe('Open log for 2026-04-20, today');
    // Unmarked days keep the plain open-log label.
    expect(
      screen.getByTestId(buildCalendarDayCellTestId('2026-04-09')).props.accessibilityLabel,
    ).toBe('Open log for 2026-04-09');
  });

  it('hides fertile markers, legend, and selected-day tags when fertility estimates are disabled', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-31',
      goals: ['period'],
      supportsIrregularCycles: false,
      conditionTags: [],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
    });
    mockListAll.mockResolvedValue([
      {
        id: '2026-03-31-heavy',
        logDate: '2026-03-31',
        bleeding: 'heavy',
        symptoms: [],
      },
    ]);
    mockGetAppPreferences.mockResolvedValue({
      ...defaultAppPreferences,
      showFertilityEstimates: false,
    });

    render(<CalendarScreenContent todayIso="2026-04-20" />);

    await screen.findByText('April 2026');

    expect(screen.queryByText('Fertile')).toBeNull();
    expect(screen.queryByTestId('calendar-fertile-window-help')).toBeNull();
    expect(screen.queryAllByTestId(/^calendar-band-fertile-/)).toHaveLength(0);

    fireEvent.press(screen.getByTestId(buildCalendarDayCellTestId('2026-04-12')));

    expect(screen.queryByText('Fertile window')).toBeNull();
  });

  it('keeps the root focused even when no history has been saved yet', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListAll.mockResolvedValue([]);

    render(<CalendarScreenContent todayIso="2026-04-20" />);

    await waitFor(() => {
      expect(screen.getByText('Recent cycles')).toBeTruthy();
      expect(screen.queryByText('Logged days and upcoming estimates stay in one view.')).toBeNull();
      expect(screen.queryByText('No bleeding history yet.')).toBeNull();
    });
  });

  it('hydrates the calendar after the repository promises resolve asynchronously', async () => {
    let resolveProfile: (value: unknown) => void = () => {};
    let resolveLogs: (value: unknown) => void = () => {};

    mockGetProfile.mockReturnValue(
      new Promise((resolve) => {
        resolveProfile = resolve;
      }),
    );
    mockListAll.mockReturnValue(
      new Promise((resolve) => {
        resolveLogs = resolve;
      }),
    );

    render(<CalendarScreenContent todayIso="2026-04-20" />);

    await act(async () => {
      resolveProfile({
        cycleLengthDays: 28,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-03-28',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: false,
        conditionTags: [],
      });
      resolveLogs([
        {
          id: '2026-03-28-heavy',
          logDate: '2026-03-28',
          bleeding: 'heavy',
          symptoms: [],
        },
        {
          id: '2026-04-02-spotting',
          logDate: '2026-04-02',
          bleeding: 'spotting',
          symptoms: [],
        },
      ]);
    });

    await waitFor(() => {
      expect(screen.getByText('April 2026')).toBeTruthy();
      expect(screen.getByText('Why the estimate can move')).toBeTruthy();
      expect(screen.queryByText('Logged days and upcoming estimates stay in one view.')).toBeNull();
      expect(screen.queryByText('Apr 2')).toBeNull();
    });
  });

  it('keeps the fertile-window help control out of the crowded legend row', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-31',
      goals: ['period', 'ttc'],
      supportsIrregularCycles: false,
      conditionTags: [],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
    });
    mockListAll.mockResolvedValue([
      {
        id: '2026-03-31-heavy',
        logDate: '2026-03-31',
        bleeding: 'heavy',
        symptoms: [],
      },
    ]);

    const view = render(<CalendarScreenContent todayIso="2026-04-20" />);

    await screen.findByText('April 2026');

    const legendHeader = screen.getByTestId(testIds.calendar.legendHeader);
    const legendRow = screen.getByTestId(testIds.calendar.legendRow);
    const legendRowStyle = StyleSheet.flatten(legendRow.props.style);

    expect(within(legendHeader).getByText('Calendar key')).toBeTruthy();
    expect(within(legendHeader).getByTestId('calendar-fertile-window-help')).toBeTruthy();
    expect(within(legendRow).queryByTestId('calendar-fertile-window-help')).toBeNull();
    expect(legendRowStyle.flexWrap).toBe('wrap');
    expect(view.getAllByText('Fertile')).toHaveLength(1);
  });

  it('renders the serif month title with the calendar eyebrow above it', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListAll.mockResolvedValue([]);

    render(<CalendarScreenContent todayIso="2026-04-20" />);

    const title = await screen.findByText('April 2026');
    const titleStyle = StyleSheet.flatten(title.props.style);

    // Phase 2c chrome: the month title uses the serif title token
    // (Newsreader), not the old bold system compact title.
    expect(titleStyle.fontFamily).toBe(resolveTheme('light').typography.title.fontFamily);

    // The "CALENDAR" eyebrow renders above the title (uppercased via the
    // eyebrow token's textTransform) on both platforms; Android's divergent
    // native-header treatment is tracked separately as UL-71.
    const eyebrow = screen.getByText('Calendar');
    const eyebrowStyle = StyleSheet.flatten(eyebrow.props.style);
    expect(eyebrowStyle.textTransform).toBe('uppercase');
  });

  it('renders the month-nav chevrons as circular ink-outline buttons', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListAll.mockResolvedValue([]);

    render(<CalendarScreenContent todayIso="2026-04-20" />);

    await screen.findByText('April 2026');

    const theme = resolveTheme('light');
    for (const buttonTestId of [
      testIds.calendar.previousMonthButton,
      testIds.calendar.nextMonthButton,
    ]) {
      const style = StyleSheet.flatten(screen.getByTestId(buttonTestId).props.style);
      expect(style.borderRadius).toBe(theme.radii.pill);
      expect(style.borderWidth).toBe(1);
      expect(style.borderColor).toBe(theme.colors.textPrimary);
    }
  });

  it('UL-21: mounts the month-nav chevrons in the header actions slot beside the serif title', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListAll.mockResolvedValue([]);

    render(<CalendarScreenContent todayIso="2026-04-20" />);

    await screen.findByText('April 2026');

    // The chevrons used to float far right in an otherwise-empty band below
    // the title (a dead zone). They now live in the Screen header's actions
    // slot, directly beside the serif month title.
    const headerActions = screen.getByTestId('screen-header-actions');
    expect(
      within(headerActions).getByTestId(testIds.calendar.previousMonthButton),
    ).toBeTruthy();
    expect(
      within(headerActions).getByTestId(testIds.calendar.nextMonthButton),
    ).toBeTruthy();
  });

  it('UL-06: leads the prediction banner with the next-period payload, not the confidence line', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListAll.mockResolvedValue([]);

    render(<CalendarScreenContent todayIso="2026-04-20" />);

    await screen.findByText('April 2026');

    const summary = screen.getByTestId(testIds.calendar.confidenceSummary);
    const payload = within(summary).getByTestId(testIds.calendar.nextPeriodLabel);
    const payloadStyle = StyleSheet.flatten(payload.props.style);
    const theme = resolveTheme('light');

    // The banner used to set the confidence line big and bold while the
    // actual payload ("Next period expected …") rendered as a small caption
    // — hierarchy inverted. The payload is now the banner's lead line.
    expect(payloadStyle.fontSize).toBe(theme.typography.subtitle.fontSize);
    expect(payloadStyle.color).toBe(theme.colors.textPrimary);
  });

  it('renders the six-entry quiet-bands legend with the selected swatch carrying its testID', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListAll.mockResolvedValue([]);

    render(<CalendarScreenContent todayIso="2026-04-20" />);

    await screen.findByText('April 2026');

    const legendRow = screen.getByTestId(testIds.calendar.legendRow);

    // UL-34/UL-41: 'Spotting' joins the legend so the hollow spotting dot
    // the grid draws is decodable without guessing.
    for (const label of ['Period', 'Predicted', 'Fertile', 'Logged', 'Spotting', 'Selected']) {
      expect(within(legendRow).getByText(label)).toBeTruthy();
    }
    expect(
      within(legendRow).getByTestId(testIds.calendar.legendSelectedSwatch),
    ).toBeTruthy();
  });

  it('moves between months with the visible month controls', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListAll.mockResolvedValue([]);

    render(<CalendarScreenContent todayIso="2026-04-20" />);

    await screen.findByText('April 2026');

    expect(screen.getByTestId(testIds.calendar.previousMonthButton)).toBeTruthy();
    expect(screen.getByTestId(testIds.calendar.nextMonthButton)).toBeTruthy();

    fireEvent.press(screen.getByTestId(testIds.calendar.nextMonthButton));

    expect(mockTriggerPressFeedback).toHaveBeenCalledWith('action');

    await waitFor(() => {
      expect(screen.getByText('May 2026')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId(testIds.calendar.previousMonthButton));

    await waitFor(() => {
      expect(screen.getByText('April 2026')).toBeTruthy();
    });
  });

  it('triggers feedback when selecting a day from the month grid', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListAll.mockResolvedValue([]);

    render(<CalendarScreenContent todayIso="2026-04-20" />);

    await screen.findByText('April 2026');

    fireEvent.press(screen.getByTestId(buildCalendarDayCellTestId('2026-04-20')));

    expect(mockTriggerPressFeedback).toHaveBeenCalledWith('action');
    expect(mockPush).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('View day'));

    expect(mockPush).toHaveBeenCalledWith('/calendar/day/2026-04-20');
  });

  it('opens day detail, private timeline, history, and estimate routes from the focused calendar root', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListAll.mockResolvedValue([]);

    render(<CalendarScreenContent todayIso="2026-04-20" />);

    await screen.findByText('April 2026');

    fireEvent.press(screen.getByText('View day'));
    fireEvent.press(screen.getByText('Recent cycles'));
    fireEvent.press(screen.getByTestId(testIds.calendar.timelineOpenButton));
    fireEvent.press(screen.getByText('Why the estimate can move'));

    expect(mockPush).toHaveBeenCalledWith('/calendar/day/2026-04-20');
    expect(mockPush).toHaveBeenCalledWith('/calendar/timeline');
    expect(mockPush).toHaveBeenCalledWith('/calendar/history');
    expect(mockPush).toHaveBeenCalledWith('/calendar/about-estimates');
  });

  it('opens history and estimate routes from the recent-cycles section when history exists', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: [],
    });
    mockListAll.mockResolvedValue([
      {
        id: '2026-02-28-heavy',
        logDate: '2026-02-28',
        bleeding: 'heavy',
        symptoms: [],
      },
      {
        id: '2026-03-28-heavy',
        logDate: '2026-03-28',
        bleeding: 'heavy',
        symptoms: [],
      },
    ]);

    render(<CalendarScreenContent todayIso="2026-04-20" />);

    await screen.findByText('28 days');

    fireEvent.press(screen.getAllByText('Recent cycles').at(-1)!);
    fireEvent.press(screen.getAllByText('Why the estimate can move').at(-1)!);

    expect(mockPush).toHaveBeenCalledWith('/calendar/history');
    expect(mockPush).toHaveBeenCalledWith('/calendar/about-estimates');
  });

  it('shows the inline day card defaulting to today and switches when a cell is tapped', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListAll.mockResolvedValue([]);

    render(<CalendarScreenContent todayIso="2026-04-20" />);

    await screen.findByText('April 2026');

    expect(screen.getByText('View day')).toBeTruthy();
    expect(screen.getByText('Edit log')).toBeTruthy();

    fireEvent.press(screen.getByTestId(buildCalendarDayCellTestId('2026-04-15')));

    fireEvent.press(screen.getByText('View day'));
    expect(mockPush).toHaveBeenCalledWith('/calendar/day/2026-04-15');
  });

  it('surfaces selected-day tags for predicted and logged calendar states', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-31',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: [],
    });
    mockListAll.mockResolvedValue([
      {
        id: '2026-03-31-heavy',
        logDate: '2026-03-31',
        bleeding: 'heavy',
        symptoms: [],
      },
      {
        id: '2026-04-02-spotting',
        logDate: '2026-04-02',
        bleeding: 'spotting',
        symptoms: [],
      },
    ]);

    render(<CalendarScreenContent todayIso="2026-04-20" />);

    await screen.findByText('April 2026');

    fireEvent.press(screen.getByTestId(buildCalendarDayCellTestId('2026-04-02')));
    // The legend now also carries a 'Spotting' entry (UL-34/UL-41), so the
    // selected-day tag is the second instance.
    expect(screen.getAllByText('Spotting').length).toBeGreaterThan(1);

    fireEvent.press(screen.getByTestId(buildCalendarDayCellTestId('2026-04-28')));
    expect(screen.getAllByText('Predicted').length).toBeGreaterThan(0);

    fireEvent.press(screen.getByText('Edit log'));
    expect(mockPush).toHaveBeenCalledWith('/calendar/day/2026-04-28');
  });

  it('LT-31: suppresses grid fertile shading and the inline day card Fertile-window tag once history is stale', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-01-01',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: [],
    });
    // Same stale fixture shape as LT-24/LT-27: 3 period starts (minimum for
    // the engine's terminal high-confidence branch), last real bleeding on
    // 2026-01-01, "today" well over 2 rolled 28-day cycles later.
    mockListAll.mockResolvedValue([
      { id: '2025-11-06', logDate: '2025-11-06', bleeding: 'heavy', symptoms: [] },
      { id: '2025-12-04', logDate: '2025-12-04', bleeding: 'heavy', symptoms: [] },
      { id: '2026-01-01', logDate: '2026-01-01', bleeding: 'heavy', symptoms: [] },
    ]);

    render(<CalendarScreenContent todayIso="2026-04-20" />);

    await screen.findByText('April 2026');

    // BUG (pre-fix): the grid still shaded a green fertile run sourced from
    // the rolled synthetic anchor, and the inline day card (defaulting to
    // today, 2026-04-20) showed a "Fertile window" tag alongside "Cycle day
    // 13". FIXED: buildCalendarScreenModel's isFertile now also requires
    // `!isPredictionStale` (mirroring LT-09's predicted-period gate in the
    // same file), so no cell is marked fertile and the inline tag never
    // renders. Quiet Bands renders fertility as band layers, so the stale
    // month must carry no fertile (or predicted) band segments at all.
    expect(screen.queryAllByTestId(/^calendar-band-fertile-/)).toHaveLength(0);
    expect(screen.queryAllByTestId(/^calendar-band-predicted-/)).toHaveLength(0);
    expect(screen.queryByText('Fertile window')).toBeNull();

    // The day-card's "Cycle day N" eyebrow is a per-day structural fact
    // (same convention CalendarDayScreen already keeps while stale per
    // LT-24 -- only the "Fertile" assertion is suppressed, not this), so it
    // stays visible and unaffected by this fix.
    expect(screen.getByText(/Cycle day \d+/)).toBeTruthy();
  });

  it('keeps each day cell at a safer touch target size for manual calendar tapping', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListAll.mockResolvedValue([]);

    render(<CalendarScreenContent todayIso="2026-04-20" />);

    const dayCell = await screen.findByTestId(buildCalendarDayCellTestId('2026-04-20'));
    const dayCellContainer = screen.getByTestId(buildCalendarDayCellFrameTestId('2026-04-20'));
    const containerStyle = StyleSheet.flatten(dayCellContainer.props.style);

    // Cells are 38px, hitSlop adds 10px per side → 58px effective tap target (> 44px minimum)
    expect(containerStyle.minHeight).toBeGreaterThanOrEqual(38);
    expect(dayCell.props.hitSlop).toBe(10);
    expect(containerStyle.minHeight + (dayCell.props.hitSlop as number) * 2).toBeGreaterThanOrEqual(44);
  });

  it('nudges compact screens down enough to keep the current week above the floating dock', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListAll.mockResolvedValue([]);

    const view = render(
      <CalendarScreenContent
        todayIso="2026-04-20"
        windowHeightOverride={874}
      />,
    );

    await screen.findByText('April 2026');

    const scrollView = view.UNSAFE_getByType(ScrollView);

    expect(scrollView.props.contentOffset).toEqual({
      x: 0,
      y: expect.any(Number),
    });
    expect(scrollView.props.contentOffset.y).toBeGreaterThanOrEqual(48);
  });

  it('still nudges early-month compact layouts so the bottom week does not sit under the dock', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListAll.mockResolvedValue([]);

    const view = render(
      <CalendarScreenContent
        todayIso="2026-04-12"
        windowHeightOverride={874}
      />,
    );

    await screen.findByText('April 2026');

    const scrollView = view.UNSAFE_getByType(ScrollView);

    expect(scrollView.props.contentOffset).toEqual({
      x: 0,
      y: 48,
    });
  });

  it('uses a tighter but still tappable compact grid size when the floating dock is present', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListAll.mockResolvedValue([]);

    render(
      <CalendarScreenContent
        todayIso="2026-04-12"
        windowHeightOverride={874}
      />,
    );

    const compactDayCellContainer = await screen.findByTestId(
      buildCalendarDayCellFrameTestId('2026-04-30'),
    );
    const compactContainerStyle = StyleSheet.flatten(compactDayCellContainer.props.style);

    expect(compactContainerStyle.minHeight).toBe(44);
  });

  it('drops the extra monthly-view helper copy on compact screens so the full grid stays reachable', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListAll.mockResolvedValue([]);

    render(
      <CalendarScreenContent
        todayIso="2026-04-20"
        windowHeightOverride={874}
      />,
    );

    await screen.findByText('April 2026');

    expect(screen.queryByText('Logged days and upcoming estimates stay in one view.')).toBeNull();
  });

  it('UL-71: requests the initial scroll offset on Android too, now that the Screen primitive applies it everywhere', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListAll.mockResolvedValue([]);

    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    try {
      const view = render(
        <CalendarScreenContent
          todayIso="2026-04-20"
          windowHeightOverride={874}
        />,
      );

      await screen.findByText('April 2026');

      const scrollView = view.UNSAFE_getByType(ScrollView);

      // The Wave B workaround (request 0 on Android because only iOS honors
      // the `contentOffset` prop) is gone: the Screen primitive now applies
      // the offset imperatively where the prop is not honored, and no longer
      // pre-seeds its sticky collapse bar with an unapplied offset. The
      // calendar therefore requests its compact-layout nudge unconditionally.
      expect(scrollView.props.contentOffset.y).toBeGreaterThanOrEqual(48);
    } finally {
      Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    }
  });

  it('treats taller phone-sized Android viewports as compact so the dock does not cover the last week', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListAll.mockResolvedValue([]);

    render(
      <CalendarScreenContent
        todayIso="2026-04-12"
        windowHeightOverride={940}
      />,
    );

    await screen.findByText('April 2026');

    expect(screen.queryByText('Logged days and upcoming estimates stay in one view.')).toBeNull();
  });

  it('shows a loading message while the calendar hydration is still in flight', () => {
    mockGetProfile.mockReturnValue(new Promise(() => {}));
    mockListAll.mockReturnValue(new Promise(() => {}));

    render(<CalendarScreenContent todayIso="2026-04-20" />);

    expect(screen.getByText('Loading calendar…')).toBeTruthy();
    expect(screen.queryByText('Monthly view')).toBeNull();
  });

  it('shows a clear error instead of silent fallback data when hydration fails', async () => {
    mockGetProfile.mockRejectedValue(new Error('sqlite exploded'));
    mockListAll.mockRejectedValue(new Error('sqlite exploded'));

    render(<CalendarScreenContent todayIso="2026-04-20" />);

    await waitFor(() => {
      expect(screen.getByText('Calendar could not load right now.')).toBeTruthy();
      expect(screen.queryByText('Monthly view')).toBeNull();
    });
  });

  it('keeps the monthly view on the stronger solid surface while supporting cards stay standard', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListAll.mockResolvedValue([]);

    render(<CalendarScreenContent todayIso="2026-04-20" />);

    await waitFor(() => {
      expect(screen.getByTestId(testIds.calendar.monthlyViewCard)).toBeTruthy();
      expect(screen.getByTestId(testIds.calendar.recentHistoryCard)).toBeTruthy();
    });
  });

  it('ignores successful hydration results after the screen unmounts', async () => {
    let resolveProfile: ((value: unknown) => void) | undefined;
    let resolveLogs: ((value: unknown[]) => void) | undefined;
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    mockGetProfile.mockReturnValue(
      new Promise((resolve) => {
        resolveProfile = resolve;
      }),
    );
    mockListAll.mockReturnValue(
      new Promise((resolve) => {
        resolveLogs = resolve;
      }),
    );

    const view = render(<CalendarScreenContent todayIso="2026-04-20" />);

    view.unmount();

    await act(async () => {
      resolveProfile?.(null);
      resolveLogs?.([]);
      await Promise.resolve();
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('ignores hydration failures after the screen unmounts', async () => {
    let rejectProfile: ((error: Error) => void) | undefined;
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    mockGetProfile.mockReturnValue(
      new Promise((_, reject) => {
        rejectProfile = reject;
      }),
    );
    mockListAll.mockReturnValue(new Promise(() => {}));

    const view = render(<CalendarScreenContent todayIso="2026-04-20" />);

    view.unmount();

    await act(async () => {
      rejectProfile?.(new Error('profile failed'));
      await Promise.resolve();
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('renders the confidence improvement list instead of the old plain-text reason line', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: [],
    });
    mockListAll.mockResolvedValue([
      {
        id: '2026-03-06-heavy',
        logDate: '2026-03-06',
        bleeding: 'heavy',
        symptoms: [],
      },
      {
        id: '2026-04-04-heavy',
        logDate: '2026-04-04',
        bleeding: 'heavy',
        symptoms: [],
      },
    ]);

    render(<CalendarScreenContent todayIso="2026-04-20" />);

    await screen.findByText('April 2026');

    expect(
      screen.getByTestId(testIds.confidenceImprovementList.row('one-observed-interval')),
    ).toBeTruthy();
    expect(screen.getByText('Log today to confirm your rhythm sooner')).toBeTruthy();

    fireEvent.press(
      screen.getByTestId(testIds.confidenceImprovementList.row('one-observed-interval')),
    );

    expect(mockPush).toHaveBeenCalledWith('/calendar/day/2026-04-20');
  });

  it('renders nothing extra under the confidence basis when there are no improvements', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-01-01',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: [],
    });
    mockListAll.mockResolvedValue([
      {
        id: '2026-01-01-heavy',
        logDate: '2026-01-01',
        bleeding: 'heavy',
        symptoms: [],
      },
      {
        id: '2026-01-29-heavy',
        logDate: '2026-01-29',
        bleeding: 'heavy',
        symptoms: [],
      },
      {
        id: '2026-02-26-heavy',
        logDate: '2026-02-26',
        bleeding: 'heavy',
        symptoms: [],
      },
      {
        id: '2026-03-26-heavy',
        logDate: '2026-03-26',
        bleeding: 'heavy',
        symptoms: [],
      },
    ]);

    render(<CalendarScreenContent todayIso="2026-04-20" />);

    await screen.findByText('April 2026');

    expect(screen.getByText('High confidence')).toBeTruthy();
    expect(
      screen.queryByTestId(testIds.confidenceImprovementList.list),
    ).toBeNull();
  });

  it('opens the confidence info modal when the calendar confidence chip is pressed', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: [],
    });
    mockListAll.mockResolvedValue([
      {
        id: '2026-02-28-medium',
        logDate: '2026-02-28',
        bleeding: 'medium',
        symptoms: [],
      },
      {
        id: '2026-03-28-heavy',
        logDate: '2026-03-28',
        bleeding: 'heavy',
        symptoms: [],
      },
    ]);

    render(<CalendarScreenContent todayIso="2026-04-20" />);

    await screen.findByText('Medium confidence');

    fireEvent.press(screen.getByTestId(testIds.calendar.confidenceChipButton));

    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/modal',
        params: expect.objectContaining({
          title: 'Why confidence is medium',
        }),
      }),
    );
  });

  it('exposes the calendar confidence chip as an accessible button that announces it opens an explanation', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockListAll.mockResolvedValue([]);

    render(<CalendarScreenContent todayIso="2026-04-20" />);

    const chip = await screen.findByTestId(testIds.calendar.confidenceChipButton);

    expect(chip.props.accessibilityRole).toBe('button');
    expect(chip.props.accessibilityLabel).toContain('confidence');
    expect(chip.props.accessibilityHint).toBeTruthy();
  });
});
