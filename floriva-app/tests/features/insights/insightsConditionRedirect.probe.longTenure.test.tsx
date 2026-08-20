/**
 * LT-16 probe (Phase 5 triage of the Phase 3 iOS sweep, workstream E).
 *
 * The Phase 3 sweep reported `/insights/condition/endometriosis` "never
 * mounts" (2x 20s timeout) under tenure-12mo-irregular while pcos/pmdd
 * "worked". Root cause is NOT a crash or a loop in the endometriosis insight
 * builder: the irregular variant's profile has `conditionTags: ['pcos']`
 * only, so `buildConditionSummaries` (keyed off `profile.conditionTags`)
 * produces a pcos summary ONLY, and `InsightsConditionScreen` deliberately
 * self-redirects to `/insights` for any conditionKey without a summary
 * (`shouldRedirectToInsights`). In the sweep:
 *
 * - pcos: summary exists -> screen stays mounted (real pass);
 * - pmdd: deep-linked while the pcos CONDITION screen was still mounted, so
 *   the `insights-condition-screen` testID was momentarily visible (62ms
 *   "pass") before the redirect landed — the captured "condition-pmdd.png"
 *   actually shows the Insights hub (false-positive evidence);
 * - endometriosis: deep-linked from the post-redirect `/insights` hub, so
 *   the freshly pushed condition screen redirected away again before
 *   Detox's first visibility poll -> 20s timeout (false "never mounts").
 *
 * This probe pins the by-design behavior on the exact sweep dataset so the
 * "defect" cannot be re-triaged as an engine crash: endometriosis (and pmdd)
 * redirect to /insights, pcos renders, and the model builder itself
 * completes near-instantly for the irregular data shape (a hang would trip
 * the jest timeout).
 */
import { render, screen, waitFor } from '@testing-library/react-native';

const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => false);
const mockReplace = jest.fn();

const mockGetProfile = jest.fn();
const mockListAll = jest.fn();
const mockGetAppPreferences = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: (...args: unknown[]) => mockBack(...args),
    canGoBack: () => mockCanGoBack(),
    replace: (...args: unknown[]) => mockReplace(...args),
  }),
}));

// Stable repository identity across renders (hydration-effect dependency).
const mockRepositories = {
  userProfile: { getProfile: () => mockGetProfile() },
  dailyLogs: { listAll: () => mockListAll() },
  appPreferences: { getPreferences: () => mockGetAppPreferences() },
};

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({ repositories: mockRepositories }),
}));

jest.mock('@/src/localization/LocalizationProvider', () => {
  const { createMockLocalization } = require('../../helpers/mockLocalizationProvider');

  return { useLocalization: () => createMockLocalization() };
});

// eslint-disable-next-line import/first
import { InsightsConditionScreen } from '@/src/features/insights/screens/InsightsConditionScreen';
// eslint-disable-next-line import/first
import { buildInsightsScreenModel } from '@/src/features/insights/buildInsightsScreenModel';
// eslint-disable-next-line import/first
import { buildTenureDataset } from '@/src/testing/tenureFixtures';
// eslint-disable-next-line import/first
import { defaultAppPreferences } from '@/src/db/domainDefaults';
// eslint-disable-next-line import/first
import { testIds } from '@/src/testing/testIds';

const TODAY_ISO = '2026-07-06';
const dataset = buildTenureDataset('tenure-12mo-irregular', TODAY_ISO);

describe('RESOLVED LT-16 — untagged condition deep links redirect by design (tenure-12mo-irregular)', () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockCanGoBack.mockReset();
    mockReplace.mockReset();
    mockCanGoBack.mockReturnValue(false);
    mockGetProfile.mockReset();
    mockListAll.mockReset();
    mockGetAppPreferences.mockReset();
    mockGetProfile.mockResolvedValue(dataset.profile);
    mockListAll.mockResolvedValue(dataset.dailyLogs);
    mockGetAppPreferences.mockResolvedValue(defaultAppPreferences);
  });

  it('pins the data shape: the irregular variant tags pcos only, so the model has exactly one condition summary', () => {
    expect(dataset.profile.conditionTags).toEqual(['pcos']);

    const model = buildInsightsScreenModel({
      todayIso: TODAY_ISO,
      profile: dataset.profile,
      logEntries: dataset.dailyLogs,
      locale: 'en',
    });

    expect(model.conditionSummaries.map((summary) => summary.key)).toEqual(['pcos']);
  });

  it('redirects /insights/condition/endometriosis to the insights hub instead of crashing or hanging', async () => {
    render(<InsightsConditionScreen todayIso={TODAY_ISO} conditionKey="endometriosis" />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/insights');
    });
    expect(screen.queryByTestId(testIds.insights.conditionSummaryCard)).toBeNull();
  });

  it('redirects /insights/condition/pmdd the same way (the sweep pmdd "pass" was a false positive)', async () => {
    render(<InsightsConditionScreen todayIso={TODAY_ISO} conditionKey="pmdd" />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/insights');
    });
    expect(screen.queryByTestId(testIds.insights.conditionSummaryCard)).toBeNull();
  });

  it('keeps the tagged pcos condition screen mounted with its summary', async () => {
    render(<InsightsConditionScreen todayIso={TODAY_ISO} conditionKey="pcos" />);

    await waitFor(() => {
      expect(screen.getByTestId(testIds.insights.conditionSummaryCard)).toBeTruthy();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
