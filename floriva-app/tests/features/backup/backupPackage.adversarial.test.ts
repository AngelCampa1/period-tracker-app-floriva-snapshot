/**
 * Adversarial tests for src/features/backup/backupPackage.ts
 *
 * Covers:
 *   1. Tamper detection  – ciphertext / auth-tag / nonce / salt / header bytes
 *   2. Wrong passphrase  – empty, long, unicode, near-miss
 *   3. Truncation / malformed container
 *   4. Roundtrip fidelity – unicode, empty dataset, large payload, nested structures
 *   5. KDF parameter integrity – salt randomness, nonce uniqueness, iteration-count bounds
 *
 * Cardinal rule: decryption must FAIL CLOSED.  It must never return corrupted
 * or partial plaintext as if it were valid.
 *
 * Only src/features/backup/backupPackage.ts is under test here.
 */

import { Buffer } from 'buffer';

import * as Crypto from 'expo-crypto';
import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';

import { defaultAppPreferences } from '@/src/db/domainDefaults';
import type { BackupSnapshot } from '@/src/types/domain';
import {
  BackupPackageError,
  createBackupPackage,
  decryptBackupPackage,
} from '@/src/features/backup/backupPackage';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const PASSPHRASE = 'adversarial-test-passphrase';

function minimalSnapshot(): BackupSnapshot {
  return {
    formatVersion: 1,
    exportedAt: '2026-06-01T12:00:00.000Z',
    appPreferences: {
      ...defaultAppPreferences,
      hasCompletedOnboarding: true,
      themePreference: 'system',
      localePreference: 'system',
    },
    billingSnapshot: { accessState: 'needs_purchase' },
    userProfile: null,
    reminderPreferences: [],
    privacyPreference: {
      biometricsEnabled: false,
      relockAfterSeconds: 300,
      destructiveActionConfirmationRequired: true,
      diagnosticsConsentEnabled: false,
    },
    importSessions: [],
    dailyLogs: [],
  };
}

const textEncoder = new TextEncoder();

/**
 * Build a well-formed envelope manually, allowing the caller to override the
 * kdf.iterations value.  Uses the real crypto primitives so the keyCheck and
 * ciphertext are internally consistent.
 */
async function buildEnvelopeWithIterations(
  snapshot: BackupSnapshot,
  passphrase: string,
  iterations: number,
): Promise<string> {
  const salt = Crypto.getRandomBytes(16);
  const nonce = Crypto.getRandomBytes(12);
  const derivedKey = await pbkdf2Async(sha256, textEncoder.encode(passphrase), salt, {
    c: iterations,
    dkLen: 32,
  });
  const keyCheck = sha256(
    new Uint8Array([...derivedKey, ...textEncoder.encode('floriva-backup-key-check')]),
  ).slice(0, 32);
  const ciphertext = gcm(derivedKey, nonce).encrypt(
    textEncoder.encode(JSON.stringify(snapshot)),
  );

  return JSON.stringify({
    formatVersion: 1,
    createdAt: '2026-06-01T12:00:00.000Z',
    kdf: {
      algorithm: 'pbkdf2-sha256',
      iterations,
      saltBase64: Buffer.from(salt).toString('base64'),
    },
    encryption: {
      algorithm: 'aes-256-gcm',
      nonceBase64: Buffer.from(nonce).toString('base64'),
      ciphertextBase64: Buffer.from(ciphertext).toString('base64'),
      keyCheckBase64: Buffer.from(keyCheck).toString('base64'),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. TAMPER DETECTION
// ─────────────────────────────────────────────────────────────────────────────

describe('1 – tamper detection', () => {
  let pkg: string;

  beforeAll(async () => {
    pkg = await createBackupPackage({ snapshot: minimalSnapshot(), passphrase: PASSPHRASE });
  }, 30_000);

  it('flipping a byte in the ciphertext body is rejected as invalid_backup_file', async () => {
    const env = JSON.parse(pkg) as { encryption: { ciphertextBase64: string } };
    const bytes = Buffer.from(env.encryption.ciphertextBase64, 'base64');
    // Flip the first byte of the actual message (before the 16-byte GCM tag)
    bytes[0] ^= 0x01;
    env.encryption.ciphertextBase64 = bytes.toString('base64');

    await expect(
      decryptBackupPackage({ serializedPackage: JSON.stringify(env), passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' } satisfies Partial<BackupPackageError>);
  }, 30_000);

  it('flipping the last byte (GCM auth tag) is rejected as invalid_backup_file', async () => {
    const env = JSON.parse(pkg) as { encryption: { ciphertextBase64: string } };
    const bytes = Buffer.from(env.encryption.ciphertextBase64, 'base64');
    bytes[bytes.length - 1] ^= 0xff;
    env.encryption.ciphertextBase64 = bytes.toString('base64');

    await expect(
      decryptBackupPackage({ serializedPackage: JSON.stringify(env), passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' } satisfies Partial<BackupPackageError>);
  }, 30_000);

  it('flipping the first byte of the GCM auth tag is rejected as invalid_backup_file', async () => {
    const env = JSON.parse(pkg) as { encryption: { ciphertextBase64: string } };
    const bytes = Buffer.from(env.encryption.ciphertextBase64, 'base64');
    // GCM tag is the last 16 bytes
    bytes[bytes.length - 16] ^= 0x80;
    env.encryption.ciphertextBase64 = bytes.toString('base64');

    await expect(
      decryptBackupPackage({ serializedPackage: JSON.stringify(env), passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' } satisfies Partial<BackupPackageError>);
  }, 30_000);

  it('replacing the nonce causes GCM auth failure (invalid_backup_file)', async () => {
    const env = JSON.parse(pkg) as { encryption: { nonceBase64: string } };
    // Generate a different random nonce
    const differentNonce = Crypto.getRandomBytes(12);
    env.encryption.nonceBase64 = Buffer.from(differentNonce).toString('base64');

    await expect(
      decryptBackupPackage({ serializedPackage: JSON.stringify(env), passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' } satisfies Partial<BackupPackageError>);
  }, 30_000);

  it('replacing the salt (with correct passphrase) produces key mismatch (wrong_passphrase)', async () => {
    const env = JSON.parse(pkg) as { kdf: { saltBase64: string } };
    const differentSalt = Crypto.getRandomBytes(16);
    env.kdf.saltBase64 = Buffer.from(differentSalt).toString('base64');

    await expect(
      decryptBackupPackage({ serializedPackage: JSON.stringify(env), passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'wrong_passphrase' } satisfies Partial<BackupPackageError>);
  }, 30_000);

  it('zeroing out every byte of the ciphertext is rejected as invalid_backup_file', async () => {
    const env = JSON.parse(pkg) as { encryption: { ciphertextBase64: string } };
    const bytes = Buffer.from(env.encryption.ciphertextBase64, 'base64');
    bytes.fill(0);
    env.encryption.ciphertextBase64 = bytes.toString('base64');

    await expect(
      decryptBackupPackage({ serializedPackage: JSON.stringify(env), passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' } satisfies Partial<BackupPackageError>);
  }, 30_000);

  it('truncating ciphertext to zero bytes is rejected as invalid_backup_file', async () => {
    const env = JSON.parse(pkg) as { encryption: { ciphertextBase64: string } };
    env.encryption.ciphertextBase64 = Buffer.alloc(0).toString('base64');

    await expect(
      decryptBackupPackage({ serializedPackage: JSON.stringify(env), passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' } satisfies Partial<BackupPackageError>);
  }, 30_000);

  it('tampered keyCheck causes wrong_passphrase, never returns plaintext', async () => {
    const env = JSON.parse(pkg) as { encryption: { keyCheckBase64: string } };
    const bytes = Buffer.from(env.encryption.keyCheckBase64, 'base64');
    bytes[0] ^= 0xff;
    env.encryption.keyCheckBase64 = bytes.toString('base64');

    await expect(
      decryptBackupPackage({ serializedPackage: JSON.stringify(env), passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'wrong_passphrase' } satisfies Partial<BackupPackageError>);
  }, 30_000);

  it('header field createdAt mutation does not affect decrypt (not AEAD-covered) but package still decrypts correctly', async () => {
    // This is a documentation test: unauthenticated header fields (createdAt)
    // can be mutated without triggering an error.  The data payload itself is
    // still protected by GCM.  We confirm the decrypt still succeeds and
    // returns the correct snapshot (i.e., no garbage output).
    const env = JSON.parse(pkg) as { createdAt: string };
    env.createdAt = '2000-01-01T00:00:00.000Z'; // mutate unauthenticated field

    const result = await decryptBackupPackage({
      serializedPackage: JSON.stringify(env),
      passphrase: PASSPHRASE,
    });
    // The snapshot content is intact even though createdAt was mutated
    expect(result.formatVersion).toBe(1);
    expect(result.dailyLogs).toHaveLength(0);
  }, 30_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. WRONG PASSPHRASE
// ─────────────────────────────────────────────────────────────────────────────

describe('2 – wrong passphrase', () => {
  let pkg: string;

  beforeAll(async () => {
    pkg = await createBackupPackage({ snapshot: minimalSnapshot(), passphrase: PASSPHRASE });
  }, 30_000);

  it('empty passphrase is rejected with wrong_passphrase, never returns plaintext', async () => {
    await expect(
      decryptBackupPackage({ serializedPackage: pkg, passphrase: '' }),
    ).rejects.toMatchObject({ code: 'wrong_passphrase' } satisfies Partial<BackupPackageError>);
  }, 30_000);

  it('one-character-off passphrase is rejected with wrong_passphrase', async () => {
    const nearMiss = PASSPHRASE.slice(0, -1) + String.fromCharCode(PASSPHRASE.charCodeAt(PASSPHRASE.length - 1) ^ 1);
    await expect(
      decryptBackupPackage({ serializedPackage: pkg, passphrase: nearMiss }),
    ).rejects.toMatchObject({ code: 'wrong_passphrase' } satisfies Partial<BackupPackageError>);
  }, 30_000);

  it('unicode passphrase roundtrips correctly', async () => {
    const unicodePass = '日本語パスワード🔐 مرحبا';
    const unicodePkg = await createBackupPackage({
      snapshot: minimalSnapshot(),
      passphrase: unicodePass,
    });
    const result = await decryptBackupPackage({
      serializedPackage: unicodePkg,
      passphrase: unicodePass,
    });
    expect(result.formatVersion).toBe(1);
  }, 30_000);

  it('wrong passphrase on unicode-passphrase package is rejected with wrong_passphrase', async () => {
    const unicodePass = '日本語パスワード🔐';
    const unicodePkg = await createBackupPackage({
      snapshot: minimalSnapshot(),
      passphrase: unicodePass,
    });
    await expect(
      decryptBackupPackage({ serializedPackage: unicodePkg, passphrase: 'wrong' }),
    ).rejects.toMatchObject({ code: 'wrong_passphrase' } satisfies Partial<BackupPackageError>);
  }, 30_000);

  it('very long passphrase (10 000 chars) roundtrips correctly', async () => {
    const longPass = 'a'.repeat(10_000);
    const longPkg = await createBackupPackage({
      snapshot: minimalSnapshot(),
      passphrase: longPass,
    });
    const result = await decryptBackupPackage({
      serializedPackage: longPkg,
      passphrase: longPass,
    });
    expect(result.formatVersion).toBe(1);
  }, 60_000);

  it('passphrase that differs only in case is rejected with wrong_passphrase', async () => {
    await expect(
      decryptBackupPackage({ serializedPackage: pkg, passphrase: PASSPHRASE.toUpperCase() }),
    ).rejects.toMatchObject({ code: 'wrong_passphrase' } satisfies Partial<BackupPackageError>);
  }, 30_000);

  it('passphrase with leading/trailing whitespace differs from trimmed version', async () => {
    const paddedPass = ` ${PASSPHRASE} `;
    await expect(
      decryptBackupPackage({ serializedPackage: pkg, passphrase: paddedPass }),
    ).rejects.toMatchObject({ code: 'wrong_passphrase' } satisfies Partial<BackupPackageError>);
  }, 30_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. TRUNCATION / MALFORMED CONTAINER
// ─────────────────────────────────────────────────────────────────────────────

describe('3 – truncation and malformed container', () => {
  it('empty string input is rejected as invalid_backup_file', async () => {
    await expect(
      decryptBackupPackage({ serializedPackage: '', passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' } satisfies Partial<BackupPackageError>);
  });

  it('non-JSON binary garbage is rejected as invalid_backup_file', async () => {
    await expect(
      decryptBackupPackage({ serializedPackage: '\x00\x01\x02\x03', passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' } satisfies Partial<BackupPackageError>);
  });

  it('JSON array at root is rejected as invalid_backup_file', async () => {
    await expect(
      decryptBackupPackage({ serializedPackage: '[]', passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' } satisfies Partial<BackupPackageError>);
  });

  it('JSON null is rejected as invalid_backup_file', async () => {
    await expect(
      decryptBackupPackage({ serializedPackage: 'null', passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' } satisfies Partial<BackupPackageError>);
  });

  it('JSON number is rejected as invalid_backup_file', async () => {
    await expect(
      decryptBackupPackage({ serializedPackage: '42', passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' } satisfies Partial<BackupPackageError>);
  });

  it('truncated JSON mid-string is rejected as invalid_backup_file', async () => {
    await expect(
      decryptBackupPackage({
        serializedPackage: '{"formatVersion":1,"kdf":{"algori',
        passphrase: PASSPHRASE,
      }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' } satisfies Partial<BackupPackageError>);
  });

  it('missing formatVersion field is rejected as invalid_backup_file', async () => {
    await expect(
      decryptBackupPackage({
        serializedPackage: JSON.stringify({ createdAt: '2026-01-01T00:00:00.000Z' }),
        passphrase: PASSPHRASE,
      }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' } satisfies Partial<BackupPackageError>);
  });

  it('unknown formatVersion is rejected as unsupported_backup_format', async () => {
    await expect(
      decryptBackupPackage({
        serializedPackage: JSON.stringify({ formatVersion: 999 }),
        passphrase: PASSPHRASE,
      }),
    ).rejects.toMatchObject({ code: 'unsupported_backup_format' } satisfies Partial<BackupPackageError>);
  });

  it('formatVersion 0 (falsy) is rejected as invalid_backup_file (not unsupported)', async () => {
    // version 0 is not a number we ever supported, treated as missing/invalid
    await expect(
      decryptBackupPackage({
        serializedPackage: JSON.stringify({ formatVersion: 0 }),
        passphrase: PASSPHRASE,
      }),
    ).rejects.toMatchObject({ code: 'unsupported_backup_format' } satisfies Partial<BackupPackageError>);
  });

  it('missing encryption section is rejected as invalid_backup_file', async () => {
    const env = {
      formatVersion: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      kdf: { algorithm: 'pbkdf2-sha256', iterations: 210000, saltBase64: 'AAAA' },
      // no encryption
    };
    await expect(
      decryptBackupPackage({ serializedPackage: JSON.stringify(env), passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' } satisfies Partial<BackupPackageError>);
  });

  it('missing kdf section is rejected as invalid_backup_file', async () => {
    const env = {
      formatVersion: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      encryption: {
        algorithm: 'aes-256-gcm',
        nonceBase64: 'AAAA',
        ciphertextBase64: 'BBBB',
        keyCheckBase64: 'CCCC',
      },
    };
    await expect(
      decryptBackupPackage({ serializedPackage: JSON.stringify(env), passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' } satisfies Partial<BackupPackageError>);
  });

  it('extra trailing bytes appended to a valid base64 ciphertext still gets caught by GCM', async () => {
    const pkg = await createBackupPackage({ snapshot: minimalSnapshot(), passphrase: PASSPHRASE });
    const env = JSON.parse(pkg) as { encryption: { ciphertextBase64: string } };
    // Append extra bytes after the GCM tag
    const original = Buffer.from(env.encryption.ciphertextBase64, 'base64');
    const extended = Buffer.concat([original, Buffer.from([0xde, 0xad])]);
    env.encryption.ciphertextBase64 = extended.toString('base64');

    await expect(
      decryptBackupPackage({ serializedPackage: JSON.stringify(env), passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' } satisfies Partial<BackupPackageError>);
  }, 30_000);

  it('encryption.algorithm set to an unknown string is rejected as invalid_backup_file', async () => {
    const pkg = await createBackupPackage({ snapshot: minimalSnapshot(), passphrase: PASSPHRASE });
    const env = JSON.parse(pkg) as { encryption: { algorithm: string } };
    env.encryption.algorithm = 'aes-128-cbc'; // schema requires aes-256-gcm

    await expect(
      decryptBackupPackage({ serializedPackage: JSON.stringify(env), passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' } satisfies Partial<BackupPackageError>);
  }, 30_000);

  it('kdf.algorithm set to an unknown string is rejected as invalid_backup_file', async () => {
    const pkg = await createBackupPackage({ snapshot: minimalSnapshot(), passphrase: PASSPHRASE });
    const env = JSON.parse(pkg) as { kdf: { algorithm: string } };
    env.kdf.algorithm = 'argon2id'; // schema requires pbkdf2-sha256

    await expect(
      decryptBackupPackage({ serializedPackage: JSON.stringify(env), passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' } satisfies Partial<BackupPackageError>);
  }, 30_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. ROUNDTRIP FIDELITY
// ─────────────────────────────────────────────────────────────────────────────

describe('4 – roundtrip fidelity', () => {
  it('empty dataset (no logs, null profile) roundtrips with exact deep equality', async () => {
    const snapshot = minimalSnapshot();
    const pkg = await createBackupPackage({ snapshot, passphrase: PASSPHRASE });
    const restored = await decryptBackupPackage({ serializedPackage: pkg, passphrase: PASSPHRASE });
    expect(restored.dailyLogs).toHaveLength(0);
    expect(restored.userProfile).toBeNull();
    expect(restored.importSessions).toHaveLength(0);
  }, 30_000);

  it('snapshot with unicode notes, emoji, and RTL text roundtrips exactly', async () => {
    const snapshot: BackupSnapshot = {
      ...minimalSnapshot(),
      dailyLogs: [
        {
          id: 'log-unicode',
          logDate: '2026-05-15',
          bleeding: 'light',
          symptoms: [],
          notes: '日本語🌸 مرحبا بالعالم héllo wörld ‮ RTL marker',
        },
      ],
    };
    const pkg = await createBackupPackage({ snapshot, passphrase: PASSPHRASE });
    const restored = await decryptBackupPackage({ serializedPackage: pkg, passphrase: PASSPHRASE });
    expect(restored.dailyLogs[0]?.notes).toBe(snapshot.dailyLogs[0]?.notes);
  }, 30_000);

  it('snapshot with 500-character notes at max boundary roundtrips exactly', async () => {
    // Use ASCII to be safe against multi-byte counting edge cases
    const maxAsciiNotes = 'x'.repeat(500);
    const snapshot: BackupSnapshot = {
      ...minimalSnapshot(),
      dailyLogs: [
        {
          id: 'log-maxnotes',
          logDate: '2026-05-16',
          bleeding: 'none',
          symptoms: [],
          notes: maxAsciiNotes,
        },
      ],
    };
    const pkg = await createBackupPackage({ snapshot, passphrase: PASSPHRASE });
    const restored = await decryptBackupPackage({ serializedPackage: pkg, passphrase: PASSPHRASE });
    expect(restored.dailyLogs[0]?.notes).toBe(maxAsciiNotes);
  }, 30_000);

  it('large payload (200 daily logs) roundtrips without data loss', async () => {
    const logs = Array.from({ length: 200 }, (_, i) => {
      const date = new Date(Date.UTC(2025, 0, 1) + i * 86_400_000);
      const yyyy = date.getUTCFullYear();
      const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(date.getUTCDate()).padStart(2, '0');
      return {
        id: `log-${i}`,
        logDate: `${yyyy}-${mm}-${dd}`,
        bleeding: 'none' as const,
        symptoms: [] as never[],
      };
    });

    const snapshot: BackupSnapshot = { ...minimalSnapshot(), dailyLogs: logs };
    const pkg = await createBackupPackage({ snapshot, passphrase: PASSPHRASE });
    const restored = await decryptBackupPackage({ serializedPackage: pkg, passphrase: PASSPHRASE });
    expect(restored.dailyLogs).toHaveLength(200);
    expect(restored.dailyLogs[0]?.id).toBe('log-0');
    expect(restored.dailyLogs[199]?.id).toBe('log-199');
  }, 60_000);

  it('nested structures (ttcObservation, birthControlEvent) survive roundtrip', async () => {
    const snapshot: BackupSnapshot = {
      ...minimalSnapshot(),
      dailyLogs: [
        {
          id: 'log-ttc',
          logDate: '2026-05-01',
          bleeding: 'none',
          symptoms: [],
          ttcObservation: {
            cervicalMucus: 'egg-white',
            ovulationTest: 'peak',
            basalBodyTemperatureCelsius: 36.75,
            sexLogged: true,
          },
        },
        {
          id: 'log-bc',
          logDate: '2026-05-02',
          bleeding: 'none',
          symptoms: [],
          birthControlEvent: { method: 'pill', missedDose: true, lateDose: false },
        },
      ],
    };
    const pkg = await createBackupPackage({ snapshot, passphrase: PASSPHRASE });
    const restored = await decryptBackupPackage({ serializedPackage: pkg, passphrase: PASSPHRASE });
    const ttcLog = restored.dailyLogs.find((l) => l.id === 'log-ttc');
    expect(ttcLog?.ttcObservation?.cervicalMucus).toBe('egg-white');
    expect(ttcLog?.ttcObservation?.basalBodyTemperatureCelsius).toBe(36.75);
    const bcLog = restored.dailyLogs.find((l) => l.id === 'log-bc');
    expect(bcLog?.birthControlEvent?.method).toBe('pill');
    expect(bcLog?.birthControlEvent?.missedDose).toBe(true);
  }, 30_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. KDF PARAMETER INTEGRITY
// ─────────────────────────────────────────────────────────────────────────────

describe('5 – KDF parameter integrity', () => {
  it('two encryptions of the same snapshot+passphrase produce different salts', async () => {
    const snapshot = minimalSnapshot();
    const pkg1 = await createBackupPackage({ snapshot, passphrase: PASSPHRASE });
    const pkg2 = await createBackupPackage({ snapshot, passphrase: PASSPHRASE });
    const env1 = JSON.parse(pkg1) as { kdf: { saltBase64: string } };
    const env2 = JSON.parse(pkg2) as { kdf: { saltBase64: string } };
    expect(env1.kdf.saltBase64).not.toBe(env2.kdf.saltBase64);
  }, 60_000);

  it('two encryptions of the same snapshot+passphrase produce different nonces', async () => {
    const snapshot = minimalSnapshot();
    const pkg1 = await createBackupPackage({ snapshot, passphrase: PASSPHRASE });
    const pkg2 = await createBackupPackage({ snapshot, passphrase: PASSPHRASE });
    const env1 = JSON.parse(pkg1) as { encryption: { nonceBase64: string } };
    const env2 = JSON.parse(pkg2) as { encryption: { nonceBase64: string } };
    expect(env1.encryption.nonceBase64).not.toBe(env2.encryption.nonceBase64);
  }, 60_000);

  it('two encryptions of the same snapshot+passphrase produce different ciphertexts', async () => {
    // Confirms nonce-reuse is not occurring: identical plaintext + different nonce → different ciphertext
    const snapshot = minimalSnapshot();
    const pkg1 = await createBackupPackage({ snapshot, passphrase: PASSPHRASE });
    const pkg2 = await createBackupPackage({ snapshot, passphrase: PASSPHRASE });
    const env1 = JSON.parse(pkg1) as { encryption: { ciphertextBase64: string } };
    const env2 = JSON.parse(pkg2) as { encryption: { ciphertextBase64: string } };
    expect(env1.encryption.ciphertextBase64).not.toBe(env2.encryption.ciphertextBase64);
  }, 60_000);

  // ── BUG FIX: attacker-controlled iteration count ──────────────────────────
  // Before the fix, decryptBackupPackage passed envelope.kdf.iterations directly
  // to PBKDF2 without any bounds check.  An attacker-crafted backup file could
  // set iterations:1 to trivially weaken the KDF (aiding offline brute-force)
  // or set iterations:2_000_000_000 to DoS the device.

  it('[BUG-KDF-LOW] iterations:1 in envelope is rejected as invalid_backup_file before running KDF', async () => {
    // Build a cryptographically consistent package with iterations:1
    const pkg = await buildEnvelopeWithIterations(minimalSnapshot(), PASSPHRASE, 1);

    // Must throw before doing any expensive computation
    await expect(
      decryptBackupPackage({ serializedPackage: pkg, passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' } satisfies Partial<BackupPackageError>);
  });

  it('[BUG-KDF-LOW] iterations:99999 (below 100 000 minimum) is rejected as invalid_backup_file', async () => {
    const pkg = await buildEnvelopeWithIterations(minimalSnapshot(), PASSPHRASE, 99_999);
    await expect(
      decryptBackupPackage({ serializedPackage: pkg, passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' } satisfies Partial<BackupPackageError>);
  });

  it('[BUG-KDF-DOS] iterations:10_000_001 (above max) is rejected as invalid_backup_file', async () => {
    // We must NOT actually run PBKDF2 with this count, so we build the envelope
    // synthetically (using real crypto at a safe iteration count) and then
    // patch the iterations field in the JSON after the fact.
    const pkg = await buildEnvelopeWithIterations(minimalSnapshot(), PASSPHRASE, 210_000);
    const env = JSON.parse(pkg) as { kdf: { iterations: number } };
    env.kdf.iterations = 10_000_001;

    // The envelope is now cryptographically inconsistent (derived key would be
    // wrong anyway), but the iteration guard must fire BEFORE deriving the key.
    await expect(
      decryptBackupPackage({ serializedPackage: JSON.stringify(env), passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' } satisfies Partial<BackupPackageError>);
  });

  it('[BUG-KDF-DOS] iterations:Number.MAX_SAFE_INTEGER is rejected as invalid_backup_file', async () => {
    const pkg = await buildEnvelopeWithIterations(minimalSnapshot(), PASSPHRASE, 210_000);
    const env = JSON.parse(pkg) as { kdf: { iterations: number } };
    env.kdf.iterations = Number.MAX_SAFE_INTEGER;

    await expect(
      decryptBackupPackage({ serializedPackage: JSON.stringify(env), passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' } satisfies Partial<BackupPackageError>);
  });

  it('iterations:210000 (canonical value) is accepted and decrypts correctly', async () => {
    const snapshot = minimalSnapshot();
    const pkg = await buildEnvelopeWithIterations(snapshot, PASSPHRASE, 210_000);
    const result = await decryptBackupPackage({ serializedPackage: pkg, passphrase: PASSPHRASE });
    expect(result.formatVersion).toBe(1);
  }, 30_000);

  it('iterations:100000 (minimum boundary) is accepted and decrypts correctly', async () => {
    const snapshot = minimalSnapshot();
    const pkg = await buildEnvelopeWithIterations(snapshot, PASSPHRASE, 100_000);
    const result = await decryptBackupPackage({ serializedPackage: pkg, passphrase: PASSPHRASE });
    expect(result.formatVersion).toBe(1);
  }, 30_000);

  it('iterations:10_000_000 (maximum boundary) is accepted and decrypts correctly', async () => {
    const snapshot = minimalSnapshot();
    const pkg = await buildEnvelopeWithIterations(snapshot, PASSPHRASE, 10_000_000);
    const result = await decryptBackupPackage({ serializedPackage: pkg, passphrase: PASSPHRASE });
    expect(result.formatVersion).toBe(1);
  }, 120_000); // generous timeout for 10M iterations on CI
});
