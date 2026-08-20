import { useEffect, useMemo, useRef, useState } from 'react';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { ActionButton } from '@/src/components/primitives/ActionButton';
import { Screen } from '@/src/components/primitives/Screen';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import { useAppShell } from '@/src/features/app-shell/AppShellProvider';
import { resolveAppEntry } from '@/src/features/app-shell/resolveAppEntry';
import { resolvePaidAccessGate } from '@/src/features/app-shell/resolvePaidAccessGate';
import { useBilling } from '@/src/features/billing/BillingProvider';
import { PaywallPlanSelector } from '@/src/features/billing/components/PaywallPlanSelector';
import { PaywallPrivacyValue } from '@/src/features/billing/components/PaywallPrivacyValue';
import { PaywallTrialTimeline } from '@/src/features/billing/components/PaywallTrialTimeline';
import { florivaRuntimeBillingConfig } from '@/src/features/billing/config';
import { isLifetimeTransitionAllowed } from '@/src/features/billing/lifetimeTrial';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import { testIds } from '@/src/testing/testIds';
import type { SubscriptionPlanId } from '@/src/types/domain';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

const SUBSCRIBE_SELECTOR_TEST_IDS = {
  planCardAnnual: testIds.billing.planCardAnnual,
  planCardMonthly: testIds.billing.planCardMonthly,
  planCardLifetime: testIds.billing.planCardLifetime,
  bestValueBadge: testIds.billing.bestValueBadge,
  purchaseButton: testIds.billing.purchaseSelectedButton,
  notChargedToday: testIds.billing.notChargedToday,
};

function resolveReturnHref(returnTo: string | string[] | undefined): Href | null {
  const normalizedReturnTo = Array.isArray(returnTo) ? returnTo[0] : returnTo;

  if (normalizedReturnTo === 'settings') {
    return '/settings';
  }

  if (normalizedReturnTo === 'paywall') {
    return '/paywall';
  }

  return null;
}

function resolveLockedDescriptionKey(
  accessState: ReturnType<typeof useBilling>['snapshot']['accessState'],
) {
  // SubscribeScreen is the full-lock paywall surface for a `needs_purchase`/
  // `expired` user (see resolvePaidAccessGate.ts) -- but it is ALSO reachable
  // voluntarily from Settings' "Manage subscription" button regardless of
  // access state (SettingsScreen.tsx's subscriptionOpenPaywallButton has no
  // access-state gate). A `trial_active` visitor arriving that way used to
  // fall through to the generic `lockedNeedsPurchaseDescription` ("Pick a
  // plan to unlock Floriva. Start with a free trial.") -- copy that ignores
  // the free trial they are already in the middle of (LT-28). Handle all
  // three states this screen can actually see explicitly instead of
  // defaulting a not-yet-covered state into the "no access yet" framing.
  if (accessState === 'expired') {
    return 'billing.screen.lockedExpiredDescription';
  }

  if (accessState === 'trial_active') {
    return 'billing.screen.lockedTrialActiveDescription';
  }

  return 'billing.screen.lockedNeedsPurchaseDescription';
}

export function SubscribeScreen() {
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useLocalization();
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const { state } = useAppShell();
  // Source of truth for the gate. A locked user has no escape from the paywall;
  // a non-locked user (e.g. sync_error) must always be able to leave.
  const locked = resolvePaidAccessGate(state);
  const returnHref = resolveReturnHref(returnTo);
  const canGoBack = (() => {
    try {
      return router.canGoBack();
    } catch {
      return false;
    }
  })();
  const backAction =
    !locked && (canGoBack || returnHref)
      ? {
          label: t('settings.subscription.screen.backLabel'),
          testID: testIds.billing.backButton,
          onPress: () => {
            if (canGoBack) {
              router.back();
              return;
            }

            if (returnHref) {
              router.replace(returnHref);
            }
          },
        }
      : undefined;
  // A user who was force-locked onto this paywall (no back/return affordance)
  // has no way back into the app once a purchase grants access. Detect the
  // locked -> unlocked transition and route them to the resolved app entry.
  // Voluntary visitors (settings/manage, sync_error) keep their own back path
  // and never start locked, so this never hijacks their navigation.
  const isForceLocked = locked && !backAction;
  const wasForceLockedRef = useRef(isForceLocked);
  useEffect(() => {
    const wasForceLocked = wasForceLockedRef.current;
    wasForceLockedRef.current = isForceLocked;

    if (wasForceLocked && !locked) {
      router.replace(resolveAppEntry(state));
    }
  }, [isForceLocked, locked, router, state]);
  const {
    isHydrated,
    isRefreshing,
    isRestoring,
    offerings,
    lifetimeTrialEligible,
    purchasePlan,
    startLifetimeTrial,
    purchasingPlanId,
    presentRestorePaywall,
    openManageSubscriptions,
    refreshBilling,
    snapshot,
    statusMessage,
  } = useBilling();
  const isPurchasing = purchasingPlanId != null;
  const purchaseActionsDisabled = isRefreshing || isRestoring || isPurchasing;
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
  // actually offers a trial - lifetime and trial-less plans must not imply one.
  const selectedPlanHasTrial = visibleOfferings.some(
    (offering) => offering.planId === resolvedSelectedPlanId && offering.hasFreeTrial,
  );

  if (!isHydrated) {
    return (
      <Screen
        backAction={backAction}
        eyebrow={t('billing.screen.eyebrow')}
        title={t('billing.screen.title')}
        description={t('billing.screen.loading')}
        testID={testIds.billing.screen}
      >
        <Text testID={testIds.billing.loadingState}>{t('billing.screen.loading')}</Text>
      </Screen>
    );
  }

  return (
    <Screen
      backAction={backAction}
      eyebrow={t('billing.screen.eyebrow')}
      title={t('billing.screen.title')}
      description={t(resolveLockedDescriptionKey(snapshot.accessState))}
      testID={testIds.billing.screen}
    >
      {statusMessage ? <Text testID={testIds.billing.statusMessage}>{statusMessage}</Text> : null}

      <PaywallPrivacyValue testID={testIds.billing.privacyValue} />

      <PaywallPlanSelector
        offerings={visibleOfferings}
        selectedPlanId={resolvedSelectedPlanId}
        onSelect={setSelectedPlanId}
        onPurchase={(planId) => void purchasePlan(planId)}
        lifetimeTrialEligible={lifetimeTrialEligible}
        onStartLifetimeTrial={() => void startLifetimeTrial()}
        purchasingPlanId={purchasingPlanId}
        actionsDisabled={purchaseActionsDisabled}
        testIds={SUBSCRIBE_SELECTOR_TEST_IDS}
      />

      {selectedPlanHasTrial ? (
        <PaywallTrialTimeline testID={testIds.billing.trialTimeline} />
      ) : null}

      <SectionCard
        title={t('billing.legal.title')}
        description={t('billing.legal.description')}
        presentation="unframed"
      >
        <View style={styles.actions}>
          <ActionButton
            appearance="secondary"
            onPress={() => {
              void Linking.openURL(florivaRuntimeBillingConfig.privacyPolicyUrl);
            }}
            testID={testIds.billing.privacyPolicyButton}
          >
            {t('billing.legal.privacyPolicy')}
          </ActionButton>
          <ActionButton
            appearance="secondary"
            onPress={() => {
              void Linking.openURL(florivaRuntimeBillingConfig.termsOfUseUrl);
            }}
            testID={testIds.billing.termsOfUseButton}
          >
            {t('billing.legal.termsOfUse')}
          </ActionButton>
        </View>
      </SectionCard>

      <SectionCard
        title={t('billing.support.title')}
        description={t('billing.support.description')}
        presentation="unframed"
      >
        <View style={styles.actions}>
          <ActionButton
            appearance="secondary"
            disabled={isRefreshing || isRestoring || isPurchasing}
            onPress={() => {
              void presentRestorePaywall();
            }}
            testID={testIds.billing.restoreButton}
          >
            {t('billing.buttons.restore')}
          </ActionButton>
          <ActionButton
            appearance="secondary"
            disabled={isRefreshing || isRestoring || isPurchasing}
            onPress={() => {
              void openManageSubscriptions();
            }}
            testID={testIds.billing.manageButton}
          >
            {t('billing.buttons.manage')}
          </ActionButton>
          <ActionButton
            appearance="secondary"
            disabled={isRefreshing || isRestoring || isPurchasing}
            onPress={() => {
              void refreshBilling();
            }}
            testID={testIds.billing.refreshButton}
          >
            {snapshot.accessState === 'sync_error'
              ? t('billing.buttons.retry')
              : t('billing.buttons.refresh')}
          </ActionButton>
          {isRefreshing || isRestoring ? <Text>{t('billing.labels.refreshing')}</Text> : null}
        </View>
      </SectionCard>
    </Screen>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    actions: {
      gap: theme.spacing.sm,
    },
  });
}
