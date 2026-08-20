const fs = require('node:fs');
const path = require('node:path');

const {
  buildFigureChecks,
  checkDocFigures,
  withThousands,
  asPercent,
  parseArgs,
} = require('../../../scripts/portfolio/check-doc-figures.js');

const appRoot = path.resolve(__dirname, '../../..');

/**
 * The public documentation sits in two different places depending on which
 * repository this test is running in:
 *
 *   private   floriva-app/docs/portfolio/public/   (the overlay, pre-assembly)
 *   published <repo root>/                         (the overlay, copied to root)
 *
 * Resolving both means the same test guards the figures in both trees. If
 * neither is found that is a real failure, not a reason to skip — the check
 * passing vacuously is the one outcome worth guarding against.
 */
function resolvePublicRoot() {
  const candidates = [path.join(appRoot, 'docs/portfolio/public'), path.resolve(appRoot, '..')];
  const found = candidates.find((dir) => fs.existsSync(path.join(dir, 'metrics.json')));
  if (!found) {
    throw new Error(
      `metrics.json not found in any known documentation root: ${candidates.join(', ')}`,
    );
  }
  return found;
}

const publicRoot = resolvePublicRoot();

function loadMetrics() {
  return JSON.parse(fs.readFileSync(path.join(publicRoot, 'metrics.json'), 'utf8'));
}

describe('number formatting', () => {
  it('groups thousands the way the docs write them', () => {
    expect(withThousands(50485)).toBe('50,485');
    expect(withThousands(287)).toBe('287');
    expect(withThousands(1107)).toBe('1,107');
  });

  it('quotes coverage to two decimals, including trailing zeros', () => {
    // 99.7 must render as "99.70" — the docs write it that way, and a naive
    // String() would silently never match.
    expect(asPercent(99.7)).toBe('99.70');
    expect(asPercent(98.78)).toBe('98.78');
    expect(asPercent(90.66)).toBe('90.66');
  });
});

describe('parseArgs', () => {
  it('reads both required flags', () => {
    expect(parseArgs(['--metrics', 'm.json', '--docs', 'public'])).toEqual({
      metrics: 'm.json',
      docs: 'public',
    });
  });

  it('leaves unsupplied flags null', () => {
    expect(parseArgs([])).toEqual({ metrics: null, docs: null });
  });
});

describe('checkDocFigures', () => {
  const metrics = {
    loc: { product: { files: 297, code: 50485 }, testCode: 77772, shipToTestRatio: 1.42 },
    testRun: { suites: 287, tests: 4643 },
    coverage: { lines: 98.78, branches: 90.66, functions: 99.7, filesMeasured: 243 },
    localization: { locales: 8, leavesPerLocale: 1107 },
    database: { migrations: 20, tables: 15 },
    e2e: { specs: 22, scenarios: 44 },
    routes: { routeFiles: 72 },
    git: { commits: 708 },
  };

  it('passes when a document quotes the current figure', () => {
    const failures = checkDocFigures({
      metrics,
      readDoc: () => 'the suite holds 4,643 tests',
      checks: [{ label: 'test cases', text: '4,643', files: ['README.md'] }],
    });

    expect(failures).toEqual([]);
  });

  it('fails when a document quotes a stale figure', () => {
    // The exact drift this check exists to catch: metrics moved to 4,643 and
    // the prose still says 4,592.
    const failures = checkDocFigures({
      metrics,
      readDoc: () => 'the suite holds 4,592 tests',
      checks: [{ label: 'test cases', text: '4,643', files: ['README.md'] }],
    });

    expect(failures).toEqual([
      { label: 'test cases', file: 'README.md', expected: '4,643' },
    ]);
  });

  it('reports every document that disagrees, not just the first', () => {
    const failures = checkDocFigures({
      metrics,
      readDoc: () => 'stale',
      checks: [{ label: 'test cases', text: '4,643', files: ['README.md', 'docs/metrics.md'] }],
    });

    expect(failures.map((f: { file: string }) => f.file)).toEqual([
      'README.md',
      'docs/metrics.md',
    ]);
  });

  it('fails loudly when a document is missing rather than passing vacuously', () => {
    const failures = checkDocFigures({
      metrics,
      readDoc: () => null,
      checks: [{ label: 'test cases', text: '4,643', files: ['README.md'] }],
    });

    expect(failures).toEqual([
      { label: 'test cases', file: 'README.md', expected: '4,643', missingFile: true },
    ]);
  });

  it('derives its expectations from metrics.json rather than constants', () => {
    const checks = buildFigureChecks(metrics);
    const byLabel = Object.fromEntries(
      checks.map((c: { label: string; text: string }) => [c.label, c.text]),
    );

    expect(byLabel['test cases']).toBe('4,643');
    expect(byLabel['product code lines']).toBe('50,485');
    expect(byLabel['coverage — functions']).toBe('99.70%');

    // Change the metric, and the expectation changes with it.
    const moved = buildFigureChecks({
      ...metrics,
      testRun: { suites: 287, tests: 9999 },
    });
    expect(
      moved.find((c: { label: string }) => c.label === 'test cases').text,
    ).toBe('9,999');
  });
});

describe('the published documentation', () => {
  it('quotes every headline figure exactly as metrics.json reports it', () => {
    const failures = checkDocFigures({
      metrics: loadMetrics(),
      readDoc: (file: string) => {
        const full = path.join(publicRoot, file);
        return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
      },
    });

    expect(failures).toEqual([]);
  });
});
