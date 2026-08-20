import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import {
  LocalizationContext,
  useLocalization,
} from '@/src/localization/localizationContext';

function LocalizationContextConsumer() {
  const localization = useLocalization();

  return <Text>resolved:{localization.resolvedLocale}</Text>;
}

describe('localizationContext', () => {
  it('returns the provided localization context value', () => {
    render(
      <LocalizationContext.Provider
        value={{
          isHydrated: true,
          localePreference: 'ja',
          resolvedLocale: 'ja',
          setLocalePreference: jest.fn().mockResolvedValue(undefined),
          t: (key) => key,
        }}
      >
        <LocalizationContextConsumer />
      </LocalizationContext.Provider>,
    );

    expect(screen.getByText('resolved:ja')).toBeTruthy();
  });

  it('throws when used outside LocalizationProvider', () => {
    expect(() => render(<LocalizationContextConsumer />)).toThrow(
      'useLocalization must be used within LocalizationProvider',
    );
  });
});
