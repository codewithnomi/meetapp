// What the New meeting / Edit meeting form holds, and how it becomes the request (F13 AC-F13-07, 10, 11).
// Dates and times are typed in the organizer's own zone (this computer's); all day spans whole days.
import type { RepeatKind, ScheduleBody, ScheduleDetails } from "@meetapp/contracts";
import { defaultTimes } from "./schedule-validation.ts";

export type Weekday = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";

export type FormInvitee = { userId: string; name: string } | { email: string };

export interface FormValues {
  title: string;
  invitees: FormInvitee[];
  start: { date: string; time: string };
  end: { date: string; time: string };
  allDay: boolean;
  repeat: { kind: RepeatKind; days: Weekday[]; until: string };
  description: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const dateOf = (d: Date) => `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeOf = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const WEEKDAYS: Weekday[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** A local date and time as a moment. */
const local = (date: string, time: string) => new Date(`${date}T${time || "00:00"}:00`);

export function blankForm(range: { startsAt: Date; endsAt: Date } | undefined, now: Date): FormValues {
  const { startsAt, endsAt } = range ?? defaultTimes(now);
  return {
    title: "",
    invitees: [],
    start: { date: dateOf(startsAt), time: timeOf(startsAt) },
    end: { date: dateOf(endsAt), time: timeOf(endsAt) },
    allDay: false,
    repeat: { kind: "none", days: [WEEKDAYS[startsAt.getDay()] ?? "MO"], until: "" },
    description: "",
  };
}

export function toBody(values: FormValues, timeZone: string): ScheduleBody {
  const startsAt = values.allDay ? local(values.start.date, "00:00") : local(values.start.date, values.start.time);
  const endsAt = values.allDay
    ? new Date(local(values.end.date, "00:00").getTime() + 24 * 60 * 60 * 1000)
    : local(values.end.date, values.end.time);
  const { kind, days, until } = values.repeat;
  return {
    title: values.title.trim(),
    invitees: values.invitees.map((i) => ("userId" in i ? { userId: i.userId } : { email: i.email })),
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    allDay: values.allDay,
    timeZone,
    repeat: {
      kind,
      ...(kind === "weekly" ? { days } : {}),
      ...(kind !== "none" && until ? { until: local(until, "23:59").toISOString() } : {}),
    },
    description: values.description,
  };
}

/** The form filled from a meeting, at the occurrence being edited (or the series' first). */
export function fromDetails(d: ScheduleDetails, at?: { startsAt: string; endsAt: string }): FormValues {
  const startsAt = new Date(at?.startsAt ?? d.startsAt);
  const endsAt = new Date(at?.endsAt ?? d.endsAt);
  const lastDay = d.allDay ? new Date(endsAt.getTime() - 1) : endsAt;
  return {
    title: d.title,
    invitees: d.invitees.flatMap((i): FormInvitee[] => {
      if (i.member) return [{ userId: i.member.id, name: i.member.name }];
      return i.email ? [{ email: i.email }] : [];
    }),
    start: { date: dateOf(startsAt), time: timeOf(startsAt) },
    end: { date: dateOf(lastDay), time: timeOf(endsAt) },
    allDay: d.allDay,
    repeat: {
      kind: d.repeat.kind,
      days: (d.repeat.days as Weekday[] | undefined) ?? [WEEKDAYS[startsAt.getDay()] ?? "MO"],
      until: d.repeat.until ? dateOf(new Date(d.repeat.until)) : "",
    },
    description: d.description,
  };
}

/** Whether a change moves the series in time (answers reset, AC-F13-19). */
export const movesTime = (before: FormValues, after: FormValues) =>
  JSON.stringify([before.start, before.end, before.allDay, before.repeat]) !==
  JSON.stringify([after.start, after.end, after.allDay, after.repeat]);
