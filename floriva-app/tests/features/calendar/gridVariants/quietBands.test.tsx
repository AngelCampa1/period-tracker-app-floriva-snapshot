import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

const mockTriggerPressFeedback = jest.fn();

jest.mock('@/src/features/feedback/InteractionFeedbackProvider', () => ({
  useOptionalInteractionFeedback: () => ({
    triggerPressFeedback: (...args: unknown[]) => mockTriggerPressFeedback(...args),
  }),
}));

// eslint-disable-next-line import/first
import Svg, { Path } from 'react-native-svg';

// eslint-disable-next-line import/first
import { CalendarMonthGrid } from '@/src/features/calendar/components/CalendarMonthGrid';
// eslint-disable-next-line import/first
import renderQuietBandsCell, {
  legend,
  renderBandLayers,
} from '@/src/features/calendar/components/gridVariants/quietBands';
// eslint-disable-next-line import/first
import {
  calendarDirectionFixtures,
  type CalendarDirectionFixtureName,
} from '@/src/testing/calendarDirectionFixture';
// eslint-disable-next-line import/first
import {
  buildCalendarBandPredictedSvgTestId,
  buildCalendarBandSegmentTestId,
  buildCalendarDayCellFrameTestId,
  buildCalendarDayCellTestId,
  buildCalendarQuietLoggedDotTestId,
  buildCalendarQuietSelectedRingTestId,
  buildCalendarQuietSpottingDotTestId,
  buildCalendarQuietTodayRingTestId,
} from '@/src/testing/testIds';
// eslint-disable-next-line import/first
import { resolveTheme } from '@/src/theme/tokens';
// eslint-disable-next-line import/first
import { expectAccessiblePressables } from '../../../helpers/expectAccessiblePressables';

const theme = resolveTheme('light');

// RNTL re-exports react-test-renderer's instance type only through its own
// query results (same trick as tests/helpers/expectAccessiblePressables).
type ReactTestInstance = ReturnType<typeof render>['UNSAFE_root'];

function periodBandId(date: string) {
  return buildCalendarBandSegmentTestId('period', date);
}

function predictedBandId(date: string) {
  return buildCalendarBandSegmentTestId('predicted', date);
}

function predictedSvgId(date: string) {
  return buildCalendarBandPredictedSvgTestId(date);
}

function fertileBandId(date: string) {
  return buildCalendarBandSegmentTestId('fertile', date);
}

function renderFixtureGrid(
  name: CalendarDirectionFixtureName,
  overrides: Partial<Parameters<typeof CalendarMonthGrid>[0]> = {},
) {
  const fixture = calendarDirectionFixtures[name];

  return render(
    <CalendarMonthGrid
      buildDayCellAccessibilityLabel={(date) => `Open ${date}`}
      dayCellAccessibilityHint="Opens the day detail"
      isCompactLayout={false}
      onSelectDate={jest.fn()}
      selectedDate={fixture.selectedDate}
      variant="quiet-bands"
      weekdayLabels={fixture.weekdayLabels}
      weeks={fixture.weeks}
      {...overrides}
    />,
  );
}

/** Fires the predicted band layer's onLayout so the measured Svg mounts. */
function layoutPredictedBand(date: string, width = 48) {
  fireEvent(screen.getByTestId(predictedBandId(date)), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width, height: 38 } },
  });
}

/** Props of the dashed Path inside one date's measured predicted Svg. */
function predictedPathProps(date: string) {
  return screen.getByTestId(predictedSvgId(date)).findAllByType(Path)[0]?.props;
}

describe('quietBands calendar grid variant', () => {
  beforeEach(() => {
    mockTriggerPressFeedback.mockReset();
  });

  it('draws one continuous period lozenge across the logged Jul 3-7 run and nowhere else', () => {
    renderFixtureGrid('standard');

    for (const date of ['2026-07-03', '2026-07-04', '2026-07-05', '2026-07-06', '2026-07-07']) {
      expect(screen.getByTestId(periodBandId(date))).toBeTruthy();
    }

    // Spotting day and plain days never carry a period band.
    expect(screen.queryByTestId(periodBandId('2026-07-10'))).toBeNull();
    expect(screen.queryByTestId(periodBandId('2026-07-22'))).toBeNull();
  });

  it('extends band segments into the row gap on run-continuing sides only', () => {
    renderFixtureGrid('standard');

    // Jul 5-7 read start/mid/end within their week row (Jul 5-11).
    const startStyle = StyleSheet.flatten(
      screen.getByTestId(periodBandId('2026-07-05')).props.style,
    );
    const midStyle = StyleSheet.flatten(
      screen.getByTestId(periodBandId('2026-07-06')).props.style,
    );
    const endStyle = StyleSheet.flatten(
      screen.getByTestId(periodBandId('2026-07-07')).props.style,
    );
    // Half the row gap plus a 0.5dp bleed so adjacent segments overlap
    // instead of abutting (Android pixel rounding leaves a seam otherwise).
    const joinBleed = theme.spacing.xs / 2 + 0.5;

    expect(startStyle.left).toBe(0);
    expect(startStyle.right).toBe(-joinBleed);
    expect(midStyle.left).toBe(-joinBleed);
    expect(midStyle.right).toBe(-joinBleed);
    expect(endStyle.left).toBe(-joinBleed);
    expect(endStyle.right).toBe(0);
  });

  it('renders the predicted Jul 24-28 run as dashed oxblood svg outlines per segment shape', () => {
    renderFixtureGrid('standard');

    for (const date of ['2026-07-24', '2026-07-25', '2026-07-26', '2026-07-27', '2026-07-28']) {
      expect(screen.getByTestId(predictedBandId(date))).toBeTruthy();
    }

    // The Svg mounts only after the layer measures its width.
    expect(screen.queryByTestId(predictedSvgId('2026-07-24'))).toBeNull();

    // Jul 24 is a 'start' (open right edge, one left arc cap); Jul 27 is a
    // 'mid' (two dashed rails, no arcs); Jul 25 is an 'end' (one right arc).
    layoutPredictedBand('2026-07-24');
    layoutPredictedBand('2026-07-25');
    layoutPredictedBand('2026-07-27');

    expect(screen.getByTestId(predictedSvgId('2026-07-24'))).toBeTruthy();
    const svgs = screen.UNSAFE_getAllByType(Svg);
    expect(svgs).toHaveLength(3);

    const startPath = predictedPathProps('2026-07-24');
    const endPath = predictedPathProps('2026-07-25');
    const midPath = predictedPathProps('2026-07-27');

    for (const path of [startPath, endPath, midPath]) {
      expect(path?.stroke).toBe(theme.colors.accentPrimary);
      expect(path?.strokeDasharray).toBe('4 3');
      expect(path?.strokeWidth).toBe(1.5);
      expect(path?.fill).toBe('none');
    }

    // Cap arcs on closed ends, none on the mid rails.
    expect(startPath?.d).toContain('A ');
    expect(endPath?.d).toContain('A ');
    expect(midPath?.d).not.toContain('A ');
    // The mid segment is two open horizontal subpaths (top + bottom rail).
    expect(midPath?.d.match(/M /g)).toHaveLength(2);
  });

  it('caps a one-cell predicted run on both ends (overlap fixture Jul 31 single)', () => {
    renderFixtureGrid('overlap');

    layoutPredictedBand('2026-07-31');

    const singlePath = predictedPathProps('2026-07-31');

    expect(singlePath).toBeTruthy();
    // A closed rounded lozenge: two arc caps and a closepath.
    expect(singlePath?.d.match(/A /g)).toHaveLength(2);
    expect(singlePath?.d).toContain('Z');
  });

  it('paints the fertile band beneath the predicted band on overlap days', () => {
    renderFixtureGrid('overlap');

    for (const date of ['2026-07-12', '2026-07-13', '2026-07-14']) {
      expect(screen.getByTestId(fertileBandId(date))).toBeTruthy();
      expect(screen.getByTestId(predictedBandId(date))).toBeTruthy();

      const frame = screen.getByTestId(buildCalendarDayCellFrameTestId(date));
      const bandIds = frame
        .findAll(
          (node: ReactTestInstance) =>
            node.props?.testID === fertileBandId(date) ||
            node.props?.testID === predictedBandId(date),
        )
        .map((node: ReactTestInstance) => node.props.testID as string);

      // Paint order is the z-order: fertile renders first, so predicted
      // (and its dashed outline) sits on top of the mossSoft lozenge.
      expect(bandIds.indexOf(fertileBandId(date))).toBeLessThan(
        bandIds.indexOf(predictedBandId(date)),
      );
    }
  });

  it('paints the fertile band beneath the logged period band where they overlap (standard Jul 5-7)', () => {
    renderFixtureGrid('standard');

    const frame = screen.getByTestId(buildCalendarDayCellFrameTestId('2026-07-06'));
    const bandIds = frame
      .findAll(
        (node: ReactTestInstance) =>
          node.props?.testID === fertileBandId('2026-07-06') ||
          node.props?.testID === periodBandId('2026-07-06'),
      )
      .map((node: ReactTestInstance) => node.props.testID as string);

    expect(bandIds.indexOf(fertileBandId('2026-07-06'))).toBeLessThan(
      bandIds.indexOf(periodBandId('2026-07-06')),
    );
  });

  it('rings today in oxblood outside bands and in ink inside the rose band, composing with selection', () => {
    renderFixtureGrid('standard');

    // Jul 22 (today) sits outside every band -> oxblood ring; Jul 9 is the
    // fixture selection -> soft-ink selected circle, no today ring.
    const todayRing = screen.getByTestId(buildCalendarQuietTodayRingTestId('2026-07-22'));
    expect(StyleSheet.flatten(todayRing.props.style).borderColor).toBe(
      theme.colors.accentPrimary,
    );
    expect(screen.getByTestId(buildCalendarQuietSelectedRingTestId('2026-07-09'))).toBeTruthy();
    expect(screen.queryByTestId(buildCalendarQuietSelectedRingTestId('2026-07-22'))).toBeNull();
    expect(screen.queryByTestId(buildCalendarQuietTodayRingTestId('2026-07-09'))).toBeNull();

    screen.unmount();
    renderFixtureGrid('todayInBand');

    // Jul 6 is today AND selected AND inside the rose period band: both
    // rings coexist (concentric) and the today ring flips to ink.
    const inBandTodayRing = screen.getByTestId(buildCalendarQuietTodayRingTestId('2026-07-06'));
    expect(StyleSheet.flatten(inBandTodayRing.props.style).borderColor).toBe(
      theme.colors.textPrimary,
    );
    expect(screen.getByTestId(buildCalendarQuietSelectedRingTestId('2026-07-06'))).toBeTruthy();
    expect(screen.getByTestId(periodBandId('2026-07-06'))).toBeTruthy();
  });

  it('shows the logged dot on period-band days and a hollow spotting dot with no band', () => {
    renderFixtureGrid('standard');

    expect(screen.getByTestId(buildCalendarQuietLoggedDotTestId('2026-07-03'))).toBeTruthy();
    expect(screen.getByTestId(buildCalendarQuietLoggedDotTestId('2026-07-07'))).toBeTruthy();
    // Predicted days carry no logged dot.
    expect(screen.queryByTestId(buildCalendarQuietLoggedDotTestId('2026-07-24'))).toBeNull();

    // Jul 10 spotting: hollow dot, no period/predicted band. (Its fertile
    // band comes from the Jul 5-10 fertile window, not from spotting.)
    const spottingDot = screen.getByTestId(buildCalendarQuietSpottingDotTestId('2026-07-10'));
    const spottingDotStyle = StyleSheet.flatten(spottingDot.props.style);
    expect(spottingDotStyle.backgroundColor).toBe('transparent');
    expect(spottingDotStyle.borderWidth).toBe(1);
    expect(screen.queryByTestId(buildCalendarQuietLoggedDotTestId('2026-07-10'))).toBeNull();
    expect(screen.queryByTestId(periodBandId('2026-07-10'))).toBeNull();
    expect(screen.queryByTestId(predictedBandId('2026-07-10'))).toBeNull();
  });

  it('renders the stale month with no predicted or fertile bands, keeping honest emptiness', () => {
    renderFixtureGrid('stale');

    expect(screen.queryAllByTestId(/^calendar-band-predicted-/)).toHaveLength(0);
    expect(screen.queryAllByTestId(/^calendar-band-fertile-/)).toHaveLength(0);
    // The stale fixture logs no July period days, so no period band either;
    // the lone spotting log keeps its dot and stays band-free.
    expect(screen.queryAllByTestId(/^calendar-band-period-/)).toHaveLength(0);
    expect(screen.getByTestId(buildCalendarQuietSpottingDotTestId('2026-07-10'))).toBeTruthy();
    expect(screen.getByTestId(buildCalendarDayCellTestId('2026-07-10'))).toBeTruthy();
  });

  it('mirrors the classic pressable and a11y contract on every in-month cell', () => {
    const onSelectDate = jest.fn();
    const view = renderFixtureGrid('standard', { onSelectDate });

    const selectedCell = screen.getByTestId(buildCalendarDayCellTestId('2026-07-09'));
    const unselectedCell = screen.getByTestId(buildCalendarDayCellTestId('2026-07-22'));

    expect(selectedCell.props.accessibilityState).toMatchObject({ selected: true });
    expect(unselectedCell.props.accessibilityState).toMatchObject({ selected: false });
    expect(selectedCell.props.accessibilityLabel).toBe('Open 2026-07-09');
    expect(selectedCell.props.accessibilityHint).toBe('Opens the day detail');

    fireEvent.press(screen.getByTestId(buildCalendarDayCellTestId('2026-07-03')));
    expect(onSelectDate).toHaveBeenCalledWith('2026-07-03');
    expect(mockTriggerPressFeedback).toHaveBeenCalledWith('action');

    // Out-of-month lead-in (Jun 28) is a blank frame with no pressable.
    expect(screen.getByTestId(buildCalendarDayCellFrameTestId('2026-06-28'))).toBeTruthy();
    expect(screen.queryByTestId(buildCalendarDayCellTestId('2026-06-28'))).toBeNull();

    expectAccessiblePressables(view.UNSAFE_root);
  });

  it('keeps band layers behind the day content in compact layouts too', () => {
    renderFixtureGrid('standard', { isCompactLayout: true });

    expect(screen.getByTestId(periodBandId('2026-07-06'))).toBeTruthy();

    const frame = screen.getByTestId(buildCalendarDayCellFrameTestId('2026-07-06'));
    expect(StyleSheet.flatten(frame.props.style).minHeight).toBe(44);
  });

  it('exposes renderBandLayers in isolation and skips out-of-month cells', () => {
    const fixture = calendarDirectionFixtures.standard;
    const cells = fixture.weeks.flat();
    const outOfMonthCell = cells.find((cell) => !cell.inMonth);
    const bandedCell = cells.find((cell) => cell.date === '2026-07-06');
    const context = {
      theme,
      isCompactLayout: false,
      selectedDate: fixture.selectedDate,
      onSelectDate: jest.fn(),
      dayCellAccessibilityHint: 'Opens the day detail',
      buildDayCellAccessibilityLabel: (date: string) => `Open ${date}`,
      renderClassicCell: () => null,
    };

    expect(outOfMonthCell).toBeTruthy();
    expect(bandedCell).toBeTruthy();
    expect(renderBandLayers(outOfMonthCell!, context)).toBeNull();

    render(<>{renderBandLayers(bandedCell!, context)}</>);
    expect(screen.getByTestId(periodBandId('2026-07-06'))).toBeTruthy();
    expect(screen.getByTestId(fertileBandId('2026-07-06'))).toBeTruthy();
  });

  it('locks the promoted testID builders to the rendered id strings (gallery sweep + Detox contract)', () => {
    // Phase 2c promoted the renderer's inline ids into src/testing/testIds.ts
    // builders; the RENDERED strings must never change.
    expect(buildCalendarBandSegmentTestId('period', '2026-07-03')).toBe(
      'calendar-band-period-2026-07-03',
    );
    expect(buildCalendarBandSegmentTestId('predicted', '2026-07-24')).toBe(
      'calendar-band-predicted-2026-07-24',
    );
    expect(buildCalendarBandSegmentTestId('fertile', '2026-07-05')).toBe(
      'calendar-band-fertile-2026-07-05',
    );
    expect(buildCalendarBandPredictedSvgTestId('2026-07-24')).toBe(
      'calendar-band-predicted-svg-2026-07-24',
    );
    expect(buildCalendarQuietTodayRingTestId('2026-07-22')).toBe(
      'calendar-quiet-today-ring-2026-07-22',
    );
    expect(buildCalendarQuietSelectedRingTestId('2026-07-09')).toBe(
      'calendar-quiet-selected-ring-2026-07-09',
    );
    expect(buildCalendarQuietLoggedDotTestId('2026-07-03')).toBe(
      'calendar-quiet-logged-dot-2026-07-03',
    );
    expect(buildCalendarQuietSpottingDotTestId('2026-07-10')).toBe(
      'calendar-quiet-spotting-dot-2026-07-10',
    );
  });

  it('exports the six-item legend (Period / Predicted / Fertile / Logged / Spotting / Selected)', () => {
    // UL-34/UL-41: the grid renders a hollow spotting dot, so the legend
    // must explain it — every marker the grid can draw has an entry.
    expect(legend.items.map((item) => item.key)).toEqual([
      'period',
      'predicted',
      'fertile',
      'logged',
      'spotting',
      'selected',
    ]);
    expect(legend.items).toHaveLength(6);
    expect(typeof renderQuietBandsCell).toBe('function');
  });
});
