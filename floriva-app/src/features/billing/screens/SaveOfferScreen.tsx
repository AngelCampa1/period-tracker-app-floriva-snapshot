import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';

import { ActionButton } from '@/src/components/primitives/ActionButton';
import { Screen } from '@/src/components/primitives/Screen';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import { useBilling } from '@/src/features/billing/BillingProvider';
import { florivaRuntimeBillingConfig } from '@/src/features/billing/config';
import { resolveSaveOffer } from '@/src/features/billing/saveOffer/model';
import type { SaveOfferKind } from '@/src/features/billing/saveOffer/types';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import { testIds } from '@/src/testing/testIds';

const SAVE_OFFER_SUBTREE: Record<SaveOfferKind, 'monthly' | 'annual' | 'annualTrial'> = {
  monthly80: 'monthly',
  annual30: 'annual',
  annual30trial: 'annualTrial',
};

export function SaveOfferScreen() {
  const router = useRouter();
  const { t } = useLocalization();
  const { isHydrated, snapshot, redeemSaveOffer, openManageSubscriptions } = useBilling();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  // Once the user has accepted or declined, this screen is navigating away under
  // its own handler. A successful redemption stamps saveOfferRedeemedAt, which
  // makes the next render compute a null offer — without this guard the fallback
  // effect would then fire a spurious openManageSubscriptions + back on top of
  // the handler's own navigation.
  const hasResolvedRef = useRef(false);

  // Computing the offer each render is cheap and pure. We must NOT act on a
  // null result during render: while the provider hydrates the persisted
  // snapshot it is the default no-offer state, so resolveSaveOffer returns null
  // on first paint. Acting then would bounce the user out before the retention
  // offer ever appears.
  const offer = isHydrated
    ? resolveSaveOffer(
        snapshot,
        Platform.OS === 'ios' ? 'ios' : 'android',
        florivaRuntimeBillingConfig,
      )
    : null;

  // Defensive fallback: a genuinely ineligible entry (e.g. a direct deep-link
  // after the offer was already redeemed) should fall through to the system
  // subscription manager exactly as declining would. Only act once billing has
  // settled and there is truly no offer — never during the hydration window.
  useEffect(() => {
    if (isHydrated && offer == null && !hasResolvedRef.current) {
      hasResolvedRef.current = true;
      void openManageSubscriptions();
      router.back();
    }
  }, [isHydrated, offer, openManageSubscriptions, router]);

  // Calm, side-effect-free placeholder while billing hydrates, and while the
  // effect above navigates a genuinely-ineligible entry away. Nothing flashes.
  if (offer == null) {
    return <Screen title={t('settings.subscription.saveOffer.eyebrow')} />;
  }

  const eligibleOffer = offer;
  const subtree = SAVE_OFFER_SUBTREE[offer.kind];
  const title = t(`settings.subscription.saveOffer.${subtree}.title`);
  const body = t(`settings.subscription.saveOffer.${subtree}.body`, {
    discounted: offer.discountedPriceLabel,
    full: offer.fullPriceLabel,
  });
  const primaryLabel = t(`settings.subscription.saveOffer.${subtree}.primary`);

  async function handleAccept() {
    const result = await redeemSaveOffer(eligibleOffer);

    if (result.status === 'redeemed') {
      hasResolvedRef.current = true;
      setStatusMessage(t('settings.subscription.saveOffer.confirmation'));
      router.replace('/settings');
      return;
    }

    setStatusMessage(t('settings.subscription.saveOffer.failure'));
  }

  async function handleDecline() {
    hasResolvedRef.current = true;
    await openManageSubscriptions();
    router.back();
  }

  return (
    <Screen
      eyebrow={t('settings.subscription.saveOffer.eyebrow')}
      title={title}
      description={body}
    >
      {statusMessage ? (
        <SectionCard description={statusMessage} title={t('settings.status.updated')} />
      ) : null}

      <ActionButton
        appearance="primary"
        onPress={() => {
          void handleAccept();
        }}
        testID={testIds.settings.saveOfferAcceptButton}
      >
        {primaryLabel}
      </ActionButton>

      <ActionButton
        appearance="secondary"
        onPress={() => {
          void handleDecline();
        }}
        testID={testIds.settings.saveOfferDeclineButton}
      >
        {t('settings.subscription.saveOffer.decline')}
      </ActionButton>

      {/* UL-35: the Apple offer-code mechanics are redemption logistics, not
          part of the pitch — they follow the decision zone as a quiet
          footnote instead of interrupting it mid-page. Still fully visible
          before any tap; the honest framing above is untouched. */}
      {Platform.OS === 'ios' && offer.redemption.platform === 'ios' ? (
        <SectionCard
          presentation="unframed"
          title={t('settings.subscription.saveOffer.codeTitle')}
          description={t('settings.subscription.saveOffer.codeBody', {
            code: offer.redemption.offerCode,
          })}
        />
      ) : null}
    </Screen>
  );
}
