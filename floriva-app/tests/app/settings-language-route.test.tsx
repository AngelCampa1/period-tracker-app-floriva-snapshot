import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';

const mockSettingsLanguageScreen = jest.fn();

jest.mock('@/src/features/settings/screens/SettingsScreen', () => ({
  SettingsLanguageScreen: (...args: unknown[]) => mockSettingsLanguageScreen(...args),
}));

// eslint-disable-next-line import/first
import SettingsLanguageRoute from '@/app/(app)/settings/language';

describe('settings language route', () => {
  beforeEach(() => {
    mockSettingsLanguageScreen.mockReset();
    mockSettingsLanguageScreen.mockImplementation(() => <Text>settings-language-screen</Text>);
  });

  it('renders the language settings screen inside the settings stack', () => {
    render(<SettingsLanguageRoute />);

    expect(screen.getByText('settings-language-screen')).toBeTruthy();
    expect(mockSettingsLanguageScreen).toHaveBeenCalledWith({}, undefined);
  });
});
