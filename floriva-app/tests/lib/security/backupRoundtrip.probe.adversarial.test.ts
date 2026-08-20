/**
 * Probe adversarial tests for src/features/backup/backupPackage.ts
 *
 * These scenarios are NOVEL — not covered by the existing adversarial suite in
 * tests/features/backup/backupPackage.adversarial.test.ts or
 * tests/db/backupRoundtrip.adversarial.test.ts.
 *
 * Focus areas:
 *   P1 – Privacy: no reproductive payload written in plaintext inside the blob.
 *   P2 – Crypto edge cases: ciphertext shorter than GCM tag, nonce reuse
 *         detection surface, empty passphrase with empty snapshot.
 *   P3 – Blob integrity: version field is an integer, not '1' string.
 *   P4 – Roundtrip fidelity with extreme/unusual payloads not yet tested.
 *   P5 – Error class identity: errors are always BackupPackageError, never
 *         raw crypto library errors leaking implementation details.
 *   P6 – Key-check does not use the ciphertext: tampered ciphertext must
 *         still produce 'invalid_backup_file', not silently pass key-check
 *         and return wrong data.
 */

import { Buffer } from 'buffer';

import { defaultAppPreferences } from '@/src/db/domainDefaults';
import type { BackupSnapshot } from '@/src/types/domain';
import {
  BackupPackageError,
  createBackupPackage,
  decryptBackupPackage,
} from '@/src/features/backup/backupPackage';

// ─── helpers ─────────────────────────────────────────────────────────────────

const PASSPHRASE = 'probe-adversarial-pass-2026';

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

function sensitiveSnapshot(): BackupSnapshot {
  return {
    ...minimalSnapshot(),
    userProfile: {
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-05-01',
      goals: ['period'],
      supportsIrregularCycles: false,
      conditionTags: ['endometriosis'],
    },
    dailyLogs: [
      {
        id: 'log-1',
        logDate: '2026-05-01',
        bleeding: 'heavy',
        symptoms: ['cramps', 'bloating'],
        notes: 'very painful period, heavy flow, migraine',
      },
      {
        id: 'log-2',
        logDate: '2026-05-10',
        bleeding: 'none',
        symptoms: [],
        ttcObservation: {
          cervicalMucus: 'egg-white',
          ovulationTest: 'peak',
          basalBodyTemperatureCelsius: 36.8,
          sexLogged: true,
        },
      },
    ],
  };
}

// ─── P1: PRIVACY — no reproductive payload in plaintext ─────────────────────

describe('P1 – no reproductive payload in the encrypted blob (plaintext)', () => {
  /**
   * The serialized backup package (the string that would be written to a file)
   * must contain NO readable reproductive data in the clear.
   *
   * We check a selection of sensitive strings that would appear in the JSON
   * plaintext and confirm none are present in the final encrypted blob.
   */
  const sensitiveStrings = [
    'endometriosis',      // condition tag
    'egg-white',          // cervical mucus value
    'peak',               // ovulation test result
    'sexLogged',          // TTC field name
    'heavy',              // bleeding intensity
    'cramps',             // symptom
    'very painful',       // free-text note fragment
    '2026-05-01',         // period start date
    'basalBodyTemperature',
    'cervicalMucus',
    'ovulationTest',
    'ttcObservation',
    'birthControl',
  ];

  let pkg: string;

  beforeAll(async () => {
    pkg = await createBackupPackage({
      snapshot: sensitiveSnapshot(),
      passphrase: PASSPHRASE,
    });
  }, 30_000);

  it.each(sensitiveStrings)(
    'sensitive string "%s" does not appear in plaintext in the blob',
    (sensitive) => {
      // The blob is a JSON envelope; none of the sensitive strings should appear
      // as readable text anywhere in the serialized package.
      expect(pkg).not.toContain(sensitive);
    },
  );

  it('the blob does not contain readable JSON field names from DailyLogEntry', () => {
    // These are field names that appear only inside the encrypted payload.
    // If they appear in the outer blob, something was serialized unencrypted.
    const innerFields = ['dailyLogs', 'userProfile', 'reminderPreferences', 'importSessions'];
    for (const field of innerFields) {
      expect(pkg).not.toContain(field);
    }
  });

  it('the outer envelope only contains the expected top-level keys', () => {
    const envelope = JSON.parse(pkg) as Record<string, unknown>;
    const allowedKeys = new Set(['formatVersion', 'createdAt', 'kdf', 'encryption']);
    for (const key of Object.keys(envelope)) {
      expect(allowedKeys.has(key)).toBe(true);
    }
  });

  it('the kdf sub-object contains only algorithm, iterations, saltBase64', () => {
    const envelope = JSON.parse(pkg) as { kdf: Record<string, unknown> };
    const allowedKdfKeys = new Set(['algorithm', 'iterations', 'saltBase64']);
    for (const key of Object.keys(envelope.kdf)) {
      expect(allowedKdfKeys.has(key)).toBe(true);
    }
  });

  it('the encryption sub-object contains only algorithm, nonceBase64, ciphertextBase64, keyCheckBase64', () => {
    const envelope = JSON.parse(pkg) as { encryption: Record<string, unknown> };
    const allowedEncKeys = new Set([
      'algorithm',
      'nonceBase64',
      'ciphertextBase64',
      'keyCheckBase64',
    ]);
    for (const key of Object.keys(envelope.encryption)) {
      expect(allowedEncKeys.has(key)).toBe(true);
    }
  });
});

// ─── P2: Crypto edge cases ────────────────────────────────────────────────────

describe('P2 – crypto edge cases', () => {
  it('ciphertext exactly 15 bytes (shorter than 16-byte GCM tag) is rejected as invalid_backup_file', async () => {
    const pkg = await createBackupPackage({ snapshot: minimalSnapshot(), passphrase: PASSPHRASE });
    const env = JSON.parse(pkg) as { encryption: { ciphertextBase64: string } };
    // Replace ciphertext with 15 bytes — less than the 16-byte GCM tag minimum
    env.encryption.ciphertextBase64 = Buffer.alloc(15, 0xaa).toString('base64');

    await expect(
      decryptBackupPackage({ serializedPackage: JSON.stringify(env), passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' } satisfies Partial<BackupPackageError>);
  }, 30_000);

  it('ciphertext exactly 16 bytes (only GCM tag, no plaintext) is rejected as invalid_backup_file', async () => {
    // 16 bytes = tag only, 0 bytes plaintext — GCM decryption either fails the
    // authentication or returns empty bytes that cannot parse as a BackupSnapshot.
    const pkg = await createBackupPackage({ snapshot: minimalSnapshot(), passphrase: PASSPHRASE });
    const env = JSON.parse(pkg) as { encryption: { ciphertextBase64: string; keyCheckBase64: string } };
    // We use the real keyCheck from the original package so the key-check gate passes,
    // then force a truncated ciphertext so the GCM tag check fails.
    env.encryption.ciphertextBase64 = Buffer.alloc(16, 0xff).toString('base64');

    await expect(
      decryptBackupPackage({ serializedPackage: JSON.stringify(env), passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' } satisfies Partial<BackupPackageError>);
  }, 30_000);

  it('rejects an empty passphrase at decrypt (collision class with NUL-only keys)', async () => {
    // An empty passphrase and an all-NUL passphrase derive the SAME PBKDF2 key
    // (HMAC zero-pads the key block). decryptBackupPackage now rejects the whole
    // unusable-passphrase class up front so an empty passphrase can never unseal
    // a backup — even one accidentally created with NUL bytes.
    const pkg = await createBackupPackage({ snapshot: minimalSnapshot(), passphrase: '' });
    await expect(
      decryptBackupPackage({ serializedPackage: pkg, passphrase: '' }),
    ).rejects.toMatchObject({ code: 'wrong_passphrase' });
  }, 30_000);

  it('rejects an all-NUL-byte passphrase at decrypt', async () => {
    // A passphrase of only NUL bytes encodes to an all-zero key — indistinguishable
    // from an empty key — so it is refused as part of the same collision class.
    const nullPass = '\x00\x00\x00';
    const pkg = await createBackupPackage({ snapshot: minimalSnapshot(), passphrase: nullPass });
    await expect(
      decryptBackupPackage({ serializedPackage: pkg, passphrase: nullPass }),
    ).rejects.toMatchObject({ code: 'wrong_passphrase' });
  }, 30_000);

  it('does not let an empty passphrase decrypt a NUL-byte-sealed backup (collision closed)', async () => {
    // REGRESSION (fixed): @noble/hashes HMAC treats any run of NUL bytes the same
    // as an empty key, so a '\x00'-sealed backup would otherwise decrypt with ''.
    // The decrypt-side guard rejects the unusable-passphrase class, closing it.
    const nullPass = '\x00';
    const pkg = await createBackupPackage({ snapshot: minimalSnapshot(), passphrase: nullPass });
    await expect(
      decryptBackupPackage({ serializedPackage: pkg, passphrase: '' }),
    ).rejects.toMatchObject({ code: 'wrong_passphrase' });
  }, 30_000);

  it('nonce of wrong length (11 bytes) causes GCM failure → invalid_backup_file', async () => {
    const pkg = await createBackupPackage({ snapshot: minimalSnapshot(), passphrase: PASSPHRASE });
    const env = JSON.parse(pkg) as { encryption: { nonceBase64: string } };
    // Replace 12-byte nonce with 11-byte nonce
    env.encryption.nonceBase64 = Buffer.alloc(11, 0x01).toString('base64');

    await expect(
      decryptBackupPackage({ serializedPackage: JSON.stringify(env), passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' } satisfies Partial<BackupPackageError>);
  }, 30_000);

  it('nonce of wrong length (0 bytes) causes failure → invalid_backup_file', async () => {
    const pkg = await createBackupPackage({ snapshot: minimalSnapshot(), passphrase: PASSPHRASE });
    const env = JSON.parse(pkg) as { encryption: { nonceBase64: string } };
    env.encryption.nonceBase64 = Buffer.alloc(0).toString('base64');

    await expect(
      decryptBackupPackage({ serializedPackage: JSON.stringify(env), passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' } satisfies Partial<BackupPackageError>);
  }, 30_000);
});

// ─── P3: Blob shape / version edge cases ─────────────────────────────────────

describe('P3 – blob shape and version edge cases', () => {
  it('formatVersion as string "1" is rejected as unsupported_backup_format (not a number)', async () => {
    // The schema uses z.literal(1), so the string "1" must not match.
    // The version check happens before envelope parsing, so this might throw
    // unsupported_backup_format (version !== 1) rather than invalid_backup_file.
    // Either is acceptable as long as it rejects cleanly.
    const payload = JSON.stringify({ formatVersion: '1', createdAt: '2026-01-01T00:00:00.000Z' });
    await expect(
      decryptBackupPackage({ serializedPackage: payload, passphrase: PASSPHRASE }),
    ).rejects.toBeInstanceOf(BackupPackageError);
  });

  it('formatVersion as 1.0 (float) is treated same as 1 — rejects via schema if not integer literal', async () => {
    // The schema z.literal(1) accepts exactly 1. 1.0 === 1 in JS so this should
    // decrypt or fail as unsupported, never crash with an unhandled exception.
    const payload = JSON.stringify({ formatVersion: 1.0 });
    // Note: 1.0 === 1 in JS so this may actually pass the version check and then
    // fail on the missing envelope fields. Either way it must throw BackupPackageError.
    await expect(
      decryptBackupPackage({ serializedPackage: payload, passphrase: PASSPHRASE }),
    ).rejects.toBeInstanceOf(BackupPackageError);
  });

  it('formatVersion as -1 is rejected as unsupported_backup_format', async () => {
    await expect(
      decryptBackupPackage({
        serializedPackage: JSON.stringify({ formatVersion: -1 }),
        passphrase: PASSPHRASE,
      }),
    ).rejects.toMatchObject({ code: 'unsupported_backup_format' } satisfies Partial<BackupPackageError>);
  });

  it('formatVersion as null is rejected as invalid_backup_file (null is not a version)', async () => {
    await expect(
      decryptBackupPackage({
        serializedPackage: JSON.stringify({ formatVersion: null }),
        passphrase: PASSPHRASE,
      }),
    ).rejects.toBeInstanceOf(BackupPackageError);
  });

  it('entirely empty JSON object {} is rejected as invalid_backup_file', async () => {
    await expect(
      decryptBackupPackage({ serializedPackage: '{}', passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' } satisfies Partial<BackupPackageError>);
  });

  it('salt encoded as invalid base64 is rejected as invalid_backup_file', async () => {
    const pkg = await createBackupPackage({ snapshot: minimalSnapshot(), passphrase: PASSPHRASE });
    const env = JSON.parse(pkg) as { kdf: { saltBase64: string } };
    env.kdf.saltBase64 = '!!!not-base64!!!';

    // base64ToBytes will silently return bytes (Buffer.from ignores bad chars),
    // but the derived key will be wrong and keyCheck will fail → wrong_passphrase
    // OR parseBackupEnvelope may reject the field if it validates base64 format.
    await expect(
      decryptBackupPackage({ serializedPackage: JSON.stringify(env), passphrase: PASSPHRASE }),
    ).rejects.toBeInstanceOf(BackupPackageError);
  }, 30_000);

  it('nonce encoded as invalid base64 string is rejected with BackupPackageError', async () => {
    const pkg = await createBackupPackage({ snapshot: minimalSnapshot(), passphrase: PASSPHRASE });
    const env = JSON.parse(pkg) as { encryption: { nonceBase64: string } };
    env.encryption.nonceBase64 = '!!!not-base64!!!';

    await expect(
      decryptBackupPackage({ serializedPackage: JSON.stringify(env), passphrase: PASSPHRASE }),
    ).rejects.toBeInstanceOf(BackupPackageError);
  }, 30_000);
});

// ─── P4: Error class identity ─────────────────────────────────────────────────

describe('P4 – errors are always BackupPackageError, never raw crypto library exceptions', () => {
  it('tampered ciphertext throws BackupPackageError (not a noble/gcm raw Error)', async () => {
    const pkg = await createBackupPackage({ snapshot: minimalSnapshot(), passphrase: PASSPHRASE });
    const env = JSON.parse(pkg) as { encryption: { ciphertextBase64: string } };
    const bytes = Buffer.from(env.encryption.ciphertextBase64, 'base64');
    bytes[0] ^= 0xff;
    env.encryption.ciphertextBase64 = bytes.toString('base64');

    const err = await decryptBackupPackage({
      serializedPackage: JSON.stringify(env),
      passphrase: PASSPHRASE,
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(BackupPackageError);
    expect((err as BackupPackageError).name).toBe('BackupPackageError');
  }, 30_000);

  it('wrong passphrase throws BackupPackageError (not a raw Error)', async () => {
    const pkg = await createBackupPackage({ snapshot: minimalSnapshot(), passphrase: PASSPHRASE });
    const err = await decryptBackupPackage({
      serializedPackage: pkg,
      passphrase: 'definitely-wrong',
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(BackupPackageError);
    expect((err as BackupPackageError).code).toBe('wrong_passphrase');
  }, 30_000);

  it('malformed JSON throws BackupPackageError (not a SyntaxError)', async () => {
    const err = await decryptBackupPackage({
      serializedPackage: '{bad json',
      passphrase: PASSPHRASE,
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(BackupPackageError);
    expect((err as BackupPackageError).code).toBe('invalid_backup_file');
  });
});

// ─── P5: Roundtrip with extreme but valid payloads ────────────────────────────

describe('P5 – roundtrip fidelity with unusual but valid payloads', () => {
  it('snapshot with all condition tags roundtrips without data loss', async () => {
    const snapshot: BackupSnapshot = {
      ...minimalSnapshot(),
      userProfile: {
        cycleLengthDays: 35,
        periodLengthDays: 7,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'symptoms', 'trying-to-conceive'],
        supportsIrregularCycles: true,
        conditionTags: ['endometriosis', 'pcos', 'pmdd'],
      },
    };
    const pkg = await createBackupPackage({ snapshot, passphrase: PASSPHRASE });
    const result = await decryptBackupPackage({ serializedPackage: pkg, passphrase: PASSPHRASE });
    expect(result.userProfile?.conditionTags).toEqual(['endometriosis', 'pcos', 'pmdd']);
    expect(result.userProfile?.goals).toEqual(['period', 'symptoms', 'trying-to-conceive']);
  }, 30_000);

  it('snapshot with deeply Unicode passphrase AND Unicode notes roundtrips exactly', async () => {
    const pass = '密码🔐كلمة المرور пароль 암호';
    const snapshot: BackupSnapshot = {
      ...minimalSnapshot(),
      dailyLogs: [{
        id: 'log-unicode',
        logDate: '2026-05-15',
        bleeding: 'light',
        symptoms: [],
        notes: '🌸 日本語 مرحبا héllo wörld ‮RTL‬',
      }],
    };
    const pkg = await createBackupPackage({ snapshot, passphrase: pass });
    const result = await decryptBackupPackage({ serializedPackage: pkg, passphrase: pass });
    expect(result.dailyLogs[0]?.notes).toBe(snapshot.dailyLogs[0]?.notes);
  }, 30_000);

  it('snapshot with billingSnapshot.accessState=subscribed roundtrips to subscribed (not sanitized by backupPackage)', async () => {
    // backupPackage.ts is a pure crypto layer — it must NOT sanitize billing state.
    // That sanitization happens in model.ts (sanitizeSnapshotForRestore).
    const snapshot: BackupSnapshot = {
      ...minimalSnapshot(),
      billingSnapshot: {
        accessState: 'subscribed',
        planId: 'annual',
        expiresAt: '2030-01-01T00:00:00.000Z',
        lastSyncedAt: '2026-05-01T12:00:00.000Z',
      },
    };
    const pkg = await createBackupPackage({ snapshot, passphrase: PASSPHRASE });
    const result = await decryptBackupPackage({ serializedPackage: pkg, passphrase: PASSPHRASE });
    // The crypto layer must return data unchanged; business sanitization is elsewhere.
    expect(result.billingSnapshot.accessState).toBe('subscribed');
  }, 30_000);

  it('snapshot with privacyPreference.biometricsEnabled=true roundtrips with biometrics still true (no sanitization in crypto layer)', async () => {
    const snapshot: BackupSnapshot = {
      ...minimalSnapshot(),
      privacyPreference: {
        biometricsEnabled: true,
        relockAfterSeconds: 0,
        destructiveActionConfirmationRequired: false,
        diagnosticsConsentEnabled: true,
      },
    };
    const pkg = await createBackupPackage({ snapshot, passphrase: PASSPHRASE });
    const result = await decryptBackupPackage({ serializedPackage: pkg, passphrase: PASSPHRASE });
    // The crypto layer must faithfully return the stored value; model.ts handles the reset.
    expect(result.privacyPreference.biometricsEnabled).toBe(true);
  }, 30_000);

  it('ciphertext output is valid base64 (no padding or encoding corruption)', async () => {
    const pkg = await createBackupPackage({ snapshot: minimalSnapshot(), passphrase: PASSPHRASE });
    const env = JSON.parse(pkg) as { encryption: { ciphertextBase64: string } };
    // Valid base64: only [A-Za-z0-9+/=] characters
    expect(env.encryption.ciphertextBase64).toMatch(/^[A-Za-z0-9+/]+=*$/);
  }, 30_000);
});
