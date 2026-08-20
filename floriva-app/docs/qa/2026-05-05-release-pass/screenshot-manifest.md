# Screenshot Manifest

Date: 2026-05-05

Expected quota: 23 product screenshots per OS, 46 total.

Original result: quota not met. No product UI screenshots were captured on either OS because both platforms were blocked before the first Floriva screen.

Fix-verification result: both platforms now reach product UI, but the full quota is still not met. This file continues to track the required 23-per-OS release-pass matrix.

## iOS Product Screenshot Matrix

| # | Required screen/state | Status |
|---:|---|---|
| 1 | Onboarding welcome | Captured - `fix-verification/ios/screenshots/001-ios-first-floriva-screen.png` |
| 2 | Privacy details / privacy policy modal | Captured - `fix-verification/ios/screenshots/002-ios-privacy-policy-modal-top.png` |
| 3 | Start path | Captured - `fix-verification/ios/screenshots/003-ios-start-path-selector.png` |
| 4 | Fresh setup: last period start | Captured - `fix-verification/ios/screenshots/004-ios-last-period-start.png` |
| 5 | Fresh setup: cycle length | Captured - `fix-verification/ios/screenshots/005-ios-cycle-length.png` |
| 6 | Fresh setup: period length | Missing - needs full rerun |
| 7 | Fresh setup: cycle variability | Missing - needs full rerun |
| 8 | Fresh setup: symptom logging | Missing - needs full rerun |
| 9 | TTC decision / TTC setup | Missing - needs full rerun |
| 10 | Paywall / purchase actions | Missing - needs full rerun |
| 11 | Completion / setup later | Missing - needs full rerun |
| 12 | Today tab, top state | Missing - needs full rerun |
| 13 | Today logging, scrolled controls | Missing - needs full rerun |
| 14 | Calendar month view | Missing - needs full rerun |
| 15 | Calendar day/history/about estimates | Missing - needs full rerun |
| 16 | Insights tab, top state | Missing - needs full rerun |
| 17 | Insights detail screens | Missing - needs full rerun |
| 18 | Settings tab, top state | Missing - needs full rerun |
| 19 | Settings: reminders / privacy lock | Missing - needs full rerun |
| 20 | Settings: cycle/tracking/TTC setup | Missing - needs full rerun |
| 21 | Subscription / manage / restore / refresh | Missing - needs full rerun |
| 22 | Data portability: import / backup / restore | Missing - needs full rerun |
| 23 | Delete data / lock / feedback / language edge states | Missing - needs full rerun |

Captured blocker screenshots: 0.

## Android Product Screenshot Matrix

| # | Required screen/state | Status |
|---:|---|---|
| 1 | Onboarding welcome | Captured - `fix-verification/android/screenshots/003-android-welcome-product-screen.png` |
| 2 | Privacy details / privacy policy modal | Missing - needs full rerun |
| 3 | Start path | Captured - `fix-verification/android/screenshots/004-android-start-path-selector.png` |
| 4 | Fresh setup: last period start | Missing - needs full rerun |
| 5 | Fresh setup: cycle length | Missing - needs full rerun |
| 6 | Fresh setup: period length | Missing - needs full rerun |
| 7 | Fresh setup: cycle variability | Missing - needs full rerun |
| 8 | Fresh setup: symptom logging | Missing - needs full rerun |
| 9 | TTC decision / TTC setup | Missing - needs full rerun |
| 10 | Paywall / purchase actions | Missing - needs full rerun |
| 11 | Completion / setup later | Missing - needs full rerun |
| 12 | Today tab, top state | Missing - needs full rerun |
| 13 | Today logging, scrolled controls | Missing - needs full rerun |
| 14 | Calendar month view | Missing - needs full rerun |
| 15 | Calendar day/history/about estimates | Missing - needs full rerun |
| 16 | Insights tab, top state | Missing - needs full rerun |
| 17 | Insights detail screens | Missing - needs full rerun |
| 18 | Settings tab, top state | Missing - needs full rerun |
| 19 | Settings: reminders / privacy lock | Missing - needs full rerun |
| 20 | Settings: cycle/tracking/TTC setup | Missing - needs full rerun |
| 21 | Subscription / manage / restore / refresh | Missing - needs full rerun |
| 22 | Data portability: import / backup / restore | Missing - needs full rerun |
| 23 | Delete data / lock / feedback / language edge states | Missing - needs full rerun |

Captured blocker screenshots:

| File | What it shows |
|---|---|
| `android/screenshots/001-launch.png` | Android resolver sheet for Floriva deep link |
| `android/screenshots/002-after-link-always.png` | Bundle loading screen |
| `android/screenshots/003-after-bundle-wait.png` | Dev-launcher project load error |
| `android/screenshots/004-after-metro-repair-reload.png` | Error screen plus Android not-responding dialog |
| `android/screenshots/005-fresh-metro-retry.png` | Fresh Metro retry still failing |
| `android/screenshots/006-symlink-retry.png` | Final symlink repair retry still failing |
