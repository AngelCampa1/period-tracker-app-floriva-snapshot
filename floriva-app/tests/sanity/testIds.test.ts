import {
  buildCalendarDayCellFrameTestId,
  buildCalendarDayCellTestId,
  buildCalendarPredictedDayMarkerTestId,
  buildPrivateTimelineFilterTestId,
  buildPrivateTimelineItemTestId,
  buildInsightsConditionRowTestId,
  buildSettingsReminderActionTestId,
  buildSettingsReminderCenterRowTestId,
  buildTodayLoggingChipTestId,
  testIds,
} from '@/src/testing/testIds';

describe('testIds', () => {
  it('exposes privacy policy modal ids', () => {
    expect(testIds.privacy.policyModal).toBe('privacy-policy-modal');
    expect(testIds.privacy.policyModalCloseButton).toBe(
      'privacy-policy-modal-close-button',
    );
  });

  it('exposes stable import review and completion ids', () => {
    expect(testIds.import.reviewMetrics).toBe('import-review-metrics');
    expect(testIds.import.reviewWarnings).toBe('import-review-warnings');
    expect(testIds.import.confidenceSummary).toBe('import-confidence-summary');
    expect(testIds.import.duplicateSummary).toBe('import-duplicate-summary');
    expect(testIds.import.duplicateDate('2026-04-09')).toBe(
      'import-duplicate-date-2026-04-09',
    );
    expect(testIds.import.previewEntry('2026-04-09')).toBe(
      'import-preview-entry-2026-04-09',
    );
    expect(testIds.import.removePreviewEntry('2026-04-09')).toBe(
      'import-remove-preview-entry-2026-04-09',
    );
    expect(testIds.import.resultSummary).toBe('import-result-summary');
    expect(testIds.import.manualFallbackButton).toBe('import-manual-fallback-button');
  });

  it('builds dynamic test ids consistently', () => {
    expect(testIds.today.confidenceSummary).toBe('today-confidence-summary');
    expect(testIds.today.birthControlLoggingControls).toBe(
      'today-birth-control-logging-controls',
    );
    expect(testIds.today.conditionLoggingContext).toBe('today-condition-logging-context');
    expect(testIds.calendar.confidenceSummary).toBe('calendar-confidence-summary');
    expect(testIds.insights.conditionSummaryCard).toBe('insights-condition-summary-card');
    expect(testIds.insights.conditionFocusCard).toBe('insights-condition-focus-card');
    expect(testIds.insights.monthlyBriefingCard).toBe('insights-monthly-briefing-card');
    expect(testIds.insights.monthlyBriefingRow).toBe('insights-monthly-briefing-row');
    expect(testIds.insights.monthlyBriefingScreen).toBe('insights-monthly-briefing-screen');
    expect(testIds.settings.reminderCenter).toBe('settings-reminder-center');
    expect(buildSettingsReminderActionTestId('daily-log', 'toggle')).toBe(
      'settings-reminder-daily-log-toggle',
    );
    expect(buildSettingsReminderCenterRowTestId('daily-log')).toBe(
      'settings-reminder-center-row-daily-log',
    );
    expect(buildInsightsConditionRowTestId('pcos')).toBe('insights-condition-row-pcos');
    expect(buildTodayLoggingChipTestId('symptoms', 'cramps')).toBe(
      'today-logging-chip-symptoms-cramps',
    );
    expect(buildCalendarDayCellTestId('2026-04-30')).toBe(
      'calendar-day-cell-2026-04-30',
    );
    expect(buildCalendarDayCellFrameTestId('2026-04-30')).toBe(
      'calendar-day-cell-frame-2026-04-30',
    );
    expect(buildCalendarPredictedDayMarkerTestId('2026-04-30')).toBe(
      'calendar-predicted-day-marker-2026-04-30',
    );
    expect(buildPrivateTimelineFilterTestId('backup')).toBe(
      'private-timeline-filter-backup',
    );
    expect(buildPrivateTimelineItemTestId('backup-1')).toBe(
      'private-timeline-item-backup-1',
    );
  });
});
