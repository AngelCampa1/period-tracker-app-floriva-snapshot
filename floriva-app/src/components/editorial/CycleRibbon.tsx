import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import {
  buildCyclePhaseBreakdown,
  buildCyclePhaseEndDays,
} from '@/src/lib/predictions/cyclePhaseModel';
import { formatCyclePhaseLabel, type CyclePhaseLabelKey } from '@/src/lib/predictions/presentation';
import type { SupportedLocale } from '@/src/types/domain';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type Phase = {
  key: CyclePhaseLabelKey;
  name: string;
  startDay: number;
  endDay: number;
  color: string;
};

function formatPhaseRange(startDay: number, endDay: number) {
  return `${startDay}-${endDay}`;
}

// UL-05/UL-81: a short cycle can legitimately clamp a phase to zero days
// (e.g. a 25-day cycle with a 6-day period leaves no follicular days before
// the fertile window -- see buildCyclePhaseBreakdown's waterfall). Rendering
// a zero-length phase produced the inverted legend ranges the ledger flags
// ("FOLLICULAR 7-6" beside "FERTILE 7-12"): startDay is prevEnd + 1, so a
// zero-width phase always reads "start > end". The designed treatment is to
// OMIT zero-length phases from both the bar and the legend -- the remaining
// ranges stay contiguous, and only phases that actually occur are claimed.
function toRenderablePhases(
  boundaries: { key: CyclePhaseLabelKey; endDay: number; color: string }[],
  locale: SupportedLocale,
): Phase[] {
  const phases: Phase[] = [];
  let prevEnd = 0;

  for (const boundary of boundaries) {
    if (boundary.endDay > prevEnd) {
      phases.push({
        key: boundary.key,
        name: formatCyclePhaseLabel(boundary.key, locale),
        startDay: prevEnd + 1,
        endDay: boundary.endDay,
        color: boundary.color,
      });
    }
    prevEnd = Math.max(prevEnd, boundary.endDay);
  }

  return phases;
}

function buildPhases(
  cycleLengthDays: number,
  periodLengthDays: number,
  theme: FlorivaTheme,
  showFertilityEstimates: boolean,
  fertileWindowStartOffsetDays: number | undefined,
  locale: SupportedLocale,
): Phase[] {
  // Derive boundaries from the shared phase model so the Today ribbon matches the
  // Insights phase-rhythm chart exactly (both anchor the fertile window the same way).
  // Passing the live prediction's offset (when the caller has one) keeps this in
  // agreement with Calendar/Insights even when the engine emits a
  // signal-confirmed window that differs from the plain calendar formula --
  // omitting it here would silently fall back to the default formula and can
  // disagree with the other two screens (see buildTodaySnapshot.ts).
  const breakdown = buildCyclePhaseBreakdown({
    cycleLengthDays,
    periodLengthDays,
    fertileWindowStartOffsetDays,
  });
  const rawEnds = buildCyclePhaseEndDays(breakdown);
  // Keep boundaries non-decreasing and within the cycle so very short cycles can
  // never produce a negative-width segment.
  const periodEnd = Math.min(rawEnds.periodEnd, cycleLengthDays);
  const follicularEnd = Math.min(Math.max(rawEnds.follicularEnd, periodEnd), cycleLengthDays);
  const fertileEnd = Math.min(Math.max(rawEnds.fertileEnd, follicularEnd), cycleLengthDays);
  const lutealEnd = cycleLengthDays;

  if (!showFertilityEstimates) {
    return toRenderablePhases(
      [
        { key: 'period', endDay: periodEnd, color: theme.colors.accentPrimary },
        { key: 'earlier-cycle', endDay: fertileEnd, color: theme.colors.accentSoft },
        { key: 'later-cycle', endDay: lutealEnd, color: theme.colors.mossSoft },
      ],
      locale,
    );
  }

  return toRenderablePhases(
    [
      { key: 'period', endDay: periodEnd, color: theme.colors.accentPrimary },
      { key: 'follicular', endDay: follicularEnd, color: theme.colors.accentSoft },
      { key: 'fertile', endDay: fertileEnd, color: theme.colors.moss },
      { key: 'luteal', endDay: lutealEnd, color: theme.colors.mossSoft },
    ],
    locale,
  );
}

type CycleRibbonProps = {
  cycleDay: number;
  cycleLengthDays: number;
  periodLengthDays?: number;
  showFertilityEstimates?: boolean;
  /**
   * Offset (in days from the cycle start) where the fertile window opens,
   * per the live prediction (see PredictionSnapshot.fertileWindowStartOffsetDays
   * / buildTodaySnapshot.ts). Optional so existing callers that don't have a
   * live snapshot handy keep falling back to buildCyclePhaseBreakdown's own
   * default formula, matching prior behavior exactly.
   */
  fertileWindowStartOffsetDays?: number;
  locale?: SupportedLocale;
  testID?: string;
};

export function CycleRibbon({
  cycleDay,
  cycleLengthDays,
  periodLengthDays = 5,
  showFertilityEstimates = true,
  fertileWindowStartOffsetDays,
  locale = 'en',
  testID,
}: CycleRibbonProps) {
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const phases = buildPhases(
    cycleLengthDays,
    periodLengthDays,
    theme,
    showFertilityEstimates,
    fertileWindowStartOffsetDays,
    locale,
  );
  const clampedDay = Math.min(Math.max(cycleDay, 1), cycleLengthDays);
  const markerPercent = (clampedDay / cycleLengthDays) * 100;

  return (
    <View testID={testID}>
      {/* Segmented bar */}
      <View style={styles.barRow}>
        {phases.map((phase) => {
          const widthPercent = ((phase.endDay - phase.startDay + 1) / cycleLengthDays) * 100;

          return (
            <View
              key={phase.key}
              style={[styles.segment, { width: `${widthPercent}%` as `${number}%`, backgroundColor: phase.color }]}
            />
          );
        })}
        <View
          style={[styles.dayMarker, { left: `${markerPercent}%` as `${number}%` }]}
          testID={testID ? `${testID}-day-marker` : 'ribbon-day-marker'}
        />
      </View>

      {/* Phase labels */}
      <View style={styles.labelRow} testID={testID ? `${testID}-phase-legend` : undefined}>
        {phases.map((phase) => {
          const rangeLabel = formatPhaseRange(phase.startDay, phase.endDay);
          const phaseTestID = testID ? `${testID}-phase-${phase.key}` : undefined;

          return (
            <View
              accessibilityLabel={`${phase.name}, days ${phase.startDay} to ${phase.endDay}`}
              key={phase.key}
              style={styles.phaseLegendItem}
              testID={phaseTestID}
            >
              <View style={[styles.phaseDot, { backgroundColor: phase.color }]} />
              <Text
                maxFontSizeMultiplier={1.5}
                numberOfLines={1}
                style={styles.phaseLabel}
                testID={phaseTestID ? `${phaseTestID}-label` : undefined}
              >
                {phase.name}
              </Text>
              <Text maxFontSizeMultiplier={1.5} style={styles.phaseDays}>
                {rangeLabel}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    barRow: {
      flexDirection: 'row',
      height: 10,
      borderRadius: theme.radii.pill,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.borderPrimary,
      position: 'relative',
    },
    segment: {
      height: '100%',
    },
    dayMarker: {
      position: 'absolute',
      top: -4,
      bottom: -4,
      width: 3,
      backgroundColor: theme.colors.textPrimary,
      borderRadius: theme.radii.hairline,
      marginLeft: -1.5,
    },
    labelRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: theme.spacing.md,
      rowGap: theme.spacing.xs,
      marginTop: theme.spacing.sm,
    },
    phaseLegendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      minHeight: 22,
      // UL-24: the free-wrapping legend row broke 3+1 on phone widths,
      // orphaning LUTEAL on its own line. A ~half-row basis pins the legend
      // to a steady 2x2 grid — deliberate columns instead of a ragged wrap.
      flexBasis: '46%',
      flexGrow: 1,
    },
    phaseDot: {
      width: 7,
      height: 7,
      borderRadius: theme.radii.pill,
    },
    phaseLabel: {
      color: theme.colors.textTertiary,
      ...theme.typography.eyebrow,
      fontSize: 8.5,
      flexShrink: 0,
    },
    phaseDays: {
      color: theme.colors.textSecondary,
      ...theme.typography.numeral,
      fontSize: 10,
      lineHeight: 14,
      marginTop: 2,
    },
  });
}
