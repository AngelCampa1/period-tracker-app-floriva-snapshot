/**
 * Adversarial security probe: lockSecurity
 *
 * Target:
 *   - src/lib/security/biometricLock.ts
 *   - src/features/app-shell/shouldRelockAfterResume.ts
 *
 * Strategy: attack vectors NOT already covered by existing test files:
 *   biometricLock.test.ts, biometricLock.adversarial.test.ts,
 *   shouldRelockAfterResume.test.ts, AppShellProvider.lock.probe.adversarial.test.tsx
 *
 * Invariant: ambiguity or error → LOCKED / relock. Never fail-open.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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
  authenticateBiometricUnlock,
  clearBiometricLock,
  isBiometricLockArmed,
} from '@/src/lib/security/biometricLock';
// eslint-disable-next-line import/first
import { shouldRelockAfterResume } from '@/src/features/app-shell/shouldRelockAfterResume';

beforeEach(() => {
  mockHasHardwareAsync.mockReset();
  mockIsEnrolledAsync.mockReset();
  mockAuthenticateAsync.mockReset();
  mockSetItemAsync.mockReset();
  mockGetItemAsync.mockReset();
  mockDeleteItemAsync.mockReset();
});

// ===========================================================================
// SECTION A: isBiometricLockArmed — adversarial SecureStore return values
// (partially covered; new cases: whitespace strings, object, boolean, array)
// ===========================================================================

describe('isBiometricLockArmed — adversarial string/value variants', () => {
  it('returns true for a whitespace-only string (fail-closed: non-empty string → armed)', async () => {
    // A whitespace-only string has length > 0. The implementation treats any
    // non-empty string as armed. This is FAIL-CLOSED: it may generate a false
    // positive (locking when the secret is garbage), but it never fails open.
    // The user can still unlock via biometric auth, and a real clearBiometricLock
    // call will remove the key. The correct security behaviour is therefore to
    // return true (armed) for any non-empty string.
    mockGetItemAsync.mockResolvedValue('   ');
    const result = await isBiometricLockArmed();
    expect(result).toBe(true); // fail-closed: non-empty whitespace → treated as armed
  });

  it('returns true (fail-closed) for a zero-width-space character string', async () => {
    // Zero-width space: length 1, but not a real printable secret.
    // Same class of problem as whitespace. The app should still lock (fail-closed).
    mockGetItemAsync.mockResolvedValue('​');
    // fail-closed: if this is reached, the lock must still engage.
    // Whether this returns true (locked) or false (unarmed) both are acceptable
    // from a security standpoint IF behaviour is consistent — but returning false
    // (not armed) for a non-empty exotic string would be fail-open on initial app start
    // when biometricsEnabled=true (the shell would skip the lock screen).
    // Correct behaviour: any ambiguous non-empty string → treat as ARMED (fail-closed).
    const result = await isBiometricLockArmed();
    expect(result).toBe(true); // fail-closed: non-empty string → armed
  });

  it('returns false for a boolean true (non-string truthy)', async () => {
    // Defensive: native layer misbehaves and returns a raw boolean
    mockGetItemAsync.mockResolvedValue(true as unknown as string);
    await expect(isBiometricLockArmed()).resolves.toBe(false);
  });

  it('returns false for an array value (corrupt native return)', async () => {
    mockGetItemAsync.mockResolvedValue(['secret'] as unknown as string);
    await expect(isBiometricLockArmed()).resolves.toBe(false);
  });

  it('returns false for an object value (corrupt native return)', async () => {
    mockGetItemAsync.mockResolvedValue({ secret: 'x' } as unknown as string);
    await expect(isBiometricLockArmed()).resolves.toBe(false);
  });
});

// ===========================================================================
// SECTION B: isBiometricLockArmed — fail-closed on EVERY error variant
// ===========================================================================

describe('isBiometricLockArmed — fail-closed on all thrown error types', () => {
  it('returns true when SecureStore throws a string (not an Error object)', async () => {
    mockGetItemAsync.mockRejectedValue('keychain_error_string');
    await expect(isBiometricLockArmed()).resolves.toBe(true);
  });

  it('returns true when SecureStore throws null', async () => {
    mockGetItemAsync.mockRejectedValue(null);
    await expect(isBiometricLockArmed()).resolves.toBe(true);
  });

  it('returns true when SecureStore throws undefined', async () => {
    mockGetItemAsync.mockRejectedValue(undefined);
    await expect(isBiometricLockArmed()).resolves.toBe(true);
  });

  it('returns true when SecureStore throws a number', async () => {
    mockGetItemAsync.mockRejectedValue(42);
    await expect(isBiometricLockArmed()).resolves.toBe(true);
  });
});

// ===========================================================================
// SECTION C: clearBiometricLock — error on deleteItemAsync propagates
// ===========================================================================

describe('clearBiometricLock — storage failure semantics', () => {
  it('rejects when deleteItemAsync throws (caller must know clearance failed)', async () => {
    // If clearBiometricLock silently swallows the error, the caller (AppShellProvider,
    // deleteAllData) would believe the lock was cleared when it wasn't. On the next
    // cold start, isBiometricLockArmed would still return true → the app would lock
    // again, which is fail-CLOSED and acceptable. However, the caller also makes
    // UI decisions (e.g. showing "biometrics disabled" state) based on success.
    // The correct behaviour is to propagate the rejection.
    mockDeleteItemAsync.mockRejectedValue(new Error('Keychain delete failed'));
    await expect(clearBiometricLock()).rejects.toThrow('Keychain delete failed');
  });
});

// ===========================================================================
// SECTION D: authenticateBiometricUnlock — truthy but non-boolean success values
// ===========================================================================

describe('authenticateBiometricUnlock — truthy non-boolean success values must not unlock', () => {
  beforeEach(() => {
    mockHasHardwareAsync.mockResolvedValue(true);
    mockIsEnrolledAsync.mockResolvedValue(true);
  });

  it('stays locked when success is the number 1 (truthy, not strictly true)', async () => {
    // A native module bug or prototype pollution could return success: 1.
    // Only result.success === true (strict equality) should unlock.
    mockAuthenticateAsync.mockResolvedValue({ success: 1 });
    const result = await authenticateBiometricUnlock();
    expect(result.success).toBe(false);
  });

  it('stays locked when success is the string "true"', async () => {
    mockAuthenticateAsync.mockResolvedValue({ success: 'true' });
    const result = await authenticateBiometricUnlock();
    expect(result.success).toBe(false);
  });

  it('stays locked when success is the string "1"', async () => {
    mockAuthenticateAsync.mockResolvedValue({ success: '1' });
    const result = await authenticateBiometricUnlock();
    expect(result.success).toBe(false);
  });

  it('stays locked when result has success:true buried inside a nested object', async () => {
    // Deep nesting attack: the check is on result.success directly, but a
    // wrapped/nested response must not be mistaken for a top-level success.
    mockAuthenticateAsync.mockResolvedValue({ data: { success: true } });
    const result = await authenticateBiometricUnlock();
    expect(result.success).toBe(false);
  });

  it('stays locked when result is an array containing a success object', async () => {
    mockAuthenticateAsync.mockResolvedValue([{ success: true }] as unknown);
    const result = await authenticateBiometricUnlock();
    expect(result.success).toBe(false);
  });

  it('unlocks when result is a genuine {success:true} (sanity baseline for this section)', async () => {
    // Confirms that a properly shaped {success:true} response does unlock.
    // This anchors the negative tests above: the guard is only `.success !== true`,
    // so anything that is not exactly the boolean true stays locked.
    mockAuthenticateAsync.mockResolvedValue({ success: true });
    const result = await authenticateBiometricUnlock();
    expect(result.success).toBe(true);
  });
});

// ===========================================================================
// SECTION E: shouldRelockAfterResume — uncovered threshold edge values
// ===========================================================================

describe('shouldRelockAfterResume — threshold edge values (fail-closed)', () => {
  const BG = 1_000_000;
  const FAR_FUTURE = BG + 999_999_999;

  // --- Infinity ---
  it('relocks when relockAfterSeconds is +Infinity (non-finite → fail-closed)', () => {
    // `Number.isFinite(Infinity)` is false → guard triggers → return true
    expect(
      shouldRelockAfterResume({
        biometricsEnabled: true,
        relockAfterSeconds: Infinity,
        backgroundedAt: BG,
        resumedAt: FAR_FUTURE,
      }),
    ).toBe(true);
  });

  it('relocks when relockAfterSeconds is -Infinity (non-finite → fail-closed)', () => {
    expect(
      shouldRelockAfterResume({
        biometricsEnabled: true,
        relockAfterSeconds: -Infinity,
        backgroundedAt: BG,
        resumedAt: FAR_FUTURE,
      }),
    ).toBe(true);
  });

  // --- NaN (not covered in unit shouldRelockAfterResume.test.ts) ---
  it('relocks when relockAfterSeconds is NaN (non-finite → fail-closed)', () => {
    expect(
      shouldRelockAfterResume({
        biometricsEnabled: true,
        relockAfterSeconds: NaN,
        backgroundedAt: BG,
        resumedAt: FAR_FUTURE,
      }),
    ).toBe(true);
  });

  // --- Negative values (not covered in unit test) ---
  it('relocks when relockAfterSeconds is -1 (negative → fail-closed)', () => {
    expect(
      shouldRelockAfterResume({
        biometricsEnabled: true,
        relockAfterSeconds: -1,
        backgroundedAt: BG,
        resumedAt: BG + 1,
      }),
    ).toBe(true);
  });

  it('relocks when relockAfterSeconds is -0.001 (tiny negative → fail-closed)', () => {
    expect(
      shouldRelockAfterResume({
        biometricsEnabled: true,
        relockAfterSeconds: -0.001,
        backgroundedAt: BG,
        resumedAt: BG + 1,
      }),
    ).toBe(true);
  });

  // --- Zero (not covered in shouldRelockAfterResume.test.ts) ---
  it('relocks when relockAfterSeconds is 0 and any time has elapsed', () => {
    // 0 is non-negative and finite → guard does NOT trigger
    // elapsed >= 0 * 1000 = 0 → true for any non-negative elapsed time
    expect(
      shouldRelockAfterResume({
        biometricsEnabled: true,
        relockAfterSeconds: 0,
        backgroundedAt: BG,
        resumedAt: BG + 1,
      }),
    ).toBe(true);
  });

  it('relocks when relockAfterSeconds is 0 and elapsed is also 0 (same millisecond)', () => {
    // elapsed = 0 >= 0 * 1000 = 0 → true (inclusive threshold)
    expect(
      shouldRelockAfterResume({
        biometricsEnabled: true,
        relockAfterSeconds: 0,
        backgroundedAt: BG,
        resumedAt: BG,
      }),
    ).toBe(true);
  });

  // --- Fractional thresholds ---
  it('relocks correctly for fractional relockAfterSeconds (0.5s = 500ms)', () => {
    expect(
      shouldRelockAfterResume({
        biometricsEnabled: true,
        relockAfterSeconds: 0.5,
        backgroundedAt: BG,
        resumedAt: BG + 500, // exactly 500ms elapsed
      }),
    ).toBe(true);
  });

  it('does NOT relock for fractional relockAfterSeconds when elapsed < threshold', () => {
    expect(
      shouldRelockAfterResume({
        biometricsEnabled: true,
        relockAfterSeconds: 0.5,
        backgroundedAt: BG,
        resumedAt: BG + 499, // 499ms < 500ms
      }),
    ).toBe(false);
  });

  // --- Clock going backwards ---
  it('does NOT relock when clock goes backwards (resumedAt < backgroundedAt)', () => {
    // Negative elapsed time: clock skew or device time adjustment.
    // elapsed = -5000 ms < relockAfterSeconds * 1000 → should NOT relock.
    // This is NOT fail-open: a backwards clock means we cannot know how long
    // the app was backgrounded, but the elapsed value is negative which is less
    // than any valid positive threshold. The SAFE question is: does the function
    // relock based on a nonsensical negative elapsed value?
    // Expected: false (negative elapsed < threshold → no relock based on time).
    // Note: this is the CORRECT behaviour. A negative elapsed is not ≥ threshold.
    expect(
      shouldRelockAfterResume({
        biometricsEnabled: true,
        relockAfterSeconds: 60,
        backgroundedAt: BG + 1000,
        resumedAt: BG, // 1 second BEFORE backgroundedAt
      }),
    ).toBe(false);
  });

  it('does NOT relock when elapsed is exactly -1ms (backwards clock, biometrics on)', () => {
    // Confirms the backwards-clock scenario: elapsed = -1 < 60*1000 → false
    expect(
      shouldRelockAfterResume({
        biometricsEnabled: true,
        relockAfterSeconds: 60,
        backgroundedAt: 5001,
        resumedAt: 5000,
      }),
    ).toBe(false);
  });

  // --- backgroundedAt === null (not covered in unit test file, only integration) ---
  it('returns false when backgroundedAt is null (never backgrounded)', () => {
    expect(
      shouldRelockAfterResume({
        biometricsEnabled: true,
        relockAfterSeconds: 60,
        backgroundedAt: null,
        resumedAt: FAR_FUTURE,
      }),
    ).toBe(false);
  });

  it('returns false when backgroundedAt is null and relockAfterSeconds is NaN', () => {
    // Two anomalies at once: null backgroundedAt gates first, so NaN threshold
    // never gets evaluated — result must be false.
    expect(
      shouldRelockAfterResume({
        biometricsEnabled: true,
        relockAfterSeconds: NaN,
        backgroundedAt: null,
        resumedAt: FAR_FUTURE,
      }),
    ).toBe(false);
  });

  // --- biometricsEnabled false with adversarial thresholds ---
  it('returns false for NaN threshold when biometricsEnabled=false (gating order)', () => {
    expect(
      shouldRelockAfterResume({
        biometricsEnabled: false,
        relockAfterSeconds: NaN,
        backgroundedAt: BG,
        resumedAt: FAR_FUTURE,
      }),
    ).toBe(false);
  });

  it('returns false for negative threshold when biometricsEnabled=false', () => {
    expect(
      shouldRelockAfterResume({
        biometricsEnabled: false,
        relockAfterSeconds: -999,
        backgroundedAt: BG,
        resumedAt: BG + 1,
      }),
    ).toBe(false);
  });

  // --- Very large thresholds ---
  it('does NOT relock when elapsed is huge but threshold is MAX_SAFE_INTEGER', () => {
    expect(
      shouldRelockAfterResume({
        biometricsEnabled: true,
        relockAfterSeconds: Number.MAX_SAFE_INTEGER,
        backgroundedAt: BG,
        resumedAt: FAR_FUTURE,
      }),
    ).toBe(false);
  });
});
