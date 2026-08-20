import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';

const mockSettingsBirthControlScreen = jest.fn();

jest.mock('@/src/features/settings/screens/SettingsScreen', () => ({
  SettingsBirthControlScreen: (...args: unknown[]) => mockSettingsBirthControlScreen(...args),
}));

// eslint-disable-next-line import/first
import SettingsBirthControlRoute from '@/app/(app)/settings/birth-control';

describe('settings birth-control route', () => {
  beforeEach(() => {
    mockSettingsBirthControlScreen.mockReset();
    mockSettingsBirthControlScreen.mockImplementation(() => (
      <Text>settings-birth-control-screen</Text>
    ));
  });

  it('renders the birth-control settings screen inside the settings stack', () => {
    render(<SettingsBirthControlRoute />);

    expect(screen.getByText('settings-birth-control-screen')).toBeTruthy();
    expect(mockSettingsBirthControlScreen).toHaveBeenCalledWith({}, undefined);
  });
});
