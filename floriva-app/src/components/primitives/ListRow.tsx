import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { ComponentProps } from 'react';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { usePressFeedback } from '@/src/features/feedback/usePressFeedback';
import { MotionView } from '@/src/features/motion/MotionView';
import { useFlorivaMotion } from '@/src/features/motion/useFlorivaMotion';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type ListRowProps = {
  title: string;
  summary?: string;
  onPress: () => void;
  testID?: string;
  iconName?: ComponentProps<typeof FontAwesome>['name'];
  isLastInGroup?: boolean;
  kind?: 'navigation' | 'destructive';
  trailingAccessory?: 'chevron' | 'label' | 'none';
  trailingLabel?: string;
  reducedMotionEnabled?: boolean;
};

export function ListRow({
  iconName,
  isLastInGroup = false,
  kind = 'navigation',
  onPress,
  summary,
  testID,
  title,
  trailingAccessory = 'chevron',
  trailingLabel = 'Open',
  reducedMotionEnabled,
}: ListRowProps) {
  const theme = useFlorivaTheme();
  const florivaMotion = useFlorivaMotion(reducedMotionEnabled);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const handlePress = usePressFeedback(onPress);
  const [isPressed, setIsPressed] = useState(false);
  const titleStyle = kind === 'destructive' ? styles.titleDestructive : styles.title;
  const summaryStyle = kind === 'destructive' ? styles.summaryDestructive : styles.summary;

  return (
    <MotionView preset="rowShift" testID={testID}>
      <Pressable
        accessibilityRole="button"
        onPress={handlePress}
        onPressIn={() => {
          setIsPressed(true);
        }}
        onPressOut={() => {
          setIsPressed(false);
        }}
        style={[
          styles.row,
          isPressed ? styles.rowPressed : null,
          isPressed && !florivaMotion.reducedMotionEnabled ? styles.rowPressedMotion : null,
          isLastInGroup ? styles.rowLastInGroup : null,
        ]}
        testID={testID}
      >
        {iconName ? (
          <View
            accessibilityElementsHidden
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            style={styles.iconFrame}
            testID={testID ? `${testID}-icon-frame` : undefined}
          >
            <FontAwesome color={theme.colors.accentPrimary} name={iconName} size={15} />
          </View>
        ) : null}
        <View style={styles.copy}>
          <Text style={titleStyle}>{title}</Text>
          {summary ? <Text style={summaryStyle}>{summary}</Text> : null}
        </View>
        {trailingAccessory === 'label' ? <Text style={styles.trailingLabel}>{trailingLabel}</Text> : null}
        {trailingAccessory === 'chevron' ? (
          <View
            accessibilityElementsHidden
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          >
            <FontAwesome color={theme.colors.textTertiary} name="angle-right" size={18} />
          </View>
        ) : null}
      </Pressable>
    </MotionView>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.lg,
      minHeight: 72,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderPrimary,
    },
    rowPressed: {
      opacity: 0.92,
    },
    rowPressedMotion: {
      transform: [{ translateX: 2 }],
    },
    rowLastInGroup: {
      borderBottomWidth: 0,
    },
    iconFrame: {
      width: 32,
      height: 32,
      borderRadius: theme.radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.buttonQuietFill,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xs,
    },
    title: {
      color: theme.colors.textPrimary,
      ...theme.typography.bodyStrong,
    },
    summary: {
      color: theme.colors.textSecondary,
      ...theme.typography.caption,
    },
    titleDestructive: {
      color: theme.colors.danger,
      ...theme.typography.bodyStrong,
    },
    summaryDestructive: {
      color: theme.colors.textSecondary,
      ...theme.typography.caption,
    },
    trailingLabel: {
      flexShrink: 0,
      color: theme.colors.accentPrimary,
      ...theme.typography.caption,
    },
  });
}
