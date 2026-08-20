import type { SaveOffer } from './types';

export type RedeemResult = { status: 'redeemed' } | { status: 'failed'; message: string };

export type RedeemDeps = {
  e2e: boolean;
  copyOfferCode: (offerCode: string) => Promise<void>;
  presentCodeRedemptionSheetIOS: () => Promise<void>;
  requestAndroidOffer: (offerId: string) => Promise<void>;
};

export async function redeemSaveOffer(offer: SaveOffer, deps: RedeemDeps): Promise<RedeemResult> {
  if (deps.e2e) {
    return { status: 'redeemed' };
  }
  try {
    if (offer.redemption.platform === 'ios') {
      await deps.copyOfferCode(offer.redemption.offerCode);
      await deps.presentCodeRedemptionSheetIOS();
    } else {
      await deps.requestAndroidOffer(offer.redemption.offerId);
    }
    return { status: 'redeemed' };
  } catch (error) {
    return { status: 'failed', message: String((error as { message?: string })?.message ?? error) };
  }
}
