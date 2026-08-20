import type {
  AppPreferences,
  BackupEvent,
  BackupSnapshot,
  BillingSnapshot,
  DailyLogEntry,
  ImportSession,
  PrivacyPreference,
  ReviewPromptSaveEvent,
  ReviewPromptState,
  ReminderPreference,
  UserProfile,
} from '@/src/types/domain';

export type AppPreferencesRepository = {
  getPreferences: () => Promise<AppPreferences>;
  savePreferences: (preferences: AppPreferences) => Promise<void>;
};

export type BillingSnapshotRepository = {
  getSnapshot: () => Promise<BillingSnapshot>;
  saveSnapshot: (snapshot: BillingSnapshot) => Promise<void>;
};

export type UserProfileRepository = {
  getProfile: () => Promise<UserProfile | null>;
  saveProfile: (profile: UserProfile) => Promise<void>;
  saveProfileAndReminderPreferences: (
    profile: UserProfile,
    reminderPreferences: ReminderPreference[],
  ) => Promise<void>;
  clearProfile: () => Promise<void>;
};

export type DailyLogRepository = {
  getEntryByDate: (logDate: string) => Promise<DailyLogEntry | null>;
  listAll: () => Promise<DailyLogEntry[]>;
  listByDates: (dates: string[]) => Promise<DailyLogEntry[]>;
  listByDateRange: (startIso: string, endIso: string) => Promise<DailyLogEntry[]>;
  saveEntry: (entry: DailyLogEntry) => Promise<void>;
  saveEntryIfDateAbsent: (entry: DailyLogEntry) => Promise<boolean>;
  deleteEntry: (entryId: string) => Promise<void>;
};

export type ReminderPreferencesRepository = {
  getPreferences: () => Promise<ReminderPreference[]>;
  savePreferences: (preferences: ReminderPreference[]) => Promise<void>;
};

export type PrivacyPreferencesRepository = {
  getPreference: () => Promise<PrivacyPreference>;
  savePreference: (preference: PrivacyPreference) => Promise<void>;
};

export type ReviewPromptStateRepository = {
  getState: () => Promise<ReviewPromptState>;
  seedOnboardingCompletion: (timestamp: string) => Promise<void>;
  recordSuccessfulSave: (logDate: string, timestamp: string) => Promise<void>;
  listSuccessfulSaveEventsSince: (timestamp: string) => Promise<ReviewPromptSaveEvent[]>;
  recordAutomaticPrompt: (timestamp: string) => Promise<void>;
  recordManualStoreOpen: (timestamp: string) => Promise<void>;
  reset: () => Promise<void>;
};

export type ImportSessionRepository = {
  getSession: (sessionId: string) => Promise<ImportSession | null>;
  listSessions: () => Promise<ImportSession[]>;
  saveSession: (session: ImportSession) => Promise<void>;
};

export type BackupEventRepository = {
  listEvents: () => Promise<BackupEvent[]>;
  recordEvent: (event: BackupEvent) => Promise<void>;
};

export type LocalDataMaintenanceRepository = {
  wipeLocalData: () => Promise<void>;
};

export type BackupDataRepository = {
  exportSnapshot: () => Promise<BackupSnapshot>;
  restoreSnapshot: (snapshot: BackupSnapshot) => Promise<void>;
};

export type OnboardingRepository = {
  completeOnboarding: (
    profile: UserProfile,
    preferences: AppPreferences,
  ) => Promise<void>;
};

export type DomainRepositories = {
  appPreferences: AppPreferencesRepository;
  billingSnapshot: BillingSnapshotRepository;
  userProfile: UserProfileRepository;
  dailyLogs: DailyLogRepository;
  reminderPreferences: ReminderPreferencesRepository;
  privacyPreferences: PrivacyPreferencesRepository;
  reviewPromptState: ReviewPromptStateRepository;
  importSessions: ImportSessionRepository;
  backupEvents: BackupEventRepository;
  localDataMaintenance: LocalDataMaintenanceRepository;
  backupData: BackupDataRepository;
  onboarding: OnboardingRepository;
};
