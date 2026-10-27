// What every call service shares (F02 design.md sections 3.5 and 3.6): the services it needs, each
// person's role, the room's shared state, and the access an admitted person gets: the room (made here if
// needed) and a pass with only their role's rights.
import type { CallAttendance, Call } from "@meetapp/db";
import { AppError } from "../../plugins/errors.ts";
import type { RateLimiter } from "../../plugins/rate-limit.ts";
import type { LiveKitProvider } from "../../providers/livekit.ts";
import type { LookupTokens } from "../meetings/lookup-token.ts";
import type { MeetingSecretBox } from "../meetings/meeting-secrets.ts";
import { groupOf } from "../meetings/lookup.service.ts";
import type { MeetingRow, MeetingsRepository } from "../meetings/meetings.repository.ts";
import type { AttendancesRepository } from "./attendances.repository.ts";
import type { CallEventsRepository } from "./call-events.repository.ts";
import { publishSources, resolveRole, type MeetingRole } from "./calls.permissions.ts";
import type { CallsRepository } from "./calls.repository.ts";

/** A meeting lasts at most 30 hours (AC-F02-39). */
export const CALL_LIMIT_MS = 30 * 60 * 60 * 1000;
/** The lobby wait (AC-F02-18), and how long a waiting app may go without asking before it counts as gone. */
export const LOBBY_WAIT_MS = 15 * 60 * 1000;
export const LOBBY_PRESENCE_MS = 60 * 1000;
/** After a final status, the ticket still reads the outcome for 30 minutes (design.md section 6). */
export const OUTCOME_MS = 30 * 60 * 1000;
export const MAX_IN_CALL = 100;
export const MAX_WAITING = 100;

export interface CallsDeps {
  meetings: MeetingsRepository;
  calls: CallsRepository;
  attendances: AttendancesRepository;
  livekit: LiveKitProvider;
  secrets: MeetingSecretBox;
  lookupTokens: LookupTokens;
  limiter: RateLimiter;
  events: CallEventsRepository;
  /** Gives a new call its 30-hour jobs; set once the jobs run (server.ts), a no-op until then. */
  scheduler: { schedule: (call: Call) => Promise<void> };
  /** Where the app connects to the call server (config: callServerUrl). */
  serverUrl: string;
  now: () => Date;
}

export const notFound = () => new AppError(404, "NOT_FOUND", "Not found.");

/**
 * The meeting of a meeting's call or join (F02). A chat call (F15, D072) has none, so meeting-only steps
 * (lobby, rejoin, the meeting's chat) treat it as not found.
 */
export function meetingIdOf(row: { meetingId: string | null }): string {
  if (row.meetingId === null) throw notFound();
  return row.meetingId;
}

/**
 * The person as they are now (S2): a member removed from the workspace counts as from outside from then
 * on, and a role given for their old group no longer applies. Guests stay guests.
 */
export async function asTheyAreNow<T extends Pick<CallAttendance, "userId" | "participantGroup" | "roleOverride">>(
  deps: Pick<CallsDeps, "meetings">,
  row: MeetingRow,
  person: T,
): Promise<T> {
  if (person.participantGroup === "guest") return person;
  const group = await groupOf(deps.meetings, row.meeting.workspaceId, person.userId ?? undefined);
  return group === person.participantGroup ? person : { ...person, participantGroup: group, roleOverride: null };
}

export function roleOf(attendance: CallAttendance, row: MeetingRow): MeetingRole {
  const userId = attendance.userId ?? undefined;
  return resolveRole({
    isOrganizer: userId === row.meeting.organizerId,
    isCoOrganizer: userId !== undefined && row.coOrganizerIds.includes(userId),
    roleOverride: attendance.roleOverride,
    group: attendance.participantGroup,
    whoCanPresent: row.meeting.whoCanPresent,
  });
}

/** The room's shared state, read by every app (design.md 3.6). */
export function roomMetadata(row: MeetingRow, call: Call): string {
  const { lobbyBypass, whoCanPresent, allowAttendeeMic, allowAttendeeCamera, chatMode } = row.meeting;
  return JSON.stringify({
    options: { lobbyBypass, whoCanPresent, allowAttendeeMic, allowAttendeeCamera, chatMode },
    locked: call.locked,
    endsAt: new Date(call.startedAt.getTime() + CALL_LIMIT_MS).toISOString(),
  });
}

/** The room (made if needed) and a pass with the person's rights only (AC-F02-49). */
export async function callAccess(deps: CallsDeps, attendance: CallAttendance, row: MeetingRow, call: Call) {
  const role = roleOf(attendance, row);
  await deps.livekit.ensureRoom(call.id, roomMetadata(row, call));
  const pass = await deps.livekit.pass({
    room: call.id,
    identity: attendance.id,
    name: attendance.displayName,
    sources: publishSources(role, row.meeting),
    attributes: {
      role,
      group: attendance.participantGroup,
      ...(attendance.userId ? { userId: attendance.userId } : {}),
    },
  });
  return { callId: call.id, serverUrl: deps.serverUrl, pass, role };
}

/** Tells the people with lobby rights to look again (a server message; the room may not exist yet). */
export async function lobbyChanged(deps: CallsDeps, callId: string | null | undefined): Promise<void> {
  if (!callId) return;
  await deps.livekit.sendControl(callId, { type: "lobby_changed" }).catch(() => undefined);
}
