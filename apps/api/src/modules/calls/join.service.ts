// Joining a meeting (F02 design.md section 3.3; AC-F02-11, 13–19, 35, 37, 40, 42). The lookup token
// names the meeting and the person; everything is checked again here. The decision and the place it
// takes are made while holding the meeting's row, so the 100-person limits hold under any timing.
import type { CallAttendance, Executor } from "@meetapp/db";
import { AppError } from "../../plugins/errors.ts";
import { newTicket, ticketFingerprint } from "../../plugins/meeting-ticket.ts";
import { RATE_RULES } from "../../plugins/rate-limit.ts";
import { groupOf } from "../meetings/lookup.service.ts";
import { extendedExpiry } from "../meetings/expiry.ts";
import { isUsable } from "../meetings/meetings.service.ts";
import type { MeetingRow } from "../meetings/meetings.repository.ts";
import {
  MAX_IN_CALL,
  MAX_WAITING,
  LOBBY_PRESENCE_MS,
  callAccess,
  lobbyChanged,
  roleOf,
  type CallsDeps,
} from "./admission.ts";
import { admitWaiting, insertAttendance, waitingInOrder } from "./attendances.repository.ts";
import { skipsLobby, type Group } from "./calls.permissions.ts";
import { accountInCall, placesTaken, removedFrom, runningCall, startCall, waitingCount } from "./calls.repository.ts";

export interface JoinRequest {
  lookupToken: string;
  guestName?: string | undefined;
  deviceKey: string;
  user: { id: string; name: string } | undefined;
  address: string;
}

const notFound = () =>
  new AppError(404, "MEETING_NOT_FOUND", "We couldn't find that meeting. Check the link, or the ID and passcode.");

/** 1–60 characters after removing control characters and trimming (AC-F02-11, 51). */
export function cleanGuestName(name: string | undefined): string {
  // eslint-disable-next-line no-control-regex -- removing control characters is the point
  const cleaned = (name ?? "").replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim();
  if (cleaned.length < 1 || cleaned.length > 60) {
    throw new AppError(400, "BAD_REQUEST", "Type a name of 1 to 60 characters.");
  }
  return cleaned;
}

interface Joiner {
  row: MeetingRow;
  group: Group;
  base: Omit<CallAttendance, "id" | "createdAt" | "updatedAt" | "status" | "callId">;
  ticket: string;
}

async function checkLimits(deps: CallsDeps, request: JoinRequest): Promise<void> {
  const waits = [
    await deps.limiter.take(RATE_RULES.meetingJoinsPerAddress, request.address),
    await deps.limiter.take(RATE_RULES.meetingJoinsPerToken, request.lookupToken),
  ];
  const wait = waits.find((value) => value !== undefined);
  if (wait !== undefined) throw new AppError(429, "TOO_MANY_ATTEMPTS", "Too many tries. Wait a minute.", wait);
}

async function prepare(deps: CallsDeps, request: JoinRequest): Promise<Joiner> {
  const grant = deps.lookupTokens.read(request.lookupToken);
  if (!grant || grant.userId !== (request.user?.id ?? null)) throw notFound();
  await checkLimits(deps, request);
  const row = await deps.meetings.find(grant.meetingId);
  if (!row) throw notFound();
  if (!isUsable(row, deps.now())) throw new AppError(410, "MEETING_EXPIRED", "This meeting has expired.");
  const group = await groupOf(deps.meetings, row.meeting.workspaceId, request.user?.id);
  if (group === "guest" && !row.allowGuests) {
    throw new AppError(403, "GUESTS_NOT_ALLOWED", "This meeting doesn't allow guests.");
  }
  const now = deps.now();
  const ticket = newTicket();
  const base = {
    workspaceId: row.meeting.workspaceId,
    meetingId: row.meeting.id,
    userId: request.user?.id ?? null,
    displayName: request.user?.name ?? cleanGuestName(request.guestName),
    guestDeviceHash: group === "guest" ? deps.secrets.guestDeviceHash(row.meeting.id, request.deviceKey) : null,
    participantGroup: group,
    roleOverride: null,
    ticketHash: ticketFingerprint(ticket),
    lobbyEnteredAt: null,
    lastSeenAt: now,
    admittedAt: null,
    joinedAt: null,
    leftAt: null,
    leftReason: null,
    actedBy: null,
    lastEventAt: null,
    rejoinedAt: null,
  };
  return { row, group, base, ticket };
}

/** Guests waiting only because nobody with an account was in: let in once someone is (AC-F02-17). */
async function admitWaitingGuests(deps: CallsDeps, tx: Executor, row: MeetingRow, callId: string) {
  if (row.meeting.lobbyBypass !== "everyone") return;
  const seenSince = new Date(deps.now().getTime() - LOBBY_PRESENCE_MS);
  const free = MAX_IN_CALL - (await placesTaken(tx, callId));
  const guests = (await waitingInOrder(tx, row.meeting.id, seenSince)).filter((w) => w.participantGroup === "guest");
  const ids = guests.slice(0, Math.max(0, free)).map((guest) => guest.id);
  await admitWaiting(tx, ids, { callId, actedBy: null, at: deps.now() });
}

/** The decision, made while holding the meeting's row. */
function decide(deps: CallsDeps, joiner: Joiner) {
  const { row, group, base } = joiner;
  return deps.calls.locked(row.meeting.id, async (tx) => {
    const now = deps.now();
    const running = await runningCall(tx, row.meeting.id);
    const probe = { ...base, status: "waiting" as const, callId: null, id: "", createdAt: now, updatedAt: now };
    const role = roleOf(probe, row);
    const manages = role === "organizer" || role === "co_organizer";
    if (running?.locked && !manages) throw new AppError(403, "MEETING_LOCKED", "This meeting is locked.");
    const who = {
      ...(base.userId ? { userId: base.userId } : {}),
      ...(base.guestDeviceHash ? { deviceHash: base.guestDeviceHash } : {}),
    };
    const removed = running ? await removedFrom(tx, running.id, who) : false;
    const someoneInside = group !== "guest" || (running ? await accountInCall(tx, running.id) : false);
    const enters =
      !removed && skipsLobby({ role, group, lobbyBypass: row.meeting.lobbyBypass, accountInCall: someoneInside });
    if (!enters) {
      if ((await waitingCount(tx, row.meeting.id, new Date(now.getTime() - LOBBY_PRESENCE_MS))) >= MAX_WAITING) {
        throw new AppError(409, "LOBBY_FULL", "This meeting is full.");
      }
      return {
        attendance: await insertAttendance(tx, { ...base, status: "waiting", lobbyEnteredAt: now }),
        call: running,
      };
    }
    if (running && (await placesTaken(tx, running.id)) >= MAX_IN_CALL) {
      throw new AppError(409, "MEETING_FULL", "This meeting is full (100 people).");
    }
    const call = running ?? (await startCall(tx, row.meeting));
    const attendance = await insertAttendance(tx, { ...base, status: "admitted", callId: call.id, admittedAt: now });
    if (base.userId) await admitWaitingGuests(deps, tx, row, call.id);
    return { attendance, call };
  });
}

export function createJoinService(deps: CallsDeps) {
  return {
    join: async (request: JoinRequest) => {
      const joiner = await prepare(deps, request);
      const { attendance, call } = await decide(deps, joiner);
      const { row } = joiner;
      const answer = {
        attendanceId: attendance.id,
        ticket: joiner.ticket,
        status: attendance.status,
        title: row.meeting.title,
        group: joiner.group,
      };
      if (attendance.status !== "admitted" || !call) {
        await lobbyChanged(deps, call?.id);
        return answer;
      }
      // Getting into the call counts as joining: a link meeting gets another 60 days (AC-F02-04).
      await deps.meetings.update(row.meeting.id, {
        expiresAt: extendedExpiry(row.meeting.kind, row.meeting.expiresAt, deps.now()),
      });
      await lobbyChanged(deps, call.id);
      return { ...answer, call: await callAccess(deps, attendance, row, call) };
    },
  };
}

export type JoinService = ReturnType<typeof createJoinService>;
