const mockHasHardwareAsync = jest.fn();
const mockIsEnrolledAsync = jest.fn();
const mockAuthenticateAsync = jest.fn();
const mockSetItemAsync = jest.fn();
const mockGetItemAsync = jest.fn();
const mockDeleteItemAsync = jest.fn();

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: () => mockHasHardwareAsync(),
  isEnrolledAsync: () => mockIsEnrolledAsync(),
  authenticateAsync: (...args: unknown[]) => mockAuthenticateAsync(...args),
}));

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  setItemAsync: (...args: unknown[]) => mockSetItemAsync(...args),
  getItemAsync: (...args: unknown[]) => mockGetItemAsync(...args),
  deleteItemAsync: (...args: unknown[]) => mockDeleteItemAsync(...args),
}));

// eslint-disable-next-line import/first
import {
  armBiometricLock,
  authenticateBiometricUnlock,
  clearBiometricLock,
  getBiometricAvailability,
  isBiometricLockArmed,
} from '@/src/lib/security/biometricLock';

describe('biometricLock', () => {
  beforeEach(() => {
    mockHasHardwareAsync.mockReset();
    mockIsEnrolledAsync.mockReset();
    mockAuthenticateAsync.mockReset();
    mockSetItemAsync.mockReset();
    mockGetItemAsync.mockReset();
    mockDeleteItemAsync.mockReset();
  });

  it('reports unavailable when the device has no enrolled biometric unlock', async () => {
    mockHasHardwareAsync.mockResolvedValue(true);
    mockIsEnrolledAsync.mockResolvedValue(false);

    await expect(getBiometricAvailability()).resolves.toEqual({
      available: false,
      reason: 'not-enrolled',
    });
  });

  it('arms and clears the secure lock marker outside sqlite', async () => {
    mockGetItemAsync.mockResolvedValueOnce('armed-lock').mockResolvedValueOnce(null);

    await armBiometricLock();
    await expect(isBiometricLockArmed()).resolves.toBe(true);

    await clearBiometricLock();
    await expect(isBiometricLockArmed()).resolves.toBe(false);

    expect(mockSetItemAsync).toHaveBeenCalledWith(
      'floriva.lock.secret',
      expect.any(String),
      expect.objectContaining({
        keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
      }),
    );
    expect(mockDeleteItemAsync).toHaveBeenCalledWith('floriva.lock.secret');
  });

  it('fails closed (treats lock as armed) when the SecureStore read throws', async () => {
    // A keychain read failure must not silently bypass the lock. Unlocking uses
    // LocalAuthentication rather than SecureStore, so failing closed cannot lock
    // the user out, and the app shell only engages the lock when biometrics are
    // also enabled in preferences.
    mockGetItemAsync.mockRejectedValue(new Error('A required entitlement is not present.'));

    await expect(isBiometricLockArmed()).resolves.toBe(true);
  });

  it('does not attempt authentication when biometrics are unavailable', async () => {
    mockHasHardwareAsync.mockResolvedValue(false);
    mockIsEnrolledAsync.mockResolvedValue(false);

    await expect(authenticateBiometricUnlock()).resolves.toEqual({
      success: false,
      error: 'not_available',
    });
    expect(mockAuthenticateAsync).not.toHaveBeenCalled();
  });

  it('authenticates with device fallback when biometrics are available', async () => {
    mockHasHardwareAsync.mockResolvedValue(true);
    mockIsEnrolledAsync.mockResolvedValue(true);
    mockAuthenticateAsync.mockResolvedValue({ success: true });

    await expect(authenticateBiometricUnlock()).resolves.toEqual({ success: true });
    expect(mockAuthenticateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        promptMessage: 'Unlock Floriva',
        disableDeviceFallback: false,
      }),
    );
  });
});
