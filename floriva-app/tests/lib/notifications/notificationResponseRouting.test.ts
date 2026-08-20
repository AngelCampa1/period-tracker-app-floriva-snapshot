import {
  resolveNotificationRoute,
  type NotificationResponseLike,
} from '@/src/lib/notifications/notificationResponseRouting';

function buildResponse(
  identifier: string | undefined,
  overrides: Partial<NotificationResponseLike> = {},
): NotificationResponseLike {
  return {
    notification: {
      request: {
        identifier: identifier as string,
        content: { data: null },
      },
    },
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    ...overrides,
  };
}

describe('resolveNotificationRoute', () => {
  const todayIso = '2026-07-06';

  it('routes reminder-daily-log taps to the calendar day route for today', () => {
    const response = buildResponse('reminder-daily-log');

    expect(resolveNotificationRoute(response, todayIso)).toBe('/calendar/day/2026-07-06');
  });

  it('routes reminder-period-start taps to the calendar day route for today', () => {
    const response = buildResponse('reminder-period-start');

    expect(resolveNotificationRoute(response, todayIso)).toBe('/calendar/day/2026-07-06');
  });

  it('routes reminder-fertile-window taps to /today (not a log-today intent)', () => {
    const response = buildResponse('reminder-fertile-window');

    expect(resolveNotificationRoute(response, todayIso)).toBe('/today');
  });

  it('routes reminder-birth-control taps to /today', () => {
    const response = buildResponse('reminder-birth-control');

    expect(resolveNotificationRoute(response, todayIso)).toBe('/today');
  });

  it('routes reminder-first-charge (billing) taps to /today', () => {
    const response = buildResponse('reminder-first-charge');

    expect(resolveNotificationRoute(response, todayIso)).toBe('/today');
  });

  it('routes unknown-but-well-formed identifiers to /today rather than treating them as malformed', () => {
    const response = buildResponse('some-future-notification-kind');

    expect(resolveNotificationRoute(response, todayIso)).toBe('/today');
  });

  it('returns null when the identifier is missing', () => {
    const response = buildResponse(undefined);

    expect(resolveNotificationRoute(response, todayIso)).toBeNull();
  });

  it('returns null when the identifier is an empty string', () => {
    const response = buildResponse('');

    expect(resolveNotificationRoute(response, todayIso)).toBeNull();
  });

  it('returns null when the identifier is not a string', () => {
    const response = {
      notification: {
        request: {
          // Simulates a malformed/native payload that bypassed the type layer.
          identifier: 42 as unknown as string,
        },
      },
    } as NotificationResponseLike;

    expect(resolveNotificationRoute(response, todayIso)).toBeNull();
  });

  it('returns null when the response itself is null (cold-start no-op case)', () => {
    expect(resolveNotificationRoute(null, todayIso)).toBeNull();
  });

  it('returns null when the response itself is undefined', () => {
    expect(resolveNotificationRoute(undefined, todayIso)).toBeNull();
  });

  it('returns null when todayIso is an empty string, avoiding a broken /calendar/day/ href', () => {
    const response = buildResponse('reminder-daily-log');

    expect(resolveNotificationRoute(response, '')).toBeNull();
  });

  it('produces different hrefs for different injected todayIso values (proves purity, no hidden Date.now())', () => {
    const response = buildResponse('reminder-period-start');

    expect(resolveNotificationRoute(response, '2026-01-01')).toBe('/calendar/day/2026-01-01');
    expect(resolveNotificationRoute(response, '2026-12-31')).toBe('/calendar/day/2026-12-31');
  });

  it('routes identically for the default plain-tap identifier and an unrecognized action identifier', () => {
    const defaultTap = buildResponse('reminder-daily-log', {
      actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    });
    const customActionTap = buildResponse('reminder-daily-log', {
      actionIdentifier: 'some-custom-action',
    });

    expect(resolveNotificationRoute(defaultTap, todayIso)).toBe(
      resolveNotificationRoute(customActionTap, todayIso),
    );
  });

  it('routes identically for the default plain-tap identifier and the "open" quick action', () => {
    const defaultTap = buildResponse('reminder-daily-log', {
      actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    });
    const openActionTap = buildResponse('reminder-daily-log', {
      actionIdentifier: 'open',
    });

    expect(resolveNotificationRoute(defaultTap, todayIso)).toBe(
      resolveNotificationRoute(openActionTap, todayIso),
    );
  });

  describe('quick-log-period action identifier', () => {
    it('appends ?quick=period to the calendar-day route for a reminder-daily-log tap', () => {
      const response = buildResponse('reminder-daily-log', {
        actionIdentifier: 'quick-log-period',
      });

      expect(resolveNotificationRoute(response, todayIso)).toBe(
        '/calendar/day/2026-07-06?quick=period',
      );
    });

    it('appends ?quick=period to the calendar-day route for a reminder-period-start tap', () => {
      const response = buildResponse('reminder-period-start', {
        actionIdentifier: 'quick-log-period',
      });

      expect(resolveNotificationRoute(response, todayIso)).toBe(
        '/calendar/day/2026-07-06?quick=period',
      );
    });

    it('is ignored on non-calendar-day identifiers and still routes to /today', () => {
      // The quick-log-period action is only ever registered on the
      // calendar-day intent identifiers (see buildReminderPlans.ts /
      // QUICK_LOG_CATEGORY_KINDS) — an action identifier collision on some
      // other identifier should not fabricate a calendar-day route.
      const response = buildResponse('reminder-fertile-window', {
        actionIdentifier: 'quick-log-period',
      });

      expect(resolveNotificationRoute(response, todayIso)).toBe('/today');
    });

    it('uses the injected todayIso, proving purity for the quick-log branch too', () => {
      const response = buildResponse('reminder-daily-log', {
        actionIdentifier: 'quick-log-period',
      });

      expect(resolveNotificationRoute(response, '2026-01-01')).toBe(
        '/calendar/day/2026-01-01?quick=period',
      );
    });
  });

  it('does not treat presence/absence of content.data as significant today (identifier is the dispatch key)', () => {
    const withData = buildResponse('reminder-daily-log', {
      notification: {
        request: {
          identifier: 'reminder-daily-log',
          content: { data: { kind: 'daily-log' } },
        },
      },
    });
    const withoutData = buildResponse('reminder-daily-log', {
      notification: {
        request: {
          identifier: 'reminder-daily-log',
          content: null,
        },
      },
    });

    expect(resolveNotificationRoute(withData, todayIso)).toBe('/calendar/day/2026-07-06');
    expect(resolveNotificationRoute(withoutData, todayIso)).toBe('/calendar/day/2026-07-06');
  });
});
