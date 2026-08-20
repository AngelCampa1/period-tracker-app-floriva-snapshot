import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { italicSerifFamily } from '@/src/theme/tokens';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type ItalicTitleProps = {
  prefix: string;
  accent: string;
  suffix?: string;
  size?: 'display' | 'displayLg' | 'title';
};

export function ItalicTitle({ prefix, accent, suffix = '', size = 'display' }: ItalicTitleProps) {
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme, size), [theme, size]);

  return (
    <Text style={styles.title}>
      {prefix}
      <Text style={styles.accent}>{accent}</Text>
      {suffix}
    </Text>
  );
}

function createStyles(theme: FlorivaTheme, size: 'display' | 'displayLg' | 'title') {
  const base =
    size === 'displayLg'
      ? theme.typography.displayLg
      : size === 'title'
        ? theme.typography.title
        : theme.typography.display;

  return StyleSheet.create({
    title: {
      ...base,
      color: theme.colors.textPrimary,
    },
    accent: {
      ...base,
      color: theme.colors.accentPrimary,
      // UL-70: true italic face instead of the cross-platform-divergent
      // `fontStyle: 'italic'` (roman on iOS, faux-slant on Android).
      fontFamily: italicSerifFamily(base.fontFamily),
    },
  });
}
