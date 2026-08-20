function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

export function formatLocalTimelineDate(date: Date) {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join('-');
}

export function normalizeTimelineDate(dateOrTimestamp: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOrTimestamp)) {
    return dateOrTimestamp;
  }

  return formatLocalTimelineDate(new Date(dateOrTimestamp));
}
