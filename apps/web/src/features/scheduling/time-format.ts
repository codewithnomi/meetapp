// Times and dates for the calendar (F13 AC-F13-02, 25): always in the computer's time zone, language and
// region, and its 12- or 24-hour setting (`hour12` left out = the region's usual way).

export interface TimeFormat {
  locale: string;
  timeZone: string;
  hour12?: boolean | undefined;
}

const hourOptions = (f: TimeFormat) => (f.hour12 === undefined ? {} : { hour12: f.hour12 });

/** "10:00" or "10:00 AM". */
export function formatTime(at: Date, f: TimeFormat): string {
  return new Intl.DateTimeFormat(f.locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: f.timeZone,
    ...hourOptions(f),
  }).format(at);
}

/** "10:00 – 10:30" (the region's range style). */
export function formatRange(start: Date, end: Date, f: TimeFormat): string {
  return new Intl.DateTimeFormat(f.locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: f.timeZone,
    ...hourOptions(f),
  }).formatRange(start, end);
}

/** The 24 labels of the hour column: "08:00" or "8 AM". */
export function hourLabels(f: TimeFormat): string[] {
  const format = new Intl.DateTimeFormat(f.locale, { hour: "numeric", timeZone: "UTC", ...hourOptions(f) });
  return Array.from({ length: 24 }, (_, h) => format.format(Date.UTC(2026, 0, 5, h)));
}

/** A day's short and full names: "Wed 25", "Wednesday, 25 November". */
export function dayLabels(day: Date, f: TimeFormat): { short: string; full: string } {
  const at = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(f.locale, { timeZone: f.timeZone, ...options }).format(day);
  return {
    short: at({ weekday: "short", day: "numeric" }),
    full: at({ weekday: "long", day: "numeric", month: "long" }),
  };
}

/** Minutes since midnight of `at` in the zone, e.g. for the now-line. */
export function minuteOfDay(at: Date, f: Pick<TimeFormat, "timeZone">): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: f.timeZone,
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}
