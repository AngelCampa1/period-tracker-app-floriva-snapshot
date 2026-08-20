import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { ActionButton } from '@/src/components/primitives/ActionButton';
import { HelpTooltip } from '@/src/components/primitives/HelpTooltip';
import { ItalicTitle } from '@/src/components/editorial/ItalicTitle';
import { Screen } from '@/src/components/primitives/Screen';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import { useDatabase } from '@/src/db/DatabaseProvider';
import {
  defaultTtcTrackingPreferences,
  defaultUserProfile,
} from '@/src/db/domainDefaults';
import { ChoiceChip, useSharedOnboardingStyles } from '@/src/features/onboarding/screens/shared';
import { SettingsToggleRow } from '@/src/features/settings/components/SettingsToggleRow';
import { testIds } from '@/src/testing/testIds';
import type {
  ConditionKey,
  TrackingGoal,
  TtcTrackingPreferences,
} from '@/src/types/domain';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';

type TrackingPreset = 'off' | 'essential' | 'detailed';

function deriveTrackingPreset(preferences: TtcTrackingPreferences | undefined, ttcEnabled: boolean) {
  if (!ttcEnabled) {
    return 'off';
  }

  if (preferences?.basalBodyTemperature || preferences?.cervicalMucus) {
    return 'detailed';
  }

  return 'essential';
}

function buildTrackingPreferences(preset: TrackingPreset): TtcTrackingPreferences {
  if (preset === 'essential') {
    return {
      sex: true,
      ovulationTest: true,
      cervicalMucus: false,
      basalBodyTemperature: false,
    };
  }

  if (preset === 'detailed') {
    return {
      sex: true,
      ovulationTest: true,
      cervicalMucus: true,
      basalBodyTemperature: true,
    };
  }

  return { ...defaultTtcTrackingPreferences };
}

export function SettingsTrackingSetupScreen() {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const sharedOnboardingStyles = useSharedOnboardingStyles();
  const { repositories } = useDatabase();
  const [symptomLoggingEnabled, setSymptomLoggingEnabled] = useState(
    defaultUserProfile.goals.includes('symptoms'),
  );
  const [trackingPreset, setTrackingPreset] = useState<TrackingPreset>('off');
  const [showFertilityEstimates, setShowFertilityEstimates] = useState(true);
  const [conditionTags, setConditionTags] = useState<ConditionKey[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function hydrate() {
      try {
        const [profile, preferences] = await Promise.all([
          repositories.userProfile.getProfile(),
          repositories.appPreferences.getPreferences(),
        ]);

        if (isCancelled) {
          return;
        }

        setShowFertilityEstimates(preferences.showFertilityEstimates ?? true);
        if (!profile) {
          return;
        }

        setSymptomLoggingEnabled(profile.goals.includes('symptoms'));
        setTrackingPreset(
          deriveTrackingPreset(
            profile.ttcTrackingPreferences,
            profile.goals.includes('trying-to-conceive'),
          ),
        );
        setConditionTags(profile.conditionTags);
      } catch {
        if (!isCancelled) {
          setLoadError('Floriva could not load your saved tracking setup.');
        }
      }
    }

    void hydrate();

    return () => {
      isCancelled = true;
    };
  }, [repositories.appPreferences, repositories.userProfile]);

  async function handleSave() {
    setIsSaving(true);
    setSaveError(null);

    try {
      const [profile, preferences] = await Promise.all([
        repositories.userProfile.getProfile(),
        repositories.appPreferences.getPreferences(),
      ]);
      const goals: TrackingGoal[] = ['period'];

      if (symptomLoggingEnabled) {
        goals.push('symptoms');
      }

      if (trackingPreset !== 'off') {
        goals.push('trying-to-conceive');
      }

      await repositories.userProfile.saveProfile({
        cycleLengthDays: profile?.cycleLengthDays ?? defaultUserProfile.cycleLengthDays,
        periodLengthDays: profile?.periodLengthDays ?? defaultUserProfile.periodLengthDays,
        lastPeriodStartDate: profile?.lastPeriodStartDate,
        goals,
        supportsIrregularCycles:
          profile?.supportsIrregularCycles ?? defaultUserProfile.supportsIrregularCycles,
        conditionTags,
        ttcTrackingPreferences: buildTrackingPreferences(trackingPreset),
      });
      await repositories.appPreferences.savePreferences({
        ...preferences,
        deferredTrackingSetup: false,
        showFertilityEstimates,
      });
      router.replace('/today');
    } catch {
      setSaveError('Floriva could not save those tracking choices.');
    } finally {
      setIsSaving(false);
    }
  }

  function toggleConditionTag(nextTag: ConditionKey) {
    setConditionTags((current) =>
      current.includes(nextTag)
        ? current.filter((conditionTag) => conditionTag !== nextTag)
        : [...current, nextTag],
    );
  }

  return (
    <Screen
      backAction={{
        label: 'Back',
        onPress: () => router.back(),
      }}
      description="Turn on only the tracking you need right now."
      eyebrow="Settings · Tracking"
      testID={testIds.settings.trackingSetupScreen}
      title={<ItalicTitle prefix="Choose what to " accent="track" suffix="." />}
      stickyTitle="Choose what to track."
    >
      {/* UL-76: binary tracking choices are native switches — a single
          selected/unselected chip (and a Show/Hide chip pair) hid their
          state; a switch communicates it directly. */}
      <SectionCard
        description="Turn on symptoms or trying to conceive only when you need them."
        title="Tracking focus"
      >
        <SettingsToggleRow
          onValueChange={setSymptomLoggingEnabled}
          testID="settings-tracking-symptoms-toggle"
          title="Symptoms & mood"
          value={symptomLoggingEnabled}
        />
      </SectionCard>

      <SectionCard
        description="Show ovulation and fertile-window estimates as cycle context. Turning this off only hides estimates. It does not change saved logs."
        title="Fertility estimates"
      >
        <View style={styles.sectionHelpRow}>
          <HelpTooltip
            body="Floriva can show estimated fertile-window and ovulation timing as planning context. These estimates are not medical advice, a diagnosis, contraception guidance, or a guarantee."
            testID="settings-fertility-estimates-help"
            title="Fertility estimates"
          />
          <Text style={styles.sectionHelpLabel}>{'More about these estimates'}</Text>
        </View>
        <SettingsToggleRow
          onValueChange={setShowFertilityEstimates}
          testID="settings-fertility-estimates-toggle"
          title="Show fertility estimates"
          value={showFertilityEstimates}
        />
      </SectionCard>

      <SectionCard
        description="Choose how much trying-to-conceive detail you want Floriva to track."
        title="Trying to conceive"
      >
        <View style={styles.sectionHelpRow}>
          <HelpTooltip
            body="This controls extra conception-focused logging fields. It does not affect whether Floriva shows general fertility estimates."
            testID="settings-trying-to-conceive-help"
            title="Trying to conceive"
          />
          <Text style={styles.sectionHelpLabel}>{'More about conception tracking'}</Text>
        </View>
        <View style={sharedOnboardingStyles.rowWrap}>
          <ChoiceChip
            label="Conception tracking off"
            onPress={() => setTrackingPreset('off')}
            selected={trackingPreset === 'off'}
          />
          <ChoiceChip
            label="Essential conception"
            onPress={() => setTrackingPreset('essential')}
            selected={trackingPreset === 'essential'}
          />
          <ChoiceChip
            label="Detailed conception"
            onPress={() => setTrackingPreset('detailed')}
            selected={trackingPreset === 'detailed'}
          />
        </View>
      </SectionCard>

      <SectionCard
        description="These tags adjust the logging shortcuts Floriva shows you."
        title="Condition-aware logging"
      >
        <View style={styles.sectionHelpRow}>
          <HelpTooltip
            body="If your cycle timing varies, Floriva uses more careful prediction language. This is not a diagnosis or medical assessment."
            testID="settings-irregular-cycles-help"
            title="Irregular cycles"
          />
          <Text style={styles.sectionHelpLabel}>{'More about these tags'}</Text>
        </View>
        <View style={sharedOnboardingStyles.rowWrap}>
          <ChoiceChip
            label="PCOS"
            onPress={() => toggleConditionTag('pcos')}
            selected={conditionTags.includes('pcos')}
          />
          <ChoiceChip
            label="PMDD"
            onPress={() => toggleConditionTag('pmdd')}
            selected={conditionTags.includes('pmdd')}
          />
          <ChoiceChip
            label="Endometriosis"
            onPress={() => toggleConditionTag('endometriosis')}
            selected={conditionTags.includes('endometriosis')}
          />
        </View>
      </SectionCard>

      <Text style={styles.helperText}>
        You can change your trying-to-conceive detail any time from Settings.
      </Text>
      {loadError ? <Text style={styles.helperText}>{loadError}</Text> : null}
      {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

      <ActionButton onPress={() => { void handleSave(); }}>
        {isSaving ? 'Saving…' : 'Save tracking setup'}
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
    sectionHelpRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: theme.spacing.xs,
    },
    sectionHelpLabel: {
      color: theme.colors.textSecondary,
      ...theme.typography.caption,
    },
  });
}
