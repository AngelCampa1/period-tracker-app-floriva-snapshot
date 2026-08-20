# Testing and quality

Floriva is a local-first period tracker with no server. There is no backend to
roll back, no feature flag service, and no way to hotfix a build that is already
on a phone. Every correctness guarantee has to be established before the binary
leaves the machine. That constraint shaped the test suite more than any
methodology preference did.

This document describes what is actually in the repository, how it is enforced,
and where the numbers are softer than they look.

---

## The numbers, and how they were produced

Measured on this snapshot on 2026-08-18, Node v22.22.0:

```bash
cd floriva-app
pnpm install --frozen-lockfile
npx jest --ci
# Test Suites: 287 passed, 287 total
# Tests:       2 skipped, 4594 passed, 4596 total
# Snapshots:   0 total
```

| | |
| --- | --- |
| Test suites | 287 |
| Tests | 4,596 (4,594 pass here, 2 skip: see below) |
| Focused (`.only`) / todo | 0 |
| Snapshot (`.snap`) tests | 0 |
| Coverage: lines | 98.80% |
| Coverage: statements | 98.77% |
| Coverage: functions | 99.70% |
| Coverage: branches | 90.67% (**measured, not gated**) |
| Modules in the coverage denominator | 243 |
| Detox spec files | 22 |
| Detox scenario declarations | 44 (**not executed as part of measurement**) |

Coverage figures come from `coverage/coverage-summary.json` produced by
`pnpm test:coverage`, which the private repo ran at the same commit
(98.80 / 98.77 / 99.70 / 90.67 over 243 files). Every other figure above was
re-derived directly against this tree.

### Three files removed, and why the counts differ

The private repository reads **290 suites** at this commit. This published
snapshot reads **287**, because three test files were removed during
sanitization:

- `tests/sanity/phase4-launch-collateral.test.ts`
- `tests/sanity/release-config.test.ts`
- `tests/scripts/portfolio/sanitize.test.ts`

The first two are release-operations guard tests. Both assert on the *contents*
of internal release runbooks: that a setup guide contains a specific support
address, that a runbook does not contain a specific personal address. Those
documents carried personal contact details and were excluded from publication
wholesale. With their subject documents gone the tests cannot pass, so they left
with them.

The third is the sanitizer's own test file, and it is out for a more interesting
reason: it cannot survive its own pipeline. Its fixtures are, by construction,
the exact strings the rewrite pass replaces. Run the sanitizer over the file and
the fixtures are rewritten along with everything else, so the emitted copy
asserted that the *anonymized* form `~/Code/floriva` trips the developer-home-path
rule, when `~` is precisely what that rule rewrites paths *to*. The test
inverted itself. The remaining cases derive their fixtures from a rewrite table
built out of the same documents Tier 3 correctly excludes, so they have nothing
left to assert against either.

There were three options: publish a copy that fails, publish a copy edited until
it passes vacuously, or publish neither and say why. Only the last leaves a
reader with true information. `scripts/portfolio/sanitize.js` itself still ships
and is the thing worth reading. It is only its test that is missing.

Between them the three files contributed 99 test cases (verified by running just
those three on their own): the private repository reads 4,695 cases at this
commit, this snapshot 4,596. 4,695 − 99 = 4,596.

### Two cases skip here, and why

`pnpm test` in this repository reports **4,594 passed, 2 skipped**. Both skips
are environmental rather than disabled tests.

**The store-asset guide.**

```js
// tests/sanity/store-screenshot-config.test.ts
const hasStoreAssetGuide = fs.existsSync(storeAssetGuidePath);

(hasStoreAssetGuide ? it : it.skip)(
  'documents a separate iOS billing-fallback paywall pass',
  () => { … },
);
```

That case asserts on `STORE_ASSET_GUIDE.md`, which lives in a sibling marketing
package outside `floriva-app/` and is not part of this snapshot. It was the only
assertion in the whole suite reaching outside the app package: a genuine defect
in the test rather than a consequence of sanitization, since it also fails for
anyone who checks out the app without its sibling. It now skips when the guide
is absent and runs when it is present.

**The git history.**

```js
// tests/scripts/portfolio/metrics.test.ts
const hasProductHistory = metrics.git.commits > 0;

(hasProductHistory ? it : it.skip)(
  'records git history facts including the absence of tags',
  () => {
    expect(metrics.git.commits).toBeGreaterThan(700);
    …
  },
);
```

That case asserts on more than 700 commits. The commit metric counts product
history through 2026-08-11, the day Floriva was withdrawn from both stores;
commits after that boundary build the snapshot rather than the product and are
deliberately not counted. This published repository is a single squashed commit
dated after that boundary, so it legitimately counts zero here. The assertion is
a statement about the private repository's history and it runs there. Failing it
here would be reporting an artefact of publication as a defect.

One further figure appears in the audit record: **4,592**, the count at the commit
*before* the snapshot tooling was added. It is the right number for that commit
and the wrong number for this repository, and its closeness to 4,596 is
coincidence rather than relation. Where figures disagree, the ones above
(produced by running this tree) are the ones to trust.

The exclusions are declared in the sanitizer rather than done quietly:

```js
// floriva-app/scripts/portfolio/sanitize.js:171-177
  // Tier 6b — release-operations guard tests. These assert on the *contents* of
  // the Tier 3 docs above (e.g. that the setup guide contains a given support
  // address). With their subject documents excluded they cannot pass, so they
  // leave with them. This costs 2 of 287 test files and is disclosed in the
  // published docs/testing-and-quality.md rather than quietly absorbed.
  'tests/sanity/phase4-launch-collateral.test.ts',
  'tests/sanity/release-config.test.ts',
```

```js
// floriva-app/scripts/portfolio/sanitize.js:179-189
  // The sanitizer's own test file, which cannot survive its own pipeline. Its
  // fixtures are by construction the exact strings the rewrite pass replaces,
  // so the emitted copy asserts that `~/Code/floriva` trips the developer-home
  // rule — it does not, because `~` is what that rule rewrites *to*. The rest
  // of it derives fixtures from the rewrite table, which is built from
  // documents Tier 3 correctly excludes.
  //
  // Deleting it is honest; shipping a copy that fails, or one quietly rewritten
  // into passing vacuously, is not. sanitize.js itself still ships and is the
  // thing worth reading. Disclosed in docs/testing-and-quality.md.
  'tests/scripts/portfolio/sanitize.test.ts',
```

Both comments are quoted verbatim, and the first carries stale arithmetic of its
own: it says "2 of 287 test files" where the correct figure is 2 of 290. The
code is frozen and was not edited to tidy the quote, so the discrepancy is named
here instead. With all three removals, 290 files become 287.

### Case counts are date-sensitive

A jest run of the private repository's full composition at this same commit on
2026-08-12 reported 4,671 tests; the run on 2026-08-18 reported 4,695. Nothing
changed in the tree. Several parameterised
suites build their tables from seeded histories anchored on the current date
(see `resolveQaFixtureToday` and the tenure fixtures), so the number of
generated cases shifts as the anchor moves. A test count from this repository is
only meaningful with its date attached, which is why every figure above carries
one.

This does not contradict the determinism result below, which compares two runs
made on the same day.

### Determinism

The suite was run twice on the same day under deliberately different
concurrency: single-worker (`--runInBand`, 190 s) and default parallel workers
(`--ci`, 80 s). The comparison was machine-diffed, not eyeballed:

- identical suite and case totals
- every `file::fullName` test identity present in both runs, with zero present in
  one run and absent from the other (4,592 identities at the commit measured)
- zero per-file coverage differences across all 243 files

That is evidence the suite is order- and concurrency-independent. It is not
evidence of "zero flaky tests", which two runs cannot establish, and that
stronger claim is not made anywhere in this repository.

---

## The loop, as actually practised

The workflow was test-first for domain logic and security-sensitive code, and
test-alongside for presentation. Three artefacts in the tree show this rather
than assert it.

**1. Characterization goldens written before a refactor, not after.**
`floriva-app/tests/lib/predictions/goldenCharacterization.test.ts:1-17` pins the
full `PredictionResult` for a spread of histories, as visible deep-equality
literals rather than `.snap` files, with the rule stated in the file header:

```
 * Purpose: pin the CURRENT, observed behavior of `buildPredictionResult` for a
 * representative spread of histories BEFORE any internal refactor. […] Every
 * field of `PredictionResult` is snapshotted (via a plain deep-equality object,
 * not `toMatchSnapshot`, so the expected values are visible and reviewable in
 * this file rather than hidden in a `.snap` file) […]
 *
 * Do NOT "fix" a golden to make it pass after the refactor — if a golden
 * fails post-extraction, the extraction introduced a behavior change and must
 * be corrected instead.
```

This is why there are zero snapshot tests in a 4,596-test suite. A `.snap` file
that can be regenerated with `-u` is not a constraint; a literal you have to
edit by hand is.

**2. Bug fixes ship with the regression test that would have caught them.**
The last functional commit before retirement fixed three onboarding screens that
still navigated at a route removed in the previous release, and closed with:

> Adds a guard regression test covering `/paywall` and `/billing-options`
> across all three start paths, asserting the user is always moved and never
> onto a billing surface.

**3. The ratio.** 50,485 lines of product code against 77,987 lines of test and
e2e code: 1.54 lines of test per line shipped. That ratio is a consequence of
the loop, not a target that was aimed at.

---

## The coverage gate

Jest's own threshold is global only:

```js
// floriva-app/jest.config.js:78-84
  coverageThreshold: {
    global: {
      lines: 95,
      statements: 95,
      functions: 95,
    },
  },
```

A global threshold is close to useless on a large suite: one thoroughly tested
module subsidises a dozen untested ones. So the real gate is a separate script
that walks **every entry** in the coverage summary and fails on any single file
below the floor:

```js
// floriva-app/scripts/check-coverage.js:13-14
const COVERAGE_METRICS = ['lines', 'statements', 'functions'];
const MINIMUM_COVERAGE_PERCENT = 95;
```

```js
// floriva-app/scripts/check-coverage.js:42-60
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
```

`pnpm test:coverage:check` runs jest with coverage and then this script. All 243
files clear 95% on lines, statements and functions; the lowest single file sits
at 95.52%.

The gate script is itself under test.
`floriva-app/tests/sanity/coverage-tooling.test.ts:39-58` feeds
`evaluateCoverageSummary` a synthetic summary where one file has 90% function
coverage while the total is 100%, and asserts the exact failure string. A
per-file gate that silently stopped checking per file would be invisible
otherwise.

### Where the coverage number is soft

Three things a reader should know before quoting 98.80%.

**Branches are measured but not enforced.** `coverageThreshold` has no
`branches` key. Branch coverage is 90.67%, and 62 of the 243 files sit below 95%
on branches. Nothing in the repository claims otherwise, and neither does this
document.

**243 is not the number of product files.** There are 297 product code files
under `app/ src/ components/ constants/`. `jest.config.js` carries **65 explicit
`'!'` exclusions** (`floriva-app/jest.config.js:11-75`), almost all thin
route/screen wrappers, plus `src/testing/**` and `.d.ts`/`.web.tsx` patterns.
Excluded files never enter the denominator at all. They do not appear at 0% and
drag the average down. So the honest phrasing is "98.80% line coverage across
the 243 modules the suite exercises", not "98.80% of the codebase".

The `jest.config.js` exclusions are at least auditable: a long explicit list of
named files rather than a blanket `app/**` ignore. And there are **zero** inline
`istanbul ignore next/else/if` directives anywhere in product code: no
individual line or branch was cherry-picked out of a file that is otherwise
measured.

**`jest.config.js` is not the whole story, though.** Fifteen product files
carry a whole-file `/* istanbul ignore file */` header. Eleven of them are also
named in the `jest.config.js` list, so the directive is redundant there. The
other four are not:

```
app/(app)/settings/birth-control.tsx
app/(app)/settings/cycle-setup.tsx
app/(app)/settings/subscription/save-offer.tsx
app/(app)/settings/tracking-setup.tsx
```

Those four are inside `collectCoverageFrom` and are removed from the report by
the source-file directive alone. Checked against
`coverage/coverage-summary.json`: all four are **absent**, not present at 0%.
The practical effect is identical to a `jest.config.js` exclusion, but it is
declared in the file being excluded rather than in the list a reader would go
looking at, so the honest count of route/screen wrappers kept out of the
denominator is 65 config exclusions **plus** four source-level ones.

**Two of the excluded files are real screens with no tests at all.**
`floriva-app/src/features/onboarding/screens/CycleBasicsScreen.tsx` (221 lines)
and `floriva-app/src/features/onboarding/screens/GoalsScreen.tsx` (215 lines)
are routed components with real logic. Neither is `istanbul`-ignored; no test
imports them; they simply never enter the report. That is a genuine gap, and
stating it is more useful than the number it slightly spoils.

---

## Test taxonomy

Filenames encode the *kind* of test, not just its subject. Counts from
`git ls-files tests`:

| Suffix | Files | What it means |
| --- | --- | --- |
| `*.adversarial.test.ts` | 53 | Hostile input: malformed exports, absurd dates, corrupted envelopes, hostile numeric ranges |
| `*probe*.test.ts` | 40 | Exploratory bug hunts, usually cross-cutting, usually named after the bug they pinned |
| `*longTenure*.test.ts` | 14 | Multi-month and multi-year data shapes |
| `*.integration.test.tsx` | 3 | Multi-provider flows exercised through the real component tree |
| `goldenCharacterization.test.ts` | 1 | Full-result behavioural pins for the prediction engine |

26 files are both `probe` and `adversarial`: an exploratory probe that found
something is usually promoted into a hostile-input suite rather than deleted.

The adversarial files cluster where the risk is: the import parsers
(`importParsers.adversarial`, `.clueManual.adversarial`, `.probe.adversarial`,
`.realworld.probe.adversarial`, `.probe.longTenure`), the backup crypto
(`backupPackage.adversarial`, `backupRoundtrip.probe.adversarial`), the SQLite
layer (`repositories.adversarial`, `runtimeSchemaRepair.adversarial`,
`persistenceWipe.probe.adversarial`), and date arithmetic
(`dateMath.adversarial`, `dateMath.probe2.adversarial`). Those are the four
places where a bug corrupts a user's data rather than annoying them.

---

## `tests/sanity/`: testing the build, not the app

Sixteen files here (eighteen in the private repo) assert on the *repository and
its native projects* rather than on application behaviour. They are the cheapest
insurance in the codebase: each one encodes a mistake that was actually made once
and cost real time.

**`detox-config.test.ts`**: the Detox JS config and the checked-in native
projects can drift apart silently, and the failure only shows up as an e2e run
that hangs on a booted device. So the config is asserted against the Gradle files
and the instrumentation runner directly
(`floriva-app/tests/sanity/detox-config.test.ts:66-95`):

```ts
    expect(appBuildGradle).toContain(
      'testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"',
    );
    expect(appBuildGradle).toContain('testBuildType System.getProperty("testBuildType", "debug")');
    expect(appBuildGradle).toContain("androidTestImplementation(project(':detox'))");
    expect(appBuildGradle).not.toContain('androidTestImplementation("com.wix:detox:+")');
    expect(rootBuildGradle).toContain('../node_modules/detox/Detox-android');
    expect(detoxRunner).toContain('ActivityTestRule<MainActivity>');
```

The most valuable case in that file is the last one, which is a security
assertion wearing a build-config costume
(`floriva-app/tests/sanity/detox-config.test.ts:97-112`):

```ts
    expect(candidateManifest).toContain('android:usesCleartextTraffic="true"');
    expect(productionManifest).not.toContain('android:usesCleartextTraffic="true"');
```

The screenshot-candidate build variant needs cleartext to reach the Detox
websocket. This test makes it impossible for that permission to migrate into the
production manifest without a red suite.

**`release-preflight.test.ts`**: 18 cases against the release gate script,
covering the platform-specific release-note rules, version/build-number matching
against a real IPA `Info.plist` and an AAB manifest, and every failure mode of
the Android keystore checks. It builds a throwaway temp directory with fake
`keytool` / `unzip` / `plutil` / `bundletool` executables on `PATH`, so the
script's real branch logic runs without needing signing material. Described in
detail in [release-engineering.md](release-engineering.md).

**`native-build-artifacts.test.ts`**: asserts that `git ls-files` over
`ios/build*`, `android/build` and `android/app/build` returns an empty list. A
committed native build output is a 100 MB mistake that is very easy to make and
very annoying to unwind.

**`ios-native-dependency-sync.test.ts`**: when RevenueCat was removed from
`package.json`, its native references survived in `project.pbxproj` and
`Podfile.lock`, and the iOS build kept linking a pod for a dependency that no
longer existed. The test now asserts `react-native-purchases` is not installed
**and** that no checked-in native artefact mentions `RNPurchases`,
`PurchasesHybridCommon` or `RevenueCat`.

**`user-facing-copy-versioning.test.ts`**: walks `app/`, `src/features/*/screens/`,
every `copy.ts`, and all of `src/localization/messages/`, and fails if any of
them match `/\bv1\b/i`. Internal release labels are useful in a runbook and
embarrassing in shipped UI.

Three more are one-liners with a specific scar behind each.
**`package-compatibility.test.ts`** pins `expo` and `expo-sqlite` to the
SDK-54-compatible line and asserts `test:ci` does not contain `--runInBand`.
**`import-resolution.test.ts`** resolves one real symbol through every `@/` alias
namespace, because a tsconfig/jest alias mismatch otherwise surfaces as a wall of
unrelated failures. **`metro-config.test.ts`** asserts
`sourceExts.includes('sql')` and `assetExts.includes('wasm')`: Drizzle
migrations are imported as `.sql`, and the SQLite WASM build must be an asset.

**`screenshot-candidate-config.test.ts`**: asserts that
`extra.screenshotCandidateEnabled` appears in the Expo config *only* when
`FLORIVA_SCREENSHOT_CANDIDATE` is exactly `'1'`, and never in an ordinary release
config. That flag is what allows a Release build to honour a seeded launch
preset; it must not be able to leak into a store binary.

**`store-screenshot-config.test.ts`**: 12 cases over the capture harness
config: the eight locale mappings, the fail-closed behaviour on an unsupported
locale, and the rules that keep the paywall and import screenshots pinned to the
fixtures that make them truthful.

> One case in this file (`:132-142`, with the reasoning at `:121-131`) reads
> `STORE_ASSET_GUIDE.md` from the sibling marketing repository, which this
> snapshot does not carry. It is declared as
> `(hasStoreAssetGuide ? it : it.skip)`, so it runs in the private repo and
> **skips** here rather than failing. That is one of the two skips in the counts
> above.

**`testIds.test.ts`**: asserts concrete values for the stable IDs the e2e suite
selects on, and round-trips each parametric builder:

```ts
    expect(buildTodayLoggingChipTestId('symptoms', 'cramps')).toBe(
      'today-logging-chip-symptoms-cramps',
    );
    expect(buildCalendarDayCellTestId('2026-04-30')).toBe(
      'calendar-day-cell-2026-04-30',
    );
```

---

## The testID registry

`floriva-app/src/testing/testIds.ts` is 498 lines, has zero imports, and is the
single source of every selector the e2e suite uses. Measured by importing it and
walking the tree:

| | |
| --- | --- |
| Leaf entries in the `testIds` object | 330 |
| - unique string IDs | 324 |
| - duplicate string IDs | **0** |
| - inline parametric builders (arrow functions) | 6 |
| Exported `build*TestId` functions | 21 |

The convention is that a component never writes a testID string inline. Measured
across `src/` and `app/`:

```bash
grep -rohE "testID=" src app | wc -l          # 418
grep -rohE "testID=\{testIds" src app | wc -l # 282
grep -rohE "testID=\{build" src app | wc -l   #  38
grep -rnE  'testID="' src app | wc -l         #  29
```

So 320 of 418 testID props resolve through the registry directly, 29 are inline
literals that predate the convention, and the remainder arrive through component
props. The convention is strong but not total, and the 29 exceptions are real.

The 21 exported builders exist for ID families keyed by a runtime value:
`buildCalendarDayCellTestId('2026-04-30')`, `buildInsightsConditionRowTestId('pcos')`.
Keeping them as functions rather than template literals at the call site is what
makes it possible to change an ID scheme in one place and have both the app and
every e2e spec follow.

---

## Deterministic launch presets

The hardest part of end-to-end testing a local-first app is that there is no
server to seed. `floriva-app/src/testing/devLaunchPreset.ts` (367 lines) solves
this with 19 named presets that wipe and re-seed the on-device SQLite database at
`DatabaseProvider` mount:

```ts
// floriva-app/src/testing/devLaunchPreset.ts:33-48
const supportedDevLaunchPresets = new Set<DevLaunchPreset>([
  'fresh-install',
  'seeded-tracker',
  'qa-rich-history',
  'locked-app',
  'import-ready',
  'backup-ready',
  'billing-fallback',
  'grandfathered-expired',
  'save-offer-monthly-active',
  'save-offer-monthly-trial',
  'save-offer-annual-active',
  'save-offer-annual-trial',
  'save-offer-lifetime',
  ...tenureFixtureVariantValues,
]);
```

`tenureFixtureVariantValues` supplies the remaining six
(`floriva-app/src/testing/tenureFixtures.ts:62-69`): `tenure-1mo-new`,
`tenure-3mo-regular`, `tenure-6mo-gap`, `tenure-12mo-regular`,
`tenure-12mo-irregular`, `tenure-lapsed`.

Three properties make these usable as an e2e substrate.

**They are anchored on a resolvable "today", never a hardcoded date**
(`floriva-app/src/testing/devLaunchPreset.ts:287-294`):

```ts
  // `resolveQaFixtureToday()` is the runtime today for interactive launches, or
  // a pinned reference under Detox (EXPO_PUBLIC_QA_FIXTURE_TODAY) so e2e runs are
  // deterministic and date-embedded testIDs stay stable.
```

A seeded 12-month history always looks current when launched by hand, and always
lands on the same dates under Detox. Since testIDs embed dates
(`calendar-day-cell-2026-04-30`), without the pinned clock every calendar
selector would rot overnight.

**They cannot activate in a production build.** The gate is explicit
(`floriva-app/src/testing/devLaunchPreset.ts:104-120`):

```ts
export function isDevLaunchPresetAllowed({
  candidate, isDev, nodeEnv, screenshotCandidateEnabled,
}: { … }) {
  if (nodeEnv === 'test') {
    return candidate != null;
  }

  return isDev || (screenshotCandidateEnabled && candidate != null);
}
```

A release binary has `__DEV__ === false` and, unless it was compiled with
`FLORIVA_SCREENSHOT_CANDIDATE=1`, no `screenshotCandidateEnabled` in
`Constants.expoConfig.extra`, so `resolveDevLaunchPreset` returns `null` and
nothing seeds. That second condition is what
`tests/sanity/screenshot-candidate-config.test.ts` exists to protect.

**Re-seeding is idempotent where re-seeding would destroy state.** The preset
re-runs on every `DatabaseProvider` mount, which includes a cold relaunch that
preserves the container. For the two billing presets that seed a locked state,
that would wipe access the test just established
(`floriva-app/src/testing/devLaunchPreset.ts:245-264`):

```ts
  // Preservation guard for the expired-billing presets. […] The preset
  // re-runs on every DatabaseProvider mount, so a cold relaunch that
  // preserves the container (Detox `delete: false`, or a real process death)
  // would otherwise wipe a trial/subscription the user started in a prior
  // session -- destroying exactly the persisted access the app is expected to
  // keep. Production never re-seeds a preset, so mirror that […]
```

---

## End-to-end: what it is, and what it is not

22 Detox spec files under `floriva-app/e2e/` declare **44 scenarios**. That is a
count of declarations, not of passing tests, and the distinction matters.

Every one of the 22 spec files chooses `describe` or `describe.skip` at module
load time from `EXPO_PUBLIC_DEV_LAUNCH_PRESET`, `device.getPlatform()`, or a
capture flag (25 such expressions in total):

```js
const backupExportDescribe   = launchPreset == null ? describe : describe.skip;
const backupReadyDescribe    = launchPreset === 'backup-ready' ? describe : describe.skip;
const describeFreshPaywall   = launchPreset == null ? describe : describe.skip;
const describeCapture        = shouldRun ? describe : describe.skip;
```

The gates are mutually exclusive. `smoke.e2e.js` runs only when the preset is
**not** `qa-rich-history`; six other specs run only when it **is**;
`backup-export.e2e.js` requires the preset to be unset entirely. **No single
`detox test` invocation can execute all 44.** The 44 is a union across many
configurations, deliberately, because each scenario needs a different seeded
world.

Two of the 44 are skipped at the declaration site:
`e2e/biometric-lock.e2e.js:207` is an unconditional `it.skip`, and
`e2e/long-tenure-sweep.e2e.js:575` uses `(shouldRecordVideo ? it : it.skip)`.

The Detox suite was **not executed** as part of producing the numbers in this
document. It needs a booted simulator or emulator and a native debug build.
Nothing here should be read as "44 passing E2E tests". The historical evidence of
those runs, including device logs and captures, is under
`floriva-app/docs/qa/`.

`detox.config.js` defines four app builds (iOS/Android × debug/screenshot-
candidate) and four matching configurations. The screenshot-candidate builds are
Release-configuration binaries signed with the debug keystore and carrying a
`-screenshot-candidate` version suffix, so they cannot be mistaken for a store
artefact.

---

## CI

`floriva-app/.github/workflows/ci.yml` runs on every push to `main` and every
pull request:

```yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test:ci
```

Four gates, no coverage upload, no badge service, no third party. `pnpm lint` is
ESLint over `app components constants drizzle e2e src tests` plus seven root
config files. The config files are linted too. `pnpm typecheck` is
`tsc --noEmit` over the whole project including tests.

`pnpm test:ci` is `jest --ci` without coverage; the coverage gate
(`pnpm test:coverage:check`) is run locally before release rather than in CI,
because collecting coverage roughly doubles the wall time and the per-file floor
had never been the thing that broke.

Detox is not in CI. It requires a macOS runner with a booted simulator, and for
a single-maintainer project that cost was not worth paying for a suite that has
to be run in mutually exclusive batches anyway.
