# Paywall redesign — visual capture (2026-06-09)

Screenshots of the redesigned paywall (shared selector, live-price savings,
single shared CTA, duration-agnostic trial timeline). Captured on iOS
(iPhone 17, iOS 26.4) against the live Metro bundle, grandfathered-expired
preset + `local-purchase-success` billing mode, so `/subscribe` renders in its
full-lock state.

## Screenshots

- `ios/ios-subscribe-redesign-top.png` — top of `/subscribe`: privacy value
  block, then the shared plan selector. Annual is pre-selected (deep-red
  border + **BEST VALUE** badge) with live store price `$39.99/year`, the
  `$3.33/mo` equivalent, **Save 44%** (derived from the live monthly price),
  and honest "1 month free, then billed yearly" copy. Lifetime and monthly
  cards follow.
- `ios/ios-subscribe-redesign-timeline.png` — scrolled lower: the single shared
  CTA (**Choose annual plan**), "You won't be charged today.", the auto-renew
  disclosure, and the redesigned trial timeline. The timeline now uses relative,
  undated labels — **Today / Trial reminder / When your trial ends** — instead
  of a fabricated "Day 30" charge date (honest-claims fix `6dadc76`).
- `ios/ios-onboarding-paywall-redesign.png` — the mandatory onboarding paywall
  (`OnboardingPaywallScreen`), captured via the fresh-onboarding Detox
  walkthrough. Shows the back-only (no-skip) hero, the privacy value block, the
  shared plan selector with annual pre-selected (**BEST VALUE**, live
  `$39.99/year`, `$3.33/mo`, **Save 44%**, "1 month free, then billed yearly"),
  confirming it renders the same shared selector/timeline as `/subscribe`.

## Not captured here

- Android. Same shared components; not re-captured this pass.
