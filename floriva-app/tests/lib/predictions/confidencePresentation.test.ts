import { attachImprovementActions } from '@/src/lib/predictions/confidencePresentation';

describe('attachImprovementActions', () => {
  const todayIso = '2026-04-20';

  it('attaches a "log today" href for limited bleeding history', () => {
    const improvements = attachImprovementActions(['limited-bleeding-history'], todayIso);

    expect(improvements).toEqual([
      {
        code: 'limited-bleeding-history',
        action: { href: '/calendar/day/2026-04-20' },
      },
    ]);
  });

  it('attaches a "log today" href for a single observed interval', () => {
    const improvements = attachImprovementActions(['one-observed-interval'], todayIso);

    expect(improvements).toEqual([
      {
        code: 'one-observed-interval',
        action: { href: '/calendar/day/2026-04-20' },
      },
    ]);
  });

  it('attaches a "log today" href for onboarding-seed data', () => {
    const improvements = attachImprovementActions(['onboarding-seed'], todayIso);

    expect(improvements).toEqual([
      {
        code: 'onboarding-seed',
        action: { href: '/calendar/day/2026-04-20' },
      },
    ]);
  });

  it('attaches hrefs to multiple codes, preserving order', () => {
    const improvements = attachImprovementActions(
      ['onboarding-seed', 'limited-bleeding-history'],
      todayIso,
    );

    expect(improvements.map((improvement) => improvement.code)).toEqual([
      'onboarding-seed',
      'limited-bleeding-history',
    ]);
    expect(
      improvements.every((improvement) => improvement.action?.href === `/calendar/day/${todayIso}`),
    ).toBe(true);
  });

  it('returns an empty array for an empty improvement-codes list', () => {
    expect(attachImprovementActions([], todayIso)).toEqual([]);
  });

  it('builds a route scoped to the given todayIso', () => {
    const improvements = attachImprovementActions(['onboarding-seed'], '2027-01-05');

    expect(improvements[0]?.action?.href).toBe('/calendar/day/2027-01-05');
  });
});
