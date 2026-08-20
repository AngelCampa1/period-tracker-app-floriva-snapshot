import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import type { Anomaly } from '@/src/lib/predictions/anomalyPresentation';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import { testIds } from '@/src/testing/testIds';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type AnomalyNudgeProps = {
  anomaly: Anomaly;
  onDismiss: (anomalyId: string) => void;
};

/**
 * Engine-independent presentation scaffold (B4) for surfacing a single
 * cycle anomaly (short/long cycle, prolonged bleeding, a missed expected
 * period) as a calm, non-diagnostic nudge.
 *
 * Purely presentational, mirroring the `NoRemindersNudge` precedent
 * (src/features/tracker/components/NoRemindersNudge.tsx): this component
 * does not read or write `AppPreferences.dismissedAnomalyIds` itself, nor
 * does it decide which anomaly (if any) to show. It only renders the
 * `Anomaly` it's given and calls `onDismiss(anomaly.id)` when the user
 * dismisses it -- the parent screen owns persistence, exactly like
 * `TodayScreen` owns `NoRemindersNudge`'s dismissal. Not wired into any
 * screen yet; B5 will do that once A6 supplies real detected anomalies.
 *
 * Placed under `src/components/primitives` (not `src/features/tracker`) to
 * match `ConfidenceImprovementList`'s precedent of shared, prediction-
 * adjacent UI living in primitives rather than being owned by one feature.
 */
export function AnomalyNudge({ anomaly, onDismiss }: AnomalyNudgeProps) {
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useLocalization();

  const title = t(`predictions.anomalies.${anomaly.kind}.title` as never);
  const body = t(`predictions.anomalies.${anomaly.kind}.body` as never);
  const clinicianNote = t('predictions.anomalies.common.clinicianNote');
  const dismissLabel = t('predictions.anomalies.common.dismissLabel');
  // Locale-aware sentence joiner: a space for Latin/Cyrillic locales, an
  // empty string for ja/zh-Hans, which do not separate sentences with spaces.
  const sentenceJoiner = t('predictions.anomalies.common.sentenceJoiner');

  return (
    <View style={styles.wrapper} testID={testIds.anomalyNudge.wrapper}>
      <View style={styles.iconWrap}>
        <View style={styles.iconDot} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.bodyText}>{`${body}${sentenceJoiner}${clinicianNote}`}</Text>
      </View>
      <Pressable
        accessibilityLabel={dismissLabel}
        accessibilityRole="button"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        onPress={() => onDismiss(anomaly.id)}
        style={styles.dismiss}
        testID={testIds.anomalyNudge.dismissButton}
      >
        <Text style={styles.dismissText}>×</Text>
      </Pressable>
    </View>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    wrapper: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.md,
      marginTop: theme.spacing.md,
    },
    iconWrap: {
      width: 22,
      height: 22,
      borderRadius: theme.radii.pill,
      borderWidth: 1.5,
      borderColor: theme.colors.accentPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    iconDot: {
      width: 6,
      height: 6,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.accentPrimary,
    },
    body: {
      flex: 1,
      gap: 4,
    },
    title: {
      ...theme.typography.bodyStrong,
      color: theme.colors.textPrimary,
    },
    bodyText: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    dismiss: {
      paddingHorizontal: 4,
    },
    dismissText: {
      fontSize: 22,
      lineHeight: 22,
      color: theme.colors.textSecondary,
    },
  });
}
