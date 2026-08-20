import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

const mockTriggerPressFeedback = jest.fn();

jest.mock('@/src/features/feedback/InteractionFeedbackProvider', () => ({
  useOptionalInteractionFeedback: () => ({
    triggerPressFeedback: (...args: unknown[]) => mockTriggerPressFeedback(...args),
  }),
}));

// eslint-disable-next-line import/first
import {
  CalendarMonthGrid,
  type CalendarMonthGridCell,
  type CalendarMonthGridWeeks,
} from '@/src/features/calendar/components/CalendarMonthGrid';
// eslint-disable-next-line import/first
import { MotionView } from '@/src/features/motion/MotionView';
// eslint-disable-next-line import/first
import {
  buildCalendarDayCellFrameTestId,
  buildCalendarDayCellTestId,
  buildCalendarFertileDayMarkerTestId,
  buildCalendarPredictedDayMarkerTestId,
} from '@/src/testing/testIds';
// eslint-disable-next-line import/first
import { expectAccessiblePressables } from '../../helpers/expectAccessiblePressables';

function buildCell(overrides: Partial<CalendarMonthGridCell> & { date: string }): CalendarMonthGridCell {
  return {
    dayNumber: String(Number(overrides.date.slice(8, 10))),
    inMonth: true,
    isToday: false,
    marker: 'none',
    cycleDay: null,
    isFertile: false,
    periodBand: null,
    predictedBand: null,
    fertileBand: null,
    ...overrides,
  };
}

// Two fixture weeks covering every cell state the classic variant styles:
// out-of-month lead-in, a logged period run, spotting, plain logged days,
// a fertile window, today, predicted period, and a predicted+fertile overlap.
const fixtureWeeks: CalendarMonthGridWeeks = [
  [
    buildCell({ date: '2026-03-29', inMonth: false }),
    buildCell({ date: '2026-03-30', inMonth: false }),
    buildCell({ date: '2026-03-31', inMonth: false }),
    buildCell({ date: '2026-04-01', marker: 'period', cycleDay: 1 }),
    buildCell({ date: '2026-04-02', marker: 'period', cycleDay: 2 }),
    buildCell({ date: '2026-04-03', marker: 'spotting', cycleDay: 3 }),
    buildCell({ date: '2026-04-04', cycleDay: 4 }),
  ],
  [
    buildCell({ date: '2026-04-05', cycleDay: 5 }),
    buildCell({ date: '2026-04-06', isFertile: true, cycleDay: 6 }),
    buildCell({ date: '2026-04-07', isFertile: true, cycleDay: 7 }),
    buildCell({ date: '2026-04-08', isToday: true, cycleDay: 8 }),
    buildCell({ date: '2026-04-09', marker: 'predicted-period', cycleDay: 9 }),
    buildCell({ date: '2026-04-10', marker: 'predicted-period', isFertile: true, cycleDay: 10 }),
    buildCell({ date: '2026-04-11', cycleDay: 11 }),
  ],
];

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function renderGrid(overrides: Partial<Parameters<typeof CalendarMonthGrid>[0]> = {}) {
  return render(
    <CalendarMonthGrid
      buildDayCellAccessibilityLabel={(date) => `Open ${date}`}
      dayCellAccessibilityHint="Opens the day detail"
      isCompactLayout={false}
      onSelectDate={jest.fn()}
      selectedDate="2026-04-02"
      weekdayLabels={weekdayLabels}
      weeks={fixtureWeeks}
      {...overrides}
    />,
  );
}

describe('CalendarMonthGrid', () => {
  beforeEach(() => {
    mockTriggerPressFeedback.mockReset();
  });

  it('renders the weekday header row and one frame per fixture cell', () => {
    renderGrid();

    for (const label of weekdayLabels) {
      expect(screen.getByText(label)).toBeTruthy();
    }

    for (const cell of fixtureWeeks.flat()) {
      expect(screen.getByTestId(buildCalendarDayCellFrameTestId(cell.date))).toBeTruthy();
    }
  });

  it('renders out-of-month cells as empty frames without a pressable day cell', () => {
    renderGrid();

    expect(screen.getByTestId(buildCalendarDayCellFrameTestId('2026-03-30'))).toBeTruthy();
    expect(screen.queryByTestId(buildCalendarDayCellTestId('2026-03-30'))).toBeNull();
    // In-month cells keep their pressable hit target.
    expect(screen.getByTestId(buildCalendarDayCellTestId('2026-04-04'))).toBeTruthy();
  });

  it('marks predicted-period cells with the predicted marker and nothing else', () => {
    renderGrid();

    expect(screen.getByTestId(buildCalendarPredictedDayMarkerTestId('2026-04-09'))).toBeTruthy();
    expect(screen.getByTestId(buildCalendarPredictedDayMarkerTestId('2026-04-10'))).toBeTruthy();
    expect(screen.queryByTestId(buildCalendarPredictedDayMarkerTestId('2026-04-01'))).toBeNull();
    expect(screen.queryByTestId(buildCalendarPredictedDayMarkerTestId('2026-04-08'))).toBeNull();
  });

  it('marks fertile cells with the fertile dot, including the predicted overlap, but never period cells', () => {
    renderGrid();

    expect(screen.getByTestId(buildCalendarFertileDayMarkerTestId('2026-04-06'))).toBeTruthy();
    expect(screen.getByTestId(buildCalendarFertileDayMarkerTestId('2026-04-07'))).toBeTruthy();
    // Predicted + fertile composite keeps both markers.
    expect(screen.getByTestId(buildCalendarFertileDayMarkerTestId('2026-04-10'))).toBeTruthy();
    expect(screen.queryByTestId(buildCalendarFertileDayMarkerTestId('2026-04-01'))).toBeNull();
    expect(screen.queryByTestId(buildCalendarFertileDayMarkerTestId('2026-04-08'))).toBeNull();
  });

  it('exposes the selected day through accessibilityState and the passed-in a11y strings', () => {
    const view = renderGrid();

    const selectedCell = screen.getByTestId(buildCalendarDayCellTestId('2026-04-02'));
    const unselectedCell = screen.getByTestId(buildCalendarDayCellTestId('2026-04-08'));

    expect(selectedCell.props.accessibilityState).toMatchObject({ selected: true });
    expect(unselectedCell.props.accessibilityState).toMatchObject({ selected: false });
    expect(selectedCell.props.accessibilityLabel).toBe('Open 2026-04-02');
    expect(selectedCell.props.accessibilityHint).toBe('Opens the day detail');

    expectAccessiblePressables(view.UNSAFE_root);
  });

  it('reports taps through onSelectDate with the tapped ISO date and action feedback', () => {
    const onSelectDate = jest.fn();

    renderGrid({ onSelectDate });

    fireEvent.press(screen.getByTestId(buildCalendarDayCellTestId('2026-04-08')));

    expect(onSelectDate).toHaveBeenCalledWith('2026-04-08');
    expect(mockTriggerPressFeedback).toHaveBeenCalledWith('action');
  });

  it('keeps the LT-17 per-week-row MotionView stagger inside the component', () => {
    renderGrid();

    const motionViews = screen.UNSAFE_getAllByType(MotionView);
    const gridCellSequenceIndexes = motionViews
      .filter((instance) => instance.props.preset === 'rowShift' && instance.props.style)
      .map((instance) => instance.props.sequenceIndex ?? 0);

    // One MotionView per fixture cell, staggered by ROW index (0 and 1 for
    // the two fixture weeks), never by cell index (which would reach 13).
    expect(gridCellSequenceIndexes).toHaveLength(14);
    expect(Math.max(...gridCellSequenceIndexes)).toBe(1);
  });

  it('sizes cells at the 38px base height and grows them to 44px in compact layouts', () => {
    const view = renderGrid();

    const baseFrame = screen.getByTestId(buildCalendarDayCellFrameTestId('2026-04-08'));

    expect(StyleSheet.flatten(baseFrame.props.style).minHeight).toBe(38);

    view.rerender(
      <CalendarMonthGrid
        buildDayCellAccessibilityLabel={(date) => `Open ${date}`}
        dayCellAccessibilityHint="Opens the day detail"
        isCompactLayout
        onSelectDate={jest.fn()}
        selectedDate="2026-04-02"
        weekdayLabels={weekdayLabels}
        weeks={fixtureWeeks}
      />,
    );

    const compactFrame = screen.getByTestId(buildCalendarDayCellFrameTestId('2026-04-08'));

    expect(StyleSheet.flatten(compactFrame.props.style).minHeight).toBe(44);
  });

  it('defaults to the classic variant so an explicit variant="classic" renders identically', () => {
    const view = renderGrid();
    const defaultJson = JSON.stringify(view.toJSON());

    view.rerender(
      <CalendarMonthGrid
        buildDayCellAccessibilityLabel={(date) => `Open ${date}`}
        dayCellAccessibilityHint="Opens the day detail"
        isCompactLayout={false}
        onSelectDate={jest.fn()}
        selectedDate="2026-04-02"
        variant="classic"
        weekdayLabels={weekdayLabels}
        weeks={fixtureWeeks}
      />,
    );

    expect(JSON.stringify(view.toJSON())).toBe(defaultJson);
  });
});
