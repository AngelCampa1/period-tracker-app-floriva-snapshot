describe('interactionFeedbackNative', () => {
  const env = process.env as Record<string, string | undefined>;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.resetModules();
    env.NODE_ENV = originalNodeEnv;
  });

  afterAll(() => {
    env.NODE_ENV = originalNodeEnv;
  });

  it('creates an audio player when expo-audio is available', () => {
    const mockPlayer = {
      play: jest.fn(),
      seekTo: jest.fn(),
      release: jest.fn(),
    };

    jest.doMock(
      'expo-modules-core',
      () => ({
        requireOptionalNativeModule: () => ({}),
      }),
      { virtual: true },
    );
    jest.doMock(
      'expo-audio',
      () => ({
        createAudioPlayer: jest.fn(() => mockPlayer),
      }),
      { virtual: true },
    );
    jest.doMock(
      'expo-haptics',
      () => ({
        selectionAsync: jest.fn(),
        impactAsync: jest.fn(),
        ImpactFeedbackStyle: {
          Soft: 'soft',
        },
      }),
      { virtual: true },
    );

    const { createInteractionFeedbackAudioPlayer } = require(
      '@/src/features/feedback/interactionFeedbackNative'
    );

    expect(createInteractionFeedbackAudioPlayer(123)).toBe(mockPlayer);
  });

  it('still creates an audio player in dev mode when ExpoAudio is available', () => {
    env.NODE_ENV = 'development';

    const mockPlayer = {
      play: jest.fn(),
      seekTo: jest.fn(),
      release: jest.fn(),
    };

    jest.doMock(
      'expo-modules-core',
      () => ({
        requireOptionalNativeModule: () => ({}),
      }),
      { virtual: true },
    );
    jest.doMock(
      'expo-audio',
      () => ({
        createAudioPlayer: jest.fn(() => mockPlayer),
      }),
      { virtual: true },
    );

    const { createInteractionFeedbackAudioPlayer } = require(
      '@/src/features/feedback/interactionFeedbackNative'
    );

    expect(createInteractionFeedbackAudioPlayer(123)).toBe(mockPlayer);
  });

  it('returns null when expo-audio cannot be loaded', () => {
    jest.doMock(
      'expo-modules-core',
      () => ({
        requireOptionalNativeModule: () => null,
      }),
      { virtual: true },
    );
    jest.doMock(
      'expo-audio',
      () => {
        throw new Error("Cannot find native module 'ExpoAudio'");
      },
      { virtual: true },
    );

    const { createInteractionFeedbackAudioPlayer } = require(
      '@/src/features/feedback/interactionFeedbackNative'
    );

    expect(createInteractionFeedbackAudioPlayer(123)).toBeNull();
  });

  it('returns null when expo-haptics cannot be loaded', () => {
    jest.doMock(
      'expo-modules-core',
      () => ({
        requireOptionalNativeModule: () => null,
      }),
      { virtual: true },
    );
    jest.doMock(
      'expo-haptics',
      () => {
        throw new Error("Cannot find native module 'ExpoHaptics'");
      },
      { virtual: true },
    );

    const { getInteractionFeedbackHapticsModule } = require(
      '@/src/features/feedback/interactionFeedbackNative'
    );

    expect(getInteractionFeedbackHapticsModule()).toBeNull();
  });
});
