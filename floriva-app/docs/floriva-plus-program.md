# Floriva Plus Iterative Build Program

This runbook is the canonical operating model for the Floriva Plus flagship value bundle.

Floriva Plus is built as a sequence of small vertical slices, not as one large merge. Each slice must leave the app in a shippable state and update the program ledger before the session ends.

## Product Guardrails

- Floriva remains one paid product after trial, not separate feature tiers.
- All Plus work stays local-first: no backend, accounts, cloud sync, ad tech, social layer, or reproductive-health analytics payloads.
- Trust copy must match implementation. Do not imply medical authority, diagnosis, treatment, or impossible-access privacy guarantees.
- Screens orchestrate flows. Domain logic belongs in model builders, repositories, or focused library modules.

## Slice Order

1. Program foundation
2. Private Timeline
3. Import Concierge
4. Encrypted Backup Productization
5. Prediction Confidence and Preparedness
6. Birth-Control Hub
7. TTC Mode
8. Condition Modes
9. Personal Pattern Briefings
10. Flagship Integration Pass

## Required Work Pattern

For each slice:

1. Create a project-local worktree under `.worktrees/` on a `codex/` branch.
2. Read the latest ledger entry before editing.
3. Dispatch sub-agents for bounded work:
   - exploration/context mapping
   - implementation
   - automated verification
   - iOS simulator QA when the slice changes user-facing app behavior
   - Android simulator QA when the slice changes user-facing app behavior
   - UX review
   - final code review
4. Run at least one review/fix loop for important findings.
5. Re-run the affected automated and simulator checks after fixes.
6. Update the ledger with evidence, blockers, and the next recommended slice.

Do not merge a slice while blocking or important review findings remain open.

## Authoritative Commands

Run commands from `floriva-app/` unless noted otherwise.

### Setup

```bash
corepack pnpm install --frozen-lockfile
```

If pnpm reports blocked build scripts on a fresh machine, follow `phase-1-execution-readiness.md` before native or Detox work.

### Automated Verification

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test:ci --runInBand --cacheDirectory .jest-cache
corepack pnpm test:coverage:check
```

Use focused Jest commands during implementation, then run the broader gate before review or merge. Coverage must stay at 95% for lines, statements, and functions on every covered file plus total.

### Native Development Builds

```bash
corepack pnpm ios
corepack pnpm android
corepack pnpm start
corepack pnpm start:clear
```

Development builds are the default native workflow. Use Expo Go only for intentional JS-only checks.

### Detox E2E

Detox opens the Expo dev-client URL and expects Metro to be reachable on `EXPO_DEV_SERVER_HOST:EXPO_DEV_SERVER_PORT`.

```bash
EXPO_DEV_SERVER_PORT=8081 DETOX_IOS_DEVICE='iPhone 17 Pro' corepack pnpm detox:build:ios
EXPO_DEV_SERVER_PORT=8081 DETOX_IOS_DEVICE='iPhone 17 Pro' corepack pnpm detox:test:ios
EXPO_DEV_SERVER_PORT=8081 DETOX_ANDROID_AVD='Pixel_9_API_35' corepack pnpm detox:build:android
EXPO_DEV_SERVER_PORT=8081 DETOX_ANDROID_AVD='Pixel_9_API_35' corepack pnpm detox:test:android
```

If a machine uses different simulator names, record the override in the ledger entry for that session.

## Simulator QA Contract

Every user-facing slice needs iOS and Android functional QA. Docs-only, test-only, and process-foundation slices may skip simulator QA when the ledger records why no user-facing app behavior changed.

At minimum, user-facing simulator QA must verify:

- fresh install or relevant seeded preset
- route entry and back navigation
- main success state
- empty state
- error or blocked state
- scroll behavior and no text overlap
- touch targets and primary actions
- lock/privacy interaction when sensitive data appears

Use screenshots under `docs/qa/screenshots/<date>-<slice>/` when the slice changes UI or UX.

## Ledger Contract

Update `docs/qa/2026-05-13-floriva-plus-program-ledger.md` at the end of every session with:

- branch and worktree
- slice status
- files touched
- tests run
- iOS simulator evidence
- Android simulator evidence
- review findings
- fixes applied
- remaining blockers
- next recommended slice

If context compacts, resume from the latest incomplete ledger entry before exploring from scratch.
