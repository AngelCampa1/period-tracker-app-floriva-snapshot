import { type ReactElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import WelcomeRoute from '../../app/(onboarding)/welcome';
import StartPathRoute from '../../app/(onboarding)/start-path';
import LastPeriodStartRoute from '../../app/(onboarding)/last-period-start';
import CycleLengthRoute from '../../app/(onboarding)/cycle-length';
import PeriodLengthRoute from '../../app/(onboarding)/period-length';
import CycleVariabilityRoute from '../../app/(onboarding)/cycle-variability';
import SymptomLoggingRoute from '../../app/(onboarding)/symptom-logging';
import TtcRoute from '../../app/(onboarding)/ttc';
import TtcPresetRoute from '../../app/(onboarding)/ttc-preset';
import PaywallRoute from '../../app/(onboarding)/paywall';
import CompletionRoute from '../../app/(onboarding)/completion';
import ImportRoute from '../../app/(onboarding)/import';
import { BillingProvider } from '../../src/features/billing/BillingProvider';
import { OnboardingProvider } from '../../src/features/onboarding/OnboardingProvider';
import { ImportFlowProvider } from '../../src/features/import/ImportFlowProvider';
import { testIds } from '../../src/testing/testIds';

const mockCompleteOnboarding = jest.fn();
const mockClearPendingEntryRoute = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
  }),
}));

jest.mock('@/src/localization/localizationContext', () =>
  require('@/tests/helpers/localization'),
);

jest.mock('@/src/localization/LocalizationProvider', () =>
  require('@/tests/helpers/localization'),
);

jest.mock('../../src/features/app-shell/AppShellProvider', () => ({
  useAppShell: () => ({
    completeOnboarding: (...args: unknown[]) => mockCompleteOnboarding(...args),
    clearPendingEntryRoute: (...args: unknown[]) => mockClearPendingEntryRoute(...args),
    privacyPreference: {
      biometricsEnabled: false,
      relockAfterSeconds: 60,
      destructiveActionConfirmationRequired: true,
      diagnosticsConsentEnabled: false,
    },
    state: {
      pendingEntryRoute: undefined,
    },
  }),
}));

jest.mock('../../src/db/DatabaseProvider', () => ({
  useDatabase: () => ({
    repositories: {
      dailyLogs: {
        listByDates: jest.fn().mockResolvedValue([]),
        saveEntry: jest.fn(),
      },
      importSessions: {
        saveSession: jest.fn(),
      },
    },
  }),
}));

jest.mock('../../src/features/billing/BillingProvider', () => ({
  BillingProvider: ({ children }: { children: ReactElement }) => children,
  useBilling: () => ({
    isHydrated: true,
    isSyncing: false,
    snapshot: {
      accessState: 'sync_error',
    },
    statusMessage: 'Billing is not configured for this build yet.',
    managementUrl: 'https://apps.apple.com/account/subscriptions',
    offerings: [],
    purchasePlan: jest.fn(),
    presentRestorePaywall: jest.fn(),
    openManageSubscriptions: jest.fn(),
    refreshBilling: jest.fn(),
  }),
}));

function renderOnboardingRoute(ui: ReactElement) {
  return render(<OnboardingProvider>{ui}</OnboardingProvider>);
}

function renderBillingOnboardingRoute(ui: ReactElement) {
  return render(
    <BillingProvider>
      <OnboardingProvider>{ui}</OnboardingProvider>
    </BillingProvider>,
  );
}

describe('onboarding routes', () => {
  beforeEach(() => {
    mockCompleteOnboarding.mockReset();
    mockPush.mockReset();
    mockBack.mockReset();
    mockReplace.mockReset();
  });

  it('renders the privacy-first welcome route', () => {
    render(<WelcomeRoute />);

    expect(screen.getByTestId(testIds.onboarding.welcome.screen)).toBeTruthy();
    expect(screen.getByText('tracker')).toBeTruthy();
    expect(screen.getByText('Continue')).toBeTruthy();
  });

  it('renders the start-path route inside onboarding state', () => {
    renderOnboardingRoute(<StartPathRoute />);

    expect(screen.getByTestId(testIds.onboarding.startPath.screen)).toBeTruthy();
    expect(screen.getByText('Choose the easiest way to start.')).toBeTruthy();
    expect(screen.getByTestId('screen-progress-fill')).toBeTruthy();
    expect(screen.queryByText(/Step \d+ of \d+/)).toBeNull();
  });

  it('renders the last-period-start route inside onboarding state', () => {
    renderOnboardingRoute(<LastPeriodStartRoute />);

    expect(screen.getByTestId(testIds.onboarding.lastPeriodStart.screen)).toBeTruthy();
    expect(screen.getByText('When did your last period start?')).toBeTruthy();
  });

  it('renders the cycle-length route inside onboarding state', () => {
    renderOnboardingRoute(<CycleLengthRoute />);

    expect(screen.getByTestId(testIds.onboarding.cycleLength.screen)).toBeTruthy();
    expect(screen.getByText('What is your usual cycle length?')).toBeTruthy();
  });

  it('renders the period-length route inside onboarding state', () => {
    renderOnboardingRoute(<PeriodLengthRoute />);

    expect(screen.getByTestId(testIds.onboarding.periodLength.screen)).toBeTruthy();
    expect(screen.getByText('How long does your period usually last?')).toBeTruthy();
  });

  it('renders the cycle-variability route inside onboarding state', () => {
    renderOnboardingRoute(<CycleVariabilityRoute />);

    expect(screen.getByTestId(testIds.onboarding.cycleVariability.screen)).toBeTruthy();
    expect(screen.getByText('Does your cycle timing usually stay steady?')).toBeTruthy();
  });

  it('renders the symptom-logging route inside onboarding state', () => {
    renderOnboardingRoute(<SymptomLoggingRoute />);

    expect(screen.getByTestId(testIds.onboarding.symptomLogging.screen)).toBeTruthy();
    expect(
      screen.getByText('Do you want symptom and mood logging ready from day one?'),
    ).toBeTruthy();
  });

  it('renders the TTC route inside onboarding state', () => {
    renderOnboardingRoute(<TtcRoute />);

    expect(screen.getByTestId(testIds.onboarding.ttc.screen)).toBeTruthy();
    expect(screen.getByText('Do you want trying-to-conceive tracking turned on?')).toBeTruthy();
  });

  it('renders the TTC preset route inside onboarding state', () => {
    renderOnboardingRoute(<TtcPresetRoute />);

    expect(screen.getByTestId(testIds.onboarding.ttcPreset.screen)).toBeTruthy();
    expect(screen.getByText('How much trying-to-conceive detail do you want ready?')).toBeTruthy();
  });

  it('renders the onboarding paywall route inside billing and onboarding state', async () => {
    renderBillingOnboardingRoute(<PaywallRoute />);

    expect(await screen.findByTestId(testIds.onboarding.paywall.screen)).toBeTruthy();
    expect(screen.getByText('Start your free trial.')).toBeTruthy();
    expect(screen.getByTestId(testIds.onboarding.paywall.restoreButton)).toBeTruthy();
    expect(
      screen.queryByTestId(testIds.onboarding.paywall.continueWithoutTrialButton),
    ).toBeNull();
    expect(screen.queryByTestId(testIds.onboarding.paywall.continuePreviewButton)).toBeNull();
  });

  it('renders the completion route inside onboarding state', () => {
    renderOnboardingRoute(<CompletionRoute />);

    expect(screen.getByTestId(testIds.onboarding.completion.screen)).toBeTruthy();
    expect(screen.getByText('ready.')).toBeTruthy();
  });

  it('renders the onboarding import route inside onboarding state', () => {
    renderOnboardingRoute(
      <ImportFlowProvider>
        <ImportRoute />
      </ImportFlowProvider>,
    );

    expect(screen.getByTestId(testIds.import.screen)).toBeTruthy();
    expect(screen.getAllByText(/Bring your history /).length).toBeGreaterThan(0);
    expect(screen.getByText('Back to path choice')).toBeTruthy();
    expect(screen.getByText('Skip import for now')).toBeTruthy();
  });

  it('routes skipped onboarding imports back into a valid onboarding path', () => {
    renderOnboardingRoute(
      <ImportFlowProvider>
        <ImportRoute />
      </ImportFlowProvider>,
    );

    fireEvent.press(screen.getByText('Skip import for now'));

    expect(mockReplace).toHaveBeenCalledWith('/last-period-start');
  });
});
