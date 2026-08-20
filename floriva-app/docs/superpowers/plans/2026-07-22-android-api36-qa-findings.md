# Android API 36 QA Findings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the remaining Android API 36 QA limitations by synchronizing reminder diagnostics with completed native reconciliation and replacing the delete-data probe's source-text assertions with behavioral tests.

**Architecture:** Keep production reminder behavior unchanged except for the dev-only diagnostic refresh signal: a reconciliation revision advances only after the native scheduling promise resolves, causing the hidden E2E snapshot to reread the OS schedule. Move the host-only SQLite snapshot logic into an injectable CommonJS E2E helper so Jest can verify command ordering, sidecar handling, SQL quoting, cleanup, retry, and relaunch behavior without exposing test APIs from application code.

**Tech Stack:** Expo 54, React Native 0.81, TypeScript, Jest, React Native Testing Library, Detox, Node.js CommonJS E2E helpers, Android 16/API 36 emulator.

## Global Constraints

- Preserve Android target SDK 36 and minimum SDK 24.
- Preserve edge-to-edge support and the predictive-back opt-out.
- Do not add compile/build-tools pins, dependency upgrades, version/build bumps, signed artifacts, store uploads, rollouts, deployments, or Android large-screen compatibility escape hatches.
- Use RED-GREEN TDD for both fixes and retain at least 95% coverage on touched application files.
- Keep notification diagnostics behind `EXPO_PUBLIC_E2E_SCHEDULED_NOTIFICATIONS=1`; never expose reproductive-health payloads in diagnostics.
- Keep SQLite inspection host-side in E2E infrastructure; do not add a production or in-app database inspection API.

---

### Task 1: Refresh reminder diagnostics after native reconciliation

**Files:**
- Modify: `floriva-app/src/features/settings/screens/SettingsScreen.tsx`
- Modify: `floriva-app/tests/features/settings/SettingsScreen.test.tsx`

**Interfaces:**
- Consumes: `refreshReminderSchedules(): Promise<void>` and `readScheduledNotificationDiagnostics()`.
- Produces: component-local `scheduleReconciliationRevision: number`, incremented only after successful native reminder reconciliation.

- [ ] **Step 1: Write the failing race regression test**

Add a deferred `mockRefreshReminderSchedules` test named `refreshes scheduled notification diagnostics after reminder reconciliation completes`. Enable the diagnostics flag, make `mockReadScheduledNotificationDiagnostics` return a billing-only snapshot until the deferred reconciliation resolves and a `reminder-period-start` snapshot afterward, toggle the period reminder, prove the label remains billing-only while reconciliation is pending, resolve the deferred promise, and expect a later diagnostic read plus the period reminder label.

```tsx
let resolveReconciliation!: () => void;
let reconciliationComplete = false;
mockRefreshReminderSchedules.mockImplementation(
  () => new Promise<void>((resolve) => {
    resolveReconciliation = () => {
      reconciliationComplete = true;
      resolve();
    };
  }),
);
mockReadScheduledNotificationDiagnostics.mockImplementation(async () =>
  reconciliationComplete ? [periodStartDiagnostic] : [billingDiagnostic],
);
```

- [ ] **Step 2: Run RED**

Run:

```bash
corepack pnpm test:ci --runInBand tests/features/settings/SettingsScreen.test.tsx -t "refreshes scheduled notification diagnostics after reminder reconciliation completes"
```

Expected: FAIL because no diagnostic read occurs as a consequence of reconciliation completion, leaving the billing-only label rendered.

- [ ] **Step 3: Implement the smallest synchronization fix**

In `SettingsRemindersScreen`, add:

```tsx
const [scheduleReconciliationRevision, setScheduleReconciliationRevision] = useState(0);
```

After `await refreshReminderSchedules()` succeeds inside `persistReminderPreferences`, add:

```tsx
setScheduleReconciliationRevision((current) => current + 1);
```

Add `scheduleReconciliationRevision` to the scheduled-diagnostics effect dependency list. Do not poll, delay preference rendering, or increment after failed reconciliation.

- [ ] **Step 4: Run GREEN and focused notification regressions**

```bash
corepack pnpm test:ci --runInBand tests/features/settings/SettingsScreen.test.tsx -t "refreshes scheduled notification diagnostics after reminder reconciliation completes"
corepack pnpm test:ci --runInBand tests/features/settings/SettingsScreen.test.tsx tests/lib/notifications/scheduledNotificationDiagnostics.test.ts tests/lib/notifications/reminderScheduler.test.ts
```

Expected: the new test and all focused notification suites pass.

- [ ] **Step 5: Self-review and commit**

```bash
git diff --check
git add floriva-app/src/features/settings/screens/SettingsScreen.tsx floriva-app/tests/features/settings/SettingsScreen.test.tsx
git commit -m "fix(reminders): refresh diagnostics after reconciliation"
```

---

### Task 2: Behaviorally test the Android SQLite snapshot probe

**Files:**
- Create: `floriva-app/e2e/helpers/androidSqliteProbe.js`
- Create: `floriva-app/tests/e2e/androidSqliteProbe.test.ts`
- Modify: `floriva-app/e2e/delete-all-data.e2e.js`
- Modify: `floriva-app/tests/sanity/delete-all-data-e2e.test.ts`

**Interfaces:**
- Produces CommonJS exports `copyAndroidSqliteDatabase`, `queryAndroidDailyLogCount`, and `expectAndroidDailyLogCount`.
- `copyAndroidSqliteDatabase({ tempDir, runAdb, writeFileSync })` copies `floriva.db`, `floriva.db-wal`, and `floriva.db-shm`, requiring a valid base-file header and tolerating only explicitly missing sidecars.
- `queryAndroidDailyLogCount({ logDate, runAdb, execSqlite, fileSystem, tempRoot, sqliteBinary })` force-stops `app.floriva`, snapshots the database set, runs the quoted count query, and always removes its temporary directory.
- `expectAndroidDailyLogCount({ logDate, expectedCount, queryCount, relaunch, delay, now, timeoutMs })` always relaunches after every quiesced query, including throws, and retries only after relaunch.

- [ ] **Step 1: Write failing behavioral tests**

Create `tests/e2e/androidSqliteProbe.test.ts` using injected fakes and real temporary filesystem directories. Cover:

```ts
it('force-stops before copying the base, WAL, and SHM files and cleans up afterward', ...);
it('tolerates only missing SQLite sidecars and rejects missing or invalid base files', ...);
it('rejects unexpected sidecar copy errors', ...);
it('quotes apostrophes in the daily-log date query', ...);
it('relaunches after every snapshot before returning or retrying', ...);
it('relaunches when a snapshot query throws', ...);
```

The ordering assertion must prove `am force-stop` precedes every `run-as ... cat` call and `execSqlite` follows all copies. The relaunch assertions must inspect the actual call sequence, not source text.

- [ ] **Step 2: Run RED**

```bash
corepack pnpm test:ci --runInBand tests/e2e/androidSqliteProbe.test.ts
```

Expected: FAIL because `e2e/helpers/androidSqliteProbe.js` does not exist.

- [ ] **Step 3: Extract the host helper and wire the Detox spec**

Move the existing base/WAL/SHM copy, header validation, force-stop, SQL count, cleanup, retry, and relaunch behavior into the CommonJS helper with dependency defaults from `node:fs`, `node:os`, `node:path`, and `node:child_process`. In `delete-all-data.e2e.js`, import the helper and keep thin wrappers:

```js
const {
  queryAndroidDailyLogCount: queryAndroidDailyLogCountWithDependencies,
  expectAndroidDailyLogCount: expectAndroidDailyLogCountWithDependencies,
} = require('./helpers/androidSqliteProbe');

function queryAndroidDailyLogCount(logDate) {
  return queryAndroidDailyLogCountWithDependencies({ logDate, runAdb });
}

function expectAndroidDailyLogCount(logDate, expectedCount, timeoutMs = 10000) {
  return expectAndroidDailyLogCountWithDependencies({
    logDate,
    expectedCount,
    timeoutMs,
    queryCount: queryAndroidDailyLogCount,
    relaunch: relaunchPreservingContainer,
    delay,
  });
}
```

Remove the extracted Node imports and private helper implementations from the Detox file. Reduce `tests/sanity/delete-all-data-e2e.test.ts` to wiring/suite-presence assertions; the new behavioral suite owns helper correctness.

- [ ] **Step 4: Run GREEN and E2E syntax checks**

```bash
corepack pnpm test:ci --runInBand tests/e2e/androidSqliteProbe.test.ts tests/sanity/delete-all-data-e2e.test.ts
node --check e2e/helpers/androidSqliteProbe.js
node --check e2e/delete-all-data.e2e.js
```

Expected: all behavioral and wiring tests pass and both CommonJS files parse.

- [ ] **Step 5: Self-review and commit**

```bash
git diff --check
git add floriva-app/e2e/helpers/androidSqliteProbe.js floriva-app/e2e/delete-all-data.e2e.js floriva-app/tests/e2e/androidSqliteProbe.test.ts floriva-app/tests/sanity/delete-all-data-e2e.test.ts
git commit -m "test(android): behaviorally verify SQLite probe"
```

---

### Task 3: Re-run API 36 runtime verification and close the QA record

**Files:**
- Modify: `floriva-app/docs/qa/2026-07-22-android-api-36-readiness.md`

**Interfaces:**
- Consumes the Task 1 reminder synchronization and Task 2 E2E helper.
- Produces an updated readiness record with the reminder suite fully passing and the former test-quality limitation resolved.

- [ ] **Step 1: Run automated gates and build**

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test:ci --runInBand
corepack pnpm test:coverage:check
corepack pnpm android:qa:debug-build
```

Expected: all gates and the API 36 debug/instrumentation build pass.

- [ ] **Step 2: Run both affected Android API 36 Detox suites**

Run Metro with the matching E2E variables and execute on `Pixel_9_API_36`:

```bash
DETOX_ANDROID_AVD=Pixel_9_API_36 EXPO_DEV_SERVER_PORT=8081 EXPO_DEV_SERVER_HOST=10.0.2.2 EXPO_PUBLIC_DEV_LAUNCH_PRESET=seeded-tracker EXPO_PUBLIC_E2E_SCHEDULED_NOTIFICATIONS=1 \
  corepack pnpm exec detox test -c android.emu.debug e2e/reminder-scheduling.e2e.js --reuse --loglevel info

DETOX_ANDROID_AVD=Pixel_9_API_36 EXPO_DEV_SERVER_PORT=8081 EXPO_DEV_SERVER_HOST=10.0.2.2 EXPO_PUBLIC_BILLING_E2E_MODE=local-purchase-success \
  corepack pnpm exec detox test -c android.emu.debug e2e/delete-all-data.e2e.js --reuse --loglevel info
```

Expected: reminder scheduling passes 4/4 and delete-all-data passes 2/2.

- [ ] **Step 3: Update the QA record**

Replace the reminder `3 passed, 1 failed` limitation with the final 4/4 result, record the reconciliation-race root cause and fix, record the behavioral SQLite helper tests, and retain the historical manual native alarm/notification evidence. Do not change the existing artifact SDK values unless the rebuilt artifact differs.

- [ ] **Step 4: Verify documentation and commit**

```bash
git diff --check
corepack pnpm test:ci --runInBand tests/sanity/release-config.test.ts tests/sanity/phase4-launch-collateral.test.ts tests/e2e/androidSqliteProbe.test.ts tests/sanity/delete-all-data-e2e.test.ts
git add floriva-app/docs/qa/2026-07-22-android-api-36-readiness.md
git commit -m "docs(qa): close API 36 follow-up findings"
```

Expected: documentation checks pass and the final QA evidence commit is clean.
