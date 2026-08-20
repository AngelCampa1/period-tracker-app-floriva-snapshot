import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';

const mockSubscribeScreen = jest.fn();

jest.mock('@/src/features/billing/screens/SubscribeScreen', () => ({
  SubscribeScreen: (...args: unknown[]) => mockSubscribeScreen(...args),
}));

// eslint-disable-next-line import/first
import SubscribeRoute from '@/app/(app)/subscribe';

describe('subscribe route', () => {
  beforeEach(() => {
    mockSubscribeScreen.mockReset();
    mockSubscribeScreen.mockImplementation(() => <Text>subscribe-route</Text>);
  });

  it('renders the main app subscribe route with the shared subscribe screen', () => {
    render(<SubscribeRoute />);

    expect(screen.getByText('subscribe-route')).toBeTruthy();
    expect(mockSubscribeScreen).toHaveBeenCalledWith({}, undefined);
  });
});
