# Floriva Store Submission Sweep Preflight

Date: 2026-05-06

## Commands

- `pnpm lint`
  - Result: pass
  - Log: `logs/pnpm-lint.log`
- `pnpm typecheck`
  - Result: pass
  - Log: `logs/pnpm-typecheck.log`
- `pnpm test:ci`
  - Result: pass
  - Log: `logs/pnpm-test-ci.log`
- `pnpm test:coverage:check`
  - Result: fail
  - Log: `logs/pnpm-test-coverage-check.log`
- iOS debug simulator build
  - Result: pass
  - Log: `logs/ios-xcodebuild.log`
- Android debug build
  - Result: first run failed, retry passed
  - Logs: `logs/android-gradle-build.log`, `logs/android-gradle-build-retry.log`

## Devices

- iOS: iPhone 17 simulator, iOS 26.4
- Android: `emulator-5554`, `sdk_gphone64_arm64`
