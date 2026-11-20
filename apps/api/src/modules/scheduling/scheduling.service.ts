// Scheduling meetings and reading the calendar (F13 design.md "Backend endpoints"; AC-F13-01, 03, 09–14,
// 26, 27). A scheduled meeting is an F02 meeting (kind `scheduled`, D095) with a schedule and invitees,
// saved in one transaction after the limits are checked. Rights come from scheduling.permissions.ts.
import { SCHEDULE_LIMITS, type CalendarOccurrence, type ScheduleBody, type ScheduleDetails } from "@meetapp/contracts";
import { AppError, fieldError } from "../../plugins/errors.ts";
import { RATE_RULES, type RateLimiter } from "../../plugins/rate-limit.ts";
import { scheduledExpiry } from "../meetings/expiry.ts";
import {
  MEETING_KEY_VERSION,
  newLinkPart,
  newMeetingNumber,
  newPasscode,
  type MeetingSecretBox,
} from "../meetings/meeting-secrets.ts";
import type { MeetingsRepository } from "../meetings/meetings.repository.ts";
import type { Membership } from "../workspaces/workspaces.permissions.ts";
import { decide, type ScheduleAction } from "./scheduling.permissions.ts";
import { expand, lastEnd, ruleFor, type Series } from "./scheduling.recurrence.ts";
import type {
  CalendarRange,
  CalendarRow,
  NewInvitee,
  OccurrenceChangeRow,
  SchedulingRepository,
} from "./scheduling.repository.ts";

export interface SchedulingDeps {
  scheduling: SchedulingRepository;
  meetings: MeetingsRepository;
  secrets: MeetingSecretBox;
  limiter: RateLimiter;
  now?: () => Date;
}

interface Caller {
  id: string;
  name: string;
}

/** Join shows from 5 minutes before the start until the end (AC-F13-03). */
const JOIN_EARLY_MS = 5 * 60 * 1000;
const notFound = () => new AppError(404, "NOT_FOUND", "Not found.");
const forbidden = () => new AppError(403, "FORBIDDEN", "Only the organizer and co-organizers can change this meeting.");

const seriesOf = (row: {
  startsAt: Date;
  endsAt: Date;
  timeZone: string;
  rrule: string | null;
  repeatUntil: Date | null;
}): Series => row;

/** Members must be in the meeting's workspace; outside people come by email (sealed, looked up by hash). */
async function inviteesFor(deps: SchedulingDeps, workspaceId: string, body: ScheduleBody): Promise<NewInvitee[]> {
  const userIds = [...new Set(body.invitees.flatMap((i) => ("userId" in i ? [i.userId] : [])))];
  const members = await deps.meetings.membersAmong(workspaceId, userIds);
  if (members.length !== userIds.length) throw fieldError("invitees", "not_a_member");
  const emails = [...new Set(body.invitees.flatMap((i) => ("email" in i ? [i.email.trim().toLowerCase()] : [])))];
  return [
    ...userIds.map((userId) => ({ userId })),
    ...emails.map((email) => ({
      emailEnc: deps.secrets.seal(email),
      emailLookup: deps.secrets.emailLookup(email),
      keyVersion: MEETING_KEY_VERSION,
    })),
  ];
}

async function create(deps: Required<SchedulingDeps>, caller: Caller, membership: Membership, body: ScheduleBody) {
  const now = deps.now();
  const startsAt = new Date(body.startsAt);
  if (startsAt.getTime() < now.getTime() - SCHEDULE_LIMITS.pastGraceMs) throw fieldError("startsAt", "in_past");
  const invitees = await inviteesFor(deps, membership.workspaceId, body);
  const wait = await deps.limiter.take(RATE_RULES.meetingCreates, caller.id);
  if (wait !== undefined)
    throw new AppError(429, "TOO_MANY_ATTEMPTS", "You've made many meetings. Try again later.", wait);
  const schedule = {
    startsAt,
    endsAt: new Date(body.endsAt),
    timeZone: body.timeZone,
    allDay: body.allDay,
    rrule: ruleFor(body.repeat, startsAt, body.timeZone),
    repeatUntil: body.repeat.kind !== "none" && body.repeat.until ? new Date(body.repeat.until) : null,
    description: body.description,
  };
  const linkPart = newLinkPart();
  const passcode = newPasscode();
  const meetingId = await deps.scheduling.create(
    () => {
      const meetingNumber = newMeetingNumber();
      return {
        workspaceId: membership.workspaceId,
        organizerId: caller.id,
        kind: "scheduled" as const,
        title: body.title,
        meetingNumber,
        linkLookup: deps.secrets.linkLookup(linkPart),
        linkSecretEnc: deps.secrets.seal(linkPart),
        passcodeCheck: deps.secrets.passcodeCheck(meetingNumber, passcode),
        passcodeEnc: deps.secrets.seal(passcode),
        keyVersion: MEETING_KEY_VERSION,
        expiresAt: scheduledExpiry(lastEnd(seriesOf(schedule))),
      };
    },
    schedule,
    invitees,
  );
  return { meetingId };
}

function occurrencesOf(row: CalendarRow, changes: OccurrenceChangeRow[], range: CalendarRange) {
  const mine = changes.filter((change) => change.meetingId === row.schedule.meetingId);
  const titles = new Map(mine.map((change) => [change.originalStart.getTime(), change.title]));
  const { occurrences, truncated } = expand(seriesOf(row.schedule), range, mine);
  const now = range.now.getTime();
  return {
    truncated,
    list: occurrences.map((o): CalendarOccurrence => ({
      meetingId: row.schedule.meetingId,
      originalStart: o.originalStart.toISOString(),
      startsAt: o.startsAt.toISOString(),
      endsAt: o.endsAt.toISOString(),
      allDay: row.schedule.allDay,
      title: titles.get(o.originalStart.getTime()) ?? row.title,
      organizer: { id: row.organizerId, name: row.organizerName },
      repeats: row.schedule.rrule !== null,
      myAnswer: row.myAnswer,
      canJoin: o.startsAt.getTime() - JOIN_EARLY_MS <= now && now < o.endsAt.getTime(),
    })),
  };
}

async function calendar(
  deps: Required<SchedulingDeps>,
  caller: Caller,
  membership: Membership,
  asked: { from: Date; to: Date },
) {
  const range = { ...asked, now: deps.now() };
  const rows = await deps.scheduling.calendar(caller.id, membership.workspaceId, range);
  const changes = await deps.scheduling.changesFor(rows.map((row) => row.schedule.meetingId));
  const parts = rows.map((row) => occurrencesOf(row, changes, range));
  const occurrences = parts.flatMap((part) => part.list).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const truncated = parts.some((part) => part.truncated) || occurrences.length > 500;
  return { occurrences: occurrences.slice(0, 500), truncated };
}

/** The meeting and the caller's rights over it; anyone who may not see it gets 404. */
async function access(deps: Required<SchedulingDeps>, caller: Caller, meetingId: string, action: ScheduleAction) {
  const row = await deps.meetings.find(meetingId);
  const schedule = row?.meeting.kind === "scheduled" ? await deps.scheduling.schedule(meetingId) : undefined;
  if (!row?.organizerIsMember || !schedule) throw notFound();
  const invitees = await deps.scheduling.invitees(meetingId);
  const me = invitees.find((invitee) => invitee.userId === caller.id);
  const facts = {
    inWorkspace: await deps.scheduling.isMember(row.meeting.workspaceId, caller.id),
    organizer: row.meeting.organizerId === caller.id,
    coOrganizer: row.coOrganizerIds.includes(caller.id),
    invitedMember: me !== undefined,
  };
  const decision = decide(action, facts);
  if (decision === "notFound") throw notFound();
  if (decision === "forbidden") throw forbidden();
  return { row, schedule, invitees, me, canManage: decide("edit", facts) === "allow" };
}

function repeatOf(rrule: string | null, until: Date | null): ScheduleDetails["repeat"] {
  const end = until ? { until: until.toISOString() } : {};
  if (!rrule) return { kind: "none" };
  if (rrule.startsWith("FREQ=DAILY")) return { kind: "daily", ...end };
  if (rrule.startsWith("FREQ=MONTHLY")) return { kind: "monthly", ...end };
  if (rrule.startsWith("FREQ=YEARLY")) return { kind: "yearly", ...end };
  if (rrule === "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR") return { kind: "weekdays", ...end };
  const days = (rrule.split("BYDAY=")[1] ?? "").split(",").filter(Boolean) as NonNullable<
    ScheduleDetails["repeat"]["days"]
  >;
  return { kind: "weekly", days, ...end };
}

async function details(deps: Required<SchedulingDeps>, caller: Caller, meetingId: string): Promise<ScheduleDetails> {
  const { row, schedule, invitees, me, canManage } = await access(deps, caller, meetingId, "see");
  const seeEmails = canManage;
  const listed = invitees.filter((invitee) => invitee.userId !== null || seeEmails);
  return {
    meetingId,
    title: row.meeting.title,
    description: schedule.description,
    startsAt: schedule.startsAt.toISOString(),
    endsAt: schedule.endsAt.toISOString(),
    allDay: schedule.allDay,
    timeZone: schedule.timeZone,
    repeat: repeatOf(schedule.rrule, schedule.repeatUntil),
    organizer: { id: row.meeting.organizerId, name: row.organizerName },
    link: deps.secrets.linkOf(deps.secrets.open(row.meeting.linkSecretEnc, row.meeting.keyVersion)),
    meetingNumber: row.meeting.meetingNumber,
    passcode: deps.secrets.open(row.meeting.passcodeEnc, row.meeting.keyVersion),
    invitees: listed.map((invitee) => ({
      id: invitee.id,
      member: invitee.userId ? { id: invitee.userId, name: invitee.name ?? "" } : null,
      email:
        invitee.emailEnc && invitee.keyVersion !== null
          ? deps.secrets.open(invitee.emailEnc, invitee.keyVersion)
          : null,
      answer: invitee.answer,
    })),
    hiddenExternal: invitees.length - listed.length,
    myAnswer: me?.answer ?? null,
    canManage,
    cancelled: schedule.cancelledAt !== null,
  };
}

export function createSchedulingService(deps: SchedulingDeps) {
  const full = { now: () => new Date(), ...deps };
  return {
    create: (caller: Caller, membership: Membership, body: ScheduleBody) => create(full, caller, membership, body),
    calendar: (caller: Caller, membership: Membership, asked: { from: Date; to: Date }) =>
      calendar(full, caller, membership, asked),
    details: (caller: Caller, meetingId: string) => details(full, caller, meetingId),
    /** Shared with the change, cancel and answer steps (T6). */
    access: (caller: Caller, meetingId: string, action: ScheduleAction) => access(full, caller, meetingId, action),
  };
}

export type SchedulingService = ReturnType<typeof createSchedulingService>;
