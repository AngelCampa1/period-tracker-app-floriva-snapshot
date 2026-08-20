describe('localizationNative', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.dontMock('expo-modules-core');
    jest.dontMock('expo-localization');
  });

  it('returns device locales when expo-localization is available', () => {
    const mockLocales = [
      {
        languageTag: 'es-MX',
        languageCode: 'es',
        regionCode: 'MX',
      },
    ];

    jest.isolateModules(() => {
      jest.doMock('expo-modules-core', () => ({
        requireOptionalNativeModule: () => ({}),
      }));
      jest.doMock('expo-localization', () => ({
        getLocales: () => mockLocales,
      }));

      const { getSystemLocales } = require('@/src/localization/localizationNative');

      expect(getSystemLocales()).toEqual(mockLocales);
    });
  });

  it('falls back to an empty locale list when expo-localization is unavailable', () => {
    jest.isolateModules(() => {
      jest.doMock('expo-modules-core', () => ({
        requireOptionalNativeModule: () => null,
      }));
      jest.doMock('expo-localization', () => {
        throw new Error("Cannot find native module 'ExpoLocalization'");
      });

      const { getSystemLocales } = require('@/src/localization/localizationNative');

      expect(getSystemLocales()).toEqual([]);
    });
  });
});
