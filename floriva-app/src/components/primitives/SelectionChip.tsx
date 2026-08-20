import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { MotionPressableSurface } from '@/src/components/primitives/MotionPressableSurface';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type SelectionChipProps = {
  disabled?: boolean;
  highlighted?: boolean;
  indicatorTestID?: string;
  label: string;
  onPress: () => void;
  reducedMotionEnabled?: boolean;
  selected?: boolean;
  selectionIndicator?: 'none' | 'dot' | 'check';
  size?: 'default' | 'tall';
  testID?: string;
};

export function SelectionChip({
  disabled = false,
  highlighted = false,
  indicatorTestID,
  label,
  onPress,
  reducedMotionEnabled,
  selected = false,
  selectionIndicator = 'none',
  size = 'default',
  testID,
}: SelectionChipProps) {
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const isCheckbox = selectionIndicator === 'check';

  return (
    <MotionPressableSurface
      accessibilityLabel={label}
      accessibilityRole={isCheckbox ? 'checkbox' : 'button'}
      accessibilityState={
        isCheckbox ? { disabled, checked: selected } : { disabled, selected }
      }
      disabled={disabled}
      feedbackType="selection"
      motionVariant="secondary"
      onPress={onPress}
      pressedStyle={styles.pressed}
      reducedMotionEnabled={reducedMotionEnabled}
      revealPreset="rowShift"
      style={[
        styles.base,
        size === 'tall' ? styles.tall : null,
        highlighted ? styles.highlighted : null,
        selected ? styles.selected : null,
        disabled ? styles.disabled : null,
      ]}
      testID={testID}
    >
      <View style={styles.content} testID={testID ? `${testID}-content` : undefined}>
        <Text style={[styles.label, selected ? styles.selectedLabel : null]}>{label}</Text>
        {selectionIndicator === 'dot' ? (
          <View
            style={[
              styles.indicatorSlot,
              selected ? styles.indicatorSelected : styles.indicatorInactive,
            ]}
            testID={selected ? indicatorTestID : undefined}
          >
            <View
              style={[
                styles.indicatorDot,
                !selected ? styles.indicatorDotHidden : null,
              ]}
            />
          </View>
        ) : null}
        {isCheckbox ? (
          <View
            style={[
              styles.checkboxSlot,
              selected ? styles.checkboxSlotSelected : null,
            ]}
            testID={indicatorTestID}
          >
            {selected ? (
              <Text
                accessibilityElementsHidden
                importantForAccessibility="no"
                maxFontSizeMultiplier={1.2}
                style={styles.checkboxGlyph}
              >
                ✓
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </MotionPressableSurface>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    base: {
      minHeight: 44,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.pill,
      borderWidth: 1,
      borderColor: theme.colors.chipBorder,
      backgroundColor: theme.colors.chipFill,
      justifyContent: 'center',
    },
    tall: {
      minHeight: 52,
    },
    highlighted: {
      borderColor: theme.colors.buttonGlassBorder,
      backgroundColor: theme.colors.buttonGlassFill,
    },
    selected: {
      borderColor: theme.colors.chipSelectedBorder,
      backgroundColor: theme.colors.chipSelectedFill,
    },
    disabled: {
      opacity: 0.55,
    },
    pressed: {
      opacity: 0.88,
    },
    content: {
      // UL-73/UL-64: no flexWrap here — with wrapping, the reserved
      // (invisible) indicator slot could break onto its own row, inflating
      // the chip and misaligning the label ("Heavy"/"Low"/"Sticky"/"Positive
      // test" riding high; "Libido changes" double-decking its checkbox).
      // The indicator keeps its seat inline; the label shrinks and wraps
      // internally as text if space ever runs out.
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
    },
    label: {
      flexShrink: 1,
      color: theme.colors.textPrimary,
      ...theme.typography.caption,
    },
    selectedLabel: {
      color: theme.colors.chipSelectedText,
    },
    indicatorSlot: {
      width: 18,
      height: 18,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    indicatorSelected: {
      backgroundColor: theme.colors.surfacePrimary,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
    },
    indicatorInactive: {
      opacity: 0,
    },
    indicatorDot: {
      width: 8,
      height: 8,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.accentPrimary,
    },
    indicatorDotHidden: {
      opacity: 0,
    },
    checkboxSlot: {
      width: 18,
      height: 18,
      borderRadius: theme.radii.sm,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxSlotSelected: {
      backgroundColor: theme.colors.accentPrimary,
      borderColor: theme.colors.accentPrimary,
    },
    checkboxGlyph: {
      color: theme.colors.surfacePrimary,
      fontSize: 12,
      lineHeight: 14,
      fontWeight: '700',
    },
  });
}
