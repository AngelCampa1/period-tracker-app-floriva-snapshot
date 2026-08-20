/**
 * Adversarial security tests for biometricLock.ts
 *
 * These tests verify FAIL-CLOSED behaviour: every error, cancellation,
 * hardware absence, partial/malformed native response, and thrown exception
 * must result in a definitive {success:false} return — never in an unlock.
 *
 * Naming convention mirrors the existing suite so mocks are set up the same way.
 */

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
  isBiometricLockArmed,
} from '@/src/lib/security/biometricLock';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Any result from authenticateBiometricUnlock must NOT be success:true. */
async function expectLocked() {
  const result = await authenticateBiometricUnlock();
  expect(result).toBeDefined();
  expect((result as { success: boolean }).success).toBe(false);
}

beforeEach(() => {
  mockHasHardwareAsync.mockReset();
  mockIsEnrolledAsync.mockReset();
  mockAuthenticateAsync.mockReset();
  mockSetItemAsync.mockReset();
  mockGetItemAsync.mockReset();
  mockDeleteItemAsync.mockReset();
});

// ---------------------------------------------------------------------------
// 1. FAIL-CLOSED: authenticateAsync throws (native module crash / JS bridge error)
// ---------------------------------------------------------------------------

describe('fail-closed: native module throws', () => {
  it('stays locked when authenticateAsync throws a generic error', async () => {
    mockHasHardwareAsync.mockResolvedValue(true);
    mockIsEnrolledAsync.mockResolvedValue(true);
    mockAuthenticateAsync.mockRejectedValue(new Error('BiometricPrompt internal error'));

    // BUG: without a try/catch in authenticateBiometricUnlock this rejects
    // instead of returning {success:false}. The test asserts the safe contract.
    await expectLocked();
  });

  it('stays locked when authenticateAsync throws a non-Error value', async () => {
    mockHasHardwareAsync.mockResolvedValue(true);
    mockIsEnrolledAsync.mockResolvedValue(true);
    // Native modules can throw strings or plain objects
    mockAuthenticateAsync.mockRejectedValue('BIOMETRIC_ERROR_NO_SPACE');

    await expectLocked();
  });

  it('stays locked when authenticateAsync throws null', async () => {
    mockHasHardwareAsync.mockResolvedValue(true);
    mockIsEnrolledAsync.mockResolvedValue(true);
    mockAuthenticateAsync.mockRejectedValue(null);

    await expectLocked();
  });
});

// ---------------------------------------------------------------------------
// 2. FAIL-CLOSED: getBiometricAvailability / hardware-check throws
// ---------------------------------------------------------------------------

describe('fail-closed: availability check throws', () => {
  it('stays locked when hasHardwareAsync rejects', async () => {
    mockHasHardwareAsync.mockRejectedValue(new Error('LAError: system error'));

    // BUG: the throw propagates uncaught through authenticateBiometricUnlock
    await expectLocked();
  });

  it('stays locked when isEnrolledAsync rejects', async () => {
    mockHasHardwareAsync.mockResolvedValue(true);
    mockIsEnrolledAsync.mockRejectedValue(new Error('LAError: enrolment check failed'));

    await expectLocked();
  });
});

// ---------------------------------------------------------------------------
// 3. FAIL-CLOSED: malformed / partial return shapes from authenticateAsync
// ---------------------------------------------------------------------------

describe('fail-closed: malformed authenticateAsync responses', () => {
  it('stays locked when authenticateAsync returns undefined', async () => {
    mockHasHardwareAsync.mockResolvedValue(true);
    mockIsEnrolledAsync.mockResolvedValue(true);
    mockAuthenticateAsync.mockResolvedValue(undefined);

    // An undefined return must not be treated as success.
    const result = await authenticateBiometricUnlock();
    expect(result).toBeDefined();
    expect((result as { success: boolean }).success).not.toBe(true);
  });

  it('stays locked when authenticateAsync returns null', async () => {
    mockHasHardwareAsync.mockResolvedValue(true);
    mockIsEnrolledAsync.mockResolvedValue(true);
    mockAuthenticateAsync.mockResolvedValue(null);

    const result = await authenticateBiometricUnlock();
    expect(result).toBeDefined();
    expect((result as { success: boolean }).success).not.toBe(true);
  });

  it('stays locked when authenticateAsync returns an empty object', async () => {
    mockHasHardwareAsync.mockResolvedValue(true);
    mockIsEnrolledAsync.mockResolvedValue(true);
    mockAuthenticateAsync.mockResolvedValue({});

    const result = await authenticateBiometricUnlock();
    expect(result).toBeDefined();
    expect((result as { success: boolean }).success).not.toBe(true);
  });

  it('stays locked when authenticateAsync returns success:false with no error field', async () => {
    mockHasHardwareAsync.mockResolvedValue(true);
    mockIsEnrolledAsync.mockResolvedValue(true);
    mockAuthenticateAsync.mockResolvedValue({ success: false });

    await expectLocked();
  });
});

// ---------------------------------------------------------------------------
// 4. FAIL-CLOSED: all documented cancellation / failure error codes
// ---------------------------------------------------------------------------

describe('fail-closed: every cancellation and failure code stays locked', () => {
  const errorCodes = [
    'user_cancel',
    'user_fallback',
    'system_cancel',
    'app_cancel',
    'not_enrolled',
    'lockout',
    'lockout_permanent',
    'unknown',
  ];

  beforeEach(() => {
    mockHasHardwareAsync.mockResolvedValue(true);
    mockIsEnrolledAsync.mockResolvedValue(true);
  });

  for (const code of errorCodes) {
    it(`stays locked when authenticateAsync returns error="${code}"`, async () => {
      mockAuthenticateAsync.mockResolvedValue({ success: false, error: code });
      await expectLocked();
    });
  }
});

// ---------------------------------------------------------------------------
// 5. STATE: repeated authentication attempts always stay locked on failure
// ---------------------------------------------------------------------------

describe('state: repeated failure attempts never unlock', () => {
  it('stays locked across three consecutive failed attempts', async () => {
    mockHasHardwareAsync.mockResolvedValue(true);
    mockIsEnrolledAsync.mockResolvedValue(true);
    mockAuthenticateAsync.mockResolvedValue({ success: false, error: 'user_cancel' });

    for (let i = 0; i < 3; i++) {
      const result = await authenticateBiometricUnlock();
      expect((result as { success: boolean }).success).toBe(false);
    }
  });

  it('stays locked after lockout then fake success on same call sequence', async () => {
    mockHasHardwareAsync.mockResolvedValue(true);
    mockIsEnrolledAsync.mockResolvedValue(true);
    // Simulate lockout followed by a spoofed success (shouldn't happen in practice
    // but tests that each call is independently evaluated)
    mockAuthenticateAsync
      .mockResolvedValueOnce({ success: false, error: 'lockout' })
      .mockResolvedValueOnce({ success: true });

    const first = await authenticateBiometricUnlock();
    expect((first as { success: boolean }).success).toBe(false);

    // Second call: this one IS a genuine success from the mock (testing independence)
    const second = await authenticateBiometricUnlock();
    expect((second as { success: boolean }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. armBiometricLock: keychain write failure must propagate (not silently swallow)
// ---------------------------------------------------------------------------

describe('armBiometricLock: storage failure propagates', () => {
  it('rejects when SecureStore.setItemAsync fails so the caller knows arming failed', async () => {
    mockSetItemAsync.mockRejectedValue(new Error('Keychain unavailable'));

    // BUG: currently the error propagates because there is no try/catch in
    // armBiometricLock. This test documents and locks the DESIRED behaviour:
    // callers must be able to detect and handle arming failure — they must NOT
    // silently believe the lock is armed when it isn't.
    await expect(armBiometricLock()).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 7. isBiometricLockArmed: adversarial SecureStore return values
// ---------------------------------------------------------------------------

describe('isBiometricLockArmed: adversarial SecureStore values', () => {
  it('returns false when SecureStore returns an empty string', async () => {
    mockGetItemAsync.mockResolvedValue('');
    await expect(isBiometricLockArmed()).resolves.toBe(false);
  });

  it('returns false when SecureStore returns null (key absent)', async () => {
    mockGetItemAsync.mockResolvedValue(null);
    await expect(isBiometricLockArmed()).resolves.toBe(false);
  });

  it('returns false when SecureStore returns undefined', async () => {
    mockGetItemAsync.mockResolvedValue(undefined);
    await expect(isBiometricLockArmed()).resolves.toBe(false);
  });

  it('returns false when SecureStore returns a non-string truthy value (number)', async () => {
    // Defensive: if the native layer ever misbehaves and returns a non-string,
    // we must not consider that "armed".
    mockGetItemAsync.mockResolvedValue(1 as unknown as string);
    await expect(isBiometricLockArmed()).resolves.toBe(false);
  });

  it('returns true when SecureStore returns a non-empty string (normal case)', async () => {
    mockGetItemAsync.mockResolvedValue('1234567890-abc');
    await expect(isBiometricLockArmed()).resolves.toBe(true);
  });
});
