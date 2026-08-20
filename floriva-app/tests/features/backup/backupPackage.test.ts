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

const textEncoder = new TextEncoder();

function createSnapshotFixture(): BackupSnapshot {
  return {
    formatVersion: 1,
    exportedAt: '2026-04-10T15:00:00.000Z',
    appPreferences: {
      ...defaultAppPreferences,
      hasCompletedOnboarding: true,
      themePreference: 'system',
      localePreference: 'system',
    },
    billingSnapshot: {
      accessState: 'subscribed',
      planId: 'annual',
      firstChargeAt: '2026-04-15T09:00:00.000Z',
      expiresAt: '2027-04-15T09:00:00.000Z',
      lastSyncedAt: '2026-04-10T09:00:00.000Z',
    },
    userProfile: {
      cycleLengthDays: 29,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-04-05',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: ['pmdd'],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
    },
    reminderPreferences: [
      {
        kind: 'daily-log',
        enabled: true,
        hour: 20,
        minute: 0,
        schedule: {
          cadence: 'daily',
        },
      },
    ],
    privacyPreference: {
      biometricsEnabled: true,
      relockAfterSeconds: 300,
      destructiveActionConfirmationRequired: true,
      diagnosticsConsentEnabled: false,
    },
    importSessions: [],
    dailyLogs: [
      {
        id: 'backup-log-1',
        logDate: '2026-04-09',
        bleeding: 'medium',
        symptoms: ['cramps'],
        notes: 'Backup fixture entry.',
      },
    ],
  };
}

async function createPackageFixtureWithIterations(
  snapshot: BackupSnapshot,
  passphrase: string,
  iterations: number,
) {
  const salt = Crypto.getRandomBytes(16);
  const nonce = Crypto.getRandomBytes(12);
  const derivedKey = await pbkdf2Async(sha256, textEncoder.encode(passphrase), salt, {
    c: iterations,
    dkLen: 32,
  });
  const keyCheck = sha256(
    new Uint8Array([
      ...derivedKey,
      ...textEncoder.encode('floriva-backup-key-check'),
    ]),
  ).slice(0, 32);
  const ciphertext = gcm(derivedKey, nonce).encrypt(
    textEncoder.encode(JSON.stringify(snapshot)),
  );

  return JSON.stringify({
    formatVersion: 1,
    createdAt: '2026-04-10T15:30:00.000Z',
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

describe('backup package crypto', () => {
  it('encrypts a backup snapshot into a versioned package and decrypts it with the correct passphrase', async () => {
    const snapshot = createSnapshotFixture();

    const encodedPackage = await createBackupPackage({
      snapshot,
      passphrase: 'privacy-first-passphrase',
    });

    await expect(
      decryptBackupPackage({
        serializedPackage: encodedPackage,
        passphrase: 'privacy-first-passphrase',
      }),
    ).resolves.toEqual(snapshot);
  });

  it('rejects the wrong passphrase without exposing the plaintext snapshot', async () => {
    const snapshot = createSnapshotFixture();

    const encodedPackage = await createBackupPackage({
      snapshot,
      passphrase: 'privacy-first-passphrase',
    });

    await expect(
      decryptBackupPackage({
        serializedPackage: encodedPackage,
        passphrase: 'wrong-passphrase',
      }),
    ).rejects.toMatchObject({
      code: 'wrong_passphrase',
    } satisfies Partial<BackupPackageError>);
  });

  it('rejects unsupported backup format versions before decrypting', async () => {
    const encodedPackage = JSON.stringify({
      formatVersion: 999,
      createdAt: '2026-04-10T15:00:00.000Z',
      kdf: {
        algorithm: 'pbkdf2-sha256',
        iterations: 210000,
        saltBase64: 'ZmFrZS1zYWx0',
      },
      encryption: {
        algorithm: 'aes-256-gcm',
        nonceBase64: 'ZmFrZS1ub25jZQ==',
      },
      ciphertextBase64: 'ZmFrZS1jaXBoZXJ0ZXh0',
    });

    await expect(
      decryptBackupPackage({
        serializedPackage: encodedPackage,
        passphrase: 'privacy-first-passphrase',
      }),
    ).rejects.toMatchObject({
      code: 'unsupported_backup_format',
    } satisfies Partial<BackupPackageError>);
  });

  it('rejects JSON documents without a backup format as invalid files', async () => {
    await expect(
      decryptBackupPackage({
        serializedPackage: '{}',
        passphrase: 'privacy-first-passphrase',
      }),
    ).rejects.toMatchObject({
      code: 'invalid_backup_file',
    } satisfies Partial<BackupPackageError>);
  });

  it('rejects corrupted package payloads that cannot be decrypted safely', async () => {
    const snapshot = createSnapshotFixture();

    const encodedPackage = await createBackupPackage({
      snapshot,
      passphrase: 'privacy-first-passphrase',
    });
    const parsedPackage = JSON.parse(encodedPackage) as {
      encryption: {
        ciphertextBase64: string;
      };
    };

    parsedPackage.encryption.ciphertextBase64 = `${parsedPackage.encryption.ciphertextBase64.slice(0, -4)}ABCD`;

    await expect(
      decryptBackupPackage({
        serializedPackage: JSON.stringify(parsedPackage),
        passphrase: 'privacy-first-passphrase',
      }),
    ).rejects.toMatchObject({
      code: 'invalid_backup_file',
    } satisfies Partial<BackupPackageError>);
  });

  it('rejects malformed envelope metadata before deriving a key', async () => {
    const malformedEnvelope = JSON.stringify({
      formatVersion: 1,
      createdAt: '2026-04-10T15:00:00.000Z',
      kdf: {
        algorithm: 'pbkdf2-sha256',
        iterations: 210000,
        saltBase64: '',
      },
      encryption: {
        algorithm: 'aes-256-gcm',
        nonceBase64: 'ZmFrZS1ub25jZQ==',
        ciphertextBase64: 'ZmFrZS1jaXBoZXJ0ZXh0',
        keyCheckBase64: 'ZmFrZS1rZXktY2hlY2s=',
      },
    });

    await expect(
      decryptBackupPackage({
        serializedPackage: malformedEnvelope,
        passphrase: 'privacy-first-passphrase',
      }),
    ).rejects.toMatchObject({
      code: 'invalid_backup_file',
    } satisfies Partial<BackupPackageError>);
  });

  it('rejects invalid snapshots before creating an encrypted package', async () => {
    const invalidSnapshot = {
      ...createSnapshotFixture(),
      dailyLogs: [
        {
          id: '',
          logDate: 'not-a-date',
          bleeding: 'medium',
        },
      ],
    };

    await expect(
      createBackupPackage({
        snapshot: invalidSnapshot as BackupSnapshot,
        passphrase: 'privacy-first-passphrase',
      }),
    ).rejects.toMatchObject({
      code: 'invalid_backup_file',
    } satisfies Partial<BackupPackageError>);
  });

  it('uses the serialized PBKDF2 iteration metadata when decrypting a package', async () => {
    const snapshot = createSnapshotFixture();
    const encodedPackage = await createPackageFixtureWithIterations(
      snapshot,
      'privacy-first-passphrase',
      125000,
    );

    await expect(
      decryptBackupPackage({
        serializedPackage: encodedPackage,
        passphrase: 'privacy-first-passphrase',
      }),
    ).resolves.toEqual(snapshot);
  });

  it('restores legacy backup payloads that predate interaction feedback preferences', async () => {
    const legacySnapshot = {
      ...createSnapshotFixture(),
      appPreferences: {
        hasCompletedOnboarding: true,
        deferredBiometricsSetup: false,
        deferredReminderSetup: false,
        deferredImportSetup: false,
        themePreference: 'system',
        localePreference: 'system',
      },
    };

    const encodedPackage = await createPackageFixtureWithIterations(
      legacySnapshot as BackupSnapshot,
      'privacy-first-passphrase',
      125000,
    );

    await expect(
      decryptBackupPackage({
        serializedPackage: encodedPackage,
        passphrase: 'privacy-first-passphrase',
      }),
    ).resolves.toEqual({
      ...createSnapshotFixture(),
      appPreferences: {
        ...createSnapshotFixture().appPreferences,
        themePreference: 'system',
        localePreference: 'system',
      },
    });
  });
});
