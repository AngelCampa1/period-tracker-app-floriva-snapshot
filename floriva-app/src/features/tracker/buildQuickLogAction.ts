import type { DailyLogEntry, PredictionSnapshot } from '@/src/types/domain';

import { diffDays } from '@/src/lib/predictions/dateMath';

// Quick-log window: visible from 2 days before the predicted period start
// through 3 days after it (inclusive on both ends), and only while today has
// no bleeding logged yet. Outside a prediction (no nextPeriodStartIso), the
// action stays hidden — there is nothing to log "for".
const DAYS_BEFORE_PREDICTED_START = 2;
const DAYS_AFTER_PREDICTED_START = 3;

export type BuildQuickLogActionOptions = {
  todayIso: string;
  snapshot: Pick<PredictionSnapshot, 'nextPeriodStartIso'>;
  todayEntry: DailyLogEntry | null;
};

export type QuickLogAction = {
  visible: boolean;
};

function hasBleedingLoggedToday(todayEntry: DailyLogEntry | null) {
  if (!todayEntry) {
    return false;
  }

  return todayEntry.bleeding !== undefined && todayEntry.bleeding !== 'none';
}

export function buildQuickLogAction({
  todayIso,
  snapshot,
  todayEntry,
}: BuildQuickLogActionOptions): QuickLogAction {
  const { nextPeriodStartIso } = snapshot;

  if (!nextPeriodStartIso) {
    return { visible: false };
  }

  if (hasBleedingLoggedToday(todayEntry)) {
    return { visible: false };
  }

  const offsetFromPredictedStart = diffDays(nextPeriodStartIso, todayIso);
  const isWithinWindow =
    offsetFromPredictedStart >= -DAYS_BEFORE_PREDICTED_START &&
    offsetFromPredictedStart <= DAYS_AFTER_PREDICTED_START;

  return { visible: isWithinWindow };
}
