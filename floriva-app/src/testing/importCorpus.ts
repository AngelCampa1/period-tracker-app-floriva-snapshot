import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  UnsupportedImportShapeError,
  parseClueImport,
  parseFloImport,
} from '@/src/lib/parsing/importParsers';

export const importCorpusSources = ['clue', 'flo'] as const;
export const importCorpusStatuses = ['candidate', 'reviewed', 'rejected'] as const;
export const importParseResults = ['clean', 'partial', 'unsupported', 'invalid'] as const;

export type ImportCorpusSource = (typeof importCorpusSources)[number];
export type ImportCorpusStatus = (typeof importCorpusStatuses)[number];
export type ImportParseResult = (typeof importParseResults)[number];

const supportedDateKeys = new Set([
  'date',
  'logDate',
  'day',
  'calendarDate',
  'trackedAt',
  'tracked_at',
  'recordedAt',
  'recorded_at',
  'createdAt',
  'created_at',
  'startDate',
  'start_date',
]);

const supportedTopLevelShapes: Record<ImportCorpusSource, Set<string>> = {
  clue: new Set(['object:data[]', 'object:trackedData[]']),
  flo: new Set([
    'array',
    'object:data[]',
    'object:values[]',
    'object:delete|update',
    'object:operationalData',
  ]),
};

const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  sourceUrl: z.string().trim().url(),
  retrievalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  fileName: z.string().trim().min(1),
  claimedApp: z.enum(importCorpusSources),
  discoveredContainerShape: z.string().trim().min(1),
  sha256: z.string().trim().min(1),
  trustNotes: z.string().trim().min(1),
  reviewerDecision: z.enum(['pending', 'accepted', 'rejected']),
  reviewNotes: z.string().trim().min(1).optional(),
  reviewedAt: z.string().datetime().optional(),
  searchTier: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
  ]).optional(),
});

export type ImportCorpusManifest = z.infer<typeof manifestSchema>;

export type ImportSampleProfile = {
  filePath: string;
  manifestPath: string;
  fileName: string;
  source: ImportCorpusSource;
  status: ImportCorpusStatus;
  topLevelContainerShape: string;
  likelyDateKeys: string[];
  likelyMetricKeys: string[];
  parseResult: ImportParseResult;
  parsedEntryCount: number;
  warningCount: number;
  skippedRowCount: number;
  fieldShapeDeltas: string[];
  manifest: ImportCorpusManifest | null;
  issues: string[];
  parserError: string | null;
  canPromoteToFixture: boolean;
};

export type ImportCorpusCoverageRow = {
  source: ImportCorpusSource;
  topLevelContainerShape: string;
  sampleCount: number;
  parseResults: Record<ImportParseResult, number>;
};

export type ImportCorpusReport = {
  corpusRoot: string;
  sampleCount: number;
  reviewedSampleCount: number;
  uniqueContainerShapes: string[];
  uniqueDateKeys: string[];
  uniqueMetricKeys: string[];
  parseResults: Record<ImportParseResult, number>;
  coverageMatrix: ImportCorpusCoverageRow[];
  samples: ImportSampleProfile[];
  issues: string[];
};

export function getImportCorpusRoot(projectRoot: string) {
  return path.join(projectRoot, '.local', 'import-corpus');
}

export async function ensureImportCorpusLayout(corpusRoot: string) {
  const directoryPaths = importCorpusSources.flatMap((source) =>
    importCorpusStatuses.map((status) => path.join(corpusRoot, source, status)),
  );

  await Promise.all(
    directoryPaths.map((directoryPath) => fs.mkdir(directoryPath, { recursive: true })),
  );

  return directoryPaths;
}

function buildEmptyParseResultsRecord(): Record<ImportParseResult, number> {
  return {
    clean: 0,
    partial: 0,
    unsupported: 0,
    invalid: 0,
  };
}

function getManifestPath(filePath: string) {
  const extension = path.extname(filePath);
  return extension.length > 0
    ? filePath.slice(0, -extension.length) + '.manifest.json'
    : `${filePath}.manifest.json`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function inferTopLevelContainerShape(raw: unknown) {
  if (Array.isArray(raw)) {
    return 'array';
  }

  if (!isPlainObject(raw)) {
    return typeof raw;
  }

  if (Array.isArray(raw.data)) {
    return 'object:data[]';
  }

  if (Array.isArray(raw.values)) {
    return 'object:values[]';
  }

  if (Array.isArray(raw.trackedData)) {
    return 'object:trackedData[]';
  }

  return `object:${Object.keys(raw).sort().join('|') || 'empty'}`;
}

function collectRows(raw: unknown): unknown[] {
  if (Array.isArray(raw)) {
    return raw;
  }

  if (!isPlainObject(raw)) {
    return [];
  }

  const rows: unknown[] = [];

  if (Array.isArray(raw.data)) {
    rows.push(...raw.data);
  }

  if (Array.isArray(raw.values)) {
    rows.push(...raw.values);
  }

  if (Array.isArray(raw.trackedData)) {
    rows.push(...raw.trackedData);
  }

  for (const container of [raw.operationalData, raw.update]) {
    if (!isPlainObject(container) || !Array.isArray(container.cycles)) {
      continue;
    }

    rows.push(...container.cycles);
  }

  return rows;
}

function collectKeyInsights(raw: unknown) {
  const dateKeys = new Set<string>();
  const metricKeys = new Set<string>();

  for (const row of collectRows(raw)) {
    if (!isPlainObject(row)) {
      continue;
    }

    for (const key of Object.keys(row)) {
      if (
        supportedDateKeys.has(key) ||
        /(date|day|tracked|recorded|created|start)/iu.test(key)
      ) {
        dateKeys.add(key);
      } else {
        metricKeys.add(key);
      }
    }
  }

  return {
    likelyDateKeys: [...dateKeys].sort(),
    likelyMetricKeys: [...metricKeys].sort(),
  };
}

async function readManifest(filePath: string) {
  const manifestPath = getManifestPath(filePath);

  try {
    const rawManifest = await fs.readFile(manifestPath, 'utf8');
    const parsed = manifestSchema.safeParse(JSON.parse(rawManifest) as unknown);

    if (!parsed.success) {
      return {
        manifestPath,
        manifest: null,
        issues: [
          `Manifest ${manifestPath} is invalid: ${parsed.error.issues
            .map((issue) => issue.message)
            .join('; ')}`,
        ],
      };
    }

    return {
      manifestPath,
      manifest: parsed.data,
      issues: [] as string[],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        manifestPath,
        manifest: null,
        issues: [] as string[],
      };
    }

    return {
      manifestPath,
      manifest: null,
      issues: [`Manifest ${manifestPath} could not be read.`],
    };
  }
}

function createSha256(contents: string) {
  return createHash('sha256').update(contents).digest('hex');
}

function parseBySource(source: ImportCorpusSource, raw: unknown) {
  return source === 'clue' ? parseClueImport(raw) : parseFloImport(raw);
}

function classifyParseResult({
  entryCount,
  warningCount,
  skippedRowCount,
}: {
  entryCount: number;
  warningCount: number;
  skippedRowCount: number;
}) {
  if (entryCount === 0 || warningCount > 0 || skippedRowCount > 0) {
    return 'partial';
  }

  return 'clean';
}

function buildFieldShapeDeltas({
  source,
  fileName,
  topLevelContainerShape,
  likelyDateKeys,
  manifest,
  sha256,
}: {
  source: ImportCorpusSource;
  fileName: string;
  topLevelContainerShape: string;
  likelyDateKeys: string[];
  manifest: ImportCorpusManifest | null;
  sha256: string;
}) {
  const deltas: string[] = [];

  if (!supportedTopLevelShapes[source].has(topLevelContainerShape)) {
    deltas.push(
      `Top-level shape ${topLevelContainerShape} is outside Floriva's current ${source} parser assumptions.`,
    );
  }

  const unexpectedDateKeys = likelyDateKeys.filter((key) => !supportedDateKeys.has(key));

  if (unexpectedDateKeys.length > 0) {
    deltas.push(
      `Unexpected date key${unexpectedDateKeys.length === 1 ? '' : 's'}: ${unexpectedDateKeys.join(', ')}.`,
    );
  }

  if (!manifest) {
    return deltas;
  }

  if (manifest.fileName !== fileName) {
    deltas.push(
      `Manifest fileName ${manifest.fileName} does not match sample file ${fileName}.`,
    );
  }

  if (manifest.claimedApp !== source) {
    deltas.push(
      `Manifest claimedApp ${manifest.claimedApp} does not match source directory ${source}.`,
    );
  }

  if (manifest.discoveredContainerShape !== topLevelContainerShape) {
    deltas.push(
      `Manifest container shape ${manifest.discoveredContainerShape} does not match detected shape ${topLevelContainerShape}.`,
    );
  }

  if (manifest.sha256 !== sha256) {
    deltas.push('Manifest sha256 does not match the current sample contents.');
  }

  return deltas;
}

export async function profileImportSampleFile({
  filePath,
  source,
  status,
}: {
  filePath: string;
  source: ImportCorpusSource;
  status: ImportCorpusStatus;
}): Promise<ImportSampleProfile> {
  const fileName = path.basename(filePath);
  const { manifestPath, manifest, issues: manifestIssues } = await readManifest(filePath);
  const contents = await fs.readFile(filePath, 'utf8');
  const sha256 = createSha256(contents);

  let topLevelContainerShape = 'invalid-json';
  let likelyDateKeys: string[] = [];
  let likelyMetricKeys: string[] = [];
  let parseResult: ImportParseResult = 'invalid';
  let parsedEntryCount = 0;
  let warningCount = 0;
  let skippedRowCount = 0;
  let parserError: string | null = null;

  try {
    const raw = JSON.parse(contents) as unknown;
    topLevelContainerShape = inferTopLevelContainerShape(raw);
    ({ likelyDateKeys, likelyMetricKeys } = collectKeyInsights(raw));

    const parsed = parseBySource(source, raw);
    parsedEntryCount = parsed.entries.length;
    warningCount = parsed.warnings.length;
    skippedRowCount = parsed.skippedRows.length;
    parseResult = classifyParseResult({
      entryCount: parsedEntryCount,
      warningCount,
      skippedRowCount,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      parserError = 'Sample is not valid JSON.';
    } else if (error instanceof UnsupportedImportShapeError) {
      parseResult = 'unsupported';
      parserError = error.message;
      try {
        const raw = JSON.parse(contents) as unknown;
        topLevelContainerShape = inferTopLevelContainerShape(raw);
        ({ likelyDateKeys, likelyMetricKeys } = collectKeyInsights(raw));
      } catch {
        topLevelContainerShape = 'invalid-json';
      }
    } else {
      parseResult = 'invalid';
      parserError =
        error instanceof Error ? error.message : 'Sample could not be parsed.';
    }
  }

  const fieldShapeDeltas = buildFieldShapeDeltas({
    source,
    fileName,
    topLevelContainerShape,
    likelyDateKeys,
    manifest,
    sha256,
  });
  const issues = [...manifestIssues];

  if (status === 'reviewed' && !manifest) {
    issues.push(`Reviewed sample ${fileName} is missing a provenance manifest.`);
  }

  if (status === 'reviewed' && manifest && manifest.reviewerDecision !== 'accepted') {
    issues.push(
      `Reviewed sample ${fileName} must have reviewerDecision "accepted" before corpus-runner promotion checks.`,
    );
  }

  if (status === 'rejected' && manifest && manifest.reviewerDecision !== 'rejected') {
    issues.push(
      `Rejected sample ${fileName} should record reviewerDecision "rejected".`,
    );
  }

  return {
    filePath,
    manifestPath,
    fileName,
    source,
    status,
    topLevelContainerShape,
    likelyDateKeys,
    likelyMetricKeys,
    parseResult,
    parsedEntryCount,
    warningCount,
    skippedRowCount,
    fieldShapeDeltas,
    manifest,
    issues,
    parserError,
    canPromoteToFixture:
      status === 'reviewed' &&
      manifest?.reviewerDecision === 'accepted' &&
      (parseResult === 'clean' || parseResult === 'partial') &&
      issues.length === 0,
  };
}

async function listSampleFiles(directoryPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const absolutePath = path.join(directoryPath, entry.name);

        if (entry.isDirectory()) {
          return listSampleFiles(absolutePath);
        }

        if (
          entry.isFile() &&
          !entry.name.endsWith('.manifest.json') &&
          !entry.name.startsWith('.')
        ) {
          return [absolutePath];
        }

        return [];
      }),
    );

    return nested.flat().sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

export async function scanImportCorpus({
  corpusRoot,
  statuses = [...importCorpusStatuses],
}: {
  corpusRoot: string;
  statuses?: ImportCorpusStatus[];
}): Promise<ImportCorpusReport> {
  const samples: ImportSampleProfile[] = [];

  for (const source of importCorpusSources) {
    for (const status of statuses) {
      const directoryPath = path.join(corpusRoot, source, status);
      const filePaths = await listSampleFiles(directoryPath);

      for (const filePath of filePaths) {
        samples.push(
          await profileImportSampleFile({
            filePath,
            source,
            status,
          }),
        );
      }
    }
  }

  const uniqueContainerShapes = new Set<string>();
  const uniqueDateKeys = new Set<string>();
  const uniqueMetricKeys = new Set<string>();
  const parseResults = buildEmptyParseResultsRecord();
  const issues: string[] = [];
  const coverageMatrixByKey = new Map<string, ImportCorpusCoverageRow>();

  for (const sample of samples) {
    uniqueContainerShapes.add(sample.topLevelContainerShape);
    sample.likelyDateKeys.forEach((key) => uniqueDateKeys.add(key));
    sample.likelyMetricKeys.forEach((key) => uniqueMetricKeys.add(key));
    parseResults[sample.parseResult] += 1;
    issues.push(...sample.issues);

    const matrixKey = `${sample.source}:${sample.topLevelContainerShape}`;
    const coverageRow =
      coverageMatrixByKey.get(matrixKey) ??
      ({
        source: sample.source,
        topLevelContainerShape: sample.topLevelContainerShape,
        sampleCount: 0,
        parseResults: buildEmptyParseResultsRecord(),
      } satisfies ImportCorpusCoverageRow);

    coverageRow.sampleCount += 1;
    coverageRow.parseResults[sample.parseResult] += 1;
    coverageMatrixByKey.set(matrixKey, coverageRow);
  }

  return {
    corpusRoot,
    sampleCount: samples.length,
    reviewedSampleCount: samples.filter((sample) => sample.status === 'reviewed').length,
    uniqueContainerShapes: [...uniqueContainerShapes].sort(),
    uniqueDateKeys: [...uniqueDateKeys].sort(),
    uniqueMetricKeys: [...uniqueMetricKeys].sort(),
    parseResults,
    coverageMatrix: [...coverageMatrixByKey.values()].sort((left, right) =>
      `${left.source}:${left.topLevelContainerShape}`.localeCompare(
        `${right.source}:${right.topLevelContainerShape}`,
      ),
    ),
    samples,
    issues,
  };
}
