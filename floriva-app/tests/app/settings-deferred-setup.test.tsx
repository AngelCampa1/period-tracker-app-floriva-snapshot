import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { defaultAppPreferences } from '@/src/db/domainDefaults';

const mockReplace = jest.fn();
const mockGetProfile = jest.fn();
const mockSaveProfile = jest.fn();
const mockGetPreferences = jest.fn();
const mockSavePreferences = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: (...args: unknown[]) => mockReplace(...args),
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

jest.mock('@/src/localization/LocalizationProvider', () => {
  const { createMockLocalization } = require('../helpers/mockLocalizationProvider');

  return {
    useLocalization: () => createMockLocalization(),
  };
});

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({
    repositories: {
      userProfile: {
        getProfile: (...args: unknown[]) => mockGetProfile(...args),
        saveProfile: (...args: unknown[]) => mockSaveProfile(...args),
      },
      appPreferences: {
        getPreferences: (...args: unknown[]) => mockGetPreferences(...args),
        savePreferences: (...args: unknown[]) => mockSavePreferences(...args),
      },
    },
  }),
}));

// eslint-disable-next-line import/first
import SettingsCycleSetupRoute from '@/app/(app)/settings/cycle-setup';
// eslint-disable-next-line import/first
import SettingsTrackingSetupRoute from '@/app/(app)/settings/tracking-setup';
// eslint-disable-next-line import/first
import { testIds } from '@/src/testing/testIds';

describe('settings deferred setup routes', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockGetProfile.mockReset();
    mockSaveProfile.mockReset();
    mockGetPreferences.mockReset();
    mockSavePreferences.mockReset();

    mockGetPreferences.mockResolvedValue(defaultAppPreferences);
    mockSavePreferences.mockResolvedValue(undefined);
  });

  it('saves refined cycle details and clears the deferred cycle follow-up', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 29,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-04-01',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: true,
      conditionTags: [],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
    });
    mockGetPreferences.mockResolvedValue({
      ...defaultAppPreferences,
      deferredCycleSetup: true,
    });

    render(<SettingsCycleSetupRoute />);

    await waitFor(() => {
      expect(screen.getByTestId(testIds.settings.cycleSetupScreen)).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText('Cycle length (days)'), '31');
    fireEvent.changeText(screen.getByLabelText('Period length (days)'), '6');
    fireEvent.press(screen.getByText('Cycles can vary'));
    fireEvent.press(screen.getByText('Save cycle details'));

    await waitFor(() => {
      expect(mockSaveProfile).toHaveBeenCalledWith({
        cycleLengthDays: 31,
        periodLengthDays: 6,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: true,
        conditionTags: [],
        ttcTrackingPreferences: {
          sex: false,
          ovulationTest: false,
          cervicalMucus: false,
          basalBodyTemperature: false,
        },
      });
      expect(mockSavePreferences).toHaveBeenCalledWith({
        ...defaultAppPreferences,
        deferredCycleSetup: false,
      });
      expect(mockReplace).toHaveBeenCalledWith('/today');
    });
  });

  it('saves tracking choices and clears the deferred tracking follow-up', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 29,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-04-01',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: true,
      conditionTags: [],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
    });
    mockGetPreferences.mockResolvedValue({
      ...defaultAppPreferences,
      deferredTrackingSetup: true,
    });

    render(<SettingsTrackingSetupRoute />);

    await waitFor(() => {
      expect(screen.getByTestId(testIds.settings.trackingSetupScreen)).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Detailed conception'));
    fireEvent.press(screen.getByText('PMDD'));
    fireEvent.press(screen.getByText('Save tracking setup'));

    await waitFor(() => {
      expect(mockSaveProfile).toHaveBeenCalledWith({
        cycleLengthDays: 29,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'symptoms', 'trying-to-conceive'],
        supportsIrregularCycles: true,
        conditionTags: ['pmdd'],
        ttcTrackingPreferences: {
          sex: true,
          ovulationTest: true,
          cervicalMucus: true,
          basalBodyTemperature: true,
        },
      });
      expect(mockSavePreferences).toHaveBeenCalledWith({
        ...defaultAppPreferences,
        deferredTrackingSetup: false,
      });
      expect(mockReplace).toHaveBeenCalledWith('/today');
    });
  });
});
