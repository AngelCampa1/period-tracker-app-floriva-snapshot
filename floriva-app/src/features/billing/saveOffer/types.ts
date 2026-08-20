import type { SubscriptionPlanId } from '@/src/types/domain';

export type SaveOfferKind = 'monthly80' | 'annual30' | 'annual30trial';

export type SaveOfferRedemption =
  | { platform: 'ios'; offerCode: string }
  | { platform: 'android'; offerId: string };

export type SaveOffer = {
  kind: SaveOfferKind;
  planId: Extract<SubscriptionPlanId, 'monthly' | 'annual'>;
  /** e.g. "$1.19/month", "$1.20/month", or "$27.99" — already-formatted, from config. */
  discountedPriceLabel: string;
  /** e.g. "$5.99/month" or "$39.99/year" — the standard price, from config. */
  fullPriceLabel: string;
  redemption: SaveOfferRedemption;
};
