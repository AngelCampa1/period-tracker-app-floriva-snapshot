/**
 * Long-tenure probes for backup at scale (workstream E, Phase 1).
 *
 * Resolution probes: the original suspect was correctness/timing of a full
 * year of data through the encrypted backup round trip. Uses the committed
 * 12-month long-tenure snapshot fixture (305 daily logs, built from
 * tenure-12mo-regular — see tests/fixtures/data-portability/README.md).
 *
 * Findings ledger: docs/qa/2026-07-06-long-tenure-sweep/findings.md
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  createBackupPackage,
  decryptBackupPackage,
} from '@/src/features/backup/backupPackage';
import type { BackupSnapshot } from '@/src/types/domain';

const fixtureRoot = path.resolve(__dirname, '../../fixtures/data-portability');

function readLongTenureSnapshot(): BackupSnapshot {
  return JSON.parse(
    fs.readFileSync(
      path.join(fixtureRoot, 'backup/floriva-long-tenure-12mo.snapshot.json'),
      'utf8',
    ),
  ) as BackupSnapshot;
}

describe('RESOLVED — 12-month backup snapshot round-trips losslessly', () => {
  it('decrypt(create(snapshot)) deep-equals the original 305-log snapshot', async () => {
    const snapshot = readLongTenureSnapshot();
    expect(snapshot.dailyLogs).toHaveLength(305);

    const serializedPackage = await createBackupPackage({
      snapshot,
      passphrase: 'long-tenure-probe-passphrase',
    });
    const restored = await decryptBackupPackage({
      serializedPackage,
      passphrase: 'long-tenure-probe-passphrase',
    });

    // Full-fidelity round trip: every log (including >300-char notes, TTC
    // observations, and birth-control events) survives encryption intact.
    expect(restored).toEqual(snapshot);
  }, 60_000);

  it('create + decrypt each complete within a generous CI bound at full-year volume', async () => {
    // Observed on the reference machine (Phase 1, 2026-07-06): create
    // ~481ms, decrypt ~482ms, package ~88KB for 305 logs — dominated by the
    // fixed PBKDF2 cost (210k iterations), NOT by data volume, so tenure
    // growth does not meaningfully slow the backup path. Bounds are ~20x
    // observed to stay CI-safe while catching a pathological regression.
    const snapshot = readLongTenureSnapshot();

    const createStartedAt = Date.now();
    const serializedPackage = await createBackupPackage({
      snapshot,
      passphrase: 'long-tenure-probe-passphrase',
    });
    const createMs = Date.now() - createStartedAt;

    const decryptStartedAt = Date.now();
    await decryptBackupPackage({
      serializedPackage,
      passphrase: 'long-tenure-probe-passphrase',
    });
    const decryptMs = Date.now() - decryptStartedAt;

    expect(createMs).toBeLessThan(10_000);
    expect(decryptMs).toBeLessThan(10_000);
    // Package stays comfortably shareable (order-of-magnitude guard).
    expect(serializedPackage.length).toBeLessThan(1_000_000);
  }, 60_000);
});
