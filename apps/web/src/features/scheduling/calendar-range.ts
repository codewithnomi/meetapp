// Which days the calendar shows (F13 design.md "Screens", AC-F13-01): Day, Work week (Mon–Fri, the
// default), Week (Mon–Sun) or Month (the weeks that hold the month, up to 6). ‹ and › move by one view;
// the chosen view is remembered on this computer.

export const CALENDAR_VIEWS = ["day", "workweek", "week", "month"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

const VIEW_KEY = "meetapp:calendar-view";

/** Midnight of the same local day. */
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Monday of that week. */
const monday = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));

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

export function rangeOf(view: CalendarView, anchor: Date): CalendarRange {
  if (view === "day") {
    const from = startOfDay(anchor);
    return { from, to: addDays(from, 1), days: [from] };
  }
  if (view === "month") {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const from = monday(first);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const to = addDays(monday(last), 7);
    return { from, to, days: daysBetween(from, to) };
  }
  const from = monday(anchor);
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
