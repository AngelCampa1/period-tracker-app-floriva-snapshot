import fs from 'node:fs/promises';
import path from 'node:path';

import { ensureImportCorpusLayout, getImportCorpusRoot, scanImportCorpus } from '../src/testing/importCorpus';

type CliOptions = {
  corpusRoot: string;
  outputPath: string;
};

function parseArgs(argv: string[]): CliOptions {
  const projectRoot = process.cwd();
  const defaultCorpusRoot = getImportCorpusRoot(projectRoot);
  const defaultOutputPath = path.join(defaultCorpusRoot, 'reviewed-report.json');

  let corpusRoot = defaultCorpusRoot;
  let outputPath = defaultOutputPath;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextValue = argv[index + 1];

    if (arg === '--root' && nextValue) {
      corpusRoot = path.resolve(projectRoot, nextValue);
      outputPath = path.join(corpusRoot, 'reviewed-report.json');
      index += 1;
    } else if (arg === '--write' && nextValue) {
      outputPath = path.resolve(projectRoot, nextValue);
      index += 1;
    }
  }

  return {
    corpusRoot,
    outputPath,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  await ensureImportCorpusLayout(options.corpusRoot);

  const report = await scanImportCorpus({
    corpusRoot: options.corpusRoot,
    statuses: ['reviewed'],
  });

  await fs.mkdir(path.dirname(options.outputPath), { recursive: true });
  await fs.writeFile(options.outputPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

  process.stdout.write(JSON.stringify(report, null, 2));
  process.stdout.write('\n');

  if (report.issues.length > 0) {
    process.stderr.write(
      `Reviewed corpus has ${report.issues.length} issue(s). Fix manifests or review status before relying on this corpus for regression checks.\n`,
    );
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown corpus runner error.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
