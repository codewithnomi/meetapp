// Answering, changing and cancelling scheduled meetings (F13 design.md "Backend endpoints"; AC-F13-16–20).
// Rights come from the shared access check (an invitee may only answer: 403 on the rest; anyone else 404).
// Emails are reserved before anything changes (AC-F13-27); everyone whose calendar changed hears it on
// the live line (D064) within seconds.
import { SCHEDULE_LIMITS, type LineServerMessage, type ScheduleUpdateBody } from "@meetapp/contracts";
import { fieldError } from "../../plugins/errors.ts";
import { scheduledExpiry } from "../meetings/expiry.ts";
import type { MeetingSecretBox } from "../meetings/meeting-secrets.ts";
import type { MeetingsRepository } from "../meetings/meetings.repository.ts";
import type { SchedulingChangesRepository } from "./scheduling-changes.repository.ts";
import type { MeetingMailer, RemovedRecipient } from "./scheduling.mail.ts";
import { lastEnd, ruleFor } from "./scheduling.recurrence.ts";
import type { InviteeRow, MeetingSchedule } from "./scheduling.repository.ts";
import type { SchedulingService } from "./scheduling.service.ts";
import { inviteesFor } from "./scheduling.service.ts";

export interface SchedulingChangesDeps {
  service: SchedulingService;
  changes: SchedulingChangesRepository;
  meetings: MeetingsRepository;
  secrets: MeetingSecretBox;
  mail: MeetingMailer;
  live: { toPerson: (userId: string, message: LineServerMessage) => Promise<void> };
  now?: () => Date;
}

interface Caller {
  id: string;
  name: string;
}

type Change = "added" | "changed" | "removed";

async function tell(deps: SchedulingChangesDeps, userIds: (string | null)[], meetingId: string, change: Change) {
  const people = [...new Set(userIds.filter((id): id is string => id !== null))];
  await Promise.all(people.map((id) => deps.live.toPerson(id, { t: "calendar", meetingId, change })));
}

/** Who is invited after the update, by member id or email hash; who was added and who removed. */
function diffInvitees(deps: SchedulingChangesDeps, current: InviteeRow[], wanted: ScheduleUpdateBody["invitees"]) {
  if (!wanted) return { kept: current, removed: [] as InviteeRow[], addedBody: [] as NonNullable<typeof wanted> };
  const keyOf = (row: InviteeRow) =>
    row.userId ?? (row.emailEnc && row.keyVersion !== null ? deps.secrets.open(row.emailEnc, row.keyVersion) : "");
  const wantedKeys = new Set(wanted.map((i) => ("userId" in i ? i.userId : i.email.trim().toLowerCase())));
  const currentKeys = new Set(current.map(keyOf));
  return {
    kept: current.filter((row) => wantedKeys.has(keyOf(row))),
    removed: current.filter((row) => !wantedKeys.has(keyOf(row))),
    addedBody: wanted.filter((i) => !currentKeys.has("userId" in i ? i.userId : i.email.trim().toLowerCase())),
  };
}

const removedRecipient = (row: InviteeRow): RemovedRecipient =>
  row.userId ? { userId: row.userId } : { sealed: row.emailEnc ?? "", keyVersion: row.keyVersion ?? 0 };

function seriesChange(schedule: MeetingSchedule, body: ScheduleUpdateBody) {
  const startsAt = body.startsAt ? new Date(body.startsAt) : schedule.startsAt;
  const endsAt = body.endsAt ? new Date(body.endsAt) : schedule.endsAt;
  const timeZone = body.timeZone ?? schedule.timeZone;
  const rrule = body.repeat ? ruleFor(body.repeat, startsAt, timeZone) : schedule.rrule;
  const repeatUntil = body.repeat ? (body.repeat.until ? new Date(body.repeat.until) : null) : schedule.repeatUntil;
  const timeMoved =
    startsAt.getTime() !== schedule.startsAt.getTime() ||
    endsAt.getTime() !== schedule.endsAt.getTime() ||
    rrule !== schedule.rrule;
  const expiresAt = scheduledExpiry(lastEnd({ startsAt, endsAt, timeZone, rrule, repeatUntil }));
  return {
    title: body.title,
    startsAt,
    endsAt,
    allDay: body.allDay,
    timeZone,
    rrule,
    repeatUntil,
    description: body.description,
    expiresAt,
    timeMoved,
  };
}

async function saveChange(
  deps: Required<SchedulingChangesDeps>,
  scope: { meetingId: string; workspaceId: string },
  schedule: MeetingSchedule,
  body: ScheduleUpdateBody,
) {
  if (body.scope === "occurrence" && body.originalStart) {
    const edit = {
      startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
      endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
      title: body.title,
      description: body.description,
    };
    await deps.changes.editOccurrence(scope, new Date(body.originalStart), edit);
    return;
  }
  await deps.changes.updateSeries(scope.meetingId, seriesChange(schedule, body));
}

interface Outcome {
  kept: InviteeRow[];
  removed: InviteeRow[];
  newRows: { id: string; userId: string | null }[];
  extra: Record<string, string>;
}

/** Emails and live news after an update: updated, newly invited, removed. */
async function announce(deps: Required<SchedulingChangesDeps>, meetingId: string, outcome: Outcome) {
  const { kept, removed, newRows, extra } = outcome;
  await deps.mail.send(
    kept.map((r) => r.id),
    "update",
    extra,
  );
  await deps.mail.send(
    newRows.map((r) => r.id),
    "invite",
  );
  await deps.mail.sendRemoved(meetingId, removed.map(removedRecipient));
  const managers = await deps.changes.managers(meetingId);
  await tell(deps, [...managers, ...kept.map((r) => r.userId)], meetingId, "changed");
  await tell(
    deps,
    newRows.map((r) => r.userId),
    meetingId,
    "added",
  );
  await tell(
    deps,
    removed.map((r) => r.userId),
    meetingId,
    "removed",
  );
}

async function update(
  deps: Required<SchedulingChangesDeps>,
  caller: Caller,
  meetingId: string,
  body: ScheduleUpdateBody,
) {
  const { row, schedule, invitees } = await deps.service.access(caller, meetingId, "edit");
  const now = deps.now();
  if (body.startsAt && Date.parse(body.startsAt) < now.getTime() - SCHEDULE_LIMITS.pastGraceMs) {
    throw fieldError("startsAt", "in_past");
  }
  if (body.scope === "occurrence" && body.invitees) throw fieldError("invitees", "series_only");
  const { kept, removed, addedBody } = diffInvitees(deps, invitees, body.invitees);
  const added = await inviteesFor(deps, row.meeting.workspaceId, { invitees: addedBody });
  const release = await deps.mail.reserve(caller.id, kept.length + added.length + removed.length);
  const scope = { meetingId, workspaceId: row.meeting.workspaceId };
  await saveChange(deps, scope, schedule, body).catch(async (error: unknown) => {
    await release();
    throw error;
  });
  const newRows = await deps.changes.addInvitees(scope, added);
  await deps.changes.removeInvitees(
    meetingId,
    removed.map((r) => r.id),
  );
  const extra = body.scope === "occurrence" && body.originalStart ? { originalStart: body.originalStart } : {};
  await announce(deps, meetingId, { kept, removed, newRows, extra });
  const title = body.title ?? row.meeting.title;
  for (const id of newRows.flatMap((r) => (r.userId ? [r.userId] : []))) {
    await deps.live.toPerson(id, { t: "invited", meetingId, title, organizerName: row.organizerName });
  }
  return deps.service.details(caller, meetingId);
}

interface CancelBody {
  scope: "occurrence" | "series";
  originalStart?: string | undefined;
  message?: string | undefined;
}

async function cancel(deps: Required<SchedulingChangesDeps>, caller: Caller, meetingId: string, body: CancelBody) {
  const { row, invitees } = await deps.service.access(caller, meetingId, "cancel");
  if (body.scope === "occurrence" && !body.originalStart) throw fieldError("originalStart", "occurrence_needed");
  const release = await deps.mail.reserve(caller.id, invitees.length);
  const scope = { meetingId, workspaceId: row.meeting.workspaceId };
  const one = body.scope === "occurrence" && body.originalStart ? new Date(body.originalStart) : undefined;
  await (one ? deps.changes.cancelOccurrence(scope, one) : deps.changes.cancelSeries(meetingId, deps.now())).catch(
    async (error: unknown) => {
      await release();
      throw error;
    },
  );
  const extra = {
    ...(one ? { originalStart: one.toISOString() } : {}),
    ...(body.message ? { message: body.message } : {}),
  };
  await deps.mail.send(
    invitees.map((r) => r.id),
    "cancel",
    extra,
  );
  const managers = await deps.changes.managers(meetingId);
  await tell(deps, [...managers, ...invitees.map((r) => r.userId)], meetingId, one ? "changed" : "removed");
  return { cancelled: true };
}

interface AnswerBody {
  answer: "accepted" | "tentative" | "declined";
  scope: "occurrence" | "series";
  originalStart?: string | undefined;
}

async function answer(deps: Required<SchedulingChangesDeps>, caller: Caller, meetingId: string, body: AnswerBody) {
  const { row, me } = await deps.service.access(caller, meetingId, "answer");
  if (!me) throw fieldError("answer", "not_invited");
  if (body.scope === "occurrence") {
    if (!body.originalStart) throw fieldError("originalStart", "occurrence_needed");
    const scope = { inviteeId: me.id, workspaceId: row.meeting.workspaceId };
    await deps.changes.answerOccurrence(scope, new Date(body.originalStart), body.answer);
  } else {
    await deps.changes.answerSeries(me.id, body.answer, deps.now());
  }
  await tell(deps, [...(await deps.changes.managers(meetingId)), caller.id], meetingId, "changed");
  return deps.service.details(caller, meetingId);
}

export function createSchedulingChangesService(deps: SchedulingChangesDeps) {
  const full = { now: () => new Date(), ...deps };
  return {
    update: (caller: Caller, meetingId: string, body: ScheduleUpdateBody) => update(full, caller, meetingId, body),
    cancel: (caller: Caller, meetingId: string, body: CancelBody) => cancel(full, caller, meetingId, body),
    answer: (caller: Caller, meetingId: string, body: AnswerBody) => answer(full, caller, meetingId, body),
  };
}

export type SchedulingChangesService = ReturnType<typeof createSchedulingChangesService>;
