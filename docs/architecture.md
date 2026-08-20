# Architecture

Floriva is an Expo / React Native app with no backend. 297 product files,
50,485 lines of code, 51 distinct screens, 15 SQLite tables. Everything below is
checkable against a file path in this repository.

This document does not make privacy or security claims. Those live in
[`privacy-and-security.md`](privacy-and-security.md) and are stated there with
their limits attached.

---

## 1. The layering rule

Four layers, with a one-way dependency rule:

```
 ┌──────────────────────────────────────────────────────────────────────┐
 │ app/            Expo Router route tree: 72 files, 1,059 lines        │
 │                 _layout.tsx · (app)/ · (onboarding)/ · lock · modal  │
 │                 Route files are thin: they re-export a screen.       │
 └──────────────────────────────┬───────────────────────────────────────┘
                                │ renders
 ┌──────────────────────────────▼───────────────────────────────────────┐
 │ src/features/   flows, providers, screens, and screen-MODEL builders │
 │                 app-shell · onboarding · billing · import · backup   │
 │                 tracker · calendar · insights · timeline · settings  │
 └────────┬──────────────────────────────────────────┬──────────────────┘
          │ calls                                    │ reads / writes
 ┌────────▼─────────────────────┐        ┌───────────▼──────────────────┐
 │ src/lib/     pure domain      │        │ src/db/   Drizzle + repos    │
 │  predictions/ parsing/        │◄───────┤  schema · contracts          │
 │  notifications/ security/     │        │  repositories · validators   │
 │  diagnostics/ navigation/     │        │  runtimeSchemaRepair         │
 └───────────────────────────────┘        └──────────────────────────────┘
     ▲  3 reverse imports              ▲  2 reverse imports
     └──── src/lib → src/features ─────┴──── src/db → src/features
                                              (see §2: these are real)

 src/theme/  src/components/  src/localization/  src/types/  src/testing/
```

### The boundary that actually holds

The `app/` → `src/lib/` edge is empty, and that is the edge most RN codebases
lose first:

```bash
$ grep -rn "@/src/lib/" app | wc -l
0
$ find app -type f \( -name '*.ts' -o -name '*.tsx' \) | wc -l
72
$ find app -type f \( -name '*.ts' -o -name '*.tsx' \) -exec cat {} + | wc -l
1059
```

72 route files, 1,059 lines, zero domain imports. An average of ~15 lines per
route. Routing is a lookup table, not a place where behaviour accumulates.

### Screen-model builders

The mechanism that keeps screens thin is a set of pure `build*` modules that
compute an entire render model from plain inputs and return a plain object.
Screens receive the object and render it.

Seven such modules, 2,220 lines total
(`find floriva-app/src/features -name 'build*.ts' | xargs wc -l`):

```
935  src/features/insights/buildInsightsScreenModel.ts
520  src/features/calendar/buildCalendarScreenModel.ts
425  src/features/timeline/buildPrivateTimelineModel.ts
120  src/features/tracker/buildTodaySnapshot.ts
101  src/features/settings/buildReminderCenterModel.ts
 68  src/features/calendar/buildDayCellAccessibilityLabel.ts
 51  src/features/tracker/buildQuickLogAction.ts
```

Purity is maintained by threading state in rather than reading it. From
`buildTodaySnapshot.ts:23-30`, on the `dismissedAnomalyIds` parameter:

```ts
  /**
   * `AppPreferences.dismissedAnomalyIds`, threaded in by the caller (this
   * module stays pure/I-O-free, per project rules -- it does not read
   * preferences itself). Defaults to empty so callers that haven't hydrated
   * preferences yet still get a valid snapshot.
   */
  dismissedAnomalyIds?: string[];
```

The practical payoff: the Insights screen's entire content (chart data, copy,
ordering, empty states) is testable by calling a function with a date string
and an array, with no renderer involved.

---

## 2. Where the layering leaks

Five reverse imports exist. They are one grep away, so listing them is cheaper
than pretending otherwise:

`grep -rn "@/src/features" src/lib src/db`:

| Site | Imports |
| --- | --- |
| `src/lib/notifications/notificationResponseRouting.ts:1` | `buildCalendarDayRoute` from `features/app-shell/resolveAppEntry` |
| `src/lib/notifications/reminderScheduler.ts:3` | `buildFirstChargeReminderDate` from `features/billing/model` |
| `src/lib/predictions/buildConfidenceInfoModalContent.ts:34` | type `InfoModalContent` from `features/navigation/infoModal` |
| `src/db/validators.ts:3` | `normalizeBillingSnapshot` from `features/billing/model` |
| `src/db/repositories.ts:43` | `isOnboardingProfileComplete` from `features/app-shell/` |

Three are `src/lib` (domain) reaching up into `src/features`; two are `src/db`
(persistence) doing the same. The `buildConfidenceInfoModalContent` one is
type-only and harmless at runtime. The other four are real: the persistence
layer cannot be compiled without the billing and app-shell feature modules.
The correct fix in each case is to move the shared function down into
`src/lib` or `src/types`. None of them are large.

**Two screens call the prediction engine directly** instead of going through a
model builder, breaking the pattern that holds everywhere else:
`src/features/calendar/screens/CalendarDayScreen.tsx:141` and
`src/features/onboarding/screens/OnboardingCompletionScreen.tsx:57`
(`grep -rn "buildPredictionResult(" src/features`).

**Two route files do data work**, which is where "routes are thin" stops holding.
`grep -rln "useDatabase\|repositories\." app` returns exactly two.

`app/(app)/_layout.tsx` reads `repositories.userProfile.getProfile()` in an
effect, derives an onboarding draft from it, and passes a `JSON.stringify`-built
`key` to force a remount when the draft changes
([`floriva-app/app/(app)/_layout.tsx`](../floriva-app/app/%28app%29/_layout.tsx),
133 lines). It also holds the only raw *hex* colour literal outside the theme
(`const legacyInk = '#201A17'`, line 19). Two `rgba()` scrim constants live
outside the theme too, counted in
[design-system.md](design-system.md#1-tokens) as three hardcoded colour values in
total.

`app/(app)/settings/ttc-expectations.tsx` goes further, and is the worse of the
two: it declares a domain function, `buildUpdatedTtcProfile(currentProfile,
draft)`, which merges an onboarding draft into a persisted `UserProfile` and
adds `'trying-to-conceive'` to the goal list. The route then both **reads and
writes** the database (`getProfile()` followed by `saveProfile(...)`) inside an
`onContinue` handler. A merge rule about which goals a profile ends up with is
domain logic; it belongs in `src/features/onboarding/`, where it would be
testable without a router. It is 50 lines, so the fix is small, but it is the
one route that owns behaviour rather than wiring.

**`SettingsScreen.tsx` is 2,488 lines and exports ten route screens.** This is
the worst file in the codebase:

```
floriva-app/src/features/settings/screens/SettingsScreen.tsx
  :427  SettingsScreen              :1490  SettingsBirthControlScreen
  :705  SettingsLanguageScreen      :1800  SettingsSubscriptionScreen
  :768  SettingsFeedbackScreen      :2042  SettingsDataScreen
  :831  SettingsSoundsScreen        :2130  SettingsDeleteDataScreen
  :921  SettingsPrivacyLockScreen
 :1123  SettingsRemindersScreen
```

It also calls the engine's `collectPeriodStarts` inside a screen effect
(`:527`): the same violation as the two screens above. It grew this way because
each Settings sub-screen was small when added and no single addition justified a
split. The layering rule is only enforced at boundaries someone bothered to
check, and nobody checked this one.

The 24-line comment above that call (`:502-525`) is the interesting artefact. It
records that this screen read a 730-day history window while Today read 365 days
and Calendar read 365 days *anchored to the viewed month*: "three different
read windows on the same underlying history produced three different counts
even with identical counting logic." The fix was to redefine the stat as "total
period starts on record" and have all three surfaces call `listAll()`.

---

## 3. The provider tree

Eight levels deep, from
[`floriva-app/app/_layout.tsx`](../floriva-app/app/_layout.tsx):

```
RootLayout                                          app/_layout.tsx:64
 │  useFonts(11 faces) + 2s FONT_LOAD_TIMEOUT_MS escape hatch      :62-107
 │  renders null until fonts load, error, or the timeout fires     :105-107
 │
 └─ DatabaseProvider                     src/db/DatabaseProvider.tsx (102 L)
    │  owns  florivaDb + the 12 repositories, memoized once        :28-34
    │  gates useMigrations → repairRuntimeSchemaIfNeeded → dev preset
    │  null  until `success && isBootstrapReady`                   :85-87
    │  throws on migration or bootstrap error                      :77-83
    │
    └─ LocalizationProvider              src/localization/… (93 L)
       │  owns  locale preference (8 locales) + translate()
       │
       └─ ThemePreferenceProvider        src/theme/… (24 L)
          │  owns  nothing. Light-only; kept solely so
          │        useThemePreference().isHydrated still gates boot :10-16
          │
          └─ InteractionFeedbackProvider src/features/feedback/… (202 L)
             │  owns  hapticsEnabled, tapSoundEnabled, press feedback
             │
             └─ BootstrappedApp                    app/_layout.tsx:126
                │  hides the splash once BOTH hydration flags are true
                │  null until then                                :137-139
                │
                └─ AppShellProvider      src/features/app-shell/… (440 L)
                   │  owns  onboarding state, lock state, billing access,
                   │        pendingEntryRoute, privacy prefs, relock timer
                   │
                   └─ BillingProvider    src/features/billing/… (1,031 L)
                      ├─ AppShellRouteGuard   renders null; effect only (221 L)
                      └─ RootNavigation → <Stack>
                           index · (onboarding) · (app) · lock · modal
```

Two more providers mount below the root, scoped to their segment:
`OnboardingProvider` (mounted in both `app/(onboarding)/_layout.tsx` and
`app/(app)/_layout.tsx`, so Settings can reuse the onboarding sub-screens for
editing) and `ImportFlowProvider`
([`floriva-app/src/features/import/ImportFlowProvider.tsx`](../floriva-app/src/features/import/ImportFlowProvider.tsx),
368 lines).

The property worth pointing at is that **every level's readiness condition is
explicit and blocking**. `DatabaseProvider` returns `null` until migrations
succeed *and* the runtime repair has run, so no screen can observe a
half-migrated database. `BootstrappedApp` returns `null` until two independent
`isHydrated` flags are true. Nothing races; nothing renders against a
half-populated context and then corrects itself.

`ThemePreferenceProvider` is the honest artefact of that design. It owns no
state at all (Floriva is light-only) but it still exists because
`app/_layout.tsx` gates boot on `useThemePreference().isHydrated`. Its own
comment says so:

```ts
// Floriva is light-only: the stored themePreference row is legacy data that no
// longer drives rendering, so the provider neither reads nor writes it and
// hydration resolves synchronously. It stays a provider (rather than a bare
// constant) so useThemePreference keeps gating boot in app/_layout.tsx.
```

### One component owns every redirect

[`AppShellRouteGuard.tsx`](../floriva-app/src/features/app-shell/AppShellRouteGuard.tsx)
renders `null`. It is a pure effect that reconciles the current pathname against
shell state in a fixed precedence: onboarding incomplete → `/welcome`; locked →
`/lock`; paid gate (now always false) → `/subscribe`; then consume a pending
notification route. Route files contain no guards at all, which is why they
average 15 lines.

---

## 4. The data layer

[`floriva-app/src/db/`](../floriva-app/src/db/): Drizzle ORM over
`expo-sqlite`.

| File | Lines | Role |
| --- | --- | --- |
| `client.ts` | 11 | `openDatabaseSync('floriva.db')`, `PRAGMA foreign_keys = ON`, `drizzle(sqlite, { schema })` |
| `schema.ts` | 341 | 15 tables via `drizzle-orm/sqlite-core` |
| `contracts.ts` | 105 | 12 repository interfaces, composed into `DomainRepositories` |
| `repositories.ts` | 1,354 | the single `createDomainRepositories(db)` factory |
| `validators.ts` | 218 | Zod schemas enforced at the repository boundary |
| `runtimeSchemaRepair.ts` | 85 | see §5 |
| `domainDefaults.ts` | 115 | singleton row ids and default values |

Constraints live in the database, not only in code: child tables
(`user_profile_goals`, `user_profile_conditions`, `daily_log_symptoms`,
`ttc_observations`, `birth_control_events`) declare
`references(…, { onDelete: 'cascade' })` (`schema.ts:128, 148, 200, 220, 239`),
and those cascades are load-bearing, which is why the 11-line `client.ts` turns
on `foreign_keys`. Uniqueness is a real index:
`uniqueIndex('daily_logs_log_date_unique').on(table.logDate)` (`:189`).

### Contracts before implementations

`contracts.ts` declares twelve named interfaces:
`AppPreferencesRepository`, `DailyLogRepository`, `BackupDataRepository`,
`OnboardingRepository`, `LocalDataMaintenanceRepository` and so on, and
`repositories.ts` provides one factory for all of them. Consumers then depend on
the narrowest slice they need:

```ts
// src/features/import/model.ts:20
repositories: Pick<DomainRepositories, 'dailyLogs' | 'importSessions'>;

// src/features/backup/model.ts:14
repositories: Pick<DomainRepositories, 'backupData'> &
  Partial<Pick<DomainRepositories, 'backupEvents'>>;
```

Tests substitute plain object literals. There is no mocking framework anywhere
in the data path.

### Zod as a second, stricter gate

`validators.ts` is not a mirror of the SQL schema: it enforces what SQLite
cannot. `userProfileSchema` bounds `cycleLengthDays` between 1 and 120 and
`periodLengthDays` between 1 and 30 (`:59-60`); arrays must be non-empty and
unique via `.refine(hasUniqueValues)`. Enum values are imported from
[`floriva-app/src/types/domain.ts`](../floriva-app/src/types/domain.ts) (745
lines), so the TypeScript union, the Zod enum and the persisted string cannot
drift apart.

Where Zod was not enough, that is written down too. `isoDateSchema` is only a
regex, so `"2026-13-01"` and `"2026-01-99"` pass it. `repositories.ts:77-105`
adds a second check that re-parses through `Date` and compares year/month/day
back, throwing `Invalid logDate: "…" is not a valid calendar date`, because
persisting a rolled-over date would silently corrupt the cycle timeline.

---

## 5. `runtimeSchemaRepair.ts`: shipping a fix for a migration bug I caused

This is the most instructive file in the repository, because it exists to
clean up a mistake.

Drizzle's SQLite migrator decides what to apply by comparing timestamps. From
the installed `drizzle-orm/sqlite-core/dialect.js`:

```js
sql`SELECT id, hash, created_at FROM ${sql.identifier(migrationsTable)} ORDER BY created_at DESC LIMIT 1`
...
for (const migration of migrations) {
  if (!lastDbMigration || Number(lastDbMigration[2]) < migration.folderMillis) {
```

It reads **one** row (the newest applied `created_at`) and applies every
migration whose `folderMillis` exceeds it. That is a monotonicity assumption
about `drizzle/meta/_journal.json`.

Floriva's journal violates it. Walking the entries and tracking the running
maximum:

```
idx 10  1778544000000  0010_phase13_native_store_billing
idx 11  1776336000000  0011_phase14_interaction_feedback      <-- below the max
idx 12  1776422400000  0012_phase15_tailoring_checklist       <-- below the max
idx 13  1778076000000  0013_fertility_estimates_preference    <-- below the max
idx 14  1778630400000  0014_floriva_plus_timeline
```

The `when` values were hand-edited at some point, and idx 10 got a timestamp
about 25 days ahead of the three entries that follow it. Consequence: **any
install that had already applied 0010 would silently skip 0011, 0012 and 0013**
and then keep migrating normally from 0014. No error, no warning: the migrator
simply never considered them. Those three migrations add `haptics_enabled`,
`tap_sound_enabled` and `show_fertility_estimates` to `app_preferences`, so
every subsequent read of that table would throw on a device that had shipped
0010. A fresh install is fine; devices in the field are not.

Renumbering the journal does not help, because the broken installs already
exist and their `__drizzle_migrations` table already records a `created_at` past
the three skipped entries.

[`runtimeSchemaRepair.ts`](../floriva-app/src/db/runtimeSchemaRepair.ts) is the
answer: 85 lines, six idempotent add-column-only steps, run after migrations
succeed (`DatabaseProvider.tsx:45`).

```ts
// Idempotent add-only repairs that reconcile a device's on-disk schema with
// columns introduced by migrations that may have been silently skipped (the
// journal's hand-authored, out-of-order `when` timestamps can leave some
// migrations un-applied on some installs). Add-column only -- never
// destructive. A step whose table is absent is skipped (a fresh DB will have
// the column created by the migration itself).
```

Each step names a table, a column, and one `ALTER TABLE … ADD`. Existing columns
are read once per table from `pragma_table_info` and memoized in a `Map`; a
table reporting zero columns means a fresh database, so the step is skipped
rather than run. Nothing is dropped, nothing is rewritten, and running it twice
is a no-op, which is what makes it safe to run unconditionally at every boot.
The diagnosis required reading the ORM's own source rather than trusting the
abstraction.

There is a dedicated adversarial test
(`floriva-app/tests/db/runtimeSchemaRepair.adversarial.test.ts`) and a manifest
test (`floriva-app/tests/db/migrationsManifest.test.ts`). 20 migrations ship in
[`floriva-app/drizzle/`](../floriva-app/drizzle/).

---

## 6. Notifications: scheduling recurring events with no backend

[`floriva-app/src/lib/notifications/`](../floriva-app/src/lib/notifications/):
five files.
[`buildReminderPlans.ts`](../floriva-app/src/lib/notifications/buildReminderPlans.ts)
is a pure function from `{todayIso, profile, logEntries, preferences, locale}` to
`ReminderPlan[]`. It runs the prediction engine internally so reminders track
the same dates the UI shows.

The constraint: daily reminders can use an OS repeating trigger, but
cycle-event reminders (period start, fertile window) have dates that move as the
user logs. `expo-notifications` has no recurring-computed-date primitive, and
there is no server to push from. A single DATE trigger fires once and then goes
silent: exactly the lapsed user a re-engagement reminder is meant to reach.

The answer is to pre-schedule a horizon of future occurrences. iOS caps pending
local notifications at 64, so the comment at `buildReminderPlans.ts:28-50` does
the budget arithmetic against that cap before picking a number:

```
//   - 2 daily-cadence kinds (daily-log, birth-control) -> 1 pending
//     notification each (OS DAILY trigger repeats without rescheduling) = 2
//   - 2 cycle-event kinds (period-start, fertile-window) -> up to
//     REMINDER_OCCURRENCE_HORIZON pending DATE triggers each
//   - 1 optional billing reminder (reminder-first-charge, scheduled
//     separately by reconcileBillingReminderNotification) = 1
//   Total with horizon=3: 2 + 2*3 + 1 = 9, far under the 64-notification
//   cap ... Horizon could grow to ~30 per cycle-event kind before
//   approaching the cap, so 3 has generous headroom for a future increase.
export const REMINDER_OCCURRENCE_HORIZON = 3;
```

[`reminderScheduler.ts`](../floriva-app/src/lib/notifications/reminderScheduler.ts)
reconciles by cancel-then-reschedule, deriving its cancellation list from the
current horizon rather than hardcoding it, and records the one way this can go
wrong later: if the horizon is ever *shrunk*, occurrences scheduled by an older
app version beyond the new horizon are not in the cancellation list and fire as
orphans. Two fixes are suggested in the comment (a `MAX_EVER_HORIZON` constant,
or a one-time cancel-all migration). A final filter drops DATE triggers landing
today at an already-elapsed hour, because the builder works in whole days and
cannot know wall-clock time; Expo would otherwise fire them immediately.

Tap routing
([`notificationResponseRouting.ts`](../floriva-app/src/lib/notifications/notificationResponseRouting.ts))
is pure and honest about its dispatch key: scheduled content carries only
`{title, body}` and no `data` payload, so routing dispatches on
`request.identifier`, stripping the `#n` occurrence suffix so occurrence 3
routes like occurrence 1.

---

## 7. What the layering bought: retiring the paywall

Floriva shipped as a paid app. `resolvePaidAccessGate(state)` was a full-app
lock: a user who had finished onboarding without paid access was redirected to
`/subscribe` from anywhere in the app.

When the company closed and all products were pulled from sale, that gate had to
go. Otherwise existing users would be stranded in front of their own on-device
data behind a paywall with nothing purchasable behind it.

The entire product-code change is visible in `git show 163477ce`. The gate
itself:

```diff
-export function resolvePaidAccessGate(state: AppShellState): boolean {
-  if (!state.hasCompletedOnboarding) {
-    return false;
-  }
-  return state.billingAccessState === 'needs_purchase' || state.billingAccessState === 'expired';
+export function resolvePaidAccessGate(_state: AppShellState): boolean {
+  return false;
 }
```

Across all of `floriva-app/src/`, the retirement was **58 lines added and 64
removed, in seven files**
(`git show 163477ce --numstat | awk '$3 ~ /src\// {a+=$1;d+=$2} END{print a,d}'`).
The rest of the 33-file commit is version bumps, release notes and tests: one
test file alone, `AppShellRouteGuard.test.tsx`, lost 127 lines, because the
gate's test surface went with it.

The predicate was deliberately kept rather than deleted at each call site
([`resolvePaidAccessGate.ts:12-14`](../floriva-app/src/features/app-shell/resolvePaidAccessGate.ts)):
"retained (rather than deleted at every call site) so the routing contract in
`resolveAppEntry` and `AppShellRouteGuard` stays intact and this decision lives
in exactly one place." So `AppShellRouteGuard.tsx:196` still reads
`resolvePaidAccessGate(state) && !isAllowedWhileLockedPath(pathname)`: the
branch is intact and dead, and reversing the decision means changing one
`return`.

This is the concrete argument for the layering rule. A business decision that
touched routing, onboarding order, and the settings surface came down to one
predicate *because the gate had been isolated into a pure function in the first
place*. Had that logic been inlined across the route guard, the app entry
resolver, and three onboarding flow orders, the same change would have been a
multi-day audit.

---

## 8. Known weaknesses

1. **Five reverse imports** (§2). `src/db` cannot compile without
   `src/features/billing` and `src/features/app-shell`. Fix: move
   `normalizeBillingSnapshot` and `isOnboardingProfileComplete` down into
   `src/lib`.
2. **`SettingsScreen.tsx`, 2,488 lines, ten route screens, one engine call in a
   screen effect.** Should be ten files. Nothing prevented it except that no
   single addition was large enough to force the split.
3. **Two screens bypass the model-builder pattern** (`CalendarDayScreen.tsx:141`,
   `OnboardingCompletionScreen.tsx:57`), so their render logic is only testable
   through a renderer.
4. **Two route files touch the database.** `app/(app)/_layout.tsx` reads it, and
   `app/(app)/settings/ttc-expectations.tsx` both reads and writes it while
   declaring a profile-merge function inline: the two places the "routes are
   thin" rule does not hold.
5. **The `_journal.json` timestamps are still out of order** (§5). The runtime
   repair heals the symptom; the journal itself was never renumbered, because
   doing so would invalidate the hashes recorded on every device already in the
   field. The repair table is therefore permanent, and any future migration
   adding a column to `app_preferences`, `user_profile` or `billing_snapshot`
   needs a matching repair step.
6. **`BillingProvider.tsx` is 1,031 lines** and remains mounted at the root even
   though the gate it fed is retired.
