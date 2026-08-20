import {
  clearPersistedPostOnboardingRoute,
  loadPersistedPostOnboardingRoute,
  persistPostOnboardingRoute,
} from '@/src/features/app-shell/postOnboardingRouteStorage';

const mockGetItemAsync = jest.fn();
const mockSetItemAsync = jest.fn();
const mockDeleteItemAsync = jest.fn();

jest.mock('expo-secure-store', () => ({
  getItemAsync: (...args: unknown[]) => mockGetItemAsync(...args),
  setItemAsync: (...args: unknown[]) => mockSetItemAsync(...args),
  deleteItemAsync: (...args: unknown[]) => mockDeleteItemAsync(...args),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
}));

describe('postOnboardingRouteStorage', () => {
  beforeEach(() => {
    mockGetItemAsync.mockReset();
    mockSetItemAsync.mockReset();
    mockDeleteItemAsync.mockReset();
  });

  it('returns the persisted route when it is one of the supported handoffs', async () => {
    mockGetItemAsync.mockResolvedValue('/backup/restore');

    await expect(loadPersistedPostOnboardingRoute()).resolves.toBe('/backup/restore');
  });

  it('returns null when the persisted route is not recognized', async () => {
    mockGetItemAsync.mockResolvedValue('/settings');

    await expect(loadPersistedPostOnboardingRoute()).resolves.toBeNull();
  });

  it('returns null when secure store rejects during route hydration', async () => {
    mockGetItemAsync.mockRejectedValueOnce(new Error('storage offline'));

    await expect(loadPersistedPostOnboardingRoute()).resolves.toBeNull();
  });

  it('persists routes using device-only keychain accessibility', async () => {
    await persistPostOnboardingRoute('/today');

    expect(mockSetItemAsync).toHaveBeenCalledWith(
      'floriva.post-onboarding-route.v1',
      '/today',
      {
        keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
      },
    );
  });

  it('swallows secure-store write failures when persisting the route', async () => {
    mockSetItemAsync.mockRejectedValueOnce(new Error('storage offline'));

    await expect(persistPostOnboardingRoute('/today')).resolves.toBeUndefined();
  });

  it('swallows secure-store delete failures when clearing the route', async () => {
    mockDeleteItemAsync.mockRejectedValueOnce(new Error('storage offline'));

    await expect(clearPersistedPostOnboardingRoute()).resolves.toBeUndefined();
  });
});
