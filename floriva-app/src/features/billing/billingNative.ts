import { requireOptionalNativeModule } from 'expo-modules-core';

let cachedHasNativeBillingModule: boolean | undefined;

export function hasNativeBillingModule() {
  if (cachedHasNativeBillingModule === undefined) {
    cachedHasNativeBillingModule = Boolean(requireOptionalNativeModule('ExpoIap'));
  }

  return cachedHasNativeBillingModule;
}
