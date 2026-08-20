import {
  notifyThemePreferenceChanged,
  subscribeToThemePreferenceChanges,
} from '@/src/theme/themePreferenceSync';

describe('themePreferenceSync', () => {
  it('notifies every subscribed listener', () => {
    const first = jest.fn();
    const second = jest.fn();
    const unsubscribeFirst = subscribeToThemePreferenceChanges(first);
    const unsubscribeSecond = subscribeToThemePreferenceChanges(second);

    try {
      notifyThemePreferenceChanged();

      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribeFirst();
      unsubscribeSecond();
    }
  });

  it('stops notifying a listener after it unsubscribes', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToThemePreferenceChanges(listener);

    unsubscribe();
    notifyThemePreferenceChanged();

    expect(listener).not.toHaveBeenCalled();
  });

  it('is a safe no-op when no listeners are registered', () => {
    expect(() => notifyThemePreferenceChanged()).not.toThrow();
  });
});
