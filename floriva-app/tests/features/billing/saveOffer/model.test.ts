import { florivaRuntimeBillingConfig } from '@/src/features/billing/config';
import { resolveSaveOffer } from '@/src/features/billing/saveOffer/model';
import type { BillingSnapshot } from '@/src/types/domain';

const cfg = {
  monthlyPriceLabel: '$5.99/month',
  annualPriceLabel: '$39.99/year',
  saveOffers: {
    monthly: {
      discountedPriceLabel: '$1.20/month',
      iosDiscountedPriceLabel: '$1.19/month',
      androidDiscountedPriceLabel: '$1.20/month',
      iosOfferCode: 'SAVEMONTHLY',
      androidOfferId: 'save-monthly-80-3mo',
    },
    annual: { discountedPriceLabel: '$27.99', iosOfferCode: 'SAVEANNUAL', androidOfferId: 'save-annual-30' },
  },
};

const snap = (over: Partial<BillingSnapshot>): BillingSnapshot => ({ accessState: 'subscribed', ...over });

describe('resolveSaveOffer', () => {
  it('offers monthly80 to an active monthly subscriber on ios', () => {
    const offer = resolveSaveOffer(snap({ accessState: 'subscribed', planId: 'monthly' }), 'ios', cfg);
    expect(offer).toMatchObject({
      kind: 'monthly80',
      planId: 'monthly',
      discountedPriceLabel: '$1.19/month',
      fullPriceLabel: '$5.99/month',
      redemption: { platform: 'ios', offerCode: 'SAVEMONTHLY' },
    });
  });

  it('offers monthly80 to a trialing monthly subscriber', () => {
    const offer = resolveSaveOffer(snap({ accessState: 'trial_active', planId: 'monthly' }), 'android', cfg);
    expect(offer?.kind).toBe('monthly80');
    expect(offer?.discountedPriceLabel).toBe('$1.20/month');
    expect(offer?.redemption).toEqual({ platform: 'android', offerId: 'save-monthly-80-3mo' });
  });

  it('offers annual30 to an active annual subscriber', () => {
    const offer = resolveSaveOffer(snap({ accessState: 'subscribed', planId: 'annual' }), 'ios', cfg);
    expect(offer?.kind).toBe('annual30');
    expect(offer?.fullPriceLabel).toBe('$39.99/year');
  });

  it('offers annual30trial to a trialing annual subscriber', () => {
    const offer = resolveSaveOffer(snap({ accessState: 'trial_active', planId: 'annual' }), 'ios', cfg);
    expect(offer?.kind).toBe('annual30trial');
    expect(offer?.discountedPriceLabel).toBe('$27.99');
  });

  it('returns null for lifetime', () => {
    expect(resolveSaveOffer(snap({ accessState: 'subscribed', planId: 'lifetime' }), 'ios', cfg)).toBeNull();
  });

  it('returns null when already redeemed on this device', () => {
    expect(
      resolveSaveOffer(snap({ accessState: 'subscribed', planId: 'monthly', saveOfferRedeemedAt: '2026-06-30T00:00:00.000Z' }), 'ios', cfg),
    ).toBeNull();
  });

  it.each(['needs_purchase', 'expired', 'sync_error'] as const)('returns null for accessState %s', (accessState) => {
    expect(resolveSaveOffer(snap({ accessState, planId: 'monthly' }), 'ios', cfg)).toBeNull();
  });

  it('returns null when planId is missing', () => {
    expect(resolveSaveOffer(snap({ accessState: 'subscribed', planId: undefined }), 'ios', cfg)).toBeNull();
  });

  it('returns null when the config has no saveOffers block', () => {
    const configWithoutOffers = {
      monthlyPriceLabel: '$5.99/month',
      annualPriceLabel: '$39.99/year',
    };
    expect(() =>
      resolveSaveOffer(snap({ accessState: 'subscribed', planId: 'monthly' }), 'ios', configWithoutOffers),
    ).not.toThrow();
    expect(
      resolveSaveOffer(snap({ accessState: 'subscribed', planId: 'monthly' }), 'ios', configWithoutOffers),
    ).toBeNull();
  });

  it('accepts the real runtime billing config shape', () => {
    const offer = resolveSaveOffer(
      snap({ accessState: 'subscribed', planId: 'monthly' }),
      'ios',
      florivaRuntimeBillingConfig,
    );
    expect(offer?.kind).toBe('monthly80');
    expect(typeof offer?.fullPriceLabel).toBe('string');
    expect(offer?.fullPriceLabel.length).toBeGreaterThan(0);
  });
});
