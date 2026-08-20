import {
  calendarDirectionFixtureNames,
  calendarDirectionFixtures,
  overlap,
  stale,
  standard,
  todayInBand,
  type CalendarDirectionFixture,
} from '@/src/testing/calendarDirectionFixture';

function findCell(fixture: CalendarDirectionFixture, date: string) {
  return fixture.weeks.flat().find((cell) => cell.date === date);
}

describe('calendarDirectionFixture', () => {
  it('exposes every fixture through the shared record in a stable order', () => {
    expect(calendarDirectionFixtureNames).toEqual([
      'standard',
      'overlap',
      'todayInBand',
      'stale',
    ]);
    expect(calendarDirectionFixtures.standard).toBe(standard);
    expect(calendarDirectionFixtures.overlap).toBe(overlap);
    expect(calendarDirectionFixtures.todayInBand).toBe(todayInBand);
    expect(calendarDirectionFixtures.stale).toBe(stale);

    for (const name of calendarDirectionFixtureNames) {
      const fixture = calendarDirectionFixtures[name];
      expect(fixture.weekdayLabels).toHaveLength(7);
      expect(fixture.weeks.length).toBeGreaterThanOrEqual(5);
      expect(fixture.description.length).toBeGreaterThan(0);
    }
  });

  it('standard: logged period run Jul 3-7 segments and clips at the week boundary', () => {
    expect(findCell(standard, '2026-07-03')?.periodBand).toBe('start');
    expect(findCell(standard, '2026-07-04')?.periodBand).toBe('end');
    expect(findCell(standard, '2026-07-05')?.periodBand).toBe('start');
    expect(findCell(standard, '2026-07-06')?.periodBand).toBe('mid');
    expect(findCell(standard, '2026-07-07')?.periodBand).toBe('end');
  });

  it('standard: single-day spotting on Jul 10 keeps its marker but is never banded', () => {
    const cell = findCell(standard, '2026-07-10');
    expect(cell?.marker).toBe('spotting');
    expect(cell?.periodBand).toBeNull();
    expect(cell?.predictedBand).toBeNull();
  });

  it('standard: fertile band spans Jul 5-10 and the selected date sits on a fertile day', () => {
    expect(findCell(standard, '2026-07-05')?.fertileBand).toBe('start');
    expect(findCell(standard, '2026-07-10')?.fertileBand).toBe('end');
    const selected = findCell(standard, standard.selectedDate);
    expect(selected?.isFertile).toBe(true);
    expect(selected?.marker).toBe('none');
  });

  it('standard: predicted run Jul 24-28 crosses the Sat/Sun row boundary near month end', () => {
    expect(findCell(standard, '2026-07-24')?.predictedBand).toBe('start');
    expect(findCell(standard, '2026-07-25')?.predictedBand).toBe('end');
    expect(findCell(standard, '2026-07-26')?.predictedBand).toBe('start');
    expect(findCell(standard, '2026-07-27')?.predictedBand).toBe('mid');
    expect(findCell(standard, '2026-07-28')?.predictedBand).toBe('end');
  });

  it('standard: today (Jul 22) carries no band of any kind', () => {
    const today = findCell(standard, standard.todayIso);
    expect(today?.isToday).toBe(true);
    expect(today?.periodBand).toBeNull();
    expect(today?.predictedBand).toBeNull();
    expect(today?.fertileBand).toBeNull();
  });

  it('overlap: fertile band overlaps the predicted band on Jul 12-14', () => {
    for (const date of ['2026-07-12', '2026-07-13', '2026-07-14']) {
      const cell = findCell(overlap, date);
      expect(cell?.predictedBand).not.toBeNull();
      expect(cell?.fertileBand).not.toBeNull();
    }
    // The selected date sits inside the overlap.
    const selected = findCell(overlap, overlap.selectedDate);
    expect(selected?.predictedBand).not.toBeNull();
    expect(selected?.fertileBand).not.toBeNull();
  });

  it('todayInBand: today sits inside the logged period band', () => {
    const today = findCell(todayInBand, todayInBand.todayIso);
    expect(today?.isToday).toBe(true);
    expect(today?.marker).toBe('period');
    expect(today?.periodBand).toBe('mid');
  });

  it('stale: predicted and fertile bands are fully suppressed', () => {
    const cells = stale.weeks.flat();
    expect(cells.filter((cell) => cell.predictedBand !== null)).toHaveLength(0);
    expect(cells.filter((cell) => cell.fertileBand !== null)).toHaveLength(0);
    expect(cells.filter((cell) => cell.marker === 'predicted-period')).toHaveLength(0);
    expect(cells.filter((cell) => cell.isFertile)).toHaveLength(0);
    // The lone spotting log still renders honestly.
    expect(findCell(stale, '2026-07-10')?.marker).toBe('spotting');
  });
});
