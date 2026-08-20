import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type EditorialNumeralProps = {
  value: string | number;
  unit?: string;
  size?: number;
  testID?: string;
};

export function EditorialNumeral({
  value,
  unit,
  size = 64,
  testID,
}: EditorialNumeralProps) {
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme, size), [theme, size]);

  return (
    <View style={styles.row} testID={testID}>
      <Text
        allowFontScaling
        maxFontSizeMultiplier={1.4}
        style={styles.value}
      >
        {value}
      </Text>
      {unit ? <Text style={styles.unit}>{unit}</Text> : null}
    </View>
  );
}

function createStyles(theme: FlorivaTheme, size: number) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: theme.spacing.xs,
    },
    value: {
      ...theme.typography.numeral,
      fontSize: size,
      lineHeight: Math.ceil(size * 1.14),
      color: theme.colors.textPrimary,
      includeFontPadding: true,
    },
    unit: {
      ...theme.typography.eyebrow,
      color: theme.colors.textTertiary,
    },
  });
}
