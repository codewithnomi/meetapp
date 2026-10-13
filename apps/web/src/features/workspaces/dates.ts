// Dates in the app's language: "2 Oct 2026" for join dates, "2 hours ago" and "in 5 days" for requests
// and invitations (Intl, so other languages come for free).
const MINUTE = 60_000;
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 24 * 60 * MINUTE],
  ["hour", 60 * MINUTE],
  ["minute", MINUTE],
];

export function formatDate(iso: string, language: string): string {
  return new Intl.DateTimeFormat(language, { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

/** "2 hours ago", "yesterday", "in 5 days"; under a minute counts as "now". */
export function relativeTime(iso: string, language: string, now = Date.now()): string {
  const format = new Intl.RelativeTimeFormat(language, { numeric: "auto" });
  const diff = new Date(iso).getTime() - now;
  for (const [unit, size] of STEPS) {
    if (Math.abs(diff) >= size) return format.format(Math.round(diff / size), unit);
  }
  return format.format(0, "second");
}
