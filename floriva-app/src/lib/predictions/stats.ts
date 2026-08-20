/**
 * Small shared numeric primitives used across the prediction engine's
 * statistics modules (`cycleStatistics.ts`, `lutealLearning.ts`). Pure,
 * I/O-free, no domain knowledge -- just arithmetic on plain number arrays.
 */

/**
 * Standard median with the conventional even-length tie-break (average of
 * the two middle values). Returns 0 for an empty input -- callers are
 * expected to guard against empty arrays themselves when 0 is not a
 * meaningful sentinel for their domain (e.g. `medianAbsoluteDeviation` in
 * `cycleStatistics.ts` never calls this with an empty array).
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1]! + sorted[middle]!) / 2;
  }
  return sorted[middle]!;
}
