#!/usr/bin/env node
/**
 * Generate metrics.json for the public portfolio documentation.
 *
 *   node scripts/collect-portfolio-metrics.js [--out metrics.json]
 *
 * Every number quoted in the public README and docs is produced here, so the
 * documentation can be regenerated and cannot drift into invention.
 *
 * Methodology follows what two independent measurement passes agreed on
 * (see docs/portfolio/ledgers/D2-metrics.md and C2-metrics-replication.md).
 * Where the two disagreed, the more conservative figure is used and the
 * disagreement is recorded in `caveats`.
 *
 * Dynamic figures (test counts, coverage) are read from build artifacts rather
 * than recomputed. If an artifact is missing this exits non-zero instead of
 * emitting a plausible-looking guess.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

/**
 * Floriva was withdrawn from both stores on 2026-08-11. Commits after that date
 * build this snapshot rather than the product, so the history figures stop
 * there. `--until` is exclusive of the given day's later hours, so the boundary
 * is expressed as the following date.
 */
const PRODUCT_HISTORY_END = '2026-08-11';
const HISTORY_UNTIL = '--until=2026-08-12';

// ---------------------------------------------------------------------------
// Line classification
// ---------------------------------------------------------------------------

/**
 * Split a source file into code / comment / blank lines.
 *
 * A line with code and a trailing comment counts as code. Block comments count
 * every line they span. `//` inside a string literal is not a comment — the
 * check is deliberately simple but handles the common cases in this codebase.
 */
function classifyLines(source) {
  if (source === '') return { total: 0, code: 0, comment: 0, blank: 0 };

  const lines = source.split('\n');
  // A trailing newline produces a final empty element that is not a line.
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();

  let code = 0;
  let comment = 0;
  let blank = 0;
  let inBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (inBlock) {
      comment += 1;
      if (trimmed.includes('*/')) inBlock = false;
      continue;
    }

    if (trimmed === '') {
      blank += 1;
      continue;
    }

    if (trimmed.startsWith('/*')) {
      comment += 1;
      if (!trimmed.includes('*/')) inBlock = true;
      continue;
    }

    if (trimmed.startsWith('//')) {
      comment += 1;
      continue;
    }

    code += 1;
  }

  return { total: lines.length, code, comment, blank };
}

function walkFiles(dir, predicate, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) walkFiles(full, predicate, out);
    else if (predicate(full)) out.push(full);
  }
  return out;
}

function measureArea(appRoot, relDir) {
  const files = walkFiles(path.join(appRoot, relDir), (file) =>
    SOURCE_EXTENSIONS.has(path.extname(file)),
  );
  const totals = { files: files.length, total: 0, code: 0, comment: 0, blank: 0 };
  for (const file of files) {
    const counts = classifyLines(fs.readFileSync(file, 'utf8'));
    totals.total += counts.total;
    totals.code += counts.code;
    totals.comment += counts.comment;
    totals.blank += counts.blank;
  }
  return totals;
}

// ---------------------------------------------------------------------------
// Localization
// ---------------------------------------------------------------------------

function countStringLeaves(value) {
  if (typeof value !== 'object' || value === null) return 1;
  return Object.values(value).reduce((sum, child) => sum + countStringLeaves(child), 0);
}

function collectKeyPaths(value, prefix = '', out = new Set()) {
  if (typeof value !== 'object' || value === null) {
    out.add(prefix);
    return out;
  }
  for (const [key, child] of Object.entries(value)) {
    collectKeyPaths(child, prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Artifact readers
// ---------------------------------------------------------------------------

function summarizeCoverage(summary) {
  const total = summary?.total;
  if (!total?.lines) throw new Error('coverage summary has no `total` section');
  return {
    lines: total.lines.pct,
    statements: total.statements.pct,
    functions: total.functions.pct,
    branches: total.branches.pct,
    filesMeasured: Object.keys(summary).length - 1,
  };
}

function summarizeJestResults(results) {
  if (!results.success || results.numPassedTests !== results.numTotalTests) {
    throw new Error('jest run did not pass — refusing to publish metrics from a red suite');
  }
  return {
    suites: results.numTotalTestSuites,
    suitesPassed: results.numPassedTestSuites,
    tests: results.numTotalTests,
    testsPassed: results.numPassedTests,
    skipped: results.numPendingTests,
  };
}

function git(appRoot, args) {
  return execFileSync('git', args, { cwd: appRoot, encoding: 'utf8' }).trim();
}

// ---------------------------------------------------------------------------

/**
 * Load the real translations object.
 *
 * Default implementation evaluates the TypeScript through `tsx`, which the repo
 * already uses for several scripts. Tests inject a direct require instead,
 * since jest transforms TypeScript itself.
 */
function defaultLoadTranslations(appRoot) {
  const program =
    "import { translations } from './src/localization/translations';" +
    'process.stdout.write(JSON.stringify(translations));';
  const output = execFileSync('npx', ['tsx', '--eval', program], {
    cwd: appRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(output);
}

function collectMetrics({
  appRoot,
  requireDynamic = true,
  loadTranslations = defaultLoadTranslations,
}) {
  const pkg = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));

  // --- lines of code -------------------------------------------------------
  const areaNames = ['src', 'app', 'components', 'constants', 'tests', 'e2e', 'scripts', 'drizzle'];
  const areas = {};
  for (const name of areaNames) areas[name] = measureArea(appRoot, name);

  const product = ['src', 'app', 'components', 'constants'].reduce(
    (acc, name) => ({
      files: acc.files + areas[name].files,
      total: acc.total + areas[name].total,
      code: acc.code + areas[name].code,
    }),
    { files: 0, total: 0, code: 0 },
  );

  // --- database ------------------------------------------------------------
  const migrationDir = path.join(appRoot, 'drizzle');
  const migrations = fs
    .readdirSync(migrationDir)
    .filter((name) => name.endsWith('.sql')).length;
  const schema = fs.readFileSync(path.join(appRoot, 'src/db/schema.ts'), 'utf8');
  const tables = [...schema.matchAll(/sqliteTable\(/g)].length;

  // --- localization --------------------------------------------------------
  const localeConfig = fs.readFileSync(path.join(appRoot, 'src/localization/config.ts'), 'utf8');
  const localeBlock = localeConfig.match(/supportedLocales = \[([\s\S]*?)\]/);
  const locales = localeBlock ? [...localeBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];

  const messageDir = path.join(appRoot, 'src/localization/messages');
  const messageModules = fs.readdirSync(messageDir).filter((f) => f.endsWith('.ts'));

  // The message modules splice in shared constants, so a regex over the source
  // undercounts. Evaluate the real translations object instead: compare full
  // key paths across locales, which is what proves "zero key drift".
  const translations = loadTranslations(appRoot);
  const localeKeyPaths = new Map(
    locales.map((locale) => [locale, collectKeyPaths(translations[locale] ?? {})]),
  );
  const referenceKeys = localeKeyPaths.get(locales[0]) ?? new Set();
  const leavesPerLocale = referenceKeys.size;

  let keyDrift = 0;
  for (const [, keys] of localeKeyPaths) {
    for (const key of referenceKeys) if (!keys.has(key)) keyDrift += 1;
    for (const key of keys) if (!referenceKeys.has(key)) keyDrift += 1;
  }

  // --- routes and testIDs --------------------------------------------------
  const routeFiles = walkFiles(path.join(appRoot, 'app'), (file) =>
    SOURCE_EXTENSIONS.has(path.extname(file)),
  ).length;
  // testIds.ts is a deeply nested object literal: count the string leaves at
  // any depth, plus the parametric builder functions alongside them.
  const testIdSource = fs.readFileSync(path.join(appRoot, 'src/testing/testIds.ts'), 'utf8');
  const testIds = {
    leaves: [...testIdSource.matchAll(/:\s*'[^']*',?\s*$/gm)].length,
    builders: [...testIdSource.matchAll(/:\s*\(/g)].length,
  };

  // --- e2e -----------------------------------------------------------------
  const e2eFiles = walkFiles(path.join(appRoot, 'e2e'), (file) => file.endsWith('.e2e.js'));
  let e2eScenarios = 0;
  for (const file of e2eFiles) {
    const source = fs.readFileSync(file, 'utf8');
    e2eScenarios += [...source.matchAll(/^\s*it(?:\.skip)?\(/gm)].length;
    // Some scenarios are declared conditionally, e.g.
    // `(shouldRecordVideo ? it : it.skip)(...)`, which the rule above misses.
    e2eScenarios += [...source.matchAll(/^\s*\([^)]*\?\s*it\s*:\s*it\.skip\s*\)\(/gm)].length;
  }

  // --- git -----------------------------------------------------------------
  // Bounded at the wind-down rather than at HEAD. Two reasons, both of which
  // would otherwise make this figure meaningless:
  //
  //  1. Commits made after the wind-down are the portfolio-snapshot apparatus,
  //     not product work. Counting them inflates the history of a product that
  //     had already stopped.
  //  2. Without a boundary the number moves every time anything is committed,
  //     so no transcription of it into prose can stay correct — see
  //     scripts/portfolio/check-doc-figures.js.
  //
  // The published snapshot is a single squashed commit, so this describes the
  // private repository's history and says so in the emitted methodology.
  const gitFacts = {
    commits: Number(git(appRoot, ['rev-list', '--count', HISTORY_UNTIL, 'HEAD'])),
    firstCommit: git(appRoot, ['log', '--reverse', '--format=%ad', '--date=short']).split('\n')[0],
    lastCommit: git(appRoot, ['log', '-1', HISTORY_UNTIL, '--format=%ad', '--date=short']),
    tags: git(appRoot, ['tag']).split('\n').filter(Boolean).length,
    countedThrough: PRODUCT_HISTORY_END,
  };

  // --- dynamic artifacts ---------------------------------------------------
  let coverage = null;
  let testRun = null;

  const coveragePath = path.join(appRoot, 'coverage/coverage-summary.json');
  if (fs.existsSync(coveragePath)) {
    coverage = summarizeCoverage(JSON.parse(fs.readFileSync(coveragePath, 'utf8')));
  } else if (requireDynamic) {
    throw new Error(`missing ${coveragePath} — run pnpm test:coverage first`);
  }

  const jestResultsPath = path.join(appRoot, 'coverage/jest-results.json');
  if (fs.existsSync(jestResultsPath)) {
    testRun = summarizeJestResults(JSON.parse(fs.readFileSync(jestResultsPath, 'utf8')));
  } else if (requireDynamic) {
    throw new Error(
      `missing ${jestResultsPath} — run: npx jest --ci --json --outputFile coverage/jest-results.json`,
    );
  }

  const testCode = areas.tests.code + areas.e2e.code;

  return {
    generatedAt: new Date().toISOString().slice(0, 10),
    version: pkg.version,
    loc: {
      areas,
      product,
      testCode,
      // Derived from the SAME numerator that is published beside it. These used
      // to disagree: `testCode` included e2e and the ratio did not, so the
      // README printed "77,888 lines — 1.43 lines of test per line shipped"
      // when 77,888 / 50,485 is 1.54. Any reader dividing the two figures on
      // that line got a different answer than the line itself gave.
      shipToTestRatio: Number((testCode / product.code).toFixed(2)),
    },
    database: { migrations, tables },
    localization: {
      locales: locales.length,
      localeCodes: locales,
      messageModules: messageModules.length,
      leavesPerLocale,
      keyDrift,
    },
    routes: { routeFiles },
    testIds,
    e2e: { specs: e2eFiles.length, scenarios: e2eScenarios },
    git: gitFacts,
    dependencies: {
      runtime: Object.keys(pkg.dependencies ?? {}).length,
      dev: Object.keys(pkg.devDependencies ?? {}).length,
    },
    coverage,
    testRun,
    methodology: {
      locCodeLines:
        'Code lines exclude blank lines and comment lines. A line with code plus a trailing comment counts as code; block comments count every line they span.',
      locFileSet: `Files under each area directory with extensions ${[...SOURCE_EXTENSIONS].join(', ')}, excluding node_modules and dotfiles.`,
      coverage:
        'Read from coverage/coverage-summary.json. filesMeasured is the number of files the suite exercises, NOT the number of product files — jest.config.js excludes route and screen wrappers from collection, so untested files never enter the denominator.',
      tests:
        'Read from a jest --json report. Static grepping undercounts because it.each expands at runtime.',
      e2eScenarios:
        'Static count of it() declarations in e2e/*.e2e.js. These are scenario DECLARATIONS: specs are describe.skip-gated on mutually exclusive preset and platform values, so no single Detox run executes them all. They are not "passing tests".',
      screens:
        'Route files are counted directly. Distinct screens require mapping routes to mounted components, since several routes render the same component; that figure is recorded in the docs, not derived here.',
    },
    caveats: [
      'Branch coverage is reported but NOT enforced: jest.config.js coverageThreshold lists only lines, statements and functions.',
      'Coverage percentages describe the modules the suite exercises. Roughly 45 route and screen wrappers are excluded from collection by jest.config.js; two are real screens with no tests.',
      'No git tags exist, so release counts cannot be derived from tags.',
      `Git history is counted through ${PRODUCT_HISTORY_END}, the date Floriva was withdrawn from both stores. Later commits build the portfolio snapshot rather than the product. These figures describe the private repository; the published snapshot is a single squashed commit.`,
      'Detox end-to-end scenarios were not executed as part of this measurement.',
    ],
  };
}

function main() {
  const outIndex = process.argv.indexOf('--out');
  const outPath = outIndex === -1 ? null : process.argv[outIndex + 1];
  const appRoot = path.resolve(__dirname, '..');
  const metrics = collectMetrics({ appRoot, requireDynamic: !process.argv.includes('--static') });
  const json = `${JSON.stringify(metrics, null, 2)}\n`;
  if (outPath) {
    fs.writeFileSync(path.resolve(outPath), json);
    console.log(`wrote ${outPath}`);
  } else {
    process.stdout.write(json);
  }
}

if (require.main === module) main();

module.exports = {
  classifyLines,
  countStringLeaves,
  collectKeyPaths,
  summarizeCoverage,
  summarizeJestResults,
  collectMetrics,
};
