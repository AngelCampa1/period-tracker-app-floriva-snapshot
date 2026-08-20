import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockGetProfile = jest.fn();
const mockListAll = jest.fn();
const mockGetAppPreferences = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: (...args: unknown[]) => mockBack(...args),
    canGoBack: (...args: unknown[]) => mockCanGoBack(...args),
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  }),
}));

jest.mock('@/src/features/logging/date', () => ({
  getLocalTodayLogDate: () => '2026-04-18',
}));

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({
    repositories: {
      userProfile: {
        getProfile: () => mockGetProfile(),
      },
      dailyLogs: {
        listAll: (...args: unknown[]) => mockListAll(...args),
      },
      appPreferences: {
        getPreferences: () => mockGetAppPreferences(),
      },
    },
  }),
}));

jest.mock('@/src/localization/LocalizationProvider', () => {
  const { createMockLocalization } = require('../../helpers/mockLocalizationProvider');

  return {
    useLocalization: () => createMockLocalization(),
  };
});

// eslint-disable-next-line import/first
import { addDays } from '@/src/lib/predictions/dateMath';
// eslint-disable-next-line import/first
import { InsightsConditionScreen } from '@/src/features/insights/screens/InsightsConditionScreen';
// eslint-disable-next-line import/first
import { InsightsCyclePatternScreen } from '@/src/features/insights/screens/InsightsCyclePatternScreen';
// eslint-disable-next-line import/first
import { InsightsMonthlyBriefingScreen } from '@/src/features/insights/screens/InsightsMonthlyBriefingScreen';
// eslint-disable-next-line import/first
import { InsightsTtcScreen } from '@/src/features/insights/screens/InsightsTtcScreen';
// eslint-disable-next-line import/first
import { testIds } from '@/src/testing/testIds';
// eslint-disable-next-line import/first
import { expectAccessiblePressables } from '@/tests/helpers/expectAccessiblePressables';

const hydratedProfile = {
  cycleLengthDays: 28,
  periodLengthDays: 5,
  lastPeriodStartDate: '2026-03-28',
  goals: ['period', 'symptoms', 'trying-to-conceive'],
  supportsIrregularCycles: false,
  conditionTags: ['pcos'],
  ttcTrackingPreferences: {
    sex: true,
    ovulationTest: true,
    cervicalMucus: true,
    basalBodyTemperature: false,
  },
};

const hydratedLogs = [
  {
    id: '2026-02-28-medium',
    logDate: '2026-02-28',
    bleeding: 'medium',
    symptoms: ['cramps'],
  },
  {
    id: '2026-03-28-heavy',
    logDate: '2026-03-28',
    bleeding: 'heavy',
    symptoms: ['cramps', 'fatigue'],
  },
  {
    id: '2026-04-16-observation',
    logDate: '2026-04-16',
    bleeding: 'none',
    symptoms: [],
    ttcObservation: {
      cervicalMucus: 'egg-white',
    },
  },
  {
    id: '2026-04-17-observation',
    logDate: '2026-04-17',
    bleeding: 'none',
    symptoms: [],
    ttcObservation: {
      ovulationTest: 'peak',
      sexLogged: true,
    },
  },
];

describe('Insights detail screens', () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockCanGoBack.mockReset();
    mockPush.mockReset();
    mockReplace.mockReset();
    mockGetProfile.mockReset();
    mockListAll.mockReset();
    mockGetAppPreferences.mockReset();
    mockCanGoBack.mockReturnValue(false);
    mockGetProfile.mockResolvedValue(hydratedProfile);
    mockListAll.mockResolvedValue(hydratedLogs);
    mockGetAppPreferences.mockResolvedValue({ dismissedAnomalyIds: [] });
  });

  it('renders cycle-pattern detail with an insights-specific back affordance', async () => {
    const view = render(<InsightsCyclePatternScreen todayIso="2026-04-18" />);

    await waitFor(() => {
      expect(mockGetProfile).toHaveBeenCalledTimes(1);
      expect(mockListAll).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByTestId(testIds.insights.cyclePatternScreen)).toBeTruthy();
    expect(screen.getByTestId(testIds.insights.cyclePatternBackButton)).toBeTruthy();
    expect(screen.getByText('Back to insights')).toBeTruthy();

    expectAccessiblePressables(view.UNSAFE_root);
  });

  it('renders the confidence improvement list instead of plain confidence-only copy', async () => {
    render(<InsightsCyclePatternScreen todayIso="2026-04-18" />);

    await waitFor(() => {
      expect(screen.getByText('Medium confidence')).toBeTruthy();
    });

    expect(
      screen.getByTestId(testIds.confidenceImprovementList.row('one-observed-interval')),
    ).toBeTruthy();
    expect(screen.getByText('Log today to confirm your rhythm sooner')).toBeTruthy();

    fireEvent.press(
      screen.getByTestId(testIds.confidenceImprovementList.row('one-observed-interval')),
    );

    expect(mockPush).toHaveBeenCalledWith('/calendar/day/2026-04-18');
  });

  it('opens the confidence info modal when the cycle-pattern confidence chip is pressed', async () => {
    render(<InsightsCyclePatternScreen todayIso="2026-04-18" />);

    await waitFor(() => {
      expect(screen.getByText('Medium confidence')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId(testIds.insights.cyclePatternConfidenceChipButton));

    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/modal',
        params: expect.objectContaining({
          title: 'Why confidence is medium',
        }),
      }),
    );
  });

  it('exposes the cycle-pattern confidence chip as an accessible button that announces it opens an explanation', async () => {
    render(<InsightsCyclePatternScreen todayIso="2026-04-18" />);

    const chip = await screen.findByTestId(testIds.insights.cyclePatternConfidenceChipButton);

    expect(chip.props.accessibilityRole).toBe('button');
    expect(chip.props.accessibilityLabel).toContain('confidence');
    expect(chip.props.accessibilityHint).toBeTruthy();
  });

  it('renders monthly briefing detail with local summary metrics', async () => {
    render(<InsightsMonthlyBriefingScreen todayIso="2026-04-18" />);

    await waitFor(() => {
      expect(mockGetProfile).toHaveBeenCalledTimes(1);
      expect(mockListAll).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByTestId(testIds.insights.monthlyBriefingScreen)).toBeTruthy();
      expect(screen.getByText('April briefing')).toBeTruthy();
      expect(screen.getByText('2 local logs reviewed')).toBeTruthy();
      expect(screen.getByText('Top signals')).toBeTruthy();
      expect(screen.getByText('Local sources used')).toBeTruthy();
      expect(screen.getByText('TTC details logged on 2 days')).toBeTruthy();
    });
  });

  // UL-33: values must not restate their card labels, and the "keep logging"
  // coaching must only lead the Top signals card when there is nothing to show.
  it('renders bare stat-card counts and drops the coaching once signals exist', async () => {
    mockListAll.mockResolvedValue([
      {
        id: '2026-04-02-heavy',
        logDate: '2026-04-02',
        bleeding: 'heavy',
        symptoms: ['cramps'],
      },
      {
        id: '2026-04-03-medium',
        logDate: '2026-04-03',
        bleeding: 'medium',
        symptoms: ['cramps', 'fatigue'],
      },
    ]);

    render(<InsightsMonthlyBriefingScreen todayIso="2026-04-18" />);

    await waitFor(() => {
      expect(screen.getByText('April briefing')).toBeTruthy();
    });

    // Bare counts under unit-carrying labels — never "PERIOD DAYS / 2 period days".
    expect(screen.getByText('Period days')).toBeTruthy();
    expect(screen.getByText('Symptom days')).toBeTruthy();
    expect(screen.queryByText('2 period days')).toBeNull();
    expect(screen.queryByText('2 symptom days')).toBeNull();
    // Real signals are listed without the empty-state coaching prefacing them.
    expect(screen.getByText('Cramps, Fatigue')).toBeTruthy();
    expect(
      screen.queryByText('Keep logging this month to build a fuller local briefing.'),
    ).toBeNull();
  });

  it('keeps the coaching as the Top signals description when no signals exist', async () => {
    render(<InsightsMonthlyBriefingScreen todayIso="2026-04-18" />);

    await waitFor(() => {
      expect(screen.getByText('April briefing')).toBeTruthy();
    });

    expect(
      screen.getByText('Keep logging this month to build a fuller local briefing.'),
    ).toBeTruthy();
    expect(screen.getByText('No symptom signals logged yet')).toBeTruthy();
  });

  it('returns monthly briefing detail to the insights hub when no prior route exists', async () => {
    render(<InsightsMonthlyBriefingScreen todayIso="2026-04-18" />);

    await waitFor(() => {
      expect(screen.getByText('April briefing')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId(testIds.insights.monthlyBriefingBackButton));

    expect(mockReplace).toHaveBeenCalledWith('/insights');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('pops monthly briefing detail when a previous route exists', async () => {
    mockCanGoBack.mockReturnValue(true);

    render(<InsightsMonthlyBriefingScreen todayIso="2026-04-18" />);

    await waitFor(() => {
      expect(screen.getByText('April briefing')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId(testIds.insights.monthlyBriefingBackButton));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('returns TTC detail to the insights hub when no prior route exists', async () => {
    render(<InsightsTtcScreen todayIso="2026-04-18" />);

    await waitFor(() => {
      expect(mockGetProfile).toHaveBeenCalledTimes(1);
      expect(mockListAll).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByTestId(testIds.insights.ttcScreen)).toBeTruthy();
    fireEvent.press(screen.getByTestId(testIds.insights.ttcBackButton));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/insights');
    });
  });

  it('redirects direct TTC detail access when only stale TTC data exists', async () => {
    mockGetProfile.mockResolvedValue({
      ...hydratedProfile,
      goals: ['period'],
      ttcTrackingPreferences: {
        sex: true,
        ovulationTest: true,
        cervicalMucus: true,
        basalBodyTemperature: false,
      },
    });

    render(<InsightsTtcScreen todayIso="2026-04-18" />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/insights');
    });
    expect(screen.queryByTestId(testIds.insights.setupPromptCard)).toBeNull();
  });

  it('pops condition detail when a previous route exists', async () => {
    mockCanGoBack.mockReturnValue(true);

    render(<InsightsConditionScreen todayIso="2026-04-18" conditionKey="pcos" />);

    await waitFor(() => {
      expect(mockGetProfile).toHaveBeenCalledTimes(1);
      expect(mockListAll).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByTestId(testIds.insights.conditionScreen)).toBeTruthy();
    fireEvent.press(screen.getByTestId(testIds.insights.conditionBackButton));

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  // --- B5: Insights "Observations" -- quiet, complete record of ALL
  // non-dismissed anomalies (contrast with Today's single-nudge behavior).
  // Reuses the same fixture as buildInsightsScreenModel.test.ts's
  // "observations" suite: a regular 28-day user, 41 days into an open
  // cycle, where both missed-expected-period and long-cycle fire.
  describe('cycle-pattern Observations section', () => {
    const anomalyProfile = {
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-03-02',
      goals: ['period'],
      supportsIrregularCycles: false,
      conditionTags: [],
    };
    const anomalyLogs = [
      { id: '2026-01-05', logDate: '2026-01-05', bleeding: 'medium', symptoms: [] },
      { id: '2026-02-02', logDate: '2026-02-02', bleeding: 'medium', symptoms: [] },
      { id: '2026-03-02', logDate: '2026-03-02', bleeding: 'medium', symptoms: [] },
    ];

    it('lists every non-dismissed anomaly, not just the head', async () => {
      mockGetProfile.mockResolvedValue(anomalyProfile);
      mockListAll.mockResolvedValue(anomalyLogs);
      mockGetAppPreferences.mockResolvedValue({ dismissedAnomalyIds: [] });

      render(<InsightsCyclePatternScreen todayIso="2026-04-12" />);

      await screen.findByTestId(testIds.insights.observationsList);

      expect(screen.getByText('Your period hasn’t started yet')).toBeTruthy();
      expect(screen.getByText('A longer cycle than usual')).toBeTruthy();
    });

    it('excludes already-dismissed anomalies', async () => {
      mockGetProfile.mockResolvedValue(anomalyProfile);
      mockListAll.mockResolvedValue(anomalyLogs);
      mockGetAppPreferences.mockResolvedValue({
        dismissedAnomalyIds: ['missed-expected-period:2026-03-30'],
      });

      render(<InsightsCyclePatternScreen todayIso="2026-04-12" />);

      await screen.findByTestId(testIds.insights.observationsList);

      expect(screen.queryByText('Your period hasn’t started yet')).toBeNull();
      expect(screen.getByText('A longer cycle than usual')).toBeTruthy();
    });

    it('renders observation rows as plain text, not buttons (no dismiss affordance on Insights)', async () => {
      mockGetProfile.mockResolvedValue(anomalyProfile);
      mockListAll.mockResolvedValue(anomalyLogs);
      mockGetAppPreferences.mockResolvedValue({ dismissedAnomalyIds: [] });

      render(<InsightsCyclePatternScreen todayIso="2026-04-12" />);

      const row = await screen.findByTestId(
        testIds.insights.observationRow('missed-expected-period:2026-03-30'),
      );

      expect(row.props.accessibilityRole).not.toBe('button');
      expect(
        screen.queryByLabelText('Got it'),
      ).toBeNull();
    });

    // UL-27: the section keeps its place with a quiet all-clear instead of
    // vanishing, so page structure stays stable across presets.
    it('shows a quiet all-clear when there are no anomalies to show', async () => {
      render(<InsightsCyclePatternScreen todayIso="2026-04-18" />);

      await waitFor(() => {
        expect(screen.getByText('Medium confidence')).toBeTruthy();
      });

      expect(screen.getByTestId(testIds.insights.observationsList)).toBeTruthy();
      expect(
        screen.getByText('Nothing unusual in your recent logged cycles.'),
      ).toBeTruthy();
    });

    // UL-88: when the cycle-length pattern is "Varies widely" but there are
    // no discrete anomalies, the all-clear must NOT claim "nothing unusual" —
    // that contradicted the sibling cycle-length card on the same screen (the
    // tenure-12mo-irregular Phase-4 capture). History here alternates ~22/34-day
    // cycles: the raw spread is wide (varies-widely) yet no single cycle is
    // extreme enough to trip a long/short anomaly, so the Observations section
    // falls back to its all-clear line and the honest variability copy renders.
    it('shows the honest variability line (not "nothing unusual") when the pattern varies widely with no anomalies', async () => {
      const variesWidelyStarts = [
        '2026-01-01',
        '2026-01-23',
        '2026-02-26',
        '2026-03-20',
        '2026-04-23',
        '2026-05-15',
        '2026-06-18',
        '2026-07-12',
      ];
      const variesWidelyLogs = variesWidelyStarts.flatMap((startIso, startIndex) =>
        [0, 1, 2].map((offset) => ({
          id: `vw-${startIndex}-${offset}`,
          logDate: addDays(startIso, offset),
          bleeding: offset === 0 ? 'heavy' : 'medium',
          symptoms: [],
        })),
      );
      mockGetProfile.mockResolvedValue({
        ...anomalyProfile,
        lastPeriodStartDate: '2026-07-12',
        supportsIrregularCycles: true,
      });
      mockListAll.mockResolvedValue(variesWidelyLogs);
      mockGetAppPreferences.mockResolvedValue({ dismissedAnomalyIds: [] });

      render(<InsightsCyclePatternScreen todayIso="2026-07-22" />);

      await waitFor(() => {
        expect(screen.getByTestId(testIds.insights.observationsList)).toBeTruthy();
      });

      expect(
        screen.getByText(
          'Your recent cycles have varied quite a bit in length. Cycles vary for lots of everyday reasons.',
        ),
      ).toBeTruthy();
      expect(
        screen.queryByText('Nothing unusual in your recent logged cycles.'),
      ).toBeNull();
    });

    it('shows the all-clear once every detected anomaly has been dismissed', async () => {
      mockGetProfile.mockResolvedValue(anomalyProfile);
      mockListAll.mockResolvedValue(anomalyLogs);
      mockGetAppPreferences.mockResolvedValue({
        dismissedAnomalyIds: [
          'missed-expected-period:2026-03-30',
          'long-cycle:2026-03-02',
        ],
      });

      render(<InsightsCyclePatternScreen todayIso="2026-04-12" />);

      await waitFor(() => {
        expect(screen.getByTestId(testIds.insights.cyclePatternScreen)).toBeTruthy();
      });

      expect(
        screen.getByText('Nothing unusual in your recent logged cycles.'),
      ).toBeTruthy();
      expect(screen.queryByText('Your period hasn’t started yet')).toBeNull();
      expect(screen.queryByText('A longer cycle than usual')).toBeNull();
    });
  });
});
