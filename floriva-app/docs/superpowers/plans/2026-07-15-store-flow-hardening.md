# Store Flow Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Floriva's onboarding, Lifetime trial, recurring-plan trials, and retention offers behave exactly as the live store catalog and user-facing copy promise.

**Architecture:** Keep the existing billing provider as the source of billing actions and use the shared `PaywallPlanSelector` contract on every paywall surface. Keep Lifetime's free month entirely app-level with no store transaction or automatic charge. For iOS retention offers, make the custom offer code visible and copy it before opening Apple's redemption sheet; for grandfathered access, preserve the expiry boundary without representing it as a future charge.

**Tech Stack:** Expo 54, React Native, TypeScript, Expo Router, expo-iap, expo-clipboard, Jest, React Native Testing Library.

## Global Constraints

- Product IDs remain exactly `floriva.plus.monthly`, `floriva.plus.annual`, and `floriva.plus.lifetime`.
- Monthly remains `$5.99` / `P1M`; annual remains `$39.99` / `P1Y`; Lifetime remains a `$59.99` non-consumable/one-time purchase.
- Monthly and annual keep one-month store introductory trials; Lifetime has no store trial.
- Lifetime's one-calendar-month trial remains app-level, creates no store transaction, and must never imply an automatic charge.
- Annual remains sorted first, preselected, and labeled best value.
- Annual and monthly unlock identical Floriva Plus content, so Apple must place both durations at the same subscription level; they are crossgrades, not feature-tier upgrades/downgrades.
- Existing purchase and restore behavior must remain unchanged.
- TDD is mandatory: write each behavior test, run it and observe the expected failure, then write minimal production code.
- Every touched file must retain at least 95% coverage.
- Do not add a backend, account system, analytics, EAS build, or EAS submission.

---

### Task 1: Start the Lifetime trial from fresh onboarding

**Files:**
- Modify: `tests/features/onboarding/OnboardingPaywallScreen.test.tsx`
- Modify: `src/features/onboarding/screens/OnboardingPaywallScreen.tsx`

**Interfaces:**
- Consumes: `useBilling().lifetimeTrialEligible: boolean` and `useBilling().startLifetimeTrial(): Promise<void>`.
- Produces: onboarding passes `lifetimeTrialEligible` and `onStartLifetimeTrial` into `PaywallPlanSelector`, matching `SubscribeScreen`.

- [ ] **Step 1: Write the failing onboarding test**

Add `mockStartLifetimeTrial`, default `lifetimeTrialEligible: true`, and `startLifetimeTrial` to `createBillingState()`. Add a test that selects the Lifetime card, presses the shared CTA, and expects `mockStartLifetimeTrial` once while `mockPurchasePlan` is not called:

```tsx
it('starts the app-level Lifetime trial from fresh onboarding', () => {
  mockUseBilling.mockReturnValue(createBillingState());
  renderScreen();

  fireEvent.press(screen.getByTestId(testIds.onboarding.paywall.purchaseLifetimeButton));
  fireEvent.press(screen.getByTestId(testIds.onboarding.paywall.purchaseSelectedButton));

  expect(mockStartLifetimeTrial).toHaveBeenCalledTimes(1);
  expect(mockPurchasePlan).not.toHaveBeenCalled();
});
```

Also add a test with `lifetimeTrialEligible: false` that expects the same Lifetime CTA to call `mockPurchasePlan('lifetime')` and not start a trial.

- [ ] **Step 2: Run the test to verify RED**

Run:

```bash
corepack pnpm test:ci --runInBand tests/features/onboarding/OnboardingPaywallScreen.test.tsx
```

Expected: the eligible-Lifetime test fails because onboarding still calls `purchasePlan('lifetime')`.

- [ ] **Step 3: Wire the existing billing interface into onboarding**

Destructure `lifetimeTrialEligible` and `startLifetimeTrial` from `useBilling()`, then pass:

```tsx
lifetimeTrialEligible={lifetimeTrialEligible}
onStartLifetimeTrial={() => void startLifetimeTrial()}
```

to `PaywallPlanSelector`, leaving annual/monthly purchase routing unchanged.

- [ ] **Step 4: Run the tests to verify GREEN and coverage**

Run:

```bash
corepack pnpm test:ci --runInBand tests/features/onboarding/OnboardingPaywallScreen.test.tsx tests/features/billing/PaywallPlanSelector.test.tsx tests/features/billing/lifetimeTrial.test.ts --coverage --collectCoverageFrom='src/features/onboarding/screens/OnboardingPaywallScreen.tsx'
```

Expected: all tests pass and touched-file coverage is at least 95%.

- [ ] **Step 5: Commit**

```bash
git add tests/features/onboarding/OnboardingPaywallScreen.test.tsx src/features/onboarding/screens/OnboardingPaywallScreen.tsx
git commit -m "fix: start Lifetime trial from onboarding"
```

---

### Task 2: Make iOS retention offer codes usable

**Files:**
- Modify: `tests/features/billing/saveOffer/redeem.test.ts`
- Modify: `tests/features/billing/SaveOfferScreen.test.tsx`
- Modify: `tests/features/billing/BillingProvider.test.tsx`
- Modify: `src/features/billing/saveOffer/redeem.ts`
- Modify: `src/features/billing/BillingProvider.tsx`
- Modify: `src/features/billing/screens/SaveOfferScreen.tsx`
- Modify: `src/localization/messages/settings.ts`

**Interfaces:**
- Extends `RedeemDeps` with `copyOfferCode(offerCode: string): Promise<void>`.
- Uses `expo-clipboard`'s `setStringAsync()` in `BillingProvider`.
- Renders the exact custom code from `offer.redemption.offerCode` on iOS before the user opens Apple's redemption sheet.

- [ ] **Step 1: Write failing domain tests for copy-before-present**

Update every `RedeemDeps` fixture with `copyOfferCode`. For the iOS test, record call order and assert:

```ts
expect(copyOfferCode).toHaveBeenCalledWith('SAVEMONTHLY');
expect(copyOfferCode.mock.invocationCallOrder[0]).toBeLessThan(
  presentCode.mock.invocationCallOrder[0],
);
```

For Android and E2E, assert `copyOfferCode` is not called.

- [ ] **Step 2: Run the domain test to verify RED**

Run:

```bash
corepack pnpm test:ci --runInBand tests/features/billing/saveOffer/redeem.test.ts
```

Expected: TypeScript/test failure because `RedeemDeps` has no clipboard dependency and the code is not copied.

- [ ] **Step 3: Implement copy-before-present**

Add the dependency to `RedeemDeps` and change only the iOS branch:

```ts
await deps.copyOfferCode(offer.redemption.offerCode);
await deps.presentCodeRedemptionSheetIOS();
```

Keep Android and E2E behavior unchanged.

- [ ] **Step 4: Write failing provider and screen tests**

Mock `expo-clipboard` in `BillingProvider.test.tsx` and assert the resolved iOS offer code is passed to `setStringAsync()` before the native sheet is presented. In `SaveOfferScreen.test.tsx`, run the iOS variant and assert both the exact code and localized paste guidance are visible before acceptance.

- [ ] **Step 5: Run the integration tests to verify RED**

Run:

```bash
corepack pnpm test:ci --runInBand tests/features/billing/BillingProvider.test.tsx tests/features/billing/SaveOfferScreen.test.tsx
```

Expected: failures because the provider is not wired to the clipboard and the screen does not render the code guidance.

- [ ] **Step 6: Wire clipboard and localized guidance**

Import `setStringAsync` from `expo-clipboard`, pass it as `copyOfferCode`, and add localized `codeTitle` / `codeBody` strings under every `settings.subscription.saveOffer` locale. On iOS, render a `SectionCard` before the buttons:

```tsx
<SectionCard
  title={t('settings.subscription.saveOffer.codeTitle')}
  description={t('settings.subscription.saveOffer.codeBody', {
    code: offer.redemption.offerCode,
  })}
/>
```

The body must say the code will be copied and should be pasted into Apple's redemption sheet. Do not render this card on Android.

- [ ] **Step 7: Run the tests to verify GREEN and coverage**

Run:

```bash
corepack pnpm test:ci --runInBand tests/features/billing/saveOffer/redeem.test.ts tests/features/billing/BillingProvider.test.tsx tests/features/billing/SaveOfferScreen.test.tsx --coverage --collectCoverageFrom='src/features/billing/saveOffer/redeem.ts' --collectCoverageFrom='src/features/billing/screens/SaveOfferScreen.tsx'
```

Expected: all tests pass and touched-file coverage is at least 95%.

- [ ] **Step 8: Commit**

```bash
git add tests/features/billing/saveOffer/redeem.test.ts tests/features/billing/SaveOfferScreen.test.tsx tests/features/billing/BillingProvider.test.tsx src/features/billing/saveOffer/redeem.ts src/features/billing/BillingProvider.tsx src/features/billing/screens/SaveOfferScreen.tsx src/localization/messages/settings.ts
git commit -m "fix: make Apple retention codes redeemable"
```

---

### Task 3: Remove auto-charge reminders from grandfathered access

**Files:**
- Modify: `tests/features/billing/grandfatherTrial.test.ts`
- Modify: `tests/features/app-shell/AppShellProvider.hydration.test.tsx`
- Modify: `src/features/billing/grandfatherTrial.ts`

**Interfaces:**
- Keeps `trialEndsAt` as the complimentary-access expiry boundary.
- Stops setting `firstChargeAt` when no recurring store plan exists, causing `reconcileBillingReminderNotification` to cancel/skip the billing reminder.
- Cleans the stale `firstChargeAt` from already-applied grandfather snapshots that have no real `planId`, so the fix also protects current users after upgrade.
- Preserves `firstChargeAt` whenever a real store plan exists.

- [ ] **Step 1: Write failing unit and hydration tests**

In `grandfatherTrial.test.ts`, assert the newly granted snapshot has the expected `trialEndsAt` but `firstChargeAt` is `undefined`. Add an existing-user migration case with `grandfatherTrialApplied: true`, no `planId`, and a stale `firstChargeAt`; assert it is removed and `changed` is true. Add a guard case proving a real plan preserves its charge timestamp. Replace the hydration test that expects a billing reminder with one that expects the cleaned snapshot to be persisted and reconciliation to receive no `firstChargeAt`, so no auto-charge reminder can be scheduled.

- [ ] **Step 2: Run the tests to verify RED**

Run:

```bash
corepack pnpm test:ci --runInBand tests/features/billing/grandfatherTrial.test.ts tests/features/app-shell/AppShellProvider.hydration.test.tsx
```

Expected: failures because new grandfather snapshots still set `firstChargeAt` and existing grandfather snapshots are returned unchanged.

- [ ] **Step 3: Remove the false charge timestamp**

Before the normal no-op guards, clean an already-applied grandfather snapshot only when it has no `planId` and still has `firstChargeAt`. Return `changed: true` so hydration persists the cleanup. Then return newly grandfathered snapshots with `trialEndsAt` and `grandfatherTrialApplied`, but no `firstChargeAt`:

```ts
snapshot: {
  ...snapshot,
  accessState: 'trial_active',
  trialEndsAt,
  firstChargeAt: undefined,
  grandfatherTrialApplied: true,
}
```

- [ ] **Step 4: Run tests to verify GREEN and coverage**

Run:

```bash
corepack pnpm test:ci --runInBand tests/features/billing/grandfatherTrial.test.ts tests/features/app-shell/AppShellProvider.hydration.test.tsx tests/features/billing/model.test.ts tests/features/billing/model.adversarial.test.ts --coverage --collectCoverageFrom='src/features/billing/grandfatherTrial.ts'
```

Expected: all tests pass and touched-file coverage is at least 95%.

- [ ] **Step 5: Commit**

```bash
git add tests/features/billing/grandfatherTrial.test.ts tests/features/app-shell/AppShellProvider.hydration.test.tsx src/features/billing/grandfatherTrial.ts
git commit -m "fix: avoid charge reminder for complimentary access"
```

---

### Task 4: Align Apple subscription levels for equal entitlements

**Files:**
- Create: `tests/features/billing/storekitConfig.test.ts`
- Modify: `ios/Floriva.storekit`

**Interfaces:**
- Keeps annual and monthly in the same `Floriva Plus` subscription group.
- Models both durations at subscription level `1`, matching Apple's equal-content crossgrade semantics.

- [ ] **Step 1: Write a failing StoreKit configuration test**

Read and parse `ios/Floriva.storekit`, locate `floriva.plus.annual` and `floriva.plus.monthly`, and assert both products have the same `groupNumber`:

```ts
expect(annual.groupNumber).toBe(1);
expect(monthly.groupNumber).toBe(1);
```

Also assert their `subscriptionGroupID` values match so the test proves one entitlement group with two billing durations.

- [ ] **Step 2: Run the test to verify RED**

Run:

```bash
corepack pnpm test:ci --runInBand tests/features/billing/storekitConfig.test.ts
```

Expected: failure because the local monthly product is currently level `2`.

- [ ] **Step 3: Set the monthly StoreKit product to level 1**

Change only the monthly product's value:

```json
"groupNumber" : 1
```

Do not change product IDs, periods, prices, introductory offers, or group ID.

- [ ] **Step 4: Run the test to verify GREEN**

Run:

```bash
corepack pnpm test:ci --runInBand tests/features/billing/storekitConfig.test.ts
```

Expected: the StoreKit configuration test passes.

- [ ] **Step 5: Commit**

```bash
git add tests/features/billing/storekitConfig.test.ts ios/Floriva.storekit
git commit -m "fix: model recurring plans as Apple crossgrades"
```

---

### Task 5: Reconcile operator documentation with the verified flow

**Files:**
- Modify: `docs/phase-4-launch-collateral/store-setup-guide.md`
- Modify: `docs/phase-4-launch-collateral/pricing-matrix.md`
- Modify: `docs/phase-4-launch-collateral/generated/RELEASE-1.2.0-SUBMISSION-STEPS.md`

**Interfaces:**
- Documents the distinction between store-backed recurring trials and the app-level Lifetime trial.
- Records that Play offers must be active, not merely created.
- Records that Apple Monthly and Annual belong to the same subscription level because their entitlement content is identical.
- Records that each Play `intro-1m` offer uses the app-wide `Never had any subscription` eligibility rule so one person cannot stack separate Monthly and Annual introductory trials.

- [ ] **Step 1: Update the canonical setup copy**

State exactly:

```text
Lifetime has no Apple/Google introductory offer. Floriva grants eligible users one calendar month of app-level Lifetime access before the one-time purchase; it creates no store transaction and never auto-charges.
```

Keep the three product IDs, prices, durations, and one-time/non-consumable types unchanged.

Document Apple Monthly and Annual at the same subscription level. Do not describe either duration as a higher feature tier.

- [ ] **Step 2: Add live offer activation acceptance criteria**

The release runbook must require both products' `intro-1m` offers, `save-monthly-80-3mo`, and `save-annual-30` to show `Active` in Play Console before the flow is accepted. Each `intro-1m` must use `Never had any subscription` eligibility. Keep Apple `SAVEMONTHLY` / `SAVEANNUAL` checks.

- [ ] **Step 3: Verify the docs**

Run:

```bash
rg -n "Lifetime|intro-1m|save-monthly-80-3mo|save-annual-30|SAVEMONTHLY|SAVEANNUAL" docs/phase-4-launch-collateral
```

Expected: no statement claims Lifetime has no trial without the app-level distinction, and all offer IDs appear in the acceptance checklist.

- [ ] **Step 4: Commit**

```bash
git add docs/phase-4-launch-collateral/store-setup-guide.md docs/phase-4-launch-collateral/pricing-matrix.md docs/phase-4-launch-collateral/generated/RELEASE-1.2.0-SUBMISSION-STEPS.md
git commit -m "docs: reconcile store purchase flows"
```

---

### Task 6: Harden Lifetime trial calendar and active-subscriber safety

**Files:**
- Modify: `src/features/billing/lifetimeTrial.ts`
- Modify: `src/features/billing/model.ts`
- Modify: `src/features/billing/BillingProvider.tsx`
- Modify: `src/features/billing/screens/SubscribeScreen.tsx`
- Modify: `src/features/onboarding/screens/OnboardingPaywallScreen.tsx`
- Modify: `tests/features/billing/lifetimeTrial.test.ts`
- Modify: `tests/features/billing/model.test.ts`
- Modify: `tests/features/billing/BillingProvider.test.tsx`
- Modify: `tests/features/billing/SubscribeScreen.test.tsx`
- Modify: `tests/features/onboarding/OnboardingPaywallScreen.test.tsx`

**Interfaces and invariants:**
- One calendar month clamps to the last valid day of the target month instead of overflowing.
- Lifetime app-level access explicitly clears recurring-only `firstChargeAt`, `expiresAt`, and `reminderScheduledFor` metadata.
- Active or uncertain recurring access (`annual` / `monthly` in `trial_active`, `subscribed`, or `sync_error`) cannot start the Lifetime trial or purchase Lifetime from a paywall; Lifetime is hidden until recurring access is verified inactive/expired.
- `startLifetimeTrial` and `purchasePlan('lifetime')` enforce the same guard even if UI state races or a caller bypasses presentation checks.
- The durable `lifetimeTrialStartedAt` marker survives native reconciliation so a refresh cannot make a consumed Lifetime trial eligible again.
- Lifetime actions are blocked before billing hydration and while native entitlement refresh is pending; recurring purchases retain their existing refresh behavior.
- Every provider persistence path carries an existing `lifetimeTrialStartedAt` marker forward, including native reconciliation, local E2E, dev fallback, and provisional fallback writes.
- Hydration assigns `snapshotRef.current` from storage before enabling provider callbacks. All purchase, restore, and save-offer mutations are blocked until hydration completes, so non-Lifetime writes cannot erase an unknown stored marker.

- [ ] **Step 1: Write failing calendar and metadata tests**

Add normal-date, January 31 in common/leap years, and August 31 boundary cases. Assert target-month clamping and preserved local clock time. Start from a snapshot containing recurring billing metadata and assert the Lifetime snapshot clears `firstChargeAt`, `expiresAt`, and `reminderScheduledFor` while retaining unrelated durable fields.

- [ ] **Step 2: Write failing active-subscriber safety tests**

Cover annual and monthly `trial_active` / `subscribed` snapshots plus a recurring `sync_error` snapshot. Assert Lifetime trial eligibility is false, direct Subscribe/onboarding paywalls do not expose the Lifetime offering, `startLifetimeTrial` performs no local write, and `purchasePlan('lifetime')` performs no store request. Keep Lifetime available for fresh and verified-expired recurring snapshots.

Add deferred provider tests for pre-hydration bypass and Annual/Monthly × Lifetime trial/purchase while `isRefreshingRef` is true. Assert no local write or Lifetime store request, resolve the active recurring entitlement, and assert it wins. Preserve the existing test proving recurring purchases may still start during refresh.

Cover pre-hydration Annual/Monthly purchase, restore, and save-offer redemption bypasses. Assert no store call or persistence occurs until hydration completes, and add a consumer layout-effect regression proving callbacks see the synchronously published stored snapshot rather than the default markerless state.

- [ ] **Step 3: Write a failing native-refresh durability test**

Derive an active recurring snapshot from native state when the previous snapshot contains `lifetimeTrialStartedAt`; assert the marker remains present. Cover a no-entitlement refresh after trial expiry as well.

At provider integration level, prove the marker survives a recurring purchase through caught-up native reconciliation and provisional fallback persistence.

- [ ] **Step 4: Run focused tests and verify RED**

```bash
corepack pnpm test:ci --runInBand tests/features/billing/lifetimeTrial.test.ts tests/features/billing/model.test.ts tests/features/billing/BillingProvider.test.tsx tests/features/billing/SubscribeScreen.test.tsx tests/features/onboarding/OnboardingPaywallScreen.test.tsx
```

- [ ] **Step 5: Implement the smallest shared guards and clamped calendar helper**

Use a shared pure predicate for Lifetime transition safety in both paywalls and provider guards. Do not change recurring product purchase behavior, product identifiers, prices, or trial durations.

- [ ] **Step 6: Run focused GREEN, coverage, lint, and typecheck**

Collect coverage for every touched production file and keep repository-enforced metrics at or above 95%; all newly introduced branches require direct tests.

- [ ] **Step 7: Commit**

```bash
git commit -m "fix: harden Lifetime trial transitions"
```

---

### Task 7: Repair canonical Lifetime operator truth

**Files:**
- Modify: `docs/phase-4-launch-collateral/README.md`
- Modify: `docs/phase-4-launch-collateral/reviewer-notes.md`
- Modify: `tests/sanity/phase4-launch-collateral.test.ts`

**Interfaces and invariants:**
- The bundle-level source of truth and Apple reviewer notes must state that Lifetime has no store introductory offer but eligible users receive one calendar month of app-level access before manual one-time purchase, with no store transaction or auto-charge.
- The sanity test enforces this distinction across the canonical README, reviewer notes, pricing matrix, setup guide, and current release runbook.
- Reviewer Q&A must list app access truthfully: active Annual/Monthly subscription or trial, eligible app-level Lifetime access period, or purchased Lifetime unlock. It must reject the legacy subscription-or-purchased-unlock-only wording.

- [ ] **Step 1: Extend the sanity test and verify RED**

Add exact Lifetime app-level/no-auto-charge assertions for `README.md` and `reviewer-notes.md`; retain existing price and recurring-trial assertions.

- [ ] **Step 2: Reconcile canonical prose**

Replace the README contradiction and update reviewer-facing subscription-flow wording without changing prices, identifiers, or recurring trial terms.

- [ ] **Step 3: Run focused verification and contradiction searches**

```bash
corepack pnpm test:ci --runInBand tests/sanity/phase4-launch-collateral.test.ts
rg -n -i "Lifetime|no trial|introductory offer|app-level|store transaction|auto-charge" docs/phase-4-launch-collateral
```

- [ ] **Step 4: Commit**

```bash
git commit -m "docs: align canonical Lifetime trial truth"
```

---

## Final Verification

- [ ] Run the focused commerce suite:

```bash
corepack pnpm test:ci --runInBand tests/features/billing tests/features/onboarding/OnboardingPaywallScreen.test.tsx tests/features/app-shell/resolvePaidAccessGate.test.ts tests/features/app-shell/resolveAppEntry.test.ts tests/features/app-shell/AppShellProvider.hydration.test.tsx
```

- [ ] Run project gates:

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test:coverage:check
```

- [ ] Dispatch a whole-branch review agent, fix every Critical/Important finding, and re-run verification.
- [ ] Merge only after the review is clean and the live store configuration has been independently re-verified.
