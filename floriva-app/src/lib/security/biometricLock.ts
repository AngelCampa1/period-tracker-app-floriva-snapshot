import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

type BiometricAvailability =
  | {
      available: true;
      reason: 'available';
    }
  | {
      available: false;
      reason: 'hardware-unavailable' | 'not-enrolled';
    };

const BIOMETRIC_LOCK_SECRET_KEY = 'floriva.lock.secret';

export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();

  if (!hasHardware) {
    return {
      available: false,
      reason: 'hardware-unavailable',
    };
  }

  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  if (!isEnrolled) {
    return {
      available: false,
      reason: 'not-enrolled',
    };
  }

  return {
    available: true,
    reason: 'available',
  };
}

export async function armBiometricLock() {
  await SecureStore.setItemAsync(
    BIOMETRIC_LOCK_SECRET_KEY,
    `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    },
  );
}

export async function clearBiometricLock() {
  await SecureStore.deleteItemAsync(BIOMETRIC_LOCK_SECRET_KEY);
}

export async function isBiometricLockArmed() {
  try {
    const secret = await SecureStore.getItemAsync(BIOMETRIC_LOCK_SECRET_KEY);
    return typeof secret === 'string' && secret.length > 0;
  } catch {
    // Fail CLOSED: if the keychain cannot be read we cannot prove the lock is
    // disarmed, so we must not silently bypass it. The app shell only engages
    // the lock when the separate `biometricsEnabled` preference is also set, so
    // this only surfaces the lock screen for users who explicitly enabled it —
    // and unlocking uses LocalAuthentication (not SecureStore), so a keychain
    // failure cannot lock them out.
    return true;
  }
}

export async function authenticateBiometricUnlock(): Promise<
  | { success: true }
  | { success: false; error: string }
> {
  try {
    const availability = await getBiometricAvailability();

    if (!availability.available) {
      return {
        success: false as const,
        error: 'not_available' as const,
      };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Floriva',
      cancelLabel: 'Not now',
      disableDeviceFallback: false,
      fallbackLabel: 'Use device passcode',
    });

    // Normalize malformed / partial native responses — any result that is not
    // an object with success === true is treated as a failed authentication.
    if (result == null || typeof result !== 'object' || result.success !== true) {
      return {
        success: false as const,
        error: (result as { error?: string } | null)?.error ?? 'unknown',
      };
    }

    return { success: true as const };
  } catch {
    // Any thrown exception (native module crash, JS bridge error, LAError, etc.)
    // must fail closed — never leave the app unlocked.
    return {
      success: false as const,
      error: 'system_error' as const,
    };
  }
}
