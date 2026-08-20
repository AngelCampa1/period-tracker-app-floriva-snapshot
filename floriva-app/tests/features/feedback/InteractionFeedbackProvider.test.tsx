import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockGetPreferences = jest.fn();
const mockSavePreferences = jest.fn();
const mockImpactAsync = jest.fn();
const mockSelectionAsync = jest.fn();
const mockCreateInteractionFeedbackAudioPlayer = jest.fn();
const mockGetInteractionFeedbackHapticsModule = jest.fn();
const mockRelease = jest.fn();
const mockPlay = jest.fn();
const mockSeekTo = jest.fn();

let mockStoredPreferences = {
  hasCompletedOnboarding: true,
  deferredBiometricsSetup: false,
  deferredReminderSetup: false,
  deferredImportSetup: false,
  themePreference: 'system' as const,
  localePreference: 'system' as const,
  hapticsEnabled: true,
  tapSoundEnabled: false,
};

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({
    repositories: {
      appPreferences: {
        getPreferences: (...args: unknown[]) => mockGetPreferences(...args),
        savePreferences: (...args: unknown[]) => mockSavePreferences(...args),
      },
    },
  }),
}));

jest.mock('@/src/features/feedback/interactionFeedbackNative', () => ({
  createInteractionFeedbackAudioPlayer: (...args: unknown[]) =>
    mockCreateInteractionFeedbackAudioPlayer(...args),
  getInteractionFeedbackHapticsModule: (...args: unknown[]) =>
    mockGetInteractionFeedbackHapticsModule(...args),
}));

// eslint-disable-next-line import/first
import {
  InteractionFeedbackProvider,
  useInteractionFeedback,
  useOptionalInteractionFeedback,
} from '@/src/features/feedback/InteractionFeedbackProvider';
// eslint-disable-next-line import/first
import { notifyInteractionFeedbackChanged } from '@/src/features/feedback/interactionFeedbackSync';

function InteractionFeedbackConsumer() {
  const {
    hapticsEnabled,
    tapSoundEnabled,
    setHapticsEnabled,
    setTapSoundEnabled,
    triggerPressFeedback,
  } = useInteractionFeedback();

  return (
    <>
      <Text>haptics:{String(hapticsEnabled)}</Text>
      <Text>tap-sound:{String(tapSoundEnabled)}</Text>
      <Text
        onPress={() => {
          return triggerPressFeedback('selection');
        }}
      >
        trigger-selection
      </Text>
      <Text
        onPress={() => {
          return setHapticsEnabled(false);
        }}
      >
        disable-haptics
      </Text>
      <Text
        onPress={() => {
          return setTapSoundEnabled(true);
        }}
      >
        enable-tap-sound
      </Text>
      <Text
        onPress={() => {
          return triggerPressFeedback('action');
        }}
      >
        trigger-action
      </Text>
    </>
  );
}

function OptionalInteractionFeedbackConsumer() {
  const interactionFeedback = useOptionalInteractionFeedback();

  return <Text>optional:{String(interactionFeedback === null)}</Text>;
}

function RequiredInteractionFeedbackConsumer() {
  useInteractionFeedback();

  return <Text>required</Text>;
}

describe('InteractionFeedbackProvider', () => {
  beforeEach(() => {
    mockGetPreferences.mockReset();
    mockSavePreferences.mockReset();
    mockImpactAsync.mockReset();
    mockSelectionAsync.mockReset();
    mockCreateInteractionFeedbackAudioPlayer.mockReset();
    mockGetInteractionFeedbackHapticsModule.mockReset();
    mockRelease.mockReset();
    mockPlay.mockReset();
    mockSeekTo.mockReset();
    mockStoredPreferences = {
      hasCompletedOnboarding: true,
      deferredBiometricsSetup: false,
      deferredReminderSetup: false,
      deferredImportSetup: false,
      themePreference: 'system',
      localePreference: 'system',
      hapticsEnabled: true,
      tapSoundEnabled: false,
    };
    mockGetPreferences.mockImplementation(async () => mockStoredPreferences);
    mockSavePreferences.mockImplementation(async (nextPreferences) => {
      mockStoredPreferences = nextPreferences;
    });
    mockCreateInteractionFeedbackAudioPlayer.mockReturnValue({
      play: mockPlay,
      release: mockRelease,
      seekTo: mockSeekTo,
    });
    mockGetInteractionFeedbackHapticsModule.mockReturnValue({
      ImpactFeedbackStyle: {
        Soft: 'soft',
      },
      impactAsync: mockImpactAsync,
      selectionAsync: mockSelectionAsync,
    });
  });

  it('hydrates feedback preferences from storage and triggers selection haptics only when sound is off', async () => {
    render(
      <InteractionFeedbackProvider>
        <InteractionFeedbackConsumer />
      </InteractionFeedbackProvider>,
    );

    await screen.findByText('haptics:true');
    expect(screen.getByText('tap-sound:false')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText('trigger-selection'));
    });

    expect(mockSelectionAsync).toHaveBeenCalledTimes(1);
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('suppresses press feedback until persisted preferences finish hydrating', async () => {
    let resolvePreferences: ((preferences: typeof mockStoredPreferences) => void) | null = null;
    mockGetPreferences.mockReturnValue(
      new Promise<typeof mockStoredPreferences>((resolve) => {
        resolvePreferences = resolve;
      }),
    );

    render(
      <InteractionFeedbackProvider>
        <InteractionFeedbackConsumer />
      </InteractionFeedbackProvider>,
    );

    await act(async () => {
      fireEvent.press(screen.getByText('trigger-selection'));
    });

    expect(mockSelectionAsync).not.toHaveBeenCalled();
    expect(mockPlay).not.toHaveBeenCalled();

    await act(async () => {
      resolvePreferences?.(mockStoredPreferences);
    });

    await screen.findByText('haptics:true');
  });

  it('persists haptics preference changes and suppresses future haptics once disabled', async () => {
    render(
      <InteractionFeedbackProvider>
        <InteractionFeedbackConsumer />
      </InteractionFeedbackProvider>,
    );

    await screen.findByText('haptics:true');

    await act(async () => {
      fireEvent.press(screen.getByText('disable-haptics'));
    });

    await waitFor(() => {
      expect(mockSavePreferences).toHaveBeenCalledWith({
        ...mockStoredPreferences,
        hapticsEnabled: false,
      });
      expect(screen.getByText('haptics:false')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('trigger-selection'));
    });

    expect(mockSelectionAsync).not.toHaveBeenCalled();
  });

  it('rehydrates after an external preference change notification', async () => {
    render(
      <InteractionFeedbackProvider>
        <InteractionFeedbackConsumer />
      </InteractionFeedbackProvider>,
    );

    await screen.findByText('haptics:true');

    mockStoredPreferences = {
      ...mockStoredPreferences,
      hapticsEnabled: false,
      tapSoundEnabled: true,
    };

    await act(async () => {
      notifyInteractionFeedbackChanged();
    });

    await waitFor(() => {
      expect(screen.getByText('haptics:false')).toBeTruthy();
      expect(screen.getByText('tap-sound:true')).toBeTruthy();
    });
  });

  it('persists tap-sound preference changes and reuses the shared player for impact feedback', async () => {
    render(
      <InteractionFeedbackProvider>
        <InteractionFeedbackConsumer />
      </InteractionFeedbackProvider>,
    );

    await screen.findByText('tap-sound:false');

    await act(async () => {
      fireEvent.press(screen.getByText('enable-tap-sound'));
    });

    await waitFor(() => {
      expect(mockSavePreferences).toHaveBeenCalledWith({
        ...mockStoredPreferences,
        tapSoundEnabled: true,
      });
      expect(screen.getByText('tap-sound:true')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('trigger-action'));
    });

    expect(mockImpactAsync).toHaveBeenCalledWith('soft');
    expect(mockSeekTo).toHaveBeenCalledWith(0);
    expect(mockPlay).toHaveBeenCalledTimes(1);
  });

  it('exposes null from the optional hook when no provider is mounted', () => {
    render(<OptionalInteractionFeedbackConsumer />);

    expect(screen.getByText('optional:true')).toBeTruthy();
  });

  it('throws when the required interaction feedback hook is used outside the provider', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<RequiredInteractionFeedbackConsumer />)).toThrow(
      'useInteractionFeedback must be used within InteractionFeedbackProvider',
    );

    consoleErrorSpy.mockRestore();
  });

  it('degrades gracefully when native feedback modules are unavailable', async () => {
    mockCreateInteractionFeedbackAudioPlayer.mockReturnValue(null);
    mockGetInteractionFeedbackHapticsModule.mockReturnValue(null);
    mockStoredPreferences = {
      ...mockStoredPreferences,
      tapSoundEnabled: true,
    };

    render(
      <InteractionFeedbackProvider>
        <InteractionFeedbackConsumer />
      </InteractionFeedbackProvider>,
    );

    await screen.findByText('haptics:true');
    await screen.findByText('tap-sound:true');

    await act(async () => {
      fireEvent.press(screen.getByText('trigger-selection'));
      fireEvent.press(screen.getByText('trigger-action'));
    });

    expect(mockSelectionAsync).not.toHaveBeenCalled();
    expect(mockImpactAsync).not.toHaveBeenCalled();
    expect(mockSeekTo).not.toHaveBeenCalled();
    expect(mockPlay).not.toHaveBeenCalled();
  });
});
