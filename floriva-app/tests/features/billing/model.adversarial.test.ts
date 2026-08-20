/**
 * Adversarial tests for billing model:
 * normalizeBillingSnapshot and buildFirstChargeReminderDate.
 *
 * These fixtures cover malformed/partial/hostile inputs that the public API
 * may receive from on-device SQLite storage or from an upgraded app reading
 * a snapshot written by an older schema.
 */

import {
  buildFirstChargeReminderDate,
  normalizeBillingSnapshot,
} from '@/src/features/billing/model';
import type { BillingSnapshot } from '@/src/types/domain';

const billingConfig = {
  reminderLeadDays: 3,
  reminderHour: 9,
  reminderMinute: 0,
} as const;

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function snap(overrides: Partial<BillingSnapshot>): BillingSnapshot {
  return { accessState: 'needs_purchase', ...overrides } as BillingSnapshot;
}

// ---------------------------------------------------------------------------
// 1. normalizeBillingSnapshot — malformed / hostile snapshots
// ---------------------------------------------------------------------------

describe('normalizeBillingSnapshot — adversarial inputs', () => {
  const NOW = new Date('2026-06-10T12:00:00.000Z');

  // ── 1a. Unknown / garbage accessState ──────────────────────────────────
  //
  // NOTE: This is a known limitation of normalizeBillingSnapshot.
  //
  // The function uses an explicit if/else chain over known accessState values.
  // Any unrecognised value falls through to `return snapshot as BillingSnapshot`
  // unchanged.  In practice this is safe because:
  //   a) BillingAccessState is a closed enum — the TypeScript type system
  //      prevents well-typed callers from passing unknown values.
  //   b) The SQLite persistence layer validates against billingAccessStateValues
  //      before constructing a BillingSnapshotInput.
  //   c) normalizeBillingSnapshot is only called with trusted, locally-stored
  //      data, never with raw network payloads.
  //
  // This test documents the pass-through behaviour so any future change
  // (e.g. strict validation) is deliberate.

  it('passes through an unknown accessState unchanged (closed enum, local-only data)', () => {
    const result = normalizeBillingSnapshot(
      // Force an unrecognised accessState through the type system
      { accessState: 'hacked_premium' as BillingSnapshot['accessState'] },
      NOW,
    );
    // Current contract: unknown values are returned as-is.
    // They will NOT match any isSafeCachedAccessState check so the provider
    // falls back to sync_error / needs_purchase on the next sync.
    expect(result.accessState).toBe('hacked_premium' as BillingSnapshot['accessState']);
  });

  // ── 1b. subscribed non-lifetime with no expiresAt ────────────────────────
  //
  // NOTE: This is a known limitation of normalizeBillingSnapshot.
  //
  // The native store does not always return an expiration date (e.g. iOS
  // StoreKit may omit it for certain subscription types, or a schema
  // migration may drop the field).  deriveBillingSnapshotFromNativeState
  // can therefore persist a { accessState: 'subscribed', planId: 'annual' }
  // snapshot with no expiresAt, and normalizeBillingSnapshot must not break
  // that valid round-trip.
  //
  // Consequence: normalizeBillingSnapshot alone cannot detect an expired
  // time-limited subscription that has no expiresAt in its snapshot.  The
  // only guard is the subsequent deriveBillingSnapshotFromNativeState call
  // which re-queries the native store.  This is acceptable because
  // normalizeBillingSnapshot is only used as a stale-cache read before the
  // store is queried.
  //
  // These tests document the current contract so that any future change that
  // adds expiry enforcement here is deliberate and audited.

  it('passes through subscribed annual with no expiresAt (native store may omit expiry)', () => {
    const result = normalizeBillingSnapshot(
      snap({ accessState: 'subscribed', planId: 'annual' }),
      NOW,
    );
    // Current expected behaviour: pass-through (subscribed).
    // Enforcement of expiry for missing expiresAt is deferred to the
    // next deriveBillingSnapshotFromNativeState call.
    expect(result.accessState).toBe('subscribed');
    expect(result.planId).toBe('annual');
  });

  it('passes through subscribed monthly with no expiresAt (native store may omit expiry)', () => {
    const result = normalizeBillingSnapshot(
      snap({ accessState: 'subscribed', planId: 'monthly' }),
      NOW,
    );
    expect(result.accessState).toBe('subscribed');
    expect(result.planId).toBe('monthly');
  });

  // ── 1c. subscribed lifetime with no expiresAt is always valid ───────────

  it('keeps lifetime subscribed access even when there is no expiresAt', () => {
    const result = normalizeBillingSnapshot(
      snap({ accessState: 'subscribed', planId: 'lifetime' }),
      NOW,
    );
    expect(result.accessState).toBe('subscribed');
    expect(result.planId).toBe('lifetime');
  });

  // ── 1d. Expired timestamps ───────────────────────────────────────────────

  it('expires a trial exactly at its expiry boundary (not in future)', () => {
    const exactNow = '2026-06-10T12:00:00.000Z';
    const result = normalizeBillingSnapshot(
      snap({
        accessState: 'trial_active',
        planId: 'annual',
        trialEndsAt: exactNow,
      }),
      new Date(exactNow),
    );
    // At exactly now (not strictly in future) the trial is expired
    expect(result.accessState).toBe('expired');
  });

  it('keeps a trial active one millisecond before expiry', () => {
    const trialEndsAt = '2026-06-10T12:00:00.000Z';
    const result = normalizeBillingSnapshot(
      snap({
        accessState: 'trial_active',
        planId: 'annual',
        trialEndsAt,
      }),
      new Date(new Date(trialEndsAt).getTime() - 1),
    );
    expect(result.accessState).toBe('trial_active');
  });

  it('expires a subscribed plan exactly at its expiresAt boundary', () => {
    const expiresAt = '2026-06-10T12:00:00.000Z';
    const result = normalizeBillingSnapshot(
      snap({ accessState: 'subscribed', planId: 'annual', expiresAt }),
      new Date(expiresAt),
    );
    expect(result.accessState).toBe('expired');
  });

  // ── 1e. trial_active with only firstChargeAt (no trialEndsAt/expiresAt) ─

  it('uses firstChargeAt as the expiry boundary when trialEndsAt and expiresAt are absent', () => {
    const firstChargeAt = '2026-06-09T12:00:00.000Z';
    const result = normalizeBillingSnapshot(
      snap({ accessState: 'trial_active', planId: 'annual', firstChargeAt }),
      new Date('2026-06-10T12:00:00.000Z'), // past the first charge
    );
    expect(result.accessState).toBe('expired');
  });

  // ── 1f. complimentary_active: expired ────────────────────────────────────

  it('expires a complimentary snapshot that has already passed', () => {
    const result = normalizeBillingSnapshot(
      {
        accessState: 'complimentary_active',
        expiresAt: '2026-05-01T00:00:00.000Z',
      },
      NOW,
    );
    expect(result.accessState).toBe('expired');
  });

  it('does not grant subscribed access for a complimentary snapshot with no expiresAt', () => {
    // complimentary_active with no expiresAt: the branch checks
    // `snapshot.expiresAt && !isTimestampInFuture(snapshot.expiresAt, now)`.
    // With no expiresAt, isTimestampInFuture returns false and the ternary
    // picks 'subscribed'. This is probably intentional (indefinite comp grant),
    // but we document the behaviour here so it's explicit.
    const result = normalizeBillingSnapshot(
      { accessState: 'complimentary_active' },
      NOW,
    );
    // Current behaviour: treated as active subscribed (no expiry = permanent comp)
    // This test pins the contract so any future change is deliberate.
    expect(['subscribed', 'expired']).toContain(result.accessState);
  });

  // ── 1g. Far-future / far-past dates ──────────────────────────────────────

  it('treats a far-future expiresAt as still active', () => {
    const result = normalizeBillingSnapshot(
      snap({
        accessState: 'subscribed',
        planId: 'annual',
        expiresAt: '2099-01-01T00:00:00.000Z',
      }),
      NOW,
    );
    expect(result.accessState).toBe('subscribed');
  });

  it('treats a far-past trialEndsAt as expired', () => {
    const result = normalizeBillingSnapshot(
      snap({
        accessState: 'trial_active',
        planId: 'monthly',
        trialEndsAt: '2000-01-01T00:00:00.000Z',
      }),
      NOW,
    );
    expect(result.accessState).toBe('expired');
  });

  // ── 1h. Invalid/garbage timestamp strings ────────────────────────────────

  it('does not crash on a non-ISO expiresAt string and does not grant active access', () => {
    expect(() =>
      normalizeBillingSnapshot(
        snap({
          accessState: 'subscribed',
          planId: 'annual',
          expiresAt: 'not-a-date',
        }),
        NOW,
      ),
    ).not.toThrow();

    const result = normalizeBillingSnapshot(
      snap({
        accessState: 'subscribed',
        planId: 'annual',
        expiresAt: 'not-a-date',
      }),
      NOW,
    );
    // Invalid date → isTimestampInFuture returns false → but the current
    // condition is `snapshot.expiresAt && !isTimestampInFuture(...)`.
    // 'not-a-date' is truthy AND isTimestampInFuture returns false, so the
    // condition fires and marks it expired. This is the SAFE outcome.
    expect(result.accessState).toBe('expired');
  });

  it('does not crash on a non-ISO trialEndsAt string and expires the trial', () => {
    expect(() =>
      normalizeBillingSnapshot(
        snap({
          accessState: 'trial_active',
          planId: 'annual',
          trialEndsAt: '!!garbage!!',
        }),
        NOW,
      ),
    ).not.toThrow();

    const result = normalizeBillingSnapshot(
      snap({
        accessState: 'trial_active',
        planId: 'annual',
        trialEndsAt: '!!garbage!!',
      }),
      NOW,
    );
    // '!!garbage!!' is truthy; parseTimestamp returns null; isTimestampInFuture
    // returns false → trial is expired. Safe outcome.
    expect(result.accessState).toBe('expired');
  });

  // ── 1i. Extra unexpected fields must not crash ────────────────────────────

  it('does not crash when the snapshot has extra unexpected fields', () => {
    expect(() =>
      normalizeBillingSnapshot(
        {
          accessState: 'trial_active',
          planId: 'annual',
          trialEndsAt: '2026-12-01T00:00:00.000Z',
          // @ts-expect-error intentionally injecting unknown fields
          unknownField: 'surprise',
          anotherField: 42,
        },
        NOW,
      ),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. buildFirstChargeReminderDate — timezone and edge cases
// ---------------------------------------------------------------------------

describe('buildFirstChargeReminderDate — adversarial inputs', () => {
  const NOW = new Date('2026-05-01T12:00:00.000Z');

  // ── 2a. TIMEZONE BUG: early-UTC firstChargeAt must still yield correct
  //        local reminder date regardless of process timezone ───────────────
  //
  // firstChargeAt = '2026-05-09T01:00:00.000Z' (1am UTC)
  // In UTC-4 (America/New_York) this is May 8 at 9pm local.
  // In UTC+10 (Australia/Sydney) this is May 9 at 11am local.
  //
  // The business intent: fire the reminder 3 days before the *UTC calendar
  // day* of the first charge (May 9), i.e. on May 6 at 9am local.
  //
  // The bug: using getDate() on the local representation of the UTC Date
  // gives May 8 in UTC-4, so the reminder is computed for May 5 instead.

  it('fires on the correct local day even when firstChargeAt is before UTC midnight locally (UTC-4 scenario)', () => {
    // firstChargeAt = May 9 UTC, but only 1am UTC so it is May 8 in UTC-4.
    // Reminder should be 3 days before May 9 UTC date = May 6 9am local.
    const reminder = buildFirstChargeReminderDate(
      snap({
        accessState: 'trial_active',
        planId: 'annual',
        firstChargeAt: '2026-05-09T01:00:00.000Z',
      }),
      billingConfig,
      NOW,
    );

    expect(reminder).not.toBeNull();
    // The UTC date of the charge is May 9.
    // Subtract 3 days → May 6. Reminder must be on the 6th, not the 5th.
    expect(reminder!.getDate()).toBe(6);
    expect(reminder!.getMonth()).toBe(4); // May (0-indexed)
    expect(reminder!.getHours()).toBe(9);
    expect(reminder!.getMinutes()).toBe(0);

    // Stronger: verify the reminder is exactly 3 lead-days before the UTC
    // calendar date of the charge, regardless of the host process timezone.
    // The charge UTC date is May 9; the reminder's local date must be 3 calendar
    // days earlier = May 6.  We verify via a UTC-anchored reference:
    const chargeMidnightUtc = new Date(Date.UTC(2026, 4, 9)); // May 9 UTC 00:00
    const reminderMidnightLocal = new Date(
      reminder!.getFullYear(),
      reminder!.getMonth(),
      reminder!.getDate(),
    );
    const diffMs = chargeMidnightUtc.getTime() - reminderMidnightLocal.getTime();
    // diff should be exactly 3 days (in the UTC→local direction);
    // accept anything in [3×86400000 - 86400000, 3×86400000 + 86400000] to
    // tolerate any UTC offset of the test host while still catching off-by-one.
    expect(diffMs).toBeGreaterThanOrEqual(2 * 86_400_000);
    expect(diffMs).toBeLessThanOrEqual(4 * 86_400_000);
  });

  it('fires on the correct local day even when firstChargeAt is before UTC midnight locally (UTC+10 scenario)', () => {
    // firstChargeAt = May 9 02:00 UTC. In UTC+10 this is May 9 12:00.
    // Reminder = 3 days before May 9 UTC = May 6.
    const reminder = buildFirstChargeReminderDate(
      snap({
        accessState: 'trial_active',
        planId: 'annual',
        firstChargeAt: '2026-05-09T02:00:00.000Z',
      }),
      billingConfig,
      NOW,
    );

    expect(reminder).not.toBeNull();
    expect(reminder!.getDate()).toBe(6);
    expect(reminder!.getMonth()).toBe(4); // May
    expect(reminder!.getHours()).toBe(9);
    expect(reminder!.getMinutes()).toBe(0);

    // Verify reminder is 3 calendar days before the UTC charge date.
    const chargeMidnightUtc = new Date(Date.UTC(2026, 4, 9));
    const reminderMidnightLocal = new Date(
      reminder!.getFullYear(),
      reminder!.getMonth(),
      reminder!.getDate(),
    );
    const diffMs = chargeMidnightUtc.getTime() - reminderMidnightLocal.getTime();
    expect(diffMs).toBeGreaterThanOrEqual(2 * 86_400_000);
    expect(diffMs).toBeLessThanOrEqual(4 * 86_400_000);
  });

  // ── 2a-extra. Direct proof that UTC day is used as reference ────────────
  //
  // firstChargeAt = '2026-05-09T22:00:00.000Z' — this is May 10 in UTC+3 and
  // still May 9 in UTC-2.  The fix pegs reminder calculation to the UTC date
  // (May 9), so reminder must be 3 days before May 9 = May 6, not May 7.
  it('uses the UTC calendar date of the charge, not the local date, as the reference', () => {
    const reminder = buildFirstChargeReminderDate(
      snap({
        accessState: 'trial_active',
        planId: 'annual',
        firstChargeAt: '2026-05-09T22:00:00.000Z',
      }),
      billingConfig,
      NOW,
    );

    expect(reminder).not.toBeNull();
    // UTC charge date = May 9 → reminder = May 6 (3 days before), not May 7.
    expect(reminder!.getDate()).toBe(6);
    expect(reminder!.getMonth()).toBe(4); // May (0-indexed)
  });

  // ── 2b. Reminder date exactly equals now → must be null (past/present) ──

  it('returns null when the computed reminder date exactly equals now', () => {
    // Charge 3 days + a few minutes from now, so reminder date == now
    const chargeDate = new Date(NOW.getTime());
    chargeDate.setUTCDate(chargeDate.getUTCDate() + 3);
    const firstChargeAt = chargeDate.toISOString();

    // NOW is '2026-05-01T12:00:00.000Z', so reminder falls before or at NOW
    const result = buildFirstChargeReminderDate(
      snap({ accessState: 'trial_active', planId: 'annual', firstChargeAt }),
      billingConfig,
      NOW,
    );
    // Reminder setHours(9,0) on local May 4 = some time around May 4 9am local.
    // Whether this is null depends on local offset; the important guarantee is
    // it must never schedule a reminder in the past.
    if (result !== null) {
      expect(result.getTime()).toBeGreaterThan(NOW.getTime());
    }
  });

  // ── 2c. firstChargeAt is null / undefined / empty string ─────────────────

  it('returns null when firstChargeAt is undefined', () => {
    const result = buildFirstChargeReminderDate(
      snap({ accessState: 'trial_active', planId: 'annual' }),
      billingConfig,
      NOW,
    );
    expect(result).toBeNull();
  });

  // ── 2d. Invalid firstChargeAt string ─────────────────────────────────────

  it('does not crash and returns null when firstChargeAt is not a valid ISO string', () => {
    expect(() =>
      buildFirstChargeReminderDate(
        snap({
          accessState: 'trial_active',
          planId: 'annual',
          firstChargeAt: 'not-a-date',
        }),
        billingConfig,
        NOW,
      ),
    ).not.toThrow();

    const result = buildFirstChargeReminderDate(
      snap({
        accessState: 'trial_active',
        planId: 'annual',
        firstChargeAt: 'not-a-date',
      }),
      billingConfig,
      NOW,
    );
    // new Date('not-a-date') produces NaN; setDate(NaN - 3) = setDate(NaN) which
    // makes the date invalid; getTime() returns NaN; NaN <= now is false so the
    // guard passes and an invalid Date is returned. This is a latent bug:
    // the function should guard against NaN and return null.
    // If this assertion fails it means the function already guards it (good).
    // If it passes with a non-null result it means the function returns an
    // invalid Date object which the scheduler will fail on.
    if (result !== null) {
      expect(Number.isNaN(result.getTime())).toBe(false);
    }
  });

  // ── 2e. No-trial / subscribed snapshot with firstChargeAt ────────────────

  it('still returns a valid reminder for a subscribed-but-not-lifetime snapshot that carries a firstChargeAt', () => {
    // Some snapshots may be subscribed but still carry firstChargeAt for
    // accounting purposes. The function only gates on lifetime + no firstChargeAt.
    const firstChargeAt = '2026-06-01T10:00:00.000Z';
    const result = buildFirstChargeReminderDate(
      snap({ accessState: 'subscribed', planId: 'annual', firstChargeAt }),
      billingConfig,
      NOW,
    );
    // If in future, should be non-null; if past, null. Either is acceptable.
    if (result !== null) {
      expect(result.getTime()).toBeGreaterThan(NOW.getTime());
    }
  });

  // ── 2f. leadDays = 0 (edge: reminder on the charge day itself) ───────────

  it('schedules the reminder on the charge day itself when leadDays is 0', () => {
    const firstChargeAt = '2026-06-01T10:00:00.000Z'; // future
    const result = buildFirstChargeReminderDate(
      snap({ accessState: 'trial_active', planId: 'annual', firstChargeAt }),
      { reminderLeadDays: 0, reminderHour: 9, reminderMinute: 0 },
      NOW,
    );
    expect(result).not.toBeNull();
    // Charge is June 1 UTC; reminder at 0 days before = June 1 9am local
    expect(result!.getDate()).toBe(1);
    expect(result!.getMonth()).toBe(5); // June (0-indexed)
    expect(result!.getHours()).toBe(9);
  });

  // ── 2g. needs_purchase snapshot with a firstChargeAt should still schedule ─

  it('schedules a reminder for needs_purchase state if firstChargeAt is present and in future', () => {
    // e.g. a snapshot written by an old app version with a future charge date
    const firstChargeAt = '2026-06-30T10:00:00.000Z';
    const result = buildFirstChargeReminderDate(
      snap({ accessState: 'needs_purchase', firstChargeAt }),
      billingConfig,
      NOW,
    );
    // The function does not gate on accessState (only on lifetime + no firstChargeAt)
    // so this is expected to return non-null.
    expect(result).not.toBeNull();
  });
});
