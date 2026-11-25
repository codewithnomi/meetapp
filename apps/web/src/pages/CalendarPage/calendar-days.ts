// Turns the calendar's meetings into the grid's days (F13 AC-F13-01, 06): each meeting goes into every
// day it touches, cut to that day; all-day ones go to the strip on top. Blocks show the person's answer.
import type { TFunction } from "i18next";
import type { GridDay, GridMeeting, MeetingBlockState } from "@meetapp/ui";
import {
  dayLabels,
  formatRange,
  sameDay,
  type CalendarOccurrence,
  type TimeFormat,
} from "../../features/scheduling/index.ts";

const DAY_MIN = 24 * 60;

function blockState(o: CalendarOccurrence, me: string | undefined): MeetingBlockState {
  if (o.myAnswer === null || o.organizer.id === me) return "accepted";
  return o.myAnswer;
}

function blockOf(o: CalendarOccurrence, ctx: DaysContext): Omit<GridMeeting, "start" | "end"> {
  const state = blockState(o, ctx.me);
  const answer = o.organizer.id === ctx.me ? ctx.t("calendar.states.organizer") : ctx.t(`calendar.states.${state}`);
  return {
    id: `${o.meetingId}|${o.originalStart}`,
    title: o.title,
    time: o.allDay ? ctx.t("calendar.allDay") : formatRange(new Date(o.startsAt), new Date(o.endsAt), ctx.format),
    state,
    stateLabel: `${o.organizer.name}, ${answer}`,
    repeats: o.repeats,
  };
}

export interface DaysContext {
  me: string | undefined;
  format: TimeFormat;
  today: Date;
  t: TFunction;
}

export function gridDays(days: Date[], occurrences: CalendarOccurrence[], ctx: DaysContext): GridDay[] {
  return days.map((day) => {
    const dayStart = day.getTime();
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
    const touching = occurrences.filter((o) => Date.parse(o.startsAt) < dayEnd && Date.parse(o.endsAt) > dayStart);
    const labels = dayLabels(day, ctx.format);
    return {
      key: day.toISOString(),
      label: labels.short,
      fullLabel: labels.full,
      today: sameDay(day, ctx.today),
      allDay: touching.filter((o) => o.allDay).map((o) => blockOf(o, ctx)),
      meetings: touching
        .filter((o) => !o.allDay)
        .map((o) => ({
          ...blockOf(o, ctx),
          start: Math.max(0, (Date.parse(o.startsAt) - dayStart) / 60_000),
          end: Math.min(DAY_MIN, (Date.parse(o.endsAt) - dayStart) / 60_000),
        })),
    };
  });
}
