import fs from 'node:fs';
import path from 'node:path';

type StoreKitSubscription = {
  groupNumber: number;
  productID: string;
  subscriptionGroupID: string;
};

type StoreKitConfiguration = {
  subscriptionGroups: {
    id: string;
    subscriptions: StoreKitSubscription[];
  }[];
};

const storeKitConfigurationPath = path.resolve(
  __dirname,
  '../../../ios/Floriva.storekit',
);

function findSubscription(configuration: StoreKitConfiguration, productID: string) {
  for (const group of configuration.subscriptionGroups) {
    const subscription = group.subscriptions.find(
      (candidate) => candidate.productID === productID,
    );

    if (subscription) {
      return { groupID: group.id, subscription };
    }
  }

  throw new Error(`Missing StoreKit subscription: ${productID}`);
}

describe('StoreKit configuration', () => {
  it('models annual and monthly as same-level crossgrades in one subscription group', () => {
    const configuration = JSON.parse(
      fs.readFileSync(storeKitConfigurationPath, 'utf8'),
    ) as StoreKitConfiguration;
    const annual = findSubscription(configuration, 'floriva.plus.annual');
    const monthly = findSubscription(configuration, 'floriva.plus.monthly');

    expect(annual.groupID).toBe(monthly.groupID);
    expect(annual.subscription.subscriptionGroupID).toBe(annual.groupID);
    expect(monthly.subscription.subscriptionGroupID).toBe(monthly.groupID);
    expect(annual.subscription.groupNumber).toBe(1);
    expect(monthly.subscription.groupNumber).toBe(1);
  });
});
