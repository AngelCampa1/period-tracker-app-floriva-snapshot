import { Platform } from 'react-native';

import { getBiometricMethodsLabel } from '@/src/features/privacy/biometricMethodsLabel';

describe('getBiometricMethodsLabel', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  });

  function setPlatform(os: typeof Platform.OS) {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  }

  it('uses Apple brand names on iOS', () => {
    setPlatform('ios');

    expect(getBiometricMethodsLabel('en')).toBe('Face ID, fingerprint, or device passcode');
    expect(getBiometricMethodsLabel('es')).toContain('Face ID');
  });

  it('never surfaces Apple brand names on Android', () => {
    setPlatform('android');

    const en = getBiometricMethodsLabel('en');
    expect(en).toBe('fingerprint, face unlock, or device passcode');
    expect(en).not.toMatch(/Face ID|Touch ID/);

    expect(getBiometricMethodsLabel('es')).not.toMatch(/Face ID|Touch ID/);
    expect(getBiometricMethodsLabel('de')).not.toMatch(/Face ID|Touch ID/);
    expect(getBiometricMethodsLabel('fr')).not.toMatch(/Face ID|Touch ID/);
    expect(getBiometricMethodsLabel('ja')).not.toMatch(/Face ID|Touch ID/);
    expect(getBiometricMethodsLabel('zh-Hans')).not.toMatch(/Face ID|Touch ID/);
    expect(getBiometricMethodsLabel('pt')).not.toMatch(/Face ID|Touch ID/);
    expect(getBiometricMethodsLabel('ru')).not.toMatch(/Face ID|Touch ID/);
  });

  it('falls back to English for an unknown locale', () => {
    setPlatform('android');

    expect(getBiometricMethodsLabel('xx' as never)).toBe(
      'fingerprint, face unlock, or device passcode',
    );
  });
});
