#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_COVERAGE_SUMMARY_PATH = path.resolve(
  __dirname,
  '..',
  'coverage',
  'coverage-summary.json',
);

const COVERAGE_METRICS = ['lines', 'statements', 'functions'];
const MINIMUM_COVERAGE_PERCENT = 95;

function formatPercent(value) {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
}

function readCoverageSummary(summaryPath) {
  if (!fs.existsSync(summaryPath)) {
    throw new Error(`Coverage summary not found at ${summaryPath}. Run \"pnpm test:coverage\" first.`);
  }

  const rawContents = fs.readFileSync(summaryPath, 'utf8');

  try {
    return JSON.parse(rawContents);
  } catch (error) {
    throw new Error(`Unable to parse coverage summary at ${summaryPath}: ${error.message}`);
  }
}

function evaluateCoverageSummary(summary, minimumPercent = MINIMUM_COVERAGE_PERCENT) {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    throw new Error('coverage-summary.json must contain an object summary.');
  }

  const failures = [];
  const entries = Object.entries(summary);

  for (const [filePath, coverageEntry] of entries) {
    if (filePath === 'total') {
      continue;
    }

    for (const metric of COVERAGE_METRICS) {
      const pct = coverageEntry?.[metric]?.pct;

      if (typeof pct !== 'number') {
        throw new Error(`Coverage summary entry for ${filePath} is missing ${metric} pct data.`);
      }

      if (pct < minimumPercent) {
        failures.push(
          `${filePath}: ${metric} ${formatPercent(pct)}% is below ${minimumPercent}%`,
        );
      }
    }
  }

  const total = summary.total;

  if (!total || typeof total !== 'object') {
    throw new Error('coverage-summary.json is missing the total aggregate.');
  }

  for (const metric of COVERAGE_METRICS) {
    const pct = total?.[metric]?.pct;

    if (typeof pct !== 'number') {
      throw new Error(`Coverage summary total is missing ${metric} pct data.`);
    }

    if (pct < minimumPercent) {
      failures.push(`total: ${metric} ${formatPercent(pct)}% is below ${minimumPercent}%`);
    }
  }

  return failures;
}

function main(argv = process.argv) {
  const summaryPath = argv[2] ? path.resolve(process.cwd(), argv[2]) : DEFAULT_COVERAGE_SUMMARY_PATH;
  const summary = readCoverageSummary(summaryPath);
  const failures = evaluateCoverageSummary(summary);

  if (failures.length > 0) {
    throw new Error(`Coverage check failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
  }

  return failures;
}

if (require.main === module) {
  try {
    main();
    console.log(`Coverage check passed at ${DEFAULT_COVERAGE_SUMMARY_PATH}.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  COVERAGE_METRICS,
  DEFAULT_COVERAGE_SUMMARY_PATH,
  MINIMUM_COVERAGE_PERCENT,
  evaluateCoverageSummary,
  main,
  readCoverageSummary,
};
