# Cross-Platform E2E Audit

Date: 2026-04-10
Workspace: `~/Desktop/floriva/.worktrees/codex/e2e-hardening/floriva-app`
Platforms: iOS Simulator (`iPhone 17`), Android Emulator (`Pixel_9_API_35`)

## Baseline

- `pnpm test:smoke` passed
- `pnpm lint` passed
- `pnpm typecheck` passed
- `pnpm test:ci` passed
- Expo dev client launched locally on iOS and Android

## Manual Pass

Local QA used simulator-safe substitutes where the product depends on external state:

- Seeded on-device SQLite data to reach the tracker shell without live store setup
- Used truthful local billing fallback states instead of pretending store access existed
- Exercised biometric-unavailable behavior through simulator-safe lock flows
- Used local app state and route navigation instead of backend or cloud dependencies

Cross-platform manual checks completed during this pass:

- Onboarding validation and footer/scroll recovery
- Tracker shell launch and tab navigation
- Today log save/delete flows, including destructive confirmation and cancel recovery
- Settings privacy lock flow with biometrics off and unavailable
- Calendar regression after seeded history hydration
- Settings regression after reload on both devices

Evidence captured locally during QA:

- `/tmp/floriva-qa/android-basics-validation-fix.png`
- `/tmp/floriva-qa/android-basics-scrolled.png`
- `/tmp/floriva-qa/android-delete-confirm.png`
- `/tmp/floriva-qa/android-delete-confirm-fixed.png`
- `/tmp/floriva-qa/android-current.png`
- `/tmp/floriva-qa/android-settings-ui.xml`
- `/tmp/floriva-qa/android-settings-final.png`
- simulator screenshots captured through the iOS MCP flow during the same pass
- `<tmp>/T/screenshot_optimized_d9ea1a8b-36b6-4496-a200-ef0ca3a3cd88.jpg`

## Findings

### Resolved

1. Cross-platform onboarding footer overlap
- Severity: High
- Platforms: iOS, Android
- Result: Shared screen layout now keeps keyboard-friendly scroll behavior while leaving footer spacing in the footer container itself, so footer screens no longer rely on guessed or double-counted scroll padding.

2. Daily log deletion was a one-tap destructive action
- Severity: High
- Platforms: iOS, Android
- Result: Today logging now requires an explicit confirm/cancel step, keeps the action area visible, and exposes stable selectors for manual and E2E validation.

3. Lock screen could trap users when biometrics were unavailable
- Severity: High
- Platforms: iOS, Android
- Result: `Lock now` is guarded, the disabled affordance is explicit when biometric lock is off, and the lock screen recovery path now opens device settings instead of bypassing the privacy lock.

4. Billing package mapping and pricing drift
- Severity: High / Medium
- Platforms: iOS, Android
- Result: Unknown native store products no longer collide with known plan ids, localized store pricing is preferred when present, and deterministic fallback pricing remains truthful when store data is missing.

5. Import picker filtering was too narrow for real exports
- Severity: Medium
- Platforms: iOS, Android
- Result: Import file selection accepts broader JSON export variants, still allows valid exports with odd or missing filenames, blocks obviously wrong media picks from picker MIME metadata, and shows clearer guidance when a chosen file does not look like a Floriva-supported export.

6. Detox smoke selector was stale
- Severity: High
- Platforms: iOS, Android
- Result: Smoke coverage now launches into a clean app instance and waits for the current onboarding surface instead of removed selectors.

7. Settings lock affordance was misleading when biometric lock was off
- Severity: Medium
- Platforms: iOS, Android
- Result: Shared action buttons now support a real disabled state, and Settings explains why `Lock now` is unavailable before the user taps it.

## Verification

Targeted touched-file verification:

- `pnpm jest tests/components/ActionButton.test.tsx tests/components/Screen.test.tsx tests/features/billing/BillingProvider.test.tsx tests/features/billing/model.test.ts tests/features/billing/SubscribeScreen.test.tsx tests/features/import/ImportScreen.test.tsx tests/features/logging/TodayLoggingScreen.test.tsx tests/features/privacy/LockScreen.test.tsx tests/features/settings/SettingsScreen.test.tsx --runInBand`
- touched-file coverage rerun completed with line coverage at or above 95% for all touched source files
- post-review rerun completed with the same touched-file set plus coverage refresh after the lock, screen-layout, and import follow-up fixes

Repo-level verification:

- `pnpm test:smoke`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:ci`
- final manual sanity loop on iOS and Android confirmed Settings renders the corrected disabled `Lock now` state when biometric lock is off
- final reviewer rerun after the import and shared-screen follow-up fixes found no blocking merge issues

## Residual Notes

- `tests/features/billing/BillingProvider.test.tsx` still emits React `act(...)` warnings during `pnpm test:ci`, but the suite passes and no user-facing billing defect was reproduced during this hardening pass.
