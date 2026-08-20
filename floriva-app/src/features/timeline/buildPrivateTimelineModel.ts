import type {
  BirthControlEvent,
  DailyLogEntry,
  BleedingIntensity,
  MoodValue,
  SymptomKey,
  TtcObservation,
} from '@/src/types/domain';
import type { Href } from 'expo-router';

import { normalizeTimelineDate } from '@/src/features/timeline/date';
import type {
  PrivateTimelineBackupEvent,
  PrivateTimelineImportSummary,
  PrivateTimelineItem,
  PrivateTimelineItemKind,
  PrivateTimelineModel,
  PrivateTimelineReminderSummary,
} from '@/src/features/timeline/types';

export type PrivateTimelineCopy = {
  bleeding: Record<BleedingIntensity, string>;
  mood: Record<MoodValue, string>;
  symptoms: Record<SymptomKey, string>;
  titles: {
    dailyLog: string;
    note: string;
    ttc: string;
    birthControl: string;
    monthlyBriefing: string;
    import: (source: PrivateTimelineImportSummary['source']) => string;
    backupExported: string;
    backupRestored: string;
  };
  meta: {
    importedHistory: string;
    fertilityContext: string;
    birthControlTracking: string;
    switchingHistory: string;
    monthlyBriefing: string;
    activeLocalReminder: string;
    reminderAvailable: string;
    encryptedBackup: string;
  };
  detail: {
    list: (values: string[]) => string;
    ovulationTest: (value: string) => string;
    cervicalMucus: (value: string) => string;
    basalBodyTemperature: (value: string) => string;
    sexLogged: string;
    ttcLogged: string;
    birthControlMethod: (method: string) => string;
    missedDose: string;
    lateDose: string;
    noteSaved: string;
    entriesImported: (count: number) => string;
    skippedEntries: (count: number) => string;
    monthlyBriefing: (count: number) => string;
    backupExported: string;
    backupRestored: string;
  };
};

type BuildPrivateTimelineModelOptions = {
  dailyLogs: DailyLogEntry[];
  imports: PrivateTimelineImportSummary[];
  reminders: PrivateTimelineReminderSummary[];
  backupEvents?: PrivateTimelineBackupEvent[];
  copy?: PrivateTimelineCopy;
};

const itemKinds: PrivateTimelineItemKind[] = [
  'daily-log',
  'note',
  'ttc',
  'birth-control',
  'import',
  'monthly-briefing',
  'reminder',
  'backup',
];

const defaultPrivateTimelineCopy: PrivateTimelineCopy = {
  bleeding: {
    none: 'No bleeding',
    spotting: 'Spotting',
    light: 'Light bleeding',
    medium: 'Medium bleeding',
    heavy: 'Heavy bleeding',
  },
  mood: {
    steady: 'Steady mood',
    low: 'Low mood',
    sensitive: 'Sensitive mood',
    energized: 'Energized mood',
  },
  symptoms: {
    cramps: 'Cramps',
    headache: 'Headache',
    bloating: 'Bloating',
    fatigue: 'Fatigue',
    'breast-tenderness': 'Breast tenderness',
    acne: 'Acne',
    discharge: 'Discharge',
    'sleep-changes': 'Sleep changes',
    'libido-changes': 'Libido changes',
    sex: 'Sex',
  },
  titles: {
    dailyLog: 'Daily log',
    note: 'Private note',
    ttc: 'TTC observation',
    birthControl: 'Birth-control log',
    monthlyBriefing: 'Monthly briefing',
    import: (source) => `${sourceLabel(source)} import`,
    backupExported: 'Backup exported',
    backupRestored: 'Backup restored',
  },
  meta: {
    importedHistory: 'Imported history',
    fertilityContext: 'Fertility context',
    birthControlTracking: 'Method-aware tracking',
    switchingHistory: 'Switching history',
    monthlyBriefing: 'Local monthly summary',
    activeLocalReminder: 'Active local reminder',
    reminderAvailable: 'Reminder available',
    encryptedBackup: 'Encrypted backup',
  },
  detail: {
    list: formatList,
    ovulationTest: (value) => `Ovulation test: ${value}`,
    cervicalMucus: (value) => `Cervical mucus: ${value}`,
    basalBodyTemperature: (value) => `BBT: ${value} C`,
    sexLogged: 'Sex logged',
    ttcLogged: 'TTC observation logged',
    birthControlMethod: (method) => `Method: ${method}`,
    missedDose: 'Missed dose',
    lateDose: 'Late dose',
    noteSaved: 'Private note saved.',
    entriesImported: (count) => (count === 1 ? '1 entry imported' : `${count} entries imported`),
    skippedEntries: (count) => `${count} skipped`,
    monthlyBriefing: (count) =>
      count === 1 ? '1 local log reviewed' : `${count} local logs reviewed`,
    backupExported: 'Encrypted Floriva backup created.',
    backupRestored: 'Floriva backup restored on this device.',
  },
};

function createEmptyCounts(): Record<PrivateTimelineItemKind, number> {
  return itemKinds.reduce<Record<PrivateTimelineItemKind, number>>((counts, kind) => {
    counts[kind] = 0;
    return counts;
  }, {} as Record<PrivateTimelineItemKind, number>);
}

function dayHref(date: string): Href {
  return `/calendar/day/${date}` as Href;
}

function formatList(values: string[]) {
  if (values.length === 0) {
    return '';
  }

  if (values.length === 1) {
    return values[0]!;
  }

  return `${values.slice(0, -1).join(', ')} and ${values[values.length - 1]}`;
}

function buildDailyLogDetail(entry: DailyLogEntry, copy: PrivateTimelineCopy) {
  const bleedingLabel = copy.bleeding[entry.bleeding] ?? entry.bleeding;
  const details = [bleedingLabel];

  if (entry.symptoms.length > 0) {
    const symptomLabels = entry.symptoms
      .map((symptom) => copy.symptoms[symptom] ?? symptom)
      .filter(Boolean);

    if (symptomLabels.length > 0) {
      details.push(copy.detail.list(symptomLabels));
    }
  }

  if (entry.mood) {
    const moodLabel = copy.mood[entry.mood] ?? entry.mood;

    details.push(moodLabel);
  }

  return details.join(' · ');
}

function buildTtcDetail(observation: TtcObservation, copy: PrivateTimelineCopy) {
  const details: string[] = [];

  if (observation.ovulationTest) {
    details.push(copy.detail.ovulationTest(observation.ovulationTest));
  }

  if (observation.cervicalMucus) {
    details.push(copy.detail.cervicalMucus(observation.cervicalMucus));
  }

  if (typeof observation.basalBodyTemperatureCelsius === 'number') {
    details.push(
      copy.detail.basalBodyTemperature(
        observation.basalBodyTemperatureCelsius.toFixed(2),
      ),
    );
  }

  if (observation.sexLogged) {
    details.push(copy.detail.sexLogged);
  }

  return details.length > 0 ? details.join(' · ') : copy.detail.ttcLogged;
}

function buildBirthControlDetail(event: BirthControlEvent, copy: PrivateTimelineCopy) {
  const details = [copy.detail.birthControlMethod(event.method)];

  if (event.missedDose) {
    details.push(copy.detail.missedDose);
  }

  if (event.lateDose) {
    details.push(copy.detail.lateDose);
  }

  return details.join(' · ');
}

function sourceLabel(source: PrivateTimelineImportSummary['source']) {
  switch (source) {
    case 'clue':
      return 'Clue';
    case 'flo':
      return 'Flo';
    case 'manual':
      return 'manual history';
  }
}

function pushItem(items: PrivateTimelineItem[], item: PrivateTimelineItem) {
  items.push(item);
}

function buildDailyLogItems(
  entry: DailyLogEntry,
  copy: PrivateTimelineCopy,
): PrivateTimelineItem[] {
  const items: PrivateTimelineItem[] = [];

  pushItem(items, {
    id: `daily-log-${entry.id}`,
    kind: 'daily-log',
    date: entry.logDate,
    title: copy.titles.dailyLog,
    detail: buildDailyLogDetail(entry, copy),
    // UL-28: "Logged on this device" was pure privacy reassurance repeated
    // on every row; the header already promises it once. Only the
    // informative "Imported history" distinction remains.
    ...(entry.importSessionId ? { meta: copy.meta.importedHistory } : {}),
    sensitive: true,
    sourceHref: dayHref(entry.logDate),
  });

  if (entry.notes?.trim()) {
    pushItem(items, {
      id: `note-${entry.id}`,
      kind: 'note',
      date: entry.logDate,
      title: copy.titles.note,
      detail: copy.detail.noteSaved,
      sensitive: true,
      sourceHref: dayHref(entry.logDate),
    });
  }

  if (entry.ttcObservation) {
    pushItem(items, {
      id: `ttc-${entry.id}`,
      kind: 'ttc',
      date: entry.logDate,
      title: copy.titles.ttc,
      detail: buildTtcDetail(entry.ttcObservation, copy),
      meta: copy.meta.fertilityContext,
      sensitive: true,
      sourceHref: dayHref(entry.logDate),
    });
  }

  if (entry.birthControlEvent) {
    pushItem(items, {
      id: `birth-control-${entry.id}`,
      kind: 'birth-control',
      date: entry.logDate,
      title: copy.titles.birthControl,
      detail: buildBirthControlDetail(entry.birthControlEvent, copy),
      meta: copy.meta.birthControlTracking,
      sensitive: true,
      sourceHref: dayHref(entry.logDate),
    });
  }

  return items;
}

function buildImportItem(
  importSummary: PrivateTimelineImportSummary,
  copy: PrivateTimelineCopy,
): PrivateTimelineItem {
  const importedLabel = copy.detail.entriesImported(importSummary.importedLogCount);
  const skippedLabel =
    importSummary.skippedLogCount > 0
      ? ` · ${copy.detail.skippedEntries(importSummary.skippedLogCount)}`
      : '';

  return {
    id: `import-${importSummary.id}`,
    kind: 'import',
    date: normalizeTimelineDate(importSummary.completedAt ?? importSummary.startedAt),
    title: copy.titles.import(importSummary.source),
    detail: `${importedLabel}${skippedLabel}`,
    meta: copy.meta.switchingHistory,
    sensitive: true,
    sourceHref: '/import' as Href,
  };
}

function buildReminderItem(
  reminder: PrivateTimelineReminderSummary,
  copy: PrivateTimelineCopy,
): PrivateTimelineItem {
  return {
    id: `reminder-${reminder.kind}`,
    kind: 'reminder',
    date: reminder.date,
    title: reminder.label,
    detail: reminder.detail,
    meta: reminder.enabled ? copy.meta.activeLocalReminder : copy.meta.reminderAvailable,
    sensitive: false,
    sourceHref: '/settings/reminders' as Href,
  };
}

function buildMonthlyBriefingItem(
  dailyLogs: DailyLogEntry[],
  copy: PrivateTimelineCopy,
): PrivateTimelineItem | null {
  const latestLog = [...dailyLogs].sort((left, right) =>
    right.logDate.localeCompare(left.logDate),
  )[0];

  if (!latestLog) {
    return null;
  }

  const monthPrefix = latestLog.logDate.slice(0, 7);
  const monthLogs = dailyLogs.filter((entry) => entry.logDate.startsWith(monthPrefix));

  return {
    id: `monthly-briefing-${monthPrefix}`,
    kind: 'monthly-briefing',
    date: latestLog.logDate,
    title: copy.titles.monthlyBriefing,
    detail: copy.detail.monthlyBriefing(monthLogs.length),
    meta: copy.meta.monthlyBriefing,
    sensitive: true,
    sourceHref: '/insights/monthly-briefing' as Href,
  };
}

function buildBackupItem(
  event: PrivateTimelineBackupEvent,
  copy: PrivateTimelineCopy,
): PrivateTimelineItem {
  return {
    id: `backup-${event.id}`,
    kind: 'backup',
    date: event.date,
    title: event.action === 'exported' ? copy.titles.backupExported : copy.titles.backupRestored,
    detail: event.action === 'exported' ? copy.detail.backupExported : copy.detail.backupRestored,
    meta: copy.meta.encryptedBackup,
    sensitive: true,
    sourceHref: '/backup' as Href,
  };
}

export function buildPrivateTimelineModel({
  backupEvents = [],
  dailyLogs,
  imports,
  reminders,
  copy = defaultPrivateTimelineCopy,
}: BuildPrivateTimelineModelOptions): PrivateTimelineModel {
  const monthlyBriefingItem = buildMonthlyBriefingItem(dailyLogs, copy);
  const items = [
    ...dailyLogs.flatMap((entry) => buildDailyLogItems(entry, copy)),
    ...(monthlyBriefingItem ? [monthlyBriefingItem] : []),
    ...imports.map((importSummary) => buildImportItem(importSummary, copy)),
    ...reminders.map((reminder) => buildReminderItem(reminder, copy)),
    ...backupEvents.map((event) => buildBackupItem(event, copy)),
  ].sort((left, right) => {
    const dateComparison = right.date.localeCompare(left.date);

    if (dateComparison !== 0) {
      return dateComparison;
    }

    return left.id.localeCompare(right.id);
  });
  const counts = createEmptyCounts();

  for (const item of items) {
    counts[item.kind] += 1;
  }

  return {
    items,
    counts,
  };
}
