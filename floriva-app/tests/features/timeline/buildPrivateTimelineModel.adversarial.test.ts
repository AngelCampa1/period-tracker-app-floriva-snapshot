/**
 * Adversarial tests for src/features/timeline/buildPrivateTimelineModel.ts
 *
 * Covers: entry ordering, duplicate dates, gaps, far-past/far-future, empty
 * history, unknown enum values, null arrays, birth-control / symptom label
 * isolation, and sensitive-data correctness.
 */
import { buildPrivateTimelineModel } from '@/src/features/timeline/buildPrivateTimelineModel';
import type { DailyLogEntry } from '@/src/types/domain';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLog(overrides: Partial<DailyLogEntry> = {}): DailyLogEntry {
  return {
    id: overrides.id ?? 'log-1',
    logDate: overrides.logDate ?? '2026-05-01',
    bleeding: overrides.bleeding ?? 'none',
    symptoms: overrides.symptoms ?? [],
    ...overrides,
  };
}

function emptyOptions() {
  return { dailyLogs: [], imports: [], reminders: [] };
}

// ---------------------------------------------------------------------------
// Ordering and determinism
// ---------------------------------------------------------------------------

describe('ordering and determinism', () => {
  it('sorts logs newest-first regardless of insertion order', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [
        makeLog({ id: 'log-c', logDate: '2026-03-01', bleeding: 'light' }),
        makeLog({ id: 'log-a', logDate: '2026-05-01', bleeding: 'heavy' }),
        makeLog({ id: 'log-b', logDate: '2026-04-01', bleeding: 'medium' }),
      ],
      imports: [],
      reminders: [],
    });

    const logItems = model.items.filter((i) => i.kind === 'daily-log');
    const dates = logItems.map((i) => i.date);

    expect(dates).toEqual(['2026-05-01', '2026-04-01', '2026-03-01']);
  });

  it('produces stable, deterministic ordering for duplicate dates by id', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [
        makeLog({ id: 'log-z', logDate: '2026-05-01', bleeding: 'light' }),
        makeLog({ id: 'log-a', logDate: '2026-05-01', bleeding: 'medium' }),
      ],
      imports: [],
      reminders: [],
    });

    const logItems = model.items.filter((i) => i.kind === 'daily-log');

    // Both have same date; tie-break is ascending by id
    expect(logItems[0]!.id).toBe('daily-log-log-a');
    expect(logItems[1]!.id).toBe('daily-log-log-z');
  });

  it('does not crash with a large (1 000-entry) history', () => {
    const dailyLogs = Array.from({ length: 1000 }, (_, i) => {
      const date = new Date(2020, 0, 1);

      date.setDate(date.getDate() + i);
      const iso = date.toISOString().slice(0, 10);

      return makeLog({ id: `log-${i}`, logDate: iso, bleeding: 'light' });
    });

    expect(() =>
      buildPrivateTimelineModel({ dailyLogs, imports: [], reminders: [] }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Gaps and boundaries
// ---------------------------------------------------------------------------

describe('gaps and date boundaries', () => {
  it('handles far-past dates (year 1970)', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [makeLog({ id: 'log-ancient', logDate: '1970-01-01', bleeding: 'light' })],
      imports: [],
      reminders: [],
    });

    expect(model.items.some((i) => i.date === '1970-01-01')).toBe(true);
  });

  it('handles far-future dates (year 2099)', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [makeLog({ id: 'log-future', logDate: '2099-12-31', bleeding: 'light' })],
      imports: [],
      reminders: [],
    });

    expect(model.items.some((i) => i.date === '2099-12-31')).toBe(true);
  });

  it('handles non-contiguous logs with large gaps correctly', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [
        makeLog({ id: 'log-1', logDate: '2020-01-01', bleeding: 'light' }),
        makeLog({ id: 'log-2', logDate: '2026-06-01', bleeding: 'heavy' }),
      ],
      imports: [],
      reminders: [],
    });

    const logItems = model.items.filter((i) => i.kind === 'daily-log');

    expect(logItems).toHaveLength(2);
    expect(logItems[0]!.date).toBe('2026-06-01');
    expect(logItems[1]!.date).toBe('2020-01-01');
  });
});

// ---------------------------------------------------------------------------
// Empty history
// ---------------------------------------------------------------------------

describe('empty history', () => {
  it('returns an empty model without crashing', () => {
    const model = buildPrivateTimelineModel(emptyOptions());

    expect(model.items).toEqual([]);
  });

  it('returns zeroed counts for every known kind', () => {
    const model = buildPrivateTimelineModel(emptyOptions());

    expect(model.counts['daily-log']).toBe(0);
    expect(model.counts['birth-control']).toBe(0);
    expect(model.counts['ttc']).toBe(0);
    expect(model.counts['note']).toBe(0);
    expect(model.counts['monthly-briefing']).toBe(0);
    expect(model.counts['import']).toBe(0);
    expect(model.counts['reminder']).toBe(0);
    expect(model.counts['backup']).toBe(0);
  });

  it('backupEvents defaults to [] — does not crash when omitted', () => {
    expect(() =>
      buildPrivateTimelineModel({ dailyLogs: [], imports: [], reminders: [] }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Sensitive-data correctness — no field mislabelling
// ---------------------------------------------------------------------------

describe('sensitive-data correctness — field isolation', () => {
  it('birth-control items never appear under the "daily-log" kind', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [
        makeLog({
          id: 'log-bc',
          logDate: '2026-05-02',
          bleeding: 'light',
          birthControlEvent: { method: 'pill', missedDose: true },
        }),
      ],
      imports: [],
      reminders: [],
    });

    const dailyLogItems = model.items.filter((i) => i.kind === 'daily-log');
    const bcItems = model.items.filter((i) => i.kind === 'birth-control');

    expect(dailyLogItems).toHaveLength(1);
    expect(bcItems).toHaveLength(1);

    // The daily-log detail must NOT contain "Method:" — that belongs to birth-control
    expect(dailyLogItems[0]!.detail).not.toContain('Method:');
    // The birth-control detail must NOT contain bleeding copy
    expect(bcItems[0]!.detail).not.toMatch(/bleeding/i);
  });

  it('ttc items never appear under the "daily-log" kind', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [
        makeLog({
          id: 'log-ttc',
          logDate: '2026-05-03',
          bleeding: 'light',
          ttcObservation: { ovulationTest: 'positive' },
        }),
      ],
      imports: [],
      reminders: [],
    });

    const dailyLogItems = model.items.filter((i) => i.kind === 'daily-log');
    const ttcItems = model.items.filter((i) => i.kind === 'ttc');

    expect(ttcItems).toHaveLength(1);
    // daily-log detail must NOT bleed ttc data into it
    expect(dailyLogItems[0]!.detail).not.toContain('Ovulation test');
  });

  it('symptom labels in daily-log detail must not contain birth-control method copy', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [
        makeLog({
          id: 'log-mixed',
          logDate: '2026-05-04',
          bleeding: 'medium',
          symptoms: ['cramps', 'fatigue'],
          birthControlEvent: { method: 'iud' },
        }),
      ],
      imports: [],
      reminders: [],
    });

    const dailyLogItem = model.items.find((i) => i.kind === 'daily-log');

    expect(dailyLogItem?.detail).toContain('Cramps');
    expect(dailyLogItem?.detail).toContain('Fatigue');
    expect(dailyLogItem?.detail).not.toContain('iud');
    expect(dailyLogItem?.detail).not.toContain('Method:');
  });

  it('all items derived from a DailyLogEntry share the same date', () => {
    const logDate = '2026-05-05';
    const model = buildPrivateTimelineModel({
      dailyLogs: [
        makeLog({
          id: 'log-full',
          logDate,
          bleeding: 'heavy',
          symptoms: ['cramps'],
          notes: 'Test note',
          ttcObservation: { sexLogged: true },
          birthControlEvent: { method: 'ring' },
        }),
      ],
      imports: [],
      reminders: [],
    });

    const entryItems = model.items.filter((i) =>
      ['daily-log', 'note', 'ttc', 'birth-control'].includes(i.kind),
    );

    expect(entryItems.length).toBeGreaterThanOrEqual(4);
    for (const item of entryItems) {
      expect(item.date).toBe(logDate);
    }
  });

  it('sensitive flag is true for daily-log, note, ttc, birth-control, and backup items', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [
        makeLog({
          id: 'log-sens',
          logDate: '2026-05-06',
          bleeding: 'light',
          notes: 'Private.',
          ttcObservation: { sexLogged: true },
          birthControlEvent: { method: 'pill' },
        }),
      ],
      imports: [],
      reminders: [],
      backupEvents: [{ id: 'bk-1', action: 'exported', date: '2026-05-06', detail: '' }],
    });

    const sensitiveKinds = ['daily-log', 'note', 'ttc', 'birth-control', 'backup'];

    for (const kind of sensitiveKinds) {
      const item = model.items.find((i) => i.kind === kind);

      expect(item).toBeDefined();
      expect(item?.sensitive).toBe(true);
    }
  });

  it('reminder items are not marked sensitive', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [],
      imports: [],
      reminders: [
        {
          kind: 'birth-control',
          enabled: false,
          date: '2026-05-07',
          label: 'Take pill',
          detail: 'Daily at 9 PM',
        },
      ],
    });

    const reminder = model.items.find((i) => i.kind === 'reminder');

    expect(reminder?.sensitive).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// BUG: unknown symptom values must not render as "undefined" in detail string
// ---------------------------------------------------------------------------

describe('unknown enum values — graceful handling', () => {
  /**
   * BUG: buildDailyLogDetail calls copy.symptoms[symptom] for each symptom.
   * If an unknown key is present (e.g. from a future app version), the lookup
   * returns undefined, and formatList produces a string like "Cramps and undefined".
   * This corrupts the timeline detail with a raw "undefined" string.
   */
  it('does not produce "undefined" in the detail string for unknown symptom keys', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [
        makeLog({
          id: 'log-unknown-sym',
          logDate: '2026-05-08',
          bleeding: 'light',
          // @ts-expect-error intentional unknown value
          symptoms: ['cramps', 'unknown-future-symptom'],
        }),
      ],
      imports: [],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'daily-log');

    expect(item).toBeDefined();
    expect(item?.detail).not.toContain('undefined');
  });

  /**
   * BUG: buildDailyLogDetail calls copy.bleeding[entry.bleeding] without a guard.
   * An unknown bleeding value returns undefined and appears in the detail string.
   */
  it('does not produce "undefined" in the detail string for an unknown bleeding value', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [
        makeLog({
          id: 'log-unknown-bleed',
          logDate: '2026-05-09',
          // @ts-expect-error intentional unknown value
          bleeding: 'torrential',
          symptoms: [],
        }),
      ],
      imports: [],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'daily-log');

    expect(item).toBeDefined();
    expect(item?.detail).not.toContain('undefined');
  });

  it('does not produce "undefined" in the detail string for an unknown mood value', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [
        makeLog({
          id: 'log-unknown-mood',
          logDate: '2026-05-08',
          bleeding: 'light',
          // @ts-expect-error intentional unknown value
          mood: 'ecstatic',
          symptoms: [],
        }),
      ],
      imports: [],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'daily-log');

    expect(item).toBeDefined();
    expect(item?.detail).not.toContain('undefined');
    // The raw key should appear as the fallback, not a blank
    expect(item?.detail).toContain('ecstatic');
  });

  it('known symptom labels are not dropped by filter(Boolean)', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [
        makeLog({
          id: 'log-known-syms',
          logDate: '2026-05-09',
          bleeding: 'light',
          symptoms: ['cramps', 'fatigue', 'headache'],
        }),
      ],
      imports: [],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'daily-log');

    expect(item?.detail).toContain('Cramps');
    expect(item?.detail).toContain('Fatigue');
    expect(item?.detail).toContain('Headache');
  });

  it('does not crash when symptoms array is empty', () => {
    expect(() =>
      buildPrivateTimelineModel({
        dailyLogs: [makeLog({ bleeding: 'light', symptoms: [] })],
        imports: [],
        reminders: [],
      }),
    ).not.toThrow();
  });

  it('does not crash when an import has no completedAt (falls back to startedAt)', () => {
    expect(() =>
      buildPrivateTimelineModel({
        dailyLogs: [],
        imports: [
          {
            id: 'import-no-complete',
            source: 'manual',
            status: 'pending',
            startedAt: '2026-05-10T08:00:00.000Z',
            importedLogCount: 0,
            skippedLogCount: 0,
          },
        ],
        reminders: [],
      }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Monthly briefing correctness
// ---------------------------------------------------------------------------

describe('monthly briefing', () => {
  it('monthly briefing counts only logs from the most recent month', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [
        makeLog({ id: 'may-1', logDate: '2026-05-01', bleeding: 'light' }),
        makeLog({ id: 'may-2', logDate: '2026-05-15', bleeding: 'medium' }),
        makeLog({ id: 'apr-1', logDate: '2026-04-10', bleeding: 'heavy' }),
      ],
      imports: [],
      reminders: [],
    });

    const briefing = model.items.find((i) => i.kind === 'monthly-briefing');

    expect(briefing).toBeDefined();
    // Only the 2 May logs should be counted, not the April log
    expect(briefing?.detail).toBe('2 local logs reviewed');
  });

  it('monthly briefing uses the most recent log date as its anchor date', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [
        makeLog({ id: 'log-early', logDate: '2026-05-01', bleeding: 'light' }),
        makeLog({ id: 'log-late', logDate: '2026-05-20', bleeding: 'medium' }),
      ],
      imports: [],
      reminders: [],
    });

    const briefing = model.items.find((i) => i.kind === 'monthly-briefing');

    expect(briefing?.date).toBe('2026-05-20');
  });

  it('monthly briefing is absent when there are no logs', () => {
    const model = buildPrivateTimelineModel(emptyOptions());

    expect(model.items.find((i) => i.kind === 'monthly-briefing')).toBeUndefined();
  });

  it('monthly briefing count is 1 for a single log', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [makeLog({ id: 'solo', logDate: '2026-05-10', bleeding: 'light' })],
      imports: [],
      reminders: [],
    });

    const briefing = model.items.find((i) => i.kind === 'monthly-briefing');

    expect(briefing?.detail).toBe('1 local log reviewed');
  });
});

// ---------------------------------------------------------------------------
// sourceHref correctness
// ---------------------------------------------------------------------------

describe('sourceHref correctness', () => {
  it('daily-log items link to the correct day route', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [makeLog({ id: 'log-href', logDate: '2026-05-11', bleeding: 'light' })],
      imports: [],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'daily-log');

    expect(item?.sourceHref).toBe('/calendar/day/2026-05-11');
  });

  it('birth-control items link to the same day route as their parent log', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [
        makeLog({
          id: 'log-bc-href',
          logDate: '2026-05-12',
          bleeding: 'light',
          birthControlEvent: { method: 'pill' },
        }),
      ],
      imports: [],
      reminders: [],
    });

    const item = model.items.find((i) => i.kind === 'birth-control');

    expect(item?.sourceHref).toBe('/calendar/day/2026-05-12');
  });
});

// ---------------------------------------------------------------------------
// Counts are in sync with items
// ---------------------------------------------------------------------------

describe('counts are in sync with items array', () => {
  it('counts match actual item array for a complex model', () => {
    const model = buildPrivateTimelineModel({
      dailyLogs: [
        makeLog({
          id: 'log-full-2',
          logDate: '2026-05-13',
          bleeding: 'heavy',
          symptoms: ['cramps'],
          notes: 'Note',
          ttcObservation: { sexLogged: true },
          birthControlEvent: { method: 'pill' },
        }),
        makeLog({ id: 'log-plain', logDate: '2026-04-01', bleeding: 'light' }),
      ],
      imports: [
        {
          id: 'import-1',
          source: 'clue',
          status: 'committed',
          startedAt: '2026-04-01T10:00:00.000Z',
          importedLogCount: 5,
          skippedLogCount: 0,
        },
      ],
      reminders: [
        {
          kind: 'daily-log',
          enabled: true,
          date: '2026-05-14',
          label: 'Log reminder',
          detail: 'Every day at 8 PM',
        },
      ],
      backupEvents: [{ id: 'bk-2', action: 'restored', date: '2026-05-13', detail: '' }],
    });

    for (const [kind, count] of Object.entries(model.counts)) {
      const actual = model.items.filter((i) => i.kind === kind).length;

      expect(actual).toBe(count);
    }
  });
});
