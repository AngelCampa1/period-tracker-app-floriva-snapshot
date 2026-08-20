import { useEffect, useMemo, useState } from 'react';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Constants from 'expo-constants';

import { getLocalTodayLogDate } from '@/src/features/logging/date';
import { collectPeriodStarts } from '@/src/lib/predictions/cycleHistory';
import { addDays } from '@/src/lib/predictions/dateMath';

import { Text } from '@/src/components/primitives/Text';
import { ActionButton } from '@/src/components/primitives/ActionButton';
import { InlineMetric } from '@/src/components/primitives/InlineMetric';
import { ListRow } from '@/src/components/primitives/ListRow';
import { SelectionChip } from '@/src/components/primitives/SelectionChip';
import { SettingsToggleRow } from '@/src/features/settings/components/SettingsToggleRow';
import { ItalicTitle } from '@/src/components/editorial/ItalicTitle';
import { Screen } from '@/src/components/primitives/Screen';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import { useDatabase } from '@/src/db/DatabaseProvider';
import { defaultUserProfile, mergeReminderPreferences } from '@/src/db/domainDefaults';
import {
  getBirthControlMethodOptions,
  getIudTypeOptions,
} from '@/src/features/logging/constants';
import { useAppShell } from '@/src/features/app-shell/AppShellProvider';
import { useBilling } from '@/src/features/billing/BillingProvider';
import { florivaRuntimeBillingConfig } from '@/src/features/billing/config';
import { resolveSaveOffer } from '@/src/features/billing/saveOffer/model';
import { useInteractionFeedback } from '@/src/features/feedback/InteractionFeedbackProvider';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import {
  buildReminderCenterModel,
  type ReminderCenterModel,
} from '@/src/features/settings/buildReminderCenterModel';
import { openSupportEmail } from '@/src/features/settings/supportContact';
import {
  localeDisplayLabels,
  supportedLocales,
} from '@/src/localization/config';
import { formatLocalizedDate, formatLocalizedReminderTime } from '@/src/localization/formatters';
import { translate } from '@/src/localization/translations';
import { ensureReminderPermissions } from '@/src/lib/notifications/reminderScheduler';
import { readScheduledNotificationDiagnostics } from '@/src/lib/notifications/scheduledNotificationDiagnostics';
import { getBiometricMethodsLabel } from '@/src/features/privacy/biometricMethodsLabel';
import { armBiometricLock, getBiometricAvailability } from '@/src/lib/security/biometricLock';
import {
  buildSettingsBirthControlMethodTestId,
  buildSettingsIudTypeTestId,
  buildSettingsReminderActionTestId,
  testIds,
} from '@/src/testing/testIds';
import { fontFamilies } from '@/src/theme/tokens';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';
import type {
  BillingSnapshot,
  BirthControlMethod,
  IudType,
  LocalePreference,
  ReminderKind,
  ReminderPreference,
  SupportedLocale,
  UserProfile,
} from '@/src/types/domain';

type ReminderHydrationState = 'loading' | 'ready' | 'error';

function isScheduledNotificationDiagnosticsEnabled() {
  return __DEV__ && process.env.EXPO_PUBLIC_E2E_SCHEDULED_NOTIFICATIONS === '1';
}

type SettingsHubRowProps = {
  title: string;
  summary: string;
  testID: string;
  iconName?: Parameters<typeof ListRow>[0]['iconName'];
  isLastInGroup?: boolean;
  trailingLabel?: string;
  onPress: () => void;
};

function shiftReminderTime(reminder: ReminderPreference, deltaMinutes: number): ReminderPreference {
  const totalMinutes = (reminder.hour * 60 + reminder.minute + deltaMinutes + 1440) % 1440;

  return {
    ...reminder,
    hour: Math.floor(totalMinutes / 60),
    minute: totalMinutes % 60,
  };
}

function formatLanguageSummary(
  localePreference: LocalePreference,
  resolvedLocale: SupportedLocale,
  t: (key: 'settings.language.systemDefault') => string,
) {
  if (localePreference === 'system') {
    return `${t('settings.language.systemDefault')} · ${localeDisplayLabels[resolvedLocale]}`;
  }

  return localeDisplayLabels[localePreference];
}

export function formatTtcHubSummary(
  profile: Pick<UserProfile, 'goals' | 'ttcTrackingPreferences'> | null,
  strings: {
    off: string;
    on: string;
    onDetailTemplate: string;
    chips: { sex: string; ovulationTest: string; cervicalMucus: string; basalBodyTemperature: string };
  },
) {
  const ttcEnabled = profile?.goals?.includes('trying-to-conceive') ?? false;

  if (!ttcEnabled) {
    return strings.off;
  }

  const prefs = profile?.ttcTrackingPreferences;
  const activeChips: string[] = [];

  if (prefs?.sex) activeChips.push(strings.chips.sex);
  if (prefs?.ovulationTest) activeChips.push(strings.chips.ovulationTest);
  if (prefs?.cervicalMucus) activeChips.push(strings.chips.cervicalMucus);
  if (prefs?.basalBodyTemperature) activeChips.push(strings.chips.basalBodyTemperature);

  if (activeChips.length === 0) {
    return strings.on;
  }

  return strings.onDetailTemplate.replaceAll('{flags}', activeChips.join(', '));
}

export function formatReminderSummary(reminder: ReminderPreference, locale: SupportedLocale) {
  const timeLabel = formatLocalizedReminderTime(reminder.hour, reminder.minute, locale);

  if (!reminder.enabled) {
    if (reminder.schedule.cadence !== 'cycle-event') {
      return translate(locale, 'tracker.reminders.readyForDaily', { timeLabel });
    }

    if (reminder.schedule.daysBefore === 0) {
      return translate(locale, 'tracker.reminders.readyForCycleDay', { timeLabel });
    }

    return reminder.schedule.daysBefore === 1
      ? translate(locale, 'tracker.reminders.readyForCycleOffsetOne', { timeLabel })
      : translate(locale, 'tracker.reminders.readyForCycleOffsetMany', {
          timeLabel,
          daysBefore: reminder.schedule.daysBefore,
        });
  }

  if (reminder.schedule.cadence !== 'cycle-event') {
    return translate(locale, 'tracker.reminders.scheduledForDaily', { timeLabel });
  }

  if (reminder.schedule.daysBefore === 0) {
    return translate(locale, 'tracker.reminders.scheduledForCycleDay', { timeLabel });
  }

  return reminder.schedule.daysBefore === 1
    ? translate(locale, 'tracker.reminders.scheduledForCycleOffsetOne', { timeLabel })
    : translate(locale, 'tracker.reminders.scheduledForCycleOffsetMany', {
        timeLabel,
        daysBefore: reminder.schedule.daysBefore,
      });
}

function formatBillingDate(isoTimestamp: string, locale: SupportedLocale) {
  const billingDate = new Date(isoTimestamp);

  if (Number.isNaN(billingDate.getTime())) {
    return null;
  }

  return formatLocalizedDate(isoTimestamp, locale);
}

function formatPlanLabel(snapshot: BillingSnapshot, locale: SupportedLocale) {
  if (snapshot.planId === 'annual') {
    return translate(locale, 'settings.subscription.planLabels.annual');
  }

  if (snapshot.planId === 'lifetime') {
    return translate(locale, 'settings.subscription.planLabels.lifetime');
  }

  if (snapshot.planId === 'monthly') {
    return translate(locale, 'settings.subscription.planLabels.monthly');
  }

  return translate(locale, 'settings.subscription.planLabels.none');
}

function formatAccessStateLabel(snapshot: BillingSnapshot, locale: SupportedLocale) {
  switch (snapshot.accessState) {
    case 'trial_active':
      return translate(locale, 'settings.subscription.states.trialActive');
    case 'subscribed':
      return translate(locale, 'settings.subscription.states.premiumActive');
    case 'expired':
      return translate(locale, 'settings.subscription.states.expired');
    default:
      return translate(locale, 'settings.subscription.states.noSubscription');
  }
}

function formatPrivacySummary(privacyPreference: {
  biometricsEnabled: boolean;
  relockAfterSeconds: number;
  diagnosticsConsentEnabled: boolean;
}, locale: SupportedLocale) {
  // UL-47: every value carries its label ("Biometric lock off · Diagnostics
  // off") instead of the debug-style "off · 1 min · off" triple. The relock
  // timeout only appears while the lock is on — it is meaningless otherwise.
  const onLabel = translate(locale, 'settings.privacyLock.diagnostics.on').toLowerCase();
  const offLabel = translate(locale, 'settings.privacyLock.diagnostics.off').toLowerCase();
  const relockMinutes = privacyPreference.relockAfterSeconds / 60;
  const relockDurationLabel =
    relockMinutes === 1
      ? translate(locale, 'settings.privacyLock.automaticRelock.oneMinute')
      : relockMinutes === 5
        ? translate(locale, 'settings.privacyLock.automaticRelock.fiveMinutes')
        : translate(locale, 'settings.privacyLock.automaticRelock.minutes', {
            minutes: relockMinutes,
          });
  const summaryParts = [
    `${translate(locale, 'settings.privacyLock.deviceLock.biometricLockLabel')} ${
      privacyPreference.biometricsEnabled ? onLabel : offLabel
    }`,
  ];

  if (privacyPreference.biometricsEnabled) {
    summaryParts.push(relockDurationLabel);
  }

  summaryParts.push(
    `${translate(locale, 'settings.privacyLock.diagnostics.title')} ${
      privacyPreference.diagnosticsConsentEnabled ? onLabel : offLabel
    }`,
  );

  return summaryParts.join(' · ');
}

function formatReminderSummaryLine(
  reminderPreferences: ReminderPreference[],
  reminderHydrationState: ReminderHydrationState,
  locale: SupportedLocale,
) {
  if (reminderHydrationState === 'loading') {
    return translate(locale, 'settings.status.remindersLoading');
  }

  if (reminderHydrationState === 'error') {
    return translate(locale, 'settings.status.remindersLoadError');
  }

  const enabledCount = reminderPreferences.filter((reminder) => reminder.enabled).length;

  if (enabledCount === 0) {
    return translate(locale, 'settings.status.noRemindersActive');
  }

  return enabledCount === 1
    ? translate(locale, 'tracker.snapshot.reminderActiveOne')
    : translate(locale, 'tracker.snapshot.reminderActiveMany', { count: enabledCount });
}

function formatBirthControlMethodLabel(
  method: UserProfile['birthControlMethod'],
  locale: SupportedLocale,
) {
  if (!method) {
    return 'Off';
  }

  return (
    getBirthControlMethodOptions(locale).find((option) => option.value === method)?.label ??
    method
  );
}

export function formatBirthControlHubSummary({
  locale,
  method,
  reminder,
  reminderHydrationState,
}: {
  locale: SupportedLocale;
  method: UserProfile['birthControlMethod'];
  reminder: ReminderPreference | undefined;
  reminderHydrationState: ReminderHydrationState;
}) {
  const methodLabel = formatBirthControlMethodLabel(method, locale);

  if (!method) {
    return translate(locale, 'birthControl.hub.off');
  }

  if (reminderHydrationState === 'loading') {
    return translate(locale, 'birthControl.hub.checkingReminder', { methodLabel });
  }

  if (reminderHydrationState === 'error' || !reminder?.enabled) {
    return translate(locale, 'birthControl.hub.reminderOff', { methodLabel });
  }

  return translate(locale, 'birthControl.hub.reminderOn', {
    methodLabel,
    timeLabel: formatLocalizedReminderTime(reminder.hour, reminder.minute, locale),
  });
}


function formatReminderKindLabel(reminderKind: ReminderKind, locale: SupportedLocale) {
  switch (reminderKind) {
    case 'daily-log':
      return translate(locale, 'settings.reminders.labels.dailyLog');
    case 'period-start':
      return translate(locale, 'settings.reminders.labels.periodStart');
    case 'fertile-window':
      return translate(locale, 'settings.reminders.labels.fertileWindow');
    case 'birth-control':
      return translate(locale, 'settings.reminders.labels.birthControl');
  }
}

function goBackOrReplace(
  router: Pick<ReturnType<typeof useRouter>, 'back' | 'canGoBack' | 'replace'>,
  fallbackHref: Href,
) {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallbackHref);
}

function useReminderPreferencesState() {
  const { repositories } = useDatabase();
  const [reminderPreferences, setReminderPreferences] = useState<ReminderPreference[]>(
    () => mergeReminderPreferences([]),
  );
  const [reminderHydrationState, setReminderHydrationState] =
    useState<ReminderHydrationState>('loading');

  useEffect(() => {
    let isCancelled = false;

    async function hydrateReminderPreferences() {
      setReminderHydrationState('loading');

      try {
        const storedPreferences = await repositories.reminderPreferences.getPreferences();

        if (isCancelled) {
          return;
        }

        setReminderPreferences(mergeReminderPreferences(storedPreferences));
        setReminderHydrationState('ready');
      } catch {
        if (isCancelled) {
          return;
        }

        setReminderPreferences(mergeReminderPreferences([]));
        setReminderHydrationState('error');
      }
    }

    void hydrateReminderPreferences();

    return () => {
      isCancelled = true;
    };
  }, [repositories.reminderPreferences]);

  return {
    reminderPreferences,
    reminderHydrationState,
    setReminderPreferences,
  };
}

function SettingsHubRow({
  iconName,
  isLastInGroup,
  onPress,
  summary,
  testID,
  title,
  trailingLabel,
}: SettingsHubRowProps) {
  return (
    <ListRow
      iconName={iconName}
      isLastInGroup={isLastInGroup}
      onPress={onPress}
      summary={summary}
      testID={testID}
      title={title}
      trailingAccessory={trailingLabel ? 'label' : 'chevron'}
      trailingLabel={trailingLabel}
    />
  );
}

function SettingsButtonGroup({
  children,
  compact,
}: {
  children: React.ReactNode;
  compact: boolean;
}) {
  const theme = useFlorivaTheme();
  const styles = createStyles(theme);

  return <View style={[styles.inlineButtonRow, compact ? styles.inlineButtonColumn : null]}>{children}</View>;
}

export function SettingsScreen() {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { repositories } = useDatabase();
  const { localePreference, resolvedLocale, t } = useLocalization();
  const { privacyPreference } = useAppShell();
  const { snapshot } = useBilling();
  const { reminderPreferences, reminderHydrationState } = useReminderPreferencesState();
  const [cycleCount, setCycleCount] = useState<number | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const reminderSummary = useMemo(
    () => formatReminderSummaryLine(reminderPreferences, reminderHydrationState, resolvedLocale),
    [reminderHydrationState, reminderPreferences, resolvedLocale],
  );
  const birthControlReminder = reminderPreferences.find(
    (reminder) => reminder.kind === 'birth-control',
  );
  const birthControlSummary = useMemo(
    () =>
      formatBirthControlHubSummary({
        locale: resolvedLocale,
        method: profile?.birthControlMethod,
        reminder: birthControlReminder,
        reminderHydrationState,
      }),
    [birthControlReminder, profile?.birthControlMethod, reminderHydrationState, resolvedLocale],
  );
  const languageSummary = useMemo(
    () => formatLanguageSummary(localePreference, resolvedLocale, t),
    [localePreference, resolvedLocale, t],
  );
  const ttcSummary = useMemo(
    () =>
      formatTtcHubSummary(profile, {
        off: t('settings.hub.ttcSummaryOff'),
        on: t('settings.hub.ttcSummaryOn'),
        onDetailTemplate: t('settings.hub.ttcSummaryOnDetail'),
        chips: {
          sex: t('onboarding.ttcSetup.chips.sex'),
          ovulationTest: t('onboarding.ttcSetup.chips.ovulationTest'),
          cervicalMucus: t('onboarding.ttcSetup.chips.cervicalMucus'),
          basalBodyTemperature: t('onboarding.ttcSetup.chips.basalBodyTemperature'),
        },
      }),
    [profile, t],
  );

  useEffect(() => {
    let isCancelled = false;

    async function loadProfile() {
      try {
        const loadedProfile = await repositories.userProfile.getProfile();
        if (!isCancelled) {
          setProfile(loadedProfile);
        }
      } catch {
        if (!isCancelled) {
          setProfile(null);
        }
      }
    }

    void loadProfile();

    return () => {
      isCancelled = true;
    };
  }, [repositories.userProfile]);

  useEffect(() => {
    async function loadCycleCount() {
      try {
        // LT-02: previously compared each bleeding day against the LAST
        // COUNTED START, not the previous bleeding day, so a single
        // continuously-logged period (e.g. Jan 1-5) opened a new "cycle"
        // every time a day sat >1 day after the start (day 3 already
        // qualified) -- massively over-counting even perfectly-logged
        // history. `collectPeriodStarts` is the engine's canonical
        // period-start detector (also used by the prediction engine and,
        // per LT-13, Insights) -- it walks CONSECUTIVE bleeding days and
        // additionally requires a plausible cycle-length gap
        // (MIN_CYCLE_SEPARATION_DAYS) before counting a new start, so all
        // three surfaces now agree on one COUNTING METHOD for the same
        // history.
        //
        // LT-23: the counting METHOD alone was not enough -- this screen
        // still read a fixed 730-day window (listByDateRange(today - 730,
        // today)) while Today read 365 days and Calendar read 365 days
        // anchored to the VIEWED month, not today. Three different read
        // windows on the same underlying history produced three different
        // counts even with identical counting logic. This stat is now
        // defined as "total period starts on record" -- every surface
        // reads the FULL stored history via listAll() (the same fix
        // already applied to Insights, LT-06), so Today/Calendar/Settings
        // report the same number for the same history regardless of
        // tenure length.
        const logs = await repositories.dailyLogs.listAll();
        setCycleCount(collectPeriodStarts(logs).length);
      } catch {
        setCycleCount(0);
      }
    }
    void loadCycleCount();
  }, [repositories.dailyLogs]);

  return (
    <Screen
      headerVariant="compact"
      title={
        <View style={styles.titleComposite}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowAccentBar} />
            <Text style={styles.eyebrowLabel}>{t('settings.hub.eyebrow')}</Text>
          </View>
          <Text style={styles.displayTitle}>
            {'Your '}
            <Text style={styles.displayTitleAccent}>{'almanac'}</Text>
            {', your way.'}
          </Text>
        </View>
      }
      testID={testIds.settings.screen}
    >
      {/* Profile stats card */}
      <View style={styles.profileCard}>
        <View style={styles.profileCircle}>
          <Text style={styles.profileCircleNumeral}>
            {cycleCount !== null ? String(cycleCount) : '-'}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileCyclesLabel}>
            {cycleCount === 1 ? '1 cycle logged' : `${cycleCount ?? '-'} cycles logged`}
          </Text>
          <Text style={styles.profileDeviceLabel}>{'On this device'}</Text>
        </View>
      </View>

      {/* Tracking */}
      <SectionCard presentation="grouped" title={'Tracking'}>
        <View style={styles.hubGroup}>
          <SettingsHubRow
            iconName="sliders"
            onPress={() => {
              router.push('/settings/cycle-setup' as Href);
            }}
            summary={'Average length, variability'}
            testID={'settings-cycle-setup-row'}
            title={'Cycle setup'}
          />
          <SettingsHubRow
            iconName="list-ul"
            onPress={() => {
              router.push('/settings/tracking-setup' as Href);
            }}
            summary={'Flow, symptoms, mood, sleep'}
            testID={'settings-tracking-setup-row'}
            title={'What to track'}
          />
          <SettingsHubRow
            iconName="heart-o"
            onPress={() => {
              router.push('/settings/ttc-setup' as Href);
            }}
            summary={ttcSummary}
            testID={testIds.settings.ttcRow}
            title={t('settings.hub.ttcTitle')}
          />
          <SettingsHubRow
            iconName="bell-o"
            isLastInGroup
            onPress={() => {
              router.push('/settings/birth-control' as Href);
            }}
            summary={birthControlSummary}
            testID={testIds.settings.birthControlRow}
            title={t('birthControl.hub.title')}
          />
        </View>
      </SectionCard>

      {/* Privacy & data */}
      <SectionCard presentation="grouped" title={'Privacy & data'}>
        <View style={styles.hubGroup}>
          <SettingsHubRow
            iconName="lock"
            onPress={() => {
              router.push('/settings/privacy-lock' as Href);
            }}
            summary={formatPrivacySummary(privacyPreference, resolvedLocale)}
            testID={testIds.settings.privacyLockRow}
            title={t('settings.hub.privacyLockTitle')}
          />
          <SettingsHubRow
            iconName="bell-o"
            onPress={() => {
              router.push('/settings/reminders' as Href);
            }}
            summary={reminderSummary}
            testID={testIds.settings.remindersRow}
            title={t('settings.hub.remindersTitle')}
          />
          <SettingsHubRow
            iconName="database"
            onPress={() => {
              router.push('/settings/data' as Href);
            }}
            summary={t('settings.hub.dataSummary')}
            testID={testIds.settings.dataRow}
            title={t('settings.hub.dataTitle')}
          />
          <SettingsHubRow
            iconName="trash-o"
            isLastInGroup
            onPress={() => {
              router.push('/settings/delete-data' as Href);
            }}
            summary={t('settings.hub.deleteDataSummary')}
            testID={testIds.settings.deleteDataRow}
            title={t('settings.hub.deleteDataTitle')}
          />
        </View>
      </SectionCard>

      {/* Account */}
      <SectionCard presentation="grouped" title={'Account'}>
        <View style={styles.hubGroup}>
          <SettingsHubRow
            iconName="credit-card"
            onPress={() => {
              router.push('/settings/subscription' as Href);
            }}
            summary={`${formatAccessStateLabel(snapshot, resolvedLocale)} · ${formatPlanLabel(
              snapshot,
              resolvedLocale,
            )}`}
            testID={testIds.settings.subscriptionRow}
            title={t('settings.hub.subscriptionTitle')}
          />
          <SettingsHubRow
            iconName="globe"
            onPress={() => {
              router.push('/settings/language' as Href);
            }}
            summary={languageSummary}
            testID={testIds.settings.languageRow}
            title={t('settings.language.title')}
          />
          <SettingsHubRow
            iconName="hand-o-up"
            onPress={() => {
              router.push('/settings/feedback' as Href);
            }}
            summary={t('settings.hub.feedbackSummary')}
            testID={testIds.settings.feedbackRow}
            title={t('settings.hub.feedbackTitle')}
          />
          <SettingsHubRow
            iconName="volume-up"
            isLastInGroup
            onPress={() => {
              router.push('/settings/sounds' as Href);
            }}
            summary={t('settings.hub.soundsSummary')}
            testID={testIds.settings.soundsRow}
            title={t('settings.hub.soundsTitle')}
          />
        </View>
      </SectionCard>

      <Text style={styles.versionFooter}>{`Floriva ${Constants.expoConfig?.version ?? ''} · made by Ventora Labs`}</Text>
    </Screen>
  );
}

export function SettingsLanguageScreen() {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = createStyles(theme);
  const { localePreference, resolvedLocale, setLocalePreference, t } = useLocalization();

  return (
    <Screen
      backAction={{
        label: t('settings.language.backLabel'),
        onPress: () => {
          goBackOrReplace(router, '/settings' as Href);
        },
      }}
      eyebrow={t('settings.language.eyebrow')}
      title={<ItalicTitle prefix="Choose your " accent="language" suffix="." />}
      stickyTitle="Choose your language."
      description={t('settings.language.description')}
      testID={testIds.settings.languageScreen}
    >
      {/* UL-54: one label for one fact — the InlineMetric's eyebrow carries
          "Current language"; no duplicate SectionCard heading above it. */}
      <SectionCard presentation="unframed">
        <InlineMetric
          label={t('settings.language.currentLabel')}
          numeric={false}
          tone="accent"
          value={formatLanguageSummary(localePreference, resolvedLocale, t)}
        />
      </SectionCard>

      {/* UL-50: choosing a language is selection, not a call to action — the
          current choice wears the selection-chip token (fill + dot), never
          the primary-CTA costume. */}
      <SectionCard title={t('settings.language.choicesTitle')}>
        <View style={styles.optionRow}>
          <SelectionChip
            label={t('settings.language.systemDefault')}
            onPress={() => {
              void setLocalePreference('system');
            }}
            selected={localePreference === 'system'}
            selectionIndicator="dot"
            size="tall"
          />
          {supportedLocales.map((locale) => (
            <SelectionChip
              key={locale}
              label={localeDisplayLabels[locale]}
              onPress={() => {
                void setLocalePreference(locale);
              }}
              selected={localePreference === locale}
              selectionIndicator="dot"
              size="tall"
            />
          ))}
        </View>
      </SectionCard>
    </Screen>
  );
}

export function SettingsFeedbackScreen() {
  const router = useRouter();
  const { t } = useLocalization();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const supportEmail = florivaRuntimeBillingConfig.supportEmail;

  async function handleEmailPress() {
    setStatusMessage(null);
    const opened = await openSupportEmail(
      {
        email: supportEmail,
        version: Constants.expoConfig?.version ?? 'unknown',
        platform: Platform.OS,
        subject: t('settings.feedback.emailSubject'),
        bodyIntro: t('settings.feedback.emailBodyIntro'),
      },
      Linking,
    );

    if (!opened) {
      setStatusMessage(t('settings.feedback.emailUnavailable', { email: supportEmail }));
    }
  }

  return (
    <Screen
      backAction={{
        label: t('settings.feedback.backLabel'),
        onPress: () => {
          goBackOrReplace(router, '/settings' as Href);
        },
      }}
      eyebrow={t('settings.feedback.eyebrow')}
      title={<ItalicTitle prefix="Tell us what you " accent="think" suffix="." />}
      stickyTitle="Tell us what you think."
      description={t('settings.feedback.description')}
      testID={testIds.settings.feedbackScreen}
    >
      {statusMessage ? (
        <SectionCard description={statusMessage} title={t('settings.status.updated')} />
      ) : null}

      {/* UL-60: the support address is labeled — unlabeled it read like a
          logged-in identity in an app that has no accounts. */}
      <SectionCard
        description={supportEmail}
        title={t('settings.feedback.supportEmailLabel')}
      >
        <ActionButton
          appearance="primary"
          onPress={() => {
            void handleEmailPress();
          }}
          testID={testIds.settings.feedbackEmailButton}
        >
          {t('settings.feedback.emailButton')}
        </ActionButton>
      </SectionCard>
    </Screen>
  );
}

export function SettingsSoundsScreen() {
  const router = useRouter();
  const { t } = useLocalization();
  const {
    hapticsEnabled,
    tapSoundEnabled,
    setHapticsEnabled,
    setTapSoundEnabled,
  } = useInteractionFeedback();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function persistSoundsSetting(
    savePreference: () => Promise<void>,
    successMessage: string,
  ) {
    try {
      await savePreference();
      setStatusMessage(successMessage);
    } catch {
      setStatusMessage(t('settings.status.saveFailed'));
    }
  }

  return (
    <Screen
      backAction={{
        label: t('settings.sounds.backLabel'),
        onPress: () => {
          goBackOrReplace(router, '/settings' as Href);
        },
      }}
      eyebrow={t('settings.sounds.eyebrow')}
      title={
        <ItalicTitle
          prefix={t('settings.sounds.titlePrefix')}
          accent={t('settings.sounds.titleAccent')}
          suffix={t('settings.sounds.titleSuffix')}
        />
      }
      stickyTitle={t('settings.sounds.title')}
      description={t('settings.sounds.description')}
      testID={testIds.settings.soundsScreen}
    >
      {statusMessage ? (
        <SectionCard description={statusMessage} title={t('settings.status.updated')} />
      ) : null}

      {/* UL-63/UL-76: binary settings are native switches, not verb-button
          pills with a separate "Haptics: On" status line. */}
      <SectionCard
        description={t('settings.sounds.haptics.description')}
        title={t('settings.sounds.haptics.title')}
      >
        <SettingsToggleRow
          onValueChange={(nextValue) => {
            void persistSoundsSetting(
              () => setHapticsEnabled(nextValue),
              nextValue
                ? t('settings.sounds.haptics.savedOn')
                : t('settings.sounds.haptics.savedOff'),
            );
          }}
          testID={testIds.settings.soundsHapticsButton}
          title={t('settings.sounds.haptics.title')}
          value={hapticsEnabled}
        />
      </SectionCard>

      <SectionCard
        description={t('settings.sounds.tapSound.description')}
        title={t('settings.sounds.tapSound.title')}
      >
        <SettingsToggleRow
          onValueChange={(nextValue) => {
            void persistSoundsSetting(
              () => setTapSoundEnabled(nextValue),
              nextValue
                ? t('settings.sounds.tapSound.savedOn')
                : t('settings.sounds.tapSound.savedOff'),
            );
          }}
          testID={testIds.settings.soundsTapSoundButton}
          title={t('settings.sounds.tapSound.title')}
          value={tapSoundEnabled}
        />
      </SectionCard>
    </Screen>
  );
}

export function SettingsPrivacyLockScreen() {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = createStyles(theme);
  const { resolvedLocale, t } = useLocalization();
  // UL-77: never surface Apple brand names ("Face ID") on Android — the
  // shared helper picks platform- and locale-appropriate unlock methods.
  const biometricMethods = getBiometricMethodsLabel(resolvedLocale);
  const { lockApp, privacyPreference, savePrivacyPreference } = useAppShell();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const selectedRelockMinutes = privacyPreference.relockAfterSeconds / 60;
  const lockNowDisabled = !privacyPreference.biometricsEnabled;
  const relockDurationLabel =
    selectedRelockMinutes === 1
      ? t('settings.privacyLock.automaticRelock.oneMinute')
      : selectedRelockMinutes === 5
        ? t('settings.privacyLock.automaticRelock.fiveMinutes')
        : t('settings.privacyLock.automaticRelock.minutes', {
            minutes: selectedRelockMinutes,
          });

  async function persistPrivacyPreference(
    nextPreference: typeof privacyPreference,
    successMessage: string,
  ) {
    try {
      await savePrivacyPreference(nextPreference);
      setStatusMessage(successMessage);
    } catch {
      setStatusMessage(t('settings.status.saveFailed'));
    }
  }

  return (
    <Screen
      backAction={{
        label: t('settings.privacyLock.screen.backLabel'),
        onPress: () => {
          goBackOrReplace(router, '/settings' as Href);
        },
      }}
      eyebrow={t('settings.privacyLock.screen.eyebrow')}
      motionVariant="sensitive"
      title={<ItalicTitle prefix="Lock when " accent="closed" suffix="." />}
      stickyTitle="Lock when closed."
      description={t('settings.privacyLock.screen.description')}
    >
      {statusMessage ? (
        <SectionCard description={statusMessage} title={t('settings.status.updated')} />
      ) : null}

      <SectionCard
        description={t('settings.privacyLock.deviceLock.description', { methods: biometricMethods })}
        title={t('settings.privacyLock.deviceLock.title')}
      >
        {/* UL-63/UL-76: the biometric lock is a native switch. The old
            "BIOMETRIC LOCK Off" metric panel + verb button said the same
            thing three ways; the switch communicates state and affordance. */}
        <View style={styles.privacyControlGroup}>
          <Text style={styles.helperText}>
            {t('settings.privacyLock.deviceLock.accessDescription', { methods: biometricMethods })}
          </Text>
          <SettingsToggleRow
            onValueChange={(nextValue) => {
              void (async () => {
                if (!nextValue) {
                  await persistPrivacyPreference(
                    {
                      ...privacyPreference,
                      biometricsEnabled: false,
                    },
                    t('settings.privacyLock.deviceLock.disabled'),
                  );
                  return;
                }

                const availability = await getBiometricAvailability();

                if (!availability.available) {
                  setStatusMessage(t('settings.privacyLock.deviceLock.unavailable'));
                  return;
                }

                await armBiometricLock();
                await persistPrivacyPreference(
                  {
                    ...privacyPreference,
                    biometricsEnabled: true,
                  },
                  t('settings.privacyLock.deviceLock.enabled', { methods: biometricMethods }),
                );
              })();
            }}
            testID={testIds.settings.setupBiometricLockButton}
            title={t('settings.privacyLock.deviceLock.biometricLockLabel')}
            value={privacyPreference.biometricsEnabled}
          />
        </View>

        <View style={styles.privacyControlGroup}>
          <Text style={styles.controlGroupLabel}>{t('settings.privacyLock.automaticRelock.title')}</Text>
          <Text style={styles.helperText}>
            {t('settings.privacyLock.automaticRelock.description', {
              duration: relockDurationLabel,
            })}
          </Text>
          {/* UL-50: the chosen relock timeout is a selection state, not a
              primary CTA — selection chips with a dot indicator. */}
          <View style={styles.optionRow}>
            <SelectionChip
              label={t('settings.privacyLock.automaticRelock.oneMinute')}
              onPress={() => {
                void persistPrivacyPreference(
                  {
                    ...privacyPreference,
                    relockAfterSeconds: 60,
                  },
                  t('settings.privacyLock.automaticRelock.oneMinuteStatus'),
                );
              }}
              selected={privacyPreference.relockAfterSeconds === 60}
              selectionIndicator="dot"
              size="tall"
              testID={testIds.settings.relockOneMinuteButton}
            />
            <SelectionChip
              label={t('settings.privacyLock.automaticRelock.fiveMinutes')}
              onPress={() => {
                void persistPrivacyPreference(
                  {
                    ...privacyPreference,
                    relockAfterSeconds: 300,
                  },
                  t('settings.privacyLock.automaticRelock.fiveMinutesStatus'),
                );
              }}
              selected={privacyPreference.relockAfterSeconds === 300}
              selectionIndicator="dot"
              size="tall"
              testID={testIds.settings.relockFiveMinutesButton}
            />
          </View>
        </View>

        <View style={styles.privacyControlGroup}>
          <Text style={styles.controlGroupLabel}>{t('settings.privacyLock.quickAction.title')}</Text>
          <Text style={styles.helperText}>
            {lockNowDisabled
              ? t('settings.privacyLock.quickAction.descriptionLocked')
              : t('settings.privacyLock.quickAction.descriptionUnlocked')}
          </Text>
          <ActionButton
            appearance="secondary"
            disabled={lockNowDisabled}
            onPress={async () => {
              const availability = await getBiometricAvailability();

              if (!availability.available) {
                setStatusMessage(t('settings.privacyLock.quickAction.unavailable', { methods: biometricMethods }));
                return;
              }

              lockApp();
              router.push('/lock');
            }}
            testID={testIds.settings.lockNowButton}
          >
            {t('settings.privacyLock.quickAction.button')}
          </ActionButton>
        </View>
      </SectionCard>

      <SectionCard
        description={t('settings.privacyLock.diagnostics.description')}
        title={t('settings.privacyLock.diagnostics.title')}
      >
        {/* UL-63/UL-76: diagnostics consent is a native switch instead of a
            "Diagnostics setting: Off" status line + verb button. */}
        <SettingsToggleRow
          onValueChange={(nextValue) => {
            void persistPrivacyPreference(
              {
                ...privacyPreference,
                diagnosticsConsentEnabled: nextValue,
              },
              nextValue
                ? t('settings.privacyLock.diagnostics.savedOn')
                : t('settings.privacyLock.diagnostics.savedOff'),
            );
          }}
          testID={testIds.settings.diagnosticsToggleButton}
          title={t('settings.privacyLock.diagnostics.title')}
          value={privacyPreference.diagnosticsConsentEnabled}
        />
        <Text style={styles.bodyText}>
          {t('settings.privacyLock.diagnostics.notes')}
        </Text>
      </SectionCard>
    </Screen>
  );
}

export function SettingsRemindersScreen() {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = createStyles(theme);
  const { width } = useWindowDimensions();
  const { resolvedLocale, t } = useLocalization();
  const { repositories } = useDatabase();
  const { refreshReminderSchedules } = useAppShell();
  const { reminderHydrationState, reminderPreferences, setReminderPreferences } =
    useReminderPreferencesState();
  const [expandedReminderKind, setExpandedReminderKind] = useState<ReminderKind | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [reminderCenter, setReminderCenter] = useState<ReminderCenterModel | null>(null);
  const [scheduledNotificationDiagnostics, setScheduledNotificationDiagnostics] =
    useState('[]');
  const [scheduleReconciliationRevision, setScheduleReconciliationRevision] = useState(0);
  const showScheduledNotificationDiagnostics = isScheduledNotificationDiagnosticsEnabled();
  const compactActionLayout = width < 430;
  const todayIso = getLocalTodayLogDate();
  const fallbackReminderCenter = useMemo(() => {
    return buildReminderCenterModel({
      todayIso,
      profile: defaultUserProfile,
      logEntries: [],
      preferences: reminderPreferences,
      locale: resolvedLocale,
    });
  }, [reminderPreferences, resolvedLocale, todayIso]);
  const displayedReminderCenter = reminderCenter ?? fallbackReminderCenter;

  useEffect(() => {
    let isCancelled = false;

    async function hydrateReminderCenter() {
      if (reminderHydrationState !== 'ready') {
        setReminderCenter(null);
        return;
      }

      try {
        const [profile, logEntries] = await Promise.all([
          repositories.userProfile.getProfile(),
          repositories.dailyLogs.listByDateRange(addDays(todayIso, -365), todayIso),
        ]);

        if (isCancelled) {
          return;
        }

        setReminderCenter(
          buildReminderCenterModel({
            todayIso,
            profile: profile ?? defaultUserProfile,
            logEntries,
            preferences: reminderPreferences,
            locale: resolvedLocale,
          }),
        );
      } catch {
        if (!isCancelled) {
          setReminderCenter(null);
        }
      }
    }

    void hydrateReminderCenter();

    return () => {
      isCancelled = true;
    };
  }, [
    repositories.dailyLogs,
    repositories.userProfile,
    reminderHydrationState,
    reminderPreferences,
    resolvedLocale,
    todayIso,
  ]);

  useEffect(() => {
    let isCancelled = false;

    async function hydrateScheduledNotificationDiagnostics() {
      if (!showScheduledNotificationDiagnostics) {
        return;
      }

      try {
        const diagnostics = await readScheduledNotificationDiagnostics();

        if (!isCancelled) {
          setScheduledNotificationDiagnostics(JSON.stringify(diagnostics));
        }
      } catch {
        if (!isCancelled) {
          setScheduledNotificationDiagnostics('[]');
        }
      }
    }

    void hydrateScheduledNotificationDiagnostics();

    return () => {
      isCancelled = true;
    };
  }, [
    reminderCenter,
    reminderPreferences,
    scheduleReconciliationRevision,
    showScheduledNotificationDiagnostics,
    statusMessage,
  ]);

  async function persistReminderPreferences(nextPreferences: ReminderPreference[]) {
    try {
      await repositories.reminderPreferences.savePreferences(nextPreferences);
      setReminderPreferences(nextPreferences);
      await refreshReminderSchedules();
      setScheduleReconciliationRevision((current) => current + 1);
      return true;
    } catch {
      setStatusMessage(t('settings.status.saveFailed'));
      return false;
    }
  }

  async function toggleReminder(reminderKind: ReminderKind) {
    if (reminderHydrationState !== 'ready') {
      return;
    }

    const nextPreferences = [...reminderPreferences];
    const reminderIndex = nextPreferences.findIndex((reminder) => reminder.kind === reminderKind);

    if (reminderIndex === -1) {
      return;
    }

    const reminder = nextPreferences[reminderIndex];
    const nextEnabled = !reminder.enabled;

    if (nextEnabled) {
      const permissionGranted = await ensureReminderPermissions();

      if (!permissionGranted) {
        setStatusMessage(t('settings.status.notificationsRequired'));
        return;
      }
    }

    nextPreferences[reminderIndex] = {
      ...reminder,
      enabled: nextEnabled,
    };

    const didPersist = await persistReminderPreferences(nextPreferences);

    if (didPersist) {
      setStatusMessage(null);
    }
  }

  async function updateReminder(
    reminderKind: ReminderKind,
    updater: (reminder: ReminderPreference) => ReminderPreference,
  ) {
    if (reminderHydrationState !== 'ready') {
      return;
    }

    const nextPreferences = reminderPreferences.map((reminder) =>
      reminder.kind === reminderKind ? updater(reminder) : reminder,
    );

    const didPersist = await persistReminderPreferences(nextPreferences);

    if (didPersist) {
      setStatusMessage(null);
    }
  }

  return (
    <Screen
      backAction={{
        label: t('settings.reminders.screen.backLabel'),
        onPress: () => {
          goBackOrReplace(router, '/settings' as Href);
        },
      }}
      eyebrow={t('settings.reminders.screen.eyebrow')}
      title={<ItalicTitle prefix="Quiet, useful " accent="nudges" suffix="." />}
      stickyTitle="Quiet, useful nudges."
      description={t('settings.reminders.screen.description')}
      testID={testIds.settings.remindersScreen}
    >
      {showScheduledNotificationDiagnostics ? (
        <Text
          accessibilityLabel={scheduledNotificationDiagnostics}
          style={styles.e2eHiddenDiagnostics}
          testID={testIds.settings.scheduledNotificationsDiagnostics}
        >
          {scheduledNotificationDiagnostics}
        </Text>
      ) : null}

      {statusMessage ? (
        <SectionCard description={statusMessage} title={t('settings.status.updated')} />
      ) : null}

      <SectionCard
        description={t('settings.reminders.section.description')}
        title={t('settings.reminders.section.title')}
      >
        {displayedReminderCenter ? (
          <View style={styles.reminderCenter} testID={testIds.settings.reminderCenter}>
            <Text style={styles.reminderDetail}>
              {displayedReminderCenter.activeCount === 0
                ? t('settings.status.noRemindersActive')
                : displayedReminderCenter.activeCount === 1
                  ? t('tracker.snapshot.reminderActiveOne')
                  : t('tracker.snapshot.reminderActiveMany', {
                      count: displayedReminderCenter.activeCount,
                    })}
            </Text>
            {/* UL-54: the per-reminder rows verbatim-duplicated the editable
                reminder cards right below this summary. Only the active count
                (information the cards do not aggregate) stays here. */}
          </View>
        ) : null}
        {reminderHydrationState === 'loading' ? (
          <Text style={styles.helperText}>{t('settings.reminders.status.loading')}</Text>
        ) : null}
        {reminderHydrationState === 'error' ? (
          <Text style={styles.helperText}>{t('settings.reminders.status.error')}</Text>
        ) : null}

        <View style={styles.reminderStack}>
          {reminderPreferences.map((reminder) => (
            <View key={reminder.kind} style={styles.reminderCard}>
              {/* UL-63/UL-76/UL-72: one native switch per reminder replaces
                  the On/Off badge + wrapping "Turn off daily log reminder"
                  verb pill (which ran to two lines on Android). */}
              <SettingsToggleRow
                disabled={reminderHydrationState !== 'ready'}
                onValueChange={() => {
                  void toggleReminder(reminder.kind);
                }}
                summary={formatReminderSummary(reminder, resolvedLocale)}
                testID={buildSettingsReminderActionTestId(reminder.kind, 'toggle')}
                title={formatReminderKindLabel(reminder.kind, resolvedLocale)}
                value={reminder.enabled}
              />

              <SettingsButtonGroup compact={compactActionLayout}>
                <ActionButton
                  appearance="secondary"
                  disabled={reminderHydrationState !== 'ready'}
                  style={styles.inlineButton}
                  onPress={() => {
                    setExpandedReminderKind((currentKind) =>
                      currentKind === reminder.kind ? null : reminder.kind,
                    );
                  }}
                  testID={buildSettingsReminderActionTestId(reminder.kind, 'edit')}
                >
                  {expandedReminderKind === reminder.kind
                    ? t('settings.reminders.actions.hideTimingControls')
                    : t('settings.reminders.actions.editTiming')}
                </ActionButton>
              </SettingsButtonGroup>

              {expandedReminderKind === reminder.kind ? (
                <View style={styles.expandedReminderPanel}>
                  <Text style={styles.reminderDetail}>
                    {t('settings.reminders.detail.fineTuneTiming')}
                  </Text>
                  <SettingsButtonGroup compact={compactActionLayout}>
                    <ActionButton
                      appearance="secondary"
                      disabled={reminderHydrationState !== 'ready'}
                      style={styles.inlineButton}
                      onPress={() => {
                        void updateReminder(reminder.kind, (currentReminder) =>
                          shiftReminderTime(currentReminder, -30),
                        );
                      }}
                      testID={buildSettingsReminderActionTestId(reminder.kind, 'earlier')}
                    >
                      {t('settings.reminders.actions.earlierBy30Min')}
                    </ActionButton>
                    <ActionButton
                      appearance="secondary"
                      disabled={reminderHydrationState !== 'ready'}
                      style={styles.inlineButton}
                      onPress={() => {
                        void updateReminder(reminder.kind, (currentReminder) =>
                          shiftReminderTime(currentReminder, 30),
                        );
                      }}
                      testID={buildSettingsReminderActionTestId(reminder.kind, 'later')}
                    >
                      {t('settings.reminders.actions.laterBy30Min')}
                    </ActionButton>
                  </SettingsButtonGroup>

                  {reminder.schedule.cadence === 'cycle-event' ? (
                    <SettingsButtonGroup compact={compactActionLayout}>
                      <ActionButton
                        appearance="secondary"
                        disabled={reminderHydrationState !== 'ready'}
                        style={styles.inlineButton}
                        onPress={() => {
                          void updateReminder(reminder.kind, (currentReminder) => {
                            const currentDaysBefore =
                              currentReminder.schedule.cadence === 'cycle-event'
                                ? currentReminder.schedule.daysBefore
                                : 0;

                            return {
                              ...currentReminder,
                              schedule: {
                                cadence: 'cycle-event',
                                daysBefore: Math.max(0, currentDaysBefore - 1),
                              },
                            };
                          });
                        }}
                        testID={buildSettingsReminderActionTestId(reminder.kind, 'less-notice')}
                      >
                        {t('settings.reminders.actions.lessNotice')}
                      </ActionButton>
                      <ActionButton
                        appearance="secondary"
                        disabled={reminderHydrationState !== 'ready'}
                        style={styles.inlineButton}
                        onPress={() => {
                          void updateReminder(reminder.kind, (currentReminder) => {
                            const currentDaysBefore =
                              currentReminder.schedule.cadence === 'cycle-event'
                                ? currentReminder.schedule.daysBefore
                                : 0;

                            return {
                              ...currentReminder,
                              schedule: {
                                cadence: 'cycle-event',
                                daysBefore: Math.min(30, currentDaysBefore + 1),
                              },
                            };
                          });
                        }}
                        testID={buildSettingsReminderActionTestId(reminder.kind, 'more-notice')}
                      >
                        {t('settings.reminders.actions.moreNotice')}
                      </ActionButton>
                    </SettingsButtonGroup>
                  ) : null}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </SectionCard>
    </Screen>
  );
}

export function SettingsBirthControlScreen() {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = createStyles(theme);
  const { resolvedLocale, t } = useLocalization();
  const { repositories } = useDatabase();
  const { refreshReminderSchedules } = useAppShell();
  const { reminderHydrationState, reminderPreferences, setReminderPreferences } =
    useReminderPreferencesState();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileHydrationState, setProfileHydrationState] =
    useState<ReminderHydrationState>('loading');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const methodOptions = useMemo(
    () => getBirthControlMethodOptions(resolvedLocale),
    [resolvedLocale],
  );
  const iudTypeOptions = useMemo(() => getIudTypeOptions(resolvedLocale), [resolvedLocale]);
  const birthControlReminder =
    reminderPreferences.find((reminder) => reminder.kind === 'birth-control') ??
    mergeReminderPreferences([]).find((reminder) => reminder.kind === 'birth-control')!;
  const selectedMethod = profile?.birthControlMethod;
  // LT-26: the stored preference's `enabled` flag can be true with no method
  // on file (e.g. a restored backup, or any future write path other than
  // this screen's own persistBirthControlMethod clear-method branch below).
  // buildReminderPlans already refuses to schedule a birth-control reminder
  // without a method; this screen must present that same "off" story rather
  // than showing a live-looking "Daily at ..." time for a reminder that will
  // not actually fire.
  const reminderEnabled = Boolean(selectedMethod) && Boolean(birthControlReminder.enabled);
  const reminderSummary = reminderEnabled
    ? t('birthControl.settings.dailyAt', {
        timeLabel: formatLocalizedReminderTime(
          birthControlReminder.hour,
          birthControlReminder.minute,
          resolvedLocale,
        ),
      })
    : selectedMethod
      ? t('birthControl.settings.reminderOff')
      : t('birthControl.settings.chooseMethod');

  useEffect(() => {
    let isCancelled = false;

    async function hydrateProfile() {
      setProfileHydrationState('loading');
      try {
        const loadedProfile = await repositories.userProfile.getProfile();

        if (!isCancelled) {
          setProfile(loadedProfile ?? defaultUserProfile);
          setProfileHydrationState('ready');
        }
      } catch {
        if (!isCancelled) {
          setProfile(defaultUserProfile);
          setProfileHydrationState('error');
        }
      }
    }

    void hydrateProfile();

    return () => {
      isCancelled = true;
    };
  }, [repositories.userProfile]);

  async function persistBirthControlMethod(method: UserProfile['birthControlMethod']) {
    const currentProfile = profile ?? defaultUserProfile;
    const isClearingMethod = currentProfile.birthControlMethod === method;
    const nextMethod = isClearingMethod ? undefined : method;
    const nextProfile = {
      ...currentProfile,
      birthControlMethod: nextMethod,
      // The IUD sub-type is only meaningful for an IUD; drop it whenever the
      // method changes to anything else (mirrors the persistence-layer clear).
      iudType: nextMethod === 'iud' ? currentProfile.iudType : undefined,
    };

    setStatusMessage(null);
    setProfile(nextProfile);

    try {
      if (isClearingMethod && birthControlReminder.enabled) {
        const nextPreferences = reminderPreferences.map((reminder) =>
          reminder.kind === 'birth-control' ? { ...reminder, enabled: false } : reminder,
        );

        await repositories.userProfile.saveProfileAndReminderPreferences(
          nextProfile,
          nextPreferences,
        );
        setReminderPreferences(nextPreferences);
        try {
          await Promise.resolve(refreshReminderSchedules());
        } catch {
          setStatusMessage(t('birthControl.settings.reminderRefreshError'));
          return;
        }
      } else {
        await repositories.userProfile.saveProfile(nextProfile);
      }

      setStatusMessage(t('birthControl.settings.savedStatus'));
    } catch {
      setProfile(currentProfile);
      setStatusMessage(t('birthControl.settings.saveSetupError'));
    }
  }

  async function persistIudType(iudType: IudType) {
    const currentProfile = profile ?? defaultUserProfile;
    // Only meaningful for an IUD method; ignore taps that somehow arrive otherwise.
    if (currentProfile.birthControlMethod !== 'iud') {
      return;
    }
    const isClearing = currentProfile.iudType === iudType;
    const nextProfile = {
      ...currentProfile,
      iudType: isClearing ? undefined : iudType,
    };

    setStatusMessage(null);
    setProfile(nextProfile);

    try {
      await repositories.userProfile.saveProfile(nextProfile);
      setStatusMessage(t('birthControl.settings.savedStatus'));
    } catch {
      setProfile(currentProfile);
      setStatusMessage(t('birthControl.settings.saveSetupError'));
    }
  }

  async function persistBirthControlReminder(nextReminder: ReminderPreference) {
    setStatusMessage(null);

    if (nextReminder.enabled) {
      const permissionGranted = await ensureReminderPermissions();

      if (!permissionGranted) {
        setStatusMessage(
          t('birthControl.settings.notificationsOff'),
        );
        return;
      }
    }

    const nextPreferences = reminderPreferences.map((reminder) =>
      reminder.kind === 'birth-control' ? nextReminder : reminder,
    );

    try {
      await repositories.reminderPreferences.savePreferences(nextPreferences);
      setReminderPreferences(nextPreferences);
      await Promise.resolve(refreshReminderSchedules());
      setStatusMessage(t('birthControl.settings.savedStatus'));
    } catch {
      setStatusMessage(
        t('birthControl.settings.reminderRefreshError'),
      );
    }
  }

  return (
    <Screen
      backAction={{
        label: t('birthControl.settings.backLabel'),
        onPress: () => {
          goBackOrReplace(router, '/settings' as Href);
        },
      }}
      eyebrow={t('birthControl.settings.eyebrow')}
      title={
        <ItalicTitle
          prefix={t('birthControl.settings.titlePrefix')}
          accent={t('birthControl.settings.titleAccent')}
          suffix={t('birthControl.settings.titleSuffix')}
        />
      }
      stickyTitle={`${t('birthControl.settings.titlePrefix')}${t('birthControl.settings.titleAccent')}${t('birthControl.settings.titleSuffix')}`}
      description={t('birthControl.settings.description')}
      testID={testIds.settings.birthControlScreen}
    >
      {statusMessage ? (
        <SectionCard description={statusMessage} title={t('birthControl.settings.updatedTitle')} />
      ) : null}

      <SectionCard
        description={t('birthControl.settings.defaultMethodDescription')}
        title={t('birthControl.settings.defaultMethodTitle')}
      >
        {profileHydrationState === 'loading' ? (
          <Text style={styles.helperText}>{t('birthControl.settings.loadingSetup')}</Text>
        ) : null}
        {profileHydrationState === 'error' ? (
          <Text style={styles.helperText}>{t('birthControl.settings.loadSetupError')}</Text>
        ) : null}
        {/* UL-50: the saved method is a selection state — chips, not CTA pills. */}
        <View style={styles.optionRow}>
          {methodOptions.map((option) => (
            <SelectionChip
              key={option.value}
              disabled={
                profileHydrationState === 'loading' || reminderHydrationState !== 'ready'
              }
              label={option.label}
              onPress={() => {
                void persistBirthControlMethod(
                  option.value as Exclude<BirthControlMethod, 'none'>,
                );
              }}
              selected={selectedMethod === option.value}
              selectionIndicator="dot"
              size="tall"
              testID={buildSettingsBirthControlMethodTestId(option.value)}
            />
          ))}
        </View>
      </SectionCard>

      {selectedMethod === 'iud' ? (
        <SectionCard
          description={t('birthControl.settings.iudTypeDescription')}
          title={t('birthControl.settings.iudTypeTitle')}
        >
          <View style={styles.optionRow} testID={testIds.settings.iudTypeControls}>
            {iudTypeOptions.map((option) => (
              <SelectionChip
                key={option.value}
                disabled={
                  profileHydrationState === 'loading' || reminderHydrationState !== 'ready'
                }
                label={option.label}
                onPress={() => {
                  void persistIudType(option.value);
                }}
                selected={profile?.iudType === option.value}
                selectionIndicator="dot"
                size="tall"
                testID={buildSettingsIudTypeTestId(option.value)}
              />
            ))}
          </View>
        </SectionCard>
      ) : null}

      <SectionCard
        description={t('birthControl.settings.reminderDescription')}
        title={t('birthControl.settings.reminderTitle')}
      >
        <View style={styles.privacyControlGroup}>
          {/* UL-63/UL-76: the daily birth-control reminder is a native switch
              labeled with the saved method; the summary carries the timing. */}
          <SettingsToggleRow
            disabled={!selectedMethod || reminderHydrationState !== 'ready'}
            onValueChange={() => {
              void persistBirthControlReminder({
                ...birthControlReminder,
                enabled: !birthControlReminder.enabled,
              });
            }}
            summary={reminderSummary}
            testID={testIds.settings.birthControlReminderToggle}
            title={
              selectedMethod
                ? formatBirthControlMethodLabel(selectedMethod, resolvedLocale)
                : t('birthControl.settings.noMethodSelected')
            }
            value={reminderEnabled}
          />
          <View style={styles.birthControlReminderActions}>
            <View
              style={styles.birthControlReminderAdjustmentRow}
              testID={testIds.settings.birthControlReminderAdjustmentRow}
            >
              <ActionButton
                appearance="secondary"
                disabled={!selectedMethod || reminderHydrationState !== 'ready'}
                onPress={() => {
                  void persistBirthControlReminder(shiftReminderTime(birthControlReminder, -30));
                }}
                fitLabelToSingleLine
                style={[styles.inlineButton, styles.compactActionButton]}
                testID={testIds.settings.birthControlReminderEarlier}
              >
                {t('birthControl.settings.earlierBy30Min')}
              </ActionButton>
              <ActionButton
                appearance="secondary"
                disabled={!selectedMethod || reminderHydrationState !== 'ready'}
                onPress={() => {
                  void persistBirthControlReminder(shiftReminderTime(birthControlReminder, 30));
                }}
                fitLabelToSingleLine
                style={[styles.inlineButton, styles.compactActionButton]}
                testID={testIds.settings.birthControlReminderLater}
              >
                {t('birthControl.settings.laterBy30Min')}
              </ActionButton>
            </View>
          </View>
        </View>
      </SectionCard>
    </Screen>
  );
}

export function SettingsSubscriptionScreen() {
  const router = useRouter();
  const theme = useFlorivaTheme();
  const styles = createStyles(theme);
  const { width } = useWindowDimensions();
  const { resolvedLocale, t } = useLocalization();
  const {
    isSyncing,
    managementUrl,
    openManageSubscriptions,
    presentRestorePaywall,
    refreshBilling,
    snapshot,
  } = useBilling();
  const [supportStatusMessage, setSupportStatusMessage] = useState<string | null>(null);

  async function handleContactSupport() {
    setSupportStatusMessage(null);
    const opened = await openSupportEmail(
      {
        email: florivaRuntimeBillingConfig.supportEmail,
        version: Constants.expoConfig?.version ?? 'unknown',
        platform: Platform.OS,
        subject: t('settings.feedback.emailSubject'),
        bodyIntro: t('settings.feedback.emailBodyIntro'),
      },
      Linking,
    );

    if (!opened) {
      setSupportStatusMessage(
        t('settings.feedback.emailUnavailable', {
          email: florivaRuntimeBillingConfig.supportEmail,
        }),
      );
    }
  }
  const compactActionLayout = width < 430;
  const hasRecurringSubscriptionManagement =
    (snapshot.accessState === 'trial_active' || snapshot.accessState === 'subscribed') &&
    snapshot.planId !== 'lifetime';
  const eligibleSaveOffer = resolveSaveOffer(
    snapshot,
    Platform.OS === 'ios' ? 'ios' : 'android',
    florivaRuntimeBillingConfig,
  );
  const isRecurringPlan = snapshot.planId === 'annual' || snapshot.planId === 'monthly';
  // Only the lifetime plan is a one-time unlock. Anything else (including a
  // device with no purchase yet) must not be described as one-time, since the
  // offered plans are recurring subscriptions.
  const isOneTimePlan = snapshot.planId === 'lifetime';
  // Floriva is free and every product is removed from sale, so there is nothing
  // left to buy. Never surface a purchase CTA that would open an empty paywall.
  const canOpenBillingOptions = false;
  // UL-55/UL-16: date lines are gated by access state so the card never
  // stacks contradictory facts. During an active trial "Billing starts" is
  // the truth and "Access ends" (the same date) would contradict it; once
  // there is no live plan, stale trial/billing dates must not render under a
  // "No subscription" badge.
  const trialEndsLabel =
    snapshot.accessState === 'trial_active' && snapshot.trialEndsAt
      ? formatBillingDate(snapshot.trialEndsAt, resolvedLocale)
      : null;
  const firstChargeLabel =
    snapshot.accessState === 'trial_active' && snapshot.firstChargeAt
      ? formatBillingDate(snapshot.firstChargeAt, resolvedLocale)
      : null;
  const accessEndsLabel =
    (snapshot.accessState === 'subscribed' || snapshot.accessState === 'expired') &&
    snapshot.expiresAt
      ? formatBillingDate(snapshot.expiresAt, resolvedLocale)
      : null;

  return (
    <Screen
      backAction={{
        label: t('settings.subscription.screen.backLabel'),
        onPress: () => {
          goBackOrReplace(router, '/settings' as Href);
        },
      }}
      eyebrow={t('settings.subscription.screen.eyebrow')}
      title={
        <ItalicTitle
          prefix={t('settings.subscription.screen.titlePrefix')}
          accent={t('settings.subscription.screen.titleAccent')}
          suffix={t('settings.subscription.screen.titleSuffix')}
        />
      }
      stickyTitle={t('settings.subscription.screen.title')}
      description={
        isOneTimePlan
          ? t('settings.subscription.screen.descriptionOneTime')
          : t('settings.subscription.screen.descriptionRecurring')
      }
    >
      <SectionCard
        description={t('settings.subscription.current.description')}
        title={t('settings.subscription.current.title')}
      >
        <Text style={styles.subscriptionDetail} testID={testIds.settings.subscriptionRetiredNotice}>
          {t('settings.subscription.current.retired')}
        </Text>

        <View style={styles.subscriptionHeader}>
          <View style={styles.subscriptionPlanBlock}>
            {/* UL-54: the card title already reads "Current plan" — no repeated
                inline label above the plan name. */}
            <Text style={styles.subscriptionPlan}>{formatPlanLabel(snapshot, resolvedLocale)}</Text>
          </View>
          <View
            style={[
              styles.subscriptionBadge,
              snapshot.accessState === 'subscribed'
                ? styles.subscriptionBadgeActive
                : snapshot.accessState === 'trial_active'
                  ? styles.subscriptionBadgeTrial
                  : styles.subscriptionBadgeMuted,
            ]}
          >
            <Text style={styles.subscriptionBadgeText}>
              {formatAccessStateLabel(snapshot, resolvedLocale)}
            </Text>
          </View>
        </View>

        {trialEndsLabel ? (
          <Text style={styles.subscriptionDetail}>
            {t('settings.subscription.current.trialEnds', { date: trialEndsLabel })}
          </Text>
        ) : null}
        {firstChargeLabel ? (
          <Text style={styles.subscriptionDetail}>
            {t('settings.subscription.current.billingStarts', { date: firstChargeLabel })}
          </Text>
        ) : null}
        {accessEndsLabel ? (
          <Text style={styles.subscriptionDetail}>
            {t('settings.subscription.current.currentAccessEnds', {
              date: accessEndsLabel,
            })}
          </Text>
        ) : null}
        {snapshot.planId ? (
          <Text style={styles.subscriptionDetail}>
            {isRecurringPlan
              ? managementUrl
                ? t('settings.subscription.current.recurringManagementAvailable')
                : t('settings.subscription.current.recurringManagementFallback')
              : t('settings.subscription.current.lifetimeInfo')}
          </Text>
        ) : null}

        <View style={styles.buttonGroup}>
          <SettingsButtonGroup compact={compactActionLayout}>
            {canOpenBillingOptions ? (
              <ActionButton
                appearance="primary"
                style={styles.inlineButton}
                onPress={() => {
                  router.push('/subscribe' as Href);
                }}
                testID={testIds.settings.subscriptionOpenPaywallButton}
              >
                {t('billing.screen.title')}
              </ActionButton>
            ) : null}
            {hasRecurringSubscriptionManagement ? (
              <ActionButton
                appearance="primary"
                style={styles.inlineButton}
                onPress={() => {
                  if (eligibleSaveOffer) {
                    router.push('/settings/subscription/save-offer' as Href);
                    return;
                  }
                  void openManageSubscriptions();
                }}
                testID={testIds.settings.subscriptionManageButton}
              >
                {t('settings.subscription.actions.manageSubscription')}
              </ActionButton>
            ) : null}
            <ActionButton
              appearance="secondary"
              disabled={isSyncing}
              style={styles.inlineButton}
              onPress={() => {
                void presentRestorePaywall();
              }}
              testID={testIds.settings.subscriptionRestoreButton}
            >
              {t('settings.subscription.actions.restorePurchases')}
            </ActionButton>
            <ActionButton
              appearance="secondary"
              disabled={isSyncing}
              style={styles.inlineButton}
              onPress={() => {
                void refreshBilling();
              }}
              testID={testIds.settings.subscriptionRefreshAccessButton}
            >
              {t('settings.subscription.actions.refreshAccess')}
            </ActionButton>
          </SettingsButtonGroup>
        </View>
      </SectionCard>

      <SectionCard
        description={t('settings.subscription.help.description')}
        title={t('settings.subscription.help.title')}
        presentation="unframed"
      >
        <View style={styles.buttonGroup}>
          <ActionButton
            appearance="secondary"
            onPress={() => {
              void Linking.openURL(florivaRuntimeBillingConfig.privacyPolicyUrl);
            }}
            testID={testIds.settings.subscriptionPrivacyPolicyButton}
          >
            {t('settings.subscription.actions.readPrivacyPolicy')}
          </ActionButton>
          <ActionButton
            appearance="secondary"
            onPress={() => {
              void handleContactSupport();
            }}
            testID={testIds.settings.subscriptionSupportButton}
          >
            {t('settings.subscription.actions.contactSupport')}
          </ActionButton>
        </View>
        {supportStatusMessage ? (
          <Text style={styles.bodyText}>{supportStatusMessage}</Text>
        ) : null}
      </SectionCard>
    </Screen>
  );
}

export function SettingsDataScreen() {
  const theme = useFlorivaTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const { t } = useLocalization();

  return (
    <Screen
      backAction={{
        label: t('settings.data.screen.backLabel'),
        onPress: () => {
          goBackOrReplace(router, '/settings' as Href);
        },
      }}
      eyebrow={t('settings.data.screen.eyebrow')}
      title={<ItalicTitle prefix="Your data, " accent="portable" suffix="." />}
      stickyTitle="Your data, portable."
      description={t('settings.data.screen.description')}
    >
      <SectionCard
        description={t('settings.data.deviceStorage.description')}
        title={t('settings.data.deviceStorage.title')}
      >
        <View style={styles.hubGroup}>
          <SettingsHubRow
            onPress={() => {
              router.push('/backup/export' as Href);
            }}
            summary={t('backup.export.description')}
            testID={testIds.settings.openBackupExportButton}
            title={t('backup.export.title')}
          />
          <SettingsHubRow
            onPress={() => {
              router.push('/backup/restore' as Href);
            }}
            summary={t('backup.restore.description')}
            testID={testIds.settings.openBackupRestoreButton}
            title={t('backup.restore.title')}
          />
        </View>
      </SectionCard>

      <SectionCard
        description={t('settings.data.imports.description')}
        title={t('settings.data.imports.title')}
      >
        <View style={styles.hubGroup}>
          <SettingsHubRow
            onPress={() => {
              router.push('/import' as Href);
            }}
            summary={t('import.screen.description')}
            testID={testIds.settings.openImportButton}
            title={t('settings.data.imports.openImport')}
          />
          <SettingsHubRow
            onPress={() => {
              router.push('/privacy' as Href);
            }}
            summary={t('privacy.explainer.imports.body')}
            testID={testIds.settings.openPrivacyExplainerButton}
            title={t('settings.data.imports.openPrivacy')}
          />
        </View>
      </SectionCard>

      <SectionCard
        description={t('settings.deleteData.danger.description')}
        title={t('settings.deleteData.danger.title')}
        titleTone="danger"
        presentation="unframed"
      >
        <Text style={styles.bodyText}>{t('privacy.explainer.deleteLocalData.body')}</Text>
        <ActionButton
          appearance="secondary"
          onPress={() => {
            router.push('/settings/delete-data' as Href);
          }}
          testID={testIds.settings.deleteDataButton}
        >
          {t('settings.hub.deleteDataTitle')}
        </ActionButton>
      </SectionCard>
    </Screen>
  );
}

export function SettingsDeleteDataScreen() {
  const theme = useFlorivaTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const { deleteAllData } = useAppShell();
  const { t } = useLocalization();
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirmDelete() {
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await deleteAllData();
      router.replace('/welcome');
    } catch {
      setDeleteError(t('settings.deleteData.error'));
      setIsDeleting(false);
    }
  }

  return (
    <Screen
      backAction={{
        label: t('settings.deleteData.screen.backLabel'),
        onPress: () => {
          goBackOrReplace(router, '/settings' as Href);
        },
      }}
      eyebrow={t('settings.deleteData.screen.eyebrow')}
      motionVariant="sensitive"
      title={
        <ItalicTitle
          prefix={t('settings.deleteData.screen.titlePrefix')}
          accent={t('settings.deleteData.screen.titleAccent')}
          suffix={t('settings.deleteData.screen.titleSuffix')}
        />
      }
      stickyTitle={t('settings.deleteData.screen.title')}
      description={t('settings.deleteData.screen.description')}
    >
      <SectionCard
        description={t('settings.deleteData.danger.description')}
        title={t('settings.deleteData.danger.title')}
        titleTone="danger"
      >
        {/* UL-56: the one true destructive action wears the destructive
            token, not a neutral bone outline identical to harmless buttons. */}
        <ActionButton
          appearance="destructive"
          onPress={() => {
            setDeleteError(null);
            setConfirmDeleteVisible(true);
          }}
          testID={testIds.settings.deleteDataButton}
        >
          {t('settings.deleteData.danger.deleteAll')}
        </ActionButton>

        {confirmDeleteVisible ? (
          <View style={styles.buttonGroup}>
            <Text style={styles.deleteWarning}>{t('settings.deleteData.warning')}</Text>
            {deleteError ? <Text style={styles.deleteError}>{deleteError}</Text> : null}
            <ActionButton
              appearance="destructive"
              disabled={isDeleting}
              onPress={handleConfirmDelete}
              testID={testIds.settings.confirmDeleteDataButton}
            >
              {t('settings.deleteData.confirm')}
            </ActionButton>
            <ActionButton
              appearance="secondary"
              disabled={isDeleting}
              onPress={() => {
                setDeleteError(null);
                setConfirmDeleteVisible(false);
              }}
              testID={testIds.settings.cancelDeleteDataButton}
            >
              {t('settings.deleteData.cancel')}
            </ActionButton>
          </View>
        ) : null}
      </SectionCard>

      <SectionCard
        description={t('settings.deleteData.beforeConfirm.description')}
        title={t('settings.deleteData.beforeConfirm.title')}
        presentation="unframed"
      >
        <Text style={styles.bodyText}>
          {t('settings.deleteData.beforeConfirm.backupFirst')}
        </Text>
        <Text style={styles.bodyText}>
          {t('settings.deleteData.beforeConfirm.resetPurpose')}
        </Text>
      </SectionCard>
    </Screen>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    titleComposite: {
      gap: theme.spacing.sm,
    },
    eyebrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    eyebrowAccentBar: {
      width: 14,
      height: 1,
      backgroundColor: theme.colors.accentPrimary,
    },
    eyebrowLabel: {
      ...theme.typography.eyebrow,
      color: theme.colors.textSecondary,
    },
    displayTitle: {
      fontFamily: 'Newsreader_400Regular',
      fontSize: 32,
      lineHeight: 36,
      letterSpacing: -0.5,
      color: theme.colors.textPrimary,
    },
    displayTitleAccent: {
      // UL-70: true italic serif face (was `fontStyle: 'italic'`, divergent
      // across platforms).
      fontFamily: fontFamilies.serifRegularItalic,
      fontSize: 32,
      lineHeight: 36,
      letterSpacing: -0.5,
      color: theme.colors.accentPrimary,
    },
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    profileCircle: {
      width: 52,
      height: 52,
      borderRadius: theme.radii.pill,
      borderWidth: 1.5,
      borderColor: theme.colors.accentPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileCircleNumeral: {
      ...theme.typography.numeral,
      fontSize: 18,
      lineHeight: 22,
      color: theme.colors.accentPrimary,
    },
    profileInfo: {
      flex: 1,
      gap: 2,
    },
    profileCyclesLabel: {
      ...theme.typography.bodyStrong,
      color: theme.colors.textPrimary,
    },
    profileDeviceLabel: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    versionFooter: {
      ...theme.typography.caption,
      color: theme.colors.textTertiary,
      textAlign: 'center',
      paddingVertical: theme.spacing.md,
    },
    hubGroup: {
      gap: 0,
    },
    subscriptionHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
    subscriptionPlanBlock: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    subscriptionLabel: {
      color: theme.colors.textMuted,
      ...theme.typography.caption,
    },
    subscriptionPlan: {
      color: theme.colors.text,
      ...theme.typography.subtitle,
    },
    subscriptionBadge: {
      borderRadius: theme.radii.pill,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    subscriptionBadgeActive: {
      backgroundColor: theme.colors.success,
    },
    subscriptionBadgeTrial: {
      backgroundColor: theme.colors.accentSoft,
    },
    subscriptionBadgeMuted: {
      backgroundColor: theme.colors.surfaceMuted,
    },
    subscriptionBadgeText: {
      color: theme.colors.text,
      ...theme.typography.caption,
    },
    subscriptionDetail: {
      color: theme.colors.textMuted,
      ...theme.typography.body,
    },
    privacySummaryRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    privacySummaryColumn: {
      flexDirection: 'column',
    },
    privacyControlGroup: {
      gap: theme.spacing.sm,
    },
    controlGroupLabel: {
      color: theme.colors.text,
      ...theme.typography.bodyStrong,
    },
    optionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    optionButton: {
      flexGrow: 1,
      flexShrink: 0,
      minWidth: 112,
    },
    birthControlReminderActions: {
      gap: theme.spacing.sm,
    },
    birthControlReminderAdjustmentRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    compactActionButton: {
      minHeight: 48,
      paddingHorizontal: theme.spacing.lg,
    },
    reminderStack: {
      gap: theme.spacing.md,
    },
    reminderCenter: {
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceMuted,
    },
    reminderCenterRow: {
      gap: 2,
      paddingVertical: theme.spacing.xs,
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderPrimary,
    },
    reminderCard: {
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: theme.colors.borderPrimary,
    },
    reminderHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
    reminderTitleBlock: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    reminderTitle: {
      color: theme.colors.text,
      ...theme.typography.bodyStrong,
    },
    reminderSummary: {
      color: theme.colors.textMuted,
      ...theme.typography.body,
    },
    reminderStatusBadge: {
      borderRadius: theme.radii.pill,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    reminderStatusBadgeActive: {
      backgroundColor: theme.colors.accentSoft,
    },
    reminderStatusBadgeMuted: {
      backgroundColor: theme.colors.surfaceMuted,
    },
    reminderStatusText: {
      color: theme.colors.text,
      ...theme.typography.caption,
    },
    reminderDetail: {
      color: theme.colors.textMuted,
      ...theme.typography.caption,
    },
    expandedReminderPanel: {
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceMuted,
    },
    inlineButtonRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    inlineButtonColumn: {
      flexDirection: 'column',
    },
    inlineButton: {
      flex: 1,
    },
    buttonGroup: {
      gap: theme.spacing.sm,
    },
    helperText: {
      color: theme.colors.textMuted,
      ...theme.typography.caption,
    },
    e2eHiddenDiagnostics: {
      position: 'absolute',
      width: 1,
      height: 1,
      opacity: 0,
    },
    bodyText: {
      color: theme.colors.textMuted,
      ...theme.typography.body,
    },
    deleteWarning: {
      color: theme.colors.textMuted,
      ...theme.typography.body,
    },
    deleteError: {
      color: theme.colors.danger,
      ...theme.typography.bodyStrong,
    },
  });
}
