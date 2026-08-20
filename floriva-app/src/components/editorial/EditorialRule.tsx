import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type EditorialRuleProps = {
  mark?: string;
  testID?: string;
};

export function EditorialRule({ mark, testID }: EditorialRuleProps) {
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.line} />
      {mark ? <Text style={styles.mark}>{mark}</Text> : null}
      <View style={styles.line} />
    </View>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    line: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.borderPrimary,
    },
    mark: {
      ...theme.typography.eyebrow,
      fontSize: 10,
      color: theme.colors.textTertiary,
    },
  });
}
