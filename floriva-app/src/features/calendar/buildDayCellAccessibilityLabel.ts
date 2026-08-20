import type { CalendarScreenModel } from '@/src/features/calendar/buildCalendarScreenModel';
import type { TranslationKey } from '@/src/localization/translations';

type CalendarCell = CalendarScreenModel['weeks'][number][number];

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/**
 * The cell facts the label announces. Structural subset of the screen-model
 * cell so tests (and future callers) do not need to build a full cell.
 */
export type DayCellAccessibilityState = Pick<CalendarCell, 'marker' | 'isFertile' | 'isToday'>;

/**
 * Builds the day-cell accessibility label for the calendar grid. Quiet Bands
 * encodes day states purely visually (band fills, dashed outlines, rings,
 * dots), so screen-reader users get the same facts appended to the base
 * "open log" label: logged period / spotting / predicted period marker
 * first, then the fertile window, then "today" last -- mirroring the visual
 * z-order from band to ring.
 *
 * State fragments come from calendar.a11y.* (translated in all 8 locales)
 * and are joined with ", " after the existing calendar.day.openLabel base.
 */
export function buildDayCellAccessibilityLabel({
  date,
  cell,
  t,
}: {
  date: string;
  /** Null/undefined when the date is not on the rendered grid (defensive). */
  cell: DayCellAccessibilityState | null | undefined;
  t: Translate;
}): string {
  const baseLabel = t('calendar.day.openLabel', { date });

  if (!cell) {
    return baseLabel;
  }

  const stateFragments: string[] = [];

  if (cell.marker === 'period') {
    stateFragments.push(t('calendar.a11y.loggedPeriodDay'));
  }

  if (cell.marker === 'spotting') {
    stateFragments.push(t('calendar.a11y.spottingDay'));
  }

  if (cell.marker === 'predicted-period') {
    stateFragments.push(t('calendar.a11y.predictedPeriodDay'));
  }

  if (cell.isFertile) {
    stateFragments.push(t('calendar.a11y.fertileWindowDay'));
  }

  if (cell.isToday) {
    stateFragments.push(t('calendar.a11y.today'));
  }

  if (stateFragments.length === 0) {
    return baseLabel;
  }

  return [baseLabel, ...stateFragments].join(', ');
}
