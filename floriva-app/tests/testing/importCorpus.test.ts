import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  ensureImportCorpusLayout,
  getImportCorpusRoot,
  profileImportSampleFile,
  scanImportCorpus,
} from '@/src/testing/importCorpus';

const fixtureRoot = path.resolve(__dirname, '../fixtures/data-portability/import');

async function createTempCorpusRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'floriva-import-corpus-'));
}

async function writeSample({
  corpusRoot,
  source,
  status,
  fileName,
  contents,
  manifest,
}: {
  corpusRoot: string;
  source: 'clue' | 'flo';
  status: 'candidate' | 'reviewed' | 'rejected';
  fileName: string;
  contents: string;
  manifest?: Record<string, unknown>;
}) {
  const directoryPath = path.join(corpusRoot, source, status);
  const filePath = path.join(directoryPath, fileName);
  const manifestPath = path.join(
    directoryPath,
    `${fileName.replace(/\.[^.]+$/u, '')}.manifest.json`,
  );

  await fs.mkdir(directoryPath, { recursive: true });
  await fs.writeFile(filePath, contents, 'utf8');

  if (manifest) {
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  }

  return {
    filePath,
    manifestPath,
  };
}

describe('import corpus tooling', () => {
  it('resolves the local corpus root under .local/import-corpus', () => {
    expect(getImportCorpusRoot('/tmp/floriva-app')).toBe('/tmp/floriva-app/.local/import-corpus');
  });

  it('profiles current Clue and Flo-style fixtures as clean samples', async () => {
    const corpusRoot = await createTempCorpusRoot();
    const clueFixture = await fs.readFile(path.join(fixtureRoot, 'clue-rich-history.cluedata'), 'utf8');
    const floFixture = await fs.readFile(path.join(fixtureRoot, 'flo-rich-history.json'), 'utf8');

    const clueSample = await writeSample({
      corpusRoot,
      source: 'clue',
      status: 'reviewed',
      fileName: 'measurements.json',
      contents: clueFixture,
      manifest: {
        schemaVersion: 1,
        sourceUrl: 'https://example.com/clue-sample',
        retrievalDate: '2026-04-16',
        fileName: 'measurements.json',
        claimedApp: 'clue',
        discoveredContainerShape: 'object:data[]',
        sha256: 'fill-me',
        trustNotes: 'Synthetic sample for current Clue-style shape.',
        reviewerDecision: 'accepted',
      },
    });
    const floSample = await writeSample({
      corpusRoot,
      source: 'flo',
      status: 'reviewed',
      fileName: 'flo-export.json',
      contents: floFixture,
      manifest: {
        schemaVersion: 1,
        sourceUrl: 'https://example.com/flo-sample',
        retrievalDate: '2026-04-16',
        fileName: 'flo-export.json',
        claimedApp: 'flo',
        discoveredContainerShape: 'object:values[]',
        sha256: 'fill-me',
        trustNotes: 'Synthetic sample for current Flo-style shape.',
        reviewerDecision: 'accepted',
      },
    });

    const clueProfile = await profileImportSampleFile({
      filePath: clueSample.filePath,
      source: 'clue',
      status: 'reviewed',
    });
    const floProfile = await profileImportSampleFile({
      filePath: floSample.filePath,
      source: 'flo',
      status: 'reviewed',
    });

    expect(clueProfile.parseResult).toBe('clean');
    expect(clueProfile.topLevelContainerShape).toBe('object:data[]');
    expect(clueProfile.likelyDateKeys).toContain('day');
    expect(clueProfile.likelyMetricKeys).toEqual(expect.arrayContaining(['flow', 'period']));

    expect(floProfile.parseResult).toBe('clean');
    expect(floProfile.topLevelContainerShape).toBe('object:values[]');
    expect(floProfile.likelyDateKeys).toContain('recordedAt');
    expect(floProfile.likelyMetricKeys).toContain('category');
  });

  it('creates the expected local corpus directory layout for clue and flo statuses', async () => {
    const corpusRoot = await createTempCorpusRoot();
    const layoutPaths = await ensureImportCorpusLayout(corpusRoot);

    await expect(fs.stat(path.join(corpusRoot, 'clue', 'candidate'))).resolves.toMatchObject({
      isDirectory: expect.any(Function),
    });
    await expect(fs.stat(path.join(corpusRoot, 'flo', 'reviewed'))).resolves.toMatchObject({
      isDirectory: expect.any(Function),
    });
    expect(layoutPaths).toEqual(
      expect.arrayContaining([
        path.join(corpusRoot, 'clue', 'candidate'),
        path.join(corpusRoot, 'clue', 'reviewed'),
        path.join(corpusRoot, 'clue', 'rejected'),
        path.join(corpusRoot, 'flo', 'candidate'),
        path.join(corpusRoot, 'flo', 'reviewed'),
        path.join(corpusRoot, 'flo', 'rejected'),
      ]),
    );
  });

  it('classifies partial, unsupported, and invalid sample outcomes without silent drops', async () => {
    const corpusRoot = await createTempCorpusRoot();

    const partialSample = await writeSample({
      corpusRoot,
      source: 'clue',
      status: 'candidate',
      fileName: 'partial.json',
      contents: JSON.stringify({
        data: [
          {
            day: '2026-04-02T05:00:00.000Z',
            flow: 'light',
            symptoms: ['cramps', 'not-a-symptom'],
          },
          {
            day: 'broken-date',
            flow: 'medium',
          },
        ],
      }),
    });
    const unsupportedSample = await writeSample({
      corpusRoot,
      source: 'flo',
      status: 'candidate',
      fileName: 'unsupported.json',
      contents: JSON.stringify({
        events: [],
      }),
    });
    const invalidSample = await writeSample({
      corpusRoot,
      source: 'flo',
      status: 'candidate',
      fileName: 'invalid.json',
      contents: '{not json',
    });

    await expect(
      profileImportSampleFile({
        filePath: partialSample.filePath,
        source: 'clue',
        status: 'candidate',
      }),
    ).resolves.toMatchObject({
      parseResult: 'partial',
      warningCount: 1,
      skippedRowCount: 1,
    });

    await expect(
      profileImportSampleFile({
        filePath: unsupportedSample.filePath,
        source: 'flo',
        status: 'candidate',
      }),
    ).resolves.toMatchObject({
      parseResult: 'unsupported',
    });

    await expect(
      profileImportSampleFile({
        filePath: invalidSample.filePath,
        source: 'flo',
        status: 'candidate',
      }),
    ).resolves.toMatchObject({
      parseResult: 'invalid',
    });
  });

  it('profiles supported Flo cycle-container shapes without flagging them as out-of-assumption deltas', async () => {
    const corpusRoot = await createTempCorpusRoot();

    const cycleSample = await writeSample({
      corpusRoot,
      source: 'flo',
      status: 'candidate',
      fileName: 'flo-cycle-container.json',
      contents: JSON.stringify({
        operationalData: {
          cycles: [
            {
              period_start_date: '2026-04-10T00:00:00.000Z',
              period_end_date: '2026-04-12T00:00:00.000Z',
            },
          ],
        },
      }),
      manifest: {
        schemaVersion: 1,
        sourceUrl: 'https://example.com/flo-cycle-sample',
        retrievalDate: '2026-04-17',
        fileName: 'flo-cycle-container.json',
        claimedApp: 'flo',
        discoveredContainerShape: 'object:operationalData',
        sha256: 'fill-me',
        trustNotes: 'Public Flo cycle container sample.',
        reviewerDecision: 'pending',
      },
    });

    await expect(
      profileImportSampleFile({
        filePath: cycleSample.filePath,
        source: 'flo',
        status: 'candidate',
      }),
    ).resolves.toMatchObject({
      parseResult: 'clean',
      topLevelContainerShape: 'object:operationalData',
      likelyDateKeys: ['period_end_date', 'period_start_date'],
      fieldShapeDeltas: expect.arrayContaining([
        'Manifest sha256 does not match the current sample contents.',
      ]),
    });

    const profile = await profileImportSampleFile({
      filePath: cycleSample.filePath,
      source: 'flo',
      status: 'candidate',
    });

    expect(profile.fieldShapeDeltas).not.toContain(
      "Top-level shape object:operationalData is outside Floriva's current flo parser assumptions.",
    );
  });

  it('scans reviewed samples, enforces manifest review metadata, and emits a coverage matrix', async () => {
    const corpusRoot = await createTempCorpusRoot();
    const clueFixture = await fs.readFile(path.join(fixtureRoot, 'clue-rich-history.cluedata'), 'utf8');
    const floFixture = await fs.readFile(path.join(fixtureRoot, 'flo-rich-history.json'), 'utf8');

    await writeSample({
      corpusRoot,
      source: 'clue',
      status: 'reviewed',
      fileName: 'measurements.json',
      contents: clueFixture,
      manifest: {
        schemaVersion: 1,
        sourceUrl: 'https://example.com/clue-sample',
        retrievalDate: '2026-04-16',
        fileName: 'measurements.json',
        claimedApp: 'clue',
        discoveredContainerShape: 'object:data[]',
        sha256: 'fill-me',
        trustNotes: 'Reviewed Clue sample.',
        reviewerDecision: 'accepted',
      },
    });
    await writeSample({
      corpusRoot,
      source: 'flo',
      status: 'reviewed',
      fileName: 'flo-export.json',
      contents: floFixture,
      manifest: {
        schemaVersion: 1,
        sourceUrl: 'https://example.com/flo-sample',
        retrievalDate: '2026-04-16',
        fileName: 'flo-export.json',
        claimedApp: 'flo',
        discoveredContainerShape: 'object:values[]',
        sha256: 'fill-me',
        trustNotes: 'Reviewed Flo sample.',
        reviewerDecision: 'accepted',
      },
    });
    await writeSample({
      corpusRoot,
      source: 'clue',
      status: 'reviewed',
      fileName: 'missing-manifest.json',
      contents: clueFixture,
    });

    const report = await scanImportCorpus({
      corpusRoot,
      statuses: ['reviewed'],
    });

    expect(report.sampleCount).toBe(3);
    expect(report.uniqueContainerShapes).toEqual(
      expect.arrayContaining(['object:data[]', 'object:values[]']),
    );
    expect(report.uniqueDateKeys).toEqual(
      expect.arrayContaining(['day', 'recordedAt']),
    );
    expect(report.coverageMatrix).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'clue',
          topLevelContainerShape: 'object:data[]',
          sampleCount: 2,
        }),
        expect.objectContaining({
          source: 'flo',
          topLevelContainerShape: 'object:values[]',
          sampleCount: 1,
        }),
      ]),
    );
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('missing-manifest.json'),
      ]),
    );
  });

  it('captures trackedData variants, date-key deltas, and review-state mismatches', async () => {
    const corpusRoot = await createTempCorpusRoot();

    const sample = await writeSample({
      corpusRoot,
      source: 'clue',
      status: 'reviewed',
      fileName: 'tracked-data.json',
      contents: JSON.stringify({
        trackedData: [
          {
            tracked_on: '2026-04-15',
            flow: 'light',
          },
        ],
      }),
      manifest: {
        schemaVersion: 1,
        sourceUrl: 'https://example.com/tracked-data-sample',
        retrievalDate: '2026-04-16',
        fileName: 'wrong-name.json',
        claimedApp: 'flo',
        discoveredContainerShape: 'object:data[]',
        sha256: 'fill-me',
        trustNotes: 'Shape mismatch sample.',
        reviewerDecision: 'pending',
      },
    });

    const profile = await profileImportSampleFile({
      filePath: sample.filePath,
      source: 'clue',
      status: 'reviewed',
    });

    expect(profile.topLevelContainerShape).toBe('object:trackedData[]');
    expect(profile.likelyDateKeys).toContain('tracked_on');
    expect(profile.parseResult).toBe('partial');
    expect(profile.fieldShapeDeltas).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Unexpected date key'),
        expect.stringContaining('Manifest fileName'),
        expect.stringContaining('Manifest claimedApp'),
        expect.stringContaining('Manifest container shape'),
        expect.stringContaining('Manifest sha256'),
      ]),
    );
    expect(profile.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('reviewerDecision "accepted"'),
      ]),
    );
  });

  it('flags invalid or unreadable manifests and keeps missing corpus roots reproducible', async () => {
    const corpusRoot = await createTempCorpusRoot();
    const invalidManifestSample = await writeSample({
      corpusRoot,
      source: 'flo',
      status: 'rejected',
      fileName: 'invalid-manifest.json',
      contents: JSON.stringify([
        {
          date: '2026-04-19',
          bleeding: 'light',
        },
      ]),
    });

    await fs.writeFile(invalidManifestSample.manifestPath, '{"schemaVersion":1,"claimedApp":"flo"}', 'utf8');

    const unreadableSample = await writeSample({
      corpusRoot,
      source: 'flo',
      status: 'rejected',
      fileName: 'unreadable-manifest.json',
      contents: '"just text"',
      manifest: {
        schemaVersion: 1,
        sourceUrl: 'https://example.com/unreadable',
        retrievalDate: '2026-04-16',
        fileName: 'unreadable-manifest.json',
        claimedApp: 'flo',
        discoveredContainerShape: 'string',
        sha256: 'fill-me',
        trustNotes: 'Will be replaced by a directory.',
        reviewerDecision: 'accepted',
      },
    });

    await fs.rm(unreadableSample.manifestPath, { force: true });
    await fs.mkdir(unreadableSample.manifestPath, { recursive: true });

    const invalidManifestProfile = await profileImportSampleFile({
      filePath: invalidManifestSample.filePath,
      source: 'flo',
      status: 'rejected',
    });
    const unreadableManifestProfile = await profileImportSampleFile({
      filePath: unreadableSample.filePath,
      source: 'flo',
      status: 'rejected',
    });
    const missingRootReport = await scanImportCorpus({
      corpusRoot: path.join(corpusRoot, 'does-not-exist'),
      statuses: ['reviewed'],
    });

    expect(invalidManifestProfile.parseResult).toBe('clean');
    expect(invalidManifestProfile.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('is invalid'),
      ]),
    );
    expect(unreadableManifestProfile.topLevelContainerShape).toBe('string');
    expect(unreadableManifestProfile.parseResult).toBe('unsupported');
    expect(unreadableManifestProfile.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('could not be read'),
      ]),
    );
    expect(missingRootReport).toMatchObject({
      sampleCount: 0,
      reviewedSampleCount: 0,
      issues: [],
    });
  });

  it('includes nested reviewed samples in the coverage matrix', async () => {
    const corpusRoot = await createTempCorpusRoot();
    const floNestedDirectory = path.join(corpusRoot, 'flo', 'reviewed', 'github-issue');
    const nestedFilePath = path.join(floNestedDirectory, 'nested-array.json');
    const nestedManifestPath = path.join(floNestedDirectory, 'nested-array.manifest.json');

    await fs.mkdir(floNestedDirectory, { recursive: true });
    await fs.writeFile(
      nestedFilePath,
      JSON.stringify([
        {
          date: '2026-04-20',
          bleeding: 'light',
        },
      ]),
      'utf8',
    );
    await fs.writeFile(
      nestedManifestPath,
      JSON.stringify(
        {
          schemaVersion: 1,
          sourceUrl: 'https://example.com/nested-array',
          retrievalDate: '2026-04-16',
          fileName: 'nested-array.json',
          claimedApp: 'flo',
          discoveredContainerShape: 'array',
          sha256: 'fill-me',
          trustNotes: 'Nested reviewed sample.',
          reviewerDecision: 'accepted',
        },
        null,
        2,
      ),
      'utf8',
    );

    const report = await scanImportCorpus({
      corpusRoot,
      statuses: ['reviewed'],
    });

    expect(report.sampleCount).toBe(1);
    expect(report.uniqueContainerShapes).toEqual(['array']);
    expect(report.coverageMatrix).toEqual([
      expect.objectContaining({
        source: 'flo',
        topLevelContainerShape: 'array',
        sampleCount: 1,
      }),
    ]);
  });
});
