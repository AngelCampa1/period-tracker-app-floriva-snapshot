# Production Readiness Sweep

Date: 2026-04-16
Branch: `codex/prod-readiness-sweep`

## Scope
- Final production-readiness hardening in the dedicated worktree
- Route recovery, onboarding/import navigation, localization resilience, and glass token consistency
- Full repo verification plus focused iOS and Android simulator checks

## Automated Verification
- `pnpm typecheck`
  - passed
- `pnpm lint`
  - passed with existing repo warnings only, no errors
- `pnpm test:ci`
  - passed
- `pnpm test:coverage`
  - passed

## Manual Verification
### iOS simulator
- Onboarding import chooser renders a single source-selection heading and no duplicate step title
- `Back to path choice` returns from onboarding import to the start-path chooser correctly
- Start-path selection state stays intact after returning from import

### Android emulator
- Settings hub renders without the floating dock obscuring lower sections
- Lower Settings rows remain visible after scrolling, including `Privacy & lock`, `Reminders`, `Trying to conceive`, and `Language`
- Settings affordances continue to show localized trailing `Open` actions and readable summaries

## Screenshots
- iOS onboarding import chooser: [ios-onboarding-import-chooser.jpg](~/Desktop/floriva/.worktrees/codex/prod-readiness-sweep/floriva-app/docs/qa/screenshots/2026-04-16-production-readiness-sweep/ios-onboarding-import-chooser.jpg)
- iOS onboarding start-path return: [ios-onboarding-start-path-return.jpg](~/Desktop/floriva/.worktrees/codex/prod-readiness-sweep/floriva-app/docs/qa/screenshots/2026-04-16-production-readiness-sweep/ios-onboarding-start-path-return.jpg)
- Android Settings hub top: [android-settings-hub-top.png](~/Desktop/floriva/.worktrees/codex/prod-readiness-sweep/floriva-app/docs/qa/screenshots/2026-04-16-production-readiness-sweep/android-settings-hub-top.png)
- Android Settings hub lower: [android-settings-hub-lower.png](~/Desktop/floriva/.worktrees/codex/prod-readiness-sweep/floriva-app/docs/qa/screenshots/2026-04-16-production-readiness-sweep/android-settings-hub-lower.png)

## Issues Fixed In This Sweep
1. Onboarding and privacy screens bypassed tests that mocked `LocalizationProvider` because they imported `useLocalization` directly from `localizationContext`.
Impact: smoke and import coverage could fail even when the UI itself was correct.
Fix: standardized affected onboarding/privacy screens on the `LocalizationProvider` re-export.

2. `glass.variants.chrome` drifted away from the dock tint/highlight contract expected by the shared glass theme tests.
Impact: theme verification failed and the tab-bar glass token model no longer matched its documented relationship.
Fix: restored chrome tint, highlight, and shadow-opacity parity with the dock variant.

3. Root modal and not-found recovery could strand users on a hard reset path instead of returning through the resolved shell entry.
Impact: route recovery from detached entry surfaces was less reliable than the rest of the shell.
Fix: both surfaces now dismiss back when possible and otherwise route through `resolveAppEntry(...)`.

4. `localizationNative.test.ts` was brittle under the full parallel `test:ci` run.
Impact: full CI verification could fail even though the localization fallback implementation was sound.
Fix: tightened mock isolation inside each test and cleaned up module mocks after each case.

5. `tests/app/smoke.test.tsx` still asserted stale welcome copy and lacked localization mocks.
Impact: smoke verification drifted from the current privacy-first onboarding copy.
Fix: aligned the smoke harness with the shared localization test helper and current onboarding copy.

## Outcome
- App-side blockers found in this sweep were fixed and re-verified.
- Full automated verification is green.
- Focused iOS and Android simulator checks passed after the final fixes.

## Remaining External Blockers
- Real App Store / Play purchase and restore validation still depends on live store product configuration.
- Signing, store-console metadata, and submission workflows remain release-ops work outside this local app sweep.
