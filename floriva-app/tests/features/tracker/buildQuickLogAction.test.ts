import type { DailyLogEntry, PredictionSnapshot } from '@/src/types/domain';

import { buildQuickLogAction } from '@/src/features/tracker/buildQuickLogAction';

function createSnapshot(overrides: Partial<PredictionSnapshot> = {}): PredictionSnapshot {
  return {
    cycleDay: 24,
    cycleLengthDays: 28,
    periodLengthDays: 5,
    cycleDayLabel: 'Cycle day 24',
    nextPeriodStartIso: '2026-04-25',
    fertileWindowLabel: 'Fertile window ended 9 days ago',
    fertileWindowStartOffsetDays: 9,
    confidenceLevel: 'medium',
    confidenceLabel: 'Medium confidence',
    confidenceBasisLabel: 'Based on 2 local cycle starts',
    confidenceReasonCodes: [],
    limitations: [],
    ...overrides,
  };
}

function createEntry(overrides: Partial<DailyLogEntry> = {}): DailyLogEntry {
  return {
    id: 'daily-log-2026-04-25',
    logDate: '2026-04-25',
    bleeding: 'none',
    symptoms: [],
    ...overrides,
  };
}

describe('buildQuickLogAction', () => {
  it('is hidden 3 days before the predicted period start', () => {
    const snapshot = createSnapshot({ nextPeriodStartIso: '2026-04-25' });

    const action = buildQuickLogAction({
      todayIso: '2026-04-22',
      snapshot,
      todayEntry: null,
    });

    expect(action.visible).toBe(false);
  });

  it('is shown exactly 2 days before the predicted period start', () => {
    const snapshot = createSnapshot({ nextPeriodStartIso: '2026-04-25' });

    const action = buildQuickLogAction({
      todayIso: '2026-04-23',
      snapshot,
      todayEntry: null,
    });

    expect(action.visible).toBe(true);
  });

  it('is shown exactly 3 days after the predicted period start', () => {
    const snapshot = createSnapshot({ nextPeriodStartIso: '2026-04-25' });

    const action = buildQuickLogAction({
      todayIso: '2026-04-28',
      snapshot,
      todayEntry: null,
    });

    expect(action.visible).toBe(true);
  });

  it('is hidden 4 days after the predicted period start', () => {
    const snapshot = createSnapshot({ nextPeriodStartIso: '2026-04-25' });

    const action = buildQuickLogAction({
      todayIso: '2026-04-29',
      snapshot,
      todayEntry: null,
    });

    expect(action.visible).toBe(false);
  });

  it('is shown on the predicted period start date itself', () => {
    const snapshot = createSnapshot({ nextPeriodStartIso: '2026-04-25' });

    const action = buildQuickLogAction({
      todayIso: '2026-04-25',
      snapshot,
      todayEntry: null,
    });

    expect(action.visible).toBe(true);
  });

  it('is hidden when there is no prediction (no nextPeriodStartIso)', () => {
    const snapshot = createSnapshot({ nextPeriodStartIso: undefined });

    const action = buildQuickLogAction({
      todayIso: '2026-04-25',
      snapshot,
      todayEntry: null,
    });

    expect(action.visible).toBe(false);
  });

  it('is hidden when bleeding has already been logged today (non-none intensity)', () => {
    const snapshot = createSnapshot({ nextPeriodStartIso: '2026-04-25' });

    const action = buildQuickLogAction({
      todayIso: '2026-04-25',
      snapshot,
      todayEntry: createEntry({ bleeding: 'medium' }),
    });

    expect(action.visible).toBe(false);
  });

  it('is shown when today has an entry but bleeding is explicitly "none"', () => {
    const snapshot = createSnapshot({ nextPeriodStartIso: '2026-04-25' });

    const action = buildQuickLogAction({
      todayIso: '2026-04-25',
      snapshot,
      todayEntry: createEntry({ bleeding: 'none', symptoms: ['cramps'] }),
    });

    expect(action.visible).toBe(true);
  });

  it('is shown when today has no logged entry at all (null)', () => {
    const snapshot = createSnapshot({ nextPeriodStartIso: '2026-04-25' });

    const action = buildQuickLogAction({
      todayIso: '2026-04-25',
      snapshot,
      todayEntry: null,
    });

    expect(action.visible).toBe(true);
  });

  it('is hidden when bleeding is spotting', () => {
    const snapshot = createSnapshot({ nextPeriodStartIso: '2026-04-25' });

    const action = buildQuickLogAction({
      todayIso: '2026-04-25',
      snapshot,
      todayEntry: createEntry({ bleeding: 'spotting' }),
    });

    expect(action.visible).toBe(false);
  });
});
