import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { testIds } from '@/src/testing/testIds';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type PrivacyPolicyModalProps = {
  visible: boolean;
  onClose: () => void;
};

type PolicySection = {
  title: string;
  body?: string[];
  bullets?: string[];
};

const policySections: PolicySection[] = [
  {
    title: 'Summary',
    body: [
      'Floriva is a period tracker built for privacy. It stores your cycle logs, reminders, lock settings, and other tracking data on your device. No account is required to use the app.',
    ],
  },
  {
    title: 'What Floriva stores',
    bullets: [
      'cycle history',
      'period, symptom, mood, trying-to-conceive, and birth-control logs',
      'reminder preferences',
      'privacy-lock preferences',
      'import session metadata',
      'local subscription status (used to check access on this device)',
    ],
  },
  {
    title: 'What Floriva does not do',
    bullets: [
      'no cloud sync',
      'no social or partner-sharing features',
      'no advertising SDKs',
      'no reproductive-health analytics SDKs',
      'no sale of reproductive-health data',
    ],
  },
  {
    title: 'Diagnostics',
    body: [
      'Diagnostics are off by default. If you turn them on, Floriva keeps only technical app-health data, with personal details removed, on this device. A future version may add a separate opt-in way to send it. Notes, symptoms, moods, trying-to-conceive observations, birth-control details, freeform text, and other reproductive-health data are never included in diagnostics.',
    ],
  },
  {
    title: 'Subscription and billing',
    body: [
      'Floriva uses App Store and Google Play billing. It does not run its own billing backend.',
      'Billing data is separate from your reproductive-health records. Floriva uses your subscription state only to check whether paid access is active on this device.',
    ],
  },
  {
    title: 'Imports and exports',
    body: [
      'Imports only read the file you choose. Floriva does not scan your storage or upload import files.',
    ],
  },
  {
    title: 'Deleting your data',
    body: [
      'Deleting all local data removes the app data stored on this device. Uninstalling the app can permanently remove local data.',
    ],
  },
  {
    title: 'Not medical advice',
    body: [
      'Floriva provides tracking and predictions. It does not provide diagnosis, treatment, or medical advice.',
    ],
  },
];

export function PrivacyPolicyModal({ visible, onClose }: PrivacyPolicyModalProps) {
  const theme = useFlorivaTheme();
  const styles = createStyles(theme);

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View
          accessibilityViewIsModal
          style={styles.sheet}
          testID={testIds.privacy.policyModal}
        >
          <View style={styles.header}>
            <View style={styles.titleStack}>
              <Text style={styles.eyebrow}>App privacy</Text>
              <Text style={styles.title}>Privacy policy</Text>
            </View>
            <Pressable
              accessibilityLabel="Close privacy policy"
              accessibilityRole="button"
              onPress={onClose}
              style={styles.closeButton}
              testID={testIds.privacy.policyModalCloseButton}
            >
              <Text accessible={false} style={styles.closeButtonText}>
                Close
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {policySections.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.body?.map((paragraph) => (
                  <Text key={paragraph} style={styles.body}>
                    {paragraph}
                  </Text>
                ))}
                {section.bullets ? (
                  <View style={styles.bulletList}>
                    {section.bullets.map((bullet) => (
                      <View key={bullet} style={styles.bulletRow}>
                        <Text style={styles.bulletMarker}>{'\u2022'}</Text>
                        <Text style={styles.bulletText}>{bullet}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(18, 22, 20, 0.42)',
    },
    sheet: {
      maxHeight: '88%',
      borderTopLeftRadius: theme.radii.lg,
      borderTopRightRadius: theme.radii.lg,
      backgroundColor: theme.colors.surfacePrimary,
      borderColor: theme.colors.borderPrimary,
      borderTopWidth: 1,
      paddingTop: theme.spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
    },
    titleStack: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    eyebrow: {
      color: theme.colors.textSecondary,
      ...theme.typography.caption,
    },
    title: {
      color: theme.colors.textPrimary,
      ...theme.typography.title,
    },
    closeButton: {
      alignItems: 'center',
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.buttonSecondaryBorder,
      backgroundColor: theme.colors.buttonSecondaryFill,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    closeButtonText: {
      color: theme.colors.buttonSecondaryText,
      ...theme.typography.bodyStrong,
    },
    content: {
      gap: theme.spacing.lg,
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.xxl,
    },
    section: {
      gap: theme.spacing.sm,
    },
    sectionTitle: {
      color: theme.colors.textPrimary,
      ...theme.typography.subtitle,
    },
    body: {
      color: theme.colors.textSecondary,
      ...theme.typography.body,
    },
    bulletList: {
      gap: theme.spacing.xs,
    },
    bulletRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    bulletMarker: {
      color: theme.colors.accentPrimary,
      ...theme.typography.bodyStrong,
    },
    bulletText: {
      flex: 1,
      color: theme.colors.textSecondary,
      ...theme.typography.body,
    },
  });
}
