// The time beside a chat in the list (F14 AC-F14-01, as in Teams): today the time, within the last week
// the weekday, before that the date (with the year when it isn't this year). Words and formats come from
// the language's own conventions (Intl), so every language gets its own.
const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export function timeLabel(at: Date, now: Date, locale: string): string {
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY_MS);
  if (days <= 0) return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(at);
  if (days < 7) return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(at);
  const year = at.getFullYear() === now.getFullYear() ? {} : { year: "numeric" as const };
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", ...year }).format(at);
}
