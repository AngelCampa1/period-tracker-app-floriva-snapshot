/**
 * Adversarial probe tests for billing access-state logic.
 *
 * Probes edge-cases not yet covered by model.test.ts,
 * model.adversarial.test.ts, or providerHelpers.test.ts.
 *
 * Focus areas:
 *  1. deriveBillingSnapshotFromNativeState — access-state transitions
 *  2. snapshotUnlocksPaidAccess — gating correctness for all access states
 *  3. normalizeBillingSnapshot — complimentary / lifetime edge-cases
 *  4. Privacy / data-retention: expiry must NOT delete data (structural check)
 */

import {
  deriveBillingSnapshotFromNativeState,
  normalizeBillingSnapshot,
  resolvePlanIdFromProductIdentifier,
} from '@/src/features/billing/model';
import { snapshotUnlocksPaidAccess } from '@/src/features/billing/providerHelpers';
import type { BillingSnapshot } from '@/src/types/domain';

// ─── helpers ───────────────────────────────────────────────────────────────

const CONFIG = {
  annualProductId: 'com.floriva.annual',
  monthlyProductId: 'com.floriva.monthly',
  lifetimeProductId: 'com.floriva.lifetime',
} as const;

const FUTURE = '2099-01-01T00:00:00.000Z';
const PAST = '2000-01-01T00:00:00.000Z';
const NOW = new Date('2026-06-10T12:00:00.000Z');

function snap(overrides: Partial<BillingSnapshot> & { accessState: BillingSnapshot['accessState'] }): BillingSnapshot {
  return { ...overrides } as BillingSnapshot;
}

function derive(
  args: Omit<Parameters<typeof deriveBillingSnapshotFromNativeState>[0], 'config' | 'now'>,
): BillingSnapshot {
  return deriveBillingSnapshotFromNativeState({ ...args, config: CONFIG, now: NOW });
}

// ───────────────────────────────────────────────────────────────────────────
// 1. snapshotUnlocksPaidAccess — gating for every possible access state
// ───────────────────────────────────────────────────────────────────────────

describe('snapshotUnlocksPaidAccess — gating correctness', () => {
  // States that MUST unlock
  it('unlocks for trial_active', () => {
    expect(snapshotUnlocksPaidAccess(snap({ accessState: 'trial_active', planId: 'annual', trialEndsAt: FUTURE }))).toBe(true);
  });

  it('unlocks for subscribed (annual)', () => {
    expect(snapshotUnlocksPaidAccess(snap({ accessState: 'subscribed', planId: 'annual' }))).toBe(true);
  });

  it('unlocks for subscribed (lifetime)', () => {
    expect(snapshotUnlocksPaidAccess(snap({ accessState: 'subscribed', planId: 'lifetime' }))).toBe(true);
  });

  // States that MUST NOT unlock
  it('does NOT unlock for expired', () => {
    expect(snapshotUnlocksPaidAccess(snap({ accessState: 'expired', planId: 'annual' }))).toBe(false);
  });

  it('does NOT unlock for needs_purchase', () => {
    expect(snapshotUnlocksPaidAccess(snap({ accessState: 'needs_purchase' }))).toBe(false);
  });

  it('does NOT unlock for sync_error', () => {
    expect(snapshotUnlocksPaidAccess(snap({ accessState: 'sync_error' }))).toBe(false);
  });

  it('does NOT unlock for undefined (no snapshot yet)', () => {
    expect(snapshotUnlocksPaidAccess(undefined)).toBe(false);
  });

  // Ambiguous / unknown state — must default to LOCKED (safe failure mode)
  it('does NOT unlock for an unknown accessState (safe fail-closed behaviour)', () => {
    // A snapshot with a future state we do not recognise must not grant access.
    const unknownState = 'god_mode' as BillingSnapshot['accessState'];
    expect(snapshotUnlocksPaidAccess({ accessState: unknownState } as BillingSnapshot)).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 2. deriveBillingSnapshotFromNativeState — access-state transitions
// ───────────────────────────────────────────────────────────────────────────

describe('deriveBillingSnapshotFromNativeState — access-state transitions', () => {
  // ── 2a. free → subscribed ─────────────────────────────────────────────

  it('transitions from needs_purchase to subscribed when an active subscription appears', () => {
    const result = derive({
      activeSubscriptions: [
        { productId: 'com.floriva.annual', isActive: true, expirationDate: NOW.getTime() + 86_400_000 },
      ],
      previousSnapshot: { accessState: 'needs_purchase', lastSyncedAt: PAST },
    });
    expect(result.accessState).toBe('subscribed');
    expect(result.planId).toBe('annual');
  });

  // ── 2b. subscribed → expired (sub inactive, no purchase history) ──────

  it('transitions from subscribed to expired when the subscription becomes inactive and has purchase history', () => {
    const result = derive({
      activeSubscriptions: [],
      availablePurchases: [{ productId: 'com.floriva.annual', transactionDate: NOW.getTime() - 86_400_000 }],
      previousSnapshot: { accessState: 'subscribed', planId: 'annual', lastSyncedAt: PAST },
    });
    expect(result.accessState).toBe('expired');
    expect(result.planId).toBe('annual');
  });

  // ── 2c. expired → subscribed (restored / renewed) ────────────────────

  it('transitions from expired back to subscribed when an active subscription is restored', () => {
    const result = derive({
      activeSubscriptions: [
        { productId: 'com.floriva.annual', isActive: true, expirationDate: NOW.getTime() + 30 * 86_400_000 },
      ],
      previousSnapshot: { accessState: 'expired', planId: 'annual', lastSyncedAt: PAST },
    });
    expect(result.accessState).toBe('subscribed');
  });

  // ── 2d. Lapsed subscription: no active sub + purchase history ─────────

  it('yields expired when subscription lapses (no active subs, but purchase history exists)', () => {
    const result = derive({
      activeSubscriptions: [],
      availablePurchases: [{ productId: 'com.floriva.monthly', transactionDate: NOW.getTime() - 3 * 86_400_000 }],
      previousSnapshot: undefined,
    });
    expect(result.accessState).toBe('expired');
    expect(result.planId).toBe('monthly');
  });

  // ── 2e. Lifetime purchase always subscribed, regardless of active subs ─

  it('yields subscribed (lifetime) even when no active subscription is present', () => {
    const result = derive({
      activeSubscriptions: [],
      availablePurchases: [{ productId: 'com.floriva.lifetime', transactionDate: NOW.getTime() - 365 * 86_400_000 }],
    });
    expect(result.accessState).toBe('subscribed');
    expect(result.planId).toBe('lifetime');
  });

  it('lifetime beats expired annual in availablePurchases when listed second', () => {
    const result = derive({
      activeSubscriptions: [],
      availablePurchases: [
        { productId: 'com.floriva.annual', transactionDate: NOW.getTime() - 400 * 86_400_000 },
        { productId: 'com.floriva.lifetime', transactionDate: NOW.getTime() - 100 * 86_400_000 },
      ],
    });
    // Lifetime purchase: always subscribed, not expired
    expect(result.accessState).toBe('subscribed');
    expect(result.planId).toBe('lifetime');
  });

  // ── 2f. sync_error falls back to cached safe states ───────────────────

  it('preserves trial_active when store sync fails mid-trial', () => {
    const result = derive({
      syncStatus: 'error',
      previousSnapshot: { accessState: 'trial_active', planId: 'annual', trialEndsAt: FUTURE, lastSyncedAt: PAST },
    });
    expect(result.accessState).toBe('trial_active');
  });

  it('preserves subscribed when store sync fails for an active subscriber', () => {
    const result = derive({
      syncStatus: 'error',
      previousSnapshot: { accessState: 'subscribed', planId: 'annual', expiresAt: FUTURE, lastSyncedAt: PAST },
    });
    expect(result.accessState).toBe('subscribed');
  });

  it('preserves expired (not needs_purchase) when store sync fails after subscription lapsed', () => {
    const result = derive({
      syncStatus: 'error',
      previousSnapshot: { accessState: 'expired', planId: 'annual', lastSyncedAt: PAST },
    });
    expect(result.accessState).toBe('expired');
  });

  it('yields sync_error (not subscribed) when sync fails and previous snapshot is needs_purchase', () => {
    const result = derive({
      syncStatus: 'error',
      previousSnapshot: { accessState: 'needs_purchase', lastSyncedAt: PAST },
    });
    // Must NOT grant access on sync error for free users
    expect(result.accessState).toBe('sync_error');
    expect(snapshotUnlocksPaidAccess(result)).toBe(false);
  });

  it('yields sync_error when sync fails and there is no previous snapshot at all', () => {
    const result = derive({
      syncStatus: 'error',
      previousSnapshot: undefined,
    });
    expect(result.accessState).toBe('sync_error');
    expect(snapshotUnlocksPaidAccess(result)).toBe(false);
  });

  // ── 2g. Missing / corrupt billing snapshot (no previousSnapshot) ──────

  it('yields needs_purchase when no data is available at all', () => {
    const result = derive({
      activeSubscriptions: [],
      availablePurchases: [],
      previousSnapshot: undefined,
    });
    expect(result.accessState).toBe('needs_purchase');
    expect(snapshotUnlocksPaidAccess(result)).toBe(false);
  });

  // ── 2h. Active subscription where isActive=false must NOT grant access ─

  it('does NOT grant subscribed for an isActive=false entry in activeSubscriptions', () => {
    const result = derive({
      activeSubscriptions: [
        { productId: 'com.floriva.annual', isActive: false, expirationDate: NOW.getTime() + 86_400_000 },
      ],
      availablePurchases: [],
      previousSnapshot: undefined,
    });
    // isActive=false means the subscription is not currently valid
    expect(result.accessState).not.toBe('subscribed');
    expect(snapshotUnlocksPaidAccess(result)).toBe(false);
  });

  // ── 2i. Annual subscription prioritised over monthly when both active ──

  it('picks annual over monthly when both are active (higher value plan)', () => {
    const result = derive({
      activeSubscriptions: [
        { productId: 'com.floriva.monthly', isActive: true, expirationDate: NOW.getTime() + 15 * 86_400_000 },
        { productId: 'com.floriva.annual', isActive: true, expirationDate: NOW.getTime() + 300 * 86_400_000 },
      ],
    });
    expect(result.accessState).toBe('subscribed');
    expect(result.planId).toBe('annual');
  });

  // ── 2j. Lifetime product in activeSubscriptions must be ignored ────────
  // Lifetime is handled via availablePurchases, not activeSubscriptions.
  // findMostRelevantActiveSubscription explicitly excludes lifetime planIds.

  it('ignores lifetime planId in activeSubscriptions (lifetime flows through purchases)', () => {
    const result = derive({
      activeSubscriptions: [
        { productId: 'com.floriva.lifetime', isActive: true },
      ],
      availablePurchases: [],
      previousSnapshot: undefined,
    });
    // lifetime in activeSubscriptions is filtered out; no purchase history → needs_purchase
    expect(result.accessState).toBe('needs_purchase');
  });

  // ── 2k. trial_active preserved when same plan goes active ─────────────

  it('preserves trial_active snapshot when native store shows the same plan as active during the trial window', () => {
    const trialEndsAt = new Date(NOW.getTime() + 7 * 86_400_000).toISOString();
    const result = derive({
      activeSubscriptions: [
        { productId: 'com.floriva.annual', isActive: true, expirationDate: NOW.getTime() + 365 * 86_400_000 },
      ],
      previousSnapshot: {
        accessState: 'trial_active',
        planId: 'annual',
        trialEndsAt,
        firstChargeAt: trialEndsAt,
        expiresAt: trialEndsAt,
        lastSyncedAt: PAST,
      },
    });
    // Must stay trial_active, not jump straight to subscribed
    expect(result.accessState).toBe('trial_active');
    expect(result.planId).toBe('annual');
  });

  // ── 2l. trial_active with expired trial becomes subscribed via active sub

  it('promotes trial_active to subscribed when the trial has ended and the native sub is still active', () => {
    const trialEndsAt = new Date(NOW.getTime() - 86_400_000).toISOString(); // trial expired yesterday
    const result = derive({
      activeSubscriptions: [
        { productId: 'com.floriva.annual', isActive: true, expirationDate: NOW.getTime() + 364 * 86_400_000 },
      ],
      previousSnapshot: {
        accessState: 'trial_active',
        planId: 'annual',
        trialEndsAt,
        firstChargeAt: trialEndsAt,
        expiresAt: trialEndsAt,
        lastSyncedAt: PAST,
      },
    });
    // Trial expired; active sub present → subscribed (not trial_active, not expired)
    expect(result.accessState).toBe('subscribed');
    expect(result.planId).toBe('annual');
  });

  // ── 2m. Unrecognised product ID must not grant access ─────────────────

  it('does NOT grant access for an unrecognised product ID in activeSubscriptions', () => {
    const result = derive({
      activeSubscriptions: [
        { productId: 'com.attacker.injected_premium', isActive: true },
      ],
      availablePurchases: [],
      previousSnapshot: undefined,
    });
    expect(result.accessState).not.toBe('subscribed');
    expect(snapshotUnlocksPaidAccess(result)).toBe(false);
  });

  // ── 2n. Empty productId strings ───────────────────────────────────────

  it('does NOT grant access for empty productId in activeSubscriptions', () => {
    const result = derive({
      activeSubscriptions: [{ productId: '', isActive: true }],
      availablePurchases: [],
    });
    expect(result.accessState).not.toBe('subscribed');
    expect(snapshotUnlocksPaidAccess(result)).toBe(false);
  });

  // ── 2o. Privacy: expiry does NOT delete data (derive only changes state) ─
  //
  // deriveBillingSnapshotFromNativeState only returns a BillingSnapshot —
  // it does not touch dailyLogs or any user data repository. This test
  // verifies the returned snapshot on expiry is only a state change, not
  // a destructive operation.

  it('returns only a state-change snapshot on expiry — no data mutation', () => {
    const result = derive({
      activeSubscriptions: [],
      availablePurchases: [{ productId: 'com.floriva.annual', transactionDate: NOW.getTime() - 400 * 86_400_000 }],
      previousSnapshot: { accessState: 'subscribed', planId: 'annual', lastSyncedAt: PAST },
    });
    expect(result.accessState).toBe('expired');
    // The result is a plain data object — no imperative side-effects
    expect(typeof result).toBe('object');
    expect(Object.keys(result)).not.toContain('dailyLogs');
    expect(Object.keys(result)).not.toContain('deleteUserData');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 3. normalizeBillingSnapshot — lifetime never expires
// ───────────────────────────────────────────────────────────────────────────

describe('normalizeBillingSnapshot — lifetime edge-cases', () => {
  // lifetime with a far-past expiresAt must NOT expire
  it('does NOT expire a lifetime subscription even when expiresAt is in the past', () => {
    const result = normalizeBillingSnapshot(
      snap({ accessState: 'subscribed', planId: 'lifetime', expiresAt: PAST }),
      NOW,
    );
    // The normalization condition gates on `planId !== 'lifetime'`, so
    // a past expiresAt on a lifetime plan must be ignored.
    expect(result.accessState).toBe('subscribed');
  });

  it('does NOT expire a lifetime subscription with no expiresAt', () => {
    const result = normalizeBillingSnapshot(
      snap({ accessState: 'subscribed', planId: 'lifetime' }),
      NOW,
    );
    expect(result.accessState).toBe('subscribed');
  });

  // annual with past expiresAt MUST expire (control — opposite of lifetime)
  it('expires an annual subscription whose expiresAt is in the past', () => {
    const result = normalizeBillingSnapshot(
      snap({ accessState: 'subscribed', planId: 'annual', expiresAt: PAST }),
      NOW,
    );
    expect(result.accessState).toBe('expired');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 4. resolvePlanIdFromProductIdentifier — adversarial product IDs
// ───────────────────────────────────────────────────────────────────────────

describe('resolvePlanIdFromProductIdentifier — adversarial product IDs', () => {
  const config = {
    annualProductId: 'com.floriva.annual',
    monthlyProductId: 'com.floriva.monthly',
    lifetimeProductId: 'com.floriva.lifetime',
  };

  it('returns undefined for empty string', () => {
    expect(resolvePlanIdFromProductIdentifier('', config)).toBeUndefined();
  });

  it('returns undefined for whitespace-only string', () => {
    expect(resolvePlanIdFromProductIdentifier('   ', config)).toBeUndefined();
  });

  it('returns undefined for an arbitrary unrecognised SKU', () => {
    expect(resolvePlanIdFromProductIdentifier('com.attacker.free_premium', config)).toBeUndefined();
  });

  it('resolves via config exact match for annual', () => {
    expect(resolvePlanIdFromProductIdentifier('com.floriva.annual', config)).toBe('annual');
  });

  it('resolves via heuristic for a SKU containing "year"', () => {
    expect(resolvePlanIdFromProductIdentifier('app.floriva.yearly_sub', config)).toBe('annual');
  });

  it('resolves via heuristic for a SKU containing "month"', () => {
    expect(resolvePlanIdFromProductIdentifier('app.floriva.monthly_plus', config)).toBe('monthly');
  });

  it('resolves via heuristic for a SKU containing "lifetime"', () => {
    expect(resolvePlanIdFromProductIdentifier('app.floriva.lifetime_purchase', config)).toBe('lifetime');
  });

  // Adversarial: a config exact match should take priority over heuristics
  it('config exact match takes priority over substring heuristic', () => {
    // if someone names a monthly product "annual_monthly_combo" it should resolve
    // by exact config match not heuristic substring.
    const weirdConfig = { ...config, monthlyProductId: 'annual_monthly_combo' };
    expect(resolvePlanIdFromProductIdentifier('annual_monthly_combo', weirdConfig)).toBe('monthly');
  });

  // Adversarial: very long product ID must not crash
  it('handles a very long product ID without crashing', () => {
    const longId = 'a'.repeat(10_000);
    expect(() => resolvePlanIdFromProductIdentifier(longId, config)).not.toThrow();
    expect(resolvePlanIdFromProductIdentifier(longId, config)).toBeUndefined();
  });
});
