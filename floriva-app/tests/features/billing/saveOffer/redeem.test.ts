import { redeemSaveOffer } from '@/src/features/billing/saveOffer/redeem';
import type { SaveOffer } from '@/src/features/billing/saveOffer/types';

const monthlyIos: SaveOffer = {
  kind: 'monthly80', planId: 'monthly', discountedPriceLabel: '$1.20/month',
  fullPriceLabel: '$5.99/month', redemption: { platform: 'ios', offerCode: 'SAVEMONTHLY' },
};
const annualAndroid: SaveOffer = {
  kind: 'annual30', planId: 'annual', discountedPriceLabel: '$27.99',
  fullPriceLabel: '$39.99/year', redemption: { platform: 'android', offerId: 'save-annual-30' },
};

describe('redeemSaveOffer', () => {
  it('returns simulated success in E2E mode without calling native', async () => {
    const copyOfferCode = jest.fn();
    const presentCode = jest.fn();
    const requestPurchase = jest.fn();
    const result = await redeemSaveOffer(monthlyIos, {
      e2e: true,
      copyOfferCode,
      presentCodeRedemptionSheetIOS: presentCode,
      requestAndroidOffer: requestPurchase,
    });
    expect(result).toEqual({ status: 'redeemed' });
    expect(copyOfferCode).not.toHaveBeenCalled();
    expect(presentCode).not.toHaveBeenCalled();
    expect(requestPurchase).not.toHaveBeenCalled();
  });

  it('copies the iOS offer code before presenting the code redemption sheet', async () => {
    const copyOfferCode = jest.fn().mockResolvedValue(undefined);
    const presentCode = jest.fn().mockResolvedValue(undefined);
    const result = await redeemSaveOffer(monthlyIos, {
      e2e: false,
      copyOfferCode,
      presentCodeRedemptionSheetIOS: presentCode,
      requestAndroidOffer: jest.fn(),
    });
    expect(copyOfferCode).toHaveBeenCalledWith('SAVEMONTHLY');
    expect(copyOfferCode.mock.invocationCallOrder[0]).toBeLessThan(
      presentCode.mock.invocationCallOrder[0],
    );
    expect(presentCode).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: 'redeemed' });
  });

  it('launches the android offer purchase for an android offer', async () => {
    const copyOfferCode = jest.fn();
    const requestAndroidOffer = jest.fn().mockResolvedValue(undefined);
    const result = await redeemSaveOffer(annualAndroid, {
      e2e: false,
      copyOfferCode,
      presentCodeRedemptionSheetIOS: jest.fn(),
      requestAndroidOffer,
    });
    expect(copyOfferCode).not.toHaveBeenCalled();
    expect(requestAndroidOffer).toHaveBeenCalledWith('save-annual-30');
    expect(result).toEqual({ status: 'redeemed' });
  });

  it('returns failed when the native call throws', async () => {
    const presentCode = jest.fn().mockRejectedValue(new Error('boom'));
    const result = await redeemSaveOffer(monthlyIos, {
      e2e: false,
      copyOfferCode: jest.fn().mockResolvedValue(undefined),
      presentCodeRedemptionSheetIOS: presentCode,
      requestAndroidOffer: jest.fn(),
    });
    expect(result.status).toBe('failed');
  });

  it('returns the original message when redemption rejects with a non-Error value', async () => {
    const result = await redeemSaveOffer(monthlyIos, {
      e2e: false,
      copyOfferCode: jest.fn().mockRejectedValue('clipboard unavailable'),
      presentCodeRedemptionSheetIOS: jest.fn(),
      requestAndroidOffer: jest.fn(),
    });

    expect(result).toEqual({ status: 'failed', message: 'clipboard unavailable' });
  });
});
