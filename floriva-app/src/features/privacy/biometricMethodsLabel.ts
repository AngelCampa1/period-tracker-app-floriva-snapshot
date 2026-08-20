import { Platform } from 'react-native';

import type { SupportedLocale } from '@/src/types/domain';

// The biometric/credential methods a user can unlock with, as a self-contained
// noun phrase. On iOS we keep Apple brand names (Face ID); on Android - and any
// non-Apple platform - we never surface Apple brand names. The QA report flagged
// "Face ID" appearing on Android, which is incorrect and erodes trust.
//
// The iOS phrases are kept identical to the wording previously hard-coded in the
// privacy strings so iOS copy does not regress. The Android phrases drop the
// Apple brand while preserving the rest of each locale's wording.
const IOS_METHODS: Record<SupportedLocale, string> = {
  en: 'Face ID, fingerprint, or device passcode',
  es: 'Face ID, la huella o el código del dispositivo',
  de: 'Face ID, Fingerabdruck oder Gerätecode',
  fr: 'Face ID, l’empreinte ou le code de l’appareil',
  ja: 'Face ID、指紋、または端末のパスコード',
  'zh-Hans': 'Face ID、指纹或设备密码',
  pt: 'Face ID, a impressão digital ou o código do dispositivo',
  ru: 'Face ID, отпечаток или код устройства',
};

const ANDROID_METHODS: Record<SupportedLocale, string> = {
  en: 'fingerprint, face unlock, or device passcode',
  es: 'la huella, el desbloqueo facial o el código del dispositivo',
  de: 'Fingerabdruck, Gesichtsentsperrung oder Gerätecode',
  fr: 'l’empreinte, le déverrouillage facial ou le code de l’appareil',
  ja: '指紋、顔認証、または端末のパスコード',
  'zh-Hans': '指纹、面部解锁或设备密码',
  pt: 'a impressão digital, o desbloqueio facial ou o código do dispositivo',
  ru: 'отпечаток, разблокировка по лицу или код устройства',
};

/**
 * Platform- and locale-aware label for the biometric/credential methods a user
 * can unlock with. iOS surfaces Apple brand names; Android (and any non-Apple
 * platform) surfaces generic device-security wording so Floriva never claims a
 * capability the platform does not have.
 */
export function getBiometricMethodsLabel(locale: SupportedLocale): string {
  const table = Platform.OS === 'ios' ? IOS_METHODS : ANDROID_METHODS;
  return table[locale] ?? table.en;
}
