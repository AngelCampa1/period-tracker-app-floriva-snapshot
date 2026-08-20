# Floriva full-product audit and recovery strategy

**Audit date:** 2026-07-30

**Scope:** Native app, user experience, accessibility, privacy and security claims, billing, release operations, website, store presence, localization, support, analytics, legal-readiness, repository health, and local delivery controls.

**Decision:** Pause new claims and non-essential feature work. Correct the public trust breach first, then make reminders, billing, privacy, accessibility, and release evidence truthful and repeatable.

## Read this first

Floriva's underlying product is much stronger than its public and operational surfaces suggest. The shipped architecture is accountless, offline-capable, free of reproductive-health analytics, and has no Floriva cloud-sync backend. The technical audit did, however, find meaningful gaps beneath the local-first promise: iOS can include the live database in OS backup without Floriva-controlled application-layer encryption, Android migration is disabled, biometric lock is a screen gate rather than encryption, sensitive state hydrates before unlock, and delete-all does not demonstrate secure erasure.

The audit found one immediate P0:

- Floriva publicly claims optional encrypted or zero-knowledge cloud sync even though the product has no sync backend. The same content ecosystem also claims encrypted local storage, while the application opens an ordinary SQLite database and encrypts only user-created backup packages. Absolute "No cloud" language is also too broad while the OS can back up app data; the truthful distinction is that Floriva operates no cloud, account, or sync service.

The next material release should not proceed until every P1 is fixed and verified, or carries an explicit founder-approved exception with a bounded mitigation, owner, and expiry. Ownership alone is insufficient. GitHub Actions must remain off: Floriva's canonical verification path should be a single documented local command with retained evidence.

Every item in the confirmed register was reproduced in source, current local gates, live public surfaces, or release evidence. Plausible concerns that could not be reproduced are separated under **Evidence gaps**, not presented as defects.

## Approved decision — backup and device migration

**Status:** Approved by the founder on 2026-07-30. Privacy threshold confirmed as **privacy-strict** on 2026-07-30.

**Privacy posture:** Prefer verified direct device-to-device transfer. Allow cloud backup and restore only after explicit Floriva consent and only when Floriva can enforce the required end-to-end or client-side protection for both encrypted app data and its recovery material. Disclosure alone is insufficient.

Floriva will use a dual-path recovery model without operating an account, server, or sync service:

1. **Primary path — platform-native migration**
   - Encrypt the live Floriva database at the application layer.
   - Use a platform-specific key hierarchy whose required recovery material can move only through a supported, protected same-platform migration path.
   - Prefer direct device-to-device transfer where Floriva can verify and enforce acceptable protection for both app data and recovery material.
   - Keep Floriva data excluded from cloud backup by default. A general operating-system backup setting is not sufficient consent; the user must explicitly enable protected cloud migration under Floriva Data Controls.
   - Permit cloud backup and restore only where platform controls let Floriva prevent sensitive data or recovery material from entering or restoring through a path without the required end-to-end or client-side protection.
   - If Floriva cannot enforce that boundary, exclude sensitive data and recovery material from that cloud path; direct transfer or a previously created `.floriva` export becomes the recovery route.
   - Evaluate Apple Quick Start, iCloud restore, Android device-to-device transfer, and Android cloud restore separately. No transport is supported merely because the operating system offers it.
   - Keep supported same-platform migration inside the operating system's normal new-phone setup; users should not need to manage a file or passphrase for that path.

2. **Advanced path — user-controlled encrypted export**
   - Keep the existing passphrase-encrypted `.floriva` export.
   - Position it under Data Controls as an optional cross-platform, offline-archive, or migration-failure escape hatch.
   - Do not require it, promote it during onboarding, or add recurring backup reminders.
   - Floriva cannot recover a forgotten export passphrase.

This decision does not authorize Floriva-operated cloud storage, accounts, automatic Floriva sync, or key escrow. Until live-database encryption and migration verification ship, public copy must describe current behavior rather than the approved future design.

Floriva does not control Apple’s or Google’s backup encryption, end-to-end-encryption mode, or provider access. Those properties can vary by platform, transport, account configuration, and user security settings. The privacy-strict policy is to make cloud backup and restore eligible only after explicit in-app consent and only where the required protection can be verified and enforced before upload. A documented user setting does not qualify a path unless Floriva can prevent fallback to a weaker mode. If that is not technically enforceable, the path remains unsupported and Floriva data must be excluded from it. Floriva must fail closed when the protection state is unavailable or below the threshold and must never describe platform migration as Floriva zero knowledge.

The product decision is fixed; the platform-specific key hierarchy still requires an engineering spike before implementation. Do not assume hardware-backed or biometric-gated keys migrate. The spike must separately prove iOS and Android key availability after supported restores and keep device-local biometric unlock distinct from migration recovery. If required key material is absent, the app must fail closed, offer advanced restore only when the user has a valid `.floriva` export, and explain when the data is unrecoverable. Orphaned ciphertext must remain local unless the user explicitly deletes it; support may diagnose only its technical state and cannot decrypt or independently recover it. The app must never silently reset or overwrite it.

This approval records the product architecture, not an automatic next-release commitment for the full encryption and migration project. Before the next material release, Floriva must complete the platform spike, correct current-behavior copy, gate sensitive pre-unlock hydration, and mask app-switcher snapshots. The encryption and native-migration implementation should ship as a dedicated, separately scoped release after its design and failure modes are proven.

The implementation scope includes every sensitive persisted artifact, not only the main database: database journal/WAL/SHM files, temporary import and export files, generated files, attachments if introduced, and other caches or artifacts identified by a retained inventory. Each item must be encrypted by Floriva or explicitly excluded from migration and backup before broad “encrypted app data” copy is allowed.

This privacy posture deliberately accepts that data can be permanently unrecoverable when the old device is lost or destroyed, no supported protected migration path is available, and the user did not previously create a valid `.floriva` export. Floriva must explain that outcome honestly and must not weaken the protection threshold to make a restore succeed.

**Approved positioning after shipment:**

> Floriva has no account or Floriva-operated cloud. Floriva encrypts its stored data at the application layer. Supported direct device transfers use migration protections Floriva has verified. Protected cloud backup and restore require your explicit Floriva consent and are available only where the required protection can be enforced. You can also create a passphrase-protected recovery file if you choose.

**Required verification before the dedicated release:**

- iOS Quick Start as a separately verified direct-transfer path;
- explicit Floriva Data Controls opt-in before any sensitive data or recovery material becomes cloud-eligible, plus tested opt-out and disclosure behavior;
- iCloud backup and restore only if Floriva can enforce the approved protection boundary before upload, otherwise retained negative evidence that sensitive data and recovery material never enter that path;
- proof that excluding an ineligible cloud path does not silently disable or weaken the separately qualified direct-transfer path; redesign if the platform controls are inseparable;
- Android device-to-device migration as the preferred path, tested across supported Android and OEM variants;
- Android cloud backup and restore with enforced client-side-encryption requirements and negative tests proving no upload or restoration through an ineligible path;
- same-platform key-hierarchy and recovery-material availability;
- Android recovery-material rewrapping under a new device Keystore key, if that design survives the spike;
- interrupted plaintext-to-encrypted database migration and rollback;
- database, WAL, and SHM consistency throughout migration;
- complete sensitive-artifact inventory, with each item encrypted or excluded;
- Android Auto Backup size limits;
- restore without required recovery material, including valid-export, missing-export, and partial-restore cases, with a clear error, preserved encrypted artifacts, and no silent wipe;
- upgrade compatibility; and
- advanced `.floriva` restore across iOS and Android.

## Severity and evidence rules

| Level | Meaning | Required response |
| --- | --- | --- |
| P0 | Active trust, safety, or business integrity breach | Stop the affected activity and correct within 48 hours |
| P1 | Major failure in a core job or release assurance | Resolve before the next material release |
| P2 | Meaningful quality, operations, or maintainability risk | Schedule into the next two hardening cycles |
| P3 | Low-risk polish or optimization | Fix opportunistically after higher priorities |

Evidence labels:

- **Confirmed** means the failure or contradiction is observable now.
- **Confirmed gap** means a required assurance artifact or operating control is demonstrably absent; it does not assert an unobserved runtime failure.
- **Rejected** means the audit investigated the concern and found current evidence against it.

## Audit method

Three independent agents attacked different failure classes in parallel:

- product experience, accessibility, localization, onboarding, and critical journeys;
- privacy, security, storage, billing, imports, predictions, diagnostics, and dependencies;
- website, store, content, pricing, support, policy, release operations, metrics, and continuity.

The lead pass then reproduced or cross-checked reported findings against source, local commands, live public surfaces, GitHub configuration/history, and existing release evidence. A separate review agent challenged this document before merge. The register intentionally consolidates shared root causes instead of counting the same defect once per surface.

All repository evidence paths below are relative to the repository root.

## Executive scorecard

| Dimension | Current state | Primary reason |
| --- | --- | --- |
| Core privacy architecture | At risk | No Floriva sync or telemetry, but iOS backup lacks Floriva-controlled application-layer encryption, Android migration is disabled, and storage, pre-unlock hydration, snapshot, and erasure gaps remain |
| Public trust accuracy | Critical | Live web content repeatedly invents sync and encryption capabilities |
| Core user jobs | At risk | Reminder onboarding can record success without permission or schedules |
| Billing integrity | At risk | "One-time" Lifetime trial is locally resettable; native transaction matrix is incomplete |
| Accessibility | At risk | Several confirmed semantics failures and no completed release device matrix |
| Localization | At risk | Eight locales exist, but important production journeys remain partly English |
| Release discipline | At risk | Native billing/device evidence and authenticated rollout controls are not demonstrated |
| Engineering gates | Mixed | App gates are green; marketing typecheck is red; no single canonical local gate |
| Store readiness | Mixed | Listings and creative are largely strong; evidence and metadata have gaps |
| Operations and continuity | At risk | Support identity, KPI loop, policy ownership, and continuity controls are fragmented |

## Triage at a glance

| Priority | Count | Outcome |
| --- | ---: | --- |
| P0 confirmed | 1 | Correct public capability claims across the entire site |
| P1 confirmed | 17 | Includes one confirmed assurance gap: secure erasure is not yet demonstrated |
| P2 confirmed | 18 | Consolidate local CI, validation, diagnostics, support, store copy, dependencies, semantics, recovery, metrics, terms, and continuity |
| P3 confirmed | 0 | No standalone polish issue survived confirmation |
| Confirmed evidence gaps | 5 | Run device, linguistic, and store-console verification before claiming coverage |

## The strategy

### Phase 0 — Contain the trust breach in 0–48 hours

1. Freeze generated health and comparison publishing. `MED-001`
2. Remove all claims of cloud sync, cross-device sync, zero-knowledge infrastructure, encrypted transmission to Floriva, and encrypted local database storage. `TRUST-001`
3. Correct the homepage, privacy policy, structured metadata, and every affected generated page. `TRUST-001`, `PRIV-001`
4. State only what exists:
   - data is stored on the device;
   - no account is required;
   - the app works offline;
   - user-created backup packages are encrypted;
   - biometric lock is an app-access gate, not database encryption.
5. Until live-database encryption and migration verification ship, explain current OS-backup behavior instead of claiming encrypted migration or making an absolute "No cloud" promise. `SEC-001`
6. Deploy and re-crawl the full sitemap. The phase is complete only when banned-claim scans return zero and a human checks every high-traffic template.

### Phase 1 — Restore product truth before the next release

1. Complete the platform key-hierarchy spike and correct current-behavior copy; gate sensitive hydration until unlock and add verified app-switcher masking. Scope live-database encryption and native migration as a dedicated follow-on release. `SEC-001`, `SEC-002`, `SEC-003`, `RECOV-001`
2. Measure and implement tested secure erasure; make imports atomic or durably resumable. `SEC-004`, `DATA-001`
3. Fix invalid-history prediction fallback and the reminder permission/scheduling state machine. `PRED-001`, `PROD-001`
4. Decide the Lifetime trial model. The clean local-first choice is to remove the app-managed Lifetime trial and retain store-managed subscription trials. `BILL-001`
5. Correct save-offer entitlement handling and prevent notification side effects from delaying paid access. `BILL-003`, `BILL-004`
6. Consolidate the app privacy disclosure and website privacy disclosure around one capability source; complete medical review. `PRIV-001`, `MED-001`
7. Complete the native transaction, physical-device, and authenticated store-console matrices. Define store-vitals/support observation and pause thresholds without adding reproductive telemetry. `GAP-004`, `GAP-005`
8. Add semantic async status, a Notes field label, compliant touch targets, and exclusive-choice/navigation semantics. `A11Y-001`, `A11Y-002`, `A11Y-003`, `A11Y-004`, `A11Y-005`
9. Complete the hardcoded-string migration across onboarding, settings, privacy, billing, and scheduled notifications. `I18N-001`
10. Fix marketing typecheck and establish the complete local release gate before accepting another material build. `ENG-001`
11. Route production support to `support@floriva.app` and pass a delivery/reply test. `SUPPORT-001`

### Phase 2 — Make local release assurance repeatable within 30 days

1. Remove or disable both GitHub Actions workflow files so pushes and pull requests do not schedule hosted jobs. `DEV-001`
2. Add one repository-level local verification entry point covering:
   - app lint, typecheck, import tests, 95%-per-file coverage, and release preflight;
   - marketing lint, typecheck, tests, production build, and asset validation;
   - dependency audit with an explicit reviewed-exceptions file;
   - generated store-copy freshness and banned public-claim checks.
3. Require a reviewed dependency audit with zero unreviewed critical or runtime-reachable findings; every exception needs an owner and expiry. `DEP-001`
4. Fix asynchronous test warning hygiene. `TEST-001`
5. Harden import size/date validation, diagnostics truth, and biometric failure rollback. `IMPORT-001`, `DATA-002`, `DIAG-001`, `SEC-005`
6. Correct catalog-outage pricing and declare App Store accessibility metadata only after the screen-reader, tooltip, Dynamic Type, and physical iOS 26 evidence passes. `BILL-002`, `STORE-003`, `GAP-001`, `GAP-002`, `GAP-003`
7. Retain a dated local verification record for every release candidate, including commands, toolchain versions, pass/fail status, and explicitly blocked device checks. `ENG-001`
8. Use Apple phased release and Play staged rollout for material builds. Define pause and hotfix thresholds before submission. `GAP-004`

### Phase 3 — Build a privacy-safe operating system within 60–90 days

1. Run native-speaker truth review for all eight locales. `STORE-002`
2. Deliver the approved privacy-strict database-encryption and platform-migration project as a dedicated release: qualified direct transfer first; cloud backup and restore only after explicit Floriva consent and above the verified protection threshold; `.floriva` fallback otherwise. Keep encrypted export de-emphasized and run regular migration/restore drills. Do not add onboarding prompts or recurring backup reminders. `RECOV-001`
3. Establish a weekly aggregate scorecard from store and website operational data without collecting reproductive events. `OPS-001`
4. Replace stale store handoffs with generated artifacts from one source. `STORE-001`
5. Establish ongoing support/privacy ownership and escalation continuity; obtain focused review of health claims, privacy, website terms, and consumer-health applicability. `SUPPORT-001`, `LEGAL-001`
6. Create an ownership and continuity inventory for store accounts, payout/tax profiles, signing keys, domain/email renewal, policy ownership, subscriptions, and emergency access. `CONT-001`

## Confirmed issue register

### P0 — act now

| ID | Finding | Evidence | Fix and done condition | Effort |
| --- | --- | --- | --- | --- |
| TRUST-001 | **Public capability claims describe cloud sync and encrypted local storage that do not exist.** Live homepage metadata, privacy copy, and multiple generated articles claim optional encrypted/zero-knowledge sync. Repository ground truth says there is no backend; `floriva-app/src/db/client.ts` opens ordinary SQLite, while AES-GCM/PBKDF2 is limited to backup packages. Store copy accurately denies Floriva sync, but absolute "No cloud" wording still needs OS-backup qualification under SEC-001. | Live `/`, `/privacy`, comparison and condition pages; repository `.claude/sync-correction-brief.md`; repository `.claude/copy-audit-factsheet.md`; `floriva-app/src/db/client.ts`; `floriva-app/src/features/backup/backupPackage.ts` | Correct every public surface and structured field; deploy; retain the URL inventory, pattern set, scan output, and timestamp showing zero banned claims; add a build-breaking capability-claim test sourced from one machine-readable facts file. | M |

### P1 — resolve before the next material release

| ID | Finding | Evidence | Fix and done condition | Effort |
| --- | --- | --- | --- | --- |
| PROD-001 | **Reminder onboarding can falsely report success and fail to schedule reminders.** Permission denial returns `false`, but onboarding ignores the value, enables preferences, and advances; onboarding completion does not reconcile schedules. | `floriva-app/src/features/onboarding/screens/NotificationsScreen.tsx:53`; `floriva-app/src/lib/notifications/reminderScheduler.ts:87`; `floriva-app/src/features/app-shell/AppShellProvider.tsx:338` | Persist enabled state only after grant, show denial recovery, reconcile after profile commit, and pass denial/grant/scheduling-failure/native-schedule tests. | M |
| BILL-001 | **The "one-time" Lifetime trial is locally resettable.** Eligibility is a local timestamp deleted by delete-all and reinstall; starting it creates no store transaction. | `floriva-app/src/features/billing/lifetimeTrial.ts:40`; `floriva-app/src/features/billing/BillingProvider.tsx:763`; `floriva-app/src/db/repositories.ts:706` | Remove the app-managed Lifetime trial or back eligibility with a durable store/account entitlement. Test delete-all and reinstall behavior. | M |
| PRIV-001 | **Privacy disclosures are contradictory and incomplete.** Live policy contains false sync behavior; in-app copy says accounts/cloud are "off by default," implying optional features; no single reviewed disclosure covers operator, effective date, support/rights process, diagnostics, billing, backup, deletion, and retention. | Live `/privacy`; `floriva-app/src/features/privacy/copy.ts:1`; `floriva-app/src/features/privacy/components/PrivacyPolicyModal.tsx:19` | Publish one app policy and a separate website policy generated from product facts; each has a version, effective date, accountable approver, explicit privacy/legal sign-off, and no capability ambiguity. Disclose that Apple or Google may process protected backup/migration data, distinguish that path from Floriva sync, and identify `.floriva` exports as user-controlled files. | M |
| SEC-001 | **Current OS-backup behavior is not disclosed and the replacement migration design is not yet proven.** iOS can include Floriva's database in OS backup without Floriva-controlled application-layer encryption, while Android backup is disabled. Neither same-platform migration path has retained security/restore evidence. | `floriva-app/src/db/client.ts:6`; native backup configuration; store copy | Before the next material release, accurately disclose current behavior and complete the platform-specific key-hierarchy spike. Do not claim or enable the future encrypted migration path until the dedicated `RECOV-001` release passes its retained migration matrices. | M |
| SEC-002 | **Biometric lock is a UI gate, not data-at-rest protection, and sensitive state is read before lock determination.** SecureStore holds a marker, not a database key. Copy saying "Your data was not read" is therefore false. | `floriva-app/src/db/client.ts:6`; `floriva-app/src/lib/security/biometricLock.ts:41`; `floriva-app/src/features/app-shell/AppShellProvider.tsx:111`; `floriva-app/src/localization/messages/privacy.ts:73`; `floriva-app/src/db/repositories.ts:206` | Before the next material release, delay sensitive hydration until unlock, describe biometrics only as an app-screen lock, and remove the false copy. Implement and verify data-at-rest encryption under the dedicated `RECOV-001` release. | M |
| SEC-003 | **Sensitive screens can remain visible in app-switcher snapshots.** Background handling records time and later relocks but immediately applies no privacy cover or capture policy. | `floriva-app/src/features/app-shell/AppShellProvider.tsx:272`; repository/native configuration search | Cover the app on inactive/background before capture, evaluate Android `FLAG_SECURE`, and retain iOS/Android app-switcher screenshots proving no reproductive data is visible. | M |
| SEC-004 | **Confirmed assurance gap: secure erasure is not demonstrated.** Delete-all performs logical table deletes, but the code has no explicit secure-delete/checkpoint/vacuum or database recreation procedure. Runtime SQLite defaults and raw-file remanence have not yet been measured; this row does not claim that remnants are recoverable. | `floriva-app/src/db/repositories.ts:706,1190`; deletion copy in `floriva-app/src/localization/messages/settings.ts:663`; implementation search | Query the runtime `secure_delete` and journal modes, then inspect database/WAL/SHM after deletion. If values remain, close/delete/recreate the database or implement a verified secure-delete/checkpoint/truncate/vacuum procedure. | M |
| DATA-001 | **Import commit is not atomic across the entire operation.** Rows are saved in separate transactions and failure cleanup is compensating deletion; process death can leave a partial import affecting predictions/reminders. | `floriva-app/src/features/import/model.ts:239`; `floriva-app/src/db/repositories.ts:983` | Use one repository transaction from session creation through completion, or a durable resumable journal; pass injected-failure and process-death recovery tests. | M |
| BILL-003 | **Save-offer redemption records success before entitlement verification.** iOS sheet presentation is treated as redemption; Android returned purchases are discarded and not finished. Failed/dismissed offers can be permanently suppressed, and Play purchases can be revoked or redelivered. | `floriva-app/src/features/billing/saveOffer/redeem.ts:12`; `floriva-app/src/features/billing/BillingProvider.tsx:879,908`; `floriva-app/src/features/billing/saveOffer/model.ts:23` | Mark redemption only after entitlement refresh verifies it; capture, verify, and finish Android purchases; pass dismissal/failure/success/relaunch sandbox tests. | M |
| BILL-004 | **Notification reconciliation failure can leave a paid user visually paywalled.** Billing is persisted, then notification work is awaited before in-memory access updates. | `floriva-app/src/features/billing/BillingProvider.tsx:302`; `floriva-app/src/lib/notifications/reminderScheduler.ts:113` | Commit entitlement and UI first; run notification reconciliation as a separately reported best-effort side effect; pass failure-injection tests. | S |
| PRED-001 | **Rejected cycle history is reused to create implausible predictions.** When all 15–90-day interval candidates are rejected, the fallback averages those same invalid intervals; year-apart starts can produce a roughly 365-day estimate. | `floriva-app/src/lib/predictions/cycleHistory.ts:86` | Fall back to validated profile/default length, surface low confidence, and pass sparse/imported/year-apart regression fixtures across all prediction consumers. | S |
| MED-001 | **Public condition content makes unsupported clinical-effectiveness claims.** An endometriosis guide says Floriva can accelerate investigation, change clinical conversations, and prescribes fixed tracking periods without claim-level substantiation found in scope. | Live `/app-guides/floriva-features-endometriosis` and related templates | Freeze affected publishing; every affected claim either has a named medical reviewer and claim-to-primary-source record or is replaced with neutral organizational assistance. | M |
| I18N-001 | **Important production journeys remain partially English across eight supported locales.** Onboarding, tracking/cycle setup, privacy, billing results, and scheduled billing notifications contain user-visible literals. | `floriva-app/src/features/onboarding/screens/WelcomeScreen.tsx:24`; `floriva-app/src/features/onboarding/screens/TtcPresetScreen.tsx:25`; `floriva-app/src/features/onboarding/screens/LastPeriodStartScreen.tsx:140`; `floriva-app/src/features/onboarding/screens/NotificationsScreen.tsx:26`; `floriva-app/src/features/onboarding/screens/OnboardingPaywallScreen.tsx:44`; `floriva-app/src/features/settings/screens/SettingsTrackingSetupScreen.tsx:171`; `floriva-app/src/features/settings/screens/SettingsCycleSetupScreen.tsx:142`; `floriva-app/src/features/privacy/components/PrivacyPolicyModal.tsx:99`; `floriva-app/src/features/billing/BillingProvider.tsx:581`; `floriva-app/src/lib/notifications/reminderScheduler.ts:132` | Move all user-facing text and accessibility labels to catalogs, localize at notification scheduling time, add production-literal linting, and pass every critical journey plus delivered notification content in every supported locale. | L |
| A11Y-001 | **Important async success/error/destructive results are silent to screen readers.** Multiple screens render ordinary `Text` status without alert/live-region semantics. | `floriva-app/src/features/logging/screens/TodayLoggingScreen.tsx:748`; `floriva-app/src/features/onboarding/screens/OnboardingCompletionScreen.tsx:195`; `floriva-app/src/features/settings/screens/SettingsTrackingSetupScreen.tsx:282`; `floriva-app/src/features/settings/screens/SettingsCycleSetupScreen.tsx:172`; `floriva-app/src/features/settings/screens/SettingsScreen.tsx:1328`; `floriva-app/src/features/backup/screens/BackupScreen.tsx:497` | Introduce a shared localized `StatusAlert`; use assertive semantics for errors/destructive confirmation and polite announcements for success; pass transition tests and device checks. | M |
| A11Y-002 | **Daily Notes has no programmatic accessible name.** The surrounding visual group does not label the native input. | `floriva-app/src/features/logging/screens/TodayLoggingScreen.tsx:728` | Add localized label/hint and an explicit accessibility assertion. | S |
| A11Y-003 | **Critical onboarding links miss the 44×44pt target and Restore is duplicated.** Privacy details and inline Restore are caption-sized text handlers; the paywall also contains a second Restore button. | `floriva-app/src/features/onboarding/screens/WelcomeScreen.tsx:41`; `floriva-app/src/features/onboarding/screens/OnboardingPaywallScreen.tsx:157,219,267`; `floriva-app/src/theme/tokens.ts:253` | Use one full-size Restore control and a 44pt Privacy Details pressable; assert effective bounds. | S |
| ENG-001 | **The canonical local verification story is fragmented and currently not fully green.** App gates pass, but marketing `pnpm typecheck` fails because the Next route exports `StoreScreenshotPage` and has a stale `searchParams` shape. No root command covers both projects. | `floriva-marketing/src/app/page.tsx:17,81,282`; local 2026-07-30 gate run | Fix the route contract and add one repository-level local verification command. A dated clean run must cover app, marketing, assets, dependencies, and release environment. | S–M |

### P2 — schedule into the next two hardening cycles

| ID | Finding | Evidence | Fix and done condition | Effort |
| --- | --- | --- | --- | --- |
| DEV-001 | **GitHub Actions still schedules hosted CI even though Floriva's policy is local-only verification.** Two workflow copies exist; the root workflow triggers on `main`, `codex/**`, and pull requests. Recent runs are all failed/noisy. | `.github/workflows/ci.yml`; `floriva-app/.github/workflows/ci.yml`; GitHub run history inspected 2026-07-30 | Delete or disable hosted triggers, document the canonical local gate, and retain release evidence locally. Do not restore hosted Actions or resolve this by increasing GitHub spend. | S |
| DEP-001 | **Production dependency graphs contain unresolved advisories.** App audit returned 38 unique advisory records and metadata counted 40 vulnerable findings, mostly Expo/Metro toolchain paths; marketing returned 27 unique advisory records, largely Next/build-chain related. Exploitability in the shipped native runtime was not established. | Local `pnpm audit --prod --json` in both projects on 2026-07-30 | Classify reachability, upgrade direct parents, retain raw reviewed output, and reach zero unreviewed critical or runtime-reachable findings; every exception has an owner and expiry. | M |
| STORE-001 | **Several documents claim to be canonical store copy but disagree.** The JSON and App Store metadata match; the generated paste sheet contains stale promotional text and description. | `floriva-marketing/src/data/store-listing-content.json`; `floriva-app/docs/phase-4-launch-collateral/app-store-connect-metadata.md`; `floriva-app/docs/phase-4-launch-collateral/generated/store-submission-paste-sheet.md` | Make JSON the sole source; regenerate or archive every operator handoff; fail local verification on stale outputs. | S–M |
| SUPPORT-001 | **Production embeds a founder Ventora email instead of the documented Floriva support address.** Production env does not override the fallback. Public surfaces also use multiple contact destinations. | `floriva-app/app.config.ts:123`; `floriva-app/src/features/billing/config.ts:97`; `floriva-app/.env.production`; store/support collateral | Set `support@floriva.app` explicitly, define privacy escalation and ownership, and pass an end-to-end delivery/reply test. | S |
| STORE-002 | **Localized listings lack recorded linguistic and product-truth QA.** The checklist is entirely unchecked; approval evidence has no native reviewer/date. This confirms an assurance gap, not bad translations. | `floriva-app/docs/phase-4-launch-collateral/localization-qa-checklist.md` | Record reviewer, locale, source version, date, and exceptions for metadata, paywall, privacy, medical disclaimers, notifications, and screenshot overlays. | M |
| RECOV-001 | **Ordinary phone migration is not a verified product journey.** iOS currently relies on an OS-backup path without Floriva-controlled application-layer encryption, Android backup is disabled, and the encrypted `.floriva` export requires deliberate file and passphrase management rather than serving as the default same-platform migration experience. | `floriva-app/docs/phase-4-launch-collateral/known-issues.md`; native backup configuration; backup feature and onboarding review | In a dedicated release, make qualified direct transfer the default same-platform path. Allow cloud backup and restore only after explicit Floriva Data Controls consent and above the verified protection threshold; otherwise exclude Floriva data. Keep `.floriva` export as the fallback and optional cross-platform/offline escape hatch, with retained restore drills and no onboarding requirement. | L |
| OPS-001 | **No privacy-safe commercial KPI loop is documented.** There is no scoped operating view of store conversion, purchases, churn/refunds, ratings, crash-free sessions, or support load. | `.agents/product-marketing-context.md:149`; repository operations search | Build a weekly aggregate scorecard from App Store, Play, and privacy-safe web redirect/campaign counts; never collect cycle events. | M |
| LEGAL-001 | **Website terms are materially underdeveloped.** Current terms are limited to informational purpose, user responsibility, and as-is language. | Live `/terms` | Publish counsel-reviewed terms covering operator, ownership, acceptable use, changes, liability framework, governing/dispute structure, and store licensing; record version, effective date, accountable approver, and sign-off. | M |
| CONT-001 | **Floriva ownership and continuity controls are not captured in the audited repository.** Store, payout/tax, domain/email, signing-key, support, policy, and subscription custodians are not inventoried here. | Repository-wide operations review; external wind-down tracker reference | Create a controlled continuity inventory with owners, successors, renewal dates, escrow, emergency access, and customer-obligation handling. | M |
| A11Y-004 | **Mutually exclusive onboarding choices expose generic button semantics.** `SelectionPanel` uses `button` even when the control is a radio-like single choice. | `floriva-app/src/components/primitives/SelectionPanel.tsx:34`; `floriva-app/src/features/onboarding/screens/shared.tsx:128` | Add explicit selection mode and radio/radiogroup or checkbox semantics with group-level tests. | M |
| A11Y-005 | **Expanded-screen back controls may include the decorative chevron in the accessible name.** The collapsed variant already uses the correct explicit label. | `floriva-app/src/components/primitives/Screen.tsx:216`; `floriva-app/src/components/primitives/ScreenScrollHeader.tsx:149` | Supply the explicit label and hide the glyph; confirm on VoiceOver and TalkBack. | S |
| BILL-002 | **Catalog outages can display fixed US-dollar fallback prices.** Purchase is disabled, but a non-USD user can still see a misleading amount. | `floriva-app/src/features/billing/config.ts:70`; `floriva-app/src/features/billing/runtime.ts:56`; `floriva-app/src/features/billing/BillingProvider.tsx:285`; `floriva-app/src/features/billing/components/PaywallPlanSelector.tsx:111` | Show localized "Price unavailable" and retry/support in production; keep fixed catalog values only in QA presets. | S |
| STORE-003 | **The live App Store page lacks declared accessibility-feature metadata.** The public page says the developer has not indicated supported accessibility features. | Live App Store listing inspected 2026-07-30 | Complete actual device accessibility evidence first, then accurately declare only verified features in App Store Connect. | S |
| TEST-001 | **The green test run emits repeated React `act(...)` warnings.** Tests pass, but asynchronous state is not consistently settled, reducing signal and making future regressions easier to miss. | Local `pnpm test:coverage:check` output, especially VirtualizedList/Insights paths | Fix async test orchestration and make unexpected console warnings fail the local test gate with explicit allowlisting for platform noise. | S–M |
| IMPORT-001 | **The import flow's hard 50 MB cap is bypassable.** It checks only optional picker metadata and otherwise reads the whole file. | `floriva-app/src/features/import/ImportFlowProvider.tsx:260` | Stat the copied file before reading; preferably stream/limit parsing and cap depth and record count; test missing-size providers. | S |
| DATA-002 | **Impossible calendar dates pass profile validation and normalize silently.** A regex accepts values such as `2026-02-30`; `Date.UTC` moves the prediction anchor. | `floriva-app/src/db/validators.ts:26,58`; `floriva-app/src/db/repositories.ts:884`; `floriva-app/src/lib/predictions/dateMath.ts:13` | Use one refined real-calendar ISO date schema across profile, backup, import, and logs; add leap-year/impossible-date tests. | S |
| DIAG-001 | **The opt-in local diagnostics setting is nonfunctional.** Production registers only a no-op transport and has no persistence, inspection, export, or clear path. | `floriva-app/src/localization/messages/settings.ts:509`; `floriva-app/src/lib/diagnostics/runtimeDiagnostics.ts:21`; repository search | Remove/disable it with honest copy, or implement a bounded local-only ring buffer with view/export/clear controls. | S–M |
| SEC-005 | **Biometric enable has no exception handling or rollback.** SecureStore success followed by preference-save failure can leave an orphan marker; SecureStore rejection can become an unhandled promise. | `floriva-app/src/features/settings/screens/SettingsScreen.tsx:983` | Make enable/disable transactional from the user's perspective, catch every native failure, roll back partial state, announce the error, and pass failure-injection tests. | S |

## Confirmed evidence gaps

These are release-assurance tasks, not confirmed product defects.

| ID | Missing proof | Confirmation required | Release rule |
| --- | --- | --- | --- |
| GAP-001 | VoiceOver, TalkBack, and maximum Dynamic Type across critical journeys | Device matrix covering onboarding, logging, Calendar, Insights, reminders, import, billing, biometric lock, backup, and delete-all | Do not claim release-level accessibility coverage until complete |
| GAP-002 | HelpTooltip focus placement and modal isolation | Open every tooltip on both platforms and inspect first focus, traversal, dismissal, and background isolation | File a defect only if reproduced |
| GAP-003 | Physical iOS 26 Liquid Glass readability | Real-device pass at rest/scrolling with Reduce Transparency, bold text, and larger text | Do not change frost/scrim based only on simulator artifacts |
| GAP-004 | Native store transactions, physical-device sign-off, and rollout controls | Purchase, restore, crossgrade, introductory offer, retention offer, Lifetime, delete/reinstall, expired-access, and device matrices; verify the actual signed-in rollout configuration | Block future monetization releases when not run; use staged/phased rollout plus store vitals, support monitoring, and named pause thresholds |
| GAP-005 | Current signed-in store-console state | Retain an authenticated timestamped screenshot/export with platform, app, build, and submission IDs from App Store Connect and Play Console | Public store pages are not proof of console state |

## Workstream ownership and dependencies

| Workstream | Accountable role | Must involve | Blocked by |
| --- | --- | --- | --- |
| Public truth correction | Founder/product | Web/content engineering, privacy reviewer, medical reviewer | Website deployment and content pipeline access |
| Reminder integrity | Mobile engineering | Product, localization, QA | None |
| Billing integrity | Founder/product | Mobile engineering, store operations, QA | Lifetime-trial decision and enrolled hardware |
| Privacy/legal | Founder | Privacy counsel, web/mobile engineering | Authoritative product facts |
| Accessibility | Mobile product | iOS/Android QA, localization | Hardware and representative locales |
| Local verification | Engineering owner | Mobile, marketing, release owner | Marketing typecheck fix |
| Release operations | Named release owner | Store operator, support owner, engineering | Store access and device matrix |
| Recovery and continuity | Founder/operations | Support, legal/admin, engineering | Ownership decisions |

## Definition of done by initiative

### Public truth

- Zero false capability matches across the deployed sitemap, metadata, JSON-LD, feeds, and store handoffs.
- Every privacy/encryption statement traces to a code-backed fact.
- Health claims have a named reviewer and substantiation record or are neutralized.
- Content generation fails closed on banned claims.

### Core product

- Reminder UI state, OS permission, persisted preferences, and native schedules agree immediately after onboarding.
- Qualified encrypted direct transfer, explicit cloud-migration consent, conditional cloud backup/restore enforcement, key handling, lock behavior, app-switcher privacy, and deletion semantics match the disclosure and pass adversarial iOS/Android file/device tests.
- Imports are atomic or recoverable, invalid dates/history cannot silently corrupt predictions, and import size limits hold without picker metadata.
- Lifetime-trial eligibility cannot be reset locally, or the app-managed trial no longer exists.
- Save-offer success follows verified entitlement, and notification failures cannot delay paid access.
- All supported locales complete the same critical journeys without English fallback.
- Errors, success, destructive confirmation, inputs, choices, navigation, and touch targets pass semantic tests and device QA.

### Local delivery

- No GitHub Actions workflow schedules on push or pull request.
- One local command runs the complete mobile and marketing gate.
- The command is green from a clean checkout with documented environment preparation.
- Release evidence records tool versions, outcomes, artifacts, manual matrices, and honest exceptions.

### Operations

- Support and privacy mailboxes have explicit ownership, routing, response targets, and continuity.
- Material releases use staged/phased rollout with quantitative pause criteria.
- A weekly privacy-safe scorecard makes acquisition, monetization, reliability, and support health visible.
- Same-platform migration and advanced cross-platform/offline recovery are tested, not merely documented.

## Verified strengths to protect

- Accountless, offline-capable architecture with no Floriva sync backend.
- No reproductive-health analytics, ads, social layer, or data selling.
- User-controlled encrypted backup packages.
- Store-derived live pricing and clear recurring-versus-Lifetime presentation in normal catalog state.
- Fresh store creative for eight locales at valid dimensions.
- Release records use `not run` and `blocked` honestly instead of manufacturing passes.
- Strong current app static and automated coverage gates.
- Native-feeling controls, generally generous sizing, thoughtful destructive states, and visible paywall selection.
- Store download redirects and website health endpoint are live.
- App Store and Play privacy labels currently state no data collected.

## False positives rejected

- **No dark mode:** intentional light-only product decision.
- **No native iPad layout:** intentional; iOS tablet support is disabled.
- **Missing app EULA:** production uses Apple's standard EULA.
- **Reused store screenshots:** fresh localized release exports are documented and dimensionally valid.
- **Broken store download controls:** iOS and Android redirect endpoints were verified live.
- **Hardcoded paywall pricing in normal operation:** normal UI derives pricing from the store; only the outage presentation is problematic.
- **Invasive analytics missing:** absence is a strength; only aggregate, non-reproductive operating metrics are recommended.
- **Bad translations:** not established. Missing linguistic QA and incomplete localization are the confirmed issues.
- **Liquid Glass defects:** simulator concerns remain unconfirmed until physical hardware review.
- **Content duplicated in screenshots:** full-page capture stitching caused the appearance; DOM inspection showed single instances.
- **Microphone access:** Android manifest removes recording/audio-service permissions.
- **Committed live secrets:** tracked production environment content matches the example and contains no live credential.
- **Weak backup cryptography:** rejected; user-created packages use AES-256-GCM, PBKDF2-SHA256 with bounded iterations, secure random salt/nonce, and authenticated key checks.

## Verification record

### Local gates run on 2026-07-30

| Surface | Command | Result |
| --- | --- | --- |
| Native app | `pnpm lint` | Pass |
| Native app | `pnpm typecheck` | Pass |
| Native app | `pnpm test:coverage:check` | Pass: 287 suites, 4,585 tests, 95%-per-file lines/statements/functions gate |
| Native app | `pnpm test:imports` | Pass: 18 suites, 78 tests |
| Native app | `pnpm release:preflight` with production env and local signing variables loaded | Pass; secrets were not printed |
| Marketing | `pnpm lint` | Pass with two unused-variable warnings |
| Marketing | `pnpm typecheck` | **Fail:** invalid Next page export and stale `searchParams` route type |
| Marketing | `pnpm test` | Pass: 17 files, 91 tests, browser-bezel check |
| Marketing | `pnpm build` | Pass |
| Marketing | `pnpm check:assets` and `pnpm check:video-assets` | Pass |
| App dependencies | `pnpm audit --prod --json` | 38 unique advisory records; metadata counts 40 findings: 2 critical, 24 high, 11 moderate, 3 low; mainly Expo/Metro toolchain transitives |
| Marketing dependencies | `pnpm audit --prod --json` | 27 unique advisory records/findings: 14 high, 10 moderate, 3 low; mainly Next/build-chain dependencies |

### Live surfaces checked on 2026-07-30

- `https://floriva.app/api/health` reported healthy and both store redirects configured.
- `/api/store/ios` resolved to App Store ID `6762630858`.
- `/api/store/android` resolved to Play package `app.floriva`.
- App Store public listing showed version 1.1.4, "Data Not Collected," insufficient ratings for a summary, and no declared accessibility features.
- Google Play public listing showed the July 24 update, version 1.3 notes, "No data collected/shared," and `support@floriva.app`.
- Public pages and structured content were compared with repository capability facts and shipped source.

Authenticated App Store Connect and Play Console state was not refreshed and retained as part of this audit. GAP-005 therefore remains open; public listings must not be used as proof of the current review, rollout, or submission state.

### External standards checked

- [Expo SDK 54 SQLite documentation](https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/) for default database configuration and SQLCipher behavior.
- [Apple file-system and backup guidance](https://developer.apple.com/documentation/foundation/using-the-file-system-effectively) for default backup scope and exclusion controls.
- [Google Play health content and services policy](https://support.google.com/googleplay/android-developer/answer/16679511) for health claims and privacy-policy expectations.
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) for privacy, safety, and subscription review context.

## Next decision

Approve one focused containment tranche with a single owner:

1. website claim correction and publishing freeze;
2. reminder-state fix;
3. Lifetime-trial decision;
4. production support address correction;
5. one canonical local verification command;
6. physical billing and accessibility evidence plan.

Do not dilute this tranche with new product features. Floriva's competitive advantage is trust; the fastest growth strategy is to make every public word, app state, and release artifact agree with the strong local-first architecture that already exists.
