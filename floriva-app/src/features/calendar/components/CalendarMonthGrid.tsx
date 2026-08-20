import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { MotionPressableSurface } from '@/src/components/primitives/MotionPressableSurface';
import { Text } from '@/src/components/primitives/Text';
import type { CalendarScreenModel } from '@/src/features/calendar/buildCalendarScreenModel';
import type {
  CalendarGridCellRenderContext,
  CalendarGridCellRenderer,
} from '@/src/features/calendar/components/gridVariants/gridVariantContract';
import renderQuietBandsCell from '@/src/features/calendar/components/gridVariants/quietBands';
import { MotionView } from '@/src/features/motion/MotionView';
import {
  buildCalendarDayCellFrameTestId,
  buildCalendarDayCellTestId,
  buildCalendarFertileDayMarkerTestId,
  buildCalendarPredictedDayMarkerTestId,
} from '@/src/testing/testIds';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

const compactCalendarCellMinHeight = 44;

export type CalendarMonthGridWeeks = CalendarScreenModel['weeks'];
export type CalendarMonthGridCell = CalendarMonthGridWeeks[number][number];

/**
 * The redesign seam: each variant owns how a single day cell renders inside
 * the shared grid shell (weekday header, per-week rows, per-ROW MotionView
 * stagger). 'classic' reproduces the pre-extraction CalendarScreen grid
 * byte-for-byte and lives in this file; the quiet-bands redesign variant lives
 * in ./gridVariants/ (one module per variant — see gridVariantContract.ts for
 * the module contract) and receives a CalendarGridCellRenderContext that
 * includes a pre-bound `renderClassicCell` for delegation/fallback.
 */
export type CalendarMonthGridVariant = 'classic' | 'quiet-bands';

export type CalendarMonthGridProps = {
  weeks: CalendarMonthGridWeeks;
  weekdayLabels: string[];
  selectedDate: string;
  /**
   * Compact-window layout flag (the screen derives it from window height so
   * the grid stays clear of the floating dock).
   */
  isCompactLayout: boolean;
  onSelectDate: (date: string) => void;
  /**
   * A11y strings are passed in (not resolved via useLocalization here) so the
   * grid stays a pure presentational component with no i18n/DB hooks.
   */
  dayCellAccessibilityHint: string;
  buildDayCellAccessibilityLabel: (date: string) => string;
  variant?: CalendarMonthGridVariant;
};

type CalendarMonthGridStyles = ReturnType<typeof createStyles>;

type CellRenderContext = {
  styles: CalendarMonthGridStyles;
  isCompactLayout: boolean;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  dayCellAccessibilityHint: string;
  buildDayCellAccessibilityLabel: (date: string) => string;
};

function renderClassicCell(cell: CalendarMonthGridCell, context: CellRenderContext): ReactNode {
  const {
    buildDayCellAccessibilityLabel,
    dayCellAccessibilityHint,
    isCompactLayout,
    onSelectDate,
    selectedDate,
    styles,
  } = context;

  if (!cell.inMonth) {
    return (
      <View
        style={[styles.cell, isCompactLayout && styles.cellCompact]}
        testID={buildCalendarDayCellFrameTestId(cell.date)}
      />
    );
  }

  return (
    <View
      style={[
        styles.cell,
        isCompactLayout && styles.cellCompact,
        // A logged/predicted marker keeps its own fill; "today"
        // then composes as a ring so both stay legible. Only an
        // otherwise-empty today cell uses the filled disc.
        cell.marker === 'none' && cell.isFertile && styles.cellFertile,
        cell.isToday && cell.marker === 'none' && styles.cellToday,
        cell.marker === 'spotting' && styles.cellSpotting,
        cell.marker === 'predicted-period' && styles.cellPredicted,
        cell.marker === 'period' && styles.cellPeriod,
        cell.isToday && cell.marker !== 'none' && styles.cellTodayRing,
      ]}
      testID={buildCalendarDayCellFrameTestId(cell.date)}
    >
      <MotionPressableSurface
        accessibilityHint={dayCellAccessibilityHint}
        accessibilityLabel={buildDayCellAccessibilityLabel(cell.date)}
        accessibilityState={{ selected: cell.date === selectedDate }}
        feedbackType="action"
        hitSlop={10}
        onPress={() => {
          onSelectDate(cell.date);
        }}
        pressedStyle={styles.cellHitTargetPressed}
        style={styles.cellHitTarget}
        testID={buildCalendarDayCellTestId(cell.date)}
      />
      <View pointerEvents="none" style={styles.cellContent}>
        <Text
          style={[
            styles.dayNumberText,
            cell.isToday && cell.marker === 'none' && styles.cellTextOnToday,
            cell.marker === 'period' && styles.cellTextOnAccent,
          ]}
        >
          {cell.dayNumber}
        </Text>
        {cell.marker === 'spotting' ? <View style={styles.loggedDot} /> : null}
        {cell.marker === 'period' ? <View style={styles.loggedDotOnAccent} /> : null}
        {cell.marker === 'predicted-period' ? (
          <View
            style={styles.predictedMarker}
            testID={buildCalendarPredictedDayMarkerTestId(cell.date)}
          />
        ) : null}
        {cell.isFertile && cell.marker !== 'period' ? (
          <View
            style={styles.fertileMarker}
            testID={buildCalendarFertileDayMarkerTestId(cell.date)}
          />
        ) : null}
      </View>
    </View>
  );
}

// Redesign variant renderers, one owned module each (see
// gridVariantContract.ts). Classic stays internal above: it renders through
// its private styles-based context, which the variant context wraps via the
// pre-bound `renderClassicCell` below.
const variantCellRenderers: Record<
  Exclude<CalendarMonthGridVariant, 'classic'>,
  CalendarGridCellRenderer
> = {
  'quiet-bands': renderQuietBandsCell,
};

export function CalendarMonthGrid({
  buildDayCellAccessibilityLabel,
  dayCellAccessibilityHint,
  isCompactLayout,
  onSelectDate,
  selectedDate,
  variant = 'classic',
  weekdayLabels,
  weeks,
}: CalendarMonthGridProps) {
  const theme = useFlorivaTheme();
  const styles = createStyles(theme);
  const cellRenderContext: CellRenderContext = {
    styles,
    isCompactLayout,
    selectedDate,
    onSelectDate,
    dayCellAccessibilityHint,
    buildDayCellAccessibilityLabel,
  };
  const renderClassic = (cell: CalendarMonthGridCell) =>
    renderClassicCell(cell, cellRenderContext);
  const variantContext: CalendarGridCellRenderContext = {
    theme,
    isCompactLayout,
    selectedDate,
    onSelectDate,
    dayCellAccessibilityHint,
    buildDayCellAccessibilityLabel,
    renderClassicCell: renderClassic,
  };
  const renderCell: (cell: CalendarMonthGridCell) => ReactNode =
    variant === 'classic'
      ? renderClassic
      : (cell) => variantCellRenderers[variant](cell, variantContext);

  return (
    <View style={styles.gridContainer}>
      <View style={styles.row}>
        {weekdayLabels.map((label, index) => (
          <View key={index} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{label}</Text>
          </View>
        ))}
      </View>

      {weeks.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((cell) => (
            <MotionView
              key={cell.date}
              preset="rowShift"
              // LT-17: stagger by WEEK ROW, not by cell. Cells remount on
              // every month flip (keys are ISO dates), and a per-cell
              // stagger (rowIndex * 7 + column, up to 41) with rowShift's
              // 50ms delayStep left the tail of the month invisible for
              // up to ~2.3s after each flip — the Phase 3 sweep captured
              // January 2026 with days 29-31 still at opacity 0. A
              // per-row stagger bounds the full reveal to ~430ms.
              sequenceIndex={rowIndex}
              style={styles.cellWrapper}
            >
              {renderCell(cell)}
            </MotionView>
          ))}
        </View>
      ))}
    </View>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    gridContainer: {
      backgroundColor: theme.colors.surfacePrimary,
      borderWidth: 1,
      borderColor: theme.colors.borderPrimary,
      borderRadius: theme.radii.lg,
      padding: 14,
    },
    row: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    weekdayCell: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.xs,
    },
    weekdayText: {
      color: theme.colors.textSecondary,
      ...theme.typography.caption,
    },
    cellWrapper: {
      flex: 1,
    },
    cell: {
      flex: 1,
      minHeight: 38,
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radii.pill,
    },
    cellCompact: {
      minHeight: compactCalendarCellMinHeight,
    },
    cellSpotting: {
      backgroundColor: theme.colors.surfaceSecondary,
    },
    cellPeriod: {
      backgroundColor: theme.colors.accentPrimary,
    },
    cellPredicted: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: theme.colors.accentPrimary,
    },
    cellToday: {
      backgroundColor: theme.colors.textPrimary,
    },
    cellTodayRing: {
      borderWidth: 2,
      borderColor: theme.colors.textPrimary,
    },
    cellFertile: {
      backgroundColor: theme.colors.moss,
    },
    cellHitTarget: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: theme.radii.pill,
      zIndex: 1,
    },
    cellHitTargetPressed: {
      backgroundColor: theme.colors.overlay,
    },
    cellContent: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      paddingVertical: theme.spacing.xs,
    },
    dayNumberText: {
      color: theme.colors.textPrimary,
      ...theme.typography.numeral,
      fontSize: 13,
      lineHeight: 17,
    },
    cellTextMuted: {
      color: theme.colors.textMuted,
    },
    cellTextOnAccent: {
      color: theme.colors.buttonPrimaryText,
    },
    cellTextOnToday: {
      color: theme.colors.surfacePrimary,
    },
    loggedDot: {
      width: 3,
      height: 3,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.textPrimary,
    },
    loggedDotOnAccent: {
      width: 3,
      height: 3,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.surfacePrimary,
    },
    predictedMarker: {
      width: 14,
      height: 4,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.accentSoft,
    },
    fertileMarker: {
      width: 4,
      height: 4,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.moss,
    },
  });
}
