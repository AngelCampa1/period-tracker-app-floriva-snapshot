import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PixelRatio } from 'react-native';

import { InsightsConditionScreen } from '@/src/features/insights/screens/InsightsConditionScreen';
import { InsightsCyclePatternScreen } from '@/src/features/insights/screens/InsightsCyclePatternScreen';
import {
  InsightsScreen,
  InsightsScreenContent,
} from '@/src/features/insights/screens/InsightsScreen';
import { InsightsTtcScreen } from '@/src/features/insights/screens/InsightsTtcScreen';
import { testIds } from '@/src/testing/testIds';
import { florivaThemes } from '@/src/theme/tokens';

const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRetry = jest.fn();
const mockUseInsightsModel = jest.fn();
let mockResolvedLocale = 'en';

const baseModel = {
  cyclePattern: {
    title: 'Cycle pattern',
    periodStartsLabel: '2 starts',
    nextPeriodLabel: 'Next in 3 days',
    confidenceLevel: 'medium',
    confidenceLabel: 'Moderate confidence',
    confidenceReasonCodes: [],
  },
  cycleLengthData: {
    avgDays: 28,
    bars: [
      { days: 27, isLatest: false },
      { days: 29, isLatest: false },
      { days: 28, isLatest: true },
    ],
    hasObservedHistory: true,
    consistencyLevel: 'consistent',
    subtitleLabel: 'Consistent on average',
    footnoteLabel: 'Within about +/- 1 days across your recent logged cycles. Floriva is treating your cycle as regular.',
  },
  phaseRhythmData: {
    periodDays: 5,
    follicularDays: 8,
    fertileDays: 5,
    lutealDays: 10,
    cycleLengthDays: 28,
  },
  showFertilityEstimates: true,
  ttcSummary: {
    fertileWindowLabel: 'Apr 18 - Apr 22',
    currentWindowLoggedDays: 2,
    currentWindowLengthDays: 5,
    latestHighlights: [
      { kind: 'ovulationTest', date: '2026-04-17', label: 'Peak ovulation test' },
    ],
    recentLogSummaries: [
      { date: '2026-04-17', summary: 'Sex logged · peak test' },
    ],
  },
  monthlyBriefing: {
    title: 'April briefing',
    subtitle: '3 local logs reviewed',
    lead: 'April shows 2 period days and 4 tracked signals so far.',
    periodDaysLabel: '2 period days',
    symptomDaysLabel: '2 symptom days',
    topSignalsLabel: 'Cramps, Energy',
    sourceLabels: ['Imported history included'],
    emptyState: 'Keep logging this month to build a fuller local briefing.',
  },
  conditionSummaries: [
    {
      key: 'pcos',
      title: 'PCOS',
      summary: 'Pattern summary',
      emptyState: 'Log PCOS-related patterns.',
      loggingHint: 'Track cycle variability and spotting.',
      recentLogCount: 3,
      trackedSymptomLabels: ['Acne', 'Discharge'],
    },
  ],
};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: (...args: unknown[]) => mockBack(...args),
    canGoBack: (...args: unknown[]) => mockCanGoBack(...args),
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  }),
}));

jest.mock('@/src/features/insights/useInsightsModel', () => ({
  useInsightsModel: (...args: unknown[]) => mockUseInsightsModel(...args),
}));

jest.mock('@/src/localization/LocalizationProvider', () => ({
  useLocalization: () => ({
    resolvedLocale: mockResolvedLocale,
    t: (key: string, params?: Record<string, string | number>) => {
      if (mockResolvedLocale !== 'en') {
        const { translate } = jest.requireActual('@/src/localization/translations');
        return translate(mockResolvedLocale, key, params);
      }

      if (key === 'insights.ttcSummary.description' && params) {
        return `Logged ${params.loggedDays} of ${params.windowDays} days`;
      }

      const translations: Record<string, string> = {
        'insights.screen.backLabel': 'Back to insights',
        'insights.screen.eyebrow': 'Insights',
        'insights.screen.title': 'Insights',
        'insights.screen.description': 'See patterns from your recent history.',
        'insights.screen.observedTitlePrefix': 'What your last ',
        'insights.screen.observedTitleCount': params ? `${params.count} cycles` : 'cycles',
        'insights.screen.observedTitleSuffix': ' say.',
        'insights.screen.observedTitleOne': 'What your last cycle says.',
        'insights.screen.observedTitleEmpty': 'What your cycle says so far.',
        'insights.screen.cycleLengthLabel': 'Cycle length',
        'insights.screen.averageAbbreviation': 'avg',
        'insights.screen.estimateAbbreviation': 'est',
        'insights.screen.phaseRhythmLabel': 'Phase rhythm',
        'insights.screen.phaseDays': params ? `${params.count}d` : 'days',
        'insights.screen.chartEmpty': 'Log more periods to see cycle history.',
        'insights.cyclePattern.localPatternReadout': 'Local pattern readout',
        'insights.cyclePattern.historyUsedLabel': 'History used',
        'insights.cyclePattern.timingLabel': 'Timing',
        'insights.conditionSummary.local90DayLabel': 'Condition-aware logging',
        'insights.conditionSummary.logsReviewed': params
          ? `${params.count} local logs reviewed`
          : 'local logs reviewed',
        'insights.conditionSummary.loggingFocusTitle': 'Logging focus',
        'insights.conditionSummary.exploreTitle': 'Condition modes',
        'insights.conditionSummary.exploreSubtitle': 'Turn on condition prompts',
        'insights.monthlyBriefing.exploreTitle': 'Monthly briefing',
        'insights.monthlyBriefing.exploreSubtitle': 'A local readout',
        'insights.setupPrompt.description': 'Set up TTC to unlock deeper insights.',
        'insights.setupPrompt.title': 'Set up TTC',
        'insights.setupPrompt.button': 'Review trying-to-conceive setup',
        'insights.setupPrompt.ttcBody': 'TTC setup body',
        'insights.setupPrompt.conditionBody': 'Condition setup body',
        'insights.ttcSummary.title': 'Trying to conceive',
        'insights.ttcSummary.currentWindowLabel': 'Current window',
        'ttc.insights.recentLogsTitle': 'Recent TTC logs',
        'ttc.insights.noRecentLogs': 'No TTC details logged yet',
        'ttc.insights.estimatesHiddenTitle': 'Estimates hidden',
        'ttc.insights.estimatesHiddenDescription': 'Turn estimates on in settings.',
        'ttc.insights.estimatesHiddenBody': 'TTC logging preferences stay saved.',
        'insights.error.title': 'Insights need attention',
        'insights.error.body': 'Try refreshing your local insights.',
        'insights.error.retry': 'Retry insights',
        'insights.error.load': 'Floriva could not load your local insights.',
        'navigation.tabs.today': 'Today',
        'navigation.tabs.settings': 'Settings',
      };

      return translations[key] ?? key;
    },
  }),
}));

jest.mock('@/src/features/logging/date', () => ({
  getLocalTodayLogDate: () => '2026-04-18',
}));

describe('Insights screen branches', () => {
  beforeEach(() => {
    mockResolvedLocale = 'en';
    mockBack.mockReset();
    mockCanGoBack.mockReset();
    mockPush.mockReset();
    mockReplace.mockReset();
    mockRetry.mockReset();
    mockCanGoBack.mockReturnValue(false);
    mockUseInsightsModel.mockReturnValue({
      hydrationError: null,
      isHydrating: false,
      model: baseModel,
      retry: (...args: unknown[]) => mockRetry(...args),
    });
  });

  it('routes cycle-pattern back to insights when no history stack exists and shows loading and error states', () => {
    mockUseInsightsModel
      .mockReturnValueOnce({
        hydrationError: null,
        isHydrating: true,
        model: baseModel,
        retry: mockRetry,
      })
      .mockReturnValueOnce({
        hydrationError: 'Floriva could not load your local insights.',
        isHydrating: false,
        model: baseModel,
        retry: mockRetry,
      })
      .mockReturnValue({
        hydrationError: null,
        isHydrating: false,
        model: baseModel,
        retry: mockRetry,
      });

    const { rerender } = render(<InsightsCyclePatternScreen todayIso="2026-04-18" />);
    expect(screen.getByText('See patterns from your recent history.')).toBeTruthy();

    rerender(<InsightsCyclePatternScreen todayIso="2026-04-18" />);
    expect(screen.getByText('Floriva could not load your local insights.')).toBeTruthy();

    rerender(<InsightsCyclePatternScreen todayIso="2026-04-18" />);
    fireEvent.press(screen.getByTestId(testIds.insights.cyclePatternBackButton));

    expect(mockReplace).toHaveBeenCalledWith('/insights');
  });

  it('pops the cycle-pattern detail when history exists', () => {
    mockCanGoBack.mockReturnValue(true);

    render(<InsightsCyclePatternScreen todayIso="2026-04-18" />);

    fireEvent.press(screen.getByTestId(testIds.insights.cyclePatternBackButton));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('redirects TTC detail when TTC mode is not enabled', async () => {
    mockUseInsightsModel.mockReturnValue({
      hydrationError: null,
      isHydrating: false,
      model: {
        ...baseModel,
        ttcSummary: null,
      },
      retry: mockRetry,
    });

    render(<InsightsTtcScreen todayIso="2026-04-18" />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/insights');
    });
    expect(screen.queryByText('TTC setup body')).toBeNull();
    expect(screen.queryByTestId(testIds.insights.setupPromptCard)).toBeNull();
  });

  it('keeps direct TTC detail loading copy generic until TTC mode is confirmed', () => {
    mockUseInsightsModel.mockReturnValue({
      hydrationError: null,
      isHydrating: true,
      model: {
        ...baseModel,
        ttcSummary: null,
      },
      retry: mockRetry,
    });

    render(<InsightsTtcScreen todayIso="2026-04-18" />);

    expect(screen.queryByText('Trying to conceive')).toBeNull();
    expect(screen.getAllByText('See patterns from your recent history.').length).toBeGreaterThan(0);
  });

  it('keeps direct TTC detail error copy generic when TTC mode was not confirmed', () => {
    mockUseInsightsModel.mockReturnValue({
      hydrationError: 'Floriva could not load your local insights.',
      isHydrating: false,
      model: {
        ...baseModel,
        ttcSummary: null,
      },
      retry: mockRetry,
    });

    render(<InsightsTtcScreen todayIso="2026-04-18" />);

    expect(screen.queryByText('Trying to conceive')).toBeNull();
    expect(screen.getByText('Floriva could not load your local insights.')).toBeTruthy();
  });

  it('hides TTC fertile-window detail when fertility estimates are disabled', () => {
    mockUseInsightsModel.mockReturnValue({
      hydrationError: null,
      isHydrating: false,
      model: {
        ...baseModel,
        showFertilityEstimates: false,
      },
      retry: mockRetry,
    });

    render(<InsightsTtcScreen todayIso="2026-04-18" />);

    expect(screen.getByText('Estimates hidden')).toBeTruthy();
    expect(screen.queryByText('Current window')).toBeNull();
    expect(screen.queryByText('Apr 18 - Apr 22')).toBeNull();
    expect(screen.queryByText('Peak ovulation test')).toBeNull();
    expect(screen.queryByTestId(testIds.insights.setupPromptCard)).toBeNull();
  });

  it('pops TTC detail when history exists', () => {
    mockCanGoBack.mockReturnValue(true);

    render(<InsightsTtcScreen todayIso="2026-04-18" />);

    fireEvent.press(screen.getByTestId(testIds.insights.ttcBackButton));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('redirects missing condition detail back to the insights hub', async () => {
    mockUseInsightsModel.mockReturnValue({
      hydrationError: null,
      isHydrating: false,
      model: {
        ...baseModel,
        conditionSummaries: [],
      },
      retry: mockRetry,
    });

    render(<InsightsConditionScreen todayIso="2026-04-18" conditionKey="pcos" />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/insights');
    });
  });

  it('routes condition detail back to insights when no history stack exists', () => {
    render(<InsightsConditionScreen todayIso="2026-04-18" conditionKey="pcos" />);

    expect(screen.getByTestId(testIds.insights.conditionSummaryCard)).toBeTruthy();
    expect(screen.getByTestId(testIds.insights.conditionFocusCard)).toBeTruthy();
    expect(screen.getByText('Pattern summary')).toBeTruthy();
    expect(screen.getByText('Acne')).toBeTruthy();
    expect(screen.getByText('Discharge')).toBeTruthy();

    fireEvent.press(screen.getByTestId(testIds.insights.conditionBackButton));

    expect(mockReplace).toHaveBeenCalledWith('/insights');
  });

  it('retries from the recoverable insights error card', () => {
    mockUseInsightsModel.mockReturnValue({
      hydrationError: 'Floriva could not load your local insights.',
      isHydrating: false,
      model: {
        ...baseModel,
        ttcSummary: null,
        conditionSummaries: [],
      },
      retry: mockRetry,
    });

    render(<InsightsScreenContent todayIso="2026-04-18" />);

    fireEvent.press(screen.getByTestId(testIds.insights.retryButton));

    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('uses today from the local clock in the screen wrapper', () => {
    render(<InsightsScreen />);

    expect(mockUseInsightsModel).toHaveBeenCalledWith('2026-04-18');
  });

  it('uses today from the local clock when the content date is omitted', () => {
    render(<InsightsScreenContent />);

    expect(mockUseInsightsModel).toHaveBeenCalledWith('2026-04-18');
  });

  it('renders an honest low-history chart state without claiming a steady, regular cycle', () => {
    mockUseInsightsModel.mockReturnValue({
      hydrationError: null,
      isHydrating: false,
      model: {
        ...baseModel,
        cycleLengthData: {
          avgDays: 28,
          bars: [],
          hasObservedHistory: false,
          consistencyLevel: 'not-enough-data',
          subtitleLabel: 'Not enough data yet',
          footnoteLabel: 'Log a couple more periods so Floriva can learn your cycle pattern.',
        },
      },
      retry: mockRetry,
    });

    render(<InsightsScreenContent todayIso="2026-04-18" />);

    expect(screen.getByText('Log more periods to see cycle history.')).toBeTruthy();
    // Must not contradict the empty chart by asserting a confident, regular cycle.
    expect(screen.queryByText('Consistent on average')).toBeNull();
    expect(screen.queryByText('Within +/- 2 days. Floriva is treating your cycle as regular.')).toBeNull();
    expect(screen.getByText('Not enough data yet')).toBeTruthy();
    // The heading must stay grammatical with zero observed cycles —
    // never "What your last recent cycles say."
    expect(screen.queryByText('recent cycles')).toBeNull();
    expect(screen.getByText('What your cycle says so far.')).toBeTruthy();
  });

  // UL-09: months-stale analysis must not present as live — when the engine
  // flags stale-history, the hub leads with the same honest action cue the
  // calendar banner uses.
  it('leads with a staleness cue when history is stale', () => {
    mockUseInsightsModel.mockReturnValue({
      hydrationError: null,
      isHydrating: false,
      model: {
        ...baseModel,
        cyclePattern: {
          ...baseModel.cyclePattern,
          confidenceReasonCodes: ['stale-history'],
        },
      },
      retry: mockRetry,
    });

    render(<InsightsScreenContent todayIso="2026-04-18" />);

    expect(screen.getByTestId(testIds.insights.staleNote)).toBeTruthy();
    expect(
      screen.getByText('Log your latest period to update this estimate'),
    ).toBeTruthy();
  });

  it('shows no staleness cue while history is fresh', () => {
    render(<InsightsScreenContent todayIso="2026-04-18" />);

    expect(screen.queryByTestId(testIds.insights.staleNote)).toBeNull();
  });

  // UL-05 (docs/qa/2026-07-22-ui-lift/phase-1/findings.md): a short cycle
  // can leave zero follicular days (the period runs straight into the
  // fertile window). The phase-rhythm card used to render "Follicular 0d"
  // with an empty track — the designed treatment is to omit zero-length
  // phases so the card only lists phases that actually occur in this cycle.
  it('UL-05: omits a zero-length phase row instead of rendering "0d" with an empty track', () => {
    mockUseInsightsModel.mockReturnValue({
      hydrationError: null,
      isHydrating: false,
      model: {
        ...baseModel,
        phaseRhythmData: {
          periodDays: 6,
          follicularDays: 0,
          fertileDays: 6,
          lutealDays: 13,
          cycleLengthDays: 25,
        },
      },
      retry: mockRetry,
    });

    render(<InsightsScreenContent todayIso="2026-04-18" />);

    expect(screen.queryByText('Follicular')).toBeNull();
    expect(screen.queryByText('0d')).toBeNull();
    expect(screen.getByText('Period')).toBeTruthy();
    expect(screen.getByText('Fertile')).toBeTruthy();
    expect(screen.getByText('Luteal')).toBeTruthy();
    expect(screen.getByText('13d')).toBeTruthy();
  });

  // UL-80: percentage-string fill heights rounded independently per bar, so
  // the saturated latest bar could land a device pixel below/above its pale
  // siblings' shared baseline — reading as broken data. Heights are now
  // pixel-snapped points from one shared track constant, so every bar bottom
  // lands on the same device pixel by construction.
  it('pixel-snaps every chart bar to a shared baseline', () => {
    const bars = [
      { days: 27, isLatest: false },
      { days: 38, isLatest: false },
      { days: 45, isLatest: false },
      { days: 64, isLatest: false },
      { days: 21, isLatest: true },
    ];
    mockUseInsightsModel.mockReturnValue({
      hydrationError: null,
      isHydrating: false,
      model: {
        ...baseModel,
        cycleLengthData: { ...baseModel.cycleLengthData, bars },
      },
      retry: mockRetry,
    });

    render(<InsightsScreenContent todayIso="2026-04-18" />);

    bars.forEach((bar, index) => {
      const fill = screen.getByTestId(testIds.insights.chartBarFill(index));
      const expectedHeight = Math.max(
        PixelRatio.roundToNearestPixel((42 * bar.days) / 64),
        4,
      );
      expect(fill).toHaveStyle({ height: expectedHeight });
    });
  });

  // UL-57: while the average is only a seeded estimate ("Not enough data
  // yet"), the numeral must not wear the confident oxblood accent — the
  // strongest visual on the card would contradict the strongest words.
  it('quiets the estimate numeral while there is not enough observed history', () => {
    mockUseInsightsModel.mockReturnValue({
      hydrationError: null,
      isHydrating: false,
      model: {
        ...baseModel,
        cycleLengthData: {
          avgDays: 29,
          bars: [],
          hasObservedHistory: false,
          consistencyLevel: 'not-enough-data',
          subtitleLabel: 'Not enough data yet',
          footnoteLabel: 'Log a couple more periods so Floriva can learn your cycle pattern.',
        },
      },
      retry: mockRetry,
    });

    render(<InsightsScreenContent todayIso="2026-04-18" />);

    expect(screen.getByTestId(testIds.insights.avgNumeral)).toHaveStyle({
      color: florivaThemes.light.colors.textSecondary,
    });
    expect(screen.getByText('est')).toBeTruthy();
  });

  it('keeps the confident accent numeral once real interval history exists', () => {
    mockUseInsightsModel.mockReturnValue({
      hydrationError: null,
      isHydrating: false,
      model: baseModel,
      retry: mockRetry,
    });

    render(<InsightsScreenContent todayIso="2026-04-18" />);

    expect(screen.getByTestId(testIds.insights.avgNumeral)).toHaveStyle({
      color: florivaThemes.light.colors.accentPrimary,
    });
  });

  it('keeps the steady-cycle copy once real interval history exists', () => {
    mockUseInsightsModel.mockReturnValue({
      hydrationError: null,
      isHydrating: false,
      model: baseModel,
      retry: mockRetry,
    });

    render(<InsightsScreenContent todayIso="2026-04-18" />);

    expect(screen.getByText('Consistent on average')).toBeTruthy();
    expect(
      screen.getByText(
        'Within about +/- 1 days across your recent logged cycles. Floriva is treating your cycle as regular.',
      ),
    ).toBeTruthy();
  });

  it('keeps the observed-cycle title grammatical with one cycle', () => {
    mockUseInsightsModel.mockReturnValue({
      hydrationError: null,
      isHydrating: false,
      model: {
        ...baseModel,
        cycleLengthData: {
          ...baseModel.cycleLengthData,
          bars: [{ days: 28, isLatest: true }],
        },
      },
      retry: mockRetry,
    });

    render(<InsightsScreenContent todayIso="2026-04-18" />);

    expect(screen.getByText('What your last cycle says.')).toBeTruthy();
    expect(screen.queryByText('What your last one cycle say.')).toBeNull();
  });

  it('renders the observed-cycle production surfaces in the selected locale', () => {
    mockResolvedLocale = 'es';

    render(<InsightsScreenContent todayIso="2026-04-18" />);

    expect(screen.getByText('Duración del ciclo')).toBeTruthy();
    expect(screen.getByText('prom.')).toBeTruthy();
    expect(screen.getByText('Ritmo de fases')).toBeTruthy();
    expect(screen.getByText('Periodo')).toBeTruthy();
    expect(screen.getByText('Fértil')).toBeTruthy();
    // UL-03: the privacy readout renders as a quiet localized footnote.
    expect(
      screen.getByText('Creado a partir del historial del ciclo guardado en este dispositivo.'),
    ).toBeTruthy();
    expect(screen.queryByText('Cycle length')).toBeNull();
    expect(screen.queryByText('Phase rhythm')).toBeNull();
  });

  it('renders the Russian observed-cycle headline with the few-count noun form', () => {
    mockResolvedLocale = 'ru';

    render(<InsightsScreenContent todayIso="2026-04-18" />);

    expect(screen.getByText('3 цикла')).toBeTruthy();
    expect(screen.queryByText('3 циклов')).toBeNull();
  });

  it('routes the by-condition explore row to the active condition detail', () => {
    render(<InsightsScreenContent todayIso="2026-04-18" />);

    fireEvent.press(screen.getByTestId('insights-condition-row-pcos'));

    expect(mockPush).toHaveBeenCalledWith('/insights/condition/pcos');
  });

  it('routes the primary Explore rows', () => {
    render(<InsightsScreenContent todayIso="2026-04-18" />);

    fireEvent.press(screen.getByTestId(testIds.insights.cyclePatternRow));
    fireEvent.press(screen.getByTestId(testIds.insights.monthlyBriefingRow));
    fireEvent.press(screen.getByTestId(testIds.insights.ttcSummaryRow));

    expect(mockPush).toHaveBeenCalledWith('/insights/cycle-pattern');
    expect(mockPush).toHaveBeenCalledWith('/insights/monthly-briefing');
    expect(mockPush).toHaveBeenCalledWith('/insights/ttc');
  });

  it('renders a zero-length neutral phase model and routes condition setup', () => {
    mockUseInsightsModel.mockReturnValue({
      hydrationError: null,
      isHydrating: false,
      model: {
        ...baseModel,
        showFertilityEstimates: false,
        ttcSummary: null,
        conditionSummaries: [],
        cyclePattern: {
          ...baseModel.cyclePattern,
          lead: '',
        },
        phaseRhythmData: {
          periodDays: 0,
          follicularDays: 0,
          fertileDays: 0,
          lutealDays: 0,
          cycleLengthDays: 0,
        },
      },
      retry: mockRetry,
    });

    render(<InsightsScreenContent todayIso="2026-04-18" />);

    expect(screen.queryByText('Fertile')).toBeNull();
    fireEvent.press(screen.getByTestId(testIds.insights.byConditionRow));
    expect(mockPush).toHaveBeenCalledWith('/settings/tracking-setup');
  });
});
