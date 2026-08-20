# Metrics and methodology

Every number in this repository is produced by
[`floriva-app/scripts/collect-portfolio-metrics.js`](../floriva-app/scripts/collect-portfolio-metrics.js),
which emits `metrics.json`.

The figures *are* typed by hand from `metrics.json` into the prose of these
documents: the script measures, a human transcribes, and hand transcription
drifts. Three different values for the same test-code line count once coexisted
across three of these files. So the transcription is checked rather than
trusted: `scripts/portfolio/check-doc-figures.js` re-reads `metrics.json` and
fails if any document quotes a stale number, and
[`checkDocFigures.test.ts`](../floriva-app/tests/scripts/portfolio/checkDocFigures.test.ts)
runs it in the suite. A substring check cannot prove a document *interprets* a
number correctly, only that the number it quotes is current, which is the
failure this class of bug actually produces.

The script refuses to emit anything if the test suite is red or a coverage
artifact is missing, so a number here cannot come from a broken build.

Regenerate:

```bash
cd floriva-app
npx jest --ci --coverage --coverageReporters=json-summary \
  --json --outputFile coverage/jest-results.json
node scripts/collect-portfolio-metrics.js --out metrics.json
```

---

## How these numbers were checked

Each figure was measured twice, by two independent passes using different
methods, and reconciled before publication. That process changed five of them.

| Metric | First pass | Second pass | Published |
| --- | --- | --- | --- |
| Distinct screens | 62 | 51 | **51** |
| E2E scenarios | 42 | 44 | **44** |
| Coverage denominator | "the codebase" | 243 of 297 files | **243 modules** |
| testIDs | 324 | 324 | **324** |
| Locale string leaves | 789 (regex) | 1,107 (deep diff) | **1,107** |

The screen count moved because the first pass counted navigable route files
rather than distinct mounted components. `app/(app)/subscribe.tsx` and
`app/(onboarding)/billing-options.tsx` render the same `<SubscribeScreen />`
with identical props; ten route files render a component another route already
renders. Mapping all 64 navigable routes to components gives 54 identities,
minus two pure `<Redirect>` routes and one dev-only gallery.

The locale count moved because a regex over the message modules undercounts:
they splice in shared constants. The published figure comes from evaluating the
real translations object and diffing full key paths.

---

## Code

| | Files | Total lines | Code lines |
| --- | --- | --- | --- |
| Product (`src/`, `app/`, `components/`, `constants/`) | 297 | n/a | 50,485 |
| Tests (`tests/`, `e2e/`) | n/a | n/a | 77,987 |

**Ship-to-test ratio: 1 : 1.54.**

"Code lines" excludes blank lines and comment lines. A line carrying code plus a
trailing comment counts as code; a block comment counts every line it spans.
Total, code, comment and blank always sum: that identity is asserted in
[`tests/scripts/portfolio/metrics.test.ts`](../floriva-app/tests/scripts/portfolio/metrics.test.ts).

The file set is everything under each area directory with a `.ts`, `.tsx`,
`.js`, `.jsx`, `.mjs`, or `.cjs` extension, excluding `node_modules` and
dotfiles.

## Tests

| | |
| --- | --- |
| Suites | 287 |
| Tests | 4,596 |
| Skipped | 0 (2 in this snapshot, see below) |
| Focused (`.only`) | 0 |

Read from a `jest --json` report, not from grep: `it.each(...)` expands at
runtime, so static counting undercounts substantially.

These figures describe the published composition. The private repository holds
290 suites and 4,695 cases; sanitization removed three test files contributing
99 cases between them, and 4,695 − 99 = 4,596. The three, and why each had to
go, are named in [testing-and-quality.md](testing-and-quality.md).

Both skips are environmental, not disabled tests. A case in
`tests/sanity/store-screenshot-config.test.ts` asserts on a store-asset guide
that lives in a sibling marketing package, which this snapshot does not include.
A case in `tests/scripts/portfolio/metrics.test.ts` asserts the repository holds
more than 700 commits, which is true of the private repository and not of a
snapshot published as a single squashed commit. Both run there and skip here.

**Determinism.** The suite was run twice under different concurrency: 190s
single-worker (`--runInBand`) and 80s parallel (`--ci`). Both produced identical
test identities (zero tests present in one run and absent from the other) and
zero per-file coverage differences across all 243 files. That is evidence of
determinism under the two configurations tested, not a guarantee against flake
under others.

## Coverage

| | |
| --- | --- |
| Lines | 98.80% |
| Statements | 98.77% |
| Functions | 99.70% |
| Branches | 90.67% |
| Modules measured | 243 |

**Two caveats that materially change how to read this.**

**Branches are measured but not gated.** `jest.config.js` sets a 95% threshold
for lines, statements and functions only. There is no `branches` key. 62 of the
243 measured files sit below 95% on branches.

**243 is not 297.** The coverage denominator is the set of modules the suite
exercises, not the set of product files. `jest.config.js` carries 65 explicit
`'!'` exclusions (mostly route and screen wrappers), so an untested file does
not appear at 0% and drag the average down. It does not appear at all.

Two of the excluded files are real screens with no tests whatsoever:
`src/features/onboarding/screens/CycleBasicsScreen.tsx` (221 lines) and
`GoalsScreen.tsx` (215 lines).

So: *98.80% of the modules the suite exercises*, enforced per file at a 95%
floor. Not "98.80% of the codebase."

## End-to-end

| | |
| --- | --- |
| Detox specs | 22 |
| Scenario declarations | 44 |

These are **declarations, not passing tests**. 21 of the 22 specs are
`describe.skip`-gated on mutually exclusive `EXPO_PUBLIC_DEV_LAUNCH_PRESET` and
platform values, so no single Detox run can execute all 44. They were not
executed as part of this measurement: the screenshots in this repository were
produced by running a subset of them, which is a different claim.

Two scenarios are missed by a naive `/^\s*it\(/` regex, which is the whole
42-vs-44 discrepancy: `e2e/long-tenure-sweep.e2e.js:575` is declared as
`(shouldRecordVideo ? it : it.skip)(...)`, and `e2e/biometric-lock.e2e.js:207`
is a plain unconditional `it.skip(...)`. The collector matches both patterns
explicitly rather than counting `it(`.

## Data layer

| | |
| --- | --- |
| Drizzle migrations | 20 |
| SQLite tables | 15 |

## Localization

| | |
| --- | --- |
| Locales | 8 (en, es, de, fr, ja, zh-Hans, pt, ru) |
| Message modules | 16 |
| String leaves per locale | 1,107 |
| Total strings | 8,856 |
| Key drift | **0** |

Zero drift means every locale has exactly the same set of full key paths: no
missing keys, no extra keys, no leaf/branch type mismatches. Verified by deep
key-path diff across all eight, not by comparing top-level namespaces.

See [localization.md](localization.md) for the honest note about which of those
strings were reviewed by a native speaker.

## Surfaces

| | |
| --- | --- |
| Route files | 72 |
| Navigable routes | 64 |
| Distinct screens | 51 |
| Centralized testIDs | 324 leaves + 6 parametric builders |

## History

| | |
| --- | --- |
| Commits | 706 |
| Span | 2026-04-08 → 2026-08-11 |
| Tags | **0** |

There are no git tags, so release counts cannot be derived from them. Release
history in [release-engineering.md](release-engineering.md) comes from commit
messages and release documents.

These are the private repository's numbers, counted through 2026-08-11, the day
Floriva was withdrawn from both stores. Commits after that boundary build the
portfolio snapshot rather than the product and are not counted. This published
repository has a git history of exactly one squashed commit, which is why the
commit-count assertion in `tests/scripts/portfolio/metrics.test.ts` skips here.

## Dependencies

47 runtime, 15 dev.

---

An accessibility audit exists in [`floriva-app/docs/qa/`](../floriva-app/docs/qa/),
a manual review against WCAG success criteria, not a certification.
