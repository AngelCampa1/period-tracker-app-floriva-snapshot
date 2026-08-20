import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { ActionButton } from '@/src/components/primitives/ActionButton';
import { Screen } from '@/src/components/primitives/Screen';
import { useAppShell } from '@/src/features/app-shell/AppShellProvider';
import { resolveAppEntry } from '@/src/features/app-shell/resolveAppEntry';
import { normalizeInfoModalBody } from '@/src/features/navigation/infoModal';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import { testIds } from '@/src/testing/testIds';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

/**
 * Reusable info modal route.
 *
 * Renders a short, presentation-style note from declarative params (title,
 * optional eyebrow, one or more body paragraphs). Open it with
 * `openInfoModal` from `@/src/features/navigation/infoModal`. Opened without
 * params (e.g. a raw deep link), it falls back to localized defaults so the
 * screen never appears blank.
 */
export default function ModalScreen() {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = createStyles(theme);
  const { t } = useLocalization();
  const { state } = useAppShell();
  const params = useLocalSearchParams<{
    title?: string;
    eyebrow?: string;
    body?: string | string[];
  }>();

  const title = params.title?.trim() || t('navigation.modal.title');
  const eyebrow = params.eyebrow?.trim() || t('navigation.modal.eyebrow');
  const paragraphs = (() => {
    const provided = normalizeInfoModalBody(params.body);
    return provided.length > 0 ? provided : normalizeInfoModalBody(t('navigation.modal.defaultBody'));
  })();

  function dismissModal() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(resolveAppEntry(state));
  }

  return (
    <Screen
      testID={testIds.infoModal.screen}
      backAction={{
        label: t('navigation.modal.backAction'),
        onPress: dismissModal,
        testID: testIds.infoModal.backButton,
      }}
      eyebrow={eyebrow}
      title={title}
      footer={
        <ActionButton
          appearance="secondary"
          onPress={dismissModal}
          testID={testIds.infoModal.dismissButton}
        >
          {t('navigation.modal.doneLabel')}
        </ActionButton>
      }
    >
      <View style={styles.copyStack}>
        {paragraphs.map((paragraph, index) => (
          <Text key={index} style={styles.body}>
            {paragraph}
          </Text>
        ))}
      </View>

      {/* Use a light status bar on iOS to account for the black space above the modal */}
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </Screen>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    copyStack: {
      gap: theme.spacing.sm,
    },
    body: {
      color: theme.colors.textSecondary,
      ...theme.typography.body,
    },
  });
}
