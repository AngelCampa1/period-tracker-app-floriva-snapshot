import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { ActionButton } from '@/src/components/primitives/ActionButton';
import type { BillingOffering } from '@/src/features/billing/model';
import {
  computeAnnualSavingsPercent,
  computeMonthlyEquivalentPrice,
} from '@/src/features/billing/paywallCopy';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import type { SubscriptionPlanId } from '@/src/types/domain';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

export type PaywallPlanSelectorTestIds = {
  planCardAnnual: string;
  planCardMonthly: string;
  planCardLifetime: string;
  bestValueBadge: string;
  purchaseButton: string;
  notChargedToday: string;
};

type PaywallPlanSelectorProps = {
  offerings: BillingOffering[];
  selectedPlanId: SubscriptionPlanId | null;
  onSelect: (planId: SubscriptionPlanId) => void;
  onPurchase: (planId: SubscriptionPlanId) => void;
  /** True when the one-time app-level Lifetime free trial can still be started. */
  lifetimeTrialEligible?: boolean;
  /** Starts the app-level Lifetime free trial instead of charging the one-time price. */
  onStartLifetimeTrial?: () => void;
  purchasingPlanId: SubscriptionPlanId | null;
  actionsDisabled: boolean;
  testIds: PaywallPlanSelectorTestIds;
  reducedMotionEnabled?: boolean;
};

const PLAN_CARD_TEST_ID_KEY: Record<SubscriptionPlanId, keyof PaywallPlanSelectorTestIds> = {
  annual: 'planCardAnnual',
  monthly: 'planCardMonthly',
  lifetime: 'planCardLifetime',
};

const PLAN_CTA_KEY: Record<SubscriptionPlanId, string> = {
  annual: 'billing.buttons.annual',
  monthly: 'billing.buttons.monthly',
  lifetime: 'billing.buttons.lifetime',
};

export function PaywallPlanSelector({
  offerings,
  selectedPlanId,
  onSelect,
  onPurchase,
  lifetimeTrialEligible = false,
  onStartLifetimeTrial,
  purchasingPlanId,
  actionsDisabled,
  testIds,
  reducedMotionEnabled,
}: PaywallPlanSelectorProps) {
  const theme = useFlorivaTheme();
  const { t } = useLocalization();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Derive the savings % and per-month figure from the SAME live store prices
  // shown on the cards (offering.priceLabel), never from static config - so the
  // derived lines can always be backed up by the price the user actually sees.
  const annualPriceLabel = offerings.find((offering) => offering.planId === 'annual')?.priceLabel;
  const monthlyPriceLabel = offerings.find(
    (offering) => offering.planId === 'monthly',
  )?.priceLabel;
  const savingsPercent = computeAnnualSavingsPercent(monthlyPriceLabel, annualPriceLabel);
  const monthlyEquivalentPrice = computeMonthlyEquivalentPrice(annualPriceLabel);

  const selectedOffering =
    offerings.find((offering) => offering.planId === selectedPlanId) ?? null;
  // The Lifetime trial is app-level (no store `hasFreeTrial`), so surface its
  // start-a-trial affordances whenever Lifetime is the eligible selection.
  const selectedStartsLifetimeTrial =
    selectedOffering?.planId === 'lifetime' && lifetimeTrialEligible;
  const selectedHasTrial =
    Boolean(selectedOffering?.hasFreeTrial) || selectedStartsLifetimeTrial;
  // Lifetime is a one-time purchase, not an auto-renewing subscription, so the
  // auto-renew disclosure must not appear when it is the selected plan.
  const selectedIsSubscription =
    selectedOffering != null && selectedOffering.planId !== 'lifetime';
  const ctaPlanId = selectedOffering?.planId ?? null;
  const isPurchasing = purchasingPlanId !== null;

  return (
    <View style={styles.container} accessibilityRole="radiogroup">
      <View style={styles.cards}>
        {offerings.map((offering) => {
          const isSelected = offering.planId === selectedPlanId;
          const isAnnual = offering.planId === 'annual';
          const isLifetime = offering.planId === 'lifetime';
          const priceCaption = isLifetime
            ? t('billing.labels.oneTimePrice')
            : t('billing.labels.price');
          // When the app-level Lifetime trial is available, the Lifetime card leads
          // with the trial framing instead of the plain one-time-purchase copy.
          const detail =
            isLifetime && lifetimeTrialEligible
              ? t('billing.offerings.lifetimeTrialDetail')
              : offering.detail;

          return (
            <Pressable
              key={offering.planId}
              accessibilityRole="radio"
              accessibilityLabel={`${offering.title}, ${offering.priceLabel}`}
              accessibilityState={{ selected: isSelected, disabled: actionsDisabled }}
              disabled={actionsDisabled}
              onPress={() => {
                onSelect(offering.planId);
              }}
              style={[styles.card, isSelected ? styles.cardSelected : null]}
              testID={testIds[PLAN_CARD_TEST_ID_KEY[offering.planId]]}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.planTitle}>{offering.title}</Text>
                <View style={styles.badgeRow}>
                  {isAnnual ? (
                    <View style={styles.badge} testID={testIds.bestValueBadge}>
                      <Text style={styles.badgeText}>{t('billing.plans.bestValueBadge')}</Text>
                    </View>
                  ) : null}
                  {/* UL-10: the chosen plan is stated in words, not just
                      border-weight — mirroring the accessibilityState the
                      radio already announces. */}
                  {isSelected ? (
                    <View style={styles.selectedBadge}>
                      <Text style={styles.selectedBadgeText}>
                        {t('billing.plans.selectedBadge')}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <Text style={styles.priceCaption}>{priceCaption}</Text>
              <Text style={styles.price}>{offering.priceLabel}</Text>

              {isAnnual && monthlyEquivalentPrice ? (
                <Text style={styles.perMonth}>
                  {t('billing.plans.perMonth', { price: monthlyEquivalentPrice })}
                </Text>
              ) : null}

              {isAnnual && savingsPercent != null ? (
                <Text style={styles.savings}>
                  {t('billing.plans.savings', { percent: savingsPercent })}
                </Text>
              ) : null}

              <Text style={styles.detail}>{detail}</Text>
            </Pressable>
          );
        })}
      </View>

      {selectedHasTrial ? (
        <Text style={styles.notChargedToday} testID={testIds.notChargedToday}>
          {t('billing.plans.notChargedToday')}
        </Text>
      ) : null}

      <ActionButton
        appearance="primary"
        disabled={
          actionsDisabled ||
          ctaPlanId == null ||
          selectedOffering?.isPurchaseAvailable === false ||
          isPurchasing
        }
        onPress={() => {
          if (selectedStartsLifetimeTrial) {
            onStartLifetimeTrial?.();
            return;
          }

          if (ctaPlanId != null) {
            onPurchase(ctaPlanId);
          }
        }}
        reducedMotionEnabled={reducedMotionEnabled}
        testID={testIds.purchaseButton}
      >
        {selectedStartsLifetimeTrial
          ? t('billing.buttons.lifetimeStartTrial')
          : ctaPlanId != null
            ? t(PLAN_CTA_KEY[ctaPlanId])
            : t('billing.buttons.annual')}
      </ActionButton>

      {selectedIsSubscription ? (
        <Text style={styles.autoRenew}>{t('billing.plans.autoRenewDisclosure')}</Text>
      ) : null}
    </View>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.lg,
    },
    cards: {
      gap: theme.spacing.md,
    },
    card: {
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderPrimary,
      backgroundColor: theme.colors.surfacePrimary,
      padding: theme.spacing.lg,
      gap: theme.spacing.xs,
    },
    cardSelected: {
      borderColor: theme.colors.accentPrimary,
      borderWidth: 2,
      backgroundColor: theme.colors.buttonGlassFill,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
    },
    selectedBadge: {
      borderRadius: theme.radii.pill,
      borderWidth: 1,
      borderColor: theme.colors.accentPrimary,
      backgroundColor: theme.colors.chipSelectedFill,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    selectedBadgeText: {
      color: theme.colors.accentPrimary,
      ...theme.typography.eyebrow,
    },
    planTitle: {
      color: theme.colors.textPrimary,
      ...theme.typography.subtitle,
    },
    badge: {
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.accentPrimary,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    badgeText: {
      color: theme.colors.buttonPrimaryText,
      ...theme.typography.eyebrow,
    },
    priceCaption: {
      color: theme.colors.textSecondary,
      ...theme.typography.eyebrow,
    },
    price: {
      color: theme.colors.textPrimary,
      ...theme.typography.title,
    },
    perMonth: {
      color: theme.colors.textSecondary,
      ...theme.typography.caption,
    },
    // UL-31: the annual card stacked three numeral treatments (serif price,
    // caption per-month, bodyStrong savings). The savings line now shares the
    // per-month caption scale, keeping only its accent color — one serif
    // price + one quiet caption pair per card.
    savings: {
      color: theme.colors.accentPrimary,
      ...theme.typography.caption,
    },
    detail: {
      color: theme.colors.textSecondary,
      ...theme.typography.caption,
    },
    notChargedToday: {
      color: theme.colors.textPrimary,
      ...theme.typography.bodyStrong,
      textAlign: 'center',
    },
    autoRenew: {
      color: theme.colors.textSecondary,
      ...theme.typography.caption,
      textAlign: 'center',
    },
  });
}
