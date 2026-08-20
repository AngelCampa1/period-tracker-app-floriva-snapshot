#!/usr/bin/env node
/**
 * Assert that every headline figure in the public documentation matches
 * `metrics.json`.
 *
 *   node scripts/portfolio/check-doc-figures.js \
 *     --metrics docs/portfolio/public/metrics.json \
 *     --docs docs/portfolio/public
 *
 * The public README opens by claiming its numbers are produced by
 * `collect-portfolio-metrics.js` "and not typed by hand". They are in fact
 * typed by hand into prose — the script produces them, a human transcribes
 * them. That transcription drifts: three separate figures for the same
 * test-code line count (77,759 / 77,767 / 77,772) coexisted in three files
 * before this check existed.
 *
 * So the claim is enforced here instead of trusted. Each entry names a figure,
 * formats it from metrics.json, and lists the documents that must contain that
 * exact string. If a metric moves and a document does not, this fails.
 *
 * A substring match cannot prove a document *interprets* a number correctly —
 * only that the number it quotes is current. That is the drift this class of
 * bug actually produces, and it is what this catches.
 */

const fs = require('node:fs');
const path = require('node:path');

/** 50485 -> "50,485" */
function withThousands(value) {
  return value.toLocaleString('en-US');
}

/** 98.7 -> "98.70" — coverage is always quoted to two decimals. */
function asPercent(value) {
  return value.toFixed(2);
}

/**
 * Figures that appear in prose, and the documents that must agree on them.
 *
 * Paths are relative to the published documentation root.
 */
function buildFigureChecks(metrics) {
  const README = 'README.md';
  const METRICS = 'docs/metrics.md';
  const TESTING = 'docs/testing-and-quality.md';
  const ARCHITECTURE = 'docs/architecture.md';
  const LOCALIZATION = 'docs/localization.md';

  return [
    {
      label: 'product code lines',
      text: withThousands(metrics.loc.product.code),
      files: [README, METRICS, TESTING, ARCHITECTURE],
    },
    {
      label: 'product file count',
      text: `${metrics.loc.product.files} files`,
      files: [README],
    },
    {
      label: 'test code lines',
      text: withThousands(metrics.loc.testCode),
      files: [README, METRICS, TESTING],
    },
    {
      label: 'ship-to-test ratio',
      text: metrics.loc.shipToTestRatio.toFixed(2),
      files: [README, METRICS, TESTING],
    },
    {
      label: 'test suites',
      text: String(metrics.testRun.suites),
      files: [README, METRICS, TESTING],
    },
    {
      label: 'test cases',
      text: withThousands(metrics.testRun.tests),
      files: [README, METRICS, TESTING],
    },
    {
      label: 'coverage — lines',
      text: `${asPercent(metrics.coverage.lines)}%`,
      files: [README, METRICS, TESTING],
    },
    {
      label: 'coverage — branches',
      text: `${asPercent(metrics.coverage.branches)}%`,
      files: [README, METRICS, TESTING],
    },
    {
      label: 'coverage — functions',
      text: `${asPercent(metrics.coverage.functions)}%`,
      files: [README, METRICS, TESTING],
    },
    {
      label: 'coverage denominator',
      text: String(metrics.coverage.filesMeasured),
      files: [METRICS, TESTING],
    },
    {
      label: 'locales',
      text: `${metrics.localization.locales} locales`,
      files: [README],
    },
    {
      label: 'locale string leaves',
      text: withThousands(metrics.localization.leavesPerLocale),
      files: [README, METRICS, LOCALIZATION],
    },
    {
      label: 'database migrations',
      text: `${metrics.database.migrations} migrations`,
      files: [README],
    },
    {
      label: 'database tables',
      text: `${metrics.database.tables} SQLite tables`,
      files: [README, ARCHITECTURE],
    },
    {
      label: 'e2e spec files',
      text: `${metrics.e2e.specs} Detox specs`,
      files: [README],
    },
    {
      label: 'e2e scenarios',
      text: `${metrics.e2e.scenarios} scenarios`,
      files: [README],
    },
    {
      label: 'route files',
      text: `${metrics.routes.routeFiles} route files`,
      files: [README],
    },
    {
      // Bare number: the README writes "706 commits", metrics.md writes it as a
      // table cell. Both must carry the same figure, not the same phrasing.
      label: 'commits',
      text: withThousands(metrics.git.commits),
      files: [README, METRICS],
    },
  ];
}

/**
 * @returns {Array<{label: string, file: string, expected: string}>} failures
 */
function checkDocFigures({ metrics, readDoc, checks = buildFigureChecks(metrics) }) {
  const failures = [];

  for (const check of checks) {
    for (const file of check.files) {
      const contents = readDoc(file);
      if (contents === null) {
        failures.push({ label: check.label, file, expected: check.text, missingFile: true });
        continue;
      }
      if (!contents.includes(check.text)) {
        failures.push({ label: check.label, file, expected: check.text });
      }
    }
  }

  return failures;
}

function parseArgs(argv) {
  const args = { metrics: null, docs: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--metrics') { args.metrics = argv[i + 1]; i += 1; }
    else if (argv[i] === '--docs') { args.docs = argv[i + 1]; i += 1; }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.metrics || !args.docs) {
    console.error('usage: check-doc-figures.js --metrics <metrics.json> --docs <dir>');
    process.exit(2);
  }

  const metrics = JSON.parse(fs.readFileSync(path.resolve(args.metrics), 'utf8'));
  const docsRoot = path.resolve(args.docs);

  const failures = checkDocFigures({
    metrics,
    readDoc: (file) => {
      const full = path.join(docsRoot, file);
      return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
    },
  });

  if (failures.length === 0) {
    console.log('doc figures agree with metrics.json');
    return;
  }

  console.error(`${failures.length} figure(s) disagree with metrics.json:\n`);
  for (const failure of failures) {
    const reason = failure.missingFile ? 'document not found' : `expected to contain "${failure.expected}"`;
    console.error(`  ${failure.file} — ${failure.label}: ${reason}`);
  }
  process.exit(1);
}

if (require.main === module) main();

module.exports = { buildFigureChecks, checkDocFigures, withThousands, asPercent, parseArgs };
