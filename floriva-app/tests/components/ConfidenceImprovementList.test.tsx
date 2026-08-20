import { fireEvent, render, screen } from '@testing-library/react-native';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => mockPush(...args),
  }),
}));

jest.mock('@/src/localization/LocalizationProvider', () => {
  const { createMockLocalization } = require('../helpers/mockLocalizationProvider');

  return {
    useLocalization: () => createMockLocalization(),
  };
});

// eslint-disable-next-line import/first
import { ConfidenceImprovementList } from '@/src/components/primitives/ConfidenceImprovementList';
// eslint-disable-next-line import/first
import { testIds } from '@/src/testing/testIds';
// eslint-disable-next-line import/first
import type { ConfidenceImprovement } from '@/src/types/domain';

describe('ConfidenceImprovementList', () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it('renders nothing when there are no improvements', () => {
    render(<ConfidenceImprovementList improvements={[]} />);

    expect(screen.queryByTestId(testIds.confidenceImprovementList.list)).toBeNull();
  });

  it('renders a tappable row for each improvement with a resolved localized label', () => {
    const improvements: ConfidenceImprovement[] = [
      {
        code: 'onboarding-seed',
        action: { href: '/calendar/day/2026-04-20' },
      },
      {
        code: 'limited-bleeding-history',
        action: { href: '/calendar/day/2026-04-20' },
      },
    ];

    render(<ConfidenceImprovementList improvements={improvements} />);

    expect(screen.getByTestId(testIds.confidenceImprovementList.list)).toBeTruthy();
    expect(
      screen.getByText('Log your next period to replace onboarding estimates'),
    ).toBeTruthy();
    expect(screen.getByText('Log today to sharpen this estimate')).toBeTruthy();
  });

  it('routes to the action href when a tappable row is pressed', () => {
    const improvements: ConfidenceImprovement[] = [
      {
        code: 'one-observed-interval',
        action: { href: '/calendar/day/2026-04-20' },
      },
    ];

    render(<ConfidenceImprovementList improvements={improvements} />);

    fireEvent.press(screen.getByTestId(testIds.confidenceImprovementList.row('one-observed-interval')));

    expect(mockPush).toHaveBeenCalledWith('/calendar/day/2026-04-20');
  });

  it('exposes tappable rows as accessible buttons with a label and a hint that they open the day editor', () => {
    const improvements: ConfidenceImprovement[] = [
      {
        code: 'onboarding-seed',
        action: { href: '/calendar/day/2026-04-20' },
      },
    ];

    render(<ConfidenceImprovementList improvements={improvements} />);

    const row = screen.getByTestId(testIds.confidenceImprovementList.row('onboarding-seed'));

    expect(row.props.accessibilityRole).toBe('button');
    expect(row.props.accessibilityLabel).toBe(
      'Log your next period to replace onboarding estimates',
    );
  });

  it('renders rows without an action as plain, non-tappable, inert rows', () => {
    const improvements: ConfidenceImprovement[] = [
      {
        code: 'irregular-cycle-support-enabled',
      },
    ];

    render(<ConfidenceImprovementList improvements={improvements} />);

    const row = screen.getByTestId(
      testIds.confidenceImprovementList.row('irregular-cycle-support-enabled'),
    );

    expect(row.props.accessibilityRole).not.toBe('button');

    fireEvent.press(row);

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('resolves the row label directly from the locale catalog by reason code', () => {
    const improvements: ConfidenceImprovement[] = [
      {
        code: 'onboarding-seed',
        action: { href: '/calendar/day/2026-04-20' },
      },
    ];

    render(<ConfidenceImprovementList improvements={improvements} />);

    expect(
      screen.getByText('Log your next period to replace onboarding estimates'),
    ).toBeTruthy();
  });

  it('renders multiple rows preserving order', () => {
    const improvements: ConfidenceImprovement[] = [
      {
        code: 'onboarding-seed',
        action: { href: '/calendar/day/2026-04-20' },
      },
      {
        code: 'limited-bleeding-history',
        action: { href: '/calendar/day/2026-04-20' },
      },
      {
        code: 'consistent-recent-bleeding-history',
      },
    ];

    render(<ConfidenceImprovementList improvements={improvements} />);

    const list = screen.getByTestId(testIds.confidenceImprovementList.list);
    expect(list).toBeTruthy();
    expect(
      screen.getByTestId(testIds.confidenceImprovementList.row('onboarding-seed')),
    ).toBeTruthy();
    expect(
      screen.getByTestId(testIds.confidenceImprovementList.row('limited-bleeding-history')),
    ).toBeTruthy();
    expect(
      screen.getByTestId(
        testIds.confidenceImprovementList.row('consistent-recent-bleeding-history'),
      ),
    ).toBeTruthy();
  });
});
