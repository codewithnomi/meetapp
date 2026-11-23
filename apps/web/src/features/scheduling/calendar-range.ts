// Which days the calendar shows (F13 design.md "Screens", AC-F13-01): Day, Work week (Mon–Fri, the
// default), Week (from the region's first day) or Month (the weeks that hold the month, up to 6). ‹ and › move by one view;
// the chosen view is remembered on this computer.

export const CALENDAR_VIEWS = ["day", "workweek", "week", "month"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

const VIEW_KEY = "meetapp:calendar-view";

/** Midnight of the same local day. */
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** The first day of that week: `first` is 0 for Sunday, 1 for Monday (the default) … 6 for Saturday. */
const weekStart = (d: Date, first = 1) => addDays(startOfDay(d), -((d.getDay() - first + 7) % 7));

/** The region's first day of the week (AC-F13-25): Sunday in the US and Japan, Monday in Germany. */
export function firstDayOf(locale: string): number {
  try {
    const info = (new Intl.Locale(locale) as { getWeekInfo?: () => { firstDay: number } }).getWeekInfo?.();
    return info ? info.firstDay % 7 : 1;
  } catch {
    return 1;
  }
}

export interface CalendarRange {
  from: Date;
  /** Exclusive. */
  to: Date;
  days: Date[];
}

function daysBetween(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) days.push(d);
  return days;
}

/** The days a view shows; Week and Month start on `firstDay`, the Work week is always Monday to Friday. */
export function rangeOf(view: CalendarView, anchor: Date, firstDay = 1): CalendarRange {
  if (view === "day") {
    const from = startOfDay(anchor);
    return { from, to: addDays(from, 1), days: [from] };
  }
  if (view === "month") {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const from = weekStart(first, firstDay);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const to = addDays(weekStart(last, firstDay), 7);
    return { from, to, days: daysBetween(from, to) };
  }
  const from = weekStart(anchor, view === "workweek" ? 1 : firstDay);
  const to = addDays(from, view === "workweek" ? 5 : 7);
  return { from, to, days: daysBetween(from, to) };
}

/** The anchor one view earlier (-1) or later (+1). */
export function step(view: CalendarView, anchor: Date, by: -1 | 1): Date {
  if (view === "day") return addDays(anchor, by);
  if (view === "month") return new Date(anchor.getFullYear(), anchor.getMonth() + by, 1);
  return addDays(anchor, 7 * by);
}

export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function savedView(): CalendarView {
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    return CALENDAR_VIEWS.find((v) => v === saved) ?? "workweek";
  } catch {
    return "workweek";
  }
}

export function saveView(view: CalendarView): void {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Storage blocked: the view just isn't remembered.
  }
}
