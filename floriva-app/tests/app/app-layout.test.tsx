import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

const mockGetProfile = jest.fn();
let mockPathname = '/';
const mockStack = jest.fn();
const mockUserProfileRepository = {
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
};

jest.mock('expo-router', () => {
  const React = require('react');
  const { Text: MockText } = require('react-native');
  const { useOnboarding } = require('@/src/features/onboarding/OnboardingProvider');

  return {
    usePathname: () => mockPathname,
    Stack: (props: { screenOptions: unknown }) => {
      const { draft } = useOnboarding();
      mockStack(props);

      return <MockText>cycle {draft.cycleLengthInput}</MockText>;
    },
  };
});

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({
    repositories: {
      userProfile: mockUserProfileRepository,
    },
  }),
}));

jest.mock('@/src/features/motion/useFlorivaMotion', () => ({
  createStackMotionOptions: (reducedMotionEnabled: boolean, scope: string) => ({
    reducedMotionEnabled,
    scope,
  }),
  useFlorivaMotion: () => ({
    reducedMotionEnabled: false,
  }),
}));

// eslint-disable-next-line import/first
import AppLayout from '@/app/(app)/_layout';

describe('AppLayout', () => {
  beforeEach(() => {
    mockPathname = '/';
    mockGetProfile.mockReset();
    mockStack.mockClear();
  });

  it('gates app routes until the settings TTC draft is hydrated from the local profile', async () => {
    mockGetProfile.mockResolvedValue({
      cycleLengthDays: 31,
      periodLengthDays: 6,
      lastPeriodStartDate: '2026-03-30',
      goals: ['period', 'trying-to-conceive'],
      supportsIrregularCycles: false,
      conditionTags: ['pmdd'],
      ttcTrackingPreferences: {
        sex: true,
        ovulationTest: false,
        cervicalMucus: true,
        basalBodyTemperature: false,
      },
    });

    render(<AppLayout />);

    expect(screen.getByText('Loading...')).toBeTruthy();
    expect(mockStack).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByText('cycle 31')).toBeTruthy();
      expect(mockStack).toHaveBeenCalledWith({
        screenOptions: { reducedMotionEnabled: false, scope: 'app' },
      });
    });
  });

  it('renders app routes with a default settings draft when the local profile cannot be loaded', async () => {
    mockGetProfile.mockRejectedValue(new Error('profile unavailable'));

    render(<AppLayout />);

    await waitFor(() => {
      expect(screen.getByText('cycle 29')).toBeTruthy();
    });

    expect(mockStack).toHaveBeenCalledWith({
      screenOptions: { reducedMotionEnabled: false, scope: 'app' },
    });
  });

  it('blocks profile-backed TTC setup edits when the local profile cannot be loaded', async () => {
    mockPathname = '/settings/ttc-expectations';
    mockGetProfile.mockRejectedValue(new Error('profile unavailable'));

    render(<AppLayout />);

    await waitFor(() => {
      expect(screen.getByText('Unable to load settings')).toBeTruthy();
    });

    expect(mockStack).not.toHaveBeenCalled();
  });
});
