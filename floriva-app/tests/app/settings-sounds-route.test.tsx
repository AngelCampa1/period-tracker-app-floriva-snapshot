import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';

const mockSettingsSoundsScreen = jest.fn();

jest.mock('@/src/features/settings/screens/SettingsScreen', () => ({
  SettingsSoundsScreen: (...args: unknown[]) => mockSettingsSoundsScreen(...args),
}));

// eslint-disable-next-line import/first
import SettingsSoundsRoute from '@/app/(app)/settings/sounds';

describe('settings sounds route', () => {
  beforeEach(() => {
    mockSettingsSoundsScreen.mockReset();
    mockSettingsSoundsScreen.mockImplementation(() => <Text>settings-sounds-screen</Text>);
  });

  it('renders the sounds settings screen inside the settings stack', () => {
    render(<SettingsSoundsRoute />);

    expect(screen.getByText('settings-sounds-screen')).toBeTruthy();
    expect(mockSettingsSoundsScreen).toHaveBeenCalledWith({}, undefined);
  });
});
