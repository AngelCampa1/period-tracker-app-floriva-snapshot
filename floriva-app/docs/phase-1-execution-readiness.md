# Phase 1 Execution Readiness

This guide is the canonical setup reference for Floriva Phase 1.

Phase 1 locks these decisions:

- `floriva-app/` is the app workspace.
- `pnpm` is the package manager.
- local development builds are the standard native workflow
- `ios/` and `android/` stay generated for now and are not committed
- Jest plus React Native Testing Library is the local test baseline
- Detox is the E2E direction, with a prepared baseline config and selector rules

## Fresh-Machine Setup

Verify the local toolchain before installing anything:

```bash
node --version
pnpm --version
xcodebuild -version
java -version
adb --version
emulator -version
```

Recommended local prerequisites:

- current Node.js LTS compatible with Expo SDK 54
- `pnpm` 10.x
- Xcode and iOS Simulator on macOS
- Android Studio with an emulator image installed
- Java 17+ for Android tooling
- Watchman on macOS if Metro file watching is unreliable
- `applesimutils` if you plan to run Detox on iOS simulators

Machine-specific notes from the Phase 1 setup performed on April 9, 2026:

- Android was verified locally with Java 17, Android SDK command-line tools, platform tools, an emulator image, and a created AVD
- Gradle was pinned to Java 17 through `~/.gradle/gradle.properties` because this project currently uses Gradle 8.14.3, which does not support running on Java 25
- `android/local.properties` points `sdk.dir` at `/opt/homebrew/share/android-commandlinetools`
- iOS was verified locally after installing full Xcode, accepting the Xcode license, selecting `/Applications/Xcode.app/Contents/Developer`, and downloading the iOS 26.4 simulator runtime

Install dependencies from the app directory:

```bash
cd floriva-app
pnpm install
```

If pnpm reports blocked build scripts, approve the prompted packages and rerun the install:

```bash
pnpm approve-builds
pnpm install
```

## First Native Run

Floriva treats development builds as the default local-native workflow.

First-time native build commands:

```bash
cd floriva-app
pnpm ios
```

```bash
cd floriva-app
pnpm android
```

These commands generate `ios/` and `android/` locally if needed, compile the native app, and install the development build on the simulator or emulator.

After the first native build succeeds, use the dev client for everyday iteration:

```bash
cd floriva-app
pnpm start
```

Use `pnpm start:go` only when you intentionally want Expo Go behavior for a JS-only check.

## Command Reference

| Command                    | Purpose                                                             |
| -------------------------- | ------------------------------------------------------------------- |
| `pnpm install`             | Install dependencies                                                |
| `rm -rf node_modules && pnpm install` | Cleanly reinstall dependencies                           |
| `pnpm start`               | Start Metro for the development client                              |
| `pnpm start:go`            | Start Metro for Expo Go                                             |
| `pnpm start:clear`         | Start Metro for the development client and clear cache              |
| `pnpm ios`                 | Build and launch the iOS development build locally                  |
| `pnpm android`             | Build and launch the Android development build locally              |
| `pnpm prebuild`            | Generate native projects without deleting local native output       |
| `pnpm prebuild:clean`      | Regenerate native projects from scratch                             |
| `pnpm test:ci`             | Run the Jest baseline once, serially                                |
| `pnpm test:smoke`          | Run the route smoke tests                                           |
| `pnpm test:imports`        | Run the import-resolution sanity tests                              |
| `pnpm lint`                | Lint the Phase 1 tooling and tests                                  |
| `pnpm typecheck`           | Run TypeScript without emitting output                              |
| `pnpm detox:build:ios`     | Build the prepared Detox iOS target after native projects exist     |
| `pnpm detox:test:ios`      | Run the prepared Detox iOS smoke test                               |
| `pnpm detox:build:android` | Build the prepared Detox Android target after native projects exist |
| `pnpm detox:test:android`  | Run the prepared Detox Android smoke test                           |

## Dev Builds Versus Expo Go

Expo documents development builds as debug builds that include `expo-dev-client`, while Expo Go stays limited to the native libraries bundled into the Expo Go app.

For Floriva, use:

- development builds for normal iOS and Android work
- Expo Go only for quick JS-only checks when native parity does not matter

Why we lock this now:

- Floriva will need native modules early
- native config changes must be testable locally
- the app’s real shell matters more than the convenience of Expo Go

## Rebuild Rules

Metro reload is enough for:

- route component edits
- styling changes
- most TypeScript or JavaScript changes
- test-only changes

Rebuild native output with `pnpm ios`, `pnpm android`, or `pnpm prebuild:clean` when you:

- add or remove a native dependency
- change `app.json` fields that affect native metadata
- change config plugins
- update app icons, splash assets, bundle identifiers, package names, or schemes
- hit a native build mismatch after SDK or dependency upgrades

Use `pnpm prebuild:clean` when native folders look stale or when you need to fully regenerate them from the Expo config.

## Generated Native Folders

Phase 1 keeps `ios/` and `android/` generated and ignored.

That means:

- local native folders may appear after `pnpm ios`, `pnpm android`, or `pnpm prebuild`
- they are disposable build artifacts in this phase
- if Phase 2 or later needs committed native customization, revisit this rule explicitly

## Testing Baseline

The test baseline lives outside the router tree:

- `tests/app/` for route and app-shell smoke coverage
- `tests/sanity/` for environment and import-resolution checks
- `e2e/` for Detox staging

Current Phase 1 expectations:

- route-aware tests use `expo-router/testing-library`
- tests import app code through the `@/` alias
- touched files should stay near 95% coverage where practical
- future feature tests should prefer integration-style coverage when behavior crosses boundaries

## Detox Baseline

Detox is the official E2E direction for Floriva.

Phase 1 includes:

- `detox.config.js`
- `e2e/jest.config.js`
- `e2e/smoke.e2e.js`
- package scripts for iOS and Android Detox runs

The current Detox config is prepared for the first generated native projects. Before it can run on a fresh machine, you need:

1. a successful local native build or prebuild
2. simulator or emulator targets that match the configured device names
3. any platform prerequisites like `applesimutils` on iOS

## `testID` Conventions

Use stable, semantic, feature-scoped IDs.

Rules:

- scope by feature or screen
- name for user-visible intent, not visual structure
- keep IDs stable across styling refactors
- prefer a small exported constant map for reused selectors

Examples:

- `home-screen`
- `home-title`
- `home-status`
- `setup-screen`

Do not use generated indexes like `button-1` or layout-driven names like `left-column-card`.

## Troubleshooting

- If Metro serves stale output, run `pnpm start:clear`.
- If a native build fails after config changes, delete local native folders and rerun `pnpm prebuild:clean`.
- If iOS does not boot, confirm Xcode, command-line tools, and the simulator runtime are installed.
- If Android does not boot, confirm Android Studio, the SDK path, and an emulator image are configured.
- If pnpm blocks package build scripts, run `pnpm approve-builds` before retrying.
- If Detox cannot find a simulator utility on macOS, install `applesimutils`.
- If Detox build paths drift after renaming the app, update `detox.config.js` alongside the rename.

## Verification Status

Verified in this workspace:

- `pnpm install`
- `pnpm ios` completed a full local iOS build, installed the development build on the `iPhone 17 Pro` simulator, and opened the Expo development client
- `pnpm android` completed a full local Android build, installed the debug APK on an emulator, and opened the Expo development client
- Jest baseline
- lint baseline
- TypeScript baseline

Not verified in this workspace:

- Detox device execution

Both native development-build paths are now machine-ready in this environment. Detox is still prepared but not yet executed on devices.
