import {
  defaultAppPreferences,
  defaultPrivacyPreference,
} from '@/src/db/domainDefaults';
import { addDays, diffDays } from '@/src/lib/predictions/dateMath';
import type {
  BackupRestorePreview,
  BackupSnapshot,
  DailyLogEntry,
  ImportPreview,
  ImportSession,
  ReminderPreference,
  UserProfile,
} from '@/src/types/domain';

export const qaFixturePassphrase = 'fixture-passphrase';

// The implicit "viewed on" day the rich-history fixture was originally
// authored against. Every date-bearing value below is expressed relative to
// this reference, and the builder functions shift the whole fixture so it
// ends on the caller-supplied `todayIso` instead (see `anchorDate`). Passing
// this exact reference back into any builder reproduces the original,
// byte-identical fixed-date output -- which is what the committed
// `tests/fixtures/data-portability/` artifacts and their generator rely on.
export const QA_RICH_HISTORY_REFERENCE_TODAY_ISO = '2026-04-16';

/**
 * Shifts a fixed calendar date so its offset from
 * `QA_RICH_HISTORY_REFERENCE_TODAY_ISO` is preserved relative to `todayIso`.
 * Date-only; relative spacing between fixture dates is unchanged.
 *
 * `diffDays(a, b) = b - a`, so `anchorDate(x, REFERENCE) === x` for every x
 * (the identity that keeps the committed fixtures byte-identical when the
 * reference date is passed back in).
 */
function anchorDate(fixedDate: string, todayIso: string): string {
  return addDays(todayIso, -diffDays(fixedDate, QA_RICH_HISTORY_REFERENCE_TODAY_ISO));
}

/**
 * Anchors the date portion of an ISO datetime while preserving the original
 * time-of-day portion verbatim.
 */
function anchorDateTime(fixedIso: string, todayIso: string): string {
  const [datePart, timePart] = fixedIso.split('T');
  const anchoredDate = anchorDate(datePart!, todayIso);
  return timePart === undefined ? anchoredDate : `${anchoredDate}T${timePart}`;
}

export function buildQaRichHistoryProfile(todayIso: string): UserProfile {
  return {
    cycleLengthDays: 31,
    periodLengthDays: 6,
    lastPeriodStartDate: anchorDate('2026-04-01', todayIso),
    goals: ['period', 'symptoms', 'trying-to-conceive'],
    supportsIrregularCycles: true,
    conditionTags: ['pcos', 'pmdd', 'endometriosis'],
    ttcTrackingPreferences: {
      sex: true,
      ovulationTest: true,
      cervicalMucus: true,
      basalBodyTemperature: true,
    },
    birthControlMethod: 'pill',
  };
}

// Fixed base entries (authored against QA_RICH_HISTORY_REFERENCE_TODAY_ISO).
// `buildQaRichHistoryDailyLogs` anchors each `logDate` (and regenerates the
// date-embedding `id`) to the caller's `todayIso`; every other per-entry
// field is preserved verbatim.
const qaRichHistoryDailyLogsFixed: DailyLogEntry[] = [
  {
    id: 'qa-log-2026-01-08',
    logDate: '2026-01-08',
    bleeding: 'medium',
    symptoms: ['cramps', 'fatigue'],
    mood: 'low',
    notes: 'Longer winter cycle start.',
  },
  {
    id: 'qa-log-2026-01-09',
    logDate: '2026-01-09',
    bleeding: 'light',
    symptoms: ['headache'],
    mood: 'steady',
  },
  {
    id: 'qa-log-2026-02-05',
    logDate: '2026-02-05',
    bleeding: 'heavy',
    symptoms: ['cramps', 'bloating'],
    mood: 'sensitive',
    notes: 'Irregular cycle following travel.',
  },
  {
    id: 'qa-log-2026-02-06',
    logDate: '2026-02-06',
    bleeding: 'medium',
    symptoms: ['fatigue'],
    birthControlEvent: {
      method: 'pill',
      lateDose: true,
    },
    notes: 'Late pill after timezone change.',
  },
  {
    id: 'qa-log-2026-03-11',
    logDate: '2026-03-11',
    bleeding: 'medium',
    symptoms: ['acne', 'bloating'],
    mood: 'low',
    notes: 'PMDD symptoms stronger than usual.',
  },
  {
    id: 'qa-log-2026-03-12',
    logDate: '2026-03-12',
    bleeding: 'light',
    symptoms: ['fatigue', 'sleep-changes'],
    mood: 'sensitive',
  },
  {
    id: 'qa-log-2026-04-01',
    logDate: '2026-04-01',
    bleeding: 'heavy',
    symptoms: ['cramps', 'breast-tenderness'],
    mood: 'low',
    notes: 'Current cycle start.',
  },
  {
    id: 'qa-log-2026-04-02',
    logDate: '2026-04-02',
    bleeding: 'medium',
    symptoms: ['fatigue'],
    mood: 'steady',
  },
  {
    id: 'qa-log-2026-04-12',
    logDate: '2026-04-12',
    bleeding: 'none',
    symptoms: ['discharge'],
    mood: 'energized',
    ttcObservation: {
      cervicalMucus: 'egg-white',
      basalBodyTemperatureCelsius: 36.48,
    },
    notes: 'Likely fertile window opening.',
  },
  {
    id: 'qa-log-2026-04-13',
    logDate: '2026-04-13',
    bleeding: 'none',
    symptoms: ['sex'],
    mood: 'steady',
    ttcObservation: {
      ovulationTest: 'positive',
      sexLogged: true,
      basalBodyTemperatureCelsius: 36.67,
    },
    notes: 'Positive ovulation test.',
  },
  {
    id: 'qa-log-2026-04-14',
    logDate: '2026-04-14',
    bleeding: 'none',
    symptoms: ['fatigue'],
    mood: 'energized',
    ttcObservation: {
      cervicalMucus: 'creamy',
      basalBodyTemperatureCelsius: 36.71,
    },
  },
];

export function buildQaRichHistoryDailyLogs(todayIso: string): DailyLogEntry[] {
  return qaRichHistoryDailyLogsFixed.map((entry) => {
    const anchoredLogDate = anchorDate(entry.logDate, todayIso);
    return {
      ...entry,
      id: `qa-log-${anchoredLogDate}`,
      logDate: anchoredLogDate,
    };
  });
}

export const qaRichHistoryReminderPreferences: ReminderPreference[] = [
  {
    kind: 'daily-log',
    enabled: true,
    hour: 20,
    minute: 0,
    schedule: {
      cadence: 'daily',
    },
  },
  {
    kind: 'period-start',
    enabled: true,
    hour: 9,
    minute: 0,
    schedule: {
      cadence: 'cycle-event',
      daysBefore: 0,
    },
  },
  {
    kind: 'fertile-window',
    enabled: true,
    hour: 8,
    minute: 30,
    schedule: {
      cadence: 'cycle-event',
      daysBefore: 1,
    },
  },
  {
    kind: 'birth-control',
    enabled: true,
    hour: 7,
    minute: 45,
    schedule: {
      cadence: 'daily',
    },
  },
];

export type QaRichHistoryDataset = {
  profile: UserProfile;
  dailyLogs: DailyLogEntry[];
  reminderPreferences: ReminderPreference[];
};

/**
 * Assembles the full rich-history dataset (profile + logs + reminders)
 * anchored to `todayIso`, mirroring the `TenureDataset` shape so live
 * consumers can seed the QA tracker with data that always looks current.
 */
export function buildQaRichHistoryDataset(todayIso: string): QaRichHistoryDataset {
  return {
    profile: buildQaRichHistoryProfile(todayIso),
    dailyLogs: buildQaRichHistoryDailyLogs(todayIso),
    reminderPreferences: qaRichHistoryReminderPreferences,
  };
}

export const qaClueImportFixture = {
  data: [
    {
      day: '2026-04-12T06:00:00.000Z',
      flow: 'light',
      symptoms: ['cramps'],
      bloating: true,
      note: 'Imported from Clue fixture.',
    },
    {
      day: '2026-04-13T06:30:00.000Z',
      period: 'heavy',
      emotion: 'anxious',
      symptoms: ['fatigue'],
    },
  ],
} as const;

export const qaFloImportFixture = {
  values: [
    {
      recordedAt: '2026-04-14T08:00:00.000Z',
      category: 'flow',
      value: 'medium',
    },
    {
      recordedAt: '2026-04-14T08:01:00.000Z',
      category: 'symptom',
      value: ['fatigue'],
    },
    {
      recordedAt: '2026-04-14T08:02:00.000Z',
      category: 'mood',
      value: 'steady',
    },
    {
      recordedAt: '2026-04-14T08:03:00.000Z',
      category: 'ovulation test',
      value: 'positive',
    },
  ],
} as const;

function buildQaBackupImportSessions(todayIso: string): ImportSession[] {
  return [
    {
      id: 'qa-import-clue-apr-2026',
      source: 'clue',
      status: 'committed',
      startedAt: anchorDateTime('2026-04-15T08:00:00.000Z', todayIso),
      completedAt: anchorDateTime('2026-04-15T08:03:00.000Z', todayIso),
      importedLogCount: 2,
      skippedLogCount: 0,
    },
  ];
}

export const qaImportReadySelectedFileLabel = 'clue-export-fixture.json';
export const qaBackupReadySelectedFileLabel = 'qa-rich-history-backup.floriva';

export function createImportReadyPreview(todayIso: string): ImportPreview {
  return {
    source: 'clue',
    dateRange: {
      startIso: anchorDate('2026-04-12', todayIso),
      endIso: anchorDate('2026-04-13', todayIso),
    },
    importableEntries: [
      {
        logDate: anchorDate('2026-04-12', todayIso),
        bleeding: 'light',
        symptoms: ['cramps', 'bloating'],
        notes: 'Imported from Clue fixture.',
      },
      {
        logDate: anchorDate('2026-04-13', todayIso),
        bleeding: 'heavy',
        symptoms: ['fatigue'],
        mood: 'sensitive',
      },
    ],
    duplicateLocalDates: [],
    skippedRows: [],
    warnings: [],
  };
}

export function createQaRichHistoryBackupSnapshot(todayIso: string): BackupSnapshot {
  const importSessions = buildQaBackupImportSessions(todayIso);
  // The two logs the fixture import session tagged, anchored the same way the
  // logs themselves are -- so the tags stay attached to the same entries no
  // matter which `todayIso` the fixture is anchored to.
  const importTaggedFertileOpen = anchorDate('2026-04-12', todayIso);
  const importTaggedOpkPositive = anchorDate('2026-04-13', todayIso);

  return {
    formatVersion: 1,
    exportedAt: anchorDateTime('2026-04-16T18:30:00.000Z', todayIso),
    appPreferences: {
      ...defaultAppPreferences,
      hasCompletedOnboarding: true,
      deferredBiometricsSetup: true,
      deferredReminderSetup: false,
      deferredImportSetup: false,
    },
    billingSnapshot: {
      accessState: 'needs_purchase',
      lastSyncedAt: anchorDateTime('2026-04-16T17:00:00.000Z', todayIso),
    },
    userProfile: buildQaRichHistoryProfile(todayIso),
    reminderPreferences: qaRichHistoryReminderPreferences,
    privacyPreference: {
      ...defaultPrivacyPreference,
      biometricsEnabled: false,
      relockAfterSeconds: 300,
    },
    importSessions,
    dailyLogs: buildQaRichHistoryDailyLogs(todayIso).map((entry) =>
      entry.logDate === importTaggedFertileOpen || entry.logDate === importTaggedOpkPositive
        ? {
            ...entry,
            importSessionId: 'qa-import-clue-apr-2026',
          }
        : entry,
    ),
  };
}

export function createBackupReadyRestorePreview(todayIso: string): BackupRestorePreview {
  const snapshot = createQaRichHistoryBackupSnapshot(todayIso);

  return {
    snapshot,
    importedLogCount: snapshot.dailyLogs.length,
    importSessionCount: snapshot.importSessions.length,
    periodStartCount: snapshot.dailyLogs.filter((entry) => entry.bleeding !== 'none').length,
    exportedDate: snapshot.exportedAt.slice(0, 10),
    firstLogDate: snapshot.dailyLogs
      .map((entry) => entry.logDate)
      .sort((left, right) => left.localeCompare(right))[0],
    lastLogDate: snapshot.dailyLogs
      .map((entry) => entry.logDate)
      .sort((left, right) => left.localeCompare(right))
      .at(-1),
    reminderCount: snapshot.reminderPreferences.filter((reminder) => reminder.enabled).length,
    hasCycleProfile: Boolean(snapshot.userProfile),
    willDisableBiometrics: snapshot.privacyPreference.biometricsEnabled,
    requiresBillingRevalidation:
      snapshot.billingSnapshot.accessState === 'trial_active' ||
      snapshot.billingSnapshot.accessState === 'subscribed',
  };
}
