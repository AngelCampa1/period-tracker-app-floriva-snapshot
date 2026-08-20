# Floriva Store Submission Sweep Summary

Date: 2026-05-06

## Result

Ready for store-side final validation and submission prep.

This summary supersedes the earlier local sweep notes from May 6, 2026. The initial pass found stale coverage, billing-environment, and UI-flow issues; those were resolved or documented as store-only validation items before this branch was prepared for merge.

## Preflight

- `pnpm lint`: pass
- `pnpm typecheck`: pass
- `pnpm test:ci`: pass
- `pnpm test:coverage:check`: pass
- `pnpm test:imports`: pass
- `pnpm test:smoke`: pass
- Marketing `pnpm lint`: pass with 2 warnings, 0 errors
- Marketing `pnpm typecheck`: pass
- Marketing `pnpm test`: pass
- Marketing `pnpm check:assets`: pass
- Marketing `pnpm export:assets`: pass, 361 store PNGs exported
- Marketing `pnpm check:video-assets`: pass

## Coverage

Evidence captured:

- iOS screenshots: `ios/000-fresh-launch.png` through `ios/034-settings-main-top.png`
- Android screenshots/UI XML: `android/000-launch.png` through `android/016-settings.png`
- Logs: `logs/`

Flows covered:

- iOS fresh launch, privacy modal, onboarding import/manual commit, fresh onboarding, notifications skip, paywall, sandbox account sign-in attempt, preview completion, Today, daily log save, Calendar, Insights, Settings.
- Android dev-client launch, onboarding welcome, fresh setup, notifications skip, paywall, preview completion, Today, Calendar, Insights, Settings.
- Final automated suites for app logic, release config, import sanity, smoke routes, marketing copy/assets, and asset export.

Not fully completed in this pass:

- Confirmed iOS purchase transaction on TestFlight or a real App Store sandbox environment.
- Android real Play Billing purchase on a Play-capable tester/device environment.

## Release Artifact Checks

- iOS archive: `Floriva-1.0.1-10.xcarchive`.
- iOS bundle identifier: `app.floriva`.
- iOS version/build: `1.0.1` / `10`.
- iOS scheme: `Floriva`.
- iOS archive StoreKit check: no `.storekit` file found.
- Android AAB: `floriva-app/android/app/build/outputs/bundle/release/app-release.aab`.
- Android package: `app.floriva`.
- Android versionCode: `10`.

## Blocking / High Issues

No blocking local release issues remain after the final verification pass.

## Store Recommendation

Proceed with store-console final validation. Stop before the final App Store `Submit for Review` and Play production submission buttons unless Angel explicitly confirms. Store billing remains a real-store validation item because local debug simulators cannot fully prove App Store sandbox or Google Play Billing purchase rails.
