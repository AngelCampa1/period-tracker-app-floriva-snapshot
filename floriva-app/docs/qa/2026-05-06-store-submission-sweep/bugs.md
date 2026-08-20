# Floriva Store Submission Sweep - Bugs

Date: 2026-05-06

## Recommendation

Do not submit to the stores yet. The app launches and core flows are mostly navigable on both simulators, but this sweep found release-blocking quality issues and billing risks.

## Bugs Found

### QA-2026-05-06-001 - Coverage gate fails on touched files

- Platform: CI / release preflight
- Severity: Blocker
- Evidence: `logs/pnpm-test-coverage-check.log`
- Reproduction:
  1. Run `pnpm test:coverage:check` from `floriva-app`.
  2. Observe Jest passes, then `scripts/check-coverage.js` fails.
- Expected: Coverage check passes before store submission, matching the repo requirement of 95% coverage on touched files.
- Actual: Coverage fails for touched files including `CalendarDayScreen.tsx`, `CalendarScreen.tsx`, `TodaySummaryCard.tsx`, `CycleLengthScreen.tsx`, `NoRemindersNudge.tsx`, `TodayScreen.tsx`, and `presentation.ts`.
- Release impact: Blocks the documented release workflow even though `pnpm lint`, `pnpm typecheck`, and `pnpm test:ci` pass.

### QA-2026-05-06-002 - iOS Today summary does not reflect saved log values

- Platform: iOS Simulator
- Severity: High
- Evidence:
  - `ios/029-log-day-top.png`
  - `ios/030-log-saved.png`
  - `ios/031-today-after-log-summary-not-updated.png`
  - `ios/032-calendar-main.png`
- Reproduction:
  1. Complete onboarding into the app.
  2. Tap `Log today`.
  3. Select `Light` bleeding and `Sleep changes`.
  4. Save the log.
  5. Return to Today.
- Expected: Today’s log summary shows the saved flow/sleep values.
- Actual: The log detail says it is saved, but the Today summary still shows empty placeholders (`FLOW ·`, `SLEEP —`).
- Release impact: Users can save data and immediately see an apparently empty summary, which undermines trust in local data persistence.

### QA-2026-05-06-003 - iOS sandbox purchase does not reach purchase confirmation after local sandbox login

- Platform: iOS Simulator
- Severity: High
- Evidence:
  - `ios/022-paywall-apple-account-prompt.png`
  - `ios/024-paywall-sandbox-credentials-entered.png`
  - `ios/025-paywall-after-sandbox-ok-wait.png`
  - `ios/026-paywall-signin-prompt-reappears-after-sandbox.png`
  - `logs/ios-floriva-runtime.log`
- Reproduction:
  1. Reach onboarding paywall.
  2. Tap annual purchase.
  3. Sign in using `IOS_SANDBOX_TESTER_EMAIL` and `IOS_SANDBOX_TESTER_PASSWORD` from `.env.local`.
  4. Tap annual purchase again.
- Expected: StoreKit advances to purchase confirmation or a clear recoverable status.
- Actual: The prompt reappears and runtime logs report `requestPurchase failed: User cancelled the purchase flow`. No purchase confirmation was reached during the sweep.
- Release impact: Needs a real-device/TestFlight sandbox confirmation before App Store submission. Could be simulator-only, but it is not verified.

### QA-2026-05-06-004 - Android paywall reports billing unavailable

- Platform: Android Emulator
- Severity: High
- Evidence:
  - `android/010-paywall.png`
  - `android/011-paywall-bottom.png`
- Reproduction:
  1. Install debug APK on `emulator-5554`.
  2. Complete onboarding to the paywall.
- Expected: Android billing products load or the release environment has a verified Play Billing path.
- Actual: Paywall displays `Billing is unavailable on this device or account. Please try Refresh billing status.` Product cards still render below.
- Release impact: Android monetization is not verified. This is especially risky because Android product IDs default to empty strings unless env vars are set.

### QA-2026-05-06-005 - Android debug assemble failed once, then passed on retry

- Platform: Android build
- Severity: Medium
- Evidence:
  - `logs/android-gradle-build.log`
  - `logs/android-gradle-build-retry.log`
  - `logs/android-package-debug-stacktrace.log`
- Reproduction:
  1. Run `cd android && ./gradlew app:assembleDebug app:assembleDebugAndroidTest -DtestBuildType=debug`.
  2. Observe first failure at `:app:packageDebug`.
  3. Run the same assemble command again.
- Expected: The local debug build is deterministic.
- Actual: First run failed with `PackageAndroidArtifact$IncrementalSplitterRunnable`; retry passed.
- Release impact: Not a product bug by itself, but a build instability close to submission time.

## Non-blocking Notes

- iOS and Android both launched through local dev-client builds after rebuild/install.
- iOS onboarding import manual history path worked through preview and commit.
- Android fresh onboarding reached Today through preview mode.
- No fatal Android crash was present in the captured crash buffer.

## Post-fix Follow-up

As of the follow-up verification on 2026-05-06, the code-backed blockers from this report have fixes and passing verification:

- Coverage gate: `pnpm test:coverage:check` passes.
- Today summary freshness: covered by unit/integration tests and simulator smoke evidence.
- Billing QA behavior: deterministic local billing/fallback paths and QA-native opt-in were added in the fix pass.
- Android build stability: clean QA build/install path completed successfully.
- Backup export/share handoff: fixed via the shared `Screen` tap behavior and verified in `backup-export-followup.md`.
