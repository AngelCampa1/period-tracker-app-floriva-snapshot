import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type PaywallTrialTimelineProps = {
  testID?: string;
};

type TimelineStepKey = 'today' | 'reminder' | 'charge';

// Relative labels only - the intro offer is a calendar "1 month", not a fixed
// number of days, and the store-reported trial length is not surfaced on the
// offering. Asserting a concrete charge day (e.g. "Day 30") would be a free-trial
// disclosure the implementation cannot guarantee, so the steps stay
// duration-agnostic (honest-claims rule).
const STEP_LABEL_KEY: Record<TimelineStepKey, string> = {
  today: 'billing.timeline.today',
  reminder: 'billing.timeline.reminderLabel',
  charge: 'billing.timeline.chargeLabel',
};

const STEP_BODY_KEY: Record<TimelineStepKey, string> = {
  today: 'billing.timeline.todayBody',
  reminder: 'billing.timeline.reminderBody',
  charge: 'billing.timeline.chargeBody',
};

const TIMELINE_STEPS: TimelineStepKey[] = ['today', 'reminder', 'charge'];

export function PaywallTrialTimeline({ testID }: PaywallTrialTimelineProps) {
  const theme = useFlorivaTheme();
  const { t } = useLocalization();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.title}>{t('billing.timeline.title')}</Text>
      <View style={styles.steps}>
        {TIMELINE_STEPS.map((stepKey, index) => {
          const isLast = index === TIMELINE_STEPS.length - 1;

          return (
            <View key={stepKey} style={styles.step}>
              <View style={styles.rail}>
                <View style={styles.dot} />
                {isLast ? null : <View style={styles.line} />}
              </View>
              <View style={styles.stepBody}>
                <Text style={styles.stepLabel}>{t(STEP_LABEL_KEY[stepKey])}</Text>
                <Text style={styles.stepText}>{t(STEP_BODY_KEY[stepKey])}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.md,
    },
    title: {
      color: theme.colors.textPrimary,
      ...theme.typography.subtitle,
    },
    steps: {
      gap: theme.spacing.xs,
    },
    step: {
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    rail: {
      alignItems: 'center',
      width: 12,
    },
    dot: {
      width: 12,
      height: 12,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.accentPrimary,
      marginTop: 4,
    },
    line: {
      flex: 1,
      width: 2,
      backgroundColor: theme.colors.borderPrimary,
      marginTop: 2,
    },
    stepBody: {
      flex: 1,
      gap: 2,
      paddingBottom: theme.spacing.md,
    },
    stepLabel: {
      color: theme.colors.textPrimary,
      ...theme.typography.bodyStrong,
    },
    stepText: {
      color: theme.colors.textSecondary,
      ...theme.typography.caption,
    },
  });
}
