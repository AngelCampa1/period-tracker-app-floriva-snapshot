import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type ConfidenceChipVariant = 'filled' | 'inline';

type ConfidenceChipProps = {
  accessibilityHint: string;
  accessibilityLabel: string;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /**
   * `'filled'` is a solid pill (warm espresso background, light text) --
   * the highest-contrast treatment, used where the chip is the primary
   * confidence readout on the screen (Today). Its fill is the
   * `textSecondary` espresso token, not the near-black `textPrimary` ink
   * that fought the warm editorial palette (UL-20). `'inline'` is a plain
   * label + glyph pair with no chip chrome, used where the chip sits
   * inside an already-framed summary card (Calendar, Insights) and
   * doesn't need its own visual boundary. Defaults to `'inline'` since
   * that is the more common of the two call sites.
   */
  variant?: ConfidenceChipVariant;
};

/**
 * Shared "confidence chip" Pressable: shows the current prediction
 * confidence label plus an info glyph, and opens the confidence info modal
 * on press. Extracted from three near-identical hand-rolled copies on
 * Today, Calendar, and Insights (cycle-pattern) that had drifted slightly
 * in glyph color and pressed-opacity -- this collapses them to one
 * implementation so future drift shows up as a single diff instead of
 * three.
 *
 * Callers still own building the `onPress` handler (each screen navigates
 * to a differently-scoped confidence info modal) and the localized
 * accessibility strings, since this primitive intentionally has no
 * dependency on `useLocalization` (see other `src/components/primitives`
 * components for the same convention).
 */
export function ConfidenceChip({
  accessibilityHint,
  accessibilityLabel,
  label,
  onPress,
  style,
  testID,
  variant = 'inline',
}: ConfidenceChipProps) {
  const theme = useFlorivaTheme();
  const styles = createStyles(theme);
  const isFilled = variant === 'filled';

  // Touch-target math (44x44pt minimum): the filled pill is ~32pt tall
  // (7pt vertical padding x2 + ~18pt caption line), so 6pt of vertical
  // hitSlop reaches 44pt. The inline pair is only ~22pt tall (one
  // bodyStrong line, no chrome), so it needs 11pt vertical; horizontal
  // slop guards short localized labels where label + glyph could come in
  // under 44pt wide.
  const hitSlop = isFilled
    ? { top: 6, bottom: 6 }
    : { top: 11, bottom: 11, left: 8, right: 8 };

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={hitSlop}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        isFilled ? styles.filled : null,
        pressed ? (isFilled ? styles.filledPressed : styles.inlinePressed) : null,
        style,
      ]}
      testID={testID}
    >
      <Text style={isFilled ? styles.filledLabel : styles.inlineLabel}>{label}</Text>
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={isFilled ? styles.filledGlyph : styles.inlineGlyph}
      >
        {'ⓘ'}
      </Text>
    </Pressable>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: theme.spacing.xs,
    },
    filled: {
      borderRadius: theme.radii.pill,
      paddingHorizontal: theme.spacing.md,
      paddingRight: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
      // UL-20: warm espresso, not near-black ink — the dark-fill prominence
      // without fighting the editorial palette. Promoted here from a Wave B
      // call-site override on Today so every filled chip is warm by default.
      backgroundColor: theme.colors.textSecondary,
    },
    filledPressed: {
      opacity: 0.82,
    },
    inlinePressed: {
      opacity: 0.72,
    },
    filledLabel: {
      color: theme.colors.background,
      ...theme.typography.caption,
    },
    filledGlyph: {
      color: theme.colors.background,
      ...theme.typography.caption,
      opacity: 0.8,
    },
    inlineLabel: {
      color: theme.colors.textPrimary,
      ...theme.typography.bodyStrong,
    },
    inlineGlyph: {
      color: theme.colors.textPrimary,
      ...theme.typography.caption,
      opacity: 0.7,
    },
  });
}
