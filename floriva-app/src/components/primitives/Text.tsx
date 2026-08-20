import { Text as NativeText, type TextProps as NativeTextProps } from 'react-native';

import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

export type TextProps = NativeTextProps;

/**
 * Canonical text primitive. Replaces the retired Expo-starter
 * `components/Themed` Text and applies exactly its effective defaults:
 * `theme.colors.textPrimary` plus `typography.body` (Inter Tight 400,
 * 16/23). Call sites override both via `style`, so this stays a thin
 * wrapper around react-native's Text with the Floriva baseline applied.
 */
export function Text({ style, ...otherProps }: TextProps) {
  const theme = useFlorivaTheme();

  return (
    <NativeText
      style={[{ color: theme.colors.textPrimary }, theme.typography.body, style]}
      {...otherProps}
    />
  );
}
