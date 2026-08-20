# Release engineering

Floriva shipped to the App Store and Google Play as a single-maintainer product.
Every production build was produced locally, signed locally, and gated by a
script that refuses to pass until the artefacts on disk match the version the
repository claims to be releasing.

This document covers how that worked, what the gates actually check, and what
the stores did with the results.

---

## Local-only builds

There is an `eas.json` in the tree and Expo's build service was available. It was
deliberately not used for production. Store and review builds were produced with
Xcode and Gradle on the machine that held the signing material, for three
reasons:

- The signing key never left the machine. For an app whose entire proposition is
  that reproductive data stays on the device, handing the upload key to a hosted
  builder is a poor look, and defending the decision to a user is easier than
  defending the alternative.
- The build that gets validated is the build that gets uploaded. The preflight
  script below inspects the actual `.ipa` and `.aab` on disk. That only works if
  the artefact is on disk.
- iOS archives use the ordinary `Floriva` scheme. A separate `FlorivaStoreKit`
  scheme exists for local StoreKit-simulator work on the purchase flow and was
  never used for an archive.

Android signing came from environment variables loaded from an untracked
credentials file:

```js
// floriva-app/scripts/check-release-env.js:18-23
const requiredAndroidSigningEnv = [
  'FLORIVA_UPLOAD_STORE_FILE',
  'FLORIVA_UPLOAD_STORE_PASSWORD',
  'FLORIVA_UPLOAD_KEY_ALIAS',
  'FLORIVA_UPLOAD_KEY_PASSWORD',
];
```

`android/app/build.gradle` only wires the release signing config when all four
resolve (`if (hasReleaseSigning)`), so an unsigned local build fails loudly at
upload rather than silently producing a debug-signed AAB.

---

## The preflight gate

`pnpm release:preflight` runs `floriva-app/scripts/check-release-env.js`. It
collects **every** failure and prints them together rather than exiting on the
first one, because a release checklist you have to re-run six times is a
checklist people stop running.

It validates five independent things.

### 1. Environment

`APP_ENV` must be exactly `production`, and nine public configuration keys must
be non-empty:

```js
// floriva-app/scripts/check-release-env.js:6-16
const requiredPublicEnv = [
  'EXPO_PUBLIC_PRIVACY_POLICY_URL',
  'EXPO_PUBLIC_SUPPORT_URL',
  'EXPO_PUBLIC_IOS_APP_STORE_ID',
  'EXPO_PUBLIC_IOS_MONTHLY_PRODUCT_ID',
  'EXPO_PUBLIC_IOS_ANNUAL_PRODUCT_ID',
  'EXPO_PUBLIC_IOS_LIFETIME_PRODUCT_ID',
  'EXPO_PUBLIC_ANDROID_MONTHLY_PRODUCT_ID',
  'EXPO_PUBLIC_ANDROID_ANNUAL_PRODUCT_ID',
  'EXPO_PUBLIC_ANDROID_LIFETIME_PRODUCT_ID',
];
```

These have defaults in `app.config.ts`. The point of requiring them explicitly at
release time is that a default silently shipping to production is exactly the
class of mistake that only surfaces in a store listing.

### 2. Android signing material actually works

Not "the four env vars are set": the keystore is exercised. `keytool -list`
proves the store password opens the keystore and the alias exists; then a
throwaway CSR is generated into a temp directory to prove the *key* password
unlocks that specific key, because a keystore password and a key password can
differ and the difference only shows up at signing time:

```js
// floriva-app/scripts/check-release-env.js:253-269
    runCommand(runtime, 'keytool', [
      '-certreq', '-keystore', storeFile,
      '-storepass', runtime.env.FLORIVA_UPLOAD_STORE_PASSWORD,
      '-alias', runtime.env.FLORIVA_UPLOAD_KEY_ALIAS,
      '-keypass', runtime.env.FLORIVA_UPLOAD_KEY_PASSWORD,
      '-file', csrPath,
    ], { stdio: 'ignore' });

    return runtime.fs.existsSync(csrPath) && runtime.fs.statSync(csrPath).size > 0;
```

The temp directory is removed in a `finally` block.

### 3. The Android bundle matches the declared version

`bundletool dump manifest` is run against the built `.aab` and the package name,
`versionName` and `versionCode` are compared against the values the release is
supposed to be shipping. A stale AAB from the previous build number is the single
easiest mistake to make in a manual release, and it is invisible until Play
rejects the upload.

### 4. The iOS export matches, and is signed for distribution

The `.ipa` is unzipped in memory and its `Info.plist` converted with `plutil`;
`CFBundleIdentifier`, `CFBundleShortVersionString`, `CFBundleVersion` and
`CFBundleExecutable` must all match. Then `DistributionSummary.plist` from the
export is parsed and the entry for the IPA must show an `Apple Distribution`
certificate, a named provisioning profile with an expiry, the expected team, the
matching build and version numbers, and `get-task-allow: false`.

There is also a modification-time check: the IPA must not be older than the
distribution summary, so an export directory containing a fresh summary next to
a stale binary fails.

If the whole iOS check fails, the error message differs depending on whether a
distribution identity is present in the keychain, so the failure tells you
whether the problem is signing setup or a missing export.

### 5. Release notes (see below)

### Testing a script that shells out to five binaries

`floriva-app/tests/sanity/release-preflight.test.ts` covers this with 18 cases
and no mocking of the script's own logic. Each case builds a temp directory
containing a fake `package.json`, fake export and bundle paths, and a `bin/`
directory holding four Node shims named `keytool`, `unzip`, `plutil` and
`bundletool`, then prepends that directory to `PATH`:

```ts
// floriva-app/tests/sanity/release-preflight.test.ts:138-142
  writeExecutable(
    binDirectory,
    'unzip',
    "process.stdout.write(JSON.stringify({CFBundleIdentifier:'app.floriva',CFBundleShortVersionString:'1.4.0',CFBundleVersion:'22',CFBundleExecutable:'Floriva'}));",
  );
```

The real branch logic runs; only the external tools are substituted. Two of the
cases invoke the CLI through `spawnSync` rather than the exported function, so
the `process.exitCode` path is covered too. The suite includes a case that
asserts an otherwise-perfect build-21 AAB is **rejected** during a 1.4.0 release:
the gate has to fail on the near-miss, not just on the obvious miss.

---

## The per-platform release-note guard, and why it exists

On 2026-07-24, version 1.3.0 was rejected by App Review. The binary was never
faulted. One of the two cited guidelines was **2.3.10**: the "What's New" text
named Android.

The text was correct (the release *did* ship on both platforms) and it had been
written once and pasted into both store consoles. Apple's rule is that
product-page metadata may not reference another mobile platform. The whole
submission stalled on a word.

The fix was to make the two stores structurally incapable of sharing a file.
Release notes are now separate per-platform documents with different required
headings, different character limits, and different banned vocabularies:

```js
// floriva-app/scripts/check-release-env.js:27-56
const releaseNotePlatforms = [
  {
    name: 'App Store',
    fileName: (version) => `app-store-whats-new-${version}.md`,
    heading: (version) => `# App Store What's New — ${version}`,
    maxCharacters: 4000,
    forbiddenTerms: [
      ['Google Play', /\bgoogle[\s_-]*play\b/i],
      ['Play Store', /\bplay[\s_-]*store\b/i],
      ['Google', /\bgoogle\b/i],
      ['Android', /\bandroid\b/i],
      ['Material Design', /\bmaterial\s+(?:design|3)\b/i],
    ],
  },
  {
    name: 'Google Play',
    fileName: (version) => `google-play-release-notes-${version}.md`,
    heading: (version) => `# Google Play Release Notes — ${version}`,
    maxCharacters: 500,
    forbiddenTerms: [
      ['App Store', /\bapp\s+store\b/i],
      ['Apple', /\bapple\b/i],
      ['iOS', /\bios\b/i],
      ['iPhone', /\biphone\b/i],
      ['iPad', /\bipad\b/i],
      ['TestFlight', /\btestflight\b/i],
      ['Liquid Glass', /\bliquid\s+glass\b/i],
    ],
  },
];
```

The filenames are derived from `package.json`'s version, so a release cannot
reuse the previous version's notes by accident: the file for the new version
simply will not exist and preflight reports it missing.

Each document is parsed into `## <locale>` blocks and every one of the eight
supported locales must appear exactly once, be non-empty, be within the
platform's character budget, and be clean of that platform's banned terms:

```js
// floriva-app/scripts/check-release-env.js:119-133
    if (Array.from(note).length > platform.maxCharacters) {
      failures.push(
        `${platform.name} release notes locale ${locale} exceeds ${platform.maxCharacters} characters.`,
      );
    }

    const normalizedNote = note.normalize('NFKC');

    for (const [label, pattern] of platform.forbiddenTerms) {
      if (pattern.test(normalizedNote)) {
        failures.push(
          `${platform.name} release notes locale ${locale} mention forbidden platform term "${label}".`,
        );
      }
    }
```

Three details are load-bearing.

`Array.from(note).length` counts code points, not UTF-16 units, so the 500-character
Play limit is measured the way Play measures it for Japanese and Chinese.

`normalize('NFKC')` before matching defeats the obvious evasion. There is a test
for exactly that: a note containing `Google＿Play` (fullwidth underscore) and
`Play-Store` is caught in the Spanish block:

```ts
// floriva-app/tests/sanity/release-preflight.test.ts:307-329
  it('normalizes and rejects separator-obscured platform names in localized notes', () => {
```

And locale blocks that are *not* in the supported set are rejected too, so a
stray `## it` block cannot ride along unnoticed into a console paste.

The guard runs against all eight locales, which is the part that would not have
survived being done by hand. Scanning your own English copy for the word
"Android" is easy. Scanning seven translations you cannot read is not.

---

## Store screenshots

The rule was that store screenshots get regenerated for every release rather
than carried over: a redesigned UI advertised with old captures is a slower
version of the same metadata problem.

The last release broke the rule, so state it as a rule and not as a fact. 1.4.0
shipped the 136 captures taken for 1.3.0. They were the right pictures (1.3.0
was the UI redesign, 1.4.0 changed only the paywall retirement, and 1.3.0 was
rejected on metadata before its captures were ever uploaded), but they were
carried over, not regenerated. See [below](#the-140-retirement-release).

The pipeline is `floriva-app/e2e/store-screenshots.e2e.js` (353 lines) driven by
`floriva-app/e2e/store-screenshot-config.js`. It is a Detox spec, so it reuses
the app's own testID registry and deterministic launch presets rather than being
a separate screenshot tool with its own idea of what the app looks like.

**Eight locales, mapped to real device locales.** The config maps each supported
app locale to the `languageAndLocale` pair iOS wants and the BCP-47 tag Android
wants, deliberately picking regional variants that match the target markets
(`es → es_MX`, `pt → pt_BR`, `zh-Hans → zh_CN`). On Android the locale is applied
per-app via `cmd locale set-app-locales` *before* the seeded launch, because
uninstalling afterwards would clear the assignment.

**A clean marketing status bar.** iOS uses `simctl status_bar override` with
Apple's canonical 9:41, full bars and a charged battery; Android drives SystemUI
demo mode to the same effect. Both are cleared in `afterAll` so the override
cannot leak into a later e2e run or manual use of the same device:

```js
// floriva-app/e2e/store-screenshots.e2e.js:182-203
  execFileSync('xcrun', [
    'simctl', 'status_bar', device.id, 'override',
    '--time', '9:41',
    '--dataNetwork', 'wifi', '--wifiMode', 'active', '--wifiBars', '3',
    '--cellularMode', 'active', '--cellularBars', '4',
    '--batteryState', 'charged', '--batteryLevel', '100',
  ]);
```

**Native resolution.** Captures go through `xcrun simctl io … screenshot` and
`adb exec-out screencap -p`: the device framebuffer, at device resolution, with
no scaling step that a store validator can object to.

**Each screen is pinned to the fixture that makes it truthful.** The paywall
capture requires the `billing-fallback` preset (real needs-purchase plan choices,
not a mocked screen); the import capture requires `import-ready` (a real seeded
review preview). Requesting either against the wrong preset throws before a
single screenshot is written:

```js
// floriva-app/e2e/store-screenshot-config.js:45-54
  if (screenFilter.includes('paywall') && launchPreset !== 'billing-fallback') {
    throw new Error(
      'The paywall screenshot requires EXPO_PUBLIC_DEV_LAUNCH_PRESET=billing-fallback so Apple review sees the needs-purchase plan choices.',
    );
  }
  if (screenFilter.includes('import') && launchPreset !== 'import-ready') {
    throw new Error(
      'The import screenshot requires EXPO_PUBLIC_DEV_LAUNCH_PRESET=import-ready so the seeded review preview exists.',
    );
  }
```

### The preset is compiled in, so the candidate had to be rebuilt per preset

For a debug dev-client build, the launch preset is read from the environment and
switching it needs only a Metro restart. For the **Release** screenshot-candidate
build it is different: `app.config.ts` bakes the value into the binary at build
time.

```ts
// floriva-app/app.config.ts:86-90
  extra: {
    devLaunchPreset: process.env.EXPO_PUBLIC_DEV_LAUNCH_PRESET ?? null,
    ...(process.env.FLORIVA_SCREENSHOT_CANDIDATE === '1'
      ? { screenshotCandidateEnabled: true }
      : {}),
  },
```

`Constants.expoConfig.extra` is frozen into the bundle. A Release build has
`__DEV__ === false`, so `isDevLaunchPresetAllowed` will only accept a preset when
`screenshotCandidateEnabled` is present, and both values were fixed at compile
time. The practical consequence: capturing the paywall (`billing-fallback`) and
the eight-locale main set (`tenure-12mo-regular`) from Release candidates
required **rebuilding the candidate binary per preset**, not just relaunching it.

This is deliberate rather than an oversight. The alternative, letting a Release
binary read a seeding preset out of the environment, is a Release binary that
can be told to wipe and re-seed the user's database. `detox.config.js` guards the
build side too: the screenshot-candidate build commands refuse to start unless
`EXPO_PUBLIC_DEV_LAUNCH_PRESET` is one of the four supported capture presets, and
`android/app/build.gradle` gives the variant a `-screenshot-candidate` version
suffix and the debug keystore so it can never be mistaken for a Play artefact.

---

## The versioning surface

A React Native app built through Expo prebuild has the version written in five
places that do not automatically agree:

| Surface | Field | Value at 1.4.0 |
| --- | --- | --- |
| `floriva-app/package.json` | `version` | `1.4.0` |
| `floriva-app/app.config.ts:16,31` | `version`, `ios.buildNumber` | `1.4.0`, `22` |
| `floriva-app/ios/Floriva/Info.plist:33` | `CFBundleShortVersionString` | `1.4.0` |
| `floriva-app/ios/Floriva.xcodeproj/project.pbxproj` | `MARKETING_VERSION`, `CURRENT_PROJECT_VERSION` | `1.4.0`, `22` |
| `floriva-app/android/app/build.gradle:132-133` | `versionCode`, `versionName` | via Gradle properties |

`Info.plist` resolves `CFBundleVersion` to `$(CURRENT_PROJECT_VERSION)` rather
than a literal, which removes one of the five from the problem. The remaining
four are kept in sync by hand and verified by the preflight gate against the
*built artefacts* (the AAB manifest and the IPA `Info.plist`), which is the only
check that catches the case where the source is right and the binary on disk is
from the previous build.

`floriva-app/tests/sanity/release-preflight.test.ts` locks that behaviour in with
a case asserting a build-21 bundle is rejected during a 1.4.0 release.

### No git tags

There are zero git tags in this repository. Release history lives in commit
messages, branch names, and the release documents under `docs/release/` in the
private repo. That is a real gap, not a design choice: a tag is the cheapest
possible way to answer "what was in build 21" and it was never adopted. It is
recorded here rather than papered over with a fabricated release count.

---

## The 1.4.0 retirement release

The company behind Floriva closed in August 2026. The final release removed the
paywall and made everything free. `git show 163477ce` is the whole story:

> Rebases the retirement unlock onto main so the final release users receive
> carries the 1.3.0 redesign as well. 1.3.0 was rejected on metadata only.
> Apple never faulted the binary, so that work has been built, merged and
> tested but never seen by a user. Shipping it with the unlock means the last
> version anyone gets is the best one, and it is free.

The engineering decisions in that commit are worth reading as a set, because
retiring a paid gate is more subtle than deleting the paywall screen.

- `resolvePaidAccessGate` returns `false` unconditionally, and the `/subscribe`
  diversion was removed from `resolveAppEntry` and `AppShellRouteGuard`.
- The paywall and billing-options steps were dropped from **all three**
  onboarding route orders, but the route files were kept so existing deep links
  still resolve. The commit is explicit about why: *"A reviewer on a fresh
  install would otherwise hit a paywall with no purchasable products."*
- Settings shows a retirement notice rather than a purchase CTA;
  `canOpenBillingOptions` is forced false while the surrounding date-gating logic
  is left intact rather than ripped out.
- Version bumped 1.3.0/21 → 1.4.0/22 across `app.config.ts`, `package.json`,
  `Info.plist`, `project.pbxproj`, `build.gradle`, the preflight script and its
  test fixtures.
- New per-platform release notes for 1.4.0, validated by the guard above. The
  commit names the reason: *"neither file may name the other platform, which is
  what caused the 2.3.10 rejection."*
- Screenshots were **not** regenerated. The 136 captures came from the 1.3.0
  pass: fresh captures of the redesigned UI that had never been uploaded,
  because 1.3.0 was rejected on metadata and never shipped. This is the one
  release that carried screenshots over, against the rule stated
  [above](#store-screenshots).

The commit also volunteers its own weak point: the seven non-English blocks in
both release-note files, and one new settings string, are unreviewed machine
translations. See [localization.md](localization.md).

### What the stores did

Stated plainly, because the interesting engineering is in the failures.

**1.3.0 (build 21), 2026-07-24: rejected.** Two metadata guidelines: 2.3.10
(What's New named Android) and 2.3.2 (description referenced premium content).
The binary was not faulted. This is the rejection that produced the release-note
guard.

**1.4.0 (build 22), 2026-08-13: rejected under 2.3.2.** Reviewed on an iPad.
Three assets still carried purchase language into a submission whose entire claim
was that nothing is purchasable: an iPad store screenshot showing subscription
prices, the same paywall image attached to the App Review notes, and What's New
text in all eight locales explaining that subscriptions would not renew. The
binary was again not faulted. The rule recorded afterwards: product-page metadata
says nothing about price, subscriptions, purchases, trials or refunds, in any
locale, field or image: the in-app Settings notice still carries that detail for
users who need it, and a Settings screen is not metadata.

A related fix went in the same week: three onboarding screens still navigated
directly at the removed `/paywall` route and relied on `OnboardingRouteGuard` to
bounce the user back. One of them was the second-to-last step of the fresh-install
flow, which is the exact path a reviewer walks. Verification on an iPad simulator
with a Release build confirmed the guard had prevented the paywall from ever
painting: the mid-transition frame going into completion shows the completion
screen, not pricing, so build 22 was never exposing prices and did not need to
be replaced. The screens were pointed at their real next steps anyway, with a
regression test across all three start paths, rather than leaving a screen that
aims at a pricing surface and depends on a redirect to save it.

**1.4.0 live on the App Store, 2026-08-14.** Three days later, with the unlock
build propagated, the app was withdrawn from all territories and verified via the
availability API. Google Play was already unpublished; Play does not permit
deleting an app that has shipped a production release, so unpublishing is the
maximum removal available there.

---

## A note on running the preflight from this snapshot

`scripts/check-release-env.js` is present and fully tested here, but running
`pnpm release:preflight` against this repository will fail: it looks for release
notes under `docs/phase-4-launch-collateral/generated/`, and that directory was
excluded from publication because it contained personal contact details and store
account identifiers. The script's behaviour is exercised entirely through the
temp-directory fixtures in `tests/sanity/release-preflight.test.ts`, which do
ship.
