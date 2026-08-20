import {
  resolveDeviceLocale,
  resolveLocalePreference,
  resolveSupportedLocale,
} from '@/src/localization/locale';

const mockGetSystemLocales = jest.fn();

jest.mock('@/src/localization/localizationNative', () => ({
  getSystemLocales: () => mockGetSystemLocales(),
}));

describe('locale normalization', () => {
  beforeEach(() => {
    mockGetSystemLocales.mockReset();
  });

  it('normalizes mixed-case and underscore-separated locale tags', () => {
    expect(resolveSupportedLocale('pt_BR', 'PT')).toBe('pt');
    expect(resolveSupportedLocale('ZH-hans-CN', 'ZH')).toBe('zh-Hans');
  });

  it('falls back for traditional Chinese locale tags', () => {
    expect(resolveSupportedLocale('zh-Hant-TW', 'zh')).toBe('en');
  });

  it('resolves the device locale from the first supported system locale', () => {
    mockGetSystemLocales.mockReturnValue([
      {
        languageTag: 'es-MX',
        languageCode: 'es',
        regionCode: 'MX',
      },
    ]);

    expect(resolveDeviceLocale()).toBe('es');
  });

  it('resolves the system locale preference through device locale normalization', () => {
    mockGetSystemLocales.mockReturnValue([
      {
        languageTag: 'pt_BR',
        languageCode: 'PT',
        regionCode: 'BR',
      },
    ]);

    expect(resolveLocalePreference('system')).toBe('pt');
  });

  it('falls back to English when the locale cannot be matched at all', () => {
    expect(resolveSupportedLocale('xx-YY', 'xx')).toBe('en');
    expect(resolveSupportedLocale(undefined, undefined)).toBe('en');
  });

  it('returns a fully supported locale when the tag matches exactly', () => {
    expect(resolveSupportedLocale('fr', 'fr')).toBe('fr');
    expect(resolveSupportedLocale(undefined, 'zh')).toBe('zh-Hans');
    expect(resolveSupportedLocale(undefined, 'de')).toBe('de');
  });
});
