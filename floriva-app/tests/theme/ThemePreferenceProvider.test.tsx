import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import {
  ThemePreferenceProvider,
  useOptionalThemePreference,
  useThemePreference,
} from '@/src/theme/ThemePreferenceProvider';

function ThemePreferenceConsumer() {
  const { isHydrated } = useThemePreference();

  return <Text>hydrated:{String(isHydrated)}</Text>;
}

function OutsideThemePreferenceConsumer() {
  useThemePreference();

  return <Text>outside-provider</Text>;
}

function OptionalThemePreferenceConsumer() {
  const optionalThemePreference = useOptionalThemePreference();

  return <Text>optional:{String(optionalThemePreference)}</Text>;
}

describe('ThemePreferenceProvider', () => {
  it('is hydrated immediately now that no stored preference is read', () => {
    // Floriva is light-only: the provider no longer persists or hydrates a
    // theme preference, so the boot gate resolves synchronously.
    render(
      <ThemePreferenceProvider>
        <ThemePreferenceConsumer />
      </ThemePreferenceProvider>,
    );

    expect(screen.getByText('hydrated:true')).toBeTruthy();
  });

  it('throws when the hook is used outside the provider', () => {
    expect(() => render(<OutsideThemePreferenceConsumer />)).toThrow(
      'useThemePreference must be used within ThemePreferenceProvider',
    );
  });

  it('returns null from the optional hook when no provider is present', () => {
    render(<OptionalThemePreferenceConsumer />);

    expect(screen.getByText('optional:null')).toBeTruthy();
  });
});
