import { Stack, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { ActionButton } from '@/src/components/primitives/ActionButton';
import { Screen } from '@/src/components/primitives/Screen';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import { useAppShell } from '@/src/features/app-shell/AppShellProvider';
import { resolveAppEntry } from '@/src/features/app-shell/resolveAppEntry';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

export default function NotFoundScreen() {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = createStyles(theme);
  const { state } = useAppShell();

  function dismissUnknownRoute() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(resolveAppEntry(state));
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <Screen
        eyebrow="Oops"
        title="This page doesn't exist."
        description="You followed a link that doesn't go anywhere. You can head back safely."
        footer={
          <ActionButton
            appearance="secondary"
            onPress={dismissUnknownRoute}
          >
            Go back
          </ActionButton>
        }
      >
        <SectionCard
          description="Nothing was lost. Floriva kept you inside the app."
          title="What happened"
          presentation="unframed"
        >
          <View style={styles.copyStack}>
            <Text style={styles.body}>
              This path is not set up yet. Tap Go back to return somewhere safe.
            </Text>
          </View>
        </SectionCard>
      </Screen>
    </>
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
