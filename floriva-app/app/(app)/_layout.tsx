import { Stack, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  createStackMotionOptions,
  useFlorivaMotion,
} from '@/src/features/motion/useFlorivaMotion';
import { useDatabase } from '@/src/db/DatabaseProvider';
import { OnboardingProvider } from '@/src/features/onboarding/OnboardingProvider';
import {
  createOnboardingDraftFromProfile,
  type OnboardingDraft,
} from '@/src/features/onboarding/model';
import { editorialPalette, spacing, typography } from '@/src/theme/tokens';

// Warm legacy ink (predates the editorial ink #1A1410). Kept inline for the
// transient loading/error states so this migration stays zero-visual-change.
const legacyInk = '#201A17';

type SettingsDraftState =
  | { status: 'loading' }
  | { status: 'ready'; draft: OnboardingDraft }
  | { status: 'profile-unavailable'; draft: OnboardingDraft };

function isProfileBackedSetupRoute(pathname: string) {
  return pathname === '/settings/ttc-setup' || pathname === '/settings/ttc-expectations';
}

export default function AppLayout() {
  const florivaMotion = useFlorivaMotion();
  const pathname = usePathname();
  const { repositories } = useDatabase();
  const [settingsDraftState, setSettingsDraftState] = useState<SettingsDraftState>({
    status: 'loading',
  });
  const settingsDraft =
    settingsDraftState.status === 'ready'
      ? settingsDraftState.draft
      : createOnboardingDraftFromProfile(null);
  const draftKey = JSON.stringify({
    conditions: settingsDraft?.conditionTags,
    cycleLength: settingsDraft?.cycleLengthInput,
    goals: settingsDraft?.goals,
    irregular: settingsDraft?.supportsIrregularCycles,
    lastPeriodStart: settingsDraft?.lastPeriodStartDate,
    periodLength: settingsDraft?.periodLengthInput,
    ttc: settingsDraft?.ttcTrackingPreferences,
  });

  useEffect(() => {
    let isCancelled = false;
    setSettingsDraftState({ status: 'loading' });

    async function hydrateSettingsDraft() {
      try {
        const profile = await repositories.userProfile.getProfile();

        if (!isCancelled) {
          setSettingsDraftState({
            draft: createOnboardingDraftFromProfile(profile),
            status: 'ready',
          });
        }
      } catch {
        if (!isCancelled) {
          setSettingsDraftState({
            draft: createOnboardingDraftFromProfile(null),
            status: 'profile-unavailable',
          });
        }
      }
    }

    void hydrateSettingsDraft();

    return () => {
      isCancelled = true;
    };
  }, [repositories.userProfile]);

  if (settingsDraftState.status === 'loading') {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator color={editorialPalette.accent} />
        <Text style={styles.stateText}>Loading...</Text>
      </View>
    );
  }

  if (
    settingsDraftState.status === 'profile-unavailable' &&
    isProfileBackedSetupRoute(pathname)
  ) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.stateTitle}>Unable to load settings</Text>
        <Text style={styles.stateText}>
          Floriva could not read your local cycle profile. Reopen Settings and try again before
          changing trying-to-conceive setup.
        </Text>
      </View>
    );
  }

  return (
    <OnboardingProvider initialDraft={settingsDraft} key={draftKey}>
      <Stack screenOptions={createStackMotionOptions(florivaMotion.reducedMotionEnabled, 'app')} />
    </OnboardingProvider>
  );
}

const styles = StyleSheet.create({
  stateContainer: {
    alignItems: 'center',
    backgroundColor: editorialPalette.bg,
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  stateText: {
    color: legacyInk,
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
  },
  stateTitle: {
    color: editorialPalette.accent,
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
    textAlign: 'center',
  },
});
