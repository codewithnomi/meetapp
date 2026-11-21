// Meeting reminders (F13 design.md "Jobs"; AC-F13-21, 22). Every minute the job looks back a few minutes
// (so a restart misses nothing) and sends each due reminder once per person on the live line, which reaches
// every open window and device; a Redis key per reminder keeps it from going twice. Dismiss and Snooze are
// saved per person and closed everywhere. The app reports its time zone when it asks what's due, so an
// all-day meeting reminds at 09:00 where the person is.
import { SNOOZE_MINUTES, type LineServerMessage, type Reminder } from "@meetapp/contracts";
import { AppError } from "../../plugins/errors.ts";
import { expand, type Series } from "./scheduling.recurrence.ts";
import { dueBetween, showingNow, type DueReminder, type ReminderKind, type ReminderState } from "./reminders.ts";
import type { DismissalRow, ReminderCandidate, RemindersRepository } from "./reminders.repository.ts";
import type { SchedulingService } from "./scheduling.service.ts";
import type { Membership } from "../workspaces/workspaces.permissions.ts";

interface Caller {
  id: string;
  name: string;
}

/** Small Redis helpers (wired from ioredis). */
export interface ReminderStore {
  /** True the first time a key is set within `seconds`. */
  once: (key: string, seconds: number) => Promise<boolean>;
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string, seconds: number) => Promise<void>;
}

export interface RemindersDeps {
  reminders: RemindersRepository;
  scheduling: SchedulingService;
  store: ReminderStore;
  live: { toPerson: (userId: string, message: LineServerMessage) => Promise<void> };
  now?: () => Date;
}

const LOOK_BACK_MS = 3 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const SENT_KEPT_SECONDS = 2 * 24 * 60 * 60;
const ZONE_KEPT_SECONDS = 30 * 24 * 60 * 60;
const zoneKey = (userId: string) => `meetapp:scheduling:zone:${userId}`;

const seriesOf = (row: ReminderCandidate["schedule"]): Series => row;
const key = (...parts: (string | number)[]) => parts.join("|");

function stateFor(
  person: { userId: string; answer: string | null },
  meetingId: string,
  originalStart: Date,
  lookups: { answers: Map<string, string>; dismissals: DismissalRow[] },
): ReminderState {
  const own = lookups.answers.get(key(meetingId, person.userId, originalStart.getTime()));
  const dismissals = new Map<ReminderKind, Date | null>(
    lookups.dismissals
      .filter(
        (d) =>
          d.userId === person.userId &&
          d.meetingId === meetingId &&
          d.originalStart.getTime() === originalStart.getTime(),
      )
      .map((d) => [d.kind, d.snoozedUntil]),
  );
  return { declined: (own ?? person.answer) === "declined", dismissals };
}

function reminderOf(
  due: DueReminder,
  candidate: ReminderCandidate,
  occurrence: { startsAt: Date; endsAt: Date },
): Reminder {
  return {
    meetingId: due.meetingId,
    originalStart: due.originalStart.toISOString(),
    kind: due.kind,
    title: candidate.title,
    startsAt: occurrence.startsAt.toISOString(),
    endsAt: occurrence.endsAt.toISOString(),
    allDay: candidate.schedule.allDay,
  };
}

interface Pending {
  candidate: ReminderCandidate;
  occurrence: { originalStart: Date; startsAt: Date; endsAt: Date };
  person: { userId: string; answer: string | null };
}

/** Every (meeting occurrence, person) pair that may be reminded around now. */
function pendingOf(candidates: ReminderCandidate[], range: { from: Date; to: Date; now: Date }): Pending[] {
  return candidates.flatMap((candidate) =>
    expand(seriesOf(candidate.schedule), range).occurrences.flatMap((occurrence) =>
      candidate.people.map((person) => ({ candidate, occurrence, person })),
    ),
  );
}

/** One run of the job: every reminder that became due in the last few minutes, sent once. */
async function run(deps: Required<RemindersDeps>) {
  const now = deps.now();
  const from = new Date(now.getTime() - LOOK_BACK_MS);
  const range = { from: new Date(from.getTime() - DAY_MS), to: new Date(now.getTime() + DAY_MS), now };
  const candidates = await deps.reminders.candidates(range);
  const ids = candidates.map((c) => c.schedule.meetingId);
  const lookups = {
    answers: await deps.reminders.occurrenceAnswers(ids),
    dismissals: await deps.reminders.dismissals(ids),
  };
  let sent = 0;
  for (const { candidate, occurrence, person } of pendingOf(candidates, range)) {
    const { meetingId, allDay, timeZone } = candidate.schedule;
    const zone = (await deps.store.get(zoneKey(person.userId))) ?? timeZone;
    const state = stateFor(person, meetingId, occurrence.originalStart, lookups);
    const due = dueBetween({ ...occurrence, meetingId, allDay, timeZone }, state, { from, to: now, personZone: zone });
    for (const reminder of due) {
      const id = key(person.userId, meetingId, reminder.originalStart.getTime(), reminder.kind, reminder.at.getTime());
      if (!(await deps.store.once(`meetapp:scheduling:reminded:${id}`, SENT_KEPT_SECONDS))) continue;
      await deps.live.toPerson(person.userId, { t: "reminder", ...reminderOf(reminder, candidate, occurrence) });
      sent++;
    }
  }
  return { sent };
}

/** What should be showing for this person now, in this workspace (on start and reconnect, AC-F13-22). */
async function dueFor(deps: Required<RemindersDeps>, caller: Caller, membership: Membership, timeZone: string) {
  const now = deps.now();
  await deps.store.put(zoneKey(caller.id), timeZone, ZONE_KEPT_SECONDS).catch(() => undefined);
  const calendar = await deps.scheduling.calendar(caller, membership, {
    from: new Date(now.getTime() - DAY_MS),
    to: new Date(now.getTime() + DAY_MS),
  });
  const dismissals = await deps.reminders.dismissals(
    [...new Set(calendar.occurrences.map((o) => o.meetingId))],
    caller.id,
  );
  const reminders: Reminder[] = [];
  for (const o of calendar.occurrences) {
    const occurrence = {
      meetingId: o.meetingId,
      originalStart: new Date(o.originalStart),
      startsAt: new Date(o.startsAt),
      endsAt: new Date(o.endsAt),
      allDay: o.allDay,
      timeZone,
    };
    const state = stateFor({ userId: caller.id, answer: o.myAnswer }, o.meetingId, occurrence.originalStart, {
      answers: new Map(),
      dismissals,
    });
    for (const due of showingNow(occurrence, state, now, timeZone)) {
      reminders.push({
        meetingId: o.meetingId,
        originalStart: o.originalStart,
        kind: due.kind,
        title: o.title,
        startsAt: o.startsAt,
        endsAt: o.endsAt,
        allDay: o.allDay,
      });
    }
  }
  return { reminders };
}

interface DismissBody {
  meetingId: string;
  originalStart: string;
  kind: ReminderKind;
  snooze: boolean;
}

async function dismiss(deps: Required<RemindersDeps>, caller: Caller, body: DismissBody) {
  const { row } = await deps.scheduling.access(caller, body.meetingId, "see").catch(() => {
    throw new AppError(404, "NOT_FOUND", "Not found.");
  });
  const snoozedUntil = body.snooze ? new Date(deps.now().getTime() + SNOOZE_MINUTES * 60 * 1000) : null;
  const fields = { meetingId: body.meetingId, originalStart: body.originalStart, kind: body.kind };
  await deps.reminders.dismiss({
    ...fields,
    originalStart: new Date(body.originalStart),
    userId: caller.id,
    workspaceId: row.meeting.workspaceId,
    snoozedUntil,
  });
  await deps.live.toPerson(caller.id, { t: "reminder-dismissed", ...fields });
  return { snoozedUntil: snoozedUntil?.toISOString() ?? null };
}

export function createRemindersService(deps: RemindersDeps) {
  const full = { now: () => new Date(), ...deps };
  return {
    run: () => run(full),
    due: (caller: Caller, membership: Membership, timeZone: string) => dueFor(full, caller, membership, timeZone),
    dismiss: (caller: Caller, body: DismissBody) => dismiss(full, caller, body),
  };
}

export type RemindersService = ReturnType<typeof createRemindersService>;
