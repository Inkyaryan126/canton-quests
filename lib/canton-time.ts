/** The player-facing calendar timezone for Canton Quests. */
export const CANTON_TIME_ZONE = 'America/New_York';

/** Return the calendar date in Canton as a stable YYYY-MM-DD key. */
export function getCantonCalendarDate(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CANTON_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
}
