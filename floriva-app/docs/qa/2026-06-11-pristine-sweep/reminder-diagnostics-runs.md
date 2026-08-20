# Reminder Diagnostics Runs

## 2026-06-11

Environment:

```bash
EXPO_PUBLIC_DEV_LAUNCH_PRESET=seeded-tracker
EXPO_PUBLIC_E2E_SCHEDULED_NOTIFICATIONS=1
EXPO_DEV_SERVER_PORT=8082
```

Focused Jest:

```bash
corepack pnpm test -- --runInBand tests/lib/notifications/reminderScheduler.test.ts tests/lib/notifications/scheduledNotificationDiagnostics.test.ts tests/features/settings/SettingsScreen.test.tsx
```

Result: pass, 3 suites, 70 tests.

iOS Detox:

```bash
npx detox test -c ios.sim.debug --cleanup --artifacts-location docs/qa/2026-06-11-pristine-sweep/detox-ios-seeded-reminders-diagnostics-rerun2 e2e/reminder-scheduling.e2e.js
```

Result: pass, 1 suite, 4 tests.

Covered:

- seeded daily-log reminder row is visible
- enabling period-start reflects in the reminder center
- disabling daily-log removes it from the reminder center
- OS scheduled-notification diagnostics contain exactly the expected user reminder set
- OS notification title/body copy avoids reproductive-health terms

Android Detox:

```bash
npx detox test -c android.emu.debug --cleanup --artifacts-location docs/qa/2026-06-11-pristine-sweep/detox-android-seeded-reminders-diagnostics-rerun e2e/reminder-scheduling.e2e.js
```

Result: pass, 1 suite, 4 tests. Detox printed a post-pass Jest open-handle warning, consistent with the app/dev-client process, after all tests had completed successfully.

Covered:

- seeded daily-log reminder row is visible
- enabling period-start reflects in the reminder center
- disabling daily-log removes it from the reminder center
- OS scheduled-notification diagnostics contain exactly the expected user reminder set
- OS notification title/body copy avoids reproductive-health terms

## Notification Quick Actions (C2, 1.2.0) — Manual QA Only

Quick actions (`florivaLog` category: discreet "Quick log" and "Open" buttons
on daily-log and period-start reminders) are registered at runtime via
`Notifications.setNotificationCategoryAsync` — no config-plugin change, no
native rebuild. Automated coverage is limited by platform/tooling
constraints, so this is a **manual QA checklist item**, not a Detox spec:

- **Detox cannot press notification action buttons.** Detox's notification
  helpers can trigger a notification and tap its body, but there is no
  supported API to invoke a registered action button on either platform.
  `resolveNotificationRoute`'s `quick-log-period` branch, the category
  registration module, and the calendar-day pre-selection are covered by
  Jest (`notificationResponseRouting.test.ts`,
  `registerNotificationCategories.test.ts`,
  `CalendarDayScreen.integration.test.tsx`) instead.
- **iOS shows quick actions on long-press only.** A plain tap on a banner or
  lock-screen notification opens the app via the default action ("Open"
  behavior); the "Quick log" / "Open" buttons only appear when the
  notification is long-pressed (or force-touched on older hardware) to reveal
  its action sheet. Manual QA must long-press, not just tap, to see the
  actions.
- **Expo Go on Android cannot display quick actions at all.** Notification
  action buttons require a dev client or a release/production build on
  Android — Expo Go silently drops them. Manual QA on Android must use a dev
  client (`expo run:android` build) or a signed build, not Expo Go.
- **Manual checklist:**
  1. Build a dev client (iOS simulator/device or Android dev client — not
     Expo Go on Android).
  2. Schedule a daily-log or period-start reminder for the near future (or
     seed one via the reminder preferences UI) and background the app.
  3. iOS: long-press the notification banner/lock-screen entry and confirm
     "Quick log" and "Open" both appear with no period/cycle wording visible.
  4. Tap "Quick log": app opens on the calendar-day screen for today with
     medium flow pre-selected on the bleeding chips and no entry saved yet —
     confirm a manual Save tap is still required.
  5. Tap "Open" (or a plain tap): app opens via the existing C1 routing
     (calendar day for daily-log/period-start, `/today` otherwise) with no
     pre-selection.
  6. Repeat 2-5 on Android using a dev client build.

