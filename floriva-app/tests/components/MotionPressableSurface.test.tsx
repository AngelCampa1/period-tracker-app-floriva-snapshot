import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { MotionPressableSurface } from '@/src/components/primitives/MotionPressableSurface';

const mockTriggerPressFeedback = jest.fn();

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/src/features/feedback/InteractionFeedbackProvider', () => ({
  useOptionalInteractionFeedback: () => ({
    triggerPressFeedback: (...args: unknown[]) => mockTriggerPressFeedback(...args),
  }),
}));

describe('MotionPressableSurface', () => {
  beforeEach(() => {
    mockTriggerPressFeedback.mockReset();
  });

  it('renders without a reveal wrapper and forwards press lifecycle callbacks', () => {
    const handlePress = jest.fn();
    const handlePressIn = jest.fn();
    const handlePressOut = jest.fn();

    render(
      <MotionPressableSurface
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        testID="motion-surface"
      >
        <Text>Open</Text>
      </MotionPressableSurface>,
    );

    const surface = screen.getByTestId('motion-surface');

    fireEvent(surface, 'pressIn');
    fireEvent(surface, 'pressOut');
    fireEvent.press(surface);

    expect(handlePressIn).toHaveBeenCalledTimes(1);
    expect(handlePressOut).toHaveBeenCalledTimes(1);
    expect(handlePress).toHaveBeenCalledTimes(1);
    expect(mockTriggerPressFeedback).toHaveBeenCalledWith('action');
  });
});
