import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { ActionButton } from '@/src/components/primitives/ActionButton';
import { ItalicTitle } from '@/src/components/editorial/ItalicTitle';
import { Screen } from '@/src/components/primitives/Screen';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import { useDatabase } from '@/src/db/DatabaseProvider';
import { defaultUserProfile } from '@/src/db/domainDefaults';
import { ChoiceChip, InputField, useSharedOnboardingStyles } from '@/src/features/onboarding/screens/shared';
import { testIds } from '@/src/testing/testIds';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type CycleSetupErrors = {
  cycleLengthInput?: string;
  periodLengthInput?: string;
};

function parseWholeNumber(value: string) {
  if (!/^\d+$/.test(value.trim())) {
    return null;
  }

  return Number.parseInt(value, 10);
}

export function SettingsCycleSetupScreen() {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const sharedOnboardingStyles = useSharedOnboardingStyles();
  const { repositories } = useDatabase();
  const [cycleLengthInput, setCycleLengthInput] = useState(
    String(defaultUserProfile.cycleLengthDays ?? 29),
  );
  const [periodLengthInput, setPeriodLengthInput] = useState(
    String(defaultUserProfile.periodLengthDays ?? 5),
  );
  const [supportsIrregularCycles, setSupportsIrregularCycles] = useState(
    defaultUserProfile.supportsIrregularCycles,
  );
  const [errors, setErrors] = useState<CycleSetupErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function hydrate() {
      try {
        const profile = await repositories.userProfile.getProfile();

        if (isCancelled || !profile) {
          return;
        }

        setCycleLengthInput(String(profile.cycleLengthDays ?? defaultUserProfile.cycleLengthDays ?? 29));
        setPeriodLengthInput(String(profile.periodLengthDays ?? defaultUserProfile.periodLengthDays ?? 5));
        setSupportsIrregularCycles(profile.supportsIrregularCycles);
      } catch {
        if (!isCancelled) {
          setLoadError('Floriva could not load your saved cycle details.');
        }
      }
    }

    void hydrate();

    return () => {
      isCancelled = true;
    };
  }, [repositories.userProfile]);

  async function handleSave() {
    const nextErrors: CycleSetupErrors = {};
    const cycleLengthDays = parseWholeNumber(cycleLengthInput);
    const periodLengthDays = parseWholeNumber(periodLengthInput);

    if (cycleLengthDays === null || cycleLengthDays < 1 || cycleLengthDays > 120) {
      nextErrors.cycleLengthInput = 'Enter a cycle length between 1 and 120 days.';
    }

    if (periodLengthDays === null || periodLengthDays < 1 || periodLengthDays > 30) {
      nextErrors.periodLengthInput = 'Enter a period length between 1 and 30 days.';
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0 || cycleLengthDays === null || periodLengthDays === null) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const [profile, preferences] = await Promise.all([
        repositories.userProfile.getProfile(),
        repositories.appPreferences.getPreferences(),
      ]);

      await repositories.userProfile.saveProfile({
        cycleLengthDays,
        periodLengthDays,
        lastPeriodStartDate: profile?.lastPeriodStartDate,
        goals: profile?.goals.length ? profile.goals : defaultUserProfile.goals,
        supportsIrregularCycles,
        conditionTags: profile?.conditionTags ?? [],
        ttcTrackingPreferences:
          profile?.ttcTrackingPreferences ?? defaultUserProfile.ttcTrackingPreferences,
      });
      await repositories.appPreferences.savePreferences({
        ...preferences,
        deferredCycleSetup: false,
      });
      router.replace('/today');
    } catch {
      setSaveError('Floriva could not save those cycle details.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Screen
      backAction={{
        label: 'Back',
        onPress: () => router.back(),
      }}
      description="Check the defaults Floriva uses for your local predictions."
      eyebrow="Settings · Cycle setup"
      testID={testIds.settings.cycleSetupScreen}
      title={<ItalicTitle prefix="Your " accent="baseline" suffix="." />}
      stickyTitle="Your baseline."
    >
      <SectionCard
        description="These numbers shape local estimates only. You can change them any time."
        title="Cycle details"
      >
        <InputField
          error={errors.cycleLengthInput}
          keyboardType="number-pad"
          label="Cycle length (days)"
          onChangeText={setCycleLengthInput}
          value={cycleLengthInput}
        />
        <InputField
          error={errors.periodLengthInput}
          keyboardType="number-pad"
          label="Period length (days)"
          onChangeText={setPeriodLengthInput}
          value={periodLengthInput}
        />
        <View style={sharedOnboardingStyles.rowWrap}>
          <ChoiceChip
            label="Cycles are fairly steady"
            onPress={() => setSupportsIrregularCycles(false)}
            selected={!supportsIrregularCycles}
          />
          <ChoiceChip
            label="Cycles can vary"
            onPress={() => setSupportsIrregularCycles(true)}
            selected={supportsIrregularCycles}
          />
        </View>
      </SectionCard>

      {loadError ? <Text style={styles.helperText}>{loadError}</Text> : null}
      {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

      <ActionButton onPress={() => { void handleSave(); }}>
        {isSaving ? 'Saving…' : 'Save cycle details'}
      </ActionButton>
    </Screen>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    helperText: {
      color: theme.colors.textSecondary,
      ...theme.typography.caption,
    },
    errorText: {
      color: theme.colors.danger,
      ...theme.typography.caption,
    },
  });
}
