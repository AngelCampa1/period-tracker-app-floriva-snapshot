import type { Href } from 'expo-router';
import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { Screen } from '@/src/components/primitives/Screen';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import { getBiometricMethodsLabel } from '@/src/features/privacy/biometricMethodsLabel';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import { testIds } from '@/src/testing/testIds';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type PrivacyExplainerScreenProps = {
  backHref?: string;
  backLabel?: string;
};

export function PrivacyExplainerScreen({
  backHref = '/settings',
  backLabel,
}: PrivacyExplainerScreenProps) {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t, resolvedLocale } = useLocalization();
  const biometric = getBiometricMethodsLabel(resolvedLocale);
  const resolvedBackLabel =
    backLabel ??
    (backHref.endsWith('/welcome')
      ? t('privacy.explainer.backToWelcome')
      : t('privacy.explainer.backToSettings'));

  return (
    <Screen
      backAction={{
        label: resolvedBackLabel,
        onPress: () => {
          if (router.canGoBack()) {
            router.back();
            return;
          }

          router.replace(backHref as Href);
        },
        testID: testIds.privacy.explainerBackButton,
      }}
      eyebrow={t('privacy.promise.eyebrow')}
      title={t('privacy.promise.title')}
      description={t('privacy.promise.body')}
      testID={testIds.privacy.explainerScreen}
    >
      <SectionCard
        title={t('privacy.explainer.whatFlorivaPromises')}
        description={t('privacy.promise.footnote')}
      >
        <View style={styles.pillars}>
          {[
            t('privacy.promise.pillars.onDevice'),
            t('privacy.promise.pillars.noAccount'),
            t('privacy.promise.pillars.localImports'),
          ].map((pillar) => (
            <Text key={pillar} style={styles.pillar}>
              {pillar}
            </Text>
          ))}
        </View>
      </SectionCard>

      <SectionCard
        title={t('privacy.explainer.deviceStorage.title')}
        description={t('privacy.explainer.deviceStorage.body')}
        presentation="unframed"
      >
        <Text style={styles.detail}>{t('privacy.explainer.imports.body')}</Text>
      </SectionCard>
      <SectionCard title={t('privacy.explainer.deviceSecurity.title')} presentation="unframed">
        <Text style={styles.detail}>
          {t('privacy.explainer.deviceSecurity.body', { biometric })}
        </Text>
      </SectionCard>
      <SectionCard title={t('privacy.explainer.deleteLocalData.title')} presentation="unframed">
        <View style={styles.group}>
          <Text style={styles.detail}>{t('privacy.explainer.deleteLocalData.body')}</Text>
          <Text style={styles.groupTitle}>{t('privacy.explainer.uninstalling.title')}</Text>
          <Text style={styles.detail}>{t('privacy.explainer.uninstalling.body')}</Text>
        </View>
      </SectionCard>
    </Screen>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    pillars: {
      gap: theme.spacing.sm,
    },
    pillar: {
      color: theme.colors.textSecondary,
      ...theme.typography.body,
    },
    group: {
      gap: theme.spacing.sm,
    },
    groupTitle: {
      color: theme.colors.textPrimary,
      ...theme.typography.bodyStrong,
    },
    detail: {
      color: theme.colors.textSecondary,
      ...theme.typography.body,
    },
  });
}
