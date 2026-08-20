import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { NotificationsScreen } from '@/src/features/onboarding/screens/NotificationsScreen';
import { OnboardingProvider } from '@/src/features/onboarding/OnboardingProvider';
import { testIds } from '@/src/testing/testIds';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockEnsureReminderPermissions = jest.fn();
const mockGetPreferences = jest.fn();
const mockSavePreferences = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
}));

jest.mock('@/src/lib/notifications/reminderScheduler', () => ({
  ensureReminderPermissions: (...args: unknown[]) => mockEnsureReminderPermissions(...args),
}));

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({
    repositories: {
      reminderPreferences: {
        getPreferences: (...args: unknown[]) => mockGetPreferences(...args),
        savePreferences: (...args: unknown[]) => mockSavePreferences(...args),
      },
    },
  }),
}));

jest.mock('@/src/features/feedback/InteractionFeedbackProvider', () => ({
  useOptionalInteractionFeedback: () => ({
    triggerPressFeedback: jest.fn(),
  }),
}));

type OnboardingDraftProp = ComponentProps<typeof OnboardingProvider>['initialDraft'];

function renderScreen(initialDraft?: OnboardingDraftProp) {
  return render(
    <OnboardingProvider initialDraft={initialDraft}>
      <NotificationsScreen />
    </OnboardingProvider>,
  );
}

describe('NotificationsScreen', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockBack.mockReset();
    mockEnsureReminderPermissions.mockReset().mockResolvedValue(undefined);
    mockGetPreferences.mockReset().mockResolvedValue([]);
    mockSavePreferences.mockReset().mockResolvedValue(undefined);
  });

  it('places the secondary skip action before the primary allow action', () => {
    // UL-52: every other onboarding step reads secondary-left / primary-right;
    // this footer matches that order instead of leading with the primary.
    renderScreen();

    const rendered = JSON.stringify(screen.toJSON());
    const skipIndex = rendered.indexOf(testIds.onboarding.notifications.skipButton);
    const allowIndex = rendered.indexOf(testIds.onboarding.notifications.allowButton);

    expect(skipIndex).toBeGreaterThan(-1);
    expect(allowIndex).toBeGreaterThan(-1);
    expect(skipIndex).toBeLessThan(allowIndex);
  });

  it('gives both footer actions equal flex so they share the row evenly', () => {
    renderScreen();

    const skipStyle = StyleSheet.flatten(
      screen.getByTestId(testIds.onboarding.notifications.skipButton).props.style,
    );
    const allowStyle = StyleSheet.flatten(
      screen.getByTestId(testIds.onboarding.notifications.allowButton).props.style,
    );

    expect(skipStyle.flex).toBe(1);
    expect(allowStyle.flex).toBe(1);
  });

  it('skips straight to completion without requesting permissions', () => {
    renderScreen();

    fireEvent.press(screen.getByTestId(testIds.onboarding.notifications.skipButton));

    expect(mockEnsureReminderPermissions).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('./completion');
  });

  it('requests permissions, enables preferences, then continues to completion', async () => {
    mockGetPreferences.mockResolvedValue([
      { kind: 'daily', enabled: false },
      { kind: 'period', enabled: false },
    ]);

    renderScreen();

    fireEvent.press(screen.getByTestId(testIds.onboarding.notifications.allowButton));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('./completion');
    });
    expect(mockEnsureReminderPermissions).toHaveBeenCalledTimes(1);
    expect(mockSavePreferences).toHaveBeenCalledWith([
      { kind: 'daily', enabled: true },
      { kind: 'period', enabled: true },
    ]);
  });

  it('continues to completion even when the permission request fails', async () => {
    mockEnsureReminderPermissions.mockRejectedValue(new Error('denied'));

    renderScreen();

    fireEvent.press(screen.getByTestId(testIds.onboarding.notifications.allowButton));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('./completion');
    });
  });

  it('navigates back from the top back pill', () => {
    renderScreen();

    fireEvent.press(screen.getByText('Back'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('expands the progress total when TTC tracking is enabled', () => {
    renderScreen({ ttcEnabled: true });

    expect(screen.getByTestId('screen-progress-track').props.accessibilityValue).toEqual({
      max: 10,
      min: 0,
      now: 8,
    });
  });
});
