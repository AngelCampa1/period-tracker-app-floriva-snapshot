
const jestConfig = require('../../jest.config.js');

const { evaluateCoverageSummary } = require('../../scripts/check-coverage.js');

describe('coverage tooling', () => {
  it('targets production source code and excludes route wrappers and non-behavioral shims', () => {
    expect(jestConfig.collectCoverageFrom).toEqual(
      expect.arrayContaining([
        'app/**/*.{ts,tsx,js,jsx}',
        'src/**/*.{ts,tsx,js,jsx}',
        'components/**/*.{ts,tsx,js,jsx}',
        'constants/**/*.{ts,tsx,js,jsx}',
        '!tests/**/*',
        '!src/testing/**/*',
        '!src/**/__tests__/**',
        '!**/*.web.ts',
        '!**/*.web.tsx',
        '!app/+html.tsx',
        '!app/lock.tsx',
        '!app/(app)/(tabs)/calendar.tsx',
        '!app/(app)/backup/export.tsx',
        '!app/(onboarding)/welcome.tsx',
        '!components/useClientOnlyValue.ts',
        '!components/useClientOnlyValue.web.ts',
        '!src/features/app-shell/copy.ts',
      ]),
    );

    expect(jestConfig.coverageThreshold).toEqual({
      global: {
        lines: 95,
        statements: 95,
        functions: 95,
      },
    });
  });

  it('fails when an included file drops below the 95 percent floor', () => {
    const failures = evaluateCoverageSummary({
      total: {
        lines: { total: 100, covered: 100, skipped: 0, pct: 100 },
        statements: { total: 100, covered: 100, skipped: 0, pct: 100 },
        functions: { total: 100, covered: 100, skipped: 0, pct: 100 },
        branches: { total: 100, covered: 100, skipped: 0, pct: 100 },
      },
      'src/features/onboarding/model.ts': {
        lines: { total: 20, covered: 19, skipped: 0, pct: 95 },
        statements: { total: 20, covered: 19, skipped: 0, pct: 95 },
        functions: { total: 10, covered: 9, skipped: 0, pct: 90 },
        branches: { total: 12, covered: 12, skipped: 0, pct: 100 },
      },
    });

    expect(failures).toEqual([
      'src/features/onboarding/model.ts: functions 90.00% is below 95%',
    ]);
  });

  it('fails when the total included aggregate drops below the 95 percent floor', () => {
    const failures = evaluateCoverageSummary({
      total: {
        lines: { total: 100, covered: 94, skipped: 0, pct: 94 },
        statements: { total: 100, covered: 95, skipped: 0, pct: 95 },
        functions: { total: 100, covered: 96, skipped: 0, pct: 96 },
        branches: { total: 100, covered: 100, skipped: 0, pct: 100 },
      },
      'src/features/tracker/buildTodaySnapshot.ts': {
        lines: { total: 30, covered: 30, skipped: 0, pct: 100 },
        statements: { total: 30, covered: 30, skipped: 0, pct: 100 },
        functions: { total: 8, covered: 8, skipped: 0, pct: 100 },
        branches: { total: 10, covered: 10, skipped: 0, pct: 100 },
      },
    });

    expect(failures).toEqual(['total: lines 94.00% is below 95%']);
  });
});
