export const trackingGoalValues = ['period', 'symptoms', 'trying-to-conceive'] as const;
export type TrackingGoal = (typeof trackingGoalValues)[number];

export const conditionKeyValues = ['pcos', 'pmdd', 'endometriosis'] as const;
export type ConditionKey = (typeof conditionKeyValues)[number];

export const bleedingIntensityValues = [
  'none',
  'spotting',
  'light',
  'medium',
  'heavy',
] as const;
export type BleedingIntensity = (typeof bleedingIntensityValues)[number];

export const moodValueValues = ['steady', 'low', 'sensitive', 'energized'] as const;
export type MoodValue = (typeof moodValueValues)[number];

export const symptomKeyValues = [
  'cramps',
  'headache',
  'bloating',
  'fatigue',
  'breast-tenderness',
  'acne',
  'discharge',
  'sleep-changes',
  'libido-changes',
  'sex',
] as const;
export type SymptomKey = (typeof symptomKeyValues)[number];

export const reminderKindValues = [
  'period-start',
  'fertile-window',
  'daily-log',
  'birth-control',
] as const;
export type ReminderKind = (typeof reminderKindValues)[number];

export const importSourceValues = ['clue', 'flo', 'manual'] as const;
export type ImportSource = (typeof importSourceValues)[number];

export const importSessionStatusValues = ['pending', 'committed', 'failed'] as const;
export type ImportSessionStatus = (typeof importSessionStatusValues)[number];

export const subscriptionPlanIdValues = ['monthly', 'annual', 'lifetime'] as const;
export type SubscriptionPlanId = (typeof subscriptionPlanIdValues)[number];

export const cervicalMucusValues = ['dry', 'sticky', 'creamy', 'egg-white'] as const;
export type CervicalMucusValue = (typeof cervicalMucusValues)[number];

export const ovulationTestValues = ['negative', 'positive', 'peak'] as const;
export type OvulationTestValue = (typeof ovulationTestValues)[number];

export const birthControlMethodValues = [
  'none',
  'pill',
  'iud',
  'implant',
  'ring',
  'patch',
  'other',
] as const;
export type BirthControlMethod = (typeof birthControlMethodValues)[number];

/**
 * IUD sub-type. Only meaningful when `birthControlMethod === 'iud'`. Copper
 * IUDs do not suppress ovulation, so a copper selection ungates the
 * ovulation-signal refinement; a hormonal (or unspecified) IUD stays gated.
 * See `resolveHormonalBirthControlGate` in
 * src/lib/predictions/ovulationAnalysis.ts.
 */
export const iudTypeValues = ['hormonal', 'copper'] as const;
export type IudType = (typeof iudTypeValues)[number];

export const themePreferenceValues = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof themePreferenceValues)[number];

export const supportedLocaleValues = [
  'en',
  'es',
  'de',
  'fr',
  'ja',
  'zh-Hans',
  'pt',
  'ru',
] as const;
export type SupportedLocale = (typeof supportedLocaleValues)[number];

export const localePreferenceValues = ['system', ...supportedLocaleValues] as const;
export type LocalePreference = (typeof localePreferenceValues)[number];

export type AppPreferences = {
  hasCompletedOnboarding: boolean;
  deferredCycleSetup: boolean;
  deferredTrackingSetup: boolean;
  deferredBiometricsSetup: boolean;
  deferredReminderSetup: boolean;
  deferredImportSetup: boolean;
  dismissedTailoringChecklist: boolean;
  showFertilityEstimates: boolean;
  hapticsEnabled: boolean;
  tapSoundEnabled: boolean;
  themePreference?: ThemePreference;
  localePreference?: LocalePreference;
  /**
   * Ids of anomaly nudges (see `Anomaly.id` in
   * src/lib/predictions/anomalyPresentation.ts) the user has dismissed.
   * Capped at 50 entries -- see `appendDismissedAnomalyId` in
   * src/db/repositories.ts for the truncation rule. Optional (defaults to
   * `[]` via `defaultAppPreferences`) so existing persisted rows/backups
   * created before this field existed still validate.
   */
  dismissedAnomalyIds?: string[];
};

export const interactionFeedbackKindValues = ['action', 'selection'] as const;
export type InteractionFeedbackKind = (typeof interactionFeedbackKindValues)[number];

export type TtcObservation = {
  cervicalMucus?: CervicalMucusValue;
  ovulationTest?: OvulationTestValue;
  basalBodyTemperatureCelsius?: number;
  sexLogged?: boolean;
};

export type TtcTrackingPreferences = {
  sex: boolean;
  ovulationTest: boolean;
  cervicalMucus: boolean;
  basalBodyTemperature: boolean;
};

export type BirthControlEvent = {
  method: BirthControlMethod;
  missedDose?: boolean;
  lateDose?: boolean;
};

export type UserProfile = {
  cycleLengthDays?: number;
  periodLengthDays?: number;
  lastPeriodStartDate?: string;
  goals: TrackingGoal[];
  supportsIrregularCycles: boolean;
  conditionTags: ConditionKey[];
  ttcTrackingPreferences?: TtcTrackingPreferences;
  birthControlMethod?: Exclude<BirthControlMethod, 'none'>;
  /**
   * IUD sub-type; only meaningful when `birthControlMethod === 'iud'`.
   * Optional: existing/unspecified IUD users have no value and are treated as
   * hormonal (gated) -- only an explicit `'copper'` ungates ovulation
   * refinement. Persistence clears this when the method is not `'iud'`.
   */
  iudType?: IudType;
};

export type DailyLogEntry = {
  id: string;
  logDate: string;
  bleeding: BleedingIntensity;
  symptoms: SymptomKey[];
  mood?: MoodValue;
  notes?: string;
  ttcObservation?: TtcObservation;
  birthControlEvent?: BirthControlEvent;
  importSessionId?: string;
};

export type PredictionSnapshot = {
  cycleDay: number;
  cycleLengthDays: number;
  periodLengthDays: number;
  cycleDayLabel: string;
  nextPeriodStartIso?: string;
  fertileWindowLabel: string;
  fertileWindowCaption?: string;
  /**
   * Offset (in days from the cycle start) where the fertile window opens,
   * per the LIVE prediction -- mirrors `cyclePhaseModel.ts`'s injectable
   * `fertileWindowStartOffsetDays` (see buildCyclePhaseBreakdown). Always
   * populated (Today's CycleRibbon has no other way to learn this), so the
   * Today phase ribbon and the Calendar/Insights phase breakdowns can never
   * silently disagree about where the fertile window falls -- especially
   * once a signal-confirmed window (see `PredictionResult.fertileWindow.basis`)
   * diverges from the plain calendar formula.
   */
  fertileWindowStartOffsetDays: number;
  confidenceLevel: PredictionConfidenceLevel;
  confidenceLabel: string;
  confidenceBasisLabel: string;
  // Additive (A5): the raw reason codes behind `confidenceLevel`, straight
  // from `PredictionResult.confidence.reasonCodes` -- no formatting needed,
  // since these are stable codes, not display copy. Feeds
  // `buildConfidenceInfoModalContent`'s reason-detail paragraph (see that
  // module) so the confidence modal can explain hormonal-birth-control
  // gating or signal disagreement without re-deriving them from scratch.
  // Replaces the retired `confidenceReasonLabels: string[]` field (dead --
  // no screen ever rendered it; see A5 report).
  confidenceReasonCodes: ConfidenceReasonCode[];
  historyChipLabel?: string;
  limitations: string[];
  /**
   * Actionable suggestions derived from the current confidence reasons (e.g.
   * "log today" pointing at today's log route). Optional and additive — see
   * `src/lib/predictions/confidenceImprovements.ts` for how these are
   * derived.
   */
  improvements?: ConfidenceImprovement[];
  /**
   * Additive (B5): at most ONE anomaly to nudge about on Today, already
   * filtered against `AppPreferences.dismissedAnomalyIds` and reduced to the
   * head of the most-recent-anchor-first list (see
   * `filterDismissedAnomalies` in `anomalyPresentation.ts` and the wiring in
   * `buildTodaySnapshot.ts`). Absent (not undefined-valued) when the engine
   * detected nothing, or when every detected anomaly has been dismissed.
   * Mirrors the inline-shape convention `PredictionResult.anomalies` uses
   * (see that field's doc comment) rather than importing `Anomaly` from
   * `src/lib`.
   */
  anomaly?: {
    id: string;
    kind: 'short-cycle' | 'long-cycle' | 'prolonged-bleeding' | 'missed-expected-period';
    anchorDateIso: string;
  };
};

export const predictionConfidenceLevelValues = ['low', 'medium', 'high'] as const;
export type PredictionConfidenceLevel = (typeof predictionConfidenceLevelValues)[number];

export type PredictionConfidence = {
  level: PredictionConfidenceLevel;
  reasonCodes: ConfidenceReasonCode[];
  /**
   * Additive (A5): codes with something actionable to suggest, a strict
   * subset of `reasonCodes` (see `src/lib/predictions/confidenceImprovements.ts`
   * for the exhaustive selection table). Absent/empty when nothing in
   * `reasonCodes` is actionable. Route-agnostic on purpose -- the model
   * layer (`buildTodaySnapshot.ts` et al.) attaches the `action.href` and any
   * other presentation concerns.
   */
  improvementCodes?: ConfidenceReasonCode[];
};

// Stable reason codes the engine emits natively (see
// `src/lib/predictions/confidence.ts`'s `resolveConfidence` for the base set,
// and `src/lib/predictions/buildPredictionResult.ts` for the three
// ovulation-derived codes appended after it). Screens resolve display copy
// from `predictions.confidence.reasons.<code>` in
// `src/localization/messages/predictions.ts` -- there is no English string
// anywhere in this list used as a match key.
export const confidenceReasonCodeValues = [
  'onboarding-seed',
  'limited-bleeding-history',
  'irregular-cycle-support-enabled',
  'one-observed-interval',
  'consistent-recent-bleeding-history',
  // Additive (LT-04): emitted by `resolveConfidence` INSTEAD OF
  // 'consistent-recent-bleeding-history' when the user would otherwise reach
  // that terminal high-confidence branch but their history has gone stale
  // (see `isStale` there, and the inline `isHistoryStale` computation in
  // buildPredictionResult.ts for the exact trigger). Mutually exclusive with
  // 'consistent-recent-bleeding-history' by construction -- exactly one of
  // the two is chosen at that branch point. Actionable (see
  // confidenceImprovements.ts): "log your latest period" has a concrete next
  // step, unlike the purely descriptive ovulation-derived codes below.
  'stale-history',
  // Additive (A5): derived from `PredictionResult.ovulation` in
  // buildPredictionResult.ts, never computed inside resolveConfidence
  // (which has no access to ovulation/signal data). Mutually exclusive by
  // construction -- 'hormonal-birth-control' only appears when
  // `ovulation.gated === 'hormonal-birth-control'`, and 'signals-disagree'
  // only appears when ovulation is NOT gated (gating suppresses all signal
  // detection, so a gated cycle can never carry a signals-disagree
  // estimate). 'ovulation-signal-confirmed' is the positive counterpart:
  // ovulation is populated, not gated, and signals did NOT disagree.
  'hormonal-birth-control',
  'signals-disagree',
  'ovulation-signal-confirmed',
] as const;
export type ConfidenceReasonCode = (typeof confidenceReasonCodeValues)[number];

// Stable limitation codes the engine emits natively (see
// `resolveLimitations` in src/lib/predictions/confidence.ts, plus
// 'projected-forward' appended in buildPredictionResult.ts when the
// calendar anchor rolled forward). Screens resolve display copy from
// `predictions.limitations.<code>` in
// src/localization/messages/predictions.ts.
export const limitationCodeValues = [
  'on-device',
  'not-medical-certainty',
  'onboarding-seed-active',
  'limited-history-shift',
  'irregular-cycle-broader',
  'projected-forward',
] as const;
export type LimitationCode = (typeof limitationCodeValues)[number];

export type ConfidenceImprovement = {
  code: ConfidenceReasonCode;
  // Optional by design, not by current fact: `attachImprovementActions` (see
  // src/lib/predictions/confidencePresentation.ts) always sets this today, so
  // `ConfidenceImprovementList`'s no-action rendering branch is presently
  // unreachable in production. Kept optional because it is the honest type
  // for a future improvement code with nothing actionable to route to --
  // don't make this required just to match today's callers.
  action?: { href: string };
};

export type PeriodEvidenceEntry = {
  logDate: string;
  bleeding: Extract<BleedingIntensity, 'light' | 'medium' | 'heavy'>;
};

export type PredictionResult = {
  cycleLengthDays: number;
  history: {
    source: 'bleeding-history' | 'onboarding-seed';
    startDates: string[];
  };
  current: {
    cycleDay: number;
    cycleStartDate: string;
    activeBleeding: PeriodEvidenceEntry;
  };
  nextPeriod: {
    // NOTE (A4, invariant relaxed): before A4, `startDate` was guaranteed to
    // be in the future -- the engine rolls its calendar anchor forward by
    // whole cycles until the projected next period lands after `todayIso`.
    // Since A4, a signal-confirmed ovulation re-anchors `startDate` to
    // ovulation + learned luteal length, which CAN be in the past (e.g.
    // confirmed ovulation day 10, learned luteal 11 days, today is cycle
    // day 25 -> startDate landed 4 days ago). That is a meaningful signal,
    // not a bug: it reads as "the period appears to be late relative to the
    // observed ovulation". Presentation-layer consumers (A5/A6, reminders,
    // calendar labels) must not assume `startDate >= todayIso` when
    // `ovulation` is present and non-gated.
    startDate: string;
    lengthDays: number;
    // Additive (A2): robust-statistics-derived earliest/latest bounds around
    // `startDate`. Present only when the engine had >=3 observed period
    // starts AND the robust cycle-statistics module produced a real sample
    // (see buildPredictionResult.ts / cycleHistory.ts); absent otherwise.
    earliestStartDate?: string;
    latestStartDate?: string;
  };
  fertileWindow: {
    startDate: string;
    endDate: string;
    // Additive (A4): provenance of this window. 'signal-confirmed' means the
    // window was derived from a fused ovulation-signal estimate (see
    // src/lib/predictions/ovulationAnalysis.ts) rather than the plain
    // calendar formula. ABSENT (not 'calendar') for every calendar-derived
    // window, so pre-A4 consumers/goldens see an identical shape -- this key
    // is only ever present when the value is 'signal-confirmed'.
    basis?: 'signal-confirmed';
  };
  confidence: PredictionConfidence;
  // Renamed from `limitations: string[]` (A5): the engine now emits stable
  // codes, not display strings -- see `LimitationCode` above and
  // `src/lib/predictions/presentation.ts`'s `formatPredictionLimitation` for
  // the code -> localized-copy step. The rename (rather than a same-name
  // retype) is deliberate: it forces every call site to be touched and
  // reviewed instead of silently type-checking against the new codes.
  limitationCodes: LimitationCode[];
  // Additive (A2): debug/telemetry-style info about the robust cycle-length
  // estimate. Present under the same condition as nextPeriod's
  // earliest/latestStartDate above -- see buildPredictionResult.ts.
  statistics?: {
    spreadDays: number;
    sampleSize: number;
    discardedCount: number;
  };
  // Additive (A4): the ovulation-signal analysis outcome for the CURRENT
  // (open) cycle, when one exists. Absent entirely when there is no signal
  // data to report -- e.g. TTC-less histories or a plain calendar-fallback
  // result. This key does NOT feed `resolveConfidence`/`resolveLimitations`
  // directly (that pure function has no access to ovulation/signal data);
  // instead, `buildPredictionResult.ts` reads this field AFTER calling
  // `resolveConfidence` and appends the corresponding reason code
  // ('hormonal-birth-control', 'signals-disagree', or
  // 'ovulation-signal-confirmed' -- see `confidenceReasonCodeValues` in this
  // file) onto `confidence.reasonCodes`. Consumers that don't know about
  // this field are unaffected; it is pure addition. Discriminated on
  // `gated`:
  // - `{ gated: 'hormonal-birth-control' }`: the user's profile birth-control
  //   method suppressed ALL signal detection and window re-anchoring for
  //   this cycle -- see resolveHormonalBirthControlGate in
  //   ovulationAnalysis.ts for exactly which methods gate. No signal fields
  //   are present in this case; surfaced to users via the
  //   'hormonal-birth-control' reason code (confidence chip copy) and the
  //   confidence info modal's reason-detail paragraph (see
  //   `buildConfidenceInfoModalContent.ts`).
  // - otherwise: a populated signal estimate (never both).
  ovulation?:
    | { gated: 'hormonal-birth-control' }
    | {
        gated?: undefined;
        /** Best fused (or single-signal) ovulation date estimate, ISO date. */
        dateIso: string;
        /** Estimate uncertainty in days -- see signals/types.ts / fuseOvulationEstimate.ts. */
        uncertaintyDays: number;
        /**
         * Provenance of `dateIso`. 'bbt-shift' | 'opk-surge' | 'mucus-peak'
         * when a single signal was used directly (no fusion needed -- only
         * one signal was present), matching the signal `kind` IDs in
         * signals/types.ts one-for-one; 'fused' when >=2 signals were
         * combined by fuseOvulationEstimate (agreeing or in conflict -- see
         * `signalsDisagree`).
         */
        basis: 'bbt-shift' | 'opk-surge' | 'mucus-peak' | 'fused';
        /**
         * True only when fusion resolved a >=2-day disagreement between
         * signals by anchoring on a confirmed BBT shift (see
         * fuseOvulationEstimate.ts). Absent (not false) when signals agreed
         * or only one signal was present. A disagreeing estimate STILL
         * re-anchors the fertile window and nextPeriod like any other
         * populated estimate -- this flag only drives the 'signals-disagree'
         * reason code (see buildPredictionResult.ts), which communicates the
         * caveat to users via the confidence chip and modal.
         */
        signalsDisagree?: true;
        /**
         * True when `dateIso` came from a purely retrospective signal (BBT
         * coverline shift) that can only CONFIRM ovulation after the fact,
         * never predict it forward. See ovulationAnalysis.ts for the
         * discipline this enforces: a retrospective-only estimate may
         * re-anchor nextPeriod and luteal learning, and may mark an
         * already-past fertile window as confirmed, but must never open a
         * prospective (future) fertile window.
         */
        retrospective: boolean;
      };
  // Additive (A6): detected cycle-timing / bleeding-duration anomalies (see
  // `src/lib/predictions/anomalies.ts`'s `detectAnomalies`). Mirrors the
  // `statistics` field's convention above: the shape here is inlined rather
  // than importing `Anomaly` from `src/lib/predictions/anomalyPresentation.ts`
  // to keep this file dependency-free of `src/lib`. Present only when at
  // least one anomaly was detected -- ABSENT (not an empty array) otherwise,
  // so pre-A6 consumers and `toStrictEqual` goldens see an identical shape
  // whenever nothing anomalous was found. Ordered most-recent
  // `anchorDateIso` first (see `detectAnomalies`). Detection reports facts
  // only: it does NOT filter out anomalies the user has already dismissed
  // (`AppPreferences.dismissedAnomalyIds`) -- that filtering is screen-side,
  // via `filterDismissedAnomalies` in `anomalyPresentation.ts` (B4/B5).
  anomalies?: {
    id: string;
    kind: 'short-cycle' | 'long-cycle' | 'prolonged-bleeding' | 'missed-expected-period';
    anchorDateIso: string;
  }[];
};

export type ReminderSchedule =
  | {
      cadence: 'daily';
    }
  | {
      cadence: 'cycle-event';
      daysBefore: number;
    };

export type ReminderPreference = {
  kind: ReminderKind;
  enabled: boolean;
  hour: number;
  minute: number;
  schedule: ReminderSchedule;
};

export type PrivacyPreference = {
  biometricsEnabled: boolean;
  relockAfterSeconds: number;
  destructiveActionConfirmationRequired: boolean;
  diagnosticsConsentEnabled: boolean;
};

export type ReviewPromptState = {
  onboardingCompletedAt?: string;
  automaticPromptCount: number;
  lastAutomaticPromptAt?: string;
  suppressAutomaticPrompts: boolean;
  lastManualStoreOpenAt?: string;
};

export type ReviewPromptSaveEvent = {
  logDate: string;
  savedAt: string;
};

export type ImportSession = {
  id: string;
  source: ImportSource;
  status: ImportSessionStatus;
  startedAt: string;
  completedAt?: string;
  importedLogCount: number;
  skippedLogCount: number;
};

export type ImportDateRange = {
  startIso: string;
  endIso: string;
};

export type NormalizedImportEntry = {
  logDate: string;
  bleeding: BleedingIntensity;
  symptoms: SymptomKey[];
  mood?: MoodValue;
  notes?: string;
  ttcObservation?: TtcObservation;
  birthControlEvent?: BirthControlEvent;
};

export type ImportSkippedRow = {
  rowNumber: number;
  reason: 'invalid' | 'unsupported';
  message: string;
};

export const importConfidenceLabelValues = ['high', 'medium', 'low'] as const;
export type ImportConfidenceLabel = (typeof importConfidenceLabelValues)[number];

export type ImportConfidence = {
  label: ImportConfidenceLabel;
  reasons: {
    kind:
      | 'reviewed-days-ready'
      | 'no-reviewed-days-ready'
      | 'duplicate-dates-skipped'
      | 'rows-skipped';
    count: number;
  }[];
};

export type ImportDuplicateDetail = {
  logDate: string;
  action: 'skipped';
  existingEntryId?: string;
};

export type ImportDuplicateSummary = {
  count: number;
  details: ImportDuplicateDetail[];
};

export type ImportSkippedSummary = {
  totalCount: number;
  invalidCount: number;
  unsupportedCount: number;
  messages: string[];
};

export type ImportCandidateEntry = NormalizedImportEntry;
export type ImportPreviewEntry = NormalizedImportEntry;
export type ImportWarning = ImportSkippedRow;
export type ManualHistoryPeriod = {
  periodStarts: string[];
  lookbackStartIso?: string;
  periodLengthDays?: number;
};

export type ImportPreview = {
  source: ImportSource;
  dateRange: ImportDateRange | null;
  importableEntries: NormalizedImportEntry[];
  duplicateLocalDates: string[];
  duplicateSummary?: ImportDuplicateSummary;
  confidence?: ImportConfidence;
  skippedRows: ImportSkippedRow[];
  skippedSummary?: ImportSkippedSummary;
  warnings: string[];
  editedEntryCount?: number;
};

export type ImportPreviewSummary = ImportPreview;

export type ImportCommitResult = {
  importSessionId: string;
  source: ImportSource;
  dateRange: ImportDateRange | null;
  importedLogCount: number;
  skippedLogCount: number;
  duplicateSkippedLogCount?: number;
  skippedRowCount?: number;
  unsupportedSkippedRowCount?: number;
  invalidSkippedRowCount?: number;
  editedEntryCount?: number;
};

export const billingAccessStateValues = [
  'needs_purchase',
  'trial_active',
  'subscribed',
  'expired',
  'sync_error',
] as const;
export type BillingAccessState = (typeof billingAccessStateValues)[number];

export type BillingSnapshot = {
  accessState: BillingAccessState;
  planId?: SubscriptionPlanId;
  trialEndsAt?: string;
  firstChargeAt?: string;
  expiresAt?: string;
  lastSyncedAt?: string;
  reminderScheduledFor?: string;
  /** Set once a no-paywall-era user has been granted their one-time grandfather trial. */
  grandfatherTrialApplied?: boolean;
  /**
   * ISO timestamp set once the user has started their one-time app-level Lifetime free
   * trial on this device. Its presence gates eligibility (the trial is never offered
   * twice); its value anchors when the trial began. Lifetime is a non-consumable and
   * cannot carry a store trial, so this trial is tracked entirely in-app.
   */
  lifetimeTrialStartedAt?: string;
  /** ISO timestamp set once the user has redeemed their one-time cancellation save offer on this device. */
  saveOfferRedeemedAt?: string;
};

export const backupFormatVersionValues = [1] as const;
export type BackupFormatVersion = (typeof backupFormatVersionValues)[number];

export type BackupKeyDerivationConfig = {
  algorithm: 'pbkdf2-sha256';
  iterations: number;
  saltBase64: string;
};

export type BackupEncryptionConfig = {
  algorithm: 'aes-256-gcm';
  nonceBase64: string;
  ciphertextBase64: string;
  keyCheckBase64: string;
};

export type BackupEnvelope = {
  formatVersion: BackupFormatVersion;
  createdAt: string;
  kdf: BackupKeyDerivationConfig;
  encryption: BackupEncryptionConfig;
};

export type BackupSnapshot = {
  formatVersion: BackupFormatVersion;
  exportedAt: string;
  appPreferences: AppPreferences;
  billingSnapshot: BillingSnapshot;
  userProfile: UserProfile | null;
  reminderPreferences: ReminderPreference[];
  privacyPreference: PrivacyPreference;
  importSessions: ImportSession[];
  dailyLogs: DailyLogEntry[];
};

export type BackupRestorePreview = {
  snapshot: BackupSnapshot;
  importedLogCount: number;
  importSessionCount: number;
  periodStartCount: number;
  exportedDate: string;
  firstLogDate?: string;
  lastLogDate?: string;
  reminderCount: number;
  hasCycleProfile: boolean;
  willDisableBiometrics: boolean;
  requiresBillingRevalidation: boolean;
};

export type BackupRestoreResult = {
  restoredSnapshot: BackupSnapshot;
  importedLogCount: number;
  importSessionCount: number;
  biometricRearmRequired: boolean;
  billingRevalidationRequired: boolean;
};

export type BackupEvent = {
  id: string;
  action: 'exported' | 'restored';
  occurredAt: string;
  detail: string;
};

export type DevLaunchPreset =
  | 'fresh-install'
  | 'seeded-tracker'
  | 'qa-rich-history'
  | 'locked-app'
  | 'import-ready'
  | 'backup-ready'
  | 'billing-fallback'
  | 'grandfathered-expired'
  | 'save-offer-monthly-active'
  | 'save-offer-monthly-trial'
  | 'save-offer-annual-active'
  | 'save-offer-annual-trial'
  | 'save-offer-lifetime'
  | 'tenure-1mo-new'
  | 'tenure-3mo-regular'
  | 'tenure-6mo-gap'
  | 'tenure-12mo-regular'
  | 'tenure-12mo-irregular'
  | 'tenure-lapsed';

export type PostOnboardingRoute =
  | '/today'
  | '/import'
  | '/import/review'
  | '/backup'
  | '/backup/restore';

// Notification-tap routing (C1) needs to point at an arbitrary day's calendar
// entry, which the fixed PostOnboardingRoute union can't express. This type
// is additive: PostOnboardingRoute (and its SecureStore whitelist in
// postOnboardingRouteStorage.ts) stays untouched and keeps governing the
// onboarding handoff flow. PendingEntryRoute only widens what AppShellState
// itself is allowed to hold.
export type CalendarDayRoute = `/calendar/day/${string}`;

export type PendingEntryRoute = PostOnboardingRoute | CalendarDayRoute;

// Tags where the current pendingEntryRoute came from. Only ever set to
// 'notification' by the notification-tap handler in AppShellProvider —
// every other setter (onboarding completion, hydration of a persisted
// PostOnboardingRoute handoff, the public setPendingEntryRoute API) leaves
// this unset. AppShellRouteGuard uses the tag to decide whether it may
// proactively push('/today'): a '/today' PostOnboardingRoute handoff keeps
// its existing screen-side self-clear contract (TodayScreen clears it once
// the user is already there) and must NOT be force-navigated by the guard,
// but a '/today' that arrived from a notification tap needs the guard to
// actually take the user there, the same way it already does for calendar-day
// routes.
export type PendingEntryRouteSource = 'notification';

export type AppShellState = {
  hasCompletedOnboarding: boolean;
  isLocked: boolean;
  billingAccessState: BillingAccessState;
  mainAppReady: boolean;
  pendingEntryRoute?: PendingEntryRoute;
  pendingEntryRouteSource?: PendingEntryRouteSource;
};
