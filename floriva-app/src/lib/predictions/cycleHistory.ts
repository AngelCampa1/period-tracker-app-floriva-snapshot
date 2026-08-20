import type { DailyLogEntry, PeriodEvidenceEntry, PredictionResult, UserProfile } from '@/src/types/domain';

import type { CycleStatistics } from '@/src/lib/predictions/cycleStatistics';
import { computeCycleStatistics } from '@/src/lib/predictions/cycleStatistics';
import { diffDays } from '@/src/lib/predictions/dateMath';

// The shortest gap between two period starts we will treat as a genuine new
// cycle. A bleed sooner than this (e.g. ovulation-window spotting or a logged
// mid-cycle day) is intermenstrual bleeding within the current cycle, NOT a
// new cycle start, so it must never silently re-anchor the prediction.
export const MIN_CYCLE_SEPARATION_DAYS = 15;

function isPeriodEvidence(
  bleeding: DailyLogEntry['bleeding'],
): bleeding is PeriodEvidenceEntry['bleeding'] {
  return bleeding === 'light' || bleeding === 'medium' || bleeding === 'heavy';
}

function compareByLogDate(left: DailyLogEntry, right: DailyLogEntry) {
  return left.logDate.localeCompare(right.logDate);
}

export function collectPeriodStarts(entries: DailyLogEntry[]) {
  const periodStarts: PeriodEvidenceEntry[] = [];
  let previousLogDate: string | null = null;
  let previousWasEvidence = false;
  let lastStartDate: string | null = null;

  for (const entry of [...entries].sort(compareByLogDate)) {
    const bleeding = entry.bleeding;
    const currentIsEvidence = isPeriodEvidence(bleeding);
    const isContiguousDay =
      previousLogDate !== null && diffDays(previousLogDate, entry.logDate) === 1;
    // A new period start requires both a break in the bleeding episode AND a
    // plausible cycle-length gap from the previous start. Without the gap guard,
    // any mid-cycle bleed would re-anchor the whole cycle.
    const isPlausibleNewCycle =
      lastStartDate === null ||
      diffDays(lastStartDate, entry.logDate) >= MIN_CYCLE_SEPARATION_DAYS;

    if (
      currentIsEvidence &&
      (!previousWasEvidence || !isContiguousDay) &&
      isPlausibleNewCycle
    ) {
      periodStarts.push({
        logDate: entry.logDate,
        bleeding,
      });
      lastStartDate = entry.logDate;
    }

    previousWasEvidence = currentIsEvidence;
    previousLogDate = entry.logDate;
  }

  return periodStarts;
}

// Floor at 20 days: ovulation is anchored ~14 days before the next period
// and the fertile window opens 19 days before it, so a cycle shorter than
// ~20 days cannot fit the fertile window + luteal phase without the fertile
// window starting before the cycle itself. The floor keeps the phase
// decomposition non-degenerate; sub-20-day cycles are clinically rare.
// Applied to every cycle-length estimate this module produces, regardless of
// whether it came from robust statistics, a plain average, or the profile.
function applyCycleLengthFloor(days: number) {
  return Math.max(20, Math.round(days));
}

export type CycleLengthResolution = {
  cycleLengthDays: number;
  // Present only when the >=3-starts branch ran the robust statistics module
  // AND it reported at least one surviving interval (sampleSize > 0). Absent
  // on the profile/default fallback path, and absent when every interval was
  // discarded and we fell back to the plain average (see below) -- callers
  // must not fabricate a spread for those cases.
  statistics?: CycleStatistics;
};

export function resolveCycleLengthDays(
  profile: UserProfile,
  startDates: string[],
  source: PredictionResult['history']['source'],
): CycleLengthResolution {
  if (startDates.length >= 3) {
    const intervals = startDates.slice(1).map((startDate, index) =>
      diffDays(startDates[index], startDate),
    );

    const statistics = computeCycleStatistics(intervals);

    if (statistics.sampleSize > 0) {
      return {
        cycleLengthDays: applyCycleLengthFloor(statistics.estimatedCycleLengthDays),
        statistics,
      };
    }

    // Every interval was discarded by the statistics module (adversarial
    // input -- e.g. all intervals outside the [15, 90] plausible-cycle
    // bounds). Rather than propagate a degenerate 0-based estimate, fall back
    // to the plain average of the raw (unfiltered) intervals: it is at least
    // directionally informed by the user's own logged history, unlike the
    // profile/default path below, which ignores the history entirely. This
    // path is rare/adversarial in practice since real cycles fall within
    // [15, 90] days. No `statistics` is attached here since there is no real
    // surviving sample to report a spread for.
    const averageInterval =
      intervals.reduce((total, interval) => total + interval, 0) / intervals.length;
    return {
      cycleLengthDays: applyCycleLengthFloor(averageInterval),
    };
  }

  const profileCycleLength = profile.cycleLengthDays;
  const defaultCycleLength = source === 'onboarding-seed' ? 29 : 28;
  if (
    profileCycleLength == null ||
    !Number.isFinite(profileCycleLength) ||
    profileCycleLength <= 0
  ) {
    return { cycleLengthDays: defaultCycleLength };
  }
  // Same floor as the history paths above (see applyCycleLengthFloor): keeps
  // the phase decomposition non-degenerate when a profile reports an
  // implausibly short cycle.
  return { cycleLengthDays: applyCycleLengthFloor(profileCycleLength) };
}

export function resolvePeriodLengthDays(profile: UserProfile) {
  const v = profile.periodLengthDays;
  if (v == null || !Number.isFinite(v) || v <= 0) return 5;
  return Math.max(1, Math.round(v));
}
