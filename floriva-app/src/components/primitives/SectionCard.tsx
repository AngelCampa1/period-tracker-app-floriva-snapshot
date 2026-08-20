import { useMemo, type PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { MotionView } from '@/src/features/motion/MotionView';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type SectionCardProps = PropsWithChildren<{
  title?: string;
  description?: string;
  presentation?: 'card' | 'grouped' | 'unframed';
  variant?: 'default' | 'subtle' | 'emphasis';
  density?: 'default' | 'compact';
  /** VF-5: `danger` tints the section title with the danger tone so a
   *  destructive zone (e.g. delete-all-data) reads as such rather than as a
   *  neutral ink heading. Presentation-only; defaults to the ink title. */
  titleTone?: 'default' | 'danger';
  testID?: string;
  reducedMotionEnabled?: boolean;
}>;

export function SectionCard({
  children,
  density = 'default',
  description,
  presentation = 'card',
  variant = 'default',
  titleTone = 'default',
  testID,
  title,
  reducedMotionEnabled,
}: SectionCardProps) {
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const content = (
    <>
      {title || description ? (
        <View style={styles.header}>
          {title ? (
            <Text style={[styles.title, titleTone === 'danger' ? styles.titleDanger : null]}>
              {title}
            </Text>
          ) : null}
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>
      ) : null}
      {children}
    </>
  );

  return (
    <MotionView
      preset={variant === 'emphasis' ? 'heroBloom' : 'cardReveal'}
      reducedMotionEnabled={reducedMotionEnabled}
      testID={testID}
    >
      <View
        style={[
          styles.cardShell,
          styles.solidCard,
          presentation === 'grouped' ? styles.groupedCard : null,
          presentation === 'unframed' ? styles.unframedCard : null,
          variant === 'subtle' ? styles.subtleCard : null,
          variant === 'emphasis' ? styles.emphasisCard : null,
        ]}
        testID={testID}
      >
        <View
          style={[
            styles.cardContent,
            presentation === 'unframed' ? styles.unframedContent : null,
            density === 'compact' ? styles.cardContentCompact : null,
          ]}
        >
          {content}
        </View>
      </View>
    </MotionView>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    cardShell: {
      borderRadius: theme.radii.lg,
    },
    solidCard: {
      backgroundColor: theme.colors.surfacePrimary,
      borderWidth: 1,
      borderColor: theme.colors.borderPrimary,
    },
    groupedCard: {
      overflow: 'hidden',
      borderWidth: 0,
      backgroundColor: theme.colors.surfacePrimary,
    },
    unframedCard: {
      borderWidth: 0,
      backgroundColor: 'transparent',
    },
    subtleCard: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
    },
    emphasisCard: {
      backgroundColor: theme.colors.buttonGlassFill,
      borderColor: theme.colors.borderStrong,
    },
    cardContent: {
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
    },
    cardContentCompact: {
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
    },
    unframedContent: {
      padding: 0,
    },
    header: {
      gap: theme.spacing.sm,
    },
    title: {
      color: theme.colors.textPrimary,
      ...theme.typography.subtitle,
    },
    titleDanger: {
      color: theme.colors.danger,
    },
    description: {
      color: theme.colors.textSecondary,
      ...theme.typography.caption,
    },
  });
}
