import path from 'node:path';

import Database from 'better-sqlite3';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { AccessibilityInfo } from 'react-native';

import { createDomainRepositories } from '@/src/db/repositories';
import { schema } from '@/src/db/schema';
import type { PredictionSnapshot } from '@/src/types/domain';

let mockRepositories: ReturnType<typeof createDomainRepositories>;
const mockAttemptAutomaticReviewPrompt = jest.fn();
const mockPush = jest.fn();

jest.mock('@/src/db/DatabaseProvider', () => ({
  useDatabase: () => ({
    repositories: mockRepositories,
  }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => mockPush(...args),
  }),
}));

jest.mock('@/src/localization/LocalizationProvider', () => {
  const { createMockLocalization } = require('../../helpers/mockLocalizationProvider');

  return {
    useLocalization: () => createMockLocalization(),
  };
});

jest.mock('@/src/features/review/automaticReview', () => ({
  attemptAutomaticReviewPrompt: (...args: unknown[]) =>
    mockAttemptAutomaticReviewPrompt(...args),
}));

// eslint-disable-next-line import/first
import { QuickLogPeriodButton } from '@/src/features/tracker/components/QuickLogPeriodButton';
// eslint-disable-next-line import/first
import { testIds } from '@/src/testing/testIds';

const migrationDirectory = path.resolve(__dirname, '../../../drizzle');

function createRepositories() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });

  migrate(db, { migrationsFolder: migrationDirectory });

  return createDomainRepositories(db);
}

function createSnapshot(overrides: Partial<PredictionSnapshot> = {}): PredictionSnapshot {
  return {
    cycleDay: 24,
    cycleLengthDays: 28,
    periodLengthDays: 5,
    cycleDayLabel: 'Cycle day 24',
    nextPeriodStartIso: '2026-04-25',
    fertileWindowLabel: 'Fertile window ended 9 days ago',
    fertileWindowStartOffsetDays: 9,
    confidenceLevel: 'medium',
    confidenceLabel: 'Medium confidence',
    confidenceBasisLabel: 'Based on 2 local cycle starts',
    confidenceReasonCodes: [],
    limitations: [],
    ...overrides,
  };
}

describe('QuickLogPeriodButton', () => {
  async function flushMicrotasks() {
    await act(async () => {
      await Promise.resolve();
    });
  }

  beforeEach(() => {
    mockRepositories = createRepositories();
    mockAttemptAutomaticReviewPrompt.mockReset();
    mockPush.mockReset();
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('is not rendered when today is outside the quick-log window', async () => {
    render(
      <QuickLogPeriodButton
        todayIso="2026-04-20"
        snapshot={createSnapshot({ nextPeriodStartIso: '2026-04-25' })}
      />,
    );
    await flushMicrotasks();

    expect(screen.queryByTestId(testIds.today.quickLogPeriodButton)).toBeNull();
  });

  it('is not rendered when bleeding is already logged for today', async () => {
    await mockRepositories.dailyLogs.saveEntry({
      id: 'daily-log-2026-04-25',
      logDate: '2026-04-25',
      bleeding: 'medium',
      symptoms: [],
    });

    render(
      <QuickLogPeriodButton
        todayIso="2026-04-25"
        snapshot={createSnapshot({ nextPeriodStartIso: '2026-04-25' })}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByTestId(testIds.today.quickLogPeriodButton)).toBeNull();
    });
  });

  it('renders the quick-log button with a proper role and label when within the window', async () => {
    render(
      <QuickLogPeriodButton
        todayIso="2026-04-25"
        snapshot={createSnapshot({ nextPeriodStartIso: '2026-04-25' })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(testIds.today.quickLogPeriodButton)).toBeTruthy();
    });

    const button = screen.getByTestId(testIds.today.quickLogPeriodButton);
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBeTruthy();
  });

  it('saves a medium-flow entry for today via the daily logs repository on tap', async () => {
    render(
      <QuickLogPeriodButton
        todayIso="2026-04-25"
        snapshot={createSnapshot({ nextPeriodStartIso: '2026-04-25' })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(testIds.today.quickLogPeriodButton)).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId(testIds.today.quickLogPeriodButton));
      await Promise.resolve();
    });

    const savedEntry = await mockRepositories.dailyLogs.getEntryByDate('2026-04-25');
    expect(savedEntry?.bleeding).toBe('medium');
  });

  it('shows an inline confirmation and an Adjust link after saving, and does not trigger the review prompt', async () => {
    render(
      <QuickLogPeriodButton
        todayIso="2026-04-25"
        snapshot={createSnapshot({ nextPeriodStartIso: '2026-04-25' })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(testIds.today.quickLogPeriodButton)).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId(testIds.today.quickLogPeriodButton));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId(testIds.today.quickLogPeriodConfirmation)).toBeTruthy();
      expect(screen.getByTestId(testIds.today.quickLogPeriodAdjustLink)).toBeTruthy();
    });

    // Give the 500ms-delayed automatic-review-prompt effect (if the writer
    // wired one up, mirroring TodayLoggingCard) a chance to fire.
    await new Promise((resolve) => setTimeout(resolve, 600));

    expect(mockAttemptAutomaticReviewPrompt).not.toHaveBeenCalled();
  });

  it('announces the confirmation for accessibility', async () => {
    render(
      <QuickLogPeriodButton
        todayIso="2026-04-25"
        snapshot={createSnapshot({ nextPeriodStartIso: '2026-04-25' })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(testIds.today.quickLogPeriodButton)).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId(testIds.today.quickLogPeriodButton));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalled();
    });
  });

  it('the Adjust link routes to the full day editor via buildCalendarDayRoute', async () => {
    render(
      <QuickLogPeriodButton
        todayIso="2026-04-25"
        snapshot={createSnapshot({ nextPeriodStartIso: '2026-04-25' })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(testIds.today.quickLogPeriodButton)).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId(testIds.today.quickLogPeriodButton));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId(testIds.today.quickLogPeriodAdjustLink)).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId(testIds.today.quickLogPeriodAdjustLink));

    expect(mockPush).toHaveBeenCalledWith('/calendar/day/2026-04-25');
  });

  it('calls onLogged after a successful save so the parent screen can refresh', async () => {
    const onLogged = jest.fn();

    render(
      <QuickLogPeriodButton
        todayIso="2026-04-25"
        snapshot={createSnapshot({ nextPeriodStartIso: '2026-04-25' })}
        onLogged={onLogged}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(testIds.today.quickLogPeriodButton)).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId(testIds.today.quickLogPeriodButton));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(onLogged).toHaveBeenCalledTimes(1);
    });
  });

  it('preserves symptoms, mood, and notes already logged today when quick-logging bleeding on top', async () => {
    // Regression: the button shows exactly when no bleeding is logged, which
    // includes days where the user already logged other signals. Quick-log
    // must merge bleeding into that entry, never replace it with an
    // empty-draft entry.
    await mockRepositories.dailyLogs.saveEntry({
      id: 'daily-log-2026-04-25',
      logDate: '2026-04-25',
      bleeding: 'none',
      symptoms: ['cramps', 'fatigue'],
      mood: 'low',
      notes: 'Slept badly, cramps since morning.',
    });

    render(
      <QuickLogPeriodButton
        todayIso="2026-04-25"
        snapshot={createSnapshot({ nextPeriodStartIso: '2026-04-25' })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(testIds.today.quickLogPeriodButton)).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId(testIds.today.quickLogPeriodButton));
      await Promise.resolve();
    });

    const savedEntry = await mockRepositories.dailyLogs.getEntryByDate('2026-04-25');
    expect(savedEntry?.bleeding).toBe('medium');
    expect(savedEntry?.symptoms).toEqual(['cramps', 'fatigue']);
    expect(savedEntry?.mood).toBe('low');
    expect(savedEntry?.notes).toBe('Slept badly, cramps since morning.');
  });

  it('re-fetches the entry at save time so signals logged elsewhere since hydration are never wiped', async () => {
    render(
      <QuickLogPeriodButton
        todayIso="2026-04-25"
        snapshot={createSnapshot({ nextPeriodStartIso: '2026-04-25' })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(testIds.today.quickLogPeriodButton)).toBeTruthy();
    });

    // Simulate another surface (e.g. the full editor on a second navigation
    // stack entry) writing today's log after this component hydrated its
    // in-state copy (null at this point).
    await mockRepositories.dailyLogs.saveEntry({
      id: 'daily-log-2026-04-25',
      logDate: '2026-04-25',
      bleeding: 'none',
      symptoms: ['headache'],
      mood: 'sensitive',
      notes: 'Logged from the editor.',
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId(testIds.today.quickLogPeriodButton));
      await Promise.resolve();
    });

    const savedEntry = await mockRepositories.dailyLogs.getEntryByDate('2026-04-25');
    expect(savedEntry?.bleeding).toBe('medium');
    expect(savedEntry?.symptoms).toEqual(['headache']);
    expect(savedEntry?.mood).toBe('sensitive');
    expect(savedEntry?.notes).toBe('Logged from the editor.');
  });

  it('never downgrades bleeding already logged elsewhere since hydration', async () => {
    render(
      <QuickLogPeriodButton
        todayIso="2026-04-25"
        snapshot={createSnapshot({ nextPeriodStartIso: '2026-04-25' })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(testIds.today.quickLogPeriodButton)).toBeTruthy();
    });

    // Bleeding gets logged from another surface after this component
    // hydrated (while the button is still on screen).
    await mockRepositories.dailyLogs.saveEntry({
      id: 'daily-log-2026-04-25',
      logDate: '2026-04-25',
      bleeding: 'heavy',
      symptoms: [],
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId(testIds.today.quickLogPeriodButton));
      await Promise.resolve();
    });

    const savedEntry = await mockRepositories.dailyLogs.getEntryByDate('2026-04-25');
    expect(savedEntry?.bleeding).toBe('heavy');
  });

  it('shows a calm inline error when the save fails, instead of an unhandled rejection', async () => {
    const failingRepositories = {
      ...mockRepositories,
      dailyLogs: {
        ...mockRepositories.dailyLogs,
        saveEntry: jest.fn().mockRejectedValue(new Error('disk full')),
      },
    };
    mockRepositories = failingRepositories as typeof mockRepositories;

    render(
      <QuickLogPeriodButton
        todayIso="2026-04-25"
        snapshot={createSnapshot({ nextPeriodStartIso: '2026-04-25' })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(testIds.today.quickLogPeriodButton)).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId(testIds.today.quickLogPeriodButton));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId(testIds.today.quickLogPeriodError)).toBeTruthy();
    });
    // No confirmation, and the button stays available to retry.
    expect(screen.queryByTestId(testIds.today.quickLogPeriodConfirmation)).toBeNull();
    expect(screen.getByTestId(testIds.today.quickLogPeriodButton)).toBeTruthy();
  });

  it('keeps the saved confirmation mounted through a post-save refreshVersion re-hydration (no flicker)', async () => {
    const { rerender } = render(
      <QuickLogPeriodButton
        todayIso="2026-04-25"
        snapshot={createSnapshot({ nextPeriodStartIso: '2026-04-25' })}
        refreshVersion={0}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(testIds.today.quickLogPeriodButton)).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId(testIds.today.quickLogPeriodButton));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId(testIds.today.quickLogPeriodConfirmation)).toBeTruthy();
    });

    // The parent bumps its refresh counter right after onLogged; the new
    // hydration pass must not unmount the confirmation, even synchronously
    // before the re-hydration settles.
    rerender(
      <QuickLogPeriodButton
        todayIso="2026-04-25"
        snapshot={createSnapshot({ nextPeriodStartIso: '2026-04-25' })}
        refreshVersion={1}
      />,
    );

    expect(screen.getByTestId(testIds.today.quickLogPeriodConfirmation)).toBeTruthy();

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId(testIds.today.quickLogPeriodConfirmation)).toBeTruthy();
  });

  it('drops the saved latch and offers the button again when a re-hydration finds bleeding was cleared (Adjust round-trip)', async () => {
    const { rerender } = render(
      <QuickLogPeriodButton
        todayIso="2026-04-25"
        snapshot={createSnapshot({ nextPeriodStartIso: '2026-04-25' })}
        refreshVersion={0}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(testIds.today.quickLogPeriodButton)).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId(testIds.today.quickLogPeriodButton));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId(testIds.today.quickLogPeriodConfirmation)).toBeTruthy();
    });

    // User taps Adjust, clears bleeding in the full editor (keeping a
    // symptom so the entry survives), then navigates back — the focus
    // re-hydration must drop the stale "Saved" confirmation and offer the
    // quick-log button again for that day.
    const savedEntry = await mockRepositories.dailyLogs.getEntryByDate('2026-04-25');
    await mockRepositories.dailyLogs.saveEntry({
      ...savedEntry!,
      bleeding: 'none',
      symptoms: ['cramps'],
    });

    rerender(
      <QuickLogPeriodButton
        todayIso="2026-04-25"
        snapshot={createSnapshot({ nextPeriodStartIso: '2026-04-25' })}
        refreshVersion={1}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByTestId(testIds.today.quickLogPeriodConfirmation)).toBeNull();
      expect(screen.getByTestId(testIds.today.quickLogPeriodButton)).toBeTruthy();
    });
  });

  it('drops the saved latch when a re-hydration finds the whole entry was deleted', async () => {
    const { rerender } = render(
      <QuickLogPeriodButton
        todayIso="2026-04-25"
        snapshot={createSnapshot({ nextPeriodStartIso: '2026-04-25' })}
        refreshVersion={0}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(testIds.today.quickLogPeriodButton)).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId(testIds.today.quickLogPeriodButton));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId(testIds.today.quickLogPeriodConfirmation)).toBeTruthy();
    });

    const savedEntry = await mockRepositories.dailyLogs.getEntryByDate('2026-04-25');
    await mockRepositories.dailyLogs.deleteEntry(savedEntry!.id);

    rerender(
      <QuickLogPeriodButton
        todayIso="2026-04-25"
        snapshot={createSnapshot({ nextPeriodStartIso: '2026-04-25' })}
        refreshVersion={1}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByTestId(testIds.today.quickLogPeriodConfirmation)).toBeNull();
      expect(screen.getByTestId(testIds.today.quickLogPeriodButton)).toBeTruthy();
    });
  });

  it('treats a failure to read today entry as "nothing logged yet" and still shows the button within the window', async () => {
    const failingRepositories = {
      ...mockRepositories,
      dailyLogs: {
        ...mockRepositories.dailyLogs,
        getEntryByDate: jest.fn().mockRejectedValue(new Error('read failed')),
      },
    };
    mockRepositories = failingRepositories as typeof mockRepositories;

    render(
      <QuickLogPeriodButton
        todayIso="2026-04-25"
        snapshot={createSnapshot({ nextPeriodStartIso: '2026-04-25' })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(testIds.today.quickLogPeriodButton)).toBeTruthy();
    });
  });

  it('re-hydrates today entry when refreshVersion changes, hiding the button once bleeding is logged elsewhere', async () => {
    const { rerender } = render(
      <QuickLogPeriodButton
        todayIso="2026-04-25"
        snapshot={createSnapshot({ nextPeriodStartIso: '2026-04-25' })}
        refreshVersion={0}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(testIds.today.quickLogPeriodButton)).toBeTruthy();
    });

    await mockRepositories.dailyLogs.saveEntry({
      id: 'daily-log-2026-04-25',
      logDate: '2026-04-25',
      bleeding: 'heavy',
      symptoms: [],
    });

    rerender(
      <QuickLogPeriodButton
        todayIso="2026-04-25"
        snapshot={createSnapshot({ nextPeriodStartIso: '2026-04-25' })}
        refreshVersion={1}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByTestId(testIds.today.quickLogPeriodButton)).toBeNull();
    });
  });
});
