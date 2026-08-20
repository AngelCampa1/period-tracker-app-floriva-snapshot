import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import {
  createMotionTestId,
  createStackMotionOptions,
  resolvePressMotion,
  resolveRevealPreset,
  resolveScreenMotionPreset,
  useFlorivaMotion,
} from '@/src/features/motion/useFlorivaMotion';
import { resolveTheme } from '@/src/theme/tokens';

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

function MotionConsumer({
  reducedMotionEnabled,
}: {
  reducedMotionEnabled?: boolean;
}) {
  const motion = useFlorivaMotion(reducedMotionEnabled);
  const screenPreset = motion.resolveScreenPreset('standard');

  return (
    <>
      <Text>{motion.mode}</Text>
      <Text>{String(screenPreset.distance)}</Text>
      <Text>{createMotionTestId('motion-screen', 'header-motion')}</Text>
    </>
  );
}

describe('useFlorivaMotion helpers', () => {
  it('softens reveal presets when reduced motion is enabled', () => {
    const motion = resolveTheme('light').motion;
    const fullPreset = resolveRevealPreset(motion, 'heroBloom', false);
    const reducedPreset = resolveRevealPreset(motion, 'heroBloom', true);

    expect(fullPreset.distance).toBeGreaterThan(reducedPreset.distance);
    expect(fullPreset.enterScale).toBeLessThan(reducedPreset.enterScale);
    expect(reducedPreset.distance).toBe(0);
    expect(reducedPreset.enterScale).toBe(1);
  });

  it('keeps sensitive screens calmer than hero screens', () => {
    const motion = resolveTheme('dark').motion;
    const heroPreset = resolveScreenMotionPreset(motion, 'hero', false);
    const sensitivePreset = resolveScreenMotionPreset(motion, 'sensitive', false);

    expect(heroPreset.distance).toBeGreaterThan(sensitivePreset.distance);
    expect(heroPreset.enterScale).toBeLessThan(sensitivePreset.enterScale);
  });

  it('removes press transforms for reduced motion users', () => {
    const motion = resolveTheme('light').motion;

    expect(resolvePressMotion(motion, false, 'primary')).toEqual({
      scale: motion.presets.pressFeedback.pressedScale,
      translateY: motion.presets.pressFeedback.pressedTranslateY,
    });
    expect(resolvePressMotion(motion, true, 'primary')).toBeNull();
    expect(resolvePressMotion(motion, false, 'destructive')).toEqual({
      scale: 0.985,
      translateY: 0,
    });
  });

  it('builds calmer stack transitions when reduced motion is enabled', () => {
    expect(createStackMotionOptions(false, 'onboarding')).toEqual({
      animation: 'slide_from_right',
      animationDuration: 360,
      headerShown: false,
    });
    expect(createStackMotionOptions(true, 'app')).toEqual({
      animation: 'fade',
      animationDuration: 120,
      headerShown: false,
    });
  });

  it('exposes standard screen presets and motion test ids through the hook', () => {
    render(<MotionConsumer />);

    expect(screen.getByText('full')).toBeTruthy();
    expect(screen.getByText(String(resolveTheme('light').motion.presets.screenEnter.distance))).toBeTruthy();
    expect(screen.getByText('motion-screen-header-motion')).toBeTruthy();
  });

  it('lets explicit hook overrides force reduced motion behavior', () => {
    render(<MotionConsumer reducedMotionEnabled />);

    expect(screen.getByText('reduced')).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
  });
});
