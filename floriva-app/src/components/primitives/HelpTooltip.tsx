import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useState } from 'react';

import { Text } from '@/src/components/primitives/Text';
import { GlassSurface } from '@/src/components/primitives/GlassSurface';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type HelpTooltipProps = {
  title: string;
  body: string;
  closeLabel?: string;
  accessibilityLabel?: string;
  testID?: string;
};

export function HelpTooltip({
  title,
  body,
  closeLabel = 'Close',
  accessibilityLabel,
  testID,
}: HelpTooltipProps) {
  const [visible, setVisible] = useState(false);
  const theme = useFlorivaTheme();
  const styles = createStyles(theme);
  const openHelp = () => setVisible(true);
  const closeHelp = () => setVisible(false);

  return (
    <>
      <Pressable
        accessibilityHint={body}
        accessibilityLabel={accessibilityLabel ?? `Help: ${title}`}
        accessibilityRole="button"
        hitSlop={10}
        onPress={openHelp}
        style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
        testID={testID}
      >
        <FontAwesome
          color={theme.colors.textSecondary}
          name="info-circle"
          size={15}
        />
      </Pressable>
      <Modal
        animationType="slide"
        onRequestClose={closeHelp}
        transparent
        visible={visible}
      >
        <View style={styles.backdrop}>
          <Pressable
            accessibilityLabel={closeLabel}
            accessibilityRole="button"
            style={StyleSheet.absoluteFill}
            onPress={closeHelp}
          />
          <GlassSurface
            accessibilityRole="summary"
            material="regular"
            tint={theme.glass.tint.regular}
            radius={0}
            style={styles.sheet}
            testID={testID ? `${testID}-sheet` : 'help-tooltip-sheet'}
          >
            <View style={styles.handle} />
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={closeHelp}
              style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
            >
              <Text style={styles.closeText}>{closeLabel}</Text>
            </Pressable>
          </GlassSurface>
        </View>
      </Modal>
    </>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    trigger: {
      alignItems: 'center',
      justifyContent: 'center',
      // VF-10c: 28px disc (was 32) sits better beside the ~26px serif headline
      // without over-weighting it; hitSlop={10} keeps a 48px touch target.
      width: 28,
      height: 28,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.surfaceMuted,
      overflow: 'hidden',
    },
    triggerPressed: {
      opacity: 0.72,
    },
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(34, 24, 26, 0.36)',
    },
    sheet: {
      gap: theme.spacing.md,
      padding: theme.spacing.xl,
      paddingBottom: theme.spacing.xxl,
      borderTopLeftRadius: theme.radii.xl,
      borderTopRightRadius: theme.radii.xl,
      // No solid background: the GlassSurface provides the fill — a Liquid Glass
      // sheet on iOS 26, a solid paper fallback elsewhere — so the sheet reads
      // as a floating overlay over the dimmed content behind it.
    },
    handle: {
      alignSelf: 'center',
      width: 42,
      height: 4,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.borderPrimary,
    },
    title: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.title.fontFamily,
      fontSize: 22,
      lineHeight: 28,
    },
    body: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.body.fontFamily,
      fontSize: 15,
      lineHeight: 22,
    },
    closeButton: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.accentPrimary,
    },
    closeButtonPressed: {
      opacity: 0.82,
    },
    closeText: {
      color: theme.colors.buttonPrimaryText,
      fontFamily: theme.typography.bodyStrong.fontFamily,
      fontSize: 15,
      fontWeight: '700',
    },
  });
}
