import Colors from '@/constants/Colors';

import { useColorScheme } from '@/components/useColorScheme';
import { redactSensitiveFields } from '@/src/lib/diagnostics/redactSensitiveFields';
import { createDefaultAppShellState } from '@/src/features/app-shell/defaults';
import { testIds } from '@/src/testing/testIds';
import { resolveTheme } from '@/src/theme/tokens';

describe('import resolution sanity', () => {
  it('resolves app aliases from TypeScript and Jest', () => {
    expect(typeof useColorScheme).toBe('function');
    expect(Colors.light.background).toBe(resolveTheme('light').colors.background);
    expect(Colors.dark.tint).toBe(resolveTheme('dark').colors.accentPrimary);
    expect(createDefaultAppShellState().hasCompletedOnboarding).toBe(false);
    expect(redactSensitiveFields({ notes: 'private' })).toEqual({
      notes: '[REDACTED]',
    });
    expect(testIds.today.screen).toBe('today-screen');
  });
});
