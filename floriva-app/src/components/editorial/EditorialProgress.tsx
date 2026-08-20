import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type EditorialProgressProps = {
  total: number;
  current: number;
  testID?: string;
};

const ACTIVE_PIP_WIDTH = 22;
const PIP_WIDTH = 6;

export function EditorialProgress({ total, current, testID }: EditorialProgressProps) {
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const safeTotal = Math.max(total, 1);
  const safeCurrent = Math.min(Math.max(current, 0), safeTotal - 1);

  return (
    <View
      accessibilityLabel="Progress"
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: safeTotal, now: safeCurrent + 1 }}
      style={styles.row}
      testID={testID}
    >
      {Array.from({ length: safeTotal }).map((_, index) => (
        <View
          key={`pip-${index}`}
          style={[
            styles.pip,
            index === safeCurrent ? styles.pipActive : null,
            index <= safeCurrent ? styles.pipFilled : null,
          ]}
        />
      ))}
      <Text style={styles.counter}>
        {String(safeCurrent + 1).padStart(2, '0')} / {String(safeTotal).padStart(2, '0')}
      </Text>
    </View>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    pip: {
      width: PIP_WIDTH,
      height: 2,
      backgroundColor: theme.colors.borderPrimary,
    },
    pipFilled: {
      backgroundColor: theme.colors.accentPrimary,
    },
    pipActive: {
      width: ACTIVE_PIP_WIDTH,
    },
    counter: {
      ...theme.typography.numeral,
      color: theme.colors.textTertiary,
      fontSize: 11,
      lineHeight: 15,
      marginLeft: theme.spacing.sm,
    },
  });
}
