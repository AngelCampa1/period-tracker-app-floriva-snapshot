import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';

import {
  useFocusRefreshVersion,
  useOptionalFocusEffect,
} from '@/src/lib/navigation/useOptionalFocusEffect';

let mockFocusEffect: ((effect: () => void) => void) | undefined;

jest.mock('expo-router', () => ({
  get useFocusEffect() {
    return mockFocusEffect;
  },
}));

afterEach(() => {
  mockFocusEffect = undefined;
});

function FocusProbe({ onVersion }: { onVersion: (version: number) => void }) {
  const version = useFocusRefreshVersion();
  onVersion(version);
  return <Text>{`v${version}`}</Text>;
}

function OptionalProbe({ effect }: { effect: () => void }) {
  useOptionalFocusEffect(effect);
  return <Text>probe</Text>;
}

describe('useOptionalFocusEffect', () => {
  it('invokes the focus effect when expo-router exposes useFocusEffect', () => {
    const captured: (() => void)[] = [];
    mockFocusEffect = (effect) => {
      captured.push(effect);
    };
    const effect = jest.fn();

    render(<OptionalProbe effect={effect} />);

    expect(captured).toHaveLength(1);
    captured[0]?.();
    expect(effect).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when useFocusEffect is unavailable (e.g. test harness)', () => {
    mockFocusEffect = undefined;
    const effect = jest.fn();

    expect(() => render(<OptionalProbe effect={effect} />)).not.toThrow();
    expect(effect).not.toHaveBeenCalled();
  });
});

describe('useFocusRefreshVersion', () => {
  it('starts at zero and increments each time the screen regains focus', () => {
    let registeredEffect: (() => void) | undefined;
    mockFocusEffect = (effect) => {
      registeredEffect = effect;
    };
    const versions: number[] = [];

    render(<FocusProbe onVersion={(version) => versions.push(version)} />);

    expect(versions[0]).toBe(0);

    act(() => {
      registeredEffect?.();
    });

    expect(versions[versions.length - 1]).toBe(1);
  });

  it('stays at zero without a focus mechanism', () => {
    mockFocusEffect = undefined;
    const versions: number[] = [];

    render(<FocusProbe onVersion={(version) => versions.push(version)} />);

    expect(versions).toEqual([0]);
  });
});
