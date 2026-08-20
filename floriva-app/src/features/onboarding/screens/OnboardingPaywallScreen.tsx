import { useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Text } from '@/src/components/primitives/Text';
import { ActionButton } from '@/src/components/primitives/ActionButton';
import { Screen } from '@/src/components/primitives/Screen';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import { PaywallPlanSelector } from '@/src/features/billing/components/PaywallPlanSelector';
import { PaywallPrivacyValue } from '@/src/features/billing/components/PaywallPrivacyValue';
import { PaywallTrialTimeline } from '@/src/features/billing/components/PaywallTrialTimeline';
import { florivaRuntimeBillingConfig } from '@/src/features/billing/config';
import { useBilling } from '@/src/features/billing/BillingProvider';
import { isLifetimeTransitionAllowed } from '@/src/features/billing/lifetimeTrial';
import { useOnboarding } from '@/src/features/onboarding/OnboardingProvider';
import { buildFreshOnboardingProgress } from '@/src/features/onboarding/screens/shared';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import { testIds } from '@/src/testing/testIds';
import type { SubscriptionPlanId } from '@/src/types/domain';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

const ONBOARDING_SELECTOR_TEST_IDS = {
  planCardAnnual: testIds.onboarding.paywall.purchaseAnnualButton,
  planCardMonthly: testIds.onboarding.paywall.purchaseMonthlyButton,
  planCardLifetime: testIds.onboarding.paywall.purchaseLifetimeButton,
  bestValueBadge: testIds.onboarding.paywall.bestValueBadge,
  purchaseButton: testIds.onboarding.paywall.purchaseSelectedButton,
  notChargedToday: testIds.onboarding.paywall.notChargedToday,
};

function billingUnlocksAccess(accessState: ReturnType<typeof useBilling>['snapshot']['accessState']) {
  return accessState === 'trial_active' || accessState === 'subscribed';
}

function getBillingStatusMessage(
  accessState: ReturnType<typeof useBilling>['snapshot']['accessState'],
  statusMessage: string | null,
) {
  if (!statusMessage) {
    return null;
  }

  if (!__DEV__ && accessState === 'sync_error') {
    return 'Billing could not refresh. You can try again or restore a purchase.';
  }

  return statusMessage;
}

export function OnboardingPaywallScreen() {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useLocalization();
  const { draft, setHasCompletedAccessStep } = useOnboarding();
  const {
    isHydrated,
    isRefreshing,
    isSyncing,
    lifetimeTrialEligible,
    offerings,
    purchasePlan,
    purchasingPlanId,
    presentRestorePaywall,
    refreshBilling,
    snapshot,
    startLifetimeTrial,
    statusMessage,
  } = useBilling();
  const billingStatusMessage = getBillingStatusMessage(snapshot.accessState, statusMessage);
  const lifetimeTransitionAllowed = isLifetimeTransitionAllowed(snapshot);
  const visibleOfferings = useMemo(
    () =>
      lifetimeTransitionAllowed
        ? offerings
        : offerings.filter((offering) => offering.planId !== 'lifetime'),
    [lifetimeTransitionAllowed, offerings],
  );
  // Annual is pre-selected as the highest-value plan (offerings are sorted
  // annual-first). Falls back to the first available plan when annual is absent.
  const defaultPlanId = useMemo<SubscriptionPlanId | null>(() => {
    if (visibleOfferings.some((offering) => offering.planId === 'annual')) {
      return 'annual';
    }

    return visibleOfferings.length > 0 ? visibleOfferings[0].planId : null;
  }, [visibleOfferings]);
  const [selectedPlanId, setSelectedPlanId] = useState<SubscriptionPlanId | null>(defaultPlanId);
  const resolvedSelectedPlanId = useMemo<SubscriptionPlanId | null>(() => {
    if (
      selectedPlanId &&
      visibleOfferings.some((offering) => offering.planId === selectedPlanId)
    ) {
      return selectedPlanId;
    }

    return defaultPlanId;
  }, [defaultPlanId, selectedPlanId, visibleOfferings]);
  // Only show the free-trial timeline when the plan the user has selected
  // actually offers a trial. Lifetime and trial-less plans must not imply one.
  const selectedPlanHasTrial = visibleOfferings.some(
    (offering) => offering.planId === resolvedSelectedPlanId && offering.hasFreeTrial,
  );

  useEffect(() => {
    if (billingUnlocksAccess(snapshot.accessState) && !draft.hasCompletedAccessStep) {
      setHasCompletedAccessStep(true);
    }
  }, [draft.hasCompletedAccessStep, setHasCompletedAccessStep, snapshot.accessState]);

  useEffect(() => {
    if (billingUnlocksAccess(snapshot.accessState) && draft.hasCompletedAccessStep) {
      router.replace('./completion');
    }
  }, [draft.hasCompletedAccessStep, router, snapshot.accessState]);

  if (!isHydrated) {
    return (
      <Screen
        eyebrow="Floriva access"
        title="Checking your access"
        description="Looking for existing purchases and trial options on this device."
        testID={testIds.onboarding.paywall.screen}
      >
        <Text>Loading…</Text>
      </Screen>
    );
  }

  const heroDescription =
    snapshot.accessState === 'expired'
      ? t('billing.onboarding.expired')
      : t('billing.onboarding.needsPurchase');

  return (
    <Screen
      backAction={{
        label: 'Back',
        onPress: () => router.back(),
      }}
      eyebrow={t('billing.onboarding.eyebrow')}
      layout="hero"
      progress={buildFreshOnboardingProgress(draft, draft.ttcEnabled ? 9 : 8)}
      title={t('billing.onboarding.title')}
      description={heroDescription}
      testID={testIds.onboarding.paywall.screen}
    >
      {billingStatusMessage ? (
        <SectionCard
          title="Billing update"
          description={billingStatusMessage}
          presentation="unframed"
        />
      ) : null}

      <View style={styles.restoreInlineRow}>
        <Text style={styles.restoreInlinePrompt}>{'Already purchased?'}</Text>
        <Text
          accessibilityRole="button"
          accessibilityLabel="Restore purchases"
          accessibilityState={{ disabled: isSyncing }}
          onPress={() => {
            if (isSyncing) return;
            void presentRestorePaywall();
          }}
          style={[styles.restoreInlineLink, isSyncing ? styles.restoreInlineLinkDisabled : null]}
          testID={testIds.onboarding.paywall.restoreInlineLink}
        >
          {'Restore'}
        </Text>
      </View>

      <PaywallPrivacyValue testID={testIds.onboarding.paywall.privacyValue} />

      <PaywallPlanSelector
        offerings={visibleOfferings}
        selectedPlanId={resolvedSelectedPlanId}
        onSelect={setSelectedPlanId}
        onPurchase={(planId) => void purchasePlan(planId)}
        lifetimeTrialEligible={lifetimeTrialEligible}
        onStartLifetimeTrial={() => void startLifetimeTrial()}
        purchasingPlanId={purchasingPlanId}
        actionsDisabled={isSyncing}
        testIds={ONBOARDING_SELECTOR_TEST_IDS}
      />

      {selectedPlanHasTrial ? (
        <PaywallTrialTimeline testID={testIds.onboarding.paywall.trialTimeline} />
      ) : null}

      <SectionCard
        title={t('billing.legal.title')}
        description={t('billing.legal.description')}
        presentation="unframed"
      >
        <View style={styles.legalActions}>
          <ActionButton
            appearance="secondary"
            onPress={() => {
              void Linking.openURL(florivaRuntimeBillingConfig.privacyPolicyUrl);
            }}
            testID={testIds.onboarding.paywall.privacyPolicyButton}
          >
            {t('billing.legal.privacyPolicy')}
          </ActionButton>
          <ActionButton
            appearance="secondary"
            onPress={() => {
              void Linking.openURL(florivaRuntimeBillingConfig.termsOfUseUrl);
            }}
            testID={testIds.onboarding.paywall.termsOfUseButton}
          >
            {t('billing.legal.termsOfUse')}
          </ActionButton>
        </View>
      </SectionCard>

      <View style={styles.footerActions}>
        <ActionButton
          appearance="secondary"
          disabled={isSyncing}
          onPress={() => {
            void presentRestorePaywall();
          }}
          testID={testIds.onboarding.paywall.restoreButton}
        >
          {isSyncing ? 'Working…' : 'Restore purchases'}
        </ActionButton>
        <ActionButton
          appearance="secondary"
          disabled={isSyncing}
          onPress={() => {
            void refreshBilling();
          }}
          testID={testIds.onboarding.paywall.refreshButton}
        >
          {isRefreshing
            ? 'Working…'
            : snapshot.accessState === 'sync_error'
              ? 'Try again'
              : 'Refresh billing'}
        </ActionButton>
      </View>
    </Screen>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    footerActions: {
      gap: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
    },
    legalActions: {
      gap: theme.spacing.sm,
    },
    restoreInlineRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: theme.spacing.xs,
    },
    restoreInlinePrompt: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    restoreInlineLink: {
      ...theme.typography.caption,
      color: theme.colors.accentPrimary,
      textDecorationLine: 'underline',
    },
    restoreInlineLinkDisabled: {
      color: theme.colors.textMuted,
      textDecorationLine: 'none',
    },
  });
}
