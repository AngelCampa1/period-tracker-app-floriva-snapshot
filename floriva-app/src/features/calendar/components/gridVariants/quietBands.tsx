import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { MotionPressableSurface } from '@/src/components/primitives/MotionPressableSurface';
import { Text } from '@/src/components/primitives/Text';
import type { CalendarBandSegment } from '@/src/features/calendar/buildCalendarScreenModel';
import type {
  CalendarGridBandLayerRenderer,
  CalendarGridCell,
  CalendarGridCellRenderContext,
  CalendarGridCellRenderer,
  CalendarGridLegend,
} from '@/src/features/calendar/components/gridVariants/gridVariantContract';
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
import { withAlpha, type FlorivaTheme } from '@/src/theme/tokens';

/**
 * "Quiet Bands" calendar grid variant -- soft, calm, editorial.
 *
 * Design decisions (final, not stub):
 * - Period run (logged): one continuous pill lozenge in `accentSoft`
 *   (#E8D2CB rose), day numbers in dark ink ON the band, 3px oxblood
 *   logged dot under the numeral.
 * - Predicted run: same lozenge geometry, a 6% `accentPrimary` wash
 *   (withAlpha 0.06) plus a 1.5px DASHED oxblood outline drawn with
 *   react-native-svg (RN borderStyle:'dashed' + radius is unreliable on
 *   Android). 'start'/'end'/'single' draw a rounded path with the run-side
 *   edge left OPEN; 'mid' draws two dashed horizontal rails (top+bottom).
 *   Dash pattern "4 3", round linecaps.
 * - Fertile window: continuous `mossSoft` lozenge painted FIRST so period /
 *   predicted bands sit over it where they overlap. Z-order is pure paint
 *   order (fertile -> period -> predicted -> hit target -> content), no
 *   elevation.
 * - Band continuity: per-cell absolute layers; a 'mid' segment extends
 *   left AND right by half the grid's row gap (spacing.xs / 2), 'start'
 *   extends only right, 'end' only left, 'single' neither -- adjacent
 *   extensions meet mid-gap with no measurement. Rounded caps (pill) only
 *   on the open ends. Band height 36 (40 compact), vertically centered.
 * - Today: 1.5px oxblood ring around the numeral; when today sits INSIDE a
 *   rose period band the ring flips to ink for contrast.
 * - Selected: 1px soft-ink circle, 4px larger in diameter than the today
 *   ring, so today+selected compose as two concentric circles (soft ink
 *   outside, oxblood/ink inside) rather than a merged state.
 * - Spotting: smaller hollow dot (4px ring, soft ink), never banded.
 * - Out-of-month: blank spacer frame, exactly like classic. Stale months
 *   need no special casing: the model already nulls predicted/fertile
 *   bands while logged period bands survive.
 * - Numerals keep the classic mono treatment (typography.numeral 13/17).
 *
 * testID scheme (promoted to src/testing/testIds.ts builders in Phase 2c;
 * rendered strings unchanged):
 * - calendar-band-period-<date> / calendar-band-predicted-<date> /
 *   calendar-band-fertile-<date> on each band layer
 *   (buildCalendarBandSegmentTestId);
 * - calendar-band-predicted-svg-<date> on the dashed Svg (mounted after
 *   the layer's onLayout measures a width);
 * - calendar-quiet-today-ring-<date> / calendar-quiet-selected-ring-<date>;
 * - calendar-quiet-logged-dot-<date> / calendar-quiet-spotting-dot-<date>.
 * Frame + pressable reuse the shared testIds builders so grid-level tests
 * keep working across variants.
 */
const BAND_HEIGHT = 36;
const BAND_HEIGHT_COMPACT = 40;
const PREDICTED_STROKE_WIDTH = 1.5;
const PREDICTED_DASH_ARRAY = '4 3';
const PREDICTED_WASH_ALPHA = 0.06;

type QuietBandsStyles = ReturnType<typeof createStyles>;

let cachedTheme: FlorivaTheme | null = null;
let cachedStyles: QuietBandsStyles | null = null;

function getStyles(theme: FlorivaTheme): QuietBandsStyles {
  if (cachedStyles === null || cachedTheme !== theme) {
    cachedTheme = theme;
    cachedStyles = createStyles(theme);
  }

  return cachedStyles;
}

function segmentLayerStyle(styles: QuietBandsStyles, segment: CalendarBandSegment) {
  switch (segment) {
    case 'start':
      return styles.bandLayerStart;
    case 'mid':
      return styles.bandLayerMid;
    case 'end':
      return styles.bandLayerEnd;
    case 'single':
      return styles.bandLayerSingle;
  }
}

function segmentCapStyle(styles: QuietBandsStyles, segment: CalendarBandSegment) {
  switch (segment) {
    case 'start':
      return styles.bandCapsStart;
    case 'end':
      return styles.bandCapsEnd;
    case 'single':
      return styles.bandCapsSingle;
    case 'mid':
      return null;
  }
}

/**
 * Path for the dashed predicted outline. The stroke is inset by half its
 * width so it never clips at the Svg edge; caps are true semicircles
 * (r = (h - stroke) / 2). Open edges (the side a run continues through)
 * simply are not drawn, so dashes flow visually into the neighbor cell's
 * segment across the extended mid-gap overlap.
 */
function buildPredictedPath(segment: CalendarBandSegment, width: number, height: number): string {
  const inset = PREDICTED_STROKE_WIDTH / 2;
  const r = (height - PREDICTED_STROKE_WIDTH) / 2;
  const top = inset;
  const bottom = height - inset;

  switch (segment) {
    case 'single':
      return (
        `M ${inset + r} ${top} H ${width - inset - r} ` +
        `A ${r} ${r} 0 0 1 ${width - inset - r} ${bottom} ` +
        `H ${inset + r} A ${r} ${r} 0 0 1 ${inset + r} ${top} Z`
      );
    case 'start':
      return (
        `M ${width} ${top} H ${inset + r} ` +
        `A ${r} ${r} 0 0 0 ${inset + r} ${bottom} H ${width}`
      );
    case 'end':
      return (
        `M 0 ${top} H ${width - inset - r} ` +
        `A ${r} ${r} 0 0 1 ${width - inset - r} ${bottom} H 0`
      );
    case 'mid':
      return `M 0 ${top} H ${width} M 0 ${bottom} H ${width}`;
  }
}

type PredictedBandSegmentProps = {
  date: string;
  segment: CalendarBandSegment;
  bandHeight: number;
  styles: QuietBandsStyles;
  theme: FlorivaTheme;
};

/**
 * The dashed segment needs its rendered width for the Svg path, so it is a
 * small component that measures itself via onLayout. Until the first layout
 * pass the 6% wash still paints, so there is no empty flash.
 */
function PredictedBandSegment({ date, segment, bandHeight, styles, theme }: PredictedBandSegmentProps) {
  const [measuredWidth, setMeasuredWidth] = useState(0);

  const handleLayout = (event: LayoutChangeEvent) => {
    setMeasuredWidth(event.nativeEvent.layout.width);
  };

  return (
    <View
      onLayout={handleLayout}
      pointerEvents="none"
      style={[styles.bandLayer, segmentLayerStyle(styles, segment)]}
      testID={buildCalendarBandSegmentTestId('predicted', date)}
    >
      <View style={{ height: bandHeight }}>
        <View style={[styles.predictedWash, segmentCapStyle(styles, segment)]} />
        {measuredWidth > 0 ? (
          <Svg
            height={bandHeight}
            testID={buildCalendarBandPredictedSvgTestId(date)}
            width={measuredWidth}
          >
            <Path
              d={buildPredictedPath(segment, measuredWidth, bandHeight)}
              fill="none"
              stroke={theme.colors.accentPrimary}
              strokeDasharray={PREDICTED_DASH_ARRAY}
              strokeLinecap="round"
              strokeWidth={PREDICTED_STROKE_WIDTH}
            />
          </Svg>
        ) : null}
      </View>
    </View>
  );
}

function renderSolidBand(
  kind: 'period' | 'fertile',
  cell: CalendarGridCell,
  segment: CalendarBandSegment,
  bandHeight: number,
  styles: QuietBandsStyles,
) {
  return (
    <View
      pointerEvents="none"
      style={[styles.bandLayer, segmentLayerStyle(styles, segment)]}
      testID={buildCalendarBandSegmentTestId(kind, cell.date)}
    >
      <View
        style={[
          { height: bandHeight },
          kind === 'period' ? styles.bandFillPeriod : styles.bandFillFertile,
          segmentCapStyle(styles, segment),
        ]}
      />
    </View>
  );
}

/**
 * Band visuals for one cell, exported separately per the contract so the
 * layer is testable in isolation. Paint order (fertile beneath period /
 * predicted) is the z-order -- no elevation, no zIndex.
 */
export const renderBandLayers: CalendarGridBandLayerRenderer = (cell, context) => {
  const { isCompactLayout, theme } = context;

  if (!cell.inMonth) {
    return null;
  }

  const styles = getStyles(theme);
  const bandHeight = isCompactLayout ? BAND_HEIGHT_COMPACT : BAND_HEIGHT;

  return (
    <>
      {cell.fertileBand !== null
        ? renderSolidBand('fertile', cell, cell.fertileBand, bandHeight, styles)
        : null}
      {cell.periodBand !== null
        ? renderSolidBand('period', cell, cell.periodBand, bandHeight, styles)
        : null}
      {cell.predictedBand !== null ? (
        <PredictedBandSegment
          bandHeight={bandHeight}
          date={cell.date}
          segment={cell.predictedBand}
          styles={styles}
          theme={theme}
        />
      ) : null}
    </>
  );
};

const renderQuietBandsCell: CalendarGridCellRenderer = (
  cell: CalendarGridCell,
  context: CalendarGridCellRenderContext,
) => {
  const {
    buildDayCellAccessibilityLabel,
    dayCellAccessibilityHint,
    isCompactLayout,
    onSelectDate,
    selectedDate,
    theme,
  } = context;
  const styles = getStyles(theme);

  if (!cell.inMonth) {
    return (
      <View
        style={[styles.cell, isCompactLayout && styles.cellCompact]}
        testID={buildCalendarDayCellFrameTestId(cell.date)}
      />
    );
  }

  const isSelected = cell.date === selectedDate;
  const todayInsideRoseBand = cell.isToday && cell.periodBand !== null;

  return (
    <View
      style={[styles.cell, isCompactLayout && styles.cellCompact]}
      testID={buildCalendarDayCellFrameTestId(cell.date)}
    >
      {renderBandLayers(cell, context)}
      <MotionPressableSurface
        accessibilityHint={dayCellAccessibilityHint}
        accessibilityLabel={buildDayCellAccessibilityLabel(cell.date)}
        accessibilityState={{ selected: isSelected }}
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
        <View style={styles.numberWrap}>
          {isSelected ? (
            <View
              style={styles.selectedRing}
              testID={buildCalendarQuietSelectedRingTestId(cell.date)}
            />
          ) : null}
          {cell.isToday ? (
            <View
              style={[styles.todayRing, todayInsideRoseBand && styles.todayRingInk]}
              testID={buildCalendarQuietTodayRingTestId(cell.date)}
            />
          ) : null}
          <Text style={styles.dayNumberText}>{cell.dayNumber}</Text>
        </View>
        {cell.marker === 'period' ? (
          <View style={styles.loggedDot} testID={buildCalendarQuietLoggedDotTestId(cell.date)} />
        ) : null}
        {cell.marker === 'spotting' ? (
          <View
            style={styles.spottingDot}
            testID={buildCalendarQuietSpottingDotTestId(cell.date)}
          />
        ) : null}
      </View>
    </View>
  );
};

export const legend: CalendarGridLegend = {
  items: [
    { key: 'period', label: 'Period', swatch: 'period' },
    { key: 'predicted', label: 'Predicted', swatch: 'predicted' },
    { key: 'fertile', label: 'Fertile window', swatch: 'fertile' },
    { key: 'logged', label: 'Logged', swatch: 'logged' },
    // UL-34/UL-41: the grid draws a hollow spotting dot
    // (calendar-quiet-spotting-dot-*), so the legend explains it — no
    // marker the grid can render is left undecodable.
    { key: 'spotting', label: 'Spotting', swatch: 'spotting' },
    { key: 'selected', label: 'Selected', swatch: 'selected' },
  ],
};

function createStyles(theme: FlorivaTheme) {
  const halfRowGap = theme.spacing.xs / 2;
  // Run-continuing edges reach half a dp PAST the gap midpoint so adjacent
  // segments overlap instead of abutting — Android's pixel rounding
  // otherwise leaves a hairline seam between cells. Overlapping identical
  // opaque fills is invisible on both platforms.
  const joinBleed = halfRowGap + 0.5;

  return StyleSheet.create({
    cell: {
      flex: 1,
      minHeight: 38,
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
      // Bands intentionally bleed half the row gap past the cell edge on
      // run-continuing sides; Android clips children by default.
      overflow: 'visible',
    },
    cellCompact: {
      minHeight: 44,
    },
    bandLayer: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      justifyContent: 'center',
      overflow: 'visible',
    },
    bandLayerStart: {
      left: 0,
      right: -joinBleed,
    },
    bandLayerMid: {
      left: -joinBleed,
      right: -joinBleed,
    },
    bandLayerEnd: {
      left: -joinBleed,
      right: 0,
    },
    bandLayerSingle: {
      left: 0,
      right: 0,
    },
    bandCapsStart: {
      borderTopLeftRadius: theme.radii.pill,
      borderBottomLeftRadius: theme.radii.pill,
    },
    bandCapsEnd: {
      borderTopRightRadius: theme.radii.pill,
      borderBottomRightRadius: theme.radii.pill,
    },
    bandCapsSingle: {
      borderRadius: theme.radii.pill,
    },
    bandFillPeriod: {
      backgroundColor: theme.colors.accentSoft,
    },
    bandFillFertile: {
      backgroundColor: theme.colors.mossSoft,
    },
    predictedWash: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: withAlpha(theme.colors.accentPrimary, PREDICTED_WASH_ALPHA),
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
      paddingVertical: 2,
    },
    numberWrap: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectedRing: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: theme.radii.pill,
      borderWidth: 1,
      borderColor: theme.colors.textSecondary,
    },
    todayRing: {
      position: 'absolute',
      top: 2,
      left: 2,
      right: 2,
      bottom: 2,
      borderRadius: theme.radii.pill,
      borderWidth: 1.5,
      borderColor: theme.colors.accentPrimary,
    },
    todayRingInk: {
      borderColor: theme.colors.textPrimary,
    },
    dayNumberText: {
      color: theme.colors.textPrimary,
      ...theme.typography.numeral,
      fontSize: 13,
      lineHeight: 17,
    },
    loggedDot: {
      width: 3,
      height: 3,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.accentPrimary,
    },
    spottingDot: {
      width: 4,
      height: 4,
      borderRadius: theme.radii.pill,
      borderWidth: 1,
      borderColor: theme.colors.textSecondary,
      backgroundColor: 'transparent',
    },
  });
}

export default renderQuietBandsCell;
