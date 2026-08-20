import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, View, StyleSheet } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import { testIds } from '@/src/testing/testIds';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';
import type { ConfidenceImprovement, ConfidenceReasonCode } from '@/src/types/domain';

type ConfidenceImprovementListProps = {
  improvements: ConfidenceImprovement[];
};

/**
 * Renders `PredictionSnapshot.improvements` (or the equivalent
 * `improvements` field on the Calendar/Insights screen models) as a stack of
 * rows. Rows carrying an `action.href` are tappable buttons that route there
 * (e.g. today's log entry); rows without an action render as plain, inert
 * text.
 *
 * Shared under `src/components/primitives` because it is consumed by
 * multiple features (Today, Calendar, Insights) rather than owned by any one
 * of them.
 *
 * Labels are resolved directly from the localized
 * `predictions.confidence.reasons.*` catalog by reason `code` (see
 * `src/localization/messages/predictions.ts`). The catalog is exhaustive
 * over `confidenceReasonCodeValues` (enforced by
 * `tests/localization/predictionsMessages.test.ts`), and the engine only
 * ever emits codes from that same set (see
 * `src/lib/predictions/confidenceImprovements.ts`), so this lookup can never
 * miss — there is no fallback branch.
 */
export function ConfidenceImprovementList({ improvements }: ConfidenceImprovementListProps) {
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { t } = useLocalization();

  if (improvements.length === 0) {
    return null;
  }

  return (
    <View style={styles.list} testID={testIds.confidenceImprovementList.list}>
      {improvements.map((improvement) => (
        <ImprovementRow
          key={improvement.code}
          improvement={improvement}
          onNavigate={(href) => router.push(href as never)}
          resolveLabel={(code) => t(`predictions.confidence.reasons.${code}` as never)}
          styles={styles}
        />
      ))}
    </View>
  );
}

type ImprovementRowProps = {
  improvement: ConfidenceImprovement;
  onNavigate: (href: string) => void;
  resolveLabel: (code: ConfidenceReasonCode) => string;
  styles: ReturnType<typeof createStyles>;
};

function ImprovementRow({ improvement, onNavigate, resolveLabel, styles }: ImprovementRowProps) {
  const label = resolveLabel(improvement.code);
  const testID = testIds.confidenceImprovementList.row(improvement.code);

  // `attachImprovementActions` currently sets `action` on every improvement
  // it builds, so this branch is unreachable in production today. Kept
  // because `action` is intentionally optional on `ConfidenceImprovement`
  // (see src/types/domain.ts) for a future improvement code with nothing
  // actionable to route to -- this is that code's inert rendering path.
  if (!improvement.action) {
    return (
      <View style={styles.row} testID={testID}>
        <Text style={styles.rowText}>{label}</Text>
      </View>
    );
  }

  const href = improvement.action.href;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={{ top: 11, bottom: 11, left: 8, right: 8 }}
      onPress={() => onNavigate(href)}
      style={({ pressed }) => [styles.row, styles.tappableRow, pressed && styles.rowPressed]}
      testID={testID}
    >
      <Text style={[styles.rowText, styles.tappableRowText]}>{label}</Text>
      <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.chevron}>
        {'›'}
      </Text>
    </Pressable>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    list: {
      gap: 4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 2,
    },
    tappableRow: {
      gap: theme.spacing.xs,
    },
    rowPressed: {
      opacity: 0.72,
    },
    rowText: {
      flex: 1,
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
    tappableRowText: {
      color: theme.colors.accentPrimary,
      textDecorationLine: 'underline',
    },
    chevron: {
      color: theme.colors.accentPrimary,
      ...theme.typography.caption,
    },
  });
}
