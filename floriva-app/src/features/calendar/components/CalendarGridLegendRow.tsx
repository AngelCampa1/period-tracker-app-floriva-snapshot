import { StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import type {
  CalendarGridLegend,
  CalendarGridLegendItem,
} from '@/src/features/calendar/components/gridVariants/gridVariantContract';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

export type CalendarGridLegendRowProps = {
  legend: CalendarGridLegend;
  /**
   * Localized label per item. Defaults to the legend's plain-English
   * `item.label`, which is acceptable only on dev-only surfaces (the
   * gallery); the real calendar screen must pass i18n'd labels.
   */
  getItemLabel?: (item: CalendarGridLegendItem) => string;
  /** Optional per-item swatch testID (e.g. the screen's selected swatch). */
  getSwatchTestId?: (item: CalendarGridLegendItem) => string | undefined;
  testID?: string;
};

/**
 * Shared legend row for the calendar grid variants: one swatch + label per
 * legend item, using the generic per-kind swatch treatment the dev gallery
 * established (a variant can still override via `item.renderSwatch`).
 * Rendered by both DevCalendarGalleryScreen and the real CalendarScreen so
 * the two never drift.
 */
export function CalendarGridLegendRow({
  legend,
  getItemLabel,
  getSwatchTestId,
  testID,
}: CalendarGridLegendRowProps) {
  const theme = useFlorivaTheme();
  const styles = createStyles(theme);
  const swatchStyles = createSwatchStyles(theme);

  return (
    <View style={styles.legendRow} testID={testID}>
      {legend.items.map((item) => (
        <View key={item.key} style={styles.legendItem}>
          {item.renderSwatch ? (
            item.renderSwatch(theme)
          ) : (
            <View style={swatchStyles[item.swatch]} testID={getSwatchTestId?.(item)} />
          )}
          <Text style={styles.legendLabel}>{getItemLabel?.(item) ?? item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    legendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: theme.spacing.lg,
      rowGap: theme.spacing.sm,
    },
    legendItem: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.xs + 2,
    },
    legendLabel: {
      color: theme.colors.textSecondary,
      ...theme.typography.caption,
    },
  });
}

// Generic per-kind swatches used when a variant does not draw its own via
// `renderSwatch` — intentionally approximate; the grid itself is the source
// of truth for each variant's real treatment.
function createSwatchStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    period: {
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radii.pill,
      height: 12,
      width: 22,
    },
    predicted: {
      borderColor: theme.colors.accentPrimary,
      borderRadius: theme.radii.pill,
      borderStyle: 'dashed',
      borderWidth: 1.25,
      height: 12,
      width: 22,
    },
    fertile: {
      backgroundColor: theme.colors.mossSoft,
      borderRadius: theme.radii.pill,
      height: 12,
      width: 22,
    },
    spotting: {
      borderColor: theme.colors.accentPrimary,
      borderRadius: theme.radii.pill,
      borderWidth: 1,
      height: 8,
      width: 8,
    },
    today: {
      backgroundColor: theme.colors.accentPrimary,
      borderRadius: theme.radii.pill,
      height: 12,
      width: 12,
    },
    logged: {
      backgroundColor: theme.colors.accentPrimary,
      borderRadius: theme.radii.pill,
      height: 6,
      width: 6,
    },
    selected: {
      borderColor: theme.colors.textPrimary,
      borderRadius: theme.radii.pill,
      borderWidth: 1,
      height: 14,
      width: 14,
    },
    peak: {
      borderColor: theme.colors.moss,
      borderRadius: theme.radii.pill,
      borderWidth: 1.5,
      height: 14,
      width: 14,
    },
  });
}
