// Making meetings and changing their options (F02 design.md section 3.1; AC-F02-01–07, 36). The
// organizer and co-organizers manage a meeting; only the organizer names co-organizers, and only people
// in the meeting's workspace (none in a personal workspace). Anyone else gets the same 404 as for a
// meeting that doesn't exist (S1, S2).
import type { MeetingDetails } from "@meetapp/contracts";
import type { Meeting } from "@meetapp/db";
import { AppError } from "../../plugins/errors.ts";
import { RATE_RULES, type RateLimiter } from "../../plugins/rate-limit.ts";
import type { Membership } from "../workspaces/workspaces.permissions.ts";
import { extendedExpiry, firstExpiry, isExpired } from "./expiry.ts";
import type { LookupTokens } from "./lookup-token.ts";
import {
  MEETING_KEY_VERSION,
  newLinkPart,
  newMeetingNumber,
  newPasscode,
  type MeetingSecretBox,
} from "./meeting-secrets.ts";
import type { MeetingOptionsChange, MeetingRow, MeetingsRepository } from "./meetings.repository.ts";

export interface MeetingsServiceDeps {
  repository: MeetingsRepository;
  secrets: MeetingSecretBox;
  lookupTokens: LookupTokens;
  limiter: RateLimiter;
  now?: () => Date;
}

interface Caller {
  id: string;
  name: string;
}

export interface MeetingUpdate extends Omit<MeetingOptionsChange, "expiresAt"> {
  coOrganizerIds?: string[] | undefined;
}

const notFound = () => new AppError(404, "NOT_FOUND", "Not found.");
const forbidden = () => new AppError(403, "FORBIDDEN", "Only the organizer can name co-organizers.");
const badCoOrganizers = () =>
  new AppError(400, "BAD_REQUEST", "Co-organizers must be other people in the meeting's workspace.");

function detailsOf(row: MeetingRow, secrets: MeetingSecretBox): MeetingDetails {
  const { meeting } = row;
  return {
    id: meeting.id,
    workspaceId: meeting.workspaceId,
    kind: meeting.kind,
    title: meeting.title,
    link: secrets.linkOf(secrets.open(meeting.linkSecretEnc, meeting.keyVersion)),
    meetingNumber: meeting.meetingNumber,
    passcode: secrets.open(meeting.passcodeEnc, meeting.keyVersion),
    organizer: { id: meeting.organizerId, name: row.organizerName },
    options: {
      lobbyBypass: meeting.lobbyBypass,
      whoCanPresent: meeting.whoCanPresent,
      allowAttendeeMic: meeting.allowAttendeeMic,
      allowAttendeeCamera: meeting.allowAttendeeCamera,
      coOrganizerIds: row.coOrganizerIds,
    },
    expiresAt: meeting.expiresAt.toISOString(),
  };
}

/** A meeting still works: not expired and its organizer still in its workspace (AC-F02-04, 07). */
export const isUsable = (row: MeetingRow, now: Date) => row.organizerIsMember && !isExpired(row.meeting.expiresAt, now);

interface NewMeetingRequest {
  caller: Caller;
  membership: Membership;
  kind: Meeting["kind"];
  title: string | undefined;
}

async function createMeeting(deps: Required<MeetingsServiceDeps>, request: NewMeetingRequest) {
  const { repository, secrets, lookupTokens, limiter, now } = deps;
  const { caller, membership, kind, title } = request;
  const wait = await limiter.take(RATE_RULES.meetingCreates, caller.id);
  if (wait !== undefined) {
    throw new AppError(429, "TOO_MANY_ATTEMPTS", "You've made many meetings. Try again later.", wait);
  }
  const linkPart = newLinkPart();
  const passcode = newPasscode();
  const sealed = { linkSecretEnc: secrets.seal(linkPart), passcodeEnc: secrets.seal(passcode) };
  const meeting = await repository.insert(() => {
    const meetingNumber = newMeetingNumber();
    return {
      workspaceId: membership.workspaceId,
      organizerId: caller.id,
      kind,
      title: title ?? `Meeting with ${caller.name}`,
      meetingNumber,
      linkLookup: secrets.linkLookup(linkPart),
      passcodeCheck: secrets.passcodeCheck(meetingNumber, passcode),
      keyVersion: MEETING_KEY_VERSION,
      expiresAt: firstExpiry(now()),
      ...sealed,
    };
  });
  const row = await repository.find(meeting.id);
  if (!row) throw notFound();
  return { ...detailsOf(row, secrets), lookupToken: lookupTokens.issue(meeting.id) };
}

export function createMeetingsService({
  repository,
  secrets,
  lookupTokens,
  limiter,
  now = () => new Date(),
}: MeetingsServiceDeps) {
  /** The meeting, for its organizer or a co-organizer who is still in the workspace; else 404. */
  async function managed(caller: Caller, meetingId: string): Promise<MeetingRow & { isOrganizer: boolean }> {
    const row = await repository.find(meetingId);
    if (!row?.organizerIsMember) throw notFound();
    const isOrganizer = row.meeting.organizerId === caller.id;
    const isCoOrganizer =
      row.coOrganizerIds.includes(caller.id) &&
      (await repository.membersAmong(row.meeting.workspaceId, [caller.id])).length === 1;
    if (!isOrganizer && !isCoOrganizer) throw notFound();
    return { ...row, isOrganizer };
  }

  async function checkCoOrganizers(row: MeetingRow, userIds: string[]): Promise<string[]> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return unique;
    if (row.workspaceKind === "personal" || unique.includes(row.meeting.organizerId)) throw badCoOrganizers();
    const members = await repository.membersAmong(row.meeting.workspaceId, unique);
    if (members.length !== unique.length) throw badCoOrganizers();
    return unique;
  }

  return {
    create: (caller: Caller, membership: Membership, kind: Meeting["kind"], title?: string) =>
      createMeeting({ repository, secrets, lookupTokens, limiter, now }, { caller, membership, kind, title }),
    get: async (caller: Caller, meetingId: string): Promise<MeetingDetails> =>
      detailsOf(await managed(caller, meetingId), secrets),
    update: async (caller: Caller, meetingId: string, change: MeetingUpdate): Promise<MeetingDetails> => {
      const row = await managed(caller, meetingId);
      const { coOrganizerIds, ...options } = change;
      if (coOrganizerIds !== undefined) {
        if (!row.isOrganizer) throw forbidden();
        await repository.setCoOrganizers(meetingId, await checkCoOrganizers(row, coOrganizerIds));
      }
      const expiresAt = extendedExpiry(row.meeting.kind, row.meeting.expiresAt, now());
      await repository.update(meetingId, { ...options, expiresAt });
      return detailsOf(await managed(caller, meetingId), secrets);
    },
  };
}

export type MeetingsService = ReturnType<typeof createMeetingsService>;
