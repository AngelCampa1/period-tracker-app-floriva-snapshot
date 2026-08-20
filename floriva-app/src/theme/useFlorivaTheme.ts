import { useMemo } from 'react';

import { useColorScheme } from '@/components/useColorScheme';

import { resolveTheme } from './tokens';

export function useFlorivaTheme() {
  const colorScheme = useColorScheme();

  return useMemo(() => resolveTheme(colorScheme), [colorScheme]);
}
