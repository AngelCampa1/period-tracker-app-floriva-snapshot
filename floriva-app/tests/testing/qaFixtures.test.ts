import fs from 'node:fs';
import path from 'node:path';

import { decryptBackupPackage } from '@/src/features/backup/backupPackage';
import { parseClueImport, parseFloImport } from '@/src/lib/parsing/importParsers';
import {
  QA_RICH_HISTORY_REFERENCE_TODAY_ISO,
  createQaRichHistoryBackupSnapshot,
} from '@/src/testing/qaFixtures';

const fixtureRoot = path.resolve(__dirname, '../fixtures/data-portability');

function readFixture(relativePath: string) {
  return fs.readFileSync(path.join(fixtureRoot, relativePath), 'utf8');
}

describe('QA fixture artifacts', () => {
  it('ships a committed Clue fixture that still parses cleanly', () => {
    const result = parseClueImport(JSON.parse(readFixture('import/clue-rich-history.cluedata')) as unknown);

    expect(result.entries.length).toBeGreaterThanOrEqual(2);
    expect(result.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          logDate: '2026-04-12',
        }),
      ]),
    );
  });

  it('ships a committed Flo fixture that still parses cleanly', () => {
    const result = parseFloImport(JSON.parse(readFixture('import/flo-rich-history.json')) as unknown);

    expect(result.entries.length).toBeGreaterThanOrEqual(1);
    expect(result.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          logDate: '2026-04-14',
        }),
      ]),
    );
  });

  it('ships a raw backup snapshot and encrypted restore package that stay in sync', async () => {
    const rawSnapshot = JSON.parse(readFixture('backup/floriva-rich-history.snapshot.json')) as unknown;
    const encryptedPackage = readFixture('backup/floriva-rich-history.floriva');

    await expect(
      decryptBackupPackage({
        serializedPackage: encryptedPackage,
        passphrase: 'fixture-passphrase',
      }),
    ).resolves.toEqual(rawSnapshot);
  });

  it('builds a QA backup snapshot that only tags imported days with the fixture import session', () => {
    const snapshot = createQaRichHistoryBackupSnapshot(QA_RICH_HISTORY_REFERENCE_TODAY_ISO);
    const importedDates = snapshot.dailyLogs
      .filter((entry) => entry.importSessionId === 'qa-import-clue-apr-2026')
      .map((entry) => entry.logDate);

    expect(snapshot.formatVersion).toBe(1);
    expect(importedDates).toEqual(['2026-04-12', '2026-04-13']);
    expect(
      snapshot.dailyLogs.find((entry) => entry.logDate === '2026-04-14')?.importSessionId,
    ).toBeUndefined();
  });

  // Phase 0 finding (workstream E, docs/qa/2026-07-06-long-tenure-sweep/README.md):
  // the Clue/Flo *file* import parsers apply no age cutoff at all -- only the
  // manual quick-entry path enforces a 12-month lookback. These fixtures ship
  // rows dated well over 12 months before any plausible "today" and assert
  // the parser still imports every row, proving the asymmetry stays true.
  it('imports every row of an old-dated (>12mo) Clue fixture with no rows skipped', () => {
    const result = parseClueImport(
      JSON.parse(readFixture('import/clue-older-than-12-months.cluedata')) as unknown,
    );

    expect(result.entries).toHaveLength(3);
    expect(result.skippedRows).toHaveLength(0);
    expect(result.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ logDate: '2019-02-11' }),
        expect.objectContaining({ logDate: '2019-02-12' }),
        expect.objectContaining({ logDate: '2019-02-13' }),
      ]),
    );
  });

  it('imports every row of an old-dated (>12mo) Flo fixture with no rows skipped', () => {
    const result = parseFloImport(
      JSON.parse(readFixture('import/flo-older-than-12-months.json')) as unknown,
    );

    expect(result.entries).toHaveLength(2);
    expect(result.skippedRows).toHaveLength(0);
    expect(result.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ logDate: '2018-11-05' }),
        expect.objectContaining({ logDate: '2018-11-06' }),
      ]),
    );
  });

  it('ships a 12-month long-tenure backup snapshot and encrypted package that stay in sync', async () => {
    const rawSnapshot = JSON.parse(
      readFixture('backup/floriva-long-tenure-12mo.snapshot.json'),
    ) as { dailyLogs: unknown[] };
    const encryptedPackage = readFixture('backup/floriva-long-tenure-12mo.floriva');

    await expect(
      decryptBackupPackage({
        serializedPackage: encryptedPackage,
        passphrase: 'fixture-passphrase',
      }),
    ).resolves.toEqual(rawSnapshot);

    expect(rawSnapshot.dailyLogs.length).toBeGreaterThanOrEqual(300);
  });
});
