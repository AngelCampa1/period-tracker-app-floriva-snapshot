import { fireEvent, render, screen, within } from '@testing-library/react-native';

const mockTriggerPressFeedback = jest.fn();
const mockSearchParams: { variant?: string; state?: string } = {};

jest.mock('@/src/features/feedback/InteractionFeedbackProvider', () => ({
  useOptionalInteractionFeedback: () => ({
    triggerPressFeedback: (...args: unknown[]) => mockTriggerPressFeedback(...args),
  }),
}));

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useLocalSearchParams: () => mockSearchParams,
}));

// eslint-disable-next-line import/first
import { DevCalendarGalleryScreen } from '@/src/features/calendar/screens/DevCalendarGalleryScreen';
// eslint-disable-next-line import/first
import { calendarDirectionFixtures } from '@/src/testing/calendarDirectionFixture';
// eslint-disable-next-line import/first
import {
  buildCalendarDayCellTestId,
  buildCalendarPredictedDayMarkerTestId,
  buildDevCalendarGalleryStateChipTestId,
  buildDevCalendarGalleryVariantChipTestId,
  testIds,
} from '@/src/testing/testIds';

describe('DevCalendarGalleryScreen', () => {
  beforeEach(() => {
    mockTriggerPressFeedback.mockReset();
    delete mockSearchParams.variant;
    delete mockSearchParams.state;
  });

  it('renders the classic/standard combination by default with the fixture description as legend placeholder', () => {
    render(<DevCalendarGalleryScreen />);

    expect(screen.getByTestId(testIds.devCalendarGallery.screen)).toBeTruthy();
    expect(screen.getByTestId(testIds.devCalendarGallery.grid)).toBeTruthy();
    expect(screen.getByTestId(testIds.devCalendarGallery.description)).toHaveTextContent(
      calendarDirectionFixtures.standard.description,
    );
    // Standard fixture facts surface through the real grid: a predicted
    // marker on Jul 24 and the standard selected date pre-selected.
    expect(screen.getByTestId(buildCalendarPredictedDayMarkerTestId('2026-07-24'))).toBeTruthy();
    expect(
      screen.getByTestId(buildCalendarDayCellTestId('2026-07-09')).props.accessibilityState,
    ).toMatchObject({ selected: true });
  });

  it('switches between both variants while the grid keeps rendering', () => {
    render(<DevCalendarGalleryScreen />);

    for (const variant of ['quiet-bands', 'classic']) {
      fireEvent.press(screen.getByTestId(buildDevCalendarGalleryVariantChipTestId(variant)));

      expect(
        screen.getByTestId(buildDevCalendarGalleryVariantChipTestId(variant)).props
          .accessibilityState,
      ).toMatchObject({ selected: true });
      // The stub renderers delegate to classic, so every variant renders
      // the full fixture grid end-to-end.
      expect(screen.getByTestId(testIds.devCalendarGallery.grid)).toBeTruthy();
      expect(screen.getByTestId(buildCalendarDayCellTestId('2026-07-03'))).toBeTruthy();
    }
  });

  it('switches fixture states and resets the selection to the new fixture default', () => {
    render(<DevCalendarGalleryScreen />);

    fireEvent.press(screen.getByTestId(buildDevCalendarGalleryStateChipTestId('stale')));

    expect(screen.getByTestId(testIds.devCalendarGallery.description)).toHaveTextContent(
      calendarDirectionFixtures.stale.description,
    );
    // Stale suppresses every predicted marker the standard fixture showed.
    expect(screen.queryByTestId(buildCalendarPredictedDayMarkerTestId('2026-07-24'))).toBeNull();
    expect(
      screen.getByTestId(buildCalendarDayCellTestId(calendarDirectionFixtures.stale.selectedDate))
        .props.accessibilityState,
    ).toMatchObject({ selected: true });

    fireEvent.press(screen.getByTestId(buildDevCalendarGalleryStateChipTestId('todayInBand')));

    expect(screen.getByTestId(testIds.devCalendarGallery.description)).toHaveTextContent(
      calendarDirectionFixtures.todayInBand.description,
    );
  });

  it('selects a variant/state combo from deep-link params (capture-sweep driving)', () => {
    mockSearchParams.variant = 'quiet-bands';
    mockSearchParams.state = 'stale';

    render(<DevCalendarGalleryScreen />);

    expect(
      screen.getByTestId(buildDevCalendarGalleryVariantChipTestId('quiet-bands')).props
        .accessibilityState,
    ).toMatchObject({ selected: true });
    expect(screen.getByTestId(testIds.devCalendarGallery.description)).toHaveTextContent(
      calendarDirectionFixtures.stale.description,
    );
  });

  it('ignores unknown deep-link params and keeps the default combo', () => {
    mockSearchParams.variant = 'not-a-variant';
    mockSearchParams.state = 'not-a-state';

    render(<DevCalendarGalleryScreen />);

    expect(
      screen.getByTestId(buildDevCalendarGalleryVariantChipTestId('classic')).props
        .accessibilityState,
    ).toMatchObject({ selected: true });
    expect(screen.getByTestId(testIds.devCalendarGallery.description)).toHaveTextContent(
      calendarDirectionFixtures.standard.description,
    );
  });

  it('renders the shared legend row with the selected variant legend (quiet-bands parity with the real screen)', () => {
    mockSearchParams.variant = 'quiet-bands';

    render(<DevCalendarGalleryScreen />);

    const legend = screen.getByTestId(testIds.devCalendarGallery.legend);

    // Dev-only surface keeps the legend module's plain-English labels; the
    // real CalendarScreen renders the same shared component with i18n
    // labels, so the two stay structurally identical.
    for (const label of ['Period', 'Predicted', 'Fertile window', 'Logged', 'Selected']) {
      expect(within(legend).getByText(label)).toBeTruthy();
    }
  });

  it('lets the preview grid change the selected day', () => {
    render(<DevCalendarGalleryScreen />);

    fireEvent.press(screen.getByTestId(buildCalendarDayCellTestId('2026-07-15')));

    expect(
      screen.getByTestId(buildCalendarDayCellTestId('2026-07-15')).props.accessibilityState,
    ).toMatchObject({ selected: true });
    expect(
      screen.getByTestId(buildCalendarDayCellTestId('2026-07-09')).props.accessibilityState,
    ).toMatchObject({ selected: false });
  });
});
