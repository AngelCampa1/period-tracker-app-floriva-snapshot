import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { ActionButton } from '@/src/components/primitives/ActionButton';
import { HelpTooltip } from '@/src/components/primitives/HelpTooltip';
import { SelectionChip } from '@/src/components/primitives/SelectionChip';
import { Screen } from '@/src/components/primitives/Screen';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import { useDatabase } from '@/src/db/DatabaseProvider';
import { defaultUserProfile } from '@/src/features/app-shell/defaults';
import { buildConditionTemplateContext } from '@/src/features/logging/conditionTemplates';
import { attemptAutomaticReviewPrompt } from '@/src/features/review/automaticReview';
import { hasEnabledTtcMode } from '@/src/features/ttc/summary';
import {
  getBleedingOptions,
  getBirthControlMethodOptions,
  getCervicalMucusOptions,
  getMoodOptions,
  getOvulationTestOptions,
  getSymptomOptions,
} from '@/src/features/logging/constants';
import {
  areDailyLogEntriesEquivalent,
  buildDailyLogEntry,
  createDailyLogDraft,
  createEmptyDailyLogDraft,
  getBasalBodyTemperatureValidationMessage,
} from '@/src/features/logging/draft';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import {
  buildTodayConditionBadgeTestId,
  buildTodayLoggingChipTestId,
  testIds,
} from '@/src/testing/testIds';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';
import type {
  BleedingIntensity,
  DailyLogEntry,
  SupportedLocale,
  SymptomKey,
  UserProfile,
} from '@/src/types/domain';

type TodayLoggingScreenProps = {
  logDate: string;
};

type LoggingCardSurface = 'today' | 'selected-day';

export function TodayLoggingScreen({ logDate }: TodayLoggingScreenProps) {
  const { resolvedLocale, t } = useLocalization();

  return (
    <Screen
      eyebrow={t('logging.screen.eyebrow')}
      title={t('logging.screen.title')}
      description={t('logging.screen.description')}
    >
      <TodayLoggingCard logDate={logDate} locale={resolvedLocale} surface="today" />
    </Screen>
  );
}

type TodayLoggingCardProps = TodayLoggingScreenProps & {
  locale: SupportedLocale;
  onEntryChanged?: () => void;
  surface?: LoggingCardSurface;
  // Pre-selects a bleeding intensity on load (used by the "Quick log"
  // notification action — see CalendarDayScreen's `quick=period` handling).
  // Pre-selects only; the user still has to tap Save, and it never overwrites
  // an already-logged bleeding value for the day.
  quickPreselectBleeding?: BleedingIntensity;
};

function resolveLoggingCopy(
  surface: LoggingCardSurface,
  t: ReturnType<typeof useLocalization>['t'],
) {
  if (surface === 'selected-day') {
    return {
      cardTitle: t('logging.card.titleThisDay'),
      cardDescription: t('logging.card.descriptionThisDay'),
      cardLoading: t('logging.card.loadingThisDay'),
      startWithWhatChanged: t('logging.status.startWithWhatChangedThisDay'),
      saveLog: t('logging.status.saveThisLog'),
      loadError: t('logging.errors.loadThisDay'),
      saveError: t('logging.errors.saveThisDay'),
      deleteError: t('logging.errors.deleteThisDay'),
      notesPlaceholder: t('logging.placeholders.notesThisDay'),
    };
  }

  return {
    cardTitle: t('logging.card.title'),
    cardDescription: t('logging.card.description'),
    cardLoading: t('logging.card.loading'),
    startWithWhatChanged: t('logging.status.startWithWhatChanged'),
    saveLog: t('logging.status.saveTodayLog'),
    loadError: t('logging.errors.load'),
    saveError: t('logging.errors.save'),
    deleteError: t('logging.errors.delete'),
    notesPlaceholder: t('logging.placeholders.notes'),
  };
}

export function TodayLoggingCard({
  logDate,
  locale,
  onEntryChanged,
  surface = 'today',
  quickPreselectBleeding,
}: TodayLoggingCardProps) {
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { repositories } = useDatabase();
  const { t } = useLocalization();
  const copy = resolveLoggingCopy(surface, t);
  const [draft, setDraft] = useState(createEmptyDailyLogDraft);
  const [profile, setProfile] = useState<UserProfile>(defaultUserProfile);
  const [existingEntry, setExistingEntry] = useState<DailyLogEntry | null>(null);
  const [birthControlTrackingEnabled, setBirthControlTrackingEnabled] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [pendingAutomaticReviewCheck, setPendingAutomaticReviewCheck] = useState(0);

  function updateDraft(nextDraft: Parameters<typeof setDraft>[0]) {
    setDraft(nextDraft);
    setFeedbackMessage(null);
    setErrorMessage(null);
  }

  useEffect(() => {
    let isActive = true;

    async function loadEntry() {
      setIsHydrating(true);
      setErrorMessage(null);
      setFeedbackMessage(null);

      try {
        const [currentEntry, storedProfile, reminderPreferences] = await Promise.all([
          repositories.dailyLogs.getEntryByDate(logDate),
          repositories.userProfile.getProfile(),
          repositories.reminderPreferences.getPreferences(),
        ]);

        if (!isActive) {
          return;
        }

        setExistingEntry(currentEntry);
        const loadedDraft = createDailyLogDraft(currentEntry);
        // Quick-log pre-selection: only fills in a bleeding value when the day
        // has none logged yet. Never overwrites an already-logged entry, and
        // never auto-saves — the user still has to tap Save.
        setDraft(
          quickPreselectBleeding && !currentEntry?.bleeding
            ? { ...loadedDraft, bleeding: quickPreselectBleeding }
            : loadedDraft,
        );
        setProfile(storedProfile ?? defaultUserProfile);
        setBirthControlTrackingEnabled(
          currentEntry?.birthControlEvent !== undefined ||
            Boolean(storedProfile?.birthControlMethod) ||
            reminderPreferences.some(
              (preference) => preference.kind === 'birth-control' && preference.enabled,
            ),
        );
      } catch {
        if (!isActive) {
          return;
        }

        setErrorMessage(copy.loadError);
      } finally {
        if (isActive) {
          setIsHydrating(false);
        }
      }
    }

    void loadEntry();

    return () => {
      isActive = false;
    };
  }, [
    logDate,
    quickPreselectBleeding,
    repositories.dailyLogs,
    repositories.reminderPreferences,
    repositories.userProfile,
    copy.loadError,
  ]);

  useEffect(() => {
    if (pendingAutomaticReviewCheck === 0 || feedbackMessage !== t('logging.status.savedLocal')) {
      return;
    }

    const timeoutId = setTimeout(() => {
      void attemptAutomaticReviewPrompt({
        repositories,
      }).catch(() => undefined);
      setPendingAutomaticReviewCheck(0);
    }, 500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [feedbackMessage, pendingAutomaticReviewCheck, repositories, t]);

  async function handleSave() {
    setIsSubmitting(true);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      const basalBodyTemperatureMessage = getBasalBodyTemperatureValidationMessage(
        draft.ttcObservation.basalBodyTemperatureInput,
        locale,
      );

      if (basalBodyTemperatureMessage) {
        setErrorMessage(basalBodyTemperatureMessage);
        return;
      }

      const currentEntry = await repositories.dailyLogs.getEntryByDate(logDate);
      const nextEntry = buildDailyLogEntry({
        draft,
        existingEntry: currentEntry,
        logDate,
      });

      if (!nextEntry) {
        return;
      }

      await repositories.dailyLogs.saveEntry(nextEntry);

      const savedEntry = await repositories.dailyLogs.getEntryByDate(logDate);

      setExistingEntry(savedEntry);
      setDraft(createDailyLogDraft(savedEntry));
      setConfirmDeleteVisible(false);
      setFeedbackMessage(t('logging.status.savedLocal'));
      try {
        await repositories.reviewPromptState.recordSuccessfulSave(
          logDate,
          new Date().toISOString(),
        );
        setPendingAutomaticReviewCheck(Date.now());
      } catch {
        setPendingAutomaticReviewCheck(0);
      }
      onEntryChanged?.();
    } catch {
      setErrorMessage(copy.saveError);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    setIsSubmitting(true);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      const currentEntry = await repositories.dailyLogs.getEntryByDate(logDate);

      if (!currentEntry) {
        setExistingEntry(null);
        setDraft(createEmptyDailyLogDraft());
        setConfirmDeleteVisible(false);
        setFeedbackMessage(t('logging.status.alreadyRemoved'));
        return;
      }

      await repositories.dailyLogs.deleteEntry(currentEntry.id);

      setExistingEntry(null);
      setDraft(createEmptyDailyLogDraft());
      setConfirmDeleteVisible(false);
      setFeedbackMessage(t('logging.status.deletedLocal'));
      onEntryChanged?.();
    } catch {
      setErrorMessage(copy.deleteError);
    } finally {
      setIsSubmitting(false);
    }
  }

  const conditionContext = buildConditionTemplateContext(profile.conditionTags, locale);
  const ttcTrackingPreferences =
    profile.ttcTrackingPreferences ?? defaultUserProfile.ttcTrackingPreferences;
  const highlightedSymptoms = conditionContext.highlightedSymptoms;
  const bleedingOptions = useMemo(() => getBleedingOptions(locale), [locale]);
  const moodOptions = useMemo(() => getMoodOptions(locale), [locale]);
  const symptomOptions = useMemo(() => getSymptomOptions(locale), [locale]);
  const birthControlMethodOptions = useMemo(
    () => getBirthControlMethodOptions(locale),
    [locale],
  );
  const ovulationTestOptions = useMemo(() => getOvulationTestOptions(locale), [locale]);
  const cervicalMucusOptions = useMemo(() => getCervicalMucusOptions(locale), [locale]);
  const orderedSymptomOptions = [
    ...symptomOptions.filter((option) => highlightedSymptoms.includes(option.value)),
    ...symptomOptions.filter((option) => !highlightedSymptoms.includes(option.value)),
  ];
  const showTtcSection = hasEnabledTtcMode(profile);
  const showBirthControlSection = Boolean(
    birthControlTrackingEnabled || draft.birthControlEvent.method,
  );
  const bbtValidationMessage = getBasalBodyTemperatureValidationMessage(
    draft.ttcObservation.basalBodyTemperatureInput,
  );
  const pendingEntry = buildDailyLogEntry({
    draft,
    existingEntry,
    logDate,
  });
  const hasUnsavedChanges = existingEntry
    ? !areDailyLogEntriesEquivalent(existingEntry, pendingEntry)
    : pendingEntry !== null;
  const saveHelperMessage =
    bbtValidationMessage
      ? null
      : pendingEntry === null
      ? existingEntry
        ? t('logging.status.everythingCleared')
        : t('logging.status.addSomething')
      : !hasUnsavedChanges
        ? t('logging.status.noUnsavedChanges')
        : null;
  const saveDisabled =
    isSubmitting || Boolean(bbtValidationMessage) || pendingEntry === null || !hasUnsavedChanges;
  const showSaveAction = isSubmitting || !existingEntry || hasUnsavedChanges;
  const visibleSaveHelperMessage = showSaveAction ? saveHelperMessage : null;
  const draftStatusTitle =
    existingEntry && !hasUnsavedChanges
      ? t('logging.status.savedForThisDay')
      : pendingEntry === null
        ? t('logging.status.nothingAddedYet')
        : hasUnsavedChanges
          ? t('logging.status.readyToSave')
          : copy.startWithWhatChanged;
  const draftStatusBody =
    existingEntry && !hasUnsavedChanges
      ? t('logging.status.updateAnything')
      : pendingEntry === null
        ? t('logging.status.tapAnySignal')
        : t('logging.status.reviewSelected');

  return (
    <SectionCard
      description={copy.cardDescription}
      presentation="grouped"
      testID={testIds.today.loggingCard}
      title={copy.cardTitle}
    >
      {isHydrating ? (
        <Text style={styles.helper}>{copy.cardLoading}</Text>
      ) : (
        <View style={styles.form}>
          <View style={styles.statusPanel}>
            <Text style={styles.statusTitle}>{draftStatusTitle}</Text>
            <Text style={styles.helper}>{draftStatusBody}</Text>
          </View>

          <FieldGroup
            description={t('logging.fields.bleeding.description')}
            title={t('logging.fields.bleeding.title')}
          >
            <View style={styles.optionRow}>
              {bleedingOptions.map((option) => (
                <SelectableChip
                  disabled={isSubmitting}
                  testID={buildTodayLoggingChipTestId('bleeding', option.value)}
                  indicatorTestID={buildSelectableChipIndicatorTestId('bleeding', option.value)}
                  key={option.value}
                  isSelected={draft.bleeding === option.value}
                  label={option.label}
                  onPress={() => {
                    updateDraft((currentDraft) => ({
                      ...currentDraft,
                      bleeding:
                        currentDraft.bleeding === option.value
                          ? undefined
                          : option.value,
                    }));
                  }}
                />
              ))}
            </View>
          </FieldGroup>

          <FieldGroup title={t('logging.fields.symptoms.title')}>
            {conditionContext.templates.length > 0 ? (
              <View
                style={styles.conditionBadgeRow}
                testID={testIds.today.conditionLoggingContext}
              >
                {conditionContext.templates.map((template) => (
                  <View
                    key={template.key}
                    style={styles.conditionBadge}
                    testID={buildTodayConditionBadgeTestId(template.key)}
                  >
                    <Text style={styles.conditionBadgeText}>{template.title}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={styles.optionRow}>
              {orderedSymptomOptions.map((option) => (
                <SelectableChip
                  disabled={isSubmitting}
                  testID={buildTodayLoggingChipTestId('symptoms', option.value)}
                  indicatorTestID={buildSelectableChipIndicatorTestId('symptoms', option.value)}
                  key={option.value}
                  isHighlighted={highlightedSymptoms.includes(option.value)}
                  isSelected={draft.symptoms.includes(option.value)}
                  label={option.label}
                  multiSelect
                  onPress={() => {
                    updateDraft((currentDraft) => ({
                      ...currentDraft,
                      symptoms: toggleSymptom(currentDraft.symptoms, option.value),
                    }));
                  }}
                />
              ))}
            </View>
          </FieldGroup>

          {showBirthControlSection ? (
            <FieldGroup
              title={t('logging.fields.birthControl.title')}
              description={t('logging.fields.birthControl.description')}
            >
              <View style={styles.optionRow} testID={testIds.today.birthControlLoggingControls}>
                {birthControlMethodOptions.map((option) => (
                  <SelectableChip
                    disabled={isSubmitting}
                    testID={buildTodayLoggingChipTestId('birth-control-method', option.value)}
                    indicatorTestID={buildSelectableChipIndicatorTestId(
                      'birth-control-method',
                      option.value,
                    )}
                    key={option.value}
                    isSelected={draft.birthControlEvent.method === option.value}
                    label={option.label}
                    onPress={() => {
                      updateDraft((currentDraft) => ({
                        ...currentDraft,
                        birthControlEvent:
                          currentDraft.birthControlEvent.method === option.value
                            ? {
                                method: undefined,
                                missedDose: false,
                                lateDose: false,
                              }
                            : {
                                method: option.value,
                                missedDose:
                                  option.value === 'pill'
                                    ? currentDraft.birthControlEvent.missedDose
                                    : false,
                                lateDose:
                                  option.value === 'pill'
                                    ? currentDraft.birthControlEvent.lateDose
                                    : false,
                              },
                      }));
                    }}
                  />
                ))}
              </View>

              {draft.birthControlEvent.method === 'pill' ? (
                <View style={styles.optionRow}>
                  <SelectableChip
                    disabled={isSubmitting}
                    testID={buildTodayLoggingChipTestId(
                      'birth-control-pill',
                      'missed-dose',
                    )}
                    indicatorTestID={buildSelectableChipIndicatorTestId(
                      'birth-control-pill',
                      'missed-dose',
                    )}
                    isSelected={draft.birthControlEvent.missedDose}
                    label={t('logging.options.birthControlPill.missedDose')}
                    onPress={() => {
                      updateDraft((currentDraft) => ({
                        ...currentDraft,
                        birthControlEvent: {
                          ...currentDraft.birthControlEvent,
                          missedDose: !currentDraft.birthControlEvent.missedDose,
                        },
                      }));
                    }}
                  />
                  <SelectableChip
                    disabled={isSubmitting}
                    testID={buildTodayLoggingChipTestId('birth-control-pill', 'late-dose')}
                    indicatorTestID={buildSelectableChipIndicatorTestId(
                      'birth-control-pill',
                      'late-dose',
                    )}
                    isSelected={draft.birthControlEvent.lateDose}
                    label={t('logging.options.birthControlPill.lateDose')}
                    onPress={() => {
                      updateDraft((currentDraft) => ({
                        ...currentDraft,
                        birthControlEvent: {
                          ...currentDraft.birthControlEvent,
                          lateDose: !currentDraft.birthControlEvent.lateDose,
                        },
                      }));
                    }}
                  />
                </View>
              ) : null}
            </FieldGroup>
          ) : null}

          {showTtcSection ? (
            <FieldGroup
              title={t('logging.fields.ttcTracking.title')}
              description={t('logging.fields.ttcTracking.description')}
              help={
                <HelpTooltip
                  body={t('common.help.sensitiveLogging.body')}
                  closeLabel={t('common.actions.close')}
                  testID="logging-trying-to-conceive-help"
                  title={t('common.help.sensitiveLogging.title')}
                />
              }
            >
              <View testID={testIds.today.ttcLoggingControls}>
                {ttcTrackingPreferences?.sex ? (
                  <View style={styles.optionBlock}>
                    <View style={styles.inlineHelpRow}>
                      <Text style={styles.compactInputLabel}>Sex</Text>
                      <HelpTooltip
                        body={t('common.help.sensitiveLogging.body')}
                        closeLabel={t('common.actions.close')}
                        testID="logging-sex-help"
                        title="Sex"
                      />
                    </View>
                    <View style={styles.optionRow}>
                      <SelectableChip
                        disabled={isSubmitting}
                        testID={buildTodayLoggingChipTestId('ttc', 'sex-logged')}
                        indicatorTestID={buildSelectableChipIndicatorTestId('ttc', 'sex-logged')}
                        isSelected={draft.ttcObservation.sexLogged}
                        label={t('logging.options.ttc.sexLogged')}
                        onPress={() => {
                          updateDraft((currentDraft) => ({
                            ...currentDraft,
                            ttcObservation: {
                              ...currentDraft.ttcObservation,
                              sexLogged: !currentDraft.ttcObservation.sexLogged,
                            },
                          }));
                        }}
                      />
                    </View>
                  </View>
                ) : null}

                {ttcTrackingPreferences?.ovulationTest ? (
                  <View style={styles.optionBlock}>
                  <View style={styles.inlineHelpRow}>
                    <Text style={styles.compactInputLabel}>Ovulation test</Text>
                    <HelpTooltip
                      body={t('common.help.ovulationEstimate.body')}
                      closeLabel={t('common.actions.close')}
                      testID="logging-ovulation-test-help"
                      title={t('common.help.ovulationEstimate.title')}
                    />
                  </View>
                  <View style={styles.optionRow}>
                    {ovulationTestOptions.map((option) => (
                      <SelectableChip
                        disabled={isSubmitting}
                        testID={buildTodayLoggingChipTestId('ovulation-test', option.value)}
                        indicatorTestID={buildSelectableChipIndicatorTestId(
                          'ovulation-test',
                          option.value,
                        )}
                        key={option.value}
                        isSelected={draft.ttcObservation.ovulationTest === option.value}
                        label={option.label}
                        onPress={() => {
                          updateDraft((currentDraft) => ({
                            ...currentDraft,
                            ttcObservation: {
                              ...currentDraft.ttcObservation,
                              ovulationTest:
                                currentDraft.ttcObservation.ovulationTest === option.value
                                  ? undefined
                                  : option.value,
                            },
                          }));
                        }}
                      />
                    ))}
                  </View>
                  </View>
                ) : null}

                {ttcTrackingPreferences?.cervicalMucus ? (
                  <View style={styles.optionBlock}>
                  <View style={styles.inlineHelpRow}>
                    <Text style={styles.compactInputLabel}>{t('common.help.cervicalMucus.title')}</Text>
                    <HelpTooltip
                      body={t('common.help.cervicalMucus.body')}
                      closeLabel={t('common.actions.close')}
                      testID="logging-cervical-mucus-help"
                      title={t('common.help.cervicalMucus.title')}
                    />
                  </View>
                  <View style={styles.optionRow}>
                    {cervicalMucusOptions.map((option) => (
                      <SelectableChip
                        disabled={isSubmitting}
                        testID={buildTodayLoggingChipTestId('cervical-mucus', option.value)}
                        indicatorTestID={buildSelectableChipIndicatorTestId(
                          'cervical-mucus',
                          option.value,
                        )}
                        key={option.value}
                        isSelected={draft.ttcObservation.cervicalMucus === option.value}
                        label={option.label}
                        onPress={() => {
                          updateDraft((currentDraft) => ({
                            ...currentDraft,
                            ttcObservation: {
                              ...currentDraft.ttcObservation,
                              cervicalMucus:
                                currentDraft.ttcObservation.cervicalMucus === option.value
                                  ? undefined
                                  : option.value,
                            },
                          }));
                        }}
                      />
                    ))}
                  </View>
                  </View>
                ) : null}

                {ttcTrackingPreferences?.basalBodyTemperature ? (
                  <View style={styles.compactInputGroup}>
                  <View style={styles.inlineHelpRow}>
                    <Text style={styles.compactInputLabel}>
                      {t('logging.fields.ttcTracking.bbtLabel')}
                    </Text>
                    <HelpTooltip
                      body={t('common.help.bbt.body')}
                      closeLabel={t('common.actions.close')}
                      testID="logging-bbt-help"
                      title={t('common.help.bbt.title')}
                    />
                  </View>
                  <TextInput
                    accessibilityLabel={t('logging.fields.ttcTracking.bbtLabel')}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isSubmitting}
                    keyboardType="decimal-pad"
                    onChangeText={(basalBodyTemperatureInput) => {
                      updateDraft((currentDraft) => ({
                        ...currentDraft,
                        ttcObservation: {
                          ...currentDraft.ttcObservation,
                          basalBodyTemperatureInput,
                        },
                      }));
                    }}
                    placeholder={t('logging.placeholders.bbtExample')}
                    placeholderTextColor={theme.colors.textSecondary}
                    style={styles.compactInput}
                    testID={testIds.today.bbtInput}
                    value={draft.ttcObservation.basalBodyTemperatureInput}
                  />
                  </View>
                ) : null}
              </View>
            </FieldGroup>
          ) : null}

          <FieldGroup title={t('logging.fields.mood.title')}>
            <View style={styles.optionRow}>
              {moodOptions.map((option) => (
                <SelectableChip
                  disabled={isSubmitting}
                  testID={buildTodayLoggingChipTestId('mood', option.value)}
                  indicatorTestID={buildSelectableChipIndicatorTestId('mood', option.value)}
                  key={option.value}
                  isSelected={draft.mood === option.value}
                  label={option.label}
                  onPress={() => {
                    updateDraft((currentDraft) => ({
                      ...currentDraft,
                      mood:
                        currentDraft.mood === option.value
                          ? undefined
                          : option.value,
                    }));
                  }}
                />
              ))}
            </View>
          </FieldGroup>

          <FieldGroup title={t('logging.fields.notes.title')}>
            <TextInput
              multiline
              editable={!isSubmitting}
              maxLength={500}
              onChangeText={(notes) => {
                updateDraft((currentDraft) => ({
                  ...currentDraft,
                  notes,
                }));
              }}
              placeholder={copy.notesPlaceholder}
              placeholderTextColor={theme.colors.textSecondary}
              style={styles.notesInput}
              testID={testIds.today.notesInput}
              textAlignVertical="top"
              value={draft.notes}
            />
          </FieldGroup>

          {feedbackMessage ? (
            <Text style={styles.success} testID={testIds.today.feedbackMessage}>
              {feedbackMessage}
            </Text>
          ) : null}
          {errorMessage || bbtValidationMessage ? (
            <Text style={styles.error}>{errorMessage ?? bbtValidationMessage}</Text>
          ) : null}

          <View style={styles.actions}>
            {confirmDeleteVisible ? (
              <>
                <Text style={styles.error}>{t('logging.status.deleteConfirm')}</Text>
                <ActionButton
                  appearance="secondary"
                  disabled={isSubmitting}
                  onPress={() => {
                    setConfirmDeleteVisible(false);
                    setErrorMessage(null);
                  }}
                  testID={testIds.today.deleteCancelButton}
                >
                  {t('logging.status.keepEntry')}
                </ActionButton>
                <ActionButton
                  disabled={isSubmitting}
                  onPress={() => {
                    void handleDelete();
                  }}
                  testID={testIds.today.deleteConfirmButton}
                >
                  {isSubmitting ? t('logging.status.working') : t('logging.status.confirmDelete')}
                </ActionButton>
              </>
            ) : (
              <>
                {showSaveAction ? (
                  <ActionButton
                    disabled={saveDisabled}
                  onPress={() => {
                    void handleSave();
                  }}
                  testID={testIds.today.saveButton}
                >
                  {isSubmitting ? t('logging.status.saving') : copy.saveLog}
                </ActionButton>
              ) : null}
                {visibleSaveHelperMessage ? (
                  <Text style={styles.helper} testID="today-save-helper-message">
                    {visibleSaveHelperMessage}
                  </Text>
                ) : null}

                {existingEntry ? (
                  <ActionButton
                    appearance="secondary"
                    disabled={isSubmitting}
                    onPress={() => {
                      setConfirmDeleteVisible(true);
                      setFeedbackMessage(null);
                      setErrorMessage(null);
                    }}
                    testID={testIds.today.deleteButton}
                  >
                    {isSubmitting ? t('logging.status.working') : t('logging.status.deleteEntry')}
                  </ActionButton>
                ) : null}
              </>
            )}
          </View>
        </View>
      )}
    </SectionCard>
  );
}

type FieldGroupProps = {
  children: ReactNode;
  title: string;
  description?: string;
  help?: ReactNode;
};

function FieldGroup({ children, description, help, title }: FieldGroupProps) {
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.fieldGroup}>
      <View style={styles.fieldHeader}>
        <View style={styles.inlineHelpRow}>
          <Text style={styles.fieldTitle}>{title}</Text>
          {help}
        </View>
        {description ? <Text style={styles.helper}>{description}</Text> : null}
      </View>
      {children}
    </View>
  );
}

type SelectableChipProps = {
  disabled?: boolean;
  isHighlighted?: boolean;
  isSelected: boolean;
  indicatorTestID?: string;
  label: string;
  multiSelect?: boolean;
  onPress: () => void;
  testID?: string;
};

function SelectableChip({
  disabled = false,
  isHighlighted = false,
  isSelected,
  indicatorTestID,
  label,
  multiSelect = false,
  onPress,
  testID,
}: SelectableChipProps) {
  return (
    <SelectionChip
      disabled={disabled}
      highlighted={isHighlighted}
      indicatorTestID={indicatorTestID}
      label={label}
      onPress={onPress}
      selected={isSelected}
      selectionIndicator={multiSelect ? 'check' : 'dot'}
      size="tall"
      testID={testID}
    />
  );
}

function toggleSymptom(currentSymptoms: SymptomKey[], symptom: SymptomKey) {
  return currentSymptoms.includes(symptom)
    ? currentSymptoms.filter((currentSymptom) => currentSymptom !== symptom)
    : [...currentSymptoms, symptom];
}

function buildSelectableChipIndicatorTestId(group: string, value: string) {
  return `selectable-chip-indicator-${group}-${value}`;
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    form: {
      gap: theme.spacing.lg,
    },
    statusPanel: {
      gap: theme.spacing.xs,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.borderPrimary,
      backgroundColor: theme.colors.surfaceSubtle,
    },
    statusTitle: {
      color: theme.colors.textPrimary,
      ...theme.typography.bodyStrong,
    },
    conditionBadgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: theme.spacing.md,
      rowGap: theme.spacing.xs,
    },
    // UL-64: these are informational context tags ("your symptom list is
    // tailored for PMDD patterns"), not selectable chips — but the old
    // pill border + fill made them pixel-siblings of the tappable symptom
    // chips right below, reading as broken chips with a missing checkbox.
    // They now speak the eyebrow label voice: no chrome, quiet uppercase.
    conditionBadge: {
      paddingVertical: theme.spacing.xs,
    },
    conditionBadgeText: {
      color: theme.colors.textTertiary,
      ...theme.typography.eyebrow,
    },
    compactInputGroup: {
      gap: theme.spacing.xs,
    },
    optionBlock: {
      gap: theme.spacing.xs,
    },
    inlineHelpRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    compactInputLabel: {
      color: theme.colors.textSecondary,
      ...theme.typography.caption,
    },
    fieldGroup: {
      gap: theme.spacing.sm,
    },
    fieldHeader: {
      gap: theme.spacing.xs,
    },
    fieldTitle: {
      color: theme.colors.textPrimary,
      ...theme.typography.bodyStrong,
    },
    helper: {
      color: theme.colors.textSecondary,
      ...theme.typography.caption,
    },
    optionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    notesInput: {
      minHeight: 128,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.inputBorder,
      backgroundColor: theme.colors.inputFill,
      color: theme.colors.textPrimary,
      ...theme.typography.body,
    },
    compactInput: {
      minHeight: 56,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.inputBorder,
      backgroundColor: theme.colors.inputFill,
      color: theme.colors.textPrimary,
      ...theme.typography.body,
    },
    actions: {
      gap: theme.spacing.sm,
    },
    success: {
      color: theme.colors.success,
      ...theme.typography.caption,
    },
    error: {
      color: theme.colors.danger,
      ...theme.typography.caption,
    },
  });
}
