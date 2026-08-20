/**
 * Adversarial backup/validator stress tests.
 *
 * Targets:
 *   src/db/validators.ts            – schema definitions (backupSnapshotSchema, backupEnvelopeSchema, etc.)
 *   src/features/backup/backupPackage.ts – encrypt (createBackupPackage) / decrypt (decryptBackupPackage)
 *   src/features/billing/model.ts   – normalizeBillingSnapshot (called by billingSnapshotSchema.transform)
 *
 * No existing tests are weakened or deleted.  All fixed timestamps are clearly
 * past (2020) or clearly future (2030) to avoid the "expired-at-now" rot bug.
 */

import {
  backupSnapshotSchema,
  backupEnvelopeSchema,
} from '@/src/db/validators';
import {
  createBackupPackage,
  decryptBackupPackage,
  BackupPackageError,
} from '@/src/features/backup/backupPackage';
import type { BackupSnapshot } from '@/src/types/domain';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

function richSnapshot(): BackupSnapshot {
  return {
    formatVersion: 1,
    exportedAt: '2026-04-10T15:00:00.000Z',
    appPreferences: {
      hasCompletedOnboarding: true,
      deferredCycleSetup: false,
      deferredTrackingSetup: false,
      deferredBiometricsSetup: false,
      deferredReminderSetup: false,
      deferredImportSetup: false,
      dismissedTailoringChecklist: true,
      showFertilityEstimates: true,
      hapticsEnabled: false,
      tapSoundEnabled: true,
      themePreference: 'dark',
      localePreference: 'es',
    },
    billingSnapshot: {
      accessState: 'subscribed',
      planId: 'annual',
      expiresAt: '2030-01-01T00:00:00.000Z',
      trialEndsAt: '2026-05-01T00:00:00.000Z',
      firstChargeAt: '2026-04-01T00:00:00.000Z',
      lastSyncedAt: '2026-04-10T12:00:00.000Z',
      reminderScheduledFor: '2029-12-25T09:00:00.000Z',
      grandfatherTrialApplied: true,
    },
    userProfile: {
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-28',
      goals: ['period', 'symptoms', 'trying-to-conceive'],
      supportsIrregularCycles: true,
      conditionTags: ['pcos', 'endometriosis'],
      ttcTrackingPreferences: {
        sex: true,
        ovulationTest: true,
        cervicalMucus: true,
        basalBodyTemperature: false,
      },
      birthControlMethod: 'pill',
    },
    reminderPreferences: [
      {
        kind: 'period-start',
        enabled: true,
        hour: 8,
        minute: 0,
        schedule: { cadence: 'cycle-event', daysBefore: 2 },
      },
      {
        kind: 'daily-log',
        enabled: false,
        hour: 21,
        minute: 30,
        schedule: { cadence: 'daily' },
      },
    ],
    privacyPreference: {
      biometricsEnabled: true,
      relockAfterSeconds: 60,
      destructiveActionConfirmationRequired: true,
      diagnosticsConsentEnabled: false,
    },
    importSessions: [
      {
        id: 'session-clue-1',
        source: 'clue',
        status: 'committed',
        startedAt: '2026-03-01T10:00:00.000Z',
        completedAt: '2026-03-01T10:05:00.000Z',
        importedLogCount: 120,
        skippedLogCount: 3,
      },
      {
        id: 'session-flo-1',
        source: 'flo',
        status: 'failed',
        startedAt: '2026-03-15T09:00:00.000Z',
        importedLogCount: 0,
        skippedLogCount: 0,
      },
    ],
    dailyLogs: [
      // All bleeding intensities
      { id: 'log-none', logDate: '2026-01-01', bleeding: 'none', symptoms: [] },
      { id: 'log-spot', logDate: '2026-01-02', bleeding: 'spotting', symptoms: [] },
      { id: 'log-light', logDate: '2026-01-03', bleeding: 'light', symptoms: ['cramps'] },
      { id: 'log-med', logDate: '2026-01-04', bleeding: 'medium', symptoms: ['fatigue', 'headache'] },
      { id: 'log-heavy', logDate: '2026-01-05', bleeding: 'heavy', symptoms: ['bloating', 'acne'] },
      // All symptom keys
      {
        id: 'log-all-symptoms',
        logDate: '2026-01-06',
        bleeding: 'light',
        symptoms: [
          'cramps', 'headache', 'bloating', 'fatigue',
          'breast-tenderness', 'acne', 'discharge',
          'sleep-changes', 'libido-changes', 'sex',
        ],
        mood: 'low',
        notes: 'All symptoms day',
      },
      // All moods
      { id: 'log-steady', logDate: '2026-01-07', bleeding: 'none', symptoms: [], mood: 'steady' },
      { id: 'log-sens', logDate: '2026-01-08', bleeding: 'none', symptoms: [], mood: 'sensitive' },
      { id: 'log-enrg', logDate: '2026-01-09', bleeding: 'none', symptoms: [], mood: 'energized' },
      // TTC observation – all sub-fields
      {
        id: 'log-ttc',
        logDate: '2026-01-10',
        bleeding: 'none',
        symptoms: [],
        ttcObservation: {
          cervicalMucus: 'egg-white',
          ovulationTest: 'peak',
          basalBodyTemperatureCelsius: 36.8,
          sexLogged: true,
        },
      },
      // Birth control – missed + late
      {
        id: 'log-bc',
        logDate: '2026-01-11',
        bleeding: 'none',
        symptoms: [],
        birthControlEvent: { method: 'pill', missedDose: true, lateDose: false },
      },
      // Empty string notes field must NOT appear (undefined vs present)
      {
        id: 'log-nonotes',
        logDate: '2026-01-12',
        bleeding: 'spotting',
        symptoms: ['fatigue'],
      },
      // Unicode / emoji / right-to-left notes at max allowed length (500 chars)
      {
        id: 'log-unicode',
        logDate: '2026-01-13',
        bleeding: 'light',
        symptoms: [],
        notes: '日本語テスト🌸 مرحبا ' + 'x'.repeat(480),
      },
      // Import session reference
      {
        id: 'log-imported',
        logDate: '2026-02-01',
        bleeding: 'medium',
        symptoms: ['cramps'],
        importSessionId: 'session-clue-1',
      },
    ],
  };
}

const PASSPHRASE = 'correct-horse-battery-staple';

// ─────────────────────────────────────────────────────────────────────────────
// 1. ROUNDTRIP FIDELITY
// ─────────────────────────────────────────────────────────────────────────────

describe('1 – roundtrip fidelity', () => {
  it('schema parse of rich snapshot round-trips to deep equality', () => {
    const snapshot = richSnapshot();
    const parsed = backupSnapshotSchema.parse(snapshot);

    // Core fields preserved
    expect(parsed.formatVersion).toBe(1);
    expect(parsed.exportedAt).toBe(snapshot.exportedAt);

    // All bleeding intensities present
    const bleedings = parsed.dailyLogs.map((l) => l.bleeding);
    expect(bleedings).toContain('none');
    expect(bleedings).toContain('spotting');
    expect(bleedings).toContain('light');
    expect(bleedings).toContain('medium');
    expect(bleedings).toContain('heavy');

    // All moods preserved
    expect(parsed.dailyLogs.map((l) => l.mood).filter(Boolean)).toEqual(
      expect.arrayContaining(['steady', 'low', 'sensitive', 'energized']),
    );

    // TTC observation preserved
    const ttcLog = parsed.dailyLogs.find((l) => l.id === 'log-ttc');
    expect(ttcLog?.ttcObservation).toEqual({
      cervicalMucus: 'egg-white',
      ovulationTest: 'peak',
      basalBodyTemperatureCelsius: 36.8,
      sexLogged: true,
    });

    // Birth control preserved
    const bcLog = parsed.dailyLogs.find((l) => l.id === 'log-bc');
    expect(bcLog?.birthControlEvent).toEqual({ method: 'pill', missedDose: true, lateDose: false });

    // Unicode notes preserved
    const unicodeLog = parsed.dailyLogs.find((l) => l.id === 'log-unicode');
    expect(unicodeLog?.notes).toBe(snapshot.dailyLogs.find((l) => l.id === 'log-unicode')?.notes);

    // appPreferences back-fill defaults preserved
    expect(parsed.appPreferences.themePreference).toBe('dark');
    expect(parsed.appPreferences.localePreference).toBe('es');

    // billingSnapshot transform preserves non-expired subscription
    expect(parsed.billingSnapshot.accessState).toBe('subscribed');
    expect(parsed.billingSnapshot.planId).toBe('annual');

    // userProfile fields preserved
    expect(parsed.userProfile?.goals).toEqual(['period', 'symptoms', 'trying-to-conceive']);
    expect(parsed.userProfile?.conditionTags).toEqual(['pcos', 'endometriosis']);
  });

  it('encrypt → decrypt roundtrip yields identical snapshot data', async () => {
    const snapshot = richSnapshot();
    const serialized = await createBackupPackage({ snapshot, passphrase: PASSPHRASE });
    const restored = await decryptBackupPackage({ serializedPackage: serialized, passphrase: PASSPHRASE });

    expect(restored.formatVersion).toBe(snapshot.formatVersion);
    expect(restored.exportedAt).toBe(snapshot.exportedAt);
    expect(restored.dailyLogs).toHaveLength(snapshot.dailyLogs.length);

    // Spot-check rich fields survived the crypto round-trip
    const ttcLog = restored.dailyLogs.find((l) => l.id === 'log-ttc');
    expect(ttcLog?.ttcObservation?.cervicalMucus).toBe('egg-white');
    expect(ttcLog?.ttcObservation?.basalBodyTemperatureCelsius).toBe(36.8);

    const unicodeLog = restored.dailyLogs.find((l) => l.id === 'log-unicode');
    expect(unicodeLog?.notes).toBe(snapshot.dailyLogs.find((l) => l.id === 'log-unicode')?.notes);
  }, 30_000);

  it('empty snapshot (no logs, no sessions, null profile) roundtrips cleanly', () => {
    const minimal: BackupSnapshot = {
      formatVersion: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      appPreferences: {
        hasCompletedOnboarding: false,
        deferredCycleSetup: false,
        deferredTrackingSetup: false,
        deferredBiometricsSetup: false,
        deferredReminderSetup: false,
        deferredImportSetup: false,
        dismissedTailoringChecklist: false,
        showFertilityEstimates: true,
        hapticsEnabled: true,
        tapSoundEnabled: false,
      },
      billingSnapshot: { accessState: 'needs_purchase' },
      userProfile: null,
      reminderPreferences: [],
      privacyPreference: {
        biometricsEnabled: false,
        relockAfterSeconds: 300,
        destructiveActionConfirmationRequired: true,
        diagnosticsConsentEnabled: false,
      },
      importSessions: [],
      dailyLogs: [],
    };
    expect(() => backupSnapshotSchema.parse(minimal)).not.toThrow();
    const parsed = backupSnapshotSchema.parse(minimal);
    expect(parsed.dailyLogs).toHaveLength(0);
    expect(parsed.userProfile).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. VERSION / LEGACY handling
// ─────────────────────────────────────────────────────────────────────────────

describe('2 – version and legacy field handling', () => {
  it('backfills missing optional appPreferences fields from older backups', () => {
    const legacyPrefs = {
      hasCompletedOnboarding: true,
      hapticsEnabled: true,
      tapSoundEnabled: false,
      // All boolean deferral flags missing → should default to false
    };
    const parsed = backupSnapshotSchema.parse({ ...richSnapshot(), appPreferences: legacyPrefs });
    expect(parsed.appPreferences.deferredCycleSetup).toBe(false);
    expect(parsed.appPreferences.deferredTrackingSetup).toBe(false);
    expect(parsed.appPreferences.deferredBiometricsSetup).toBe(false);
    expect(parsed.appPreferences.deferredReminderSetup).toBe(false);
    expect(parsed.appPreferences.deferredImportSetup).toBe(false);
    expect(parsed.appPreferences.dismissedTailoringChecklist).toBe(false);
    expect(parsed.appPreferences.showFertilityEstimates).toBe(true);
    expect(parsed.appPreferences.themePreference).toBe('system');
    expect(parsed.appPreferences.localePreference).toBe('system');
  });

  it('legacy complimentary_active with clearly-future expiresAt normalizes to subscribed', () => {
    const parsed = backupSnapshotSchema.parse({
      ...richSnapshot(),
      billingSnapshot: {
        accessState: 'complimentary_active',
        expiresAt: '2030-06-01T00:00:00.000Z',
      },
    });
    expect(parsed.billingSnapshot.accessState).toBe('subscribed');
    expect(parsed.billingSnapshot.expiresAt).toBe('2030-06-01T00:00:00.000Z');
  });

  it('legacy complimentary_active with clearly-past expiresAt normalizes to expired', () => {
    const parsed = backupSnapshotSchema.parse({
      ...richSnapshot(),
      billingSnapshot: {
        accessState: 'complimentary_active',
        expiresAt: '2020-01-01T00:00:00.000Z',
      },
    });
    expect(parsed.billingSnapshot.accessState).toBe('expired');
  });

  it('subscribed non-lifetime with past expiresAt normalizes to expired', () => {
    const parsed = backupSnapshotSchema.parse({
      ...richSnapshot(),
      billingSnapshot: {
        accessState: 'subscribed',
        planId: 'annual',
        expiresAt: '2020-01-01T00:00:00.000Z',
      },
    });
    expect(parsed.billingSnapshot.accessState).toBe('expired');
  });

  it('subscribed lifetime with past expiresAt stays subscribed (lifetime never expires)', () => {
    const parsed = backupSnapshotSchema.parse({
      ...richSnapshot(),
      billingSnapshot: {
        accessState: 'subscribed',
        planId: 'lifetime',
        expiresAt: '2020-01-01T00:00:00.000Z',
      },
    });
    expect(parsed.billingSnapshot.accessState).toBe('subscribed');
  });

  it('trial_active with future trialEndsAt stays trial_active', () => {
    const parsed = backupSnapshotSchema.parse({
      ...richSnapshot(),
      billingSnapshot: {
        accessState: 'trial_active',
        trialEndsAt: '2030-01-01T00:00:00.000Z',
      },
    });
    expect(parsed.billingSnapshot.accessState).toBe('trial_active');
  });

  it('trial_active with past trialEndsAt normalizes to expired', () => {
    const parsed = backupSnapshotSchema.parse({
      ...richSnapshot(),
      billingSnapshot: {
        accessState: 'trial_active',
        trialEndsAt: '2020-01-01T00:00:00.000Z',
      },
    });
    expect(parsed.billingSnapshot.accessState).toBe('expired');
  });

  it('extra unknown top-level fields in snapshot are stripped, not rejected', () => {
    const withExtraFields = {
      ...richSnapshot(),
      unknownFutureField: 'some-value',
      anotherExtra: { nested: true },
    };
    // Zod strips unknown keys by default — this must not throw
    expect(() => backupSnapshotSchema.parse(withExtraFields)).not.toThrow();
    const parsed = backupSnapshotSchema.parse(withExtraFields);
    expect((parsed as Record<string, unknown>)['unknownFutureField']).toBeUndefined();
  });

  it('extra unknown fields in dailyLog entries are stripped, not rejected', () => {
    const snap = {
      ...richSnapshot(),
      dailyLogs: [
        {
          id: 'log-x',
          logDate: '2026-02-15',
          bleeding: 'light',
          symptoms: [],
          unknownField: 'ignore-me',
        },
      ],
    };
    expect(() => backupSnapshotSchema.parse(snap)).not.toThrow();
    const parsed = backupSnapshotSchema.parse(snap);
    expect((parsed.dailyLogs[0] as Record<string, unknown>)['unknownField']).toBeUndefined();
  });

  it('future formatVersion (e.g. 99) is rejected as unsupported by decryptBackupPackage', async () => {
    // Construct a fake envelope with formatVersion 99 (not 1)
    const fakeEnvelope = JSON.stringify({ formatVersion: 99, createdAt: '2026-01-01T00:00:00.000Z' });
    await expect(
      decryptBackupPackage({ serializedPackage: fakeEnvelope, passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'unsupported_backup_format' });
  });

  it('missing formatVersion in envelope is rejected as invalid_backup_file', async () => {
    const fakeEnvelope = JSON.stringify({ createdAt: '2026-01-01T00:00:00.000Z' });
    await expect(
      decryptBackupPackage({ serializedPackage: fakeEnvelope, passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. CORRUPTION / MALICIOUS input
// ─────────────────────────────────────────────────────────────────────────────

describe('3 – corruption and malicious input', () => {
  it('truncated JSON string is rejected as invalid_backup_file', async () => {
    await expect(
      decryptBackupPackage({ serializedPackage: '{"formatVersion":1,"created', passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' });
  });

  it('empty string is rejected as invalid_backup_file', async () => {
    await expect(
      decryptBackupPackage({ serializedPackage: '', passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' });
  });

  it('non-JSON binary-like string is rejected as invalid_backup_file', async () => {
    await expect(
      decryptBackupPackage({ serializedPackage: '\x00\x01\x02corrupt', passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' });
  });

  it('JSON array at root is rejected as invalid_backup_file', async () => {
    await expect(
      decryptBackupPackage({ serializedPackage: '[1,2,3]', passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' });
  });

  it('null at root is rejected as invalid_backup_file', async () => {
    await expect(
      decryptBackupPackage({ serializedPackage: 'null', passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' });
  });

  it('snapshot with wrong type for dailyLogs (string instead of array) is rejected', () => {
    expect(() =>
      backupSnapshotSchema.parse({ ...richSnapshot(), dailyLogs: 'not-an-array' }),
    ).toThrow();
  });

  it('snapshot with null importSessions (should be array) is rejected', () => {
    expect(() =>
      backupSnapshotSchema.parse({ ...richSnapshot(), importSessions: null }),
    ).toThrow();
  });

  it('snapshot with object instead of array for dailyLogs is rejected', () => {
    expect(() =>
      backupSnapshotSchema.parse({ ...richSnapshot(), dailyLogs: { 0: {} } }),
    ).toThrow();
  });

  it('daily log with NaN bleeding value is rejected', () => {
    expect(() =>
      backupSnapshotSchema.parse({
        ...richSnapshot(),
        dailyLogs: [{ id: 'x', logDate: '2026-05-01', bleeding: NaN, symptoms: [] }],
      }),
    ).toThrow();
  });

  it('daily log with negative importedLogCount on session is rejected', () => {
    expect(() =>
      backupSnapshotSchema.parse({
        ...richSnapshot(),
        importSessions: [
          {
            id: 'bad-session',
            source: 'clue',
            status: 'committed',
            startedAt: '2026-04-01T00:00:00.000Z',
            importedLogCount: -1,
            skippedLogCount: 0,
          },
        ],
      }),
    ).toThrow();
  });

  it('daily log with date completely out of range (year 0) is rejected', () => {
    expect(() =>
      backupSnapshotSchema.parse({
        ...richSnapshot(),
        dailyLogs: [{ id: 'x', logDate: '0000-01-01', bleeding: 'none', symptoms: [] }],
      }),
    ).toThrow();
  });

  it('daily log with logDate as timestamp (not YYYY-MM-DD) is rejected', () => {
    expect(() =>
      backupSnapshotSchema.parse({
        ...richSnapshot(),
        dailyLogs: [
          {
            id: 'x',
            logDate: '2026-04-10T10:00:00.000Z',
            bleeding: 'none',
            symptoms: [],
          },
        ],
      }),
    ).toThrow();
  });

  it('basalBodyTemperatureCelsius below 30 is rejected', () => {
    expect(() =>
      backupSnapshotSchema.parse({
        ...richSnapshot(),
        dailyLogs: [
          {
            id: 'x',
            logDate: '2026-05-01',
            bleeding: 'none',
            symptoms: [],
            ttcObservation: { basalBodyTemperatureCelsius: 20.0 },
          },
        ],
      }),
    ).toThrow();
  });

  it('basalBodyTemperatureCelsius above 45 is rejected', () => {
    expect(() =>
      backupSnapshotSchema.parse({
        ...richSnapshot(),
        dailyLogs: [
          {
            id: 'x',
            logDate: '2026-05-01',
            bleeding: 'none',
            symptoms: [],
            ttcObservation: { basalBodyTemperatureCelsius: 50.0 },
          },
        ],
      }),
    ).toThrow();
  });

  it('notes exceeding 500 characters is rejected', () => {
    expect(() =>
      backupSnapshotSchema.parse({
        ...richSnapshot(),
        dailyLogs: [
          {
            id: 'x',
            logDate: '2026-05-02',
            bleeding: 'light',
            symptoms: [],
            notes: 'a'.repeat(501),
          },
        ],
      }),
    ).toThrow();
  });

  it('notes at exactly 500 characters is accepted', () => {
    expect(() =>
      backupSnapshotSchema.parse({
        ...richSnapshot(),
        dailyLogs: [
          {
            id: 'x',
            logDate: '2026-05-02',
            bleeding: 'light',
            symptoms: [],
            notes: 'a'.repeat(500),
          },
        ],
      }),
    ).not.toThrow();
  });

  it('prototype-pollution key "__proto__" in top-level snapshot does not crash or pollute', () => {
    const malicious = JSON.parse('{"formatVersion":1}') as Record<string, unknown>;
    const base = richSnapshot() as unknown as Record<string, unknown>;
    // Merge malicious key via JSON round-trip
    const serialized = JSON.stringify({ ...base, __proto__: { polluted: true } });
    const parsed = JSON.parse(serialized) as unknown;
    // Must not throw and must not allow schema to silently pass corrupt structure
    expect(() => backupSnapshotSchema.parse(parsed)).not.toThrow();
    // The polluted key must not appear on Object prototype
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(malicious['polluted']).toBeUndefined();
  });

  it('unknown bleeding intensity value is rejected', () => {
    expect(() =>
      backupSnapshotSchema.parse({
        ...richSnapshot(),
        dailyLogs: [
          { id: 'x', logDate: '2026-05-01', bleeding: 'torrential', symptoms: [] },
        ],
      }),
    ).toThrow();
  });

  it('unknown symptom key in array is rejected', () => {
    expect(() =>
      backupSnapshotSchema.parse({
        ...richSnapshot(),
        dailyLogs: [
          { id: 'x', logDate: '2026-05-01', bleeding: 'none', symptoms: ['unknown-symptom'] },
        ],
      }),
    ).toThrow();
  });

  it('duplicate symptoms in single log entry are rejected', () => {
    expect(() =>
      backupSnapshotSchema.parse({
        ...richSnapshot(),
        dailyLogs: [
          { id: 'x', logDate: '2026-05-01', bleeding: 'none', symptoms: ['cramps', 'cramps'] },
        ],
      }),
    ).toThrow();
  });

  it('userProfile goals array that is empty is rejected', () => {
    expect(() =>
      backupSnapshotSchema.parse({
        ...richSnapshot(),
        userProfile: { ...richSnapshot().userProfile!, goals: [] },
      }),
    ).toThrow();
  });

  it('birthControlMethod of "none" in userProfile is rejected', () => {
    expect(() =>
      backupSnapshotSchema.parse({
        ...richSnapshot(),
        userProfile: { ...richSnapshot().userProfile!, birthControlMethod: 'none' },
      }),
    ).toThrow();
  });

  it('relockAfterSeconds above 86400 in privacyPreference is rejected', () => {
    expect(() =>
      backupSnapshotSchema.parse({
        ...richSnapshot(),
        privacyPreference: { ...richSnapshot().privacyPreference, relockAfterSeconds: 86401 },
      }),
    ).toThrow();
  });

  it('relockAfterSeconds of exactly 0 (lock immediately) is accepted', () => {
    expect(() =>
      backupSnapshotSchema.parse({
        ...richSnapshot(),
        privacyPreference: { ...richSnapshot().privacyPreference, relockAfterSeconds: 0 },
      }),
    ).not.toThrow();
  });

  it('reminder hour outside 0-23 is rejected', () => {
    expect(() =>
      backupSnapshotSchema.parse({
        ...richSnapshot(),
        reminderPreferences: [
          {
            kind: 'daily-log',
            enabled: true,
            hour: 24,
            minute: 0,
            schedule: { cadence: 'daily' },
          },
        ],
      }),
    ).toThrow();
  });

  it('reminder minute outside 0-59 is rejected', () => {
    expect(() =>
      backupSnapshotSchema.parse({
        ...richSnapshot(),
        reminderPreferences: [
          {
            kind: 'daily-log',
            enabled: true,
            hour: 9,
            minute: 60,
            schedule: { cadence: 'daily' },
          },
        ],
      }),
    ).toThrow();
  });

  it('cycleLengthDays above 120 in userProfile is rejected', () => {
    expect(() =>
      backupSnapshotSchema.parse({
        ...richSnapshot(),
        userProfile: { ...richSnapshot().userProfile!, cycleLengthDays: 121 },
      }),
    ).toThrow();
  });

  it('periodLengthDays above 30 in userProfile is rejected', () => {
    expect(() =>
      backupSnapshotSchema.parse({
        ...richSnapshot(),
        userProfile: { ...richSnapshot().userProfile!, periodLengthDays: 31 },
      }),
    ).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. TAMPER / INTEGRITY (encryption layer)
// ─────────────────────────────────────────────────────────────────────────────

describe('4 – tamper and integrity', () => {
  it('wrong passphrase is rejected with wrong_passphrase', async () => {
    const pkg = await createBackupPackage({ snapshot: richSnapshot(), passphrase: PASSPHRASE });
    await expect(
      decryptBackupPackage({ serializedPackage: pkg, passphrase: 'wrong-passphrase' }),
    ).rejects.toMatchObject({ code: 'wrong_passphrase' });
  }, 30_000);

  it('tampered ciphertext is rejected as invalid_backup_file', async () => {
    const pkg = await createBackupPackage({ snapshot: richSnapshot(), passphrase: PASSPHRASE });
    const envelope = JSON.parse(pkg) as { encryption: { ciphertextBase64: string } };
    // Flip a byte in the ciphertext
    const bytes = Buffer.from(envelope.encryption.ciphertextBase64, 'base64');
    bytes[bytes.length - 1] ^= 0xff;
    envelope.encryption.ciphertextBase64 = bytes.toString('base64');

    await expect(
      decryptBackupPackage({ serializedPackage: JSON.stringify(envelope), passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' });
  }, 30_000);

  it('tampered keyCheck causes wrong_passphrase, not a crash', async () => {
    const pkg = await createBackupPackage({ snapshot: richSnapshot(), passphrase: PASSPHRASE });
    const envelope = JSON.parse(pkg) as { encryption: { keyCheckBase64: string } };
    const bytes = Buffer.from(envelope.encryption.keyCheckBase64, 'base64');
    bytes[0] ^= 0xff;
    envelope.encryption.keyCheckBase64 = bytes.toString('base64');

    await expect(
      decryptBackupPackage({ serializedPackage: JSON.stringify(envelope), passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'wrong_passphrase' });
  }, 30_000);

  it('envelope with structurally valid JSON but missing kdf section is rejected as invalid_backup_file', async () => {
    const pkg = await createBackupPackage({ snapshot: richSnapshot(), passphrase: PASSPHRASE });
    const envelope = JSON.parse(pkg) as Record<string, unknown>;
    delete envelope['kdf'];
    await expect(
      decryptBackupPackage({ serializedPackage: JSON.stringify(envelope), passphrase: PASSPHRASE }),
    ).rejects.toMatchObject({ code: 'invalid_backup_file' });
  }, 30_000);

  it('BackupPackageError has correct name and code fields', async () => {
    const pkg = await createBackupPackage({ snapshot: richSnapshot(), passphrase: PASSPHRASE });
    let caught: unknown;
    try {
      await decryptBackupPackage({ serializedPackage: pkg, passphrase: 'bad' });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BackupPackageError);
    expect((caught as BackupPackageError).name).toBe('BackupPackageError');
    expect((caught as BackupPackageError).code).toBe('wrong_passphrase');
  }, 30_000);

  it('valid backupEnvelopeSchema rejects when encryption section is an array', () => {
    expect(() =>
      backupEnvelopeSchema.parse({
        formatVersion: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        kdf: {
          algorithm: 'pbkdf2-sha256',
          iterations: 210000,
          saltBase64: 'AAAA',
        },
        encryption: ['not', 'an', 'object'],
      }),
    ).toThrow();
  });

  it('negative iterations in envelope kdf is rejected', () => {
    expect(() =>
      backupEnvelopeSchema.parse({
        formatVersion: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        kdf: {
          algorithm: 'pbkdf2-sha256',
          iterations: -1,
          saltBase64: 'AAAA',
        },
        encryption: {
          algorithm: 'aes-256-gcm',
          nonceBase64: 'BBBB',
          ciphertextBase64: 'CCCC',
          keyCheckBase64: 'DDDD',
        },
      }),
    ).toThrow();
  });
});
