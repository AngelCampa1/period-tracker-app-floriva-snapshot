import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';

const mockSettingsFeedbackScreen = jest.fn();

jest.mock('@/src/features/settings/screens/SettingsScreen', () => ({
  SettingsFeedbackScreen: (...args: unknown[]) => mockSettingsFeedbackScreen(...args),
}));

// eslint-disable-next-line import/first
import SettingsFeedbackRoute from '@/app/(app)/settings/feedback';

describe('settings feedback route', () => {
  beforeEach(() => {
    mockSettingsFeedbackScreen.mockReset();
    mockSettingsFeedbackScreen.mockImplementation(() => <Text>settings-feedback-screen</Text>);
  });

  it('renders the feedback settings screen inside the settings stack', () => {
    render(<SettingsFeedbackRoute />);

    expect(screen.getByText('settings-feedback-screen')).toBeTruthy();
    expect(mockSettingsFeedbackScreen).toHaveBeenCalledWith({}, undefined);
  });
});
