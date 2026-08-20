import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { ActionButton } from '@/src/components/primitives/ActionButton';
import { Screen } from '@/src/components/primitives/Screen';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import { useAppShell } from '@/src/features/app-shell/AppShellProvider';
import { resolveAppEntry } from '@/src/features/app-shell/resolveAppEntry';
import { getBiometricMethodsLabel } from '@/src/features/privacy/biometricMethodsLabel';
import { authenticateBiometricUnlock } from '@/src/lib/security/biometricLock';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import { testIds } from '@/src/testing/testIds';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

export function LockScreen() {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t, resolvedLocale } = useLocalization();
  const biometric = getBiometricMethodsLabel(resolvedLocale);
  // UL-74: the methods label is written for mid-sentence use ("fingerprint,
  // face unlock, …" on Android). As a standalone metric value it takes
  // sentence case, otherwise it reads like a typo on the trust screen.
  const biometricStandalone =
    biometric.charAt(0).toLocaleUpperCase(resolvedLocale) + biometric.slice(1);
  const { state, unlockApp } = useAppShell();
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [statusKind, setStatusKind] = useState<'unavailable' | 'cancelled' | 'failure' | null>(
    null,
  );
  const statusTitle =
    statusKind === 'unavailable'
      ? t('privacy.lock.statusTitles.unavailable')
      : statusKind === 'cancelled'
        ? t('privacy.lock.statusTitles.cancelled')
        : statusKind
          ? t('privacy.lock.statusTitles.failure')
          : null;
  const statusMessage =
    statusKind === 'unavailable'
      ? t('privacy.lock.unavailableBody', { biometric })
      : statusKind === 'cancelled'
        ? t('privacy.lock.cancelledBody')
        : statusKind
          ? t('privacy.lock.failureBody')
          : null;

  return (
    <Screen
      eyebrow={t('privacy.lock.eyebrow')}
      motionVariant="sensitive"
      title={t('privacy.lock.title')}
      description={t('privacy.lock.description', { biometric })}
      testID={testIds.lock.screen}
      /* UL-38: the unlock action anchors to the bottom action bar instead of
         stranding mid-screen under the top-heavy content column. */
      footerPlacement="fixed"
      footer={
        <ActionButton
          disabled={isUnlocking}
          onPress={async () => {
            if (isUnlocking) {
              return;
            }

            setIsUnlocking(true);
            try {
              const result = await authenticateBiometricUnlock();

              if (result.success) {
                setStatusKind(null);
                unlockApp();
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace(
                    resolveAppEntry({
                      ...state,
                      isLocked: false,
                    }),
                  );
                }
                return;
              }

              if (result.error === 'not_available') {
                setStatusKind('unavailable');
                return;
              }

              if (
                result.error === 'user_cancel' ||
                result.error === 'app_cancel' ||
                result.error === 'system_cancel' ||
                result.error === 'user_fallback'
              ) {
                setStatusKind('cancelled');
                return;
              }

              setStatusKind('failure');
            } catch {
              setStatusKind('failure');
            } finally {
              setIsUnlocking(false);
            }
          }}
          testID={testIds.lock.unlockButton}
        >
          {isUnlocking ? t('privacy.lock.unlocking') : t('privacy.lock.unlockButtonLabel')}
        </ActionButton>
      }
    >
      <SectionCard
        title={t('privacy.lock.localUnlock.title')}
        description={t('privacy.lock.localUnlock.body')}
      >
        <View style={styles.metricRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>
              {t('privacy.lock.metrics.unlockPathLabel')}
            </Text>
            <Text style={styles.metricValue}>
              {t('privacy.lock.metrics.unlockPathValue', {
                biometric: biometricStandalone,
              })}
            </Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>
              {t('privacy.lock.metrics.recoveryPathLabel')}
            </Text>
            <Text style={styles.metricValue}>
              {t('privacy.lock.metrics.recoveryPathValue')}
            </Text>
          </View>
        </View>
        {/* UL-18: the page subtitle already states the unlock instruction —
            it is not repeated verbatim inside this card. */}
        {statusMessage && statusTitle ? (
          <View
            accessibilityRole="alert"
            style={[
              styles.statusPanel,
              statusKind === 'unavailable'
                ? styles.statusPanelUnavailable
                : null,
            ]}
            testID={testIds.lock.statusAlert}
          >
            <Text style={styles.statusTitle}>{statusTitle}</Text>
            <Text style={styles.statusBody}>{statusMessage}</Text>
            {statusKind === 'unavailable' ? (
              <Text style={styles.statusHint}>
                {t('privacy.lock.statusHints.unavailable', { biometric })}
              </Text>
            ) : (
              <Text style={styles.statusHint}>
                {t('privacy.lock.statusHints.generic')}
              </Text>
            )}
          </View>
        ) : null}
        {statusKind === 'unavailable' ? (
          <ActionButton
            appearance="secondary"
            onPress={async () => {
              try {
                await Linking.openSettings();
              } catch {
                setStatusKind('failure');
              }
            }}
            testID={testIds.lock.recoveryButton}
          >
            {t('privacy.lock.openDeviceSettings')}
          </ActionButton>
        ) : null}
      </SectionCard>
    </Screen>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    metricRow: {
      flexDirection: 'column',
      gap: theme.spacing.sm,
    },
    metricCard: {
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: theme.colors.borderPrimary,
    },
    metricLabel: {
      color: theme.colors.textTertiary,
      ...theme.typography.eyebrow,
    },
    metricValue: {
      color: theme.colors.textPrimary,
      ...theme.typography.bodyStrong,
    },
    statusPanel: {
      gap: theme.spacing.xs,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: theme.colors.borderPrimary,
    },
    statusPanelUnavailable: {
      backgroundColor: theme.colors.accentSoft,
    },
    statusTitle: {
      color: theme.colors.textPrimary,
      ...theme.typography.bodyStrong,
    },
    statusBody: {
      color: theme.colors.textPrimary,
      ...theme.typography.body,
    },
    statusHint: {
      color: theme.colors.textSecondary,
      ...theme.typography.caption,
    },
  });
}
