# Floriva Plus Program Ledger

Date started: 2026-05-13
Program branch prefix: `codex/`
Program runbook: `floriva-app/docs/floriva-plus-program.md`

This ledger is the durable state for the Floriva Plus iterative build program. Before starting a new session, read the latest entry and resume the first slice with status `in_progress` or `blocked`.

## Status Legend

- `pending`: not started
- `in_progress`: active in the current or next session
- `reviewing`: implementation is complete and review/QA is running
- `blocked`: cannot proceed without resolving the listed blocker
- `done`: implementation, tests, simulator QA where applicable, review, fixes, and ledger update are complete

## Program Slices

| Slice | Status | Branch / Worktree | Last Updated | Notes |
| --- | --- | --- | --- | --- |
| 1. Program foundation | done | `codex/floriva-plus-foundation` / `~/Code/floriva/.worktrees/floriva-plus-foundation` | 2026-05-13 | Runbook, ledger, command confirmation, baseline verification repair, review fixes, and post-review verification are complete. |
| 2. Private Timeline | done | `codex/floriva-plus-timeline` / `~/Code/floriva/.worktrees/floriva-plus-timeline` | 2026-05-13 | Implementation, full coverage, iOS simulator QA, Android simulator QA, sub-agent review, fix loops, and re-verification are complete. |
| 3. Import Concierge | done | `codex/floriva-plus-import-concierge` / `~/Code/floriva/.worktrees/floriva-plus-import-concierge` | 2026-05-13 | Implementation, full coverage, iOS simulator QA, Android simulator QA, review fixes, final re-review, commit, and merge to `main` are complete. |
| 4. Encrypted Backup Productization | done | `codex/floriva-plus-backup-productization` / `~/Code/floriva/.worktrees/floriva-plus-backup-productization` | 2026-05-13 | Backup/export/restore UX polish, billing revalidation hardening, full coverage, iOS simulator QA, Android simulator QA, review fixes, and clean final re-review are complete. |
| 5. Prediction Confidence and Preparedness | done | `codex/floriva-plus-prediction-preparedness` / `~/Code/floriva/.worktrees/floriva-plus-prediction-preparedness` | 2026-05-14 | Prediction confidence context, real local reminder center, cancellation split, E2E screenshot QA, review fix, and final verification are complete. |
| 6. Birth-Control Hub | done | `codex/floriva-plus-birth-control-hub` / `~/Code/floriva/.worktrees/floriva-plus-birth-control-hub` | 2026-05-14 | Method-aware setup, local reminders, missed/late logging, Today summaries, iOS/Android screenshot QA, review fixes, and final verification are complete. |
| 7. TTC Mode | done | `codex/floriva-plus-ttc-mode` / `~/Code/floriva/.worktrees/floriva-plus-ttc-mode` | 2026-05-14 | TTC setup preview, gated daily logging controls, Today summaries, Insights detail, iOS/Android screenshot QA, review fixes, and final verification are complete. |
| 8. Condition Modes | done | `codex/floriva-plus-condition-modes` / `~/Code/floriva/.worktrees/floriva-plus-condition-modes` | 2026-05-14 | Condition-aware logging context, active condition Insights rows, condition detail summaries, iOS/Android screenshot QA, review fix, and final verification are complete. |
| 9. Personal Pattern Briefings | done | `codex/floriva-plus-pattern-briefings` / `~/Code/floriva/.worktrees/floriva-plus-pattern-briefings` | 2026-05-14 | Local monthly briefing card/detail, fallback month wording, iOS/Android screenshot QA, review fixes, and final verification are complete. |
| 10. Flagship Integration Pass | done | `codex/floriva-plus-flagship-integration` / `~/Code/floriva/.worktrees/floriva-plus-flagship-integration` | 2026-05-14 | Monthly briefing integrated into Private Timeline, briefing source transparency added with current-mode gating, reminder routing tightened, iOS/Android simulator QA, review fix, and final re-review are complete. |

## Slice 1: Program Foundation

### Acceptance Criteria

- [x] Dedicated worktree created under `.worktrees/`.
- [x] Program runbook added with guardrails, slice order, command gates, simulator QA contract, and ledger contract.
- [x] Living ledger added with the full Floriva Plus slice list and status tracking.
- [x] Commands confirmed from repo truth: `package.json`, `detox.config.js`, `phase-1-execution-readiness.md`, and existing QA ledgers.
- [x] Baseline typecheck and lint run in the worktree.
- [x] Focused automated baseline rerun after the reminder test repair.
- [x] Sub-agent review completed and findings resolved.

### Files Touched

- `floriva-app/docs/README.md`
- `floriva-app/docs/floriva-plus-program.md`
- `floriva-app/docs/qa/2026-05-13-floriva-plus-program-ledger.md`
- `floriva-app/src/features/import/model.ts`
- `floriva-app/src/features/import/screens/ImportFlowScreens.tsx`
- `floriva-app/src/localization/messages/import.ts`
- `floriva-app/src/testing/testIds.ts`
- `floriva-app/src/types/domain.ts`
- `floriva-app/tests/features/import/ImportFlowProvider.test.tsx`
- `floriva-app/tests/features/import/ImportFlowScreens.test.tsx`
- `floriva-app/tests/features/import/importWorkflow.test.ts`
- `floriva-app/tests/localization/translations.test.ts`
- `floriva-app/tests/sanity/testIds.test.ts`
- `floriva-app/tests/lib/notifications/reminderScheduler.test.ts`

### Verification Log

| Time | Command / Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-05-13 | `corepack pnpm install --frozen-lockfile` | pass | Dependencies installed. pnpm reported expected blocked build-script warning for native/dev tooling packages. |
| 2026-05-13 | `corepack pnpm typecheck` | pass | No TypeScript errors. |
| 2026-05-13 | `corepack pnpm lint` | pass | No ESLint errors. |
| 2026-05-13 | `corepack pnpm test:ci --runInBand tests/sanity tests/features/backup tests/features/import tests/lib/predictions tests/lib/notifications` | fail, then repaired | `tests/lib/notifications/reminderScheduler.test.ts` used a fixed 2026 first-charge date that became past-due on 2026-05-13. Test was updated to pin `Date.now()` for that case. |
| 2026-05-13 | `corepack pnpm test:ci --runInBand tests/sanity tests/features/backup tests/features/import tests/lib/predictions tests/lib/notifications` | pass | Rerun passed after the reminder test repair: 23 suites, 176 tests. |
| 2026-05-13 | Sub-agent spec compliance review | fixed | Reviewer found stale `in_progress` ledger state and unchecked rerun/review items after verification passed. |
| 2026-05-13 | Sub-agent code/docs quality review | fixed | Reviewer found ambiguous simulator-QA wording for non-user-facing slices, missing `docs/README.md` in files touched, and one adjacent `Date.now` spy without `finally`. |
| 2026-05-13 | `corepack pnpm test:ci --runInBand tests/lib/notifications/reminderScheduler.test.ts` | pass | Post-review focused rerun passed: 1 suite, 7 tests. |
| 2026-05-13 | `corepack pnpm typecheck` | pass | Post-review rerun passed. |
| 2026-05-13 | `corepack pnpm lint` | pass | Post-review rerun passed. |
| 2026-05-13 | `corepack pnpm test:ci --runInBand tests/sanity tests/features/backup tests/features/import tests/lib/predictions tests/lib/notifications` | pass | Post-review rerun passed: 23 suites, 176 tests. |

### Simulator Evidence

No simulator UI pass is required for this docs/test-foundation slice because it does not add or change user-facing app surfaces. Future user-facing slices must include iOS and Android simulator evidence before `done`.

### Review Findings

| ID | Severity | Source | Finding | Status |
| --- | --- | --- | --- | --- |
| FP-001 | P1 | automated baseline | First-charge reminder test was date-sensitive and failed after the fixture date became past-due. | fixed and rerun passed |
| FP-002 | P1 | spec review | Ledger still marked Slice 1 incomplete after rerun and review were underway, making same-chat resumption ambiguous. | fixed |
| FP-003 | P2 | quality review | Runbook implied simulator QA agents for every slice, while the ledger allowed this non-user-facing foundation slice to skip simulator UI QA. | fixed |
| FP-004 | P3 | quality review | Ledger omitted `floriva-app/docs/README.md` from files touched. | fixed |
| FP-005 | P3 | quality review | Adjacent past-due billing reminder test restored `Date.now` without `finally`. | fixed |

### Remaining Blockers

- None for Slice 1.

### Next Recommended Slice

Start Slice 2: Private Timeline in a new dedicated worktree.

## Slice 2: Private Timeline

### Acceptance Criteria

- [x] Dedicated worktree created under `.worktrees/`.
- [x] Existing data and UI seams explored by sub-agents before implementation.
- [x] Pure timeline model added for logs, notes, TTC observations, birth-control events, import summaries, reminder summaries, and backup event inputs.
- [x] Calendar-owned Timeline route and screen added without changing the main tab set.
- [x] Timeline UI includes filters, date sorting, empty state, load error state, and private/sensitive badges.
- [x] Calendar root opens the private timeline.
- [x] Focused automated tests added for model, screen behavior, and calendar entry routing.
- [x] Full automated verification rerun.
- [x] iOS simulator functional/UX QA.
- [x] Android simulator functional/UX QA.
- [x] Sub-agent final review completed after late Android Detox wiring changes.

### Files Touched

- `floriva-app/app/(app)/calendar/timeline.tsx`
- `floriva-app/android/app/build.gradle`
- `floriva-app/android/app/src/androidTest/java/app/floriva/DetoxTest.java`
- `floriva-app/android/settings.gradle`
- `floriva-app/detox.config.js`
- `floriva-app/drizzle/0013_floriva_plus_timeline.sql`
- `floriva-app/drizzle/meta/_journal.json`
- `floriva-app/drizzle/migrations.js`
- `floriva-app/e2e/private-timeline.e2e.js`
- `floriva-app/e2e/smoke.e2e.js`
- `floriva-app/src/components/primitives/ActionButton.tsx`
- `floriva-app/src/db/contracts.ts`
- `floriva-app/src/db/repositories.ts`
- `floriva-app/src/db/schema.ts`
- `floriva-app/src/db/validators.ts`
- `floriva-app/src/features/backup/model.ts`
- `floriva-app/src/features/backup/screens/BackupScreen.tsx`
- `floriva-app/src/features/calendar/screens/CalendarScreen.tsx`
- `floriva-app/src/features/timeline/buildPrivateTimelineModel.ts`
- `floriva-app/src/features/timeline/date.ts`
- `floriva-app/src/features/timeline/screens/PrivateTimelineScreen.tsx`
- `floriva-app/src/features/timeline/types.ts`
- `floriva-app/src/localization/messages/calendar.ts`
- `floriva-app/src/testing/devLaunchPreset.ts`
- `floriva-app/src/testing/testIds.ts`
- `floriva-app/src/types/domain.ts`
- `floriva-app/tests/app/calendar-route.test.tsx`
- `floriva-app/tests/components/ActionButton.test.tsx`
- `floriva-app/tests/db/dailyLogRepository.test.ts`
- `floriva-app/tests/db/domainDataLayer.test.ts`
- `floriva-app/tests/db/migrationsManifest.test.ts`
- `floriva-app/tests/db/schema.test.ts`
- `floriva-app/tests/db/validators.test.ts`
- `floriva-app/tests/features/app-shell/AppShellProvider.hydration.test.tsx`
- `floriva-app/tests/features/backup/BackupScreen.test.tsx`
- `floriva-app/tests/features/backup/model.test.ts`
- `floriva-app/tests/features/billing/BillingProvider.test.tsx`
- `floriva-app/tests/features/calendar/CalendarScreen.test.tsx`
- `floriva-app/tests/features/timeline/buildPrivateTimelineModel.test.ts`
- `floriva-app/tests/features/timeline/date.test.ts`
- `floriva-app/tests/features/timeline/PrivateTimelineScreen.test.tsx`
- `floriva-app/tests/localization/translations.test.ts`
- `floriva-app/tests/sanity/testIds.test.ts`
- `floriva-app/docs/qa/2026-05-13-floriva-plus-program-ledger.md`

### Verification Log

| Time | Command / Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-05-13 | `corepack pnpm install --frozen-lockfile` | pass | Dependencies installed. pnpm reported expected blocked build-script warning for native/dev tooling packages. |
| 2026-05-13 | `corepack pnpm test:ci --runInBand tests/features/timeline/buildPrivateTimelineModel.test.ts` | pass | Model TDD pass: 1 suite, 2 tests. |
| 2026-05-13 | `corepack pnpm test:ci --runInBand tests/features/timeline tests/features/calendar/CalendarScreen.test.tsx` | pass | Focused UI/model rerun: 3 suites, 28 tests. |
| 2026-05-13 | `corepack pnpm lint` | pass | Focused implementation lint gate. |
| 2026-05-13 | `corepack pnpm typecheck` | pass | Type issue in import-session narrowing was fixed, then typecheck passed. |
| 2026-05-13 | `corepack pnpm test:ci --runInBand tests/features/timeline tests/features/calendar tests/app/calendar-route.test.tsx tests/sanity/testIds.test.ts` | pass | Broader relevant rerun: 9 suites, 62 tests. |
| 2026-05-13 | `corepack pnpm test:ci --runInBand tests/features/timeline tests/features/backup/BackupScreen.test.tsx tests/features/backup/model.test.ts tests/localization/translations.test.ts tests/sanity/testIds.test.ts` | pass | Review-fix focused rerun: 7 suites, 59 tests. |
| 2026-05-13 | `corepack pnpm typecheck` | pass | Post-review rerun after timeline, backup, DB, and localization changes. |
| 2026-05-13 | `corepack pnpm lint` | pass | Post-review rerun after e2e and native test config changes. |
| 2026-05-13 | `corepack pnpm test:coverage:check` | pass | Full suite passed: 136 suites, 994 tests. Coverage checker passed; touched files remained above the 95% rule. |
| 2026-05-13 | `EXPO_DEV_SERVER_PORT=8081 DETOX_IOS_DEVICE='iPhone 17 Pro' corepack pnpm detox:build:ios` | pass | Required `pod install` first in this fresh worktree, then native iOS debug build succeeded. |
| 2026-05-13 | `EXPO_PUBLIC_DEV_LAUNCH_PRESET=qa-rich-history EXPO_DEV_SERVER_PORT=8081 EXPO_DEV_SERVER_HOST=127.0.0.1 DETOX_IOS_DEVICE='iPhone 17 Pro' corepack pnpm detox:test:ios -- e2e/private-timeline.e2e.js` | pass | iOS private timeline smoke passed after replacing brittle duplicate-text assertions with stable row IDs and adding timeline bottom clearance. |
| 2026-05-13 | `EXPO_DEV_SERVER_PORT=8081 DETOX_ANDROID_AVD='Pixel_9_API_35' corepack pnpm detox:build:android` | pass | Android debug APK and Android test APK build passed after adding the Detox test APK path, runner source, Detox Gradle wiring, and `full` flavor selection. |
| 2026-05-13 | `EXPO_PUBLIC_DEV_LAUNCH_PRESET=qa-rich-history EXPO_DEV_SERVER_PORT=8081 EXPO_DEV_SERVER_HOST=127.0.0.1 DETOX_ANDROID_AVD='Pixel_9_API_35' corepack pnpm detox:test:android -- e2e/private-timeline.e2e.js` | blocked | Android Detox now installs/runs the instrumentation APK, but Expo Dev Client readiness still times out before JS assertions. |
| 2026-05-13 | Manual Android emulator QA with `adb` on `Pixel_9_API_35` | pass | Installed debug APK, reversed Metro port, connected dev client, dismissed dev-menu intro, opened `floriva://calendar/timeline`, dumped UI tree, and captured screenshots. Verified private timeline screen, entry count, filter controls, TTC filter rows, and reminder filter rows. Evidence files: `/tmp/floriva-android-timeline.png`, `/tmp/floriva-android-timeline-ttc.png`, `/tmp/floriva-android-timeline-reminders.png`. |
| 2026-05-13 | `corepack pnpm lint` | pass | Rerun after final-review E2E selector fixes and `Podfile.lock` cleanup. |
| 2026-05-13 | `EXPO_PUBLIC_DEV_LAUNCH_PRESET=qa-rich-history EXPO_DEV_SERVER_PORT=8081 EXPO_DEV_SERVER_HOST=127.0.0.1 DETOX_IOS_DEVICE='iPhone 17 Pro' corepack pnpm detox:test:ios -- e2e/private-timeline.e2e.js` | pass | Rerun after final-review E2E filter fixes: 1 suite, 1 test. |
| 2026-05-13 | Multiple focused sub-agent reviews | fixed | Product/privacy and data/model reviews were clean. UX/localization review found sparse row accessibility labels and localization polish issues. Native/E2E review found Android Detox new-architecture and launch-path issues. |
| 2026-05-13 | `corepack pnpm test:ci --runInBand tests/localization/translations.test.ts tests/features/timeline/PrivateTimelineScreen.test.tsx` | pass | Rerun after accessibility-label and localization polish fixes: 2 suites, 19 tests. |
| 2026-05-13 | `EXPO_DEV_SERVER_PORT=8081 DETOX_ANDROID_AVD='Pixel_9_API_35' corepack pnpm detox:build:android` | pass | Rebuilt after changing the Android runner to launch `MainActivity` and expose the app `ReactHost` for new architecture. |
| 2026-05-13 | `EXPO_PUBLIC_DEV_LAUNCH_PRESET=qa-rich-history EXPO_DEV_SERVER_PORT=8081 EXPO_DEV_SERVER_HOST=127.0.0.1 DETOX_ANDROID_AVD='Pixel_9_API_35' corepack pnpm detox:test:android -- e2e/private-timeline.e2e.js` | pass | Android Detox private timeline smoke passed on `Pixel_9_API_35`: 1 suite, 1 test. Android now launches the base dev-client URL, then opens timeline through the app shell. |
| 2026-05-13 | `EXPO_PUBLIC_DEV_LAUNCH_PRESET=qa-rich-history EXPO_DEV_SERVER_PORT=8081 EXPO_DEV_SERVER_HOST=127.0.0.1 DETOX_IOS_DEVICE='iPhone 17 Pro' corepack pnpm detox:test:ios -- e2e/private-timeline.e2e.js` | pass | iOS Detox rerun after shared E2E launch-path changes: 1 suite, 1 test. |
| 2026-05-13 | Scoped sub-agent re-reviews | pass | Native/E2E re-review clean after Android runner/test fixes. UX/localization re-review found remaining polish, then second localization re-review was clean after targeted translation test coverage. |
| 2026-05-13 | `corepack pnpm lint` | pass | Final lint rerun after review fixes. |
| 2026-05-13 | `corepack pnpm typecheck` | pass | Final TypeScript rerun after review fixes. |
| 2026-05-13 | `git diff --check` | pass | No whitespace errors. |
| 2026-05-13 | `corepack pnpm test:coverage:check` | pass | Full suite passed: 136 suites, 995 tests. Coverage checker passed; touched files remained above the 95% rule. |

### Simulator Evidence

- iOS: Detox passed on `iPhone 17 Pro` for `e2e/private-timeline.e2e.js` with `qa-rich-history`. Covered route open, seeded timeline rows, sensitive note redaction row, TTC filter, birth-control filter, and reminder filter. Final rerun after shared E2E changes passed on 2026-05-13.
- Android: Manual emulator QA passed on `Pixel_9_API_35` with `adb` and `qa-rich-history`. UI tree evidence showed `calendar-timeline-screen`, `Private timeline`, `26 private timeline entries`, selected TTC filter with `private-timeline-item-ttc-qa-log-2026-04-14`, and selected Reminders filter with reminder rows. Final Android Detox run also passed on `Pixel_9_API_35` for `e2e/private-timeline.e2e.js` after the native runner and app-shell launch-path fixes.
- Color QA note: no theme token or app-shell color diff was introduced by this slice. Clean simulator installs use `themePreference: 'system'`; the observed return to old/default colors is simulator state/default palette behavior, not a Slice 2 theme edit.

### Review Findings

| ID | Severity | Source | Finding | Status |
| --- | --- | --- | --- | --- |
| PT-001 | P1 | UX/code review | Timeline loaded only a one-year date window, hiding older local/imported history. | fixed by `dailyLogs.listAll()` and screen hydration changes |
| PT-002 | P1 | UX/code review | Backup events were modeled but not sourced from real storage. | fixed with `backup_events` table, repository, export/restore event recording, and restore/export tests |
| PT-003 | P2 | UX/code review | Reminder rows used fake sentinel dates. | fixed with real reminder plan dates and date tests |
| PT-004 | P2 | UX/code review | Sensitive notes were displayed verbatim in aggregate timeline. | fixed by showing generic localized note text |
| PT-005 | P2 | UX/code review | Filter empty state lacked recovery and selected filter accessibility state. | fixed with selected accessibility state and `Show all` recovery |
| PT-006 | P2 | UX/code review | Timeline copy and row labels were hardcoded or leaked enum values. | fixed with localization keys and localized TTC/birth-control label mapping |
| PT-007 | P2 | code review | Backup export event could be recorded before file/share success. | fixed by recording export only after write/share handoff; share errors now block success/event recording |
| PT-008 | P2 | iOS simulator QA | Final timeline row could be clipped behind the floating tab area. | fixed with timeline tab-bar reservation and bottom spacer; iOS Detox rerun passed |
| PT-009 | P2 | Android simulator QA | Android Detox config produced/installed an empty test APK and then timed out before assertions. | fixed with `testBinaryPath`, Detox Gradle wiring, `MainActivity` runner, app `ReactHost` exposure, app-shell timeline navigation, and passing Android Detox rerun |
| PT-010 | P1 | final review | E2E tapped a filter while the filter row could be offscreen after scrolling to a row. | fixed with `selectTimelineFilter()` scrolling to top before each filter tap; iOS Detox rerun passed |
| PT-011 | P2 | final review | E2E used `not.toBeVisible()` for birth-control under TTC filter, which could pass because the row was merely offscreen. | fixed with `not.toExist()` after TTC filtering; iOS Detox rerun passed |
| PT-012 | P2 | final review | `ios/Podfile.lock` contained unrelated Hermes checksum churn from `pod install`. | fixed by restoring the tracked checksum; lockfile is no longer modified |
| PT-013 | P2 | UX/accessibility re-review | Timeline row accessibility labels only announced the action title, omitting date, detail, meta, and private state. | fixed with composed row accessibility labels and focused RNTL assertion |
| PT-014 | P2 | UX/localization re-review | New timeline translations had ASCII/transliteration leftovers and inconsistent `...` loading ellipses. | fixed with accented localized strings, ellipsis consistency, translation regression test, and clean re-review |
| PT-015 | P1 | native/E2E re-review | Android Detox runner was not new-architecture ready because it only exposed the legacy `ReactNativeHost`. | fixed by exposing the app `ReactHost` from the runner and verifying Android Detox passes |
| PT-016 | P2 | native/E2E re-review | Android E2E launch path used URL handoffs that left Detox unable to reach the timeline reliably. | fixed by launching the base dev-client URL and navigating to timeline through app-shell controls; Android and iOS Detox reruns passed |

### Remaining Blockers

- None for Slice 2.

### Next Recommended Slice

Start Slice 3: Import Concierge in a new dedicated worktree after committing/merging Slice 2.

## Slice 3: Import Concierge

### Acceptance Criteria

- [x] Dedicated worktree created under `.worktrees/`.
- [x] Baseline import, parser, and route tests run before implementation.
- [x] Existing import parser, workflow, repository, UI, and QA surfaces mapped by sub-agents.
- [x] Import review handles duplicates with clear row-level and summary language.
- [x] Import review shows warnings, confidence language, unsupported-row handling, and manual fallback guidance.
- [x] Import preview supports safe editing before commit without claiming medical authority.
- [x] Post-import summary clearly reports committed, skipped, duplicate, edited, and unsupported rows.
- [x] Clue, Flo, partial files, unsupported rows, duplicates, and manual fallback covered by tests.
- [x] iOS simulator QA completed for import review and commit.
- [x] Android simulator QA completed for import review and commit.
- [x] UX review, code review, fixes, and re-verification completed for automated/import-review scope.

### Files Touched

- `floriva-app/docs/qa/2026-05-13-floriva-plus-program-ledger.md`
- `floriva-app/android/app/build.gradle`
- `floriva-app/e2e/import-concierge.e2e.js`
- `floriva-app/src/db/contracts.ts`
- `floriva-app/src/db/repositories.ts`
- `floriva-app/src/features/import/ImportFlowProvider.tsx`
- `floriva-app/src/features/import/model.ts`
- `floriva-app/src/features/import/screens/ImportFlowScreens.tsx`
- `floriva-app/src/features/import/screens/ImportScreen.tsx`
- `floriva-app/src/localization/messages/import.ts`
- `floriva-app/src/testing/testIds.ts`
- `floriva-app/src/types/domain.ts`
- `floriva-app/tests/app/importRoutes.test.tsx`
- `floriva-app/tests/db/domainDataLayer.test.ts`
- `floriva-app/tests/features/import/ImportFlowProvider.test.tsx`
- `floriva-app/tests/features/import/ImportFlowScreens.test.tsx`
- `floriva-app/tests/features/import/ImportScreen.test.tsx`
- `floriva-app/tests/features/import/importWorkflow.test.ts`
- `floriva-app/tests/localization/translations.test.ts`
- `floriva-app/tests/sanity/detox-config.test.ts`
- `floriva-app/tests/sanity/testIds.test.ts`

### Verification Log

| Time | Command / Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-05-13 | `corepack pnpm install --frozen-lockfile` | pass | Dependencies installed in the Slice 3 worktree. pnpm reported the expected ignored build-script warning for native/dev tooling packages. |
| 2026-05-13 | `corepack pnpm test:ci --runInBand tests/features/import tests/lib/parsing tests/app/importRoutes.test.tsx tests/testing/importCorpus.test.ts` | pass | Baseline import/parsing/route suite passed: 7 suites, 97 tests. |
| 2026-05-13 | Parser/model, UI/UX, and simulator/E2E exploration agents | pass | Existing import flow, extension points, and E2E gaps mapped. Native picker remains best covered by provider tests; simulator import scenarios should use seeded previews. |
| 2026-05-13 | `corepack pnpm test:ci --runInBand tests/features/import/importWorkflow.test.ts tests/features/import/ImportFlowScreens.test.tsx tests/features/import/ImportFlowProvider.test.tsx tests/localization/translations.test.ts tests/sanity/testIds.test.ts` | pass | First Import Concierge vertical focused tests passed: 5 suites, 61 tests. |
| 2026-05-13 | `corepack pnpm lint` | pass | Passed after removing an unused import. |
| 2026-05-13 | `corepack pnpm typecheck` | pass | Passed after tightening the date-range helper locale type. |
| 2026-05-13 | `corepack pnpm test:ci --runInBand tests/features/import tests/lib/parsing tests/app/importRoutes.test.tsx tests/testing/importCorpus.test.ts` | pass | Broader import/parsing/route regression passed after first vertical: 7 suites, 101 tests. |
| 2026-05-13 | Spec, UX/localization, and code/model sub-agent reviews | fixed | Reviews found missing editable-preview controls, skipped-only review loss, raw parser English in routed review, unsupported-shape localization, duplicate-safe repository ID collision, legacy duplicate commits, raw bleeding enum labels, and duplicate-only low-confidence language. All blocking/important findings were fixed and rechecked. |
| 2026-05-13 | `corepack pnpm test:ci --runInBand tests/features/import/ImportFlowProvider.test.tsx tests/features/import/ImportFlowScreens.test.tsx tests/features/import/ImportScreen.test.tsx tests/features/import/importWorkflow.test.ts tests/db/domainDataLayer.test.ts tests/localization/translations.test.ts tests/sanity/testIds.test.ts` | pass | Review-fix focused rerun passed: 7 suites, 114 tests. |
| 2026-05-13 | `corepack pnpm test:ci --runInBand tests/features/import/importWorkflow.test.ts tests/features/import/ImportFlowScreens.test.tsx tests/features/import/ImportFlowProvider.test.tsx` | pass | Final UX-fix focused rerun for localized bleeding labels and duplicate-only confidence: 3 suites, 59 tests. |
| 2026-05-13 | `corepack pnpm typecheck` | pass | Final TypeScript rerun after review fixes. |
| 2026-05-13 | `corepack pnpm lint` | pass | Final lint rerun after review fixes. |
| 2026-05-13 | `corepack pnpm test:ci --runInBand tests/features/import tests/lib/parsing tests/app/importRoutes.test.tsx tests/testing/importCorpus.test.ts tests/db/domainDataLayer.test.ts tests/localization/translations.test.ts tests/sanity/testIds.test.ts` | pass | Broad import/parsing/route/localization/db regression passed: 10 suites, 140 tests. |
| 2026-05-13 | `corepack pnpm test:coverage:check` | pass | Full suite passed: 143 suites, 1 skipped, 1083 passed / 1084 total. Coverage checker passed; touched files remained above the 95% rule. |
| 2026-05-13 | `EXPO_DEV_SERVER_PORT=8081 DETOX_IOS_DEVICE='iPhone 17 Pro' corepack pnpm detox:build:ios` | pass | iOS debug simulator build passed after `pod install` restored missing Pods support files in this fresh worktree. Unrelated `Podfile.lock` Hermes checksum churn was removed from the diff. |
| 2026-05-13 | `EXPO_PUBLIC_DEV_LAUNCH_PRESET=import-ready EXPO_DEV_SERVER_PORT=8081 npx expo start --dev-client --port 8081 --host localhost` | pass | Metro/dev-client server started explicitly for simulator QA; Detox does not start Metro in this repo config. |
| 2026-05-13 | `EXPO_PUBLIC_DEV_LAUNCH_PRESET=import-ready EXPO_DEV_SERVER_PORT=8081 EXPO_DEV_SERVER_HOST=127.0.0.1 DETOX_IOS_DEVICE='iPhone 17 Pro' corepack pnpm detox:test:ios -- e2e/import-concierge.e2e.js` | pass | iOS Import Concierge smoke passed after deterministic route open and viewport-tolerant row scrolling: 1 suite, 1 test. |
| 2026-05-13 | `EXPO_DEV_SERVER_PORT=8081 DETOX_ANDROID_AVD='Pixel_9_API_35' corepack pnpm detox:build:android` | blocked | Initial Android build failed before app launch because `androidTestImplementation("com.wix:detox:+")` duplicated classes with the local `project(':detox')` dependency. |
| 2026-05-13 | `EXPO_DEV_SERVER_PORT=8081 DETOX_ANDROID_AVD='Pixel_9_API_35' corepack pnpm detox:build:android` | pass | Android debug APK and test APK built after removing the redundant Maven Detox artifact and duplicate runner version while preserving local `:detox` instrumentation. |
| 2026-05-13 | `EXPO_PUBLIC_DEV_LAUNCH_PRESET=import-ready EXPO_DEV_SERVER_PORT=8081 EXPO_DEV_SERVER_HOST=127.0.0.1 DETOX_ANDROID_AVD='Pixel_9_API_35' corepack pnpm detox:test:android -- e2e/import-concierge.e2e.js` | pass | Android Import Concierge smoke passed after using `adb shell am start` for the import review deep link: 1 suite, 1 test. |
| 2026-05-13 | `corepack pnpm test:ci --runInBand tests/features/import tests/lib/parsing tests/app/importRoutes.test.tsx tests/testing/importCorpus.test.ts tests/db/domainDataLayer.test.ts tests/localization/translations.test.ts tests/sanity/testIds.test.ts` | pass | Post-simulator import/db/localization regression passed: 10 suites, 141 tests. |
| 2026-05-13 | `corepack pnpm typecheck` | pass | Final TypeScript rerun after simulator/e2e/metadata fixes. |
| 2026-05-13 | `corepack pnpm lint` | pass | Final lint rerun after new E2E file and Android Detox sanity update. |
| 2026-05-13 | `corepack pnpm test:coverage:check` | pass | Full suite passed: 143 suites, 1 skipped, 1084 passed / 1085 total. Coverage checker passed; touched files remained above the 95% rule. |
| 2026-05-13 | `git diff --check` | pass | No whitespace errors. |
| 2026-05-13 | Final focused review agent | fixed | Found commit-result date range still included rows that passed pre-check but were skipped by guarded save. Fixed by deriving range from successfully saved log dates only. |
| 2026-05-13 | `corepack pnpm test:ci --runInBand tests/features/import/importWorkflow.test.ts tests/features/import/ImportFlowProvider.test.tsx tests/sanity/detox-config.test.ts` | pass | Guarded-save date-range regression and Android Detox sanity rerun passed: 3 suites, 34 tests. |
| 2026-05-13 | `corepack pnpm typecheck` | pass | Rerun after guarded-save date-range fix. |
| 2026-05-13 | `corepack pnpm lint` | pass | Rerun after guarded-save date-range fix. |
| 2026-05-13 | `corepack pnpm test:coverage:check` | pass | Full suite passed: 143 suites, 1 skipped, 1085 passed / 1086 total. Coverage checker passed; touched files remained above the 95% rule. |
| 2026-05-13 | Final focused review agent re-review | pass | No blocking/important findings after saved-log-date fix. Agent also ran `pnpm jest tests/features/import/importWorkflow.test.ts --runInBand`, 12 tests passed. |

### Simulator Evidence

- iOS: Detox passed on `iPhone 17 Pro` for `e2e/import-concierge.e2e.js` with `import-ready`. Covered seeded import review route, reviewed-row visibility, row exclusion for `2026-04-13`, commit action, completion screen, and result summary.
- Android: Detox passed on `Pixel_9_API_35` for `e2e/import-concierge.e2e.js` with `import-ready`. Covered the same seeded review/edit/commit/completion path using the Android debug APK and test APK.
- UX note: the E2E uses viewport-tolerant row checks because mobile review rows can be partially clipped by fixed footer/safe-area bounds while still being usable.

### Review Findings

| ID | Severity | Source | Finding | Status |
| --- | --- | --- | --- | --- |
| IC-001 | P1 | spec review | Editable preview was only represented as static copy and leaked internal roadmap language. | fixed with row-level reviewed-entry preview, exclude action before commit, edited-count tracking, and user-facing copy |
| IC-002 | P1 | spec/UX review | Skipped-only imports were discarded into a generic error instead of reaching review. | fixed by allowing skipped/warning previews through provider gates and route tests |
| IC-003 | P2 | UX/localization review | Routed review displayed raw English parser warnings and skipped-row messages. | fixed with localized generic adjustment and skipped-row summaries |
| IC-004 | P2 | UX/localization review | Unsupported-shape parser errors surfaced hardcoded English technical messages. | fixed by mapping `UnsupportedImportShapeError` to localized unsupported-shape copy |
| IC-005 | P2 | code/model review | `saveEntryIfDateAbsent` could delete an unrelated log on ID collision. | fixed by checking date and ID before calling the replacing persistence helper; regression test added |
| IC-006 | P2 | code/model review | Legacy `ImportScreen` allowed duplicate commits and could show the wrong result. | fixed with `isCommittingRef`, disabled commit button, and rerun import screen tests |
| IC-007 | P2 | UX/localization final review | Reviewed-row preview rendered raw bleeding enum values in localized copy. | fixed by translating via `logging.options.bleeding.*` and adding Spanish assertion |
| IC-008 | P2 | UX final review | Duplicate-only imports were labeled low confidence even when parsing was clean. | fixed by making duplicate-only/no-skipped previews medium confidence with model regression coverage |
| IC-009 | P2 | final review | Excluding a reviewed row left stale date-range and confidence metadata in preview/commit summaries. | fixed by recomputing preview confidence/date range on exclusion and deriving commit date range from saved entries |
| IC-010 | P2 | Android simulator QA | Android Detox build failed from duplicate Detox dependencies in the instrumentation classpath. | fixed by keeping local `project(':detox')`, removing the redundant Maven Detox dependency and duplicate runner, updating sanity coverage, and rebuilding successfully |
| IC-011 | P2 | final re-review | Commit completion date range still included a row skipped by `saveEntryIfDateAbsent(false)` after the pre-save duplicate check. | fixed by tracking successfully saved log dates and deriving result range only from those dates; regression test added |

### Remaining Blockers

- None for Slice 3 automated and simulator verification.

### Next Recommended Slice

Slice 3 has been committed and merged to `main`. Start Slice 4: Encrypted Backup Productization in a new dedicated worktree.

## Slice 4: Encrypted Backup Productization

### Acceptance Criteria

- [x] Dedicated worktree created under `.worktrees/`.
- [x] Existing encrypted backup package, restore model, billing, biometric, and backup UI surfaces mapped by sub-agents.
- [x] Export UX requires a stronger passphrase and clears passphrase fields after successful handoff.
- [x] Restore preview shows useful product details before replacement: exported date, log date range, log count, import sessions, period days, reminders, and cycle-profile presence.
- [x] Restore replacement is explicit and gated by a destructive acknowledgement.
- [x] Restore supports choosing a different file after preview.
- [x] Restore maps invalid file, unsupported format, and wrong passphrase errors to safe localized copy.
- [x] Restored paid billing states are sanitized and billing refresh revalidates from the restored persisted snapshot.
- [x] Biometric lock state is cleared/re-armed appropriately after restore.
- [x] Automated backup, billing, localization, route, and coverage checks passed.
- [x] iOS simulator QA completed for backup export and restore preview/reset.
- [x] Android simulator QA completed for backup export and restore preview/reset.
- [x] Multi-pass UX/code/security review completed; blocking findings fixed and re-reviewed clean.

### Files Touched

- `floriva-app/docs/qa/2026-05-13-floriva-plus-program-ledger.md`
- `floriva-app/e2e/backup-export.e2e.js`
- `floriva-app/src/features/backup/backupPackage.ts`
- `floriva-app/src/features/backup/model.ts`
- `floriva-app/src/features/backup/screens/BackupScreen.tsx`
- `floriva-app/src/features/billing/BillingProvider.tsx`
- `floriva-app/src/localization/messages/backup.ts`
- `floriva-app/src/testing/qaFixtures.ts`
- `floriva-app/src/testing/testIds.ts`
- `floriva-app/src/types/domain.ts`
- `floriva-app/tests/features/backup/BackupScreen.test.tsx`
- `floriva-app/tests/features/backup/backupPackage.test.ts`
- `floriva-app/tests/features/backup/model.test.ts`
- `floriva-app/tests/features/billing/BillingProvider.test.tsx`

### Verification Log

| Time | Command / Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-05-13 | `corepack pnpm install --frozen-lockfile` | pass | Dependencies installed in the Slice 4 worktree. pnpm reported expected ignored build-script warning for native/dev tooling packages. |
| 2026-05-13 | Backup architecture and UX/privacy exploration agents | pass | Existing backup package encryption, restore sanitization, billing/biometric follow-up, and UX gaps mapped before implementation. |
| 2026-05-13 | `corepack pnpm test:ci --runInBand tests/features/backup tests/app/backupRoutes.test.tsx tests/lib/security/biometricLock.test.ts tests/db/domainDataLayer.test.ts tests/db/validators.test.ts tests/db/schema.test.ts tests/localization/translations.test.ts tests/sanity/testIds.test.ts` | pass | Focused backup/security/localization regression passed: 10 suites, 100 tests. |
| 2026-05-13 | `corepack pnpm typecheck` | pass | No TypeScript errors. |
| 2026-05-13 | `corepack pnpm lint` | pass | No ESLint errors. |
| 2026-05-13 | `git diff --check` | pass | No whitespace errors. |
| 2026-05-13 | `corepack pnpm test:coverage:check` | pass | Full suite passed: 143 suites, 1 skipped, 1090 passed / 1091 total before final billing/E2E review fixes. Coverage checker passed. |
| 2026-05-13 | First review/fix cycle | fixed | Review found thin restore preview, weak destructive copy/action, missing reset path, lingering passphrases, raw error messages, weak passphrases, cramped preview metrics, invalid JSON misclassification, and incorrect reload/commit failure copy. |
| 2026-05-13 | Final review agent | fixed | Found a merge-blocking billing revalidation race where stale provider state could overwrite restored sanitized paid access. Fixed by reading the persisted billing snapshot at refresh time and adding a regression test. |
| 2026-05-13 | `corepack pnpm test:ci --runInBand tests/features/billing/BillingProvider.test.tsx tests/features/backup/BackupScreen.test.tsx tests/features/backup/model.test.ts tests/features/backup/backupPackage.test.ts` | pass | Billing overwrite regression and backup focused tests passed: 4 suites, 85 tests. |
| 2026-05-13 | `EXPO_DEV_SERVER_PORT=8081 DETOX_IOS_DEVICE='iPhone 17 Pro' corepack pnpm detox:build:ios` | pass | Initial build failed due missing Pods support files in the fresh worktree; `pod install` was run, then the iOS debug simulator build succeeded. Generated Hermes checksum churn was removed from the diff. |
| 2026-05-13 | `EXPO_PUBLIC_DEV_LAUNCH_PRESET=backup-ready EXPO_DEV_SERVER_PORT=8081 corepack pnpm exec expo start --dev-client --port 8081 --host localhost` | pass | Metro/dev-client server started explicitly for simulator QA. Detox does not start Metro in this repo config. |
| 2026-05-13 | `EXPO_PUBLIC_DEV_LAUNCH_PRESET=backup-ready EXPO_DEV_SERVER_PORT=8081 EXPO_DEV_SERVER_HOST=127.0.0.1 DETOX_IOS_DEVICE='iPhone 17 Pro' corepack pnpm detox:test:ios -- e2e/backup-export.e2e.js` | pass | iOS backup export and restore-preview smoke passed after fixing E2E scroll behavior and resolving the Detox-selected simulator ID instead of ambiguous `simctl booted`: 1 suite, 2 tests. |
| 2026-05-13 | `EXPO_DEV_SERVER_PORT=8081 DETOX_ANDROID_AVD='Pixel_9_API_35' corepack pnpm detox:build:android` | pass | Android debug APK and test APK built successfully. |
| 2026-05-13 | `EXPO_PUBLIC_DEV_LAUNCH_PRESET=backup-ready EXPO_DEV_SERVER_PORT=8081 EXPO_DEV_SERVER_HOST=10.0.2.2 DETOX_ANDROID_AVD='Pixel_9_API_35' corepack pnpm detox:test:android -- e2e/backup-export.e2e.js` | pass | Android backup export and restore-preview smoke passed: 1 suite, 2 tests. |
| 2026-05-13 | `corepack pnpm typecheck` | pass | Final TypeScript rerun after billing/E2E fixes. |
| 2026-05-13 | `corepack pnpm lint` | pass | Final lint rerun after billing/E2E fixes. |
| 2026-05-13 | `git diff --check` | pass | Final whitespace check passed. |
| 2026-05-13 | `corepack pnpm test:coverage:check` | pass | Full suite passed: 143 suites, 1 skipped, 1091 passed / 1092 total. Coverage checker passed; touched files remained above the 95% rule. |
| 2026-05-13 | Final review agent re-review | pass | Billing overwrite finding resolved. No important new issue found in E2E changes. Agent also ran the focused backup/billing suite: 4 suites, 85 tests. |

### Simulator Evidence

- iOS: Detox passed on `iPhone 17 Pro` for `e2e/backup-export.e2e.js` with `backup-ready`. Covered export passphrase entry, backup package creation, restore preview details, replacement warning visibility, and reset-file path visibility.
- Android: Detox passed on `Pixel_9_API_35` for `e2e/backup-export.e2e.js` with `backup-ready`. Covered the same export package creation and restore preview/reset path.
- UX note: restore preview checks are viewport-tolerant because the productized restore card can be partially visible on mobile while remaining usable. The E2E now resolves the Detox-selected iOS simulator by name so package-file checks do not read from another booted simulator.

### Review Findings

| ID | Severity | Source | Finding | Status |
| --- | --- | --- | --- | --- |
| BP-001 | P1 | code/security review | Billing revalidation after restore could read stale provider state and write restored paid access back over sanitized `needs_purchase` state. | fixed by loading persisted billing snapshot before refresh derivation; regression test added; re-review clean |
| BP-002 | P2 | UX review | Restore preview did not show enough detail for a destructive data replacement. | fixed with exported date, log date range, counts, reminders, and cycle-profile detail rows |
| BP-003 | P2 | UX review | Restore action was destructive but not separately acknowledged. | fixed with explicit acknowledgement button and destructive confirm state |
| BP-004 | P2 | UX review | User could not choose a different backup after preview. | fixed with reset restore selection button |
| BP-005 | P2 | privacy/security review | Export and restore passphrases could linger in component state after success. | fixed by clearing passphrase fields after successful export/share and preview |
| BP-006 | P2 | privacy/security review | Restore errors could surface raw technical details or misclassify malformed backups. | fixed with typed `BackupPackageError` codes and localized safe messages |
| BP-007 | P2 | UX review | Short passphrases were accepted for encrypted backup export. | fixed with a 12-character minimum and localized safety note |
| BP-008 | P2 | UX/code review | Restore commit and post-commit rehydrate failures used misleading copy. | fixed with distinct commit vs reload failure handling |
| BP-009 | P2 | simulator QA | iOS backup E2E checked files on ambiguous `simctl booted` when multiple simulators were booted. | fixed by resolving the Detox-selected iOS simulator ID |
| BP-010 | P2 | simulator QA | Restore preview E2E could fail on mobile because the card was partially below the fold. | fixed with scroll-aware, viewport-tolerant checks |

### Remaining Blockers

- None for Slice 4.

### Next Recommended Slice

Start Slice 5: Prediction Confidence and Preparedness in a new dedicated worktree after committing/merging Slice 4.

## Slice 5: Prediction Confidence and Preparedness

### Acceptance Criteria

- [x] Dedicated worktree created under `.worktrees/`.
- [x] Prediction confidence context appears on Today and Calendar without medical-authority claims.
- [x] Confidence copy explains local history basis and uncertainty reasons.
- [x] Reminder center uses real local profile, logs, and reminder preferences instead of fake defaults.
- [x] Reminder center shows active local reminder plans and stable row IDs for E2E.
- [x] User-reminder reconciliation no longer cancels billing trial reminders; delete-all still cancels all local notifications.
- [x] Android/iOS Today summary fixed so compact labels and CTA text do not clip.
- [x] Focused and full automated verification passed with touched files above the 95% coverage rule.
- [x] iOS simulator E2E with manual screenshots completed.
- [x] Android simulator E2E with manual screenshots completed.
- [x] Final review completed; important finding fixed and re-verified.

### Files Touched

- `floriva-app/docs/qa/2026-05-13-floriva-plus-program-ledger.md`
- `floriva-app/e2e/prediction-preparedness.e2e.js`
- `floriva-app/src/features/app-shell/AppShellProvider.tsx`
- `floriva-app/src/features/app-shell/defaults.ts`
- `floriva-app/src/features/calendar/buildCalendarScreenModel.ts`
- `floriva-app/src/features/calendar/screens/CalendarScreen.tsx`
- `floriva-app/src/features/logging/screens/TodaySummaryCard.tsx`
- `floriva-app/src/features/settings/buildReminderCenterModel.ts`
- `floriva-app/src/features/settings/screens/SettingsScreen.tsx`
- `floriva-app/src/features/tracker/buildTodaySnapshot.ts`
- `floriva-app/src/features/tracker/screens/TodayScreen.tsx`
- `floriva-app/src/lib/notifications/reminderScheduler.ts`
- `floriva-app/src/lib/predictions/presentation.ts`
- `floriva-app/src/testing/testIds.ts`
- `floriva-app/src/types/domain.ts`
- `floriva-app/tests/app/phase1-integration.test.tsx`
- `floriva-app/tests/features/app-shell/AppShellProvider.test.tsx`
- `floriva-app/tests/features/calendar/CalendarScreen.test.tsx`
- `floriva-app/tests/features/calendar/buildCalendarScreenModel.test.ts`
- `floriva-app/tests/features/logging/TodaySummaryCard.test.tsx`
- `floriva-app/tests/features/settings/SettingsScreen.test.tsx`
- `floriva-app/tests/features/settings/buildReminderCenterModel.test.ts`
- `floriva-app/tests/features/tracker/TodayScreen.test.tsx`
- `floriva-app/tests/features/tracker/buildTodaySnapshot.test.ts`
- `floriva-app/tests/lib/notifications/reminderScheduler.test.ts`
- `floriva-app/tests/lib/predictions/presentation.test.ts`
- `floriva-app/tests/sanity/testIds.test.ts`
- `floriva-app/docs/qa/screenshots/2026-05-13-slice-5-prediction-preparedness/`

### Verification Log

| Time | Command / Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-05-13 | `corepack pnpm install --frozen-lockfile` | pass | Dependencies installed in the Slice 5 worktree. |
| 2026-05-13 | Prediction/reminder exploration agents | pass | Prediction plumbing, reminder-center hydration, and reminder cancellation risks mapped before implementation. |
| 2026-05-13 | `EXPO_DEV_SERVER_PORT=8081 DETOX_IOS_DEVICE='iPhone 17 Pro' corepack pnpm detox:build:ios` | pass | Initial build required `pod install` in the fresh worktree; generated Hermes checksum churn was kept out of the committed diff. |
| 2026-05-13 | `EXPO_DEV_SERVER_PORT=8081 DETOX_ANDROID_AVD='Pixel_9_API_35' corepack pnpm detox:build:android` | pass | Android debug APK and test APK built successfully. |
| 2026-05-14 | `corepack pnpm test:ci --runInBand tests/lib/predictions/presentation.test.ts tests/features/tracker/buildTodaySnapshot.test.ts tests/features/tracker/TodayScreen.test.tsx` | pass | Focused prediction confidence tests passed: 3 suites, 35 tests. |
| 2026-05-14 | `corepack pnpm test:ci --runInBand tests/app/phase1-integration.test.tsx` | pass | Persisted reminder settings integration repaired after reminder-center duplicate visible copy: 3 passed, 1 skipped. |
| 2026-05-14 | `corepack pnpm test:ci --runInBand tests/features/settings/SettingsScreen.test.tsx tests/sanity/testIds.test.ts` | pass | Reminder-center row ID fix covered: 2 suites, 52 tests. Non-blocking `act(...)` warning remains from async hydration. |
| 2026-05-14 | `corepack pnpm test:ci --runInBand tests/features/logging/TodaySummaryCard.test.tsx tests/features/tracker/TodayScreen.test.tsx` | pass | Android compact-label UI fix covered: 2 suites, 19 tests. |
| 2026-05-14 | `corepack pnpm lint` | pass | Final lint rerun after UI and E2E fixes. |
| 2026-05-14 | `corepack pnpm typecheck` | pass | Final TypeScript rerun after UI and E2E fixes. |
| 2026-05-14 | `git diff --check` | pass | Whitespace check passed. |
| 2026-05-14 | `corepack pnpm test:coverage:check` | pass | Full suite passed: 144 suites, 1 skipped, 1096 passed / 1097 total. Coverage checker passed; touched files remained above the 95% rule. |
| 2026-05-14 | `EXPO_PUBLIC_DEV_LAUNCH_PRESET=qa-rich-history EXPO_DEV_SERVER_PORT=8081 EXPO_DEV_SERVER_HOST=127.0.0.1 DETOX_IOS_DEVICE='iPhone 17 Pro' corepack pnpm detox test -c ios.sim.debug --cleanup --artifacts-location docs/qa/screenshots/2026-05-13-slice-5-prediction-preparedness/detox-ios --take-screenshots manual -- e2e/prediction-preparedness.e2e.js` | pass | iOS smoke passed and captured Today, Calendar, and reminder-center screenshots. |
| 2026-05-14 | `EXPO_PUBLIC_DEV_LAUNCH_PRESET=qa-rich-history EXPO_DEV_SERVER_PORT=8081 EXPO_DEV_SERVER_HOST=10.0.2.2 DETOX_ANDROID_AVD='Pixel_9_API_35' corepack pnpm detox test -c android.emu.debug --cleanup --artifacts-location docs/qa/screenshots/2026-05-13-slice-5-prediction-preparedness/detox-android --take-screenshots manual -- e2e/prediction-preparedness.e2e.js` | pass | Android smoke passed and captured Today, Calendar, and reminder-center screenshots. Android Today label clipping was found and fixed before final coverage. |
| 2026-05-14 | Final review agent | fixed | Reviewer found an aging hard-coded May 27 reminder-date assertion in the E2E. Fixed with stable reminder-center row test IDs and re-ran focused tests plus iOS/Android E2E. |

### Simulator Evidence

- iOS: Detox passed on `iPhone 17 Pro` for `e2e/prediction-preparedness.e2e.js` with `qa-rich-history`. Evidence directory: `floriva-app/docs/qa/screenshots/2026-05-13-slice-5-prediction-preparedness/detox-ios/ios.sim.debug.2026-05-14 00-34-16Z/`.
- Android: Detox passed on `Pixel_9_API_35` for `e2e/prediction-preparedness.e2e.js` with `qa-rich-history`. Evidence directory: `floriva-app/docs/qa/screenshots/2026-05-13-slice-5-prediction-preparedness/detox-android/android.emu.debug.2026-05-14 00-35-05Z/`.
- Visual QA notes: Today and Calendar confidence context is readable on both platforms; Android Today compact labels and `Log today` CTA were fixed after screenshot review; reminder center shows real local active reminders and row layout without overlap.

### Review Findings

| ID | Severity | Source | Finding | Status |
| --- | --- | --- | --- | --- |
| PC-001 | P1 | final review | E2E hard-coded `May 27 · 9:00 AM`, which would age out and could differ by platform ICU formatting. | fixed with stable reminder-center row test IDs; focused tests and iOS/Android E2E rerun passed |
| PC-002 | P2 | simulator QA | Android Today summary labels and `Log today` CTA clipped under emulator text metrics. | fixed with fitting/shrinking text behavior in fixed-format summary UI; focused tests, screenshots, and full coverage rerun passed |
| PC-003 | P2 | first review | Reminder center initially used fake default data instead of real local profile/log history. | fixed with repository-backed hydration and fallback preview |
| PC-004 | P2 | first review | Normal reminder reconciliation could cancel the billing trial reminder. | fixed by splitting user-reminder reconciliation from delete-all notification cancellation |
| PC-005 | P2 | re-review | Reminder-center cycle-event date formatting used UTC slicing and could show the wrong local day. | fixed with local date formatting and regression test |

### Remaining Blockers

- None for Slice 5.

### Next Recommended Slice

Start Slice 6: Birth-Control Hub in a new dedicated worktree after committing/merging Slice 5.

## Slice 6: Birth-Control Hub

### Acceptance Criteria

- [x] Dedicated worktree created under `.worktrees/`.
- [x] User profile supports a persistent birth-control default method.
- [x] Settings hub includes a Birth control destination with localized summary copy.
- [x] Dedicated Birth control settings screen supports method setup, local daily reminder toggle, and time adjustment.
- [x] Clearing the selected method disables the birth-control reminder in one repository transaction when needed.
- [x] Method buttons wait for reminder hydration before changes are actionable, preventing profile-only clears against stale default reminder state.
- [x] Today summary shows birth-control context without medical-authority claims.
- [x] Daily logging exposes birth-control missed/late controls when a default method exists.
- [x] New copy is localized across supported locales.
- [x] Focused and full automated verification passed with touched files above the 95% coverage rule.
- [x] iOS simulator E2E with manual screenshots completed.
- [x] Android simulator E2E with manual screenshots completed.
- [x] Dedicated review agents completed; blocking/important findings were fixed and re-reviewed clean.

### Files Touched

- `floriva-app/app/(app)/settings/birth-control.tsx`
- `floriva-app/docs/qa/2026-05-13-floriva-plus-program-ledger.md`
- `floriva-app/drizzle/0015_birth_control_setup.sql`
- `floriva-app/drizzle/meta/_journal.json`
- `floriva-app/drizzle/migrations.js`
- `floriva-app/e2e/birth-control-hub.e2e.js`
- `floriva-app/src/components/primitives/ActionButton.tsx`
- `floriva-app/src/db/contracts.ts`
- `floriva-app/src/db/domainDefaults.ts`
- `floriva-app/src/db/repositories.ts`
- `floriva-app/src/db/schema.ts`
- `floriva-app/src/db/validators.ts`
- `floriva-app/src/features/logging/screens/TodayLoggingScreen.tsx`
- `floriva-app/src/features/logging/screens/TodaySummaryCard.tsx`
- `floriva-app/src/features/settings/screens/SettingsScreen.tsx`
- `floriva-app/src/localization/messages/birthControl.ts`
- `floriva-app/src/localization/translations.ts`
- `floriva-app/src/testing/qaFixtures.ts`
- `floriva-app/src/testing/testIds.ts`
- `floriva-app/src/types/domain.ts`
- `floriva-app/tests/app/settings-birth-control-route.test.tsx`
- `floriva-app/tests/components/ActionButton.test.tsx`
- `floriva-app/tests/db/domainDataLayer.test.ts`
- `floriva-app/tests/db/migrationsManifest.test.ts`
- `floriva-app/tests/db/schema.test.ts`
- `floriva-app/tests/features/logging/TodaySummaryCard.test.tsx`
- `floriva-app/tests/features/settings/SettingsScreen.test.tsx`
- `floriva-app/tests/localization/translations.test.ts`
- `floriva-app/tests/sanity/testIds.test.ts`
- `floriva-app/docs/qa/screenshots/2026-05-13-slice-6-birth-control-hub/`

### Verification Log

| Time | Command / Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-05-14 | `corepack pnpm test:ci --runInBand tests/db/schema.test.ts tests/db/migrationsManifest.test.ts tests/db/domainDataLayer.test.ts tests/db/validators.test.ts tests/testing/devLaunchPreset.test.ts` | pass | DB migration, profile/default-method persistence, validators, and QA fixture coverage passed: 44 tests. |
| 2026-05-14 | `corepack pnpm test:ci --runInBand tests/components/ActionButton.test.tsx tests/features/settings/SettingsScreen.test.tsx tests/features/logging/TodaySummaryCard.test.tsx tests/localization/translations.test.ts tests/app/settings-birth-control-route.test.tsx` | pass | Focused UI, localization, button primitive, and route coverage passed: 77 tests. |
| 2026-05-14 | `corepack pnpm test:ci --runInBand tests/features/logging/TodaySummaryCard.test.tsx tests/features/tracker/TodayScreen.test.tsx tests/sanity/testIds.test.ts` | pass | Today summary/logging and stable ID rerun passed: 23 tests. |
| 2026-05-14 | `EXPO_DEV_SERVER_PORT=8081 DETOX_IOS_DEVICE='iPhone 17 Pro' corepack pnpm detox:build:ios` | pass | iOS debug build passed after `pod install` in the fresh worktree; generated Hermes checksum churn was kept out of the committed diff. |
| 2026-05-14 | `EXPO_DEV_SERVER_PORT=8081 DETOX_ANDROID_AVD='Pixel_9_API_35' corepack pnpm detox:build:android` | pass | Android debug APK and test APK built successfully. |
| 2026-05-14 | `EXPO_PUBLIC_DEV_LAUNCH_PRESET=qa-rich-history EXPO_DEV_SERVER_PORT=8081 EXPO_DEV_SERVER_HOST=127.0.0.1 DETOX_IOS_DEVICE='iPhone 17 Pro' corepack pnpm detox test -c ios.sim.debug --cleanup --artifacts-location docs/qa/screenshots/2026-05-13-slice-6-birth-control-hub/detox-ios --take-screenshots manual -- e2e/birth-control-hub.e2e.js` | pass | iOS smoke passed and captured Today summary, daily logging controls, and Birth control settings screenshots. |
| 2026-05-14 | `EXPO_PUBLIC_DEV_LAUNCH_PRESET=qa-rich-history EXPO_DEV_SERVER_PORT=8081 EXPO_DEV_SERVER_HOST=10.0.2.2 DETOX_ANDROID_AVD='Pixel_9_API_35' corepack pnpm detox test -c android.emu.debug --cleanup --artifacts-location docs/qa/screenshots/2026-05-13-slice-6-birth-control-hub/detox-android --take-screenshots manual -- e2e/birth-control-hub.e2e.js` | pass | Android smoke passed and captured Today summary, daily logging controls, and Birth control settings screenshots after final bottom-clearance fix. |
| 2026-05-14 | `corepack pnpm test:ci --runInBand tests/features/settings/SettingsScreen.test.tsx tests/db/domainDataLayer.test.ts` | pass | Post-review transaction and hydration-race regression tests passed: 81 tests. |
| 2026-05-14 | `corepack pnpm typecheck` | pass | Final TypeScript rerun after repository contract and race-fix changes. |
| 2026-05-14 | `corepack pnpm lint` | pass | Final ESLint rerun after repository contract and race-fix changes. |
| 2026-05-14 | `git diff --check` | pass | Whitespace check passed. |
| 2026-05-14 | `corepack pnpm test:coverage:check` | pass | Full suite passed: 145 suites, 1 skipped, 1110 passed / 1111 total. Coverage checker passed; touched files remained above the 95% rule. |
| 2026-05-14 | Review agents | fixed, then clean | Reviewers found clear-method reminder divergence, insufficient E2E logging visibility, hardcoded copy, global one-line button behavior, non-atomic rollback risk, Android settings screenshot bottom overlap, and a reminder-hydration race. All important findings were fixed; final race-fix re-review was clean. |

### Simulator Evidence

- iOS: Detox passed on `iPhone 17 Pro` for `e2e/birth-control-hub.e2e.js` with `qa-rich-history`. Evidence directory: `floriva-app/docs/qa/screenshots/2026-05-13-slice-6-birth-control-hub/detox-ios/ios.sim.debug.2026-05-14 02-17-33Z/`.
- Android: Detox passed on `Pixel_9_API_35` for `e2e/birth-control-hub.e2e.js` with `qa-rich-history`. Evidence directory: `floriva-app/docs/qa/screenshots/2026-05-13-slice-6-birth-control-hub/detox-android/android.emu.debug.2026-05-14 02-24-54Z/`.
- Visual QA notes: Today summary shows concise birth-control context; daily logging shows birth-control controls clearly after moving the section above TTC fields; Android settings screenshot now keeps `Later by 30 min` above the gesture bar.

### Review Findings

| ID | Severity | Source | Finding | Status |
| --- | --- | --- | --- | --- |
| BC-001 | P1 | review | Clearing a selected method left an enabled birth-control reminder persisted. | fixed by disabling birth-control reminders when clearing the method |
| BC-002 | P2 | review | E2E smoke did not prove daily logging birth-control controls were visible. | fixed with explicit logging controls assertion and screenshot |
| BC-003 | P2 | review | New birth-control settings and summary copy was hardcoded English. | fixed with `birthControl` localization namespace and translation regression tests |
| BC-004 | P2 | review | `ActionButton` forced one-line labels globally, risking unrelated UI clipping. | fixed by making label fitting opt-in and covering both behaviors |
| BC-005 | P1 | re-review | Profile clear and reminder disable were coordinated through separate repository transactions with best-effort rollback. | fixed with `saveProfileAndReminderPreferences()` validating both payloads and persisting them in one transaction |
| BC-006 | P2 | simulator/review | Android settings screenshot overlapped the `Later by 30 min` control with the gesture bar. | fixed by scrolling before screenshot and waiting for the later button to be visible |
| BC-007 | P1 | final re-review | Method buttons could clear profile while reminder preferences were still hydrating from default disabled state. | fixed by disabling method buttons until reminder hydration is `ready`, with regression coverage |

### Remaining Blockers

- None for Slice 6.

### Next Recommended Slice

Start Slice 7: TTC Mode in a new dedicated worktree after committing/merging Slice 6.

## Slice 7: TTC Mode

### Acceptance Criteria

- [x] Dedicated worktree created under `.worktrees/`.
- [x] TTC logging controls appear in daily logging only when TTC mode is enabled.
- [x] Today summary shows TTC context without medical-authority or conception-outcome claims.
- [x] TTC setup previews the exact daily fields that will become available.
- [x] Insights hub links to TTC detail only when TTC mode is enabled.
- [x] Direct TTC detail route access does not surface TTC copy for users without enabled TTC mode.
- [x] Recent TTC logs appear in Insights detail with local, non-medical wording.
- [x] New copy is localized across supported locales.
- [x] Focused and full automated verification passed with touched files above the 95% coverage rule.
- [x] iOS simulator E2E with manual screenshots completed.
- [x] Android simulator E2E with manual screenshots completed.
- [x] Dedicated review completed; important findings were fixed and re-reviewed clean.

### Files Touched

- `floriva-app/docs/qa/2026-05-13-floriva-plus-program-ledger.md`
- `floriva-app/docs/superpowers/plans/2026-05-14-ttc-mode.md`
- `floriva-app/e2e/ttc-mode.e2e.js`
- `floriva-app/src/features/insights/buildInsightsScreenModel.ts`
- `floriva-app/src/features/insights/screens/InsightsScreen.tsx`
- `floriva-app/src/features/insights/screens/InsightsTtcScreen.tsx`
- `floriva-app/src/features/insights/types.ts`
- `floriva-app/src/features/logging/screens/TodayLoggingScreen.tsx`
- `floriva-app/src/features/logging/screens/TodaySummaryCard.tsx`
- `floriva-app/src/features/onboarding/screens/TtcSetupScreen.tsx`
- `floriva-app/src/features/tracker/screens/TodayScreen.tsx`
- `floriva-app/src/features/ttc/summary.ts`
- `floriva-app/src/localization/messages/ttc.ts`
- `floriva-app/src/localization/translations.ts`
- `floriva-app/src/testing/testIds.ts`
- `floriva-app/tests/features/insights/InsightsDetailScreens.test.tsx`
- `floriva-app/tests/features/insights/InsightsScreen.test.tsx`
- `floriva-app/tests/features/insights/InsightsScreenBranches.test.tsx`
- `floriva-app/tests/features/insights/buildInsightsScreenModel.test.ts`
- `floriva-app/tests/features/logging/TodayLoggingScreen.test.tsx`
- `floriva-app/tests/features/logging/TodaySummaryCard.test.tsx`
- `floriva-app/tests/features/onboarding/TtcSetupScreen.test.tsx`
- `floriva-app/tests/features/ttc/summary.test.ts`
- `floriva-app/tests/localization/translations.test.ts`
- `floriva-app/docs/qa/screenshots/2026-05-13-slice-7-ttc-mode/`

### Verification Log

| Time | Command / Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-05-14 | `corepack pnpm install --frozen-lockfile` | pass | Dependencies installed in the Slice 7 worktree. |
| 2026-05-14 | `EXPO_DEV_SERVER_PORT=8081 DETOX_IOS_DEVICE='iPhone 17 Pro' corepack pnpm detox:build:ios` | pass | iOS debug build passed after `pod install` in the fresh worktree; generated Hermes checksum churn was kept out of the committed diff. |
| 2026-05-14 | `EXPO_DEV_SERVER_PORT=8081 DETOX_ANDROID_AVD='Pixel_9_API_35' corepack pnpm detox:build:android` | pass | Android debug APK and test APK built successfully. |
| 2026-05-14 | `corepack pnpm test:ci --runInBand tests/features/insights/InsightsScreenBranches.test.tsx tests/features/insights/InsightsDetailScreens.test.tsx` | pass | Final direct-route focused regression pass: 2 suites, 17 tests. |
| 2026-05-14 | `corepack pnpm typecheck` | pass | Final TypeScript rerun after TTC detail route gating fixes. |
| 2026-05-14 | `corepack pnpm lint` | pass | Final ESLint rerun after TTC detail route gating fixes. |
| 2026-05-14 | `git diff --check` | pass | Whitespace check passed. |
| 2026-05-14 | `corepack pnpm test:coverage:check` | pass | Full suite passed: 146 suites, 1 skipped, 1127 passed / 1128 total. Coverage checker passed; touched files remained above the 95% rule. |
| 2026-05-14 | `EXPO_PUBLIC_DEV_LAUNCH_PRESET=qa-rich-history EXPO_DEV_SERVER_PORT=8081 EXPO_DEV_SERVER_HOST=127.0.0.1 DETOX_IOS_DEVICE='iPhone 17 Pro' corepack pnpm detox test -c ios.sim.debug --cleanup --artifacts-location docs/qa/screenshots/2026-05-13-slice-7-ttc-mode/detox-ios --take-screenshots manual -- e2e/ttc-mode.e2e.js` | pass | Final iOS smoke passed and captured Today summary, daily logging controls, Insights detail, and TTC settings setup screenshots. |
| 2026-05-14 | `EXPO_PUBLIC_DEV_LAUNCH_PRESET=qa-rich-history EXPO_DEV_SERVER_PORT=8081 EXPO_DEV_SERVER_HOST=10.0.2.2 DETOX_ANDROID_AVD='Pixel_9_API_35' corepack pnpm detox test -c android.emu.debug --cleanup --artifacts-location docs/qa/screenshots/2026-05-13-slice-7-ttc-mode/detox-android --take-screenshots manual -- e2e/ttc-mode.e2e.js` | pass | Final Android smoke passed and captured the same TTC surfaces. |
| 2026-05-14 | Dedicated review agent | fixed, then clean | Reviewer found stale TTC UI exposure through Today, logging, Insights row, and direct TTC detail route loading/error states. All important findings were fixed; final narrow re-review was clean. |

### Simulator Evidence

- iOS: Detox passed on `iPhone 17 Pro` for `e2e/ttc-mode.e2e.js` with `qa-rich-history`. Evidence directory: `floriva-app/docs/qa/screenshots/2026-05-13-slice-7-ttc-mode/detox-ios/ios.sim.debug.2026-05-14 03-41-40Z/`.
- Android: Detox passed on `Pixel_9_API_35` for `e2e/ttc-mode.e2e.js` with `qa-rich-history`. Evidence directory: `floriva-app/docs/qa/screenshots/2026-05-13-slice-7-ttc-mode/detox-android/android.emu.debug.2026-05-14 03-42-30Z/`.
- Visual QA notes: Today summary, daily TTC controls, Insights TTC detail, and TTC setup preview are readable on both platforms. Android Today fertility help text no longer clips the help icon after the inline help row layout fix.

### Review Findings

| ID | Severity | Source | Finding | Status |
| --- | --- | --- | --- | --- |
| TTC-001 | P1 | review | Stale TTC observations/preferences could surface TTC Today summaries, daily logging controls, and Insights data even after the TTC goal was removed. | fixed with `hasEnabledTtcMode()` gating and regression coverage |
| TTC-002 | P1 | review | Insights hub always rendered the TTC explore row even when TTC mode was not enabled. | fixed by rendering the row only when the model has an enabled TTC summary |
| TTC-003 | P1 | re-review | Direct `/insights/ttc` access could still show TTC setup/hidden-estimate copy when TTC mode was not enabled. | fixed by redirecting/null-rendering after unconfirmed hydration |
| TTC-004 | P1 | re-review | Direct `/insights/ttc` loading and hydration-error shells could briefly show TTC title copy before TTC mode was confirmed. | fixed by using generic Insights copy until `model.ttcSummary` confirms TTC mode |
| TTC-005 | P2 | simulator QA | Android Today inline fertility help could clip the help icon in the emulator screenshot. | fixed with `flex-start` alignment and flexible headline text |

### Remaining Blockers

- None for Slice 7.

### Next Recommended Slice

Start Slice 8: Condition Modes in a new dedicated worktree after committing/merging Slice 7.

## Slice 8: Condition Modes

### Acceptance Criteria

- [x] Dedicated worktree created under `.worktrees/`.
- [x] Condition-aware logging context is visible for active PCOS, PMDD, and endometriosis templates.
- [x] Insights hub exposes active condition rows instead of routing the generic condition row to TTC setup.
- [x] Condition detail screen summarizes local logs with descriptive, non-diagnostic wording.
- [x] Condition detail screen shows a logging-focus card with tracked signal chips.
- [x] Users without active condition tags get a setup-oriented condition row.
- [x] Insights screen reserves enough bottom clearance for expanded condition rows above the floating tab bar.
- [x] New copy is localized across supported locales where added.
- [x] Focused and full automated verification passed with touched files above the 95% coverage rule.
- [x] iOS simulator E2E with manual screenshots completed.
- [x] Android simulator E2E with manual screenshots completed.
- [x] Dedicated review completed; important findings were fixed and re-reviewed clean.

### Files Touched

- `floriva-app/docs/qa/2026-05-13-floriva-plus-program-ledger.md`
- `floriva-app/docs/superpowers/plans/2026-05-14-condition-modes.md`
- `floriva-app/e2e/condition-modes.e2e.js`
- `floriva-app/src/features/insights/buildInsightsScreenModel.ts`
- `floriva-app/src/features/insights/screens/InsightsConditionScreen.tsx`
- `floriva-app/src/features/insights/screens/InsightsScreen.tsx`
- `floriva-app/src/features/insights/types.ts`
- `floriva-app/src/features/logging/screens/TodayLoggingScreen.tsx`
- `floriva-app/src/localization/messages/insights.ts`
- `floriva-app/src/localization/messages/logging.ts`
- `floriva-app/src/testing/testIds.ts`
- `floriva-app/tests/features/insights/buildInsightsScreenModel.test.ts`
- `floriva-app/tests/features/insights/InsightsScreen.test.tsx`
- `floriva-app/tests/features/insights/InsightsScreenBranches.test.tsx`
- `floriva-app/tests/features/logging/TodayLoggingScreen.test.tsx`
- `floriva-app/tests/sanity/testIds.test.ts`
- `floriva-app/docs/qa/screenshots/2026-05-13-slice-8-condition-modes/`

### Verification Log

| Time | Command / Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-05-14 | `corepack pnpm install --frozen-lockfile` | pass | Dependencies installed in the Slice 8 worktree. |
| 2026-05-14 | `EXPO_DEV_SERVER_PORT=8081 DETOX_IOS_DEVICE='iPhone 17 Pro' corepack pnpm detox:build:ios` | pass | iOS debug build passed after `pod install` and syncing generated `Pods/Manifest.lock`; generated Hermes checksum churn was kept out of the committed diff. |
| 2026-05-14 | `EXPO_DEV_SERVER_PORT=8081 DETOX_ANDROID_AVD='Pixel_9_API_35' corepack pnpm detox:build:android` | pass | Android debug APK and test APK built successfully. |
| 2026-05-14 | `corepack pnpm test:ci --runInBand tests/features/insights/buildInsightsScreenModel.test.ts tests/features/insights/InsightsScreen.test.tsx tests/features/insights/InsightsScreenBranches.test.tsx tests/features/insights/InsightsDetailScreens.test.tsx tests/features/logging/conditionTemplates.test.ts tests/features/logging/TodayLoggingScreen.test.tsx tests/localization/translations.test.ts tests/sanity/testIds.test.ts` | pass | Final focused regression pass: 8 suites, 84 tests. |
| 2026-05-14 | `corepack pnpm typecheck` | pass | Final TypeScript rerun after review and E2E fixes. |
| 2026-05-14 | `corepack pnpm lint` | pass | Final ESLint rerun after review and E2E fixes. |
| 2026-05-14 | `git diff --check` | pass | Whitespace check passed. |
| 2026-05-14 | `corepack pnpm test:coverage:check` | pass | Full suite passed: 146 suites, 1 skipped, 1128 passed / 1129 total. Coverage checker passed; touched files remained above the 95% rule. |
| 2026-05-14 | `EXPO_PUBLIC_DEV_LAUNCH_PRESET=qa-rich-history EXPO_DEV_SERVER_PORT=8081 EXPO_DEV_SERVER_HOST=127.0.0.1 DETOX_IOS_DEVICE='iPhone 17 Pro' corepack pnpm detox test -c ios.sim.debug --cleanup --artifacts-location docs/qa/screenshots/2026-05-13-slice-8-condition-modes/detox-ios --take-screenshots manual -- e2e/condition-modes.e2e.js` | pass | Final iOS smoke passed and captured condition logging context, Insights condition rows, and PCOS detail screenshots. |
| 2026-05-14 | `EXPO_PUBLIC_DEV_LAUNCH_PRESET=qa-rich-history EXPO_DEV_SERVER_PORT=8081 EXPO_DEV_SERVER_HOST=10.0.2.2 DETOX_ANDROID_AVD='Pixel_9_API_35' corepack pnpm detox test -c android.emu.debug --cleanup --artifacts-location docs/qa/screenshots/2026-05-13-slice-8-condition-modes/detox-android --take-screenshots manual -- e2e/condition-modes.e2e.js` | pass | Final Android smoke passed and captured the same condition surfaces. |
| 2026-05-14 | Dedicated review agent | fixed, then clean | Reviewer found unreliable iOS route-group deep links in the E2E helper. Fixed by normalizing route groups for both platforms and using `floriva:///` app paths; iOS/Android E2E reruns passed. |

### Simulator Evidence

- iOS: Detox passed on `iPhone 17 Pro` for `e2e/condition-modes.e2e.js` with `qa-rich-history`. Evidence directory: `floriva-app/docs/qa/screenshots/2026-05-13-slice-8-condition-modes/detox-ios/ios.sim.debug.2026-05-14 04-18-49Z/`.
- Android: Detox passed on `Pixel_9_API_35` for `e2e/condition-modes.e2e.js` with `qa-rich-history`. Evidence directory: `floriva-app/docs/qa/screenshots/2026-05-13-slice-8-condition-modes/detox-android/android.emu.debug.2026-05-14 04-19-37Z/`.
- Visual QA notes: condition chips are visible in daily logging; Insights condition rows are readable above the floating tab bar; PCOS detail shows local-log counts, descriptive summaries, and logging-focus chips without diagnosis, treatment, or medical-authority claims.

### Review Findings

| ID | Severity | Source | Finding | Status |
| --- | --- | --- | --- | --- |
| CM-001 | P1 | simulator QA | Expanded condition rows initially sat under the floating tab bar and were not reliably visible on iOS. | fixed with Insights tab-bar space reservation and gesture-based E2E coverage; iOS rerun passed |
| CM-002 | P1 | review | iOS E2E used raw Expo route-group paths, making simulator evidence unreliable. | fixed with normalized public app paths and `floriva:///` URLs; iOS and Android reruns passed |
| CM-003 | P2 | review | The new E2E file was still untracked during review. | resolved by staging the file for the Slice 8 commit |

### Remaining Blockers

- None for Slice 8.

### Next Recommended Slice

Start Slice 9: Personal Pattern Briefings in a new dedicated worktree after committing/merging Slice 8.

## Slice 9: Personal Pattern Briefings

### Acceptance Criteria

- [x] Dedicated worktree created under `.worktrees/`.
- [x] Insights model builds a local monthly briefing from device-only daily logs.
- [x] Briefing uses the current month when current-month logs exist, otherwise falls back to the latest logged month before today.
- [x] Briefing copy names the selected month so fallback data never claims to be "this month."
- [x] Aggregation excludes notes and freeform text; it only counts local log, bleeding, and symptom fields already used in app summaries.
- [x] Insights hub shows a monthly briefing card and Explore row.
- [x] Monthly briefing detail route renders local summary metrics and top signals.
- [x] New copy is localized across supported locales where added.
- [x] Focused and full automated verification passed with touched files above the 95% coverage rule.
- [x] iOS simulator E2E with manual screenshots completed.
- [x] Android simulator E2E with manual screenshots completed.
- [x] Dedicated review completed; important findings were fixed and re-reviewed.

### Files Touched

- `floriva-app/app/(app)/insights/monthly-briefing.tsx`
- `floriva-app/docs/qa/2026-05-13-floriva-plus-program-ledger.md`
- `floriva-app/docs/superpowers/plans/2026-05-14-pattern-briefings.md`
- `floriva-app/e2e/pattern-briefings.e2e.js`
- `floriva-app/src/features/insights/buildInsightsScreenModel.ts`
- `floriva-app/src/features/insights/screens/InsightsMonthlyBriefingScreen.tsx`
- `floriva-app/src/features/insights/screens/InsightsScreen.tsx`
- `floriva-app/src/features/insights/types.ts`
- `floriva-app/src/localization/messages/insights.ts`
- `floriva-app/src/testing/testIds.ts`
- `floriva-app/tests/features/insights/buildInsightsScreenModel.test.ts`
- `floriva-app/tests/features/insights/InsightsDetailScreens.test.tsx`
- `floriva-app/tests/features/insights/InsightsScreen.test.tsx`
- `floriva-app/tests/features/insights/InsightsScreenBranches.test.tsx`
- `floriva-app/tests/localization/translations.test.ts`
- `floriva-app/tests/sanity/testIds.test.ts`
- `floriva-app/docs/qa/screenshots/2026-05-13-slice-9-pattern-briefings/`

### Verification Log

| Time | Command / Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-05-14 | `corepack pnpm install --frozen-lockfile` | pass | Dependencies installed in the Slice 9 worktree. |
| 2026-05-14 | Red TDD model test | fail as expected | Initial monthly briefing model assertion failed with `model.monthlyBriefing` undefined before implementation. |
| 2026-05-14 | `EXPO_DEV_SERVER_PORT=8081 DETOX_IOS_DEVICE='iPhone 17 Pro' corepack pnpm detox:build:ios` | pass | iOS debug build passed after `pod install`; generated Hermes checksum churn was kept out of the committed diff. |
| 2026-05-14 | `EXPO_DEV_SERVER_PORT=8081 DETOX_ANDROID_AVD='Pixel_9_API_35' corepack pnpm detox:build:android` | pass | Android debug APK and test APK built successfully. |
| 2026-05-14 | `corepack pnpm test:ci --runInBand tests/features/insights/InsightsScreenBranches.test.tsx tests/features/insights/buildInsightsScreenModel.test.ts tests/features/insights/InsightsScreen.test.tsx tests/features/insights/InsightsDetailScreens.test.tsx tests/localization/translations.test.ts tests/sanity/testIds.test.ts` | pass | Final focused regression pass: 6 suites, 57 tests. |
| 2026-05-14 | `corepack pnpm typecheck` | pass | Final TypeScript rerun after review and E2E fixes. |
| 2026-05-14 | `corepack pnpm lint` | pass | Final ESLint rerun after review and E2E fixes. |
| 2026-05-14 | `git diff --check` | pass | Whitespace check passed. |
| 2026-05-14 | `corepack pnpm test:coverage:check` | pass | Full suite passed: 146 suites, 1 skipped, 1135 passed / 1136 total. Coverage checker passed; touched files remained above the 95% rule. |
| 2026-05-14 | `EXPO_PUBLIC_DEV_LAUNCH_PRESET=qa-rich-history EXPO_DEV_SERVER_PORT=8081 EXPO_DEV_SERVER_HOST=127.0.0.1 DETOX_IOS_DEVICE='iPhone 17 Pro' corepack pnpm detox test -c ios.sim.debug --cleanup --artifacts-location docs/qa/screenshots/2026-05-13-slice-9-pattern-briefings/detox-ios --take-screenshots manual -- e2e/pattern-briefings.e2e.js` | pass | Final iOS smoke passed and captured monthly briefing hub/detail screenshots after copy fixes. |
| 2026-05-14 | `EXPO_PUBLIC_DEV_LAUNCH_PRESET=qa-rich-history EXPO_DEV_SERVER_PORT=8081 EXPO_DEV_SERVER_HOST=10.0.2.2 DETOX_ANDROID_AVD='Pixel_9_API_35' corepack pnpm detox test -c android.emu.debug --cleanup --artifacts-location docs/qa/screenshots/2026-05-13-slice-9-pattern-briefings/detox-android --take-screenshots manual -- e2e/pattern-briefings.e2e.js` | pass | Final Android smoke passed and captured the same monthly briefing surfaces. |
| 2026-05-14 | Dedicated review agent | fixed, then clean | Reviewer found untracked route/screen/E2E files and stale "this month" fallback copy. Fixed by staging the new files and naming the selected briefing month in copy; simulator and automated reruns passed. |

### Simulator Evidence

- iOS: Detox passed on `iPhone 17 Pro` for `e2e/pattern-briefings.e2e.js` with `qa-rich-history`. Evidence directory: `floriva-app/docs/qa/screenshots/2026-05-13-slice-9-pattern-briefings/detox-ios/ios.sim.debug.2026-05-14 04-57-32Z/`.
- Android: Detox passed on `Pixel_9_API_35` for `e2e/pattern-briefings.e2e.js` with `qa-rich-history`. Evidence directory: `floriva-app/docs/qa/screenshots/2026-05-13-slice-9-pattern-briefings/detox-android/android.emu.debug.2026-05-14 04-58-17Z/`.
- Visual QA notes: Insights shows the monthly briefing card above the floating tab bar after scrolling, and detail shows neutral local monthly summary copy, period/symptom metrics, and top signals without diagnosis, treatment, or medical-authority claims.

### Review Findings

| ID | Severity | Source | Finding | Status |
| --- | --- | --- | --- | --- |
| PB-001 | P1 | review | Monthly briefing route, detail screen, and E2E file were untracked during review, so the hub row could land without the destination. | fixed by staging the new files for the Slice 9 commit |
| PB-002 | P2 | review | Fallback month logic could show April data while lead/detail copy said "this month." | fixed by naming the selected month in the lead and using neutral "Monthly briefing" detail copy |
| PB-003 | P1 | simulator QA | iOS E2E still asserted the old "This month's briefing" detail title after copy was corrected. | fixed by updating the E2E assertion and rerunning iOS and Android Detox successfully |
| PB-004 | P1 | coverage gate | New detail screen initially missed the touched-file 95% coverage threshold. | fixed with detail route render and back-navigation tests; full coverage gate passed |

### Remaining Blockers

- None for Slice 9.

### Next Recommended Slice

Start Slice 10: Flagship Integration Pass in a new dedicated worktree after committing/merging Slice 9.

## Slice 10: Flagship Integration Pass

### Acceptance Criteria

- [x] Dedicated worktree created under `.worktrees/`.
- [x] Existing Plus surfaces reviewed as one paid product by a sub-agent before implementation.
- [x] Private Timeline now includes a derived monthly briefing row for the latest logged month without adding a new filter chip.
- [x] Timeline reminder rows route directly to reminder settings instead of the generic Settings root.
- [x] Monthly briefing detail explains which local source categories were used without reading or exposing notes/freeform text.
- [x] Source labels are derived only from local structured data such as imports, TTC observations, birth-control events, and condition-mode profile settings.
- [x] New copy is localized across supported locales where added.
- [x] Focused and full automated verification passed with touched files above the 95% coverage rule.
- [x] iOS simulator E2E with manual screenshots completed for timeline and briefing flows.
- [x] Android simulator E2E with manual screenshots completed for timeline and briefing flows.
- [x] Dedicated review completed; important findings fixed and re-reviewed.

### Files Touched

- `floriva-app/docs/qa/2026-05-13-floriva-plus-program-ledger.md`
- `floriva-app/docs/superpowers/plans/2026-05-14-flagship-integration.md`
- `floriva-app/e2e/pattern-briefings.e2e.js`
- `floriva-app/e2e/private-timeline.e2e.js`
- `floriva-app/src/features/insights/buildInsightsScreenModel.ts`
- `floriva-app/src/features/insights/screens/InsightsMonthlyBriefingScreen.tsx`
- `floriva-app/src/features/insights/types.ts`
- `floriva-app/src/features/timeline/buildPrivateTimelineModel.ts`
- `floriva-app/src/features/timeline/screens/PrivateTimelineScreen.tsx`
- `floriva-app/src/features/timeline/types.ts`
- `floriva-app/src/localization/messages/insights.ts`
- `floriva-app/tests/features/insights/buildInsightsScreenModel.test.ts`
- `floriva-app/tests/features/insights/InsightsDetailScreens.test.tsx`
- `floriva-app/tests/features/insights/InsightsScreenBranches.test.tsx`
- `floriva-app/tests/features/timeline/buildPrivateTimelineModel.test.ts`
- `floriva-app/tests/features/timeline/PrivateTimelineScreen.test.tsx`
- `floriva-app/tests/localization/translations.test.ts`
- `floriva-app/docs/qa/screenshots/2026-05-13-slice-10-flagship-integration/`

### Verification Log

| Time | Command / Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-05-14 | `corepack pnpm install --frozen-lockfile` | pass | Dependencies installed in the Slice 10 worktree. |
| 2026-05-14 | Red TDD focused tests | fail as expected | Initial assertions failed for missing monthly timeline kind/count/source labels before implementation. |
| 2026-05-14 | `corepack pnpm test:ci --runInBand tests/features/timeline tests/features/insights tests/localization/translations.test.ts tests/sanity/testIds.test.ts` | pass | Focused regression pass: 9 suites, 77 tests. |
| 2026-05-14 | `corepack pnpm typecheck` | pass | TypeScript gate passed. |
| 2026-05-14 | `corepack pnpm lint` | pass | ESLint gate passed after E2E harness fixes. |
| 2026-05-14 | `git diff --check` | pass | Whitespace check passed. |
| 2026-05-14 | `corepack pnpm test:coverage:check` | pass | Full suite passed: 146 suites, 1 skipped, 1135 passed / 1136 total. Coverage checker passed; touched files remained above the 95% rule. |
| 2026-05-14 | `EXPO_DEV_SERVER_PORT=8081 DETOX_ANDROID_AVD='Pixel_9_API_35' corepack pnpm detox:build:android` | pass | Android debug APK and test APK built successfully. |
| 2026-05-14 | `EXPO_DEV_SERVER_PORT=8081 DETOX_IOS_DEVICE='iPhone 17 Pro' corepack pnpm detox:build:ios` | pass | iOS debug build passed after `pod install`; generated Hermes checksum churn was kept out of the committed diff. |
| 2026-05-14 | `EXPO_PUBLIC_DEV_LAUNCH_PRESET=qa-rich-history EXPO_DEV_SERVER_PORT=8081 EXPO_DEV_SERVER_HOST=127.0.0.1 DETOX_IOS_DEVICE='iPhone 17 Pro' corepack pnpm detox test -c ios.sim.debug --cleanup --artifacts-location docs/qa/screenshots/2026-05-13-slice-10-flagship-integration/detox-ios --take-screenshots manual -- --runInBand e2e/private-timeline.e2e.js e2e/pattern-briefings.e2e.js` | pass | Final iOS pair passed after E2E navigation changes: 2 suites, 2 tests. |
| 2026-05-14 | `EXPO_PUBLIC_DEV_LAUNCH_PRESET=qa-rich-history EXPO_DEV_SERVER_PORT=8081 EXPO_DEV_SERVER_HOST=10.0.2.2 DETOX_ANDROID_AVD='Pixel_9_API_35' corepack pnpm detox test -c android.emu.debug --cleanup --artifacts-location docs/qa/screenshots/2026-05-13-slice-10-flagship-integration/detox-android --take-screenshots manual -- --runInBand e2e/private-timeline.e2e.js e2e/pattern-briefings.e2e.js` | pass | Final Android pair passed serially after stabilizing timeline deep-link routing and briefing tab/row navigation: 2 suites, 2 tests. |
| 2026-05-14 | Dedicated review agent | fixed, then clean | Reviewer found stale TTC/birth-control source labels could appear after those modes were disabled. Fixed by gating source labels on current profile settings; focused re-review was clean. |

### Simulator Evidence

- iOS: Detox passed on `iPhone 17 Pro` for `e2e/private-timeline.e2e.js` and `e2e/pattern-briefings.e2e.js` with `qa-rich-history`. Final evidence directory: `floriva-app/docs/qa/screenshots/2026-05-13-slice-10-flagship-integration/detox-ios/ios.sim.debug.2026-05-14 05-42-23Z/`.
- Android: Detox passed on `Pixel_9_API_35` for `e2e/private-timeline.e2e.js` and `e2e/pattern-briefings.e2e.js` with `qa-rich-history`. Final evidence directory: `floriva-app/docs/qa/screenshots/2026-05-13-slice-10-flagship-integration/detox-android/android.emu.debug.2026-05-14 05-39-53Z/`.
- Visual QA notes: Private Timeline shows the derived monthly briefing row in the full timeline and keeps reminder rows available through the reminder filter. Monthly briefing detail shows the local source transparency section without diagnosis, treatment, medical-authority language, or note/freeform disclosure.

### Review Findings

| ID | Severity | Source | Finding | Status |
| --- | --- | --- | --- | --- |
| FI-001 | P1 | review | Monthly briefing source labels could mention stale TTC observations after TTC mode was disabled, and stale birth-control events after birth-control tracking was no longer active. | fixed by gating TTC labels on `hasEnabledTtcMode(profile)`, birth-control labels on `profile.birthControlMethod`, adding regression coverage, and passing focused re-review |

### Remaining Blockers

- None for Slice 10.

### Next Recommended Slice

Floriva Plus slice implementation is complete after Slice 10 review, fixes, commit, and merge.
