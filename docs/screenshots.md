# Screenshots

Every image here was captured from the **1.4.0 build** (the final release) on
iOS 26.4 (iPhone 17 simulator, 1206×2622) and Android API 35 (Pixel 9 emulator,
1080×2424). None is reused from an earlier release, and none is a mockup.

## How they were produced

They are a by-product of the test suite, not a separate art exercise.

[`floriva-app/e2e/ui-lift-sweep.e2e.js`](../floriva-app/e2e/ui-lift-sweep.e2e.js)
drives a Detox run through every surface for a given seed preset, capturing each
one at native resolution. The presets come from
[`src/testing/devLaunchPreset.ts`](../floriva-app/src/testing/devLaunchPreset.ts):
19 deterministic fixtures that seed the database into a known state, so
"12 months of irregular cycles" is a reproducible starting condition rather than
something tapped in by hand.

```bash
EXPO_PUBLIC_QA_FIXTURE_TODAY=2026-08-18 \
FLORIVA_SWEEP_OUT_ROOT=$PWD/captures \
scripts/run-ui-lift-sweep.sh qa-rich-history seeded-tracker tenure-12mo-regular …
```

Status bars are normalized to 9:41 with full signal and battery by
[`e2e/store-screenshot-config.js`](../floriva-app/e2e/store-screenshot-config.js):
`simctl status_bar` on iOS, the SystemUI demo-mode broadcast on Android.

All data shown is synthetic fixture data. No real person's cycle information
appears in any image.

The full sweep produced 90 iOS captures across 11 presets and 77 Android
captures across 10. This repository publishes a curated subset of 69 images,
downscaled (37 iOS, 29 Android, 3 larger hero shots); the selection is explicit in
[`scripts/portfolio/prepare-screenshots.js`](../floriva-app/scripts/portfolio/prepare-screenshots.js)
rather than glob-driven, so nothing ships by accident.

---

## Onboarding

First run, from a genuinely empty database. Eight steps, no account, no email,
nothing to skip past.

| | | | |
| --- | --- | --- | --- |
| ![Welcome](../screenshots/ios/01-welcome.png) | ![Start path](../screenshots/ios/02-start-path.png) | ![Last period](../screenshots/ios/03-last-period-start.png) | ![Cycle length](../screenshots/ios/04-cycle-length.png) |
| Welcome | Start path | Last period start | Cycle length |
| ![Symptoms](../screenshots/ios/05-symptom-logging.png) | ![Notifications](../screenshots/ios/06-notifications.png) | ![Completion](../screenshots/ios/07-completion.png) | ![Empty today](../screenshots/ios/08-today-empty.png) |
| Symptom logging | Reminders | Completion | Today, before any data |

On 1.4.0 this flow has no paywall step. `paywall` and `billing-options` were
removed from every route order when the product was made free. See
[release-engineering.md](release-engineering.md).

## Core surfaces

| | | | |
| --- | --- | --- | --- |
| ![Today](../screenshots/ios/10-today.png) | ![Calendar](../screenshots/ios/11-calendar.png) | ![Insights](../screenshots/ios/12-insights.png) | ![Settings](../screenshots/ios/13-settings.png) |
| Today | Calendar | Insights | Settings |

## Calendar

| | | | |
| --- | --- | --- | --- |
| ![Day detail](../screenshots/ios/20-day-detail.png) | ![History](../screenshots/ios/21-cycle-history.png) | ![Timeline](../screenshots/ios/22-timeline.png) | ![About estimates](../screenshots/ios/23-about-estimates.png) |
| Day detail | Cycle history | Private timeline | How estimates work |

"How estimates work" is a first-class screen rather than a footnote. If the app
is going to show a fertile window, it should be able to explain where the number
came from.

## Insights and predictions

| | | |
| --- | --- | --- |
| ![Cycle pattern](../screenshots/ios/30-cycle-pattern.png) | ![Monthly briefing](../screenshots/ios/31-monthly-briefing.png) | ![TTC](../screenshots/ios/32-ttc-insights.png) |
| Cycle pattern | Monthly briefing | Trying-to-conceive view |

The same screen against two different seeded histories, showing how confidence
and phrasing change with the underlying data:

| | |
| --- | --- |
| ![12mo regular](../screenshots/ios/33-cycle-pattern-12mo-regular.png) | ![12mo irregular](../screenshots/ios/34-cycle-pattern-12mo-irregular.png) |
| 12 months, regular cycles | 12 months, irregular cycles |

## Import

| | | |
| --- | --- | --- |
| ![Import review](../screenshots/ios/40-import-review.png) | ![Clue](../screenshots/ios/41-import-clue.png) | ![Flo](../screenshots/ios/42-import-flo.png) |
| Review before commit | Clue export | Flo export |

Both source screens read "Selected file: `clue-export-fixture.json`", including
the Flo one. That is the fixture, not a bug: the `import-ready` preset seeds a
single selected-file label (`src/testing/qaFixtures.ts:303`) and both screens
render whatever is selected. The screens differ in the export instructions they
give, which is the part worth looking at.

Import always shows what it parsed and what it will write **before** touching
the database. See [import.md](import.md).

## Backup

| | |
| --- | --- |
| ![Export](../screenshots/ios/50-backup-export.png) | ![Restore](../screenshots/ios/51-backup-restore.png) |
| Passphrase-encrypted export | Restore |

## Privacy

| | | | |
| --- | --- | --- | --- |
| ![Privacy](../screenshots/ios/60-privacy-explainer.png) | ![Lock settings](../screenshots/ios/61-privacy-lock.png) | ![Lock screen](../screenshots/ios/62-lock-screen.png) | ![Delete](../screenshots/ios/64-delete-data.png) |
| Privacy explainer | Biometric lock setup | Lock screen | Delete all data |

What these screens claim, and what the implementation actually supports, is
covered honestly in [privacy-and-security.md](privacy-and-security.md),
including one string on the lock screen that overstates its case.

## Settings

| | | | |
| --- | --- | --- | --- |
| ![Reminders](../screenshots/ios/70-reminders.png) | ![Birth control](../screenshots/ios/71-birth-control.png) | ![Cycle setup](../screenshots/ios/72-cycle-setup.png) | ![Language](../screenshots/ios/73-language.png) |
| Reminders | Birth control | Cycle setup | Language (8 locales) |

## Android

The same product, with platform-native chrome: Material 3 navigation, system
back handling, Android date pickers. The design system is shared; the platform
conventions are not overridden.

Every surface below was captured on Android too: 29 of the 37 published
screens. Compare any pair against the iOS section above.

| | | | |
| --- | --- | --- | --- |
| ![Today](../screenshots/android/10-today.png) | ![Calendar](../screenshots/android/11-calendar.png) | ![Insights](../screenshots/android/12-insights.png) | ![Settings](../screenshots/android/13-settings.png) |
| Today | Calendar | Insights | Settings |
| ![Day detail](../screenshots/android/20-day-detail.png) | ![History](../screenshots/android/21-cycle-history.png) | ![Timeline](../screenshots/android/22-timeline.png) | ![About estimates](../screenshots/android/23-about-estimates.png) |
| Day detail | Cycle history | Private timeline | How estimates work |
| ![Cycle pattern](../screenshots/android/30-cycle-pattern.png) | ![Briefing](../screenshots/android/31-monthly-briefing.png) | ![TTC](../screenshots/android/32-ttc-insights.png) | ![Import](../screenshots/android/40-import-review.png) |
| Cycle pattern | Monthly briefing | Trying to conceive | Import review |
| ![Export](../screenshots/android/50-backup-export.png) | ![Restore](../screenshots/android/51-backup-restore.png) | ![Privacy](../screenshots/android/60-privacy-explainer.png) | ![Lock](../screenshots/android/62-lock-screen.png) |
| Passphrase-encrypted export | Restore | Privacy explainer | Lock screen |
| ![Reminders](../screenshots/android/70-reminders.png) | ![Birth control](../screenshots/android/71-birth-control.png) | ![Cycle setup](../screenshots/android/72-cycle-setup.png) | ![Language](../screenshots/android/73-language.png) |
| Reminders | Birth control | Cycle setup | Language |

Onboarding is absent from the Android set by design: that walk depends on
coordinate taps the Android sweep cannot perform reliably, so it is captured on
iOS only rather than faked. That is the whole of the 37-vs-29 difference: the
eight onboarding steps, and nothing else.

## Retired surfaces

| |
| --- |
| ![Paywall](../screenshots/ios/80-paywall-retired.png) |
| The subscription screen, no longer reachable |

Kept for the record. `/(app)/subscribe` still renders so old deep links resolve,
but nothing in the app routes there on 1.4.0 and no products are purchasable.
