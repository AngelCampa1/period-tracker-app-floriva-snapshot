import type { ReactNode } from 'react';

import type { CalendarScreenModel } from '@/src/features/calendar/buildCalendarScreenModel';
import type { FlorivaTheme } from '@/src/theme/tokens';

/**
 * Contract between CalendarMonthGrid and its variant cell-renderer modules
 * (quietBands.tsx in this directory).
 *
 * OWNERSHIP RULES (Phase 2b): each redesign variant is developed by an agent
 * that owns EXACTLY ONE module file in this directory. Variant modules may
 * import from this contract, the theme, and shared primitives -- never from
 * each other, and never from CalendarMonthGrid.tsx (the grid imports THEM;
 * a value import back would create a require cycle). Delegation to the
 * classic renderer happens through `context.renderClassicCell`, which the
 * grid pre-binds to its internal classic context.
 *
 * Every variant module must:
 * - default-export a `CalendarGridCellRenderer`;
 * - export `legend: CalendarGridLegend` (consumed generically by the dev
 *   gallery / screen later -- keep labels plain English, no i18n needed for
 *   the dev-only phase);
 * - optionally export `renderBandLayers: CalendarGridBandLayerRenderer` when
 *   the variant draws row-spanning band visuals beneath/behind the day
 *   content and wants that layer testable in isolation.
 */

/** One day cell of the calendar screen model, band segments included. */
export type CalendarGridCell = CalendarScreenModel['weeks'][number][number];

export type CalendarGridCellRenderContext = {
  theme: FlorivaTheme;
  /** Compact-window layout flag (taller touch targets when true). */
  isCompactLayout: boolean;
  /** Currently selected ISO date (drives accessibilityState.selected). */
  selectedDate: string;
  onSelectDate: (date: string) => void;
  dayCellAccessibilityHint: string;
  buildDayCellAccessibilityLabel: (date: string) => string;
  /**
   * The classic cell renderer, pre-bound to the grid's classic styles.
   * Stubs delegate to it wholesale; finished variants may use it as a
   * fallback for states they do not restyle.
   */
  renderClassicCell: (cell: CalendarGridCell) => ReactNode;
};

/**
 * Renders ONE day cell (including its pressable hit target and a11y
 * wiring). The returned node is mounted inside the grid's per-row
 * MotionView stagger wrapper -- variants own everything inside the cell,
 * nothing outside it.
 */
export type CalendarGridCellRenderer = (
  cell: CalendarGridCell,
  context: CalendarGridCellRenderContext,
) => ReactNode;

/**
 * Optional band-layer hook: renders the band visuals for one cell (period /
 * predicted / fertile run segments via cell.periodBand / predictedBand /
 * fertileBand) separately from the day content. Band segments are computed
 * PER WEEK ROW: 'single' means a one-cell run within the row (draw both
 * caps); runs crossing a row boundary are clipped, and a one-cell row
 * portion of a longer run also reads 'single' -- within a row a 'start'
 * always has a matching 'end'.
 */
export type CalendarGridBandLayerRenderer = (
  cell: CalendarGridCell,
  context: CalendarGridCellRenderContext,
) => ReactNode;

export type CalendarGridLegendSwatch =
  | 'period'
  | 'predicted'
  | 'fertile'
  | 'spotting'
  | 'today'
  | 'logged'
  | 'selected'
  | 'peak';

export type CalendarGridLegendItem = {
  key: string;
  label: string;
  swatch: CalendarGridLegendSwatch;
  /**
   * Variant-drawn swatch. When present the legend consumer renders this
   * instead of its generic per-kind swatch — use it when the variant's
   * treatment diverges from the semantic default (e.g. an outlined rather
   * than filled period marker).
   */
  renderSwatch?: (theme: FlorivaTheme) => ReactNode;
};

export type CalendarGridLegend = {
  items: CalendarGridLegendItem[];
};
