import { buildPrivateTimelineModel } from '@/src/features/timeline/buildPrivateTimelineModel';
import type { DailyLogEntry } from '@/src/types/domain';

function createLog(overrides: Partial<DailyLogEntry>): DailyLogEntry {
  return {
    id: overrides.id ?? 'log-1',
    logDate: overrides.logDate ?? '2026-04-18',
    bleeding: overrides.bleeding ?? 'none',
    symptoms: overrides.symptoms ?? [],
    ...overrides,
  };
}

describe('buildPrivateTimelineModel', () => {
  it('builds date-sorted entries for logs, notes, TTC, birth-control, imports, reminders, and backups', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [
        createLog({
          id: 'log-rich',
          logDate: '2026-04-18',
          bleeding: 'medium',
          symptoms: ['cramps', 'fatigue'],
          mood: 'low',
          notes: 'Felt better after resting.',
          ttcObservation: {
            ovulationTest: 'positive',
            cervicalMucus: 'egg-white',
            basalBodyTemperatureCelsius: 36.58,
            sexLogged: true,
          },
          birthControlEvent: {
            method: 'pill',
            lateDose: true,
          },
          importSessionId: 'import-clue',
        }),
      ],
      imports: [
        {
          id: 'import-clue',
          source: 'clue',
          status: 'committed',
          startedAt: '2026-04-17T12:00:00.000Z',
          completedAt: '2026-04-17T12:05:00.000Z',
          importedLogCount: 12,
          skippedLogCount: 2,
        },
      ],
      reminders: [
        {
          kind: 'birth-control',
          enabled: true,
          date: '2026-04-21',
          label: 'Birth-control reminder',
          detail: 'Daily at 9:00 PM',
        },
      ],
      backupEvents: [
        {
          id: 'backup-1',
          action: 'exported',
          date: '2026-04-19',
          detail: 'Encrypted Floriva backup created.',
        },
      ],
    });

    expect(model.items.map((item) => item.kind)).toEqual([
      'reminder',
      'backup',
      'birth-control',
      'daily-log',
      'monthly-briefing',
      'note',
      'ttc',
      'import',
    ]);
    expect(model.counts).toMatchObject({
      backup: 1,
      'birth-control': 1,
      'daily-log': 1,
      import: 1,
      'monthly-briefing': 1,
      note: 1,
      reminder: 1,
      ttc: 1,
    });
    expect(model.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'daily-log',
          detail: 'Medium bleeding · Cramps and Fatigue · Low mood',
          meta: 'Imported history',
          sensitive: true,
        }),
        expect.objectContaining({
          kind: 'note',
          detail: 'Private note saved.',
          sourceHref: '/calendar/day/2026-04-18',
        }),
        expect.objectContaining({
          kind: 'ttc',
          detail:
            'Ovulation test: positive · Cervical mucus: egg-white · BBT: 36.58 C · Sex logged',
        }),
        expect.objectContaining({
          kind: 'birth-control',
          detail: 'Method: pill · Late dose',
        }),
        expect.objectContaining({
          kind: 'import',
          title: 'Clue import',
          detail: '12 entries imported · 2 skipped',
          sourceHref: '/import',
        }),
        expect.objectContaining({
          kind: 'monthly-briefing',
          title: 'Monthly briefing',
          detail: '1 local log reviewed',
          meta: 'Local monthly summary',
          sourceHref: '/insights/monthly-briefing',
        }),
        expect.objectContaining({
          kind: 'reminder',
          meta: 'Active local reminder',
          sensitive: false,
          sourceHref: '/settings/reminders',
        }),
        expect.objectContaining({
          kind: 'backup',
          title: 'Backup exported',
          meta: 'Encrypted backup',
          sourceHref: '/backup',
        }),
      ]),
    );

    // UL-28: rows whose only meta was a privacy reassurance carry none --
    // the summary card and Private badge already make that promise once.
    const noteItem = model.items.find((item) => item.kind === 'note');
    expect(noteItem?.meta).toBeUndefined();
  });

  it('keeps empty counts stable when no timeline sources exist', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [],
      imports: [],
      reminders: [],
    });

    expect(model.items).toEqual([]);
    expect(model.counts).toEqual({
      backup: 0,
      'birth-control': 0,
      'daily-log': 0,
      import: 0,
      'monthly-briefing': 0,
      note: 0,
      reminder: 0,
      ttc: 0,
    });
  });

  it('uses default English row copy for compact one-item details and all import sources', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [
        createLog({
          id: 'log-single-symptom',
          symptoms: ['cramps'],
        }),
      ],
      imports: [
        {
          id: 'import-flo',
          source: 'flo',
          status: 'committed',
          startedAt: '2026-04-17T12:00:00.000Z',
          importedLogCount: 1,
          skippedLogCount: 0,
        },
        {
          id: 'import-manual',
          source: 'manual',
          status: 'committed',
          startedAt: '2026-04-16T12:00:00.000Z',
          importedLogCount: 3,
          skippedLogCount: 1,
        },
      ],
      reminders: [],
    });

    expect(model.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'daily-log',
          detail: 'No bleeding · Cramps',
        }),
        expect.objectContaining({
          kind: 'import',
          title: 'Flo import',
          detail: '1 entry imported',
        }),
        expect.objectContaining({
          kind: 'import',
          title: 'manual history import',
          detail: '3 entries imported · 1 skipped',
        }),
      ]),
    );
  });
});
