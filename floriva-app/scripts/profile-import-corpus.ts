import fs from 'node:fs/promises';
import path from 'node:path';

import {
  ensureImportCorpusLayout,
  getImportCorpusRoot,
  importCorpusStatuses,
  scanImportCorpus,
  type ImportCorpusStatus,
} from '../src/testing/importCorpus';

type CliOptions = {
  corpusRoot: string;
  outputPath: string;
  statuses: ImportCorpusStatus[];
};

function parseStatuses(value: string) {
  const statuses = value
    .split(',')
    .map((status) => status.trim())
    .filter((status): status is ImportCorpusStatus =>
      importCorpusStatuses.includes(status as ImportCorpusStatus),
    );

  return statuses.length > 0 ? statuses : [...importCorpusStatuses];
}

function parseArgs(argv: string[]): CliOptions {
  const projectRoot = process.cwd();
  const defaultCorpusRoot = getImportCorpusRoot(projectRoot);
  const defaultOutputPath = path.join(defaultCorpusRoot, 'profile-report.json');

  let corpusRoot = defaultCorpusRoot;
  let outputPath = defaultOutputPath;
  let statuses = [...importCorpusStatuses];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextValue = argv[index + 1];

    if (arg === '--root' && nextValue) {
      corpusRoot = path.resolve(projectRoot, nextValue);
      outputPath = path.join(corpusRoot, 'profile-report.json');
      index += 1;
    } else if (arg === '--write' && nextValue) {
      outputPath = path.resolve(projectRoot, nextValue);
      index += 1;
    } else if (arg === '--statuses' && nextValue) {
      statuses = parseStatuses(nextValue);
      index += 1;
    }
  }

  return {
    corpusRoot,
    outputPath,
    statuses,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  await ensureImportCorpusLayout(options.corpusRoot);

  const report = await scanImportCorpus({
    corpusRoot: options.corpusRoot,
    statuses: options.statuses,
  });

  await fs.mkdir(path.dirname(options.outputPath), { recursive: true });
  await fs.writeFile(options.outputPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

  process.stdout.write(JSON.stringify(report, null, 2));
  process.stdout.write('\n');
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown corpus profiling error.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
