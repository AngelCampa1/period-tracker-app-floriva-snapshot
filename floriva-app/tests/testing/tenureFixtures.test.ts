import { detectBbtShift } from '@/src/lib/predictions/signals/bbtShift';
import { detectOpkSurge } from '@/src/lib/predictions/signals/opkSurge';
import { detectMucusPeak } from '@/src/lib/predictions/signals/mucusPeak';
import { buildTenureDataset, tenureFixtureVariantValues } from '@/src/testing/tenureFixtures';
import { moodValueValues, symptomKeyValues } from '@/src/types/domain';

const TODAY_ISO = '2026-07-07';

/**
 * Groups bleeding (non-spotting) log dates into period clusters and returns
 * each cluster's earliest date. Bleeding-day logging in the fixtures is
 * probabilistic (a real user doesn't log every single day), so a single
 * missed day mid-period must NOT be mistaken for two separate periods --
 * dates within `maxGapDays` of the current cluster's most recent date are
 * merged into the same cluster.
 */
function periodStartDates(dataset: ReturnType<typeof buildTenureDataset>, maxGapDays = 3) {
  const bleedingDates = dataset.dailyLogs
    .filter((log) => log.bleeding !== 'none' && log.bleeding !== 'spotting')
    .map((log) => log.logDate)
    .sort();

  const starts: string[] = [];
  let clusterStart: string | null = null;
  let clusterLast: string | null = null;

  for (const date of bleedingDates) {
    if (clusterLast === null) {
      clusterStart = date;
      clusterLast = date;
      continue;
    }

    const gapDays = Math.round(
      (new Date(`${date}T00:00:00Z`).getTime() - new Date(`${clusterLast}T00:00:00Z`).getTime()) /
        86_400_000,
    );

    if (gapDays > maxGapDays) {
      starts.push(clusterStart!);
      clusterStart = date;
    }

    clusterLast = date;
  }

  if (clusterStart !== null) {
    starts.push(clusterStart);
  }

  return starts;
}

describe('tenureFixtures determinism', () => {
  it.each(tenureFixtureVariantValues)(
    'produces an identical dataset for %s across repeated calls with the same inputs',
    (variant) => {
      const first = buildTenureDataset(variant, TODAY_ISO);
      const second = buildTenureDataset(variant, TODAY_ISO);

      expect(second).toStrictEqual(first);
    },
  );

  it('produces a different dataset when todayIso changes', () => {
    const a = buildTenureDataset('tenure-3mo-regular', '2026-07-07');
    const b = buildTenureDataset('tenure-3mo-regular', '2026-08-07');

    expect(a).not.toStrictEqual(b);
  });

  it('produces a different dataset across variants for the same todayIso', () => {
    const a = buildTenureDataset('tenure-3mo-regular', TODAY_ISO);
    const b = buildTenureDataset('tenure-12mo-irregular', TODAY_ISO);

    expect(a).not.toStrictEqual(b);
  });
});

describe('tenureFixtures: no future dates', () => {
  it.each(tenureFixtureVariantValues)('%s never logs a date after todayIso', (variant) => {
    const dataset = buildTenureDataset(variant, TODAY_ISO);

    for (const log of dataset.dailyLogs) {
      expect(log.logDate <= TODAY_ISO).toBe(true);
    }
  });

  it.each(tenureFixtureVariantValues)(
    '%s never sets lastPeriodStartDate after todayIso',
    (variant) => {
      const dataset = buildTenureDataset(variant, TODAY_ISO);

      if (dataset.profile.lastPeriodStartDate) {
        expect(dataset.profile.lastPeriodStartDate <= TODAY_ISO).toBe(true);
      }
    },
  );
});

describe('tenureFixtures: per-variant invariants', () => {
  it('tenure-1mo-new has 1 full cycle plus a partial, with a mid-range logging rate', () => {
    const dataset = buildTenureDataset('tenure-1mo-new', TODAY_ISO);
    const starts = periodStartDates(dataset);

    expect(starts.length).toBeGreaterThanOrEqual(2);
    expect(dataset.dailyLogs.length).toBeGreaterThan(0);
    // ~60% logging rate is a soft target -- assert it's neither ~100% dense
    // nor near-empty. The dataset spans roughly one cycle length (~28 days).
    expect(dataset.dailyLogs.length).toBeLessThan(28);
    expect(dataset.dailyLogs.length).toBeGreaterThan(5);
  });

  it('tenure-3mo-regular has 3 cycles each within 28 +/- 1 days', () => {
    const dataset = buildTenureDataset('tenure-3mo-regular', TODAY_ISO);
    const starts = periodStartDates(dataset);

    expect(starts.length).toBe(3);
    for (let i = 1; i < starts.length; i += 1) {
      const gapDays = Math.round(
        (new Date(`${starts[i]}T00:00:00Z`).getTime() -
          new Date(`${starts[i - 1]}T00:00:00Z`).getTime()) /
          86_400_000,
      );
      expect(gapDays).toBeGreaterThanOrEqual(27);
      expect(gapDays).toBeLessThanOrEqual(29);
    }
  });

  it('tenure-3mo-regular gives the engine real BBT/OPK/mucus signals to consume', () => {
    const dataset = buildTenureDataset('tenure-3mo-regular', TODAY_ISO);

    const bbt = detectBbtShift(dataset.dailyLogs);
    const opk = detectOpkSurge(dataset.dailyLogs);
    const mucus = detectMucusPeak(dataset.dailyLogs);

    expect(bbt).not.toBeNull();
    expect(opk).not.toBeNull();
    expect(mucus).not.toBeNull();
  });

  it('tenure-6mo-gap has a ~3-month gap between the 2nd and 3rd period starts', () => {
    const dataset = buildTenureDataset('tenure-6mo-gap', TODAY_ISO);
    const starts = periodStartDates(dataset);

    expect(starts.length).toBe(4);

    const gaps = starts.slice(1).map((start, index) => {
      const previous = starts[index]!;
      return Math.round(
        (new Date(`${start}T00:00:00Z`).getTime() - new Date(`${previous}T00:00:00Z`).getTime()) /
          86_400_000,
      );
    });

    // Exactly one large gap (the resumption gap) among the three inter-start
    // gaps; the other two should be normal cycle-length gaps.
    const largeGaps = gaps.filter((gap) => gap > 60);
    expect(largeGaps.length).toBe(1);
    expect(largeGaps[0]).toBeGreaterThanOrEqual(100);
  });

  it('tenure-12mo-regular has ~13 cycle starts and 300+ logs with full data volume', () => {
    const dataset = buildTenureDataset('tenure-12mo-regular', TODAY_ISO);
    const starts = periodStartDates(dataset);

    expect(starts.length).toBeGreaterThanOrEqual(12);
    expect(starts.length).toBeLessThanOrEqual(14);
    expect(dataset.dailyLogs.length).toBeGreaterThanOrEqual(300);
  });

  it('tenure-12mo-regular spans a full year (oldest to newest >= ~330 days)', () => {
    const dataset = buildTenureDataset('tenure-12mo-regular', TODAY_ISO);
    const oldest = dataset.dailyLogs[0]!.logDate;
    const newest = dataset.dailyLogs.at(-1)!.logDate;
    const spanDays = Math.round(
      (new Date(`${newest}T00:00:00Z`).getTime() - new Date(`${oldest}T00:00:00Z`).getTime()) /
        86_400_000,
    );

    expect(spanDays).toBeGreaterThanOrEqual(330);
  });

  it('tenure-12mo-regular exercises real BBT/OPK/mucus signals for its recent cycles', () => {
    const dataset = buildTenureDataset('tenure-12mo-regular', TODAY_ISO);

    const bbt = detectBbtShift(dataset.dailyLogs);
    const opk = detectOpkSurge(dataset.dailyLogs);
    const mucus = detectMucusPeak(dataset.dailyLogs);

    expect(bbt).not.toBeNull();
    expect(opk).not.toBeNull();
    expect(mucus).not.toBeNull();
  });

  it('tenure-12mo-regular includes at least one lateDose pill event', () => {
    const dataset = buildTenureDataset('tenure-12mo-regular', TODAY_ISO);
    const lateDoseEvents = dataset.dailyLogs.filter(
      (log) => log.birthControlEvent?.lateDose === true,
    );

    expect(lateDoseEvents.length).toBeGreaterThan(0);
  });

  it('tenure-12mo-regular uses every symptom key and every mood value at least once', () => {
    const dataset = buildTenureDataset('tenure-12mo-regular', TODAY_ISO);
    const usedSymptoms = new Set(dataset.dailyLogs.flatMap((log) => log.symptoms));
    const usedMoods = new Set(
      dataset.dailyLogs.map((log) => log.mood).filter((mood): mood is NonNullable<typeof mood> => Boolean(mood)),
    );

    for (const symptom of symptomKeyValues) {
      expect(usedSymptoms.has(symptom)).toBe(true);
    }
    for (const mood of moodValueValues) {
      expect(usedMoods.has(mood)).toBe(true);
    }
  });

  it('tenure-12mo-regular includes at least one 300+ char note', () => {
    const dataset = buildTenureDataset('tenure-12mo-regular', TODAY_ISO);
    const longNotes = dataset.dailyLogs.filter((log) => (log.notes?.length ?? 0) > 300);

    expect(longNotes.length).toBeGreaterThan(0);
  });

  it('tenure-12mo-irregular has cycles ranging from 24 to 60 days', () => {
    const dataset = buildTenureDataset('tenure-12mo-irregular', TODAY_ISO);
    const starts = periodStartDates(dataset);

    expect(starts.length).toBeGreaterThanOrEqual(8);

    const gaps: number[] = [];
    for (let i = 1; i < starts.length; i += 1) {
      const gapDays = Math.round(
        (new Date(`${starts[i]}T00:00:00Z`).getTime() -
          new Date(`${starts[i - 1]}T00:00:00Z`).getTime()) /
          86_400_000,
      );
      gaps.push(gapDays);
    }

    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(20);
    expect(Math.max(...gaps)).toBeGreaterThanOrEqual(55);

    // "missed period" shape: at least one gap far exceeding a normal cycle.
    expect(gaps.some((gap) => gap >= 55)).toBe(true);
  });

  it('tenure-12mo-irregular includes spotting-only days', () => {
    const dataset = buildTenureDataset('tenure-12mo-irregular', TODAY_ISO);
    const spottingDays = dataset.dailyLogs.filter((log) => log.bleeding === 'spotting');

    expect(spottingDays.length).toBeGreaterThan(0);
  });

  it('tenure-12mo-irregular produces conflicting/noisy TTC signals (no confirmed BBT shift)', () => {
    const dataset = buildTenureDataset('tenure-12mo-irregular', TODAY_ISO);

    // The irregular variant deliberately scatters non-coherent BBT noise, so
    // no 3-over-6 coverline shift should ever confirm across the whole
    // history when run over everything at once (the detector's single-cycle
    // caller contract makes a spurious cross-cycle confirmation possible in
    // principle, but the noise here is tuned to stay below the +0.2C
    // sustained-3-day bar).
    const bbt = detectBbtShift(dataset.dailyLogs);
    expect(bbt).toBeNull();

    const opkPositives = dataset.dailyLogs.filter(
      (log) => log.ttcObservation?.ovulationTest === 'positive',
    );
    const mucusPeaks = dataset.dailyLogs.filter(
      (log) => log.ttcObservation?.cervicalMucus === 'egg-white',
    );
    expect(opkPositives.length).toBeGreaterThan(0);
    expect(mucusPeaks.length).toBeGreaterThan(0);
  });

  it('tenure-lapsed has ~12 months of history but the last log is ~70 days before today', () => {
    const dataset = buildTenureDataset('tenure-lapsed', TODAY_ISO);
    const newestLog = dataset.dailyLogs.at(-1)!;
    const ageDays = Math.round(
      (new Date(`${TODAY_ISO}T00:00:00Z`).getTime() -
        new Date(`${newestLog.logDate}T00:00:00Z`).getTime()) /
        86_400_000,
    );

    expect(ageDays).toBeGreaterThanOrEqual(65);
    expect(ageDays).toBeLessThanOrEqual(75);

    const oldestLog = dataset.dailyLogs[0]!;
    const spanDays = Math.round(
      (new Date(`${newestLog.logDate}T00:00:00Z`).getTime() -
        new Date(`${oldestLog.logDate}T00:00:00Z`).getTime()) /
        86_400_000,
    );
    expect(spanDays).toBeGreaterThanOrEqual(300);
  });
});

describe('tenureFixtures: DST / year-boundary coverage', () => {
  it('tenure-12mo-regular spans both the year boundary and both US DST transition windows', () => {
    const dataset = buildTenureDataset('tenure-12mo-regular', TODAY_ISO);
    const logDates = new Set(dataset.dailyLogs.map((log) => log.logDate));
    const oldest = dataset.dailyLogs[0]!.logDate;
    const newest = dataset.dailyLogs.at(-1)!.logDate;

    // Year boundary: the 12-month span (ending 2026-07-07) must reach back
    // across Dec 31 / Jan 1.
    expect(oldest <= '2025-12-31').toBe(true);
    expect(newest >= '2026-01-01').toBe(true);

    // Both DST windows must fall within the dataset's overall date span.
    expect(oldest <= '2025-11-01' && newest >= '2025-11-01').toBe(true);
    expect(oldest <= '2026-03-08' && newest >= '2026-03-08').toBe(true);

    // At least one logged day should land within a few days of each
    // transition (not just "the span crosses it" but "there's a nearby log").
    const near = (anchorIso: string) =>
      [...logDates].some((logDate) => {
        const diff = Math.abs(
          (new Date(`${logDate}T00:00:00Z`).getTime() - new Date(`${anchorIso}T00:00:00Z`).getTime()) /
            86_400_000,
        );
        return diff <= 10;
      });

    expect(near('2025-11-01')).toBe(true);
    expect(near('2026-03-08')).toBe(true);
  });
});
