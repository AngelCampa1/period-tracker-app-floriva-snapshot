import type { BillingSnapshot } from '@/src/types/domain';
import type { SaveOffer, SaveOfferKind } from './types';

type SaveOfferEntry = {
  discountedPriceLabel: string;
  iosDiscountedPriceLabel?: string;
  androidDiscountedPriceLabel?: string;
  iosOfferCode: string;
  androidOfferId: string;
};

export type SaveOfferConfig = {
  monthlyPriceLabel?: string;
  annualPriceLabel?: string;
  saveOffers?: { monthly: SaveOfferEntry; annual: SaveOfferEntry };
};

export function resolveSaveOffer(
  snapshot: BillingSnapshot,
  platform: 'ios' | 'android',
  config: SaveOfferConfig,
): SaveOffer | null {
  if (snapshot.saveOfferRedeemedAt != null) {
    return null;
  }
  if (snapshot.accessState !== 'subscribed' && snapshot.accessState !== 'trial_active') {
    return null;
  }
  const plan = snapshot.planId;
  if (plan !== 'monthly' && plan !== 'annual') {
    return null;
  }

  const entry = config.saveOffers?.[plan];
  if (entry == null) {
    return null;
  }

  const redemption: SaveOffer['redemption'] =
    platform === 'ios'
      ? { platform: 'ios', offerCode: entry.iosOfferCode }
      : { platform: 'android', offerId: entry.androidOfferId };

  let kind: SaveOfferKind;
  if (plan === 'monthly') {
    kind = 'monthly80';
  } else {
    kind = snapshot.accessState === 'trial_active' ? 'annual30trial' : 'annual30';
  }

  return {
    kind,
    planId: plan,
    discountedPriceLabel:
      platform === 'ios'
        ? entry.iosDiscountedPriceLabel ?? entry.discountedPriceLabel
        : entry.androidDiscountedPriceLabel ?? entry.discountedPriceLabel,
    fullPriceLabel: (plan === 'monthly' ? config.monthlyPriceLabel : config.annualPriceLabel) ?? '',
    redemption,
  };
}
