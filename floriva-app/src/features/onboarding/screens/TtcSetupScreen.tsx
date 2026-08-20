import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { ActionButton } from '@/src/components/primitives/ActionButton';
import { ItalicTitle } from '@/src/components/editorial/ItalicTitle';
import { Screen } from '@/src/components/primitives/Screen';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import { useOnboarding } from '@/src/features/onboarding/OnboardingProvider';
import {
  ChoiceChip,
  useSharedOnboardingStyles,
} from '@/src/features/onboarding/screens/shared';
import { buildTtcTrackingPreview } from '@/src/features/ttc/summary';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import { testIds } from '@/src/testing/testIds';

type TtcSetupScreenProps = {
  nextHref?: string;
};

export function TtcSetupScreen({ nextHref = './ttc-expectations' }: TtcSetupScreenProps) {
  const router = useRouter();
  const sharedOnboardingStyles = useSharedOnboardingStyles();
  const { resolvedLocale, t } = useLocalization();
  const { draft, setHasCompletedTtcSetupStep, setTtcTrackingPreference } = useOnboarding();

  return (
    <Screen
      eyebrow={t('onboarding.ttcSetup.eyebrow')}
      footerPlacement="inline"
      progress={{ current: 3, total: 4, variant: 'bar' }}
      title={<ItalicTitle prefix="Trying to " accent="conceive" suffix="." />}
      stickyTitle="Trying to conceive."
      description={t('onboarding.ttcSetup.description')}
      footer={
        <View style={sharedOnboardingStyles.footerActions}>
          <ActionButton
            appearance="secondary"
            onPress={() => router.back()}
            style={sharedOnboardingStyles.secondaryAction}
          >
            {t('onboarding.ttcSetup.backLabel')}
          </ActionButton>
          <ActionButton
            onPress={() => {
              setHasCompletedTtcSetupStep(true);
              router.push(nextHref as Href);
            }}
            style={sharedOnboardingStyles.primaryAction}
            testID={testIds.onboarding.ttcSetup.continueButton}
          >
            {t('common.actions.continue')}
          </ActionButton>
        </View>
      }
      testID={testIds.onboarding.ttcSetup.screen}
    >
      <SectionCard
        description={t('onboarding.ttcSetup.section.body')}
        title={t('onboarding.ttcSetup.section.title')}
      >
        <View style={sharedOnboardingStyles.rowWrap}>
          <ChoiceChip
            label={t('onboarding.ttcSetup.chips.sex')}
            onPress={() =>
              setTtcTrackingPreference('sex', !draft.ttcTrackingPreferences.sex)
            }
            selected={draft.ttcTrackingPreferences.sex}
            testID={testIds.onboarding.ttcSetup.sexToggle}
          />
          <ChoiceChip
            label={t('onboarding.ttcSetup.chips.ovulationTest')}
            onPress={() =>
              setTtcTrackingPreference(
                'ovulationTest',
                !draft.ttcTrackingPreferences.ovulationTest,
              )
            }
            selected={draft.ttcTrackingPreferences.ovulationTest}
            testID={testIds.onboarding.ttcSetup.ovulationTestToggle}
          />
          <ChoiceChip
            label={t('onboarding.ttcSetup.chips.cervicalMucus')}
            onPress={() =>
              setTtcTrackingPreference(
                'cervicalMucus',
                !draft.ttcTrackingPreferences.cervicalMucus,
              )
            }
            selected={draft.ttcTrackingPreferences.cervicalMucus}
            testID={testIds.onboarding.ttcSetup.cervicalMucusToggle}
          />
          <ChoiceChip
            label={t('onboarding.ttcSetup.chips.basalBodyTemperature')}
            onPress={() =>
              setTtcTrackingPreference(
                'basalBodyTemperature',
                !draft.ttcTrackingPreferences.basalBodyTemperature,
              )
            }
            selected={draft.ttcTrackingPreferences.basalBodyTemperature}
            testID={testIds.onboarding.ttcSetup.basalBodyTemperatureToggle}
          />
        </View>
      </SectionCard>
      <SectionCard
        description={buildTtcTrackingPreview({
          locale: resolvedLocale,
          preferences: draft.ttcTrackingPreferences,
        })}
        title={t('ttc.summary.loggingPreviewTitle')}
      />
    </Screen>
  );
}
