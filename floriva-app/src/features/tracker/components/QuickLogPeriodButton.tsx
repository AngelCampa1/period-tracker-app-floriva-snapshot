import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/primitives/Text';
import { SectionCard } from '@/src/components/primitives/SectionCard';
import { useDatabase } from '@/src/db/DatabaseProvider';
import { buildCalendarDayRoute } from '@/src/features/app-shell/resolveAppEntry';
import { buildQuickLogAction } from '@/src/features/tracker/buildQuickLogAction';
import { buildDailyLogEntry, createDailyLogDraft } from '@/src/features/logging/draft';
import { useLocalization } from '@/src/localization/LocalizationProvider';
import { testIds } from '@/src/testing/testIds';
import type { FlorivaTheme } from '@/src/theme/tokens';
import { useFlorivaTheme } from '@/src/theme/useFlorivaTheme';
import type { DailyLogEntry, PredictionSnapshot } from '@/src/types/domain';

type QuickLogPeriodButtonProps = {
  todayIso: string;
  snapshot: Pick<PredictionSnapshot, 'nextPeriodStartIso'>;
  refreshVersion?: number;
  onLogged?: () => void;
};

/**
 * Today-screen fast path for "my period is starting" — one tap saves a
 * medium-flow entry for today via the same repositories.dailyLogs +
 * buildDailyLogEntry write path the full logging screen uses. This is
 * intentionally a separate, minimal write path from TodayLoggingCard's
 * handleSave: it never calls attemptAutomaticReviewPrompt (that hook is
 * opt-in, fired only by explicit call sites), so tapping this button never
 * triggers the store-review prompt.
 *
 * Visibility is delegated to the pure buildQuickLogAction: shown only in the
 * few-day window around the predicted period start, and only while today has
 * no bleeding logged yet (see buildQuickLogAction.ts for the exact window).
 */
export function QuickLogPeriodButton({
  todayIso,
  snapshot,
  refreshVersion = 0,
  onLogged,
}: QuickLogPeriodButtonProps) {
  const theme = useFlorivaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { repositories } = useDatabase();
  const { t } = useLocalization();
  const [todayEntry, setTodayEntry] = useState<DailyLogEntry | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Resets the "saved" confirmation only when the calendar day this button
  // targets actually changes (e.g. app stays open across midnight) — not on
  // every refreshVersion bump, since onLogged below causes the parent
  // screen to bump its own refresh counter right after a save, which must
  // not immediately wipe the confirmation it just triggered.
  useEffect(() => {
    setIsSaved(false);
  }, [todayIso]);

  useEffect(() => {
    let isCancelled = false;
    setIsHydrating(true);

    async function hydrateTodayEntry() {
      try {
        const entry = await repositories.dailyLogs.getEntryByDate(todayIso);

        if (!isCancelled) {
          setTodayEntry(entry);

          // Adjust round-trip: if the user cleared today's bleeding in the
          // full editor (or deleted the entry) and came back, the "Saved"
          // latch is stale — drop it so the quick-log button is offered
          // again. A read failure (catch below) is NOT evidence bleeding
          // was cleared, so the latch survives there.
          if (!entry || entry.bleeding === undefined || entry.bleeding === 'none') {
            setIsSaved(false);
          }
        }
      } catch {
        if (!isCancelled) {
          setTodayEntry(null);
        }
      } finally {
        if (!isCancelled) {
          setIsHydrating(false);
        }
      }
    }

    void hydrateTodayEntry();

    return () => {
      isCancelled = true;
    };
  }, [repositories.dailyLogs, refreshVersion, todayIso]);

  const action = buildQuickLogAction({
    todayIso,
    snapshot,
    todayEntry,
  });

  async function handleQuickLog() {
    setIsSaving(true);
    setSaveError(null);

    try {
      // Re-fetch the entry at save time (same pattern as TodayLoggingCard's
      // handleSave) rather than trusting the in-state copy: another surface
      // may have written today's log since this component hydrated, and
      // persisting a stale-seeded entry would silently wipe those signals.
      const currentEntry = await repositories.dailyLogs.getEntryByDate(todayIso);

      // Seed the draft from the existing entry so already-logged symptoms,
      // mood, notes, TTC observations, and birth-control events survive the
      // quick-log — buildDailyLogEntry takes those fields from the DRAFT,
      // so an empty draft here would erase them. Only bleeding is overridden.
      //
      // If the re-fetch shows bleeding was already logged since hydration
      // (same race), keep that value rather than downgrading it to medium —
      // mirroring the quickPreselectBleeding rule that a quick action never
      // overwrites an already-logged bleeding value for the day.
      //
      const currentDraft = createDailyLogDraft(currentEntry);
      const nextEntry = buildDailyLogEntry({
        draft: {
          ...currentDraft,
          bleeding:
            currentDraft.bleeding && currentDraft.bleeding !== 'none'
              ? currentDraft.bleeding
              : 'medium',
        },
        existingEntry: currentEntry,
        logDate: todayIso,
      });

      // Invariant: buildDailyLogEntry only returns null when the draft has
      // no trackable content (see hasTrackableContent in draft.ts), and the
      // draft above always carries a non-'none' bleeding intensity. Checked
      // at runtime rather than cast away; a violation lands in the calm
      // inline error below.
      if (!nextEntry) {
        throw new Error('quick-log draft unexpectedly produced no entry');
      }

      await repositories.dailyLogs.saveEntry(nextEntry);

      const savedEntry = await repositories.dailyLogs.getEntryByDate(todayIso);

      setTodayEntry(savedEntry);
      setIsSaved(true);
      AccessibilityInfo.announceForAccessibility(t('tracker.quickLog.confirmation'));
      // Deliberately no repositories.reviewPromptState.recordSuccessfulSave
      // here: quick-log days intentionally do not count toward store-review
      // prompt eligibility (and attemptAutomaticReviewPrompt is never
      // called from this path either).
      onLogged?.();
    } catch {
      setSaveError(t('tracker.quickLog.error'));
    } finally {
      setIsSaving(false);
    }
  }

  function handleAdjust() {
    router.push(buildCalendarDayRoute(todayIso) as never);
  }

  // Once saved, keep the confirmation + Adjust link visible for this mount —
  // through both the visibility flip (buildQuickLogAction now reports
  // `visible: false` because today has bleeding logged) AND the re-hydration
  // pass triggered when the parent bumps refreshVersion after onLogged
  // (isHydrating goes true again; unmounting here would flicker the card).
  // The button itself never re-renders once isSaved is true — see the JSX
  // below — so this only affects whether the card stays mounted.
  if (!isSaved && (isHydrating || !action.visible)) {
    return null;
  }

  return (
    <SectionCard
      presentation="unframed"
      testID={testIds.today.quickLogPeriodCard}
    >
      <View style={styles.stack}>
        {isSaved ? (
          <View
            accessibilityLiveRegion="polite"
            style={styles.confirmationRow}
            testID={testIds.today.quickLogPeriodConfirmation}
          >
            <Text style={styles.confirmationText}>{t('tracker.quickLog.confirmation')}</Text>
            <Pressable
              accessibilityRole="link"
              hitSlop={{ top: 13, bottom: 13, left: 8, right: 8 }}
              onPress={handleAdjust}
              testID={testIds.today.quickLogPeriodAdjustLink}
            >
              <Text style={styles.adjustLink}>{t('tracker.quickLog.adjustLink')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.title}>{t('tracker.quickLog.title')}</Text>
            <Text style={styles.body}>{t('tracker.quickLog.body')}</Text>
            <Pressable
              accessibilityHint={t('tracker.quickLog.buttonHint')}
              accessibilityLabel={t('tracker.quickLog.buttonLabel')}
              accessibilityRole="button"
              accessibilityState={{ disabled: isSaving }}
              disabled={isSaving}
              onPress={() => {
                void handleQuickLog();
              }}
              style={({ pressed }) => [
                styles.button,
                pressed ? styles.buttonPressed : null,
                isSaving ? styles.buttonDisabled : null,
              ]}
              testID={testIds.today.quickLogPeriodButton}
            >
              <Text style={styles.buttonText}>{t('tracker.quickLog.buttonLabel')}</Text>
            </Pressable>
            {saveError ? (
              <Text
                accessibilityLiveRegion="polite"
                style={styles.errorText}
                testID={testIds.today.quickLogPeriodError}
              >
                {saveError}
              </Text>
            ) : null}
          </>
        )}
      </View>
    </SectionCard>
  );
}

function createStyles(theme: FlorivaTheme) {
  return StyleSheet.create({
    stack: {
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceSubtle,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderPrimary,
      padding: theme.spacing.md,
      marginTop: theme.spacing.md,
    },
    title: {
      ...theme.typography.bodyStrong,
      color: theme.colors.textPrimary,
    },
    body: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    button: {
      backgroundColor: theme.colors.accentPrimary,
      borderRadius: theme.radii.pill,
      // Deliberately normalized from a hardcoded 14 to the nearest theme
      // token (12) during the 1.2.0 a11y pass -- a 2pt-per-side visual
      // tightening. Effective height stays >=44pt (24pt padding + ~22pt
      // bodyStrong line).
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonPressed: {
      opacity: 0.85,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      ...theme.typography.bodyStrong,
      color: theme.colors.buttonPrimaryText,
    },
    confirmationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    confirmationText: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    errorText: {
      ...theme.typography.caption,
      color: theme.colors.danger,
    },
    adjustLink: {
      ...theme.typography.caption,
      color: theme.colors.accentPrimary,
      textDecorationLine: 'underline',
    },
  });
}
