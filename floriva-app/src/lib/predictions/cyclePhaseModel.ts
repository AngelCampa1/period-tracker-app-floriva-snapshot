/**
 * Single source of truth for decomposing a cycle into its four phases.
 *
 * Both the Today phase ribbon and the Insights phase-rhythm chart consume this
 * helper so the two screens can never disagree about how the same cycle splits.
 *
 * The fertile window mirrors `buildPredictionResult`: it is the 6-day span that
 * ends 14 days before the next predicted period — the day of ovulation plus the
 * 5 preceding days (i.e. it starts `cycleLength - 19` days after the cycle
 * start). The luteal phase therefore lands on the clinically standard ~14 days,
 * and the follicular phase absorbs whatever is left between the period and the
 * fertile window.
 */

export const FERTILE_WINDOW_LENGTH_DAYS = 6;
const DAYS_BEFORE_NEXT_PERIOD_AT_FERTILE_START = 19;

export type CyclePhaseBreakdown = {
  periodDays: number;
  follicularDays: number;
  fertileDays: number;
  lutealDays: number;
  cycleLengthDays: number;
};

type BuildCyclePhaseBreakdownOptions = {
  cycleLengthDays: number;
  periodLengthDays: number;
  /**
   * Offset (in days from the cycle start) where the fertile window opens.
   * Callers with a live prediction can pass the engine-derived value so the
   * breakdown stays byte-for-byte aligned with the shared prediction result.
   * Defaults to the engine's own formula when omitted.
   */
  fertileWindowStartOffsetDays?: number;
};

export function buildCyclePhaseBreakdown({
  cycleLengthDays,
  periodLengthDays,
  fertileWindowStartOffsetDays,
}: BuildCyclePhaseBreakdownOptions): CyclePhaseBreakdown {
  // Allocate the four phases as a waterfall that can never exceed the cycle
  // length, so periodDays + follicularDays + fertileDays + lutealDays is always
  // exactly cycleLengthDays (the ribbon fills the bar exactly). A degenerate
  // input — e.g. a logged period longer than the cycle, or the 20-day cycle
  // floor leaving almost no room — must clamp later phases to whatever remains
  // rather than over-allocating a fixed-size fertile block.
  const cap = Math.max(0, cycleLengthDays);
  const periodDays = Math.min(cap, Math.max(0, periodLengthDays));
  const fertileStartOffset =
    fertileWindowStartOffsetDays ?? cycleLengthDays - DAYS_BEFORE_NEXT_PERIOD_AT_FERTILE_START;
  const follicularDays = Math.min(
    cap - periodDays,
    Math.max(0, fertileStartOffset - periodDays),
  );
  const fertileDays = Math.min(
    cap - periodDays - follicularDays,
    Math.max(0, FERTILE_WINDOW_LENGTH_DAYS),
  );
  const lutealDays = Math.max(
    0,
    cycleLengthDays - periodDays - follicularDays - fertileDays,
  );

  return {
    periodDays,
    follicularDays,
    fertileDays,
    lutealDays,
    cycleLengthDays,
  };
}

/**
 * Inclusive 1-indexed end day of each phase along the cycle, in order
 * (period, follicular, fertile, luteal). The final phase always ends on the
 * cycle length so the ribbon fills the whole bar even when phases were clamped.
 */
export function buildCyclePhaseEndDays(breakdown: CyclePhaseBreakdown): {
  periodEnd: number;
  follicularEnd: number;
  fertileEnd: number;
  lutealEnd: number;
} {
  const cap = breakdown.cycleLengthDays;
  const periodEnd = Math.min(breakdown.periodDays, cap);
  const follicularEnd = Math.min(periodEnd + breakdown.follicularDays, cap);
  const fertileEnd = Math.min(follicularEnd + breakdown.fertileDays, cap);

  return {
    periodEnd,
    follicularEnd,
    fertileEnd,
    lutealEnd: cap,
  };
}
