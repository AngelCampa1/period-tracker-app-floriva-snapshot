import type { Href } from 'expo-router';

import type { ImportSessionStatus, ImportSource, ReminderKind } from '@/src/types/domain';

export type PrivateTimelineItemKind =
  | 'daily-log'
  | 'note'
  | 'ttc'
  | 'birth-control'
  | 'import'
  | 'monthly-briefing'
  | 'reminder'
  | 'backup';

export type PrivateTimelineItem = {
  id: string;
  kind: PrivateTimelineItemKind;
  date: string;
  title: string;
  detail: string;
  /**
   * Optional secondary line. UL-28: rows whose only meta was a privacy
   * reassurance ("Logged on this device" / "Only stored on this device")
   * carry none -- the screen's summary card and the Private badge already
   * make that promise; per-row repetition diluted it 27 times over.
   */
  meta?: string;
  sensitive: boolean;
  sourceHref: Href;
};

export type PrivateTimelineBackupEvent = {
  id: string;
  date: string;
  action: 'exported' | 'restored';
  detail: string;
};

export type PrivateTimelineImportSummary = {
  id: string;
  source: ImportSource;
  status: ImportSessionStatus;
  startedAt: string;
  completedAt?: string;
  importedLogCount: number;
  skippedLogCount: number;
};

export type PrivateTimelineReminderSummary = {
  kind: ReminderKind;
  enabled: boolean;
  date: string;
  label: string;
  detail: string;
};

export type PrivateTimelineModel = {
  items: PrivateTimelineItem[];
  counts: Record<PrivateTimelineItemKind, number>;
};
