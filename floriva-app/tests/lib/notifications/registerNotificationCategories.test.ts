const mockSetNotificationCategoryAsync = jest.fn();

jest.mock('expo-notifications', () => ({
  setNotificationCategoryAsync: (...args: unknown[]) =>
    mockSetNotificationCategoryAsync(...args),
}));

// eslint-disable-next-line import/first
import {
  __resetNotificationCategoryRegistrationForTests,
  registerNotificationCategories,
} from '@/src/lib/notifications/registerNotificationCategories';
// eslint-disable-next-line import/first
import { FLORIVA_LOG_NOTIFICATION_CATEGORY } from '@/src/lib/notifications/buildReminderPlans';
// eslint-disable-next-line import/first
import { QUICK_LOG_PERIOD_ACTION_IDENTIFIER } from '@/src/lib/notifications/notificationResponseRouting';
// eslint-disable-next-line import/first
import { supportedLocales } from '@/src/localization/config';
// eslint-disable-next-line import/first
import { translate } from '@/src/localization/translations';
// eslint-disable-next-line import/first
import type { SupportedLocale } from '@/src/types/domain';

describe('registerNotificationCategories', () => {
  beforeEach(() => {
    mockSetNotificationCategoryAsync.mockReset();
    mockSetNotificationCategoryAsync.mockResolvedValue(undefined);
    __resetNotificationCategoryRegistrationForTests();
  });

  it('registers the florivaLog category identifier with no hyphens or colons', () => {
    // Expo's setNotificationCategoryAsync docs warn that ":" or "-" in the
    // category identifier "might not work as expected" on at least one
    // platform, unlike notification *request* identifiers elsewhere in this
    // codebase (which do use hyphens, e.g. reminder-daily-log).
    expect(FLORIVA_LOG_NOTIFICATION_CATEGORY).not.toMatch(/[-:]/);
  });

  it('registers "Quick log" and "Open" actions with English titles by default', async () => {
    await registerNotificationCategories();

    expect(mockSetNotificationCategoryAsync).toHaveBeenCalledWith(
      FLORIVA_LOG_NOTIFICATION_CATEGORY,
      [
        {
          identifier: QUICK_LOG_PERIOD_ACTION_IDENTIFIER,
          buttonTitle: 'Quick log',
        },
        {
          identifier: 'open',
          buttonTitle: 'Open',
        },
      ],
    );
  });

  it.each(supportedLocales)('localizes quick-action titles for %s', async (locale) => {
    await registerNotificationCategories(locale);

    expect(mockSetNotificationCategoryAsync).toHaveBeenCalledWith(
      FLORIVA_LOG_NOTIFICATION_CATEGORY,
      [
        {
          identifier: QUICK_LOG_PERIOD_ACTION_IDENTIFIER,
          buttonTitle: translate(locale, 'notifications.quickActions.quickLog'),
        },
        {
          identifier: 'open',
          buttonTitle: translate(locale, 'notifications.quickActions.open'),
        },
      ],
    );
  });

  it('is a no-op on a second call with the same locale (idempotent registration)', async () => {
    await registerNotificationCategories('en');
    await registerNotificationCategories('en');

    expect(mockSetNotificationCategoryAsync).toHaveBeenCalledTimes(1);
  });

  it('re-registers when the locale actually changes', async () => {
    await registerNotificationCategories('en');
    await registerNotificationCategories('es' as SupportedLocale);

    expect(mockSetNotificationCategoryAsync).toHaveBeenCalledTimes(2);
    expect(mockSetNotificationCategoryAsync).toHaveBeenLastCalledWith(
      FLORIVA_LOG_NOTIFICATION_CATEGORY,
      expect.arrayContaining([
        expect.objectContaining({
          buttonTitle: translate('es', 'notifications.quickActions.quickLog'),
        }),
      ]),
    );
  });

  it('swallows errors from setNotificationCategoryAsync (fire-and-forget)', async () => {
    mockSetNotificationCategoryAsync.mockRejectedValueOnce(new Error('unsupported platform'));

    await expect(registerNotificationCategories('en')).resolves.toBeUndefined();
  });

  it('does not mark registration as complete when the underlying call fails', async () => {
    mockSetNotificationCategoryAsync.mockRejectedValueOnce(new Error('unsupported platform'));

    await registerNotificationCategories('en');
    await registerNotificationCategories('en');

    // The failed first call didn't set lastRegisteredLocale, so the second
    // call retries instead of treating 'en' as already registered.
    expect(mockSetNotificationCategoryAsync).toHaveBeenCalledTimes(2);
  });
});
