const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcDateParts(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);

  return {
    year,
    month,
    day,
  };
}

export function isoDateToUtcMillis(isoDate: string) {
  const { year, month, day } = toUtcDateParts(isoDate);

  return Date.UTC(year, month - 1, day);
}

export function addDays(isoDate: string, days: number) {
  return new Date(isoDateToUtcMillis(isoDate) + days * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

export function diffDays(startIso: string, endIso: string) {
  return Math.round((isoDateToUtcMillis(endIso) - isoDateToUtcMillis(startIso)) / MS_PER_DAY);
}
