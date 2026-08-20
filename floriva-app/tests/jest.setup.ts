const { configure } = require('@testing-library/react-native');

jest.setTimeout(45000);
configure({ asyncUtilTimeout: 5000 });

const mockCreateAnimationBuilder = () => {
  const builder = {
    delay: jest.fn(),
    duration: jest.fn(),
    springify: jest.fn(),
    withInitialValues: jest.fn(),
  };

  builder.delay.mockReturnValue(builder);
  builder.duration.mockReturnValue(builder);
  builder.springify.mockReturnValue(builder);
  builder.withInitialValues.mockReturnValue(builder);

  return builder;
};

jest.mock('react-native-reanimated', () => {
  const ReactNative = require('react-native');

  const Animated = {
    Image: ReactNative.Image,
    ScrollView: ReactNative.ScrollView,
    Text: ReactNative.Text,
    View: ReactNative.View,
    call: jest.fn(),
    createAnimatedComponent: (component: unknown) => component,
  };

  const Reanimated = {
    __esModule: true,
    default: Animated,
    FadeIn: mockCreateAnimationBuilder(),
    LinearTransition: mockCreateAnimationBuilder(),
    cancelAnimation: jest.fn(),
    interpolate: jest.fn((value: unknown) => value),
    interpolateColor: jest.fn((value: unknown) => value),
    runOnJS: jest.fn((callback: unknown) => callback),
    useAnimatedStyle: jest.fn((updater: () => unknown) => updater()),
    useDerivedValue: jest.fn((updater: () => unknown) => ({ value: updater() })),
    useReducedMotion: jest.fn(() => false),
    useSharedValue: jest.fn((value: unknown) => ({ value })),
    withSpring: jest.fn((value: unknown) => value),
    withTiming: jest.fn((value: unknown) => value),
  };

  return Reanimated;
});

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');

  return {
    ...actual,
    useSafeAreaInsets: () => ({
      top: 0,
      right: 0,
      bottom: 24,
      left: 0,
    }),
  };
});

jest.mock('@react-native-community/datetimepicker', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');

  return {
    __esModule: true,
    default: ({
      testID,
      value,
      onChange,
      accentColor,
      themeVariant,
    }: {
      testID?: string;
      value?: Date;
      onChange?: (...args: unknown[]) => void;
      accentColor?: string;
      themeVariant?: string;
    }) =>
      React.createElement(
        Text,
        { testID, onChange, accentColor, themeVariant },
        value instanceof Date ? value.toISOString().slice(0, 10) : 'mock-date-picker',
      ),
    DateTimePickerAndroid: {
      open: jest.fn(),
    },
  };
});

jest.mock('@expo/vector-icons/FontAwesome', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');

  const MockFontAwesome = ({
    name,
    testID,
  }: {
    name?: string;
    testID?: string;
  }) => React.createElement(Text, { testID }, name ?? 'icon');

  return {
    __esModule: true,
    default: Object.assign(MockFontAwesome, { font: {} }),
  };
});

// expo-glass-effect wraps a native (Apple-only) module. In jest there is no
// native module, and jest-expo defaults Platform.OS to 'ios', so any component
// rendering GlassSurface would call the missing native `isLiquidGlassAvailable`
// and crash. Mock it globally to the "glass unavailable" branch: GlassSurface
// then renders its readable solid fallback in tests. Individual tests may
// override this mock locally to exercise the real-glass branch.
jest.mock('expo-glass-effect', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');

  const Passthrough = ({
    children,
    ...props
  }: {
    children?: unknown;
    [key: string]: unknown;
  }) => React.createElement(View, props, children);

  return {
    __esModule: true,
    isLiquidGlassAvailable: () => false,
    isGlassEffectAPIAvailable: () => false,
    GlassView: Passthrough,
    GlassContainer: Passthrough,
  };
});

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    seekTo: jest.fn(),
    release: jest.fn(),
  })),
}));

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: {
    Soft: 'soft',
  },
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
    execSync: jest.fn(),
  })),
}));

jest.mock('drizzle-orm/expo-sqlite', () => ({
  drizzle: jest.fn(() => ({})),
}));

jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({
  useMigrations: jest.fn(() => ({
    success: true,
    error: undefined,
  })),
}));

const originalConsoleError = console.error;

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const [firstArg, secondArg] = args;

    if (
      typeof firstArg === 'string' &&
      firstArg.includes(
        'An update to %s inside a test was not wrapped in act(...)',
      ) &&
      (secondArg === 'TodayScreenContent' ||
        secondArg === 'TodayLoggingCard' ||
        secondArg === 'BillingProvider' ||
        secondArg === 'ConnectedLiveBillingProvider' ||
        secondArg === 'InsightsCyclePatternScreen' ||
        secondArg === 'InsightsTtcScreen' ||
        secondArg === 'InsightsConditionScreen')
    ) {
      return;
    }

    originalConsoleError(...args);
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});
