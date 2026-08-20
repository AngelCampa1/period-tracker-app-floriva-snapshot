/**
 * Adversarial probe tests for onboarding model and draftStorage.
 * Asserts CORRECT behavior — genuine bugs will FAIL these tests.
 */

import { defaultTtcTrackingPreferences, defaultUserProfile } from '@/src/db/domainDefaults';
import {
  buildImportedOnboardingCompletion,
  buildOnboardingCompletion,
  createDefaultOnboardingDraft,
  createOnboardingDraftFromProfile,
  normalizeOnboardingDateInput,
  resolveOnboardingGuardRedirect,
  validateCycleBasicsStep,
  validateGoalsStep,
  type OnboardingDraft,
} from '@/src/features/onboarding/model';
import {
  loadPersistedOnboardingDraft,
  persistOnboardingDraft,
  clearPersistedOnboardingDraft,
} from '@/src/features/onboarding/draftStorage';
import type { DailyLogEntry } from '@/src/types/domain';

const mockGetLocalTodayLogDate = jest.fn(() => '2026-04-10');
jest.mock('@/src/features/logging/date', () => ({
  getLocalTodayLogDate: () => mockGetLocalTodayLogDate(),
}));

const mockGetItemAsync = jest.fn();
const mockSetItemAsync = jest.fn();
const mockDeleteItemAsync = jest.fn();
jest.mock('expo-secure-store', () => ({
  getItemAsync: (...args: unknown[]) => mockGetItemAsync(...args),
  setItemAsync: (...args: unknown[]) => mockSetItemAsync(...args),
  deleteItemAsync: (...args: unknown[]) => mockDeleteItemAsync(...args),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function completeFreshDraft(overrides: Partial<OnboardingDraft> = {}): OnboardingDraft {
  return {
    ...createDefaultOnboardingDraft(),
    startPath: 'fresh',
    lastPeriodStartDate: '2026-04-01',
    hasConfirmedCycleLength: true,
    hasConfirmedPeriodLength: true,
    supportsIrregularCycles: false,
    symptomLoggingEnabled: false,
    ttcEnabled: false,
    hasCompletedAccessStep: true,
    ...overrides,
  };
}

const validLog = (id: string, logDate: string, bleeding: DailyLogEntry['bleeding'] = 'medium'): DailyLogEntry => ({
  id,
  logDate,
  bleeding,
  symptoms: [],
});

// ---------------------------------------------------------------------------
// 1. validateCycleBasicsStep — edge cases
// ---------------------------------------------------------------------------

describe('validateCycleBasicsStep — edge cases', () => {
  it('rejects cycle length of 0', () => {
    const errors = validateCycleBasicsStep(completeFreshDraft({ cycleLengthInput: '0' }));
    expect(errors.cycleLengthInput).toBe('onboarding.basics.validation.cycleLengthRange');
  });

  it('accepts cycle length of 1 (minimum boundary)', () => {
    const errors = validateCycleBasicsStep(completeFreshDraft({ cycleLengthInput: '1' }));
    expect(errors.cycleLengthInput).toBeUndefined();
  });

  it('accepts cycle length of 120 (maximum boundary)', () => {
    const errors = validateCycleBasicsStep(completeFreshDraft({ cycleLengthInput: '120' }));
    expect(errors.cycleLengthInput).toBeUndefined();
  });

  it('rejects cycle length of 121 (just above max)', () => {
    const errors = validateCycleBasicsStep(completeFreshDraft({ cycleLengthInput: '121' }));
    expect(errors.cycleLengthInput).toBe('onboarding.basics.validation.cycleLengthRange');
  });

  it('rejects period length of 0', () => {
    const errors = validateCycleBasicsStep(completeFreshDraft({ periodLengthInput: '0' }));
    expect(errors.periodLengthInput).toBe('onboarding.basics.validation.periodLengthRange');
  });

  it('accepts period length of 1 (minimum boundary)', () => {
    const errors = validateCycleBasicsStep(completeFreshDraft({ periodLengthInput: '1' }));
    expect(errors.periodLengthInput).toBeUndefined();
  });

  it('accepts period length of 30 (maximum boundary)', () => {
    const errors = validateCycleBasicsStep(completeFreshDraft({ periodLengthInput: '30' }));
    expect(errors.periodLengthInput).toBeUndefined();
  });

  it('rejects period length of 31 (just above max)', () => {
    const errors = validateCycleBasicsStep(completeFreshDraft({ periodLengthInput: '31' }));
    expect(errors.periodLengthInput).toBe('onboarding.basics.validation.periodLengthRange');
  });

  it('rejects negative cycle length (negative string)', () => {
    const errors = validateCycleBasicsStep(completeFreshDraft({ cycleLengthInput: '-5' }));
    expect(errors.cycleLengthInput).toBeDefined();
  });

  it('rejects decimal cycle length', () => {
    const errors = validateCycleBasicsStep(completeFreshDraft({ cycleLengthInput: '28.5' }));
    expect(errors.cycleLengthInput).toBeDefined();
  });

  it('rejects whitespace-only cycle length', () => {
    const errors = validateCycleBasicsStep(completeFreshDraft({ cycleLengthInput: '   ' }));
    expect(errors.cycleLengthInput).toBe('onboarding.basics.validation.cycleLengthRequired');
  });

  it('rejects last period date set to today (equal to today is valid — not future)', () => {
    const errors = validateCycleBasicsStep(
      completeFreshDraft({ lastPeriodStartDate: '2026-04-10' }),
    );
    // Today is NOT in the future, so this should be valid
    expect(errors.lastPeriodStartDate).toBeUndefined();
  });

  it('rejects last period date one day in the future', () => {
    const errors = validateCycleBasicsStep(
      completeFreshDraft({ lastPeriodStartDate: '2026-04-11' }),
    );
    expect(errors.lastPeriodStartDate).toBe('onboarding.basics.validation.lastPeriodStartFuture');
  });
});

// ---------------------------------------------------------------------------
// 2. normalizeOnboardingDateInput — edge cases
// ---------------------------------------------------------------------------

describe('normalizeOnboardingDateInput — edge cases', () => {
  it('rejects empty string', () => {
    expect(normalizeOnboardingDateInput('')).toBeNull();
  });

  it('rejects whitespace only', () => {
    expect(normalizeOnboardingDateInput('   ')).toBeNull();
  });

  it('rejects single-part strings', () => {
    expect(normalizeOnboardingDateInput('2026')).toBeNull();
  });

  it('rejects two-part slash strings', () => {
    expect(normalizeOnboardingDateInput('04/2026')).toBeNull();
  });

  it('rejects four-part slash strings', () => {
    expect(normalizeOnboardingDateInput('04/10/2026/extra')).toBeNull();
  });

  it('accepts February 29 in a leap year', () => {
    expect(normalizeOnboardingDateInput('2024-02-29')).toBe('2024-02-29');
  });

  it('rejects February 29 in a non-leap year', () => {
    expect(normalizeOnboardingDateInput('2026-02-29')).toBeNull();
  });

  it('rejects April 31 (month with 30 days)', () => {
    expect(normalizeOnboardingDateInput('2026-04-31')).toBeNull();
  });

  it('rejects month 0', () => {
    expect(normalizeOnboardingDateInput('2026-00-10')).toBeNull();
  });

  it('rejects month 13', () => {
    expect(normalizeOnboardingDateInput('2026-13-10')).toBeNull();
  });

  it('handles ISO date with leading/trailing whitespace', () => {
    expect(normalizeOnboardingDateInput('  2026-04-01  ')).toBe('2026-04-01');
  });

  it('handles slash date with leading/trailing whitespace', () => {
    expect(normalizeOnboardingDateInput('  4/1/2026  ')).toBe('2026-04-01');
  });
});

// ---------------------------------------------------------------------------
// 3. buildOnboardingCompletion — edge cases
// ---------------------------------------------------------------------------

describe('buildOnboardingCompletion — edge cases', () => {
  it('throws when ttcEnabled is true but no preset chosen (fresh flow)', () => {
    expect(() =>
      buildOnboardingCompletion(
        completeFreshDraft({
          ttcEnabled: true,
          ttcTrackingPreset: null,
        }),
      ),
    ).toThrow('Onboarding draft is incomplete');
  });

  it('includes trying-to-conceive in goals when ttcEnabled is true', () => {
    const result = buildOnboardingCompletion(
      completeFreshDraft({
        ttcEnabled: true,
        ttcTrackingPreset: 'basic',
      }),
    );
    expect(result.profile.goals).toContain('trying-to-conceive');
  });

  it('excludes trying-to-conceive from goals when ttcEnabled is false', () => {
    const result = buildOnboardingCompletion(completeFreshDraft({ ttcEnabled: false }));
    expect(result.profile.goals).not.toContain('trying-to-conceive');
  });

  it('always includes period in goals', () => {
    const result = buildOnboardingCompletion(
      completeFreshDraft({ symptomLoggingEnabled: false, ttcEnabled: false }),
    );
    expect(result.profile.goals).toContain('period');
  });

  it('sets basic TTC preferences correctly', () => {
    const result = buildOnboardingCompletion(
      completeFreshDraft({ ttcEnabled: true, ttcTrackingPreset: 'basic' }),
    );
    expect(result.profile.ttcTrackingPreferences).toEqual({
      sex: true,
      ovulationTest: true,
      cervicalMucus: false,
      basalBodyTemperature: false,
    });
  });

  it('sets full TTC preferences correctly', () => {
    const result = buildOnboardingCompletion(
      completeFreshDraft({ ttcEnabled: true, ttcTrackingPreset: 'full' }),
    );
    expect(result.profile.ttcTrackingPreferences).toEqual({
      sex: true,
      ovulationTest: true,
      cervicalMucus: true,
      basalBodyTemperature: true,
    });
  });

  it('sets default TTC preferences when ttcEnabled is false', () => {
    const result = buildOnboardingCompletion(completeFreshDraft({ ttcEnabled: false }));
    expect(result.profile.ttcTrackingPreferences).toEqual({ ...defaultTtcTrackingPreferences });
  });

  it('marks deferredBiometricsSetup true when biometricsSetupChoice is later', () => {
    const result = buildOnboardingCompletion(
      completeFreshDraft({ biometricsSetupChoice: 'later' }),
    );
    expect(result.preferences.deferredBiometricsSetup).toBe(true);
  });

  it('marks deferredReminderSetup true when reminderSetupChoice is later', () => {
    const result = buildOnboardingCompletion(completeFreshDraft({ reminderSetupChoice: 'later' }));
    expect(result.preferences.deferredReminderSetup).toBe(true);
  });

  it('does not mark deferredBiometricsSetup when biometricsSetupChoice is skip', () => {
    const result = buildOnboardingCompletion(
      completeFreshDraft({ biometricsSetupChoice: 'skip' }),
    );
    expect(result.preferences.deferredBiometricsSetup).toBe(false);
  });

  it('throws for fresh flow when lastPeriodStartDate is in the future', () => {
    expect(() =>
      buildOnboardingCompletion(
        completeFreshDraft({ lastPeriodStartDate: '2026-04-20' }),
      ),
    ).toThrow('Onboarding draft is incomplete');
  });

  it('throws for fresh flow when supportsIrregularCycles is null', () => {
    expect(() =>
      buildOnboardingCompletion(
        completeFreshDraft({ supportsIrregularCycles: null }),
      ),
    ).toThrow('Onboarding draft is incomplete');
  });
});

// ---------------------------------------------------------------------------
// 4. resolveOnboardingGuardRedirect — edge cases
// ---------------------------------------------------------------------------

describe('resolveOnboardingGuardRedirect — edge cases', () => {
  it('allows /welcome regardless of draft state', () => {
    expect(resolveOnboardingGuardRedirect('/welcome', createDefaultOnboardingDraft())).toBeNull();
  });

  it('allows /privacy-details regardless of draft state', () => {
    expect(
      resolveOnboardingGuardRedirect('/privacy-details', createDefaultOnboardingDraft()),
    ).toBeNull();
  });

  it('redirects unknown route to /start-path when no startPath chosen', () => {
    expect(
      resolveOnboardingGuardRedirect('/some-unknown-route', createDefaultOnboardingDraft()),
    ).toBe('/start-path');
  });

  it('redirects /ttc-preset to /completion when ttcEnabled is false', () => {
    const draft = completeFreshDraft({ ttcEnabled: false });
    const result = resolveOnboardingGuardRedirect('/ttc-preset', draft);
    // ttc-preset is not reachable with TTC off; with the paywall step retired
    // the guard now sends the user straight to completion.
    expect(result).toBe('/completion');
  });

  it('allows /completion after full fresh-start completion', () => {
    const result = resolveOnboardingGuardRedirect('/completion', completeFreshDraft());
    expect(result).toBeNull();
  });

  it('allows /completion even when the retired access step was never completed', () => {
    const result = resolveOnboardingGuardRedirect(
      '/completion',
      completeFreshDraft({ hasCompletedAccessStep: false }),
    );
    expect(result).toBeNull();
  });

  it('import startPath: allows /import sub-routes', () => {
    const draft = { ...createDefaultOnboardingDraft(), startPath: 'import' as const };
    expect(resolveOnboardingGuardRedirect('/import/preview', draft)).toBeNull();
  });

  it('import startPath: allows completion even when the retired access step is false', () => {
    const draft = {
      ...createDefaultOnboardingDraft(),
      startPath: 'import' as const,
      hasCompletedAccessStep: false,
    };
    expect(resolveOnboardingGuardRedirect('/completion', draft)).toBeNull();
  });

  it('restore startPath: allows completion even when the retired access step is false', () => {
    const draft = {
      ...createDefaultOnboardingDraft(),
      startPath: 'restore' as const,
      hasCompletedAccessStep: false,
    };
    expect(resolveOnboardingGuardRedirect('/completion', draft)).toBeNull();
  });

  it('restore startPath: allows completion when access step is complete', () => {
    const draft = {
      ...createDefaultOnboardingDraft(),
      startPath: 'restore' as const,
      hasCompletedAccessStep: true,
    };
    expect(resolveOnboardingGuardRedirect('/completion', draft)).toBeNull();
  });

  it('handles expo-router segment-group pathnames for fresh-start', () => {
    // Segment groups like /(onboarding)/start-path should be normalized
    const draft = { ...createDefaultOnboardingDraft(), startPath: null as null };
    expect(
      resolveOnboardingGuardRedirect('/(onboarding)/start-path', draft),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. createOnboardingDraftFromProfile — edge cases
// ---------------------------------------------------------------------------

describe('createOnboardingDraftFromProfile — edge cases', () => {
  it('returns default draft for undefined (not just null)', () => {
    expect(createOnboardingDraftFromProfile(undefined)).toEqual(createDefaultOnboardingDraft());
  });

  it('sets ttcTrackingPreset to basic when only sex/ovulation in preferences', () => {
    const draft = createOnboardingDraftFromProfile({
      goals: ['period', 'trying-to-conceive'],
      supportsIrregularCycles: false,
      conditionTags: [],
      ttcTrackingPreferences: {
        sex: true,
        ovulationTest: true,
        cervicalMucus: false,
        basalBodyTemperature: false,
      },
    });
    expect(draft.ttcTrackingPreset).toBe('basic');
  });

  it('sets ttcTrackingPreset to full when cervicalMucus is enabled', () => {
    const draft = createOnboardingDraftFromProfile({
      goals: ['period', 'trying-to-conceive'],
      supportsIrregularCycles: false,
      conditionTags: [],
      ttcTrackingPreferences: {
        sex: true,
        ovulationTest: true,
        cervicalMucus: true,
        basalBodyTemperature: false,
      },
    });
    expect(draft.ttcTrackingPreset).toBe('full');
  });

  it('sets ttcTrackingPreset to null when ttc goal not in profile', () => {
    const draft = createOnboardingDraftFromProfile({
      goals: ['period'],
      supportsIrregularCycles: false,
      conditionTags: [],
    });
    expect(draft.ttcTrackingPreset).toBeNull();
  });

  it('sets symptomLoggingEnabled to false when symptoms not in goals', () => {
    const draft = createOnboardingDraftFromProfile({
      goals: ['period'],
      supportsIrregularCycles: false,
      conditionTags: [],
    });
    expect(draft.symptomLoggingEnabled).toBe(false);
  });

  it('sets symptomLoggingEnabled to true when symptoms goal is present', () => {
    const draft = createOnboardingDraftFromProfile({
      goals: ['period', 'symptoms'],
      supportsIrregularCycles: false,
      conditionTags: [],
    });
    expect(draft.symptomLoggingEnabled).toBe(true);
  });

  it('uses default cycle/period lengths when profile has undefined values', () => {
    const draft = createOnboardingDraftFromProfile({
      goals: ['period'],
      supportsIrregularCycles: false,
      conditionTags: [],
      cycleLengthDays: undefined,
      periodLengthDays: undefined,
    });
    expect(draft.cycleLengthInput).toBe(String(defaultUserProfile.cycleLengthDays ?? 29));
    expect(draft.periodLengthInput).toBe(String(defaultUserProfile.periodLengthDays ?? 5));
  });
});

// ---------------------------------------------------------------------------
// 6. buildImportedOnboardingCompletion — edge cases
// ---------------------------------------------------------------------------

describe('buildImportedOnboardingCompletion — edge cases', () => {
  const importDraft: OnboardingDraft = {
    ...createDefaultOnboardingDraft(),
    startPath: 'import',
    hasCompletedAccessStep: true,
  };

  it('completes even when the retired access step is false', () => {
    expect(() =>
      buildImportedOnboardingCompletion(
        { ...importDraft, hasCompletedAccessStep: false },
        null,
        [validLog('l1', '2026-01-01', 'medium')],
      ),
    ).not.toThrow();
  });

  it('only spotting log falls through to spotting-only branch (no throw)', () => {
    // Only spotting, no light/medium/heavy => should not throw, uses seed profile
    expect(() =>
      buildImportedOnboardingCompletion(importDraft, null, [
        validLog('l1', '2026-01-01', 'spotting'),
      ]),
    ).not.toThrow();
  });

  it('throws when all logs are none bleeding', () => {
    expect(() =>
      buildImportedOnboardingCompletion(importDraft, null, [
        validLog('l1', '2026-01-01', 'none'),
        validLog('l2', '2026-01-02', 'none'),
      ]),
    ).toThrow('Floriva could not find any logged period days in that imported history.');
  });

  it('deferredImportSetup is true when importSetupChoice is later', () => {
    const result = buildImportedOnboardingCompletion(
      { ...importDraft, importSetupChoice: 'later' },
      null,
      [validLog('l1', '2026-01-01', 'medium')],
    );
    expect(result.preferences.deferredImportSetup).toBe(true);
  });

  it('uses persisted profile goals when available', () => {
    const result = buildImportedOnboardingCompletion(
      importDraft,
      {
        cycleLengthDays: 28,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-03-15',
        goals: ['period', 'symptoms'],
        supportsIrregularCycles: true,
        conditionTags: [],
      },
      [],
    );
    expect(result.profile.goals).toContain('symptoms');
  });

  it('falls back to period-only goal when persisted profile has empty goals', () => {
    const result = buildImportedOnboardingCompletion(
      importDraft,
      {
        cycleLengthDays: 28,
        periodLengthDays: 5,
        lastPeriodStartDate: '2026-03-15',
        goals: [],
        supportsIrregularCycles: false,
        conditionTags: [],
      },
      [],
    );
    expect(result.profile.goals).toEqual(['period']);
  });

  it('throws for fresh startPath in buildImportedOnboardingCompletion', () => {
    expect(() =>
      buildImportedOnboardingCompletion(
        { ...importDraft, startPath: 'fresh' },
        null,
        [validLog('l1', '2026-01-01', 'medium')],
      ),
    ).toThrow('Imported completion is only available for import and restore onboarding.');
  });
});

// ---------------------------------------------------------------------------
// 7. draftStorage — additional edge cases
// ---------------------------------------------------------------------------

describe('draftStorage — additional edge cases', () => {
  beforeEach(() => {
    mockGetItemAsync.mockReset();
    mockSetItemAsync.mockReset();
    mockDeleteItemAsync.mockReset();
  });

  it('returns null for JSON-primitive string (not an object)', async () => {
    mockGetItemAsync.mockResolvedValue(JSON.stringify('"a string"'));
    await expect(loadPersistedOnboardingDraft()).resolves.toBeNull();
  });

  it('returns null for JSON number primitive', async () => {
    mockGetItemAsync.mockResolvedValue('42');
    await expect(loadPersistedOnboardingDraft()).resolves.toBeNull();
  });

  it('returns null for JSON null', async () => {
    mockGetItemAsync.mockResolvedValue('null');
    await expect(loadPersistedOnboardingDraft()).resolves.toBeNull();
  });

  it('returns null for malformed JSON (parse error)', async () => {
    mockGetItemAsync.mockResolvedValue('{not valid json}');
    await expect(loadPersistedOnboardingDraft()).resolves.toBeNull();
  });

  it('returns an empty partial when all fields are invalid types', async () => {
    mockGetItemAsync.mockResolvedValue(
      JSON.stringify({
        cycleLengthInput: 123,
        hasConfirmedCycleLength: 'yes',
        periodLengthInput: null,
        hasConfirmedPeriodLength: 0,
        lastPeriodStartDate: [],
        goals: 'not-an-array',
        supportsIrregularCycles: 'maybe',
        conditionTags: {},
        ttcTrackingPreferences: 'none',
        reminderSetupChoice: 'never-heard-of-it',
        importSetupChoice: 42,
        biometricsSetupChoice: true,
        startPath: 'unknown-path',
        hasSelectedFreshPath: 1,
        symptomLoggingEnabled: 'yes',
        ttcEnabled: 'no',
        ttcTrackingPreset: 'advanced',
        hasCompletedTtcSetupStep: 'true',
        hasCompletedTtcExpectationsStep: 'true',
        hasCompletedAccessStep: 'false',
      }),
    );
    const result = await loadPersistedOnboardingDraft();
    // All fields invalid => empty partial object (not null, since the top-level IS an object)
    expect(result).toEqual({});
  });

  it('preserves valid boolean null for supportsIrregularCycles', async () => {
    mockGetItemAsync.mockResolvedValue(
      JSON.stringify({ supportsIrregularCycles: null }),
    );
    const result = await loadPersistedOnboardingDraft();
    expect(result).toEqual({ supportsIrregularCycles: null });
  });

  it('preserves valid boolean null for symptomLoggingEnabled', async () => {
    mockGetItemAsync.mockResolvedValue(
      JSON.stringify({ symptomLoggingEnabled: null }),
    );
    const result = await loadPersistedOnboardingDraft();
    expect(result).toEqual({ symptomLoggingEnabled: null });
  });

  it('preserves valid boolean null for ttcEnabled', async () => {
    mockGetItemAsync.mockResolvedValue(
      JSON.stringify({ ttcEnabled: null }),
    );
    const result = await loadPersistedOnboardingDraft();
    expect(result).toEqual({ ttcEnabled: null });
  });

  it('idempotently persists draft without throwing on repeated calls', async () => {
    mockSetItemAsync.mockResolvedValue(undefined);
    const draft = createDefaultOnboardingDraft();
    await persistOnboardingDraft(draft);
    await persistOnboardingDraft(draft);
    expect(mockSetItemAsync).toHaveBeenCalledTimes(2);
  });

  it('clears the draft after persist without error', async () => {
    mockSetItemAsync.mockResolvedValue(undefined);
    mockDeleteItemAsync.mockResolvedValue(undefined);
    const draft = createDefaultOnboardingDraft();
    await persistOnboardingDraft(draft);
    await clearPersistedOnboardingDraft();
    expect(mockDeleteItemAsync).toHaveBeenCalledWith('floriva.onboarding-draft.v1');
  });

  it('filters out unknown condition tags from persisted drafts', async () => {
    mockGetItemAsync.mockResolvedValue(
      JSON.stringify({ conditionTags: ['pcos', 'made-up-disease', 'endometriosis'] }),
    );
    const result = await loadPersistedOnboardingDraft();
    expect(result?.conditionTags).toEqual(['pcos', 'endometriosis']);
  });

  it('filters out unknown tracking goals from persisted drafts', async () => {
    mockGetItemAsync.mockResolvedValue(
      JSON.stringify({ goals: ['period', 'weight-loss', 'symptoms'] }),
    );
    const result = await loadPersistedOnboardingDraft();
    expect(result?.goals).toEqual(['period', 'symptoms']);
  });

  it('sanitizes ttcTrackingPreferences with partial missing fields by falling back to defaults', async () => {
    // ovulationTest missing => defaults to defaultTtcTrackingPreferences.ovulationTest (false)
    mockGetItemAsync.mockResolvedValue(
      JSON.stringify({
        ttcTrackingPreferences: {
          sex: true,
          cervicalMucus: false,
          basalBodyTemperature: false,
          // ovulationTest intentionally missing
        },
      }),
    );
    const result = await loadPersistedOnboardingDraft();
    expect(result?.ttcTrackingPreferences?.ovulationTest).toBe(
      defaultTtcTrackingPreferences.ovulationTest,
    );
    expect(result?.ttcTrackingPreferences?.sex).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 8. validateGoalsStep — edge cases
// ---------------------------------------------------------------------------

describe('validateGoalsStep — edge cases', () => {
  it('passes when at least one goal and irregularCycles set', () => {
    const errors = validateGoalsStep({
      ...createDefaultOnboardingDraft(),
      goals: ['period'],
      supportsIrregularCycles: false,
    });
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('requires goals even if irregularCycles is set', () => {
    const errors = validateGoalsStep({
      ...createDefaultOnboardingDraft(),
      goals: [],
      supportsIrregularCycles: true,
    });
    expect(errors.goals).toBeDefined();
    expect(errors.supportsIrregularCycles).toBeUndefined();
  });

  it('requires irregularCycles decision even if goals are present', () => {
    const errors = validateGoalsStep({
      ...createDefaultOnboardingDraft(),
      goals: ['period'],
      supportsIrregularCycles: null,
    });
    expect(errors.supportsIrregularCycles).toBeDefined();
    expect(errors.goals).toBeUndefined();
  });
});
