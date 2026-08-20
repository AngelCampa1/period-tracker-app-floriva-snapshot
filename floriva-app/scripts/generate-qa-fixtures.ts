import fs from 'node:fs/promises';
import path from 'node:path';
import { createCipheriv, pbkdf2Sync, createHash } from 'node:crypto';

import {
  QA_RICH_HISTORY_REFERENCE_TODAY_ISO,
  createQaRichHistoryBackupSnapshot,
  qaClueImportFixture,
  qaFixturePassphrase,
  qaFloImportFixture,
} from '../src/testing/qaFixtures';
import { buildTenureDataset } from '../src/testing/tenureFixtures';
import {
  defaultAppPreferences,
  defaultPrivacyPreference,
} from '../src/db/domainDefaults';
import type { BackupSnapshot } from '../src/types/domain';

const backupSalt = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
const backupNonce = Buffer.from('101112131415161718191a1b', 'hex');
const backupIterations = 210000;

// Distinct salt/nonce pair for the 12-month long-tenure backup fixture below
// (Phase 2, workstream E) -- reusing backupSalt/backupNonce would still be
// safe here (the passphrase is the same but AES-GCM nonce reuse must never
// happen even across unrelated ciphertexts encrypted under keys derived from
// the same salt+passphrase), so this fixture gets its own salt and nonce
// rather than relying on that argument.
const longTenureBackupSalt = Buffer.from('aabbccddeeff00112233445566778899', 'hex');
const longTenureBackupNonce = Buffer.from('202122232425262728292a2b', 'hex');

// Fixed reference "today" for fixture generation (NOT the live current
// date): fixture output must be byte-identical across repeated
// `pnpm fixtures:generate` runs regardless of when the script is actually
// executed, matching the existing committed fixtures' fixed-date convention
// (see `createdAt: '2026-04-16T18:45:00.000Z'` above, unchanged).
const LONG_TENURE_REFERENCE_TODAY_ISO = '2026-04-16';

function createDeterministicBackupPackage(
  serializedSnapshot: string,
  passphrase: string,
  createdAt: string,
  salt: Buffer = backupSalt,
  nonce: Buffer = backupNonce,
) {
  const derivedKey = pbkdf2Sync(passphrase, salt, backupIterations, 32, 'sha256');
  const cipher = createCipheriv('aes-256-gcm', derivedKey, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(serializedSnapshot, 'utf8'),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const keyCheck = createHash('sha256')
    .update(derivedKey)
    .update('floriva-backup-key-check')
    .digest()
    .subarray(0, 32);

  return JSON.stringify({
    formatVersion: 1,
    createdAt,
    kdf: {
      algorithm: 'pbkdf2-sha256',
      iterations: backupIterations,
      saltBase64: salt.toString('base64'),
    },
    encryption: {
      algorithm: 'aes-256-gcm',
      nonceBase64: nonce.toString('base64'),
      ciphertextBase64: ciphertext.toString('base64'),
      keyCheckBase64: keyCheck.toString('base64'),
    },
  });
}

/**
 * Builds a 12-month long-tenure backup snapshot (Phase 2, workstream E) from
 * the deterministic `tenure-12mo-regular` dataset, anchored on the fixed
 * fixture reference date above (not the live clock) so the emitted `.floriva`
 * file is byte-identical across regenerations.
 */
function createLongTenureBackupSnapshot(): BackupSnapshot {
  const dataset = buildTenureDataset('tenure-12mo-regular', LONG_TENURE_REFERENCE_TODAY_ISO);

  return {
    formatVersion: 1,
    exportedAt: `${LONG_TENURE_REFERENCE_TODAY_ISO}T12:00:00.000Z`,
    appPreferences: {
      ...defaultAppPreferences,
      hasCompletedOnboarding: true,
      deferredBiometricsSetup: true,
      deferredReminderSetup: false,
      deferredImportSetup: false,
    },
    billingSnapshot: {
      accessState: 'needs_purchase',
      lastSyncedAt: `${LONG_TENURE_REFERENCE_TODAY_ISO}T11:00:00.000Z`,
    },
    userProfile: dataset.profile,
    reminderPreferences: dataset.reminderPreferences,
    privacyPreference: {
      ...defaultPrivacyPreference,
      biometricsEnabled: false,
      relockAfterSeconds: 300,
    },
    importSessions: [],
    dailyLogs: dataset.dailyLogs,
  };
}

/**
 * Builds a Clue-shaped import fixture whose every row is dated well over 12
 * months before the fixture reference date (Phase 0 finding: the Clue/Flo
 * file-import parsers apply NO age cutoff -- only the manual quick-entry
 * path enforces the 12-month lookback via `getManualHistoryLookbackStartIso`
 * in `src/features/import/ImportFlowProvider.tsx`). This fixture exists to
 * prove, and let the sweep exercise, that such a file still imports in full
 * rather than being silently truncated.
 */
function createOldDatedClueImportFixture() {
  return {
    data: [
      {
        day: '2019-02-11T06:00:00.000Z',
        flow: 'medium',
        symptoms: ['cramps'],
        note: 'Old Clue export row -- more than 12 months before fixture reference date.',
      },
      {
        day: '2019-02-12T06:00:00.000Z',
        flow: 'light',
        emotion: 'calm',
        symptoms: ['fatigue'],
      },
      {
        day: '2019-02-13T06:00:00.000Z',
        period: 'none',
        emotion: 'happy',
      },
    ],
  } as const;
}

/**
 * Builds a Flo-shaped import fixture whose every row is dated well over 12
 * months before the fixture reference date -- see
 * `createOldDatedClueImportFixture` doc comment for the Phase 0 rationale.
 */
function createOldDatedFloImportFixture() {
  return {
    values: [
      {
        recordedAt: '2018-11-05T08:00:00.000Z',
        category: 'flow',
        value: 'heavy',
      },
      {
        recordedAt: '2018-11-05T08:01:00.000Z',
        category: 'symptom',
        value: ['bloating'],
      },
      {
        recordedAt: '2018-11-06T08:00:00.000Z',
        category: 'flow',
        value: 'light',
      },
      {
        recordedAt: '2018-11-06T08:01:00.000Z',
        category: 'mood',
        value: 'steady',
      },
    ],
  } as const;
}

async function ensureDirectory(directoryPath: string) {
  await fs.mkdir(directoryPath, { recursive: true });
}

async function writeFixture(relativePath: string, contents: string) {
  const absolutePath = path.resolve(__dirname, '..', relativePath);
  await ensureDirectory(path.dirname(absolutePath));
  await fs.writeFile(absolutePath, contents, 'utf8');
}

async function main() {
  const backupSnapshot = createQaRichHistoryBackupSnapshot(QA_RICH_HISTORY_REFERENCE_TODAY_ISO);
  const serializedBackupPackage = createDeterministicBackupPackage(
    JSON.stringify(backupSnapshot),
    qaFixturePassphrase,
    '2026-04-16T18:45:00.000Z',
  );

  const longTenureBackupSnapshot = createLongTenureBackupSnapshot();
  const serializedLongTenureBackupPackage = createDeterministicBackupPackage(
    JSON.stringify(longTenureBackupSnapshot),
    qaFixturePassphrase,
    `${LONG_TENURE_REFERENCE_TODAY_ISO}T12:15:00.000Z`,
    longTenureBackupSalt,
    longTenureBackupNonce,
  );

  const oldDatedClueImportFixture = createOldDatedClueImportFixture();
  const oldDatedFloImportFixture = createOldDatedFloImportFixture();

  await writeFixture(
    'tests/fixtures/data-portability/import/clue-rich-history.cluedata',
    JSON.stringify(qaClueImportFixture, null, 2),
  );
  await writeFixture(
    'tests/fixtures/data-portability/import/flo-rich-history.json',
    JSON.stringify(qaFloImportFixture, null, 2),
  );
  await writeFixture(
    'tests/fixtures/data-portability/import/clue-older-than-12-months.cluedata',
    JSON.stringify(oldDatedClueImportFixture, null, 2),
  );
  await writeFixture(
    'tests/fixtures/data-portability/import/flo-older-than-12-months.json',
    JSON.stringify(oldDatedFloImportFixture, null, 2),
  );
  await writeFixture(
    'tests/fixtures/data-portability/backup/floriva-rich-history.snapshot.json',
    JSON.stringify(backupSnapshot, null, 2),
  );
  await writeFixture(
    'tests/fixtures/data-portability/backup/floriva-rich-history.floriva',
    serializedBackupPackage,
  );
  await writeFixture(
    'tests/fixtures/data-portability/backup/floriva-long-tenure-12mo.snapshot.json',
    JSON.stringify(longTenureBackupSnapshot, null, 2),
  );
  await writeFixture(
    'tests/fixtures/data-portability/backup/floriva-long-tenure-12mo.floriva',
    serializedLongTenureBackupPackage,
  );
  await writeFixture(
    'tests/fixtures/data-portability/README.md',
    [
      '# QA Data Portability Fixtures',
      '',
      '- `import/clue-rich-history.cluedata`: committed Clue import fixture.',
      '- `import/flo-rich-history.json`: committed Flo import fixture.',
      '- `import/clue-older-than-12-months.cluedata`: Clue export fixture whose rows',
      '  all predate the fixture reference date by more than 12 months. Exists to',
      '  prove (workstream E / Phase 0 finding) that the Clue/Flo file-import',
      '  parsers apply no age cutoff -- only the manual quick-entry import path',
      '  enforces a 12-month lookback.',
      '- `import/flo-older-than-12-months.json`: same purpose as above, Flo-shaped.',
      '- `backup/floriva-rich-history.snapshot.json`: decrypted backup snapshot fixture.',
      '- `backup/floriva-rich-history.floriva`: encrypted Floriva backup package.',
      '- `backup/floriva-long-tenure-12mo.snapshot.json`: decrypted 12-month',
      '  long-tenure backup snapshot (workstream E, Phase 2), built from the',
      '  deterministic `tenure-12mo-regular` fixture in `src/testing/tenureFixtures.ts`.',
      '- `backup/floriva-long-tenure-12mo.floriva`: encrypted package for the',
      '  12-month long-tenure snapshot above (its own salt/nonce, same passphrase).',
      '- Backup passphrase (all `.floriva` packages above): `fixture-passphrase`.',
      '',
      'Regenerate with `pnpm fixtures:generate`.',
      '',
    ].join('\n'),
  );
}

void main();
