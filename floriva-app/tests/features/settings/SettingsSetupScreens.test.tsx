import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { SettingsCycleSetupScreen } from '@/src/features/settings/screens/SettingsCycleSetupScreen';
import { SettingsTrackingSetupScreen } from '@/src/features/settings/screens/SettingsTrackingSetupScreen';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockGetProfile = jest.fn();
const mockSaveProfile = jest.fn();
const mockGetPreferences = jest.fn();
const mockSavePreferences = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: (...args: unknown[]) => mockBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  }),
}));

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({
    repositories: {
      userProfile: {
        getProfile: () => mockGetProfile(),
        saveProfile: (...args: unknown[]) => mockSaveProfile(...args),
      },
      appPreferences: {
        getPreferences: () => mockGetPreferences(),
        savePreferences: (...args: unknown[]) => mockSavePreferences(...args),
      },
    },
  }),
}));

describe('Settings setup screens', () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockReplace.mockReset();
    mockGetProfile.mockReset();
    mockSaveProfile.mockReset();
    mockGetPreferences.mockReset();
    mockSavePreferences.mockReset();
    mockGetPreferences.mockResolvedValue({
      deferredCycleSetup: true,
      deferredTrackingSetup: true,
      showFertilityEstimates: true,
    });
  });

  it('hydrates, validates, and saves cycle setup changes', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 31,
      periodLengthDays: 6,
      lastPeriodStartDate: '2026-04-01',
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: ['pmdd'],
      ttcTrackingPreferences: {
        sex: true,
        ovulationTest: true,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
    });

    render(<SettingsCycleSetupScreen />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('31')).toBeTruthy();
      expect(screen.getByDisplayValue('6')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText('Cycle length (days)'), '0');
    fireEvent.changeText(screen.getByLabelText('Period length (days)'), '40');
    fireEvent.press(screen.getByText('Save cycle details'));

    expect(screen.getByText('Enter a cycle length between 1 and 120 days.')).toBeTruthy();
    expect(screen.getByText('Enter a period length between 1 and 30 days.')).toBeTruthy();
    expect(mockSaveProfile).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByLabelText('Cycle length (days)'), 'abc');
    fireEvent.press(screen.getByText('Save cycle details'));
    expect(screen.getByText('Enter a cycle length between 1 and 120 days.')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Cycle length (days)'), '29');
    fireEvent.changeText(screen.getByLabelText('Period length (days)'), '5');
    fireEvent.press(screen.getByText('Cycles are fairly steady'));
    fireEvent.press(screen.getByText('Cycles can vary'));
    fireEvent.press(screen.getByText('Save cycle details'));

    await waitFor(() => {
      expect(mockSaveProfile).toHaveBeenCalledWith({
        cycleLengthDays: 29,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-01',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: true,
        conditionTags: ['pmdd'],
        ttcTrackingPreferences: {
          sex: true,
          ovulationTest: true,
          cervicalMucus: false,
          basalBodyTemperature: false,
        },
      });
      expect(mockSavePreferences).toHaveBeenCalledWith({
        deferredCycleSetup: false,
        deferredTrackingSetup: true,
        showFertilityEstimates: true,
      });
      expect(mockReplace).toHaveBeenCalledWith('/today');
    });
  });

  it('shows cycle setup load and save failures', async () => {
    mockGetProfile.mockRejectedValueOnce(new Error('load failed'));
    mockGetProfile.mockResolvedValueOnce({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-04-01',
      goals: ['period'],
      supportsIrregularCycles: false,
      conditionTags: [],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
    });
    mockSaveProfile.mockRejectedValueOnce(new Error('save failed'));

    render(<SettingsCycleSetupScreen />);

    await waitFor(() => {
      expect(screen.getByText('Floriva could not load your saved cycle details.')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Save cycle details'));

    await waitFor(() => {
      expect(screen.getByText('Floriva could not save those cycle details.')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('hydrates, toggles, and saves tracking setup across off, essential, and detailed modes', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 30,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-04-02',
      goals: ['period'],
      supportsIrregularCycles: false,
      conditionTags: ['pcos'],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
    });

    render(<SettingsTrackingSetupScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('settings-tracking-setup-screen')).toBeTruthy();
    });

    fireEvent(screen.getByTestId('settings-tracking-symptoms-toggle'), 'valueChange', true);
    fireEvent.press(screen.getByText('Essential conception'));
    fireEvent.press(screen.getByText('PMDD'));
    fireEvent.press(screen.getByText('Save tracking setup'));

    await waitFor(() => {
      expect(mockSaveProfile).toHaveBeenCalledWith({
        cycleLengthDays: 30,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-02',
        goals: ['period', 'symptoms', 'trying-to-conceive'],
        supportsIrregularCycles: false,
        conditionTags: ['pcos', 'pmdd'],
        ttcTrackingPreferences: {
          sex: true,
          ovulationTest: true,
          cervicalMucus: false,
          basalBodyTemperature: false,
        },
      });
      expect(mockSavePreferences).toHaveBeenCalledWith({
        deferredCycleSetup: true,
        deferredTrackingSetup: false,
        showFertilityEstimates: true,
      });
      expect(mockReplace).toHaveBeenCalledWith('/today');
    });
  });

  it('saves detailed and off conception presets with the matching tracking preferences', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 30,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-04-02',
      goals: ['period'],
      supportsIrregularCycles: false,
      conditionTags: ['pcos'],
      ttcTrackingPreferences: {
        sex: false,
        ovulationTest: false,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
    });

    render(<SettingsTrackingSetupScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('settings-tracking-setup-screen')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Detailed conception'));
    fireEvent.press(screen.getByText('Endometriosis'));
    fireEvent(screen.getByTestId('settings-fertility-estimates-toggle'), 'valueChange', false);
    fireEvent.press(screen.getByText('Save tracking setup'));

    await waitFor(() => {
      expect(mockSaveProfile).toHaveBeenCalledWith({
        cycleLengthDays: 30,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-02',
        goals: ['period', 'trying-to-conceive'],
        supportsIrregularCycles: false,
        conditionTags: ['pcos', 'endometriosis'],
        ttcTrackingPreferences: {
          sex: true,
          ovulationTest: true,
          cervicalMucus: true,
          basalBodyTemperature: true,
        },
      });
      expect(mockSavePreferences).toHaveBeenCalledWith({
        deferredCycleSetup: true,
        deferredTrackingSetup: false,
        showFertilityEstimates: false,
      });
    });

    mockSaveProfile.mockReset();
    mockSavePreferences.mockReset();
    fireEvent(screen.getByTestId('settings-fertility-estimates-toggle'), 'valueChange', true);
    fireEvent.press(screen.getByText('Conception tracking off'));
    fireEvent.press(screen.getByText('Save tracking setup'));

    await waitFor(() => {
      expect(mockSaveProfile).toHaveBeenCalledWith({
        cycleLengthDays: 30,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-02',
        goals: ['period'],
        supportsIrregularCycles: false,
        conditionTags: ['pcos'],
        ttcTrackingPreferences: {
          sex: false,
          ovulationTest: false,
          cervicalMucus: false,
          basalBodyTemperature: false,
        },
      });
      expect(mockSavePreferences).toHaveBeenCalledWith({
        deferredCycleSetup: true,
        deferredTrackingSetup: false,
        showFertilityEstimates: true,
      });
    });
  });

  it('shows tracking setup load and save failures', async () => {
    mockGetProfile.mockRejectedValueOnce(new Error('load failed'));
    mockGetProfile.mockResolvedValueOnce({
      cycleLengthDays: 28,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-04-01',
      goals: ['period', 'trying-to-conceive'],
      supportsIrregularCycles: false,
      conditionTags: [],
      ttcTrackingPreferences: {
        sex: true,
        ovulationTest: true,
        cervicalMucus: true,
        basalBodyTemperature: true,
      },
    });
    mockSaveProfile.mockRejectedValueOnce(new Error('save failed'));

    render(<SettingsTrackingSetupScreen />);

    await waitFor(() => {
      expect(screen.getByText('Floriva could not load your saved tracking setup.')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Save tracking setup'));

    await waitFor(() => {
      expect(screen.getByText('Floriva could not save those tracking choices.')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('hydrates the essential conception preset and can remove an existing condition tag', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 27,
      periodLengthDays: 5,
      lastPeriodStartDate: '2026-04-03',
      goals: ['period', 'trying-to-conceive'],
      supportsIrregularCycles: false,
      conditionTags: ['pcos'],
      ttcTrackingPreferences: {
        sex: true,
        ovulationTest: true,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
    });

    render(<SettingsTrackingSetupScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('settings-tracking-setup-screen')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('PCOS'));
    fireEvent.press(screen.getByText('Save tracking setup'));

    await waitFor(() => {
      expect(mockSaveProfile).toHaveBeenCalledWith({
        cycleLengthDays: 27,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-04-03',
        goals: ['period', 'trying-to-conceive'],
        supportsIrregularCycles: false,
        conditionTags: [],
        ttcTrackingPreferences: {
          sex: true,
          ovulationTest: true,
          cervicalMucus: false,
          basalBodyTemperature: false,
        },
      });
    });
  });
});
