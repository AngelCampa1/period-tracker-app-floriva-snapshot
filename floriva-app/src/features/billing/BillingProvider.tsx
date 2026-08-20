import {
  useCallback,
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import { setStringAsync } from 'expo-clipboard';
import * as Linking from 'expo-linking';
import {
  ErrorCode,
  fetchProducts,
  getActiveSubscriptions,
  getAvailablePurchases,
  presentCodeRedemptionSheetIOS,
  type Product,
  type ProductSubscription,
  type Purchase,
  useIAP,
} from 'expo-iap';

import { useDatabase } from '@/src/db/DatabaseProvider';
import { defaultBillingSnapshot } from '@/src/db/domainDefaults';
import { useAppShell } from '@/src/features/app-shell/AppShellProvider';
import {
  florivaRuntimeBillingConfig,
  getManageSubscriptionUrlFallback,
  hasNativeBillingConfig,
} from '@/src/features/billing/config';
import {
  buildBillingOfferings,
  buildFirstChargeReminderDate,
  deriveBillingSnapshotFromNativeState,
  normalizeBillingSnapshot,
  type BillingOffering,
} from '@/src/features/billing/model';
import {
  buildDevFallbackCatalogPlans,
  buildBillingOfferingCopy,
  buildConfiguredProductIds,
  buildMissingConfigSnapshot,
  buildProvisionalPurchaseSnapshot,
  getPlanConfig,
  mapCatalogPlans,
  mapCatalogProducts,
  snapshotUnlocksPaidAccess,
  type CatalogPlan,
} from '@/src/features/billing/runtime';
import {
  buildLifetimeTrialSnapshot,
  isLifetimeTransitionAllowed,
  isLifetimeTrialEligible,
} from '@/src/features/billing/lifetimeTrial';
import { redeemSaveOffer as runRedeemSaveOffer } from '@/src/features/billing/saveOffer/redeem';
import type { RedeemResult } from '@/src/features/billing/saveOffer/redeem';
import type { SaveOffer } from '@/src/features/billing/saveOffer/types';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import { reportRuntimeDiagnostic } from '@/src/lib/diagnostics/runtimeDiagnostics';
import { reconcileBillingReminderNotification } from '@/src/lib/notifications/reminderScheduler';
import { resolveDevLaunchPreset } from '@/src/testing/devLaunchPreset';
import type { BillingSnapshot, SubscriptionPlanId } from '@/src/types/domain';

type BillingContextValue = {
  isHydrated: boolean;
  isSyncing: boolean;
  isRefreshing: boolean;
  isRestoring: boolean;
  purchasingPlanId: SubscriptionPlanId | null;
  statusMessage: string | null;
  snapshot: BillingSnapshot;
  managementUrl: string | null;
  offerings: BillingOffering[];
  /** True when the one-time app-level Lifetime free trial can still be started. */
  lifetimeTrialEligible: boolean;
  purchasePlan: (planId: SubscriptionPlanId) => Promise<void>;
  /** Starts the one-time app-level Lifetime free trial (no store purchase; no auto-charge). */
  startLifetimeTrial: () => Promise<void>;
  presentRestorePaywall: () => Promise<void>;
  openManageSubscriptions: () => Promise<void>;
  refreshBilling: () => Promise<void>;
  redeemSaveOffer: (offer: SaveOffer) => Promise<RedeemResult>;
};

type BillingStoreConnection = Pick<
  ReturnType<typeof useIAP>,
  'connected' | 'reconnect' | 'requestPurchase' | 'finishTransaction' | 'restorePurchases'
>;

const BillingContext = createContext<BillingContextValue | null>(null);
const billingUnavailableMessage =
  'Billing is not available right now. Try refreshing.';
const missingBillingConfigMessage =
  'Billing is not set up for this build. Store product IDs must be added before purchases or restores will work.';
const purchaseCancelledMessage =
  'Purchase was cancelled.';
const localPurchaseE2EMode = 'local-purchase-success';

function getDiagnosticErrorMessage(error: unknown) {
  return String((error as { message?: string })?.message ?? error);
}

function isLocalPurchaseE2EModeEnabled() {
  return __DEV__ && process.env.EXPO_PUBLIC_BILLING_E2E_MODE === localPurchaseE2EMode;
}

function isAndroidNativeBillingQaModeEnabled() {
  return __DEV__ && process.env.EXPO_PUBLIC_BILLING_ANDROID_NATIVE_QA === '1';
}

function shouldUseNativeBillingBridge({
  androidNativeBillingQaEnabled,
  devLaunchPreset,
  localPurchaseE2EEnabled,
  nativeBillingConfigured,
}: {
  androidNativeBillingQaEnabled: boolean;
  devLaunchPreset: ReturnType<typeof resolveDevLaunchPreset>;
  localPurchaseE2EEnabled: boolean;
  nativeBillingConfigured: boolean;
}) {
  if (!nativeBillingConfigured || localPurchaseE2EEnabled) {
    return false;
  }

  if (__DEV__ && Platform.OS === 'android') {
    return androidNativeBillingQaEnabled;
  }

  return true;
}

function buildLocalE2EPurchase({
  plan,
  productId,
  now,
}: {
  plan: CatalogPlan;
  productId: string;
  now: Date;
}): Purchase {
  const transactionDate = now.getTime();
  const purchase = {
    id: `local-e2e-${plan.planId}-${transactionDate}`,
    productId,
    transactionDate,
    purchaseState: 'purchased',
    isAutoRenewing: plan.productType === 'subs',
    quantity: 1,
    store: 'app-store',
    platform: 'ios',
  };

  if (plan.productType !== 'subs') {
    return purchase as Purchase;
  }

  const trialEndsAt = new Date(transactionDate);
  trialEndsAt.setMonth(trialEndsAt.getMonth() + 1);

  return {
    ...purchase,
    expirationDateIOS: trialEndsAt.getTime(),
    offerIOS: {
      paymentMode: 'free-trial',
    },
  } as Purchase;
}

function BillingStoreBridge({
  diagnosticsConsentEnabled,
  onConnectionChange,
}: {
  diagnosticsConsentEnabled: boolean;
  onConnectionChange: (connection: BillingStoreConnection) => void;
}) {
  const {
    connected,
    reconnect,
    requestPurchase,
    finishTransaction,
    restorePurchases,
  } = useIAP({
    onError: (error) => {
      void reportRuntimeDiagnostic({
        diagnosticsConsentEnabled,
        name: 'billing_store_error',
        payload: {
          feature: 'billing',
          error: String(error.message ?? error),
        },
      });
    },
  });

  useEffect(() => {
    onConnectionChange({
      connected,
      reconnect,
      requestPurchase,
      finishTransaction,
      restorePurchases,
    });
  }, [
    connected,
    finishTransaction,
    onConnectionChange,
    reconnect,
    requestPurchase,
    restorePurchases,
  ]);

  return null;
}

export function BillingProvider({ children }: PropsWithChildren) {
  const { repositories } = useDatabase();
  const { applyBillingSnapshot, privacyPreference } = useAppShell();
  const { t } = useLocalization();
  const devLaunchPreset = useMemo(() => resolveDevLaunchPreset(), []);
  const localPurchaseE2EEnabled = useMemo(() => isLocalPurchaseE2EModeEnabled(), []);
  const androidNativeBillingQaEnabled = useMemo(
    () => isAndroidNativeBillingQaModeEnabled(),
    [],
  );
  const nativeBillingConfigured = hasNativeBillingConfig() && !localPurchaseE2EEnabled;
  const nativeBillingBridgeEnabled = shouldUseNativeBillingBridge({
    androidNativeBillingQaEnabled,
    devLaunchPreset,
    localPurchaseE2EEnabled,
    nativeBillingConfigured,
  });
  const [snapshot, setSnapshot] = useState<BillingSnapshot>(defaultBillingSnapshot);
  const [managementUrl, setManagementUrl] = useState<string | null>(
    getManageSubscriptionUrlFallback(),
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [offerings, setOfferings] = useState<BillingOffering[]>([]);
  const [catalogPlans, setCatalogPlans] = useState<CatalogPlan[]>([]);
  const [catalogUnavailable, setCatalogUnavailable] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [purchasingPlanId, setPurchasingPlanId] = useState<SubscriptionPlanId | null>(null);
  const [isStoreBridgeReady, setIsStoreBridgeReady] = useState(!nativeBillingBridgeEnabled);
  const billingSnapshotRepositoryRef = useRef(repositories.billingSnapshot);
  const applyBillingSnapshotRef = useRef(applyBillingSnapshot);
  const connectedRef = useRef(false);
  const reconnectRef = useRef<BillingStoreConnection['reconnect'] | null>(null);
  const requestPurchaseRef = useRef<BillingStoreConnection['requestPurchase'] | null>(null);
  const finishTransactionRef = useRef<BillingStoreConnection['finishTransaction'] | null>(null);
  const restorePurchasesRef = useRef<BillingStoreConnection['restorePurchases'] | null>(null);
  const snapshotRef = useRef(snapshot);
  const isRefreshingRef = useRef(false);
  const isRestoringRef = useRef(false);
  const purchasingPlanIdRef = useRef<SubscriptionPlanId | null>(null);
  const billingWriteVersionRef = useRef(0);
  const catalogFallbackVisibleRef = useRef(false);
  const isSyncing = isRefreshing || isRestoring || purchasingPlanId != null;

  useEffect(() => {
    billingSnapshotRepositoryRef.current = repositories.billingSnapshot;
  }, [repositories.billingSnapshot]);

  useEffect(() => {
    applyBillingSnapshotRef.current = applyBillingSnapshot;
  }, [applyBillingSnapshot]);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const handleConnectionChange = useCallback((connection: BillingStoreConnection) => {
    connectedRef.current = connection.connected;
    reconnectRef.current = connection.reconnect;
    requestPurchaseRef.current = connection.requestPurchase;
    finishTransactionRef.current = connection.finishTransaction;
    restorePurchasesRef.current = connection.restorePurchases;
    setIsStoreBridgeReady(true);
  }, []);

  useEffect(() => {
    const visiblePlans =
      catalogPlans.length > 0
        ? catalogPlans
        : catalogUnavailable
          ? buildDevFallbackCatalogPlans()
          : [];

    setOfferings(
      buildBillingOfferings(
        mapCatalogProducts(visiblePlans, catalogPlans.length > 0),
        florivaRuntimeBillingConfig,
        buildBillingOfferingCopy(t),
      ),
    );
  }, [catalogPlans, catalogUnavailable, t]);

  const persistSnapshot = useCallback(
    async (nextSnapshot: BillingSnapshot) => {
      const reminderDate = buildFirstChargeReminderDate(
        nextSnapshot,
        florivaRuntimeBillingConfig,
      );
      const persistedSnapshot = {
        ...nextSnapshot,
        // Some purchase and refresh paths rebuild the snapshot. Carry durable,
        // one-time markers forward when the rebuilt snapshot omits them.
        lifetimeTrialStartedAt:
          nextSnapshot.lifetimeTrialStartedAt ?? snapshotRef.current.lifetimeTrialStartedAt,
        saveOfferRedeemedAt:
          nextSnapshot.saveOfferRedeemedAt ?? snapshotRef.current.saveOfferRedeemedAt,
        reminderScheduledFor: reminderDate?.toISOString(),
      };

      await billingSnapshotRepositoryRef.current.saveSnapshot(persistedSnapshot);
      await reconcileBillingReminderNotification({
        snapshot: persistedSnapshot,
      });

      snapshotRef.current = persistedSnapshot;
      setSnapshot(persistedSnapshot);
      setManagementUrl(getManageSubscriptionUrlFallback());
      applyBillingSnapshotRef.current(persistedSnapshot);

      return persistedSnapshot;
    },
    [],
  );

  const loadCatalog = useCallback(async () => {
    const subscriptionProductIds = [
      florivaRuntimeBillingConfig.monthlyProductId,
      florivaRuntimeBillingConfig.annualProductId,
    ].filter((productId): productId is string => productId.trim().length > 0);
    const lifetimeProductIds = [florivaRuntimeBillingConfig.lifetimeProductId].filter(
      (productId): productId is string => productId.trim().length > 0,
    );
    const [subscriptionProducts, lifetimeProducts] = await Promise.all([
      subscriptionProductIds.length > 0
        ? fetchProducts({
            skus: subscriptionProductIds,
            type: 'subs',
          })
        : Promise.resolve([]),
      lifetimeProductIds.length > 0
        ? fetchProducts({
            skus: lifetimeProductIds,
            type: 'in-app',
          })
        : Promise.resolve([]),
    ]);
    const catalogProducts = [
      ...((subscriptionProducts ?? []) as (Product | ProductSubscription)[]),
      ...((lifetimeProducts ?? []) as (Product | ProductSubscription)[]),
    ];
    const plans = mapCatalogPlans(catalogProducts);
    catalogFallbackVisibleRef.current = plans.length === 0;
    setCatalogUnavailable(plans.length === 0);

    setCatalogPlans(plans);

    if (plans.length === 0) {
      await reportRuntimeDiagnostic({
        diagnosticsConsentEnabled: privacyPreference.diagnosticsConsentEnabled,
        name: 'billing_catalog_unavailable',
        payload: {
          feature: 'billing',
          requestedProductIds: buildConfiguredProductIds(),
          returnedProductCount: catalogProducts.length,
        },
      });
    }

    return plans;
  }, [privacyPreference.diagnosticsConsentEnabled]);

  const syncBillingState = useCallback(
    async (previousSnapshot = snapshotRef.current) => {
      const activeSubscriptions = await getActiveSubscriptions([
        florivaRuntimeBillingConfig.monthlyProductId,
        florivaRuntimeBillingConfig.annualProductId,
      ]);
      const availablePurchases = await getAvailablePurchases();

      return deriveBillingSnapshotFromNativeState({
        syncStatus: 'ready',
        activeSubscriptions: activeSubscriptions.map((subscription) => ({
          productId: subscription.productId,
          isActive: subscription.isActive,
          expirationDate:
            subscription.expirationDateIOS ??
            subscription.renewalInfoIOS?.renewalDate ??
            null,
          transactionDate: subscription.transactionDate,
        })),
        availablePurchases: availablePurchases.map((purchase) => ({
          productId: purchase.productId,
          transactionDate: purchase.transactionDate,
        })),
        previousSnapshot,
        config: florivaRuntimeBillingConfig,
        now: new Date(Date.now()),
      });
    },
    [],
  );

  const refreshBilling = useCallback(async () => {
    const currentSnapshot = await billingSnapshotRepositoryRef.current.getSnapshot();
    const normalizedCurrentSnapshot = normalizeBillingSnapshot(currentSnapshot, new Date(Date.now()));
    const devLaunchPresetSeedsAccess =
      devLaunchPreset != null &&
      devLaunchPreset !== 'billing-fallback' &&
      (normalizedCurrentSnapshot.accessState === 'trial_active' ||
        normalizedCurrentSnapshot.accessState === 'subscribed');

    if (devLaunchPresetSeedsAccess) {
      await persistSnapshot(normalizedCurrentSnapshot);
      setStatusMessage(null);
      return;
    }

    if (devLaunchPreset === 'billing-fallback') {
      setCatalogUnavailable(false);
      setCatalogPlans(buildDevFallbackCatalogPlans());
      await persistSnapshot({
        ...defaultBillingSnapshot,
        ...normalizedCurrentSnapshot,
        accessState: 'needs_purchase',
      });
      setStatusMessage(null);
      return;
    }

    if (localPurchaseE2EEnabled) {
      setCatalogUnavailable(false);
      setCatalogPlans(buildDevFallbackCatalogPlans());
      await persistSnapshot({
        ...defaultBillingSnapshot,
        ...normalizedCurrentSnapshot,
        accessState: snapshotUnlocksPaidAccess(normalizedCurrentSnapshot)
          ? normalizedCurrentSnapshot.accessState
          : // Preserve `expired` so grandfathered users whose trial has ended keep
            // the "trial has ended" copy instead of being flattened to a generic
            // needs-purchase paywall. Any other gated state falls back to needs_purchase.
            normalizedCurrentSnapshot.accessState === 'expired'
            ? 'expired'
            : 'needs_purchase',
      });
      setStatusMessage(null);
      return;
    }

    if (nativeBillingBridgeEnabled && !isStoreBridgeReady) {
      return;
    }

    if (!hasNativeBillingConfig()) {
      const nextSnapshot = buildMissingConfigSnapshot(normalizedCurrentSnapshot);
      await persistSnapshot(nextSnapshot);
      setStatusMessage(missingBillingConfigMessage);
      return;
    }

    if (!nativeBillingBridgeEnabled) {
      const nextSnapshot = buildMissingConfigSnapshot(normalizedCurrentSnapshot);
      catalogFallbackVisibleRef.current = true;
      setCatalogUnavailable(true);
      setCatalogPlans([]);
      await persistSnapshot(nextSnapshot);
      setStatusMessage(billingUnavailableMessage);
      return;
    }

    if (isRefreshingRef.current || isRestoringRef.current || purchasingPlanIdRef.current) {
      return;
    }

    const refreshWriteVersion = billingWriteVersionRef.current;
    isRefreshingRef.current = true;
    setIsRefreshing(true);

    try {
      if (!connectedRef.current) {
        await reconnectRef.current?.();
      }

      await loadCatalog();
      const nextSnapshot = await syncBillingState(currentSnapshot);

      if (billingWriteVersionRef.current !== refreshWriteVersion) {
        return;
      }

      await persistSnapshot(nextSnapshot);
      setStatusMessage(catalogFallbackVisibleRef.current ? billingUnavailableMessage : null);
    } catch (error) {
      if (billingWriteVersionRef.current !== refreshWriteVersion) {
        return;
      }

      const nextSnapshot = buildMissingConfigSnapshot(normalizedCurrentSnapshot);
      await persistSnapshot(nextSnapshot);
      setStatusMessage(
        'Billing could not refresh right now. Your last known access is still active.',
      );
      await reportRuntimeDiagnostic({
        diagnosticsConsentEnabled: privacyPreference.diagnosticsConsentEnabled,
        name: 'billing_refresh_failed',
        payload: {
          feature: 'billing',
          error: getDiagnosticErrorMessage(error),
        },
      });
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, [
    devLaunchPreset,
    loadCatalog,
    localPurchaseE2EEnabled,
    nativeBillingBridgeEnabled,
    isStoreBridgeReady,
    persistSnapshot,
    privacyPreference.diagnosticsConsentEnabled,
    syncBillingState,
  ]);

  const purchasePlan = useCallback(
    async (planId: SubscriptionPlanId) => {
      if (!isHydrated || purchasingPlanIdRef.current || isRestoringRef.current) {
        return;
      }

      if (planId === 'lifetime' && isRefreshingRef.current) {
        return;
      }

      if (planId === 'lifetime' && !isLifetimeTransitionAllowed(snapshotRef.current)) {
        return;
      }

      if (nativeBillingBridgeEnabled && !isStoreBridgeReady) {
        setStatusMessage(billingUnavailableMessage);
        return;
      }

      billingWriteVersionRef.current += 1;
      purchasingPlanIdRef.current = planId;
      setPurchasingPlanId(planId);
      setStatusMessage(null);
      let provisionalSnapshot: BillingSnapshot | undefined;

      try {
        if (localPurchaseE2EEnabled) {
          const plans = catalogPlans.length > 0 ? catalogPlans : buildDevFallbackCatalogPlans();
          const selectedPlan = plans.find((plan) => plan.planId === planId);
          const productId = getPlanConfig(planId) || selectedPlan?.productId;

          if (!selectedPlan || !productId) {
            setStatusMessage(billingUnavailableMessage);
            return;
          }

          const now = new Date(Date.now());
          provisionalSnapshot = buildProvisionalPurchaseSnapshot({
            purchase: buildLocalE2EPurchase({
              plan: selectedPlan,
              productId,
              now,
            }),
            plan: selectedPlan,
            now,
          });
          await persistSnapshot(provisionalSnapshot);
          setStatusMessage('Access updated.');
          return;
        }

        if (devLaunchPreset === 'billing-fallback') {
          const selectedPlan =
            catalogPlans.find((plan) => plan.planId === planId) ??
            buildDevFallbackCatalogPlans().find((plan) => plan.planId === planId);

          if (!selectedPlan) {
            setStatusMessage(billingUnavailableMessage);
            return;
          }

          const nextSnapshot = await persistSnapshot({
            accessState: 'subscribed',
            planId: selectedPlan.planId,
            lastSyncedAt: new Date(Date.now()).toISOString(),
          });

          setStatusMessage(
            `Dev purchase simulated for ${nextSnapshot.planId ?? planId}. Real purchases need native store setup.`,
          );
          return;
        }

        if (!hasNativeBillingConfig()) {
          setStatusMessage(missingBillingConfigMessage);
          return;
        }

        if (!nativeBillingBridgeEnabled) {
          setStatusMessage(billingUnavailableMessage);
          return;
        }

        if (!connectedRef.current) {
          const reconnected = await reconnectRef.current?.();

          if (reconnected === false) {
            setStatusMessage(billingUnavailableMessage);
            return;
          }
        }

        const plans = catalogPlans.length > 0 ? catalogPlans : await loadCatalog();
        const selectedPlan = plans.find((plan) => plan.planId === planId);
        const productId = getPlanConfig(planId);

        if (!selectedPlan || !productId) {
          setStatusMessage(billingUnavailableMessage);
          await reportRuntimeDiagnostic({
            diagnosticsConsentEnabled: privacyPreference.diagnosticsConsentEnabled,
            name: 'billing_purchase_unavailable',
            payload: {
              feature: 'billing',
              planId,
              requestedProductIds: buildConfiguredProductIds(),
              returnedProductCount: plans.length,
            },
          });
          return;
        }

        const purchaseResult = await requestPurchaseRef.current?.(
          selectedPlan.productType === 'subs'
            ? {
                type: 'subs',
                request: {
                  apple: {
                    sku: productId,
                  },
                  google: {
                    skus: [productId],
                    subscriptionOffers: selectedPlan.offerTokenAndroid
                      ? [{ sku: productId, offerToken: selectedPlan.offerTokenAndroid }]
                      : null,
                  },
                },
              }
            : {
                type: 'in-app',
                request: {
                  apple: {
                    sku: productId,
                  },
                  google: {
                    skus: [productId],
                  },
                },
              },
        );

        const purchases = Array.isArray(purchaseResult)
          ? purchaseResult
          : purchaseResult
            ? [purchaseResult]
            : [];

        if (purchases.length === 0) {
          setStatusMessage(purchaseCancelledMessage);
          return;
        }

        const now = new Date(Date.now());
        const selectedPurchase =
          purchases.find((purchase) => purchase.productId === selectedPlan.productId) ??
          purchases[0];
        provisionalSnapshot =
          selectedPurchase != null
            ? buildProvisionalPurchaseSnapshot({
                purchase: selectedPurchase,
                plan: selectedPlan,
                now,
              })
            : undefined;

        for (const purchase of purchases) {
          await finishTransactionRef.current?.({
            purchase,
            isConsumable: false,
          });
        }

        const syncedSnapshot = await syncBillingState(
          provisionalSnapshot ?? snapshotRef.current,
        );
        const nextSnapshot =
          provisionalSnapshot &&
          snapshotUnlocksPaidAccess(provisionalSnapshot) &&
          !snapshotUnlocksPaidAccess(syncedSnapshot)
            ? provisionalSnapshot
            : syncedSnapshot;

        await persistSnapshot(nextSnapshot);
        setStatusMessage(
          nextSnapshot === provisionalSnapshot
            ? 'Purchase recorded. Floriva will check with the store shortly.'
            : 'Access updated.',
        );
      } catch (error) {
        if (
          typeof error === 'object' &&
          error != null &&
          'code' in error &&
          error.code === ErrorCode.UserCancelled
        ) {
          setStatusMessage(purchaseCancelledMessage);
        } else if (provisionalSnapshot && snapshotUnlocksPaidAccess(provisionalSnapshot)) {
          await persistSnapshot(provisionalSnapshot);
          setStatusMessage('Purchase recorded. Floriva will check with the store shortly.');
        } else {
          setStatusMessage('Something went wrong. The purchase did not go through.');
          await reportRuntimeDiagnostic({
            diagnosticsConsentEnabled: privacyPreference.diagnosticsConsentEnabled,
            name: 'billing_purchase_failed',
            payload: {
              feature: 'billing',
              planId,
              error: getDiagnosticErrorMessage(error),
            },
          });
        }
      } finally {
        purchasingPlanIdRef.current = null;
        setPurchasingPlanId(null);
      }
    },
    [
      catalogPlans,
      devLaunchPreset,
      isHydrated,
      isStoreBridgeReady,
      localPurchaseE2EEnabled,
      loadCatalog,
      nativeBillingBridgeEnabled,
      persistSnapshot,
      privacyPreference.diagnosticsConsentEnabled,
      syncBillingState,
    ],
  );

  const startLifetimeTrial = useCallback(async () => {
    // Guard against acting on the default pre-hydration snapshot or racing a
    // native entitlement refresh/purchase/restore write.
    if (
      !isHydrated ||
      isRefreshingRef.current ||
      purchasingPlanIdRef.current ||
      isRestoringRef.current
    ) {
      return;
    }

    // The trial is one-time; a durable marker on the current snapshot blocks re-grants.
    if (!isLifetimeTrialEligible(snapshotRef.current)) {
      return;
    }

    // Bump the write version so any refresh whose derive is mid-flight can't clobber
    // the trial we are about to persist.
    billingWriteVersionRef.current += 1;
    setStatusMessage(null);

    // App-level trial: no store request, no finished transaction — Lifetime is a
    // non-consumable and cannot carry a store trial or auto-charge.
    await persistSnapshot(
      buildLifetimeTrialSnapshot({
        snapshot: snapshotRef.current,
        now: new Date(Date.now()),
      }),
    );
  }, [isHydrated, persistSnapshot]);

  const presentRestorePaywall = useCallback(async () => {
    if (!isHydrated || isRestoringRef.current || purchasingPlanIdRef.current) {
      return;
    }

    if (localPurchaseE2EEnabled) {
      billingWriteVersionRef.current += 1;
      isRestoringRef.current = true;
      setIsRestoring(true);
      setStatusMessage(null);

      try {
        await persistSnapshot(snapshotRef.current);
        setStatusMessage('No previous purchases found for this account.');
      } finally {
        isRestoringRef.current = false;
        setIsRestoring(false);
      }

      return;
    }

    if (nativeBillingBridgeEnabled && !isStoreBridgeReady) {
      setStatusMessage(billingUnavailableMessage);
      return;
    }

    if (!hasNativeBillingConfig()) {
      setStatusMessage(missingBillingConfigMessage);
      return;
    }

    if (!nativeBillingBridgeEnabled) {
      setStatusMessage(billingUnavailableMessage);
      return;
    }

    billingWriteVersionRef.current += 1;
    isRestoringRef.current = true;
    setIsRestoring(true);
    setStatusMessage(null);

    try {
      if (!connectedRef.current) {
        await reconnectRef.current?.();
      }

      await restorePurchasesRef.current?.();
      await loadCatalog();
      const nextSnapshot = await syncBillingState(snapshotRef.current);
      await persistSnapshot(nextSnapshot);

      setStatusMessage(
        nextSnapshot.accessState === 'subscribed' || nextSnapshot.accessState === 'trial_active'
          ? 'Purchases restored.'
          : 'No previous purchases found for this account.',
      );
    } catch {
      setStatusMessage('Something went wrong. Purchases could not be restored.');
    } finally {
      isRestoringRef.current = false;
      setIsRestoring(false);
    }
  }, [
    isHydrated,
    isStoreBridgeReady,
    loadCatalog,
    localPurchaseE2EEnabled,
    nativeBillingBridgeEnabled,
    persistSnapshot,
    syncBillingState,
  ]);

  const redeemSaveOffer = useCallback(
    async (offer: SaveOffer): Promise<RedeemResult> => {
      if (!isHydrated) {
        return {
          status: 'failed',
          message: billingUnavailableMessage,
        };
      }

      // The provider only wires store deps to the redemption domain logic and
      // persists the redeemed flag on success; it owns no redemption policy.
      const requestAndroidSaveOffer = async (offerId: string) => {
        const productId = getPlanConfig(offer.planId);
        const plans = catalogPlans.length > 0 ? catalogPlans : await loadCatalog();
        const selectedPlan = plans.find((plan) => plan.productId === productId);
        const offerToken = selectedPlan?.androidOfferTokensById?.[offerId];

        if (!productId || !offerToken) {
          // Android save-offer products are unprovisioned in dev, so the catalog
          // has no matching offer token. Throw so redeemSaveOffer reports failure.
          throw new Error(`No Android offer token for save offer ${offerId}.`);
        }

        const requestPurchase = requestPurchaseRef.current;

        if (!requestPurchase) {
          throw new Error('Android billing is not available for save-offer redemption.');
        }

        await requestPurchase({
          type: 'subs',
          request: {
            google: {
              skus: [productId],
              subscriptionOffers: [{ sku: productId, offerToken }],
            },
          },
        });
      };

      const result = await runRedeemSaveOffer(offer, {
        e2e: localPurchaseE2EEnabled,
        copyOfferCode: async (offerCode) => {
          await setStringAsync(offerCode);
        },
        presentCodeRedemptionSheetIOS: async () => {
          await presentCodeRedemptionSheetIOS();
        },
        requestAndroidOffer: requestAndroidSaveOffer,
      });

      if (result.status === 'redeemed') {
        await persistSnapshot({
          ...snapshotRef.current,
          saveOfferRedeemedAt: new Date(Date.now()).toISOString(),
        });
      }

      return result;
    },
    [catalogPlans, isHydrated, loadCatalog, localPurchaseE2EEnabled, persistSnapshot],
  );

  useEffect(() => {
    let isCancelled = false;

    async function hydrate() {
      const storedSnapshot = await billingSnapshotRepositoryRef.current.getSnapshot();

      if (isCancelled) {
        return;
      }

      snapshotRef.current = storedSnapshot;
      setSnapshot(storedSnapshot);
      setManagementUrl(getManageSubscriptionUrlFallback());
      applyBillingSnapshotRef.current(storedSnapshot);

      setIsHydrated(true);
    }

    void hydrate();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    void refreshBilling();
  }, [isHydrated, refreshBilling, isStoreBridgeReady]);

  // The Lifetime trial can only be offered when the plan exists in the catalog, the
  // user has not already used it (or bought Lifetime), and recurring access is safe to leave.
  const lifetimeTrialEligible =
    isLifetimeTrialEligible(snapshot) &&
    offerings.some((offering) => offering.planId === 'lifetime');

  const value = useMemo<BillingContextValue>(
    () => ({
      isHydrated,
      isSyncing,
      isRefreshing,
      isRestoring,
      purchasingPlanId,
      statusMessage,
      snapshot,
      managementUrl,
      offerings,
      lifetimeTrialEligible,
      purchasePlan,
      startLifetimeTrial,
      presentRestorePaywall,
      openManageSubscriptions: async () => {
        await Linking.openURL(managementUrl ?? getManageSubscriptionUrlFallback());
      },
      refreshBilling,
      redeemSaveOffer,
    }),
    [
      isHydrated,
      isSyncing,
      isRefreshing,
      isRestoring,
      lifetimeTrialEligible,
      managementUrl,
      offerings,
      presentRestorePaywall,
      purchasePlan,
      purchasingPlanId,
      redeemSaveOffer,
      refreshBilling,
      snapshot,
      startLifetimeTrial,
      statusMessage,
    ],
  );

  return (
    <BillingContext.Provider value={value}>
      {nativeBillingBridgeEnabled ? (
        <BillingStoreBridge
          diagnosticsConsentEnabled={privacyPreference.diagnosticsConsentEnabled}
          onConnectionChange={handleConnectionChange}
        />
      ) : null}
      {children}
    </BillingContext.Provider>
  );
}

export function useBilling() {
  const context = useContext(BillingContext);

  if (!context) {
    throw new Error('useBilling must be used within BillingProvider');
  }

  return context;
}
