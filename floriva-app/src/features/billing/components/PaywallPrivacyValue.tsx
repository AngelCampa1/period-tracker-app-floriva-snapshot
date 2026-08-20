import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type PaywallPrivacyValueProps = {
  testID?: string;
};

const VALUE_POINT_KEYS = [
  'billing.value.onDevice',
  'billing.value.noAccount',
  'billing.value.noAds',
  'billing.value.noSelling',
] as const;

export function PaywallPrivacyValue({ testID }: PaywallPrivacyValueProps) {
  const theme = useFlorivaTheme();
  const { t } = useLocalization();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.eyebrow}>{t('billing.value.eyebrow')}</Text>
      <Text style={styles.body}>{t('billing.value.body')}</Text>
      <View style={styles.points}>
        {VALUE_POINT_KEYS.map((key) => (
          <View key={key} style={styles.point}>
            <View style={styles.bullet} />
            <Text style={styles.pointText}>{t(key)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.sm,
    },
    eyebrow: {
      color: theme.colors.textSecondary,
      ...theme.typography.eyebrow,
    },
    body: {
      color: theme.colors.textPrimary,
      ...theme.typography.bodyStrong,
    },
    points: {
      gap: theme.spacing.xs,
      marginTop: theme.spacing.xs,
    },
    point: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    bullet: {
      width: 6,
      height: 6,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.accentPrimary,
    },
    pointText: {
      color: theme.colors.textSecondary,
      ...theme.typography.body,
    },
  });
}
