// Meeting emails (F13 design.md "Emails"; AC-F13-15, 18, 19, 27, 30, 31): invite, update and cancel,
// each with a calendar file. A queued job holds only the invitee's id; the address is opened, the text
// written and the calendar file built when the email goes out, so no address waits in Redis. After the
// last try the invitee row says whether it was sent, for "Some invites couldn't be sent" and Retry.
import { SCHEDULE_LIMITS } from "@meetapp/contracts";
import type { EmailMessage } from "../../providers/email.ts";
import type { Outbox } from "../../emails/outbox.ts";
import { renderEmail, type MeetingTemplate } from "../../emails/templates.ts";
import { AppError } from "../../plugins/errors.ts";
import { RATE_RULES, type RateLimiter } from "../../plugins/rate-limit.ts";
import type { MeetingSecretBox } from "../meetings/meeting-secrets.ts";
import { calendarFile } from "./scheduling.ics.ts";
import type { MailFacts, OccurrenceChangeRow, SchedulingRepository } from "./scheduling.repository.ts";

export type MeetingMail = MeetingTemplate["mail"];
const RESOLVER = "meeting";

export interface MeetingMailDeps {
  scheduling: SchedulingRepository;
  secrets: MeetingSecretBox;
  outbox: Outbox;
  limiter: RateLimiter;
  /** EMAIL_FROM; its address is the calendar file's organizer address (MeetApp's, never a person's). */
  emailFrom: string;
}

const senderAddress = (from: string) => /<([^>]+)>/.exec(from)?.[1] ?? from;

const DAY_NAMES: Record<string, string> = {
  MO: "Mon",
  TU: "Tue",
  WE: "Wed",
  TH: "Thu",
  FR: "Fri",
  SA: "Sat",
  SU: "Sun",
};

/** "Mon 4 Jan 2027, 09:00–09:30 (Europe/London)", or the day alone for an all-day meeting. */
export function whenText(startsAt: Date, endsAt: Date, timeZone: string, allDay: boolean): string {
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  if (allDay) return `${day.format(startsAt)} (all day)`;
  const time = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${day.format(startsAt)}, ${time.format(startsAt)}–${time.format(endsAt)} (${timeZone})`;
}

/** "Weekly on Mon, Wed until 31 Jan 2027"; empty when it doesn't repeat. */
export function repeatText(rrule: string | null, until: Date | null, timeZone: string): string {
  if (!rrule) return "";
  const days = (rrule.split("BYDAY=")[1] ?? "").split(";")[0]?.split(",").filter(Boolean) ?? [];
  const base = rrule.startsWith("FREQ=DAILY")
    ? "Daily"
    : rrule.startsWith("FREQ=MONTHLY")
      ? "Monthly"
      : rrule.startsWith("FREQ=YEARLY")
        ? "Yearly"
        : days.length === 5 && !days.includes("SA") && !days.includes("SU")
          ? "Every weekday"
          : `Weekly on ${days.map((d) => DAY_NAMES[d] ?? d).join(", ")}`;
  if (!until) return base;
  const end = new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short", year: "numeric" });
  return `${base} until ${end.format(until)}`;
}

interface FileFor {
  mail: MeetingMail;
  link: string;
  only: Date | undefined;
  to: string;
  changes: OccurrenceChangeRow[];
}

function fileOf(deps: MeetingMailDeps, facts: MailFacts, { mail, link, only, to, changes }: FileFor): string {
  const { meeting, schedule } = facts;
  return calendarFile({
    method: mail === "cancel" ? "CANCEL" : "REQUEST",
    uid: meeting.id,
    sequence: schedule.sequence,
    title: meeting.title,
    description: schedule.description,
    link,
    startsAt: schedule.startsAt,
    endsAt: schedule.endsAt,
    allDay: schedule.allDay,
    timeZone: schedule.timeZone,
    rrule: schedule.rrule,
    repeatUntil: schedule.repeatUntil,
    skipped: changes.filter((c) => c.cancelled).map((c) => c.originalStart),
    moved: changes.flatMap((c) =>
      !c.cancelled && c.startsAt && c.endsAt
        ? [{ originalStart: c.originalStart, startsAt: c.startsAt, endsAt: c.endsAt }]
        : [],
    ),
    only,
    organizerName: facts.organizerName,
    senderEmail: senderAddress(deps.emailFrom),
    recipient: to,
  });
}

interface Recipient {
  to: string;
  changes: OccurrenceChangeRow[];
}

function messageOf(
  deps: MeetingMailDeps,
  facts: MailFacts,
  data: Record<string, string>,
  { to, changes }: Recipient,
): EmailMessage {
  const { meeting, schedule } = facts;
  const mail = data.mail as MeetingMail;
  const only = data.originalStart ? new Date(data.originalStart) : undefined;
  const length = schedule.endsAt.getTime() - schedule.startsAt.getTime();
  const startsAt = only ?? schedule.startsAt;
  const link = deps.secrets.linkOf(deps.secrets.open(meeting.linkSecretEnc, meeting.keyVersion));
  const template: MeetingTemplate = {
    kind: "meeting",
    mail,
    title: meeting.title,
    organizer: facts.organizerName,
    when: whenText(startsAt, new Date(startsAt.getTime() + length), schedule.timeZone, schedule.allDay),
    repeat: only ? "" : repeatText(schedule.rrule, schedule.repeatUntil, schedule.timeZone),
    description: schedule.description,
    message: (data.message ?? "").slice(0, SCHEDULE_LIMITS.cancelMessage),
    link,
    meetingNumber: meeting.meetingNumber,
    passcode: deps.secrets.open(meeting.passcodeEnc, meeting.keyVersion),
  };
  const email = renderEmail(template);
  const calendar = fileOf(deps, facts, { mail, link, only, to, changes });
  return { to, ...email, calendar: { method: mail === "cancel" ? "CANCEL" : "REQUEST", content: calendar } };
}

/** The meeting and the address: an invitee's row, or (removed people) the meeting plus a member or sealed address. */
async function factsFor(deps: MeetingMailDeps, data: Record<string, string>) {
  const open = (sealed: string | null | undefined, version: number | null | undefined) =>
    sealed && version !== null && version !== undefined ? deps.secrets.open(sealed, version) : undefined;
  if (data.inviteeId) {
    const facts = await deps.scheduling.mailFacts(data.inviteeId);
    const to = facts?.memberEmail ?? open(facts?.invitee.emailEnc, facts?.invitee.keyVersion);
    return facts && to ? { facts, to } : undefined;
  }
  if (!data.meetingId) return undefined;
  const facts = await deps.scheduling.meetingMailFacts(data.meetingId, data.userId);
  const to = facts?.memberEmail ?? open(data.sealed, Number(data.keyVersion));
  return facts && to ? { facts, to } : undefined;
}

/** Someone just removed from a meeting: a member, or an outside address kept sealed (encrypted). */
export type RemovedRecipient = { userId: string } | { sealed: string; keyVersion: number };

export function createMeetingMail(deps: MeetingMailDeps) {
  deps.outbox.register(RESOLVER, {
    message: async (data) => {
      const found = await factsFor(deps, data);
      if (!found) return undefined;
      const changes = await deps.scheduling.changesFor([found.facts.meeting.id]);
      return messageOf(deps, found.facts, data, { to: found.to, changes });
    },
    settled: async (data, sent) => {
      if (data.inviteeId) await deps.scheduling.setEmailStatus(data.inviteeId, sent ? "sent" : "failed");
    },
  });
  return {
    /**
     * Reserves this many emails in the sender's hour (AC-F13-27), before anything is saved; refused with
     * the wait when that goes over. `release` gives them back if the save then fails.
     */
    reserve: async (senderId: string, count: number) => {
      const wait = await deps.limiter.reserve(RATE_RULES.meetingEmails, senderId, count);
      if (wait !== undefined) {
        throw new AppError(429, "TOO_MANY_EMAILS", "You've sent many meeting emails. Try again later.", wait);
      }
      return () => deps.limiter.release(RATE_RULES.meetingEmails, senderId, count);
    },
    send: async (inviteeIds: string[], mail: MeetingMail, extra: Record<string, string> = {}) => {
      for (const inviteeId of inviteeIds) {
        await deps.scheduling.setEmailStatus(inviteeId, "queued");
        await deps.outbox.enqueue({ resolver: RESOLVER, data: { inviteeId, mail, ...extra } });
      }
    },
    /** A cancellation to people removed by an update; their rows are gone, so the job names the meeting. */
    sendRemoved: async (meetingId: string, removed: RemovedRecipient[]) => {
      for (const person of removed) {
        const who =
          "userId" in person
            ? { userId: person.userId }
            : { sealed: person.sealed, keyVersion: String(person.keyVersion) };
        await deps.outbox.enqueue({ resolver: RESOLVER, data: { meetingId, mail: "cancel", ...who } });
      }
    },
  };
}

export type MeetingMailer = ReturnType<typeof createMeetingMail>;
