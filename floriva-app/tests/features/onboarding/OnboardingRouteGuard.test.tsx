import { render, waitFor } from '@testing-library/react-native';

import { OnboardingProvider } from '@/src/features/onboarding/OnboardingProvider';
import { OnboardingRouteGuard } from '@/src/features/onboarding/OnboardingRouteGuard';

const mockReplace = jest.fn();
let mockPathname = '/period-length';

jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    replace: (...args: unknown[]) => mockReplace(...args),
  }),
}));

describe('OnboardingRouteGuard', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockPathname = '/period-length';
  });

  it('redirects users into the start-path screen before any other decision', async () => {
    render(
      <OnboardingProvider>
        <OnboardingRouteGuard />
      </OnboardingProvider>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/start-path');
    });
  });

  it('redirects fresh-start users to the next redesigned setup step before billing', async () => {
    render(
      <OnboardingProvider
        initialDraft={{
          startPath: 'fresh',
          lastPeriodStartDate: '2026-04-01',
          hasConfirmedCycleLength: false,
        }}
      >
        <OnboardingRouteGuard />
      </OnboardingProvider>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/cycle-length');
    });
  });

  it('skips the TTC preset route when TTC is turned off', async () => {
    mockPathname = '/ttc-preset';

    render(
      <OnboardingProvider
        initialDraft={{
          startPath: 'fresh',
          lastPeriodStartDate: '2026-04-01',
          cycleLengthInput: '29',
          hasConfirmedCycleLength: true,
          periodLengthInput: '5',
          hasConfirmedPeriodLength: true,
          supportsIrregularCycles: false,
          symptomLoggingEnabled: true,
          ttcEnabled: false,
        }}
      >
        <OnboardingRouteGuard />
      </OnboardingProvider>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/completion');
    });
  });

  it('stays put when the import path is already on an allowed route', async () => {
    mockPathname = '/import';

    render(
      <OnboardingProvider
        initialDraft={{
          startPath: 'import',
        }}
      >
        <OnboardingRouteGuard />
      </OnboardingProvider>,
    );

    await waitFor(() => {
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  it('leaves an import-path user on completion (paywall step retired)', async () => {
    mockPathname = '/completion';

    render(
      <OnboardingProvider
        initialDraft={{
          startPath: 'import',
        }}
      >
        <OnboardingRouteGuard />
      </OnboardingProvider>,
    );

    await waitFor(() => {
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  // Retirement safety net. No screen navigates to /paywall or /billing-options
  // any more, but the route files still exist so old deep links resolve. If
  // anything ever lands a user there, the guard must move them on: the paywall
  // renders plan pricing, and no Floriva product is purchasable.
  it.each([
    ['/paywall', 'fresh' as const],
    ['/billing-options', 'fresh' as const],
    ['/paywall', 'import' as const],
    ['/billing-options', 'import' as const],
    ['/paywall', 'restore' as const],
    ['/billing-options', 'restore' as const],
  ])('moves a user off %s (%s path) instead of leaving them on pricing', async (
    pathname,
    startPath,
  ) => {
    mockPathname = pathname;

    render(
      <OnboardingProvider
        initialDraft={{
          startPath,
          lastPeriodStartDate: '2026-04-01',
          cycleLengthInput: '29',
          hasConfirmedCycleLength: true,
          periodLengthInput: '5',
          hasConfirmedPeriodLength: true,
        }}
      >
        <OnboardingRouteGuard />
      </OnboardingProvider>,
    );

    // The destination varies with how far the draft has progressed. What must
    // never vary: the user is moved, and never onto a billing surface.
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalled();
    });
    for (const call of mockReplace.mock.calls) {
      expect(call[0]).not.toBe('/paywall');
      expect(call[0]).not.toBe('/billing-options');
    }
  });

  it('redirects stale condensed onboarding routes back into the start path before any decision', async () => {
    mockPathname = '/goals';

    render(
      <OnboardingProvider>
        <OnboardingRouteGuard />
      </OnboardingProvider>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/start-path');
    });
  });

  it('redirects stale condensed onboarding routes to completion once the fresh path is ready', async () => {
    mockPathname = '/setup-later';

    render(
      <OnboardingProvider
        initialDraft={{
          startPath: 'fresh',
          lastPeriodStartDate: '2026-04-01',
          hasConfirmedCycleLength: true,
          hasConfirmedPeriodLength: true,
          supportsIrregularCycles: false,
          symptomLoggingEnabled: false,
          ttcEnabled: false,
        }}
      >
        <OnboardingRouteGuard />
      </OnboardingProvider>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/completion');
    });
  });
});
