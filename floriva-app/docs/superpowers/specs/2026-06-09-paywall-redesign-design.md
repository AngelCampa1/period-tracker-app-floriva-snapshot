# Floriva Paywall Redesign — Design

**Date:** 2026-06-09
**Status:** Approved (scope = full overhaul of both surfaces; plan UI = annual pre-selected + "Best value" badge)

## Goal

A single, calm, conversion-optimized, store-compliant paywall presentation shared by the
onboarding (mandatory, post-onboarding) surface and the `SubscribeScreen` (full-lock) surface —
replacing today's duplicated logic, horizontal-scroll plan cards, and hardcoded English microcopy.

## Why (research-backed)

From the paywall research (RevenueCat 2025 benchmarks, Apple 3.1.2, Google Play subscriptions):

- Hard paywall + 30-day trial is well-matched to a cycle tracker (needs ≥1 full cycle to prove value).
- Pre-select and emphasize the **highest-value** plan (annual), not the cheapest.
- A **trial timeline** ("Today → Day 27 reminder → Day 30 billed") is the single highest-leverage
  trust + conversion pattern for an auto-charge flow.
- **"You won't be charged today"** reassurance reliably lifts conversion.
- **Privacy is a conversion asset** for this category — honest, factual claims only.
- Apple 3.1.2: total billed price must be the **most prominent** price element; trial + per-month
  must be subordinate; no trial toggle; Restore + Terms + Privacy + auto-renew disclosure required.

## Non-goals / Out of scope

- No pricing changes (monthly $5.99 / annual $39.99 / lifetime $59.99 unchanged).
- No changes to `BillingProvider`, snapshot derivation, the paid-access gate, grandfather trial,
  DB schema, or migrations. **Presentation layer only.**
- No account/cloud/social. No A/B-testing infrastructure (P2, post-launch).
- No new third-party SDKs or tracking.

## Architecture

Both screens keep using `useBilling()` for offerings + purchase actions and `useAppShell()` for the
gate. The redesign extracts shared, focused, independently-testable presentation units.

### New files

1. **`src/features/billing/paywallCopy.ts`** — pure helpers (no React), unit-tested:
   - `computeAnnualSavingsPercent(monthlyLabel, annualLabel)` → integer percent (e.g. `44`) or `null`
     when either price can't be parsed.
   - `computeMonthlyEquivalentLabel(annualLabel)` → e.g. `"$3.33/mo"` or `null` when unparseable.
   - `buildTrialTimeline({ trialDays, reminderLeadDays })` → ordered steps
     `[{ key:'today', dayLabel, body }, { key:'reminder', dayLabel, body }, { key:'charge', dayLabel, body }]`.
     `trialDays` defaults to 30 (the product's trial length); reminder day = `trialDays - reminderLeadDays`.
   - Price parsing tolerates currency symbol + thousands/decimal separators; returns `null` on failure
     (callers omit the derived line rather than show a wrong number — honest-claims rule).

2. **`src/features/billing/components/PaywallPlanSelector.tsx`** — three **vertically stacked**
   selectable plan cards + one primary CTA:
   - Props: `offerings`, `selectedPlanId`, `onSelect(planId)`, `onPurchase(planId)`,
     `purchasingPlanId`, `actionsDisabled`, `monthlyPriceLabel`, `annualPriceLabel`.
   - Annual card shows a **"Best value"** badge (`colors.success`), savings % vs monthly, and the
     per-month equivalent as **subordinate** text. Total billed price (`offering.priceLabel`) is the
     most prominent element (largest `numeral`).
   - Lifetime card: "One-time" label, no trial, no badge.
   - Selected card: accent border + accent-tinted fill; unselected: surface + rule border.
   - Single primary `ActionButton` below the cards labeled from the selected offering
     (e.g. "Start annual trial" / "Choose annual plan" / "Unlock lifetime access"), calling
     `onPurchase(selectedPlanId)`. **No per-card purchase buttons.**

3. **`src/features/billing/components/PaywallTrialTimeline.tsx`** — renders `buildTrialTimeline`
   output as three labeled rows. Rendered only when a trial offering exists.

4. **`src/features/billing/components/PaywallPrivacyValue.tsx`** — the "What you're paying for"
   privacy block, promoted from the onboarding screen to a shared, i18n'd component. Factual list:
   stored only on this device · no account required · no ads · no data selling.

### Modified files

- **`src/features/onboarding/screens/OnboardingPaywallScreen.tsx`** — replace the per-plan
  `SectionCard`+button list and inline hardcoded English with `PaywallPrivacyValue` +
  `PaywallTrialTimeline` + `PaywallPlanSelector`. Keep restore inline link, legal links, refresh,
  the existing `useEffect` access/redirect logic, and the dev-only "continue" escape hatches.
  Selection state (`selectedPlanId`) defaults to annual (first offering).
- **`src/features/billing/screens/SubscribeScreen.tsx`** — replace the horizontal `ScrollView` plan
  cards + per-card buttons with `PaywallPrivacyValue` + `PaywallTrialTimeline` + `PaywallPlanSelector`.
  Keep gate/back/force-lock-redirect logic, contextual locked description, restore/manage/refresh,
  legal links. Add "You won't be charged today" reassurance near the CTA when a trial offering exists.
- **`src/localization/messages/billing.ts`** — add new keys under `billing` across **all 8 locales**
  (en, es, de, fr, ja, zh-Hans, pt, ru):
  - `billing.value.*` (privacy block: eyebrow, body, 4 list items)
  - `billing.timeline.*` (title; today/reminder/charge bodies; day-label format with `{day}` token)
  - `billing.plans.bestValueBadge`, `billing.plans.savings` (`"Save {percent}%"`),
    `billing.plans.perMonth` (`"{price}/mo"`), `billing.plans.notChargedToday`,
    `billing.plans.autoRenewDisclosure`
  - Onboarding header strings move into i18n: `billing.onboarding.eyebrow/title/needsPurchase/expired`
    (so the onboarding surface stops hardcoding English).
- **`src/testing/testIds.ts`** — add `billing.purchaseSelectedButton`,
  `billing.trialTimeline`, `billing.privacyValue`, `billing.bestValueBadge`; add
  `onboarding.paywall.purchaseSelectedButton`. Keep existing per-plan card testIds
  (`planCardAnnual/Monthly/Lifetime`, `primaryPlan/secondaryPlan`) for selection taps; the
  `planCardsScroll` testID is **removed** (horizontal scroll gone).

## Data flow

`useBilling()` → `offerings` (already annual-first sorted) → each screen holds `selectedPlanId`
(default `offerings[0]?.planId`, i.e. annual) → `PaywallPlanSelector` renders cards + single CTA →
CTA calls `purchasePlan(selectedPlanId)` → existing provider/snapshot/gate flow unchanged → on
unlock, existing redirect effects route into the app.

## Error / edge handling

- Empty offerings (catalog not loaded): selector renders nothing; screens still show
  privacy/legal/refresh so the user can retry — same as today.
- Unparseable price labels: savings %, per-month, and the charge-amount in the timeline are omitted
  (never show a guessed number). Trial timeline still renders day structure.
- No trial offering (e.g. lifetime-only or trial already consumed): timeline + "not charged today"
  hidden; CTA + cards still render.
- `sync_error` / voluntary visitors on `SubscribeScreen`: gate + back logic unchanged; user can leave.

## Compliance checklist (must hold on-screen)

- [ ] Total billed price is the most prominent price per card.
- [ ] Trial length + per-month cost are visually subordinate.
- [ ] No trial toggle anywhere.
- [ ] Auto-renew + cancel disclosure visible (`autoRenewDisclosure`).
- [ ] "You won't be charged today" near CTA (when trial).
- [ ] Restore Purchases, Privacy Policy, Terms of Use all present and functional.

## Testing (TDD, 95% coverage on touched files)

- **Unit** `tests/features/billing/paywallCopy.test.ts`: savings math, per-month, timeline day
  computation, null-on-unparseable.
- **Component** `tests/features/billing/PaywallPlanSelector.test.tsx`: annual default selected, badge
  present on annual only, savings/per-month subordinate, single CTA wiring calls `onPurchase` with
  selected plan, selecting another card changes CTA label + purchase target, per-card buttons absent.
- **Component** `tests/features/billing/PaywallTrialTimeline.test.tsx`: three steps, correct day
  numbers, hidden when no trial.
- **Update** `SubscribeScreen.test.tsx` + `OnboardingPaywallScreen.test.tsx`: assert new structure
  (privacy block, timeline, single CTA, not-charged-today, contextual headers), remove assertions on
  the dropped horizontal scroll / per-card buttons.
- **e2e** update `e2e/paywall-enforcement.e2e.js` + `e2e/smoke.e2e.js`: select annual card → tap the
  single `purchaseSelectedButton` (replacing the old per-plan button taps). Re-run Detox on **iOS
  simulator AND Android emulator** for both flows (fresh mandatory + grandfathered-expired). Capture
  fresh screenshots; visually iterate on aesthetics until calm/polished.

## Decomposition note

Single focused implementation plan — all units are presentation-layer and ship together as one
coherent paywall. No sub-project split needed.
