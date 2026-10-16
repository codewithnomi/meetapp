// The lobby (F02 design.md section 3.4; AC-F02-14–19). Waiting apps ask for their status every 2
// seconds; the answer carries the pass once they are let in. People with lobby rights see who waits and
// admit or deny them. A ticket works only for its own attendance and status (design.md section 6);
// anything else gets the same 404 as a call that doesn't exist (S1, S2, AC-F02-50).
import type { CallAttendance } from "./attendances.repository.ts";
import { AppError } from "../../plugins/errors.ts";
import { RATE_RULES } from "../../plugins/rate-limit.ts";
import {
  LOBBY_PRESENCE_MS,
  LOBBY_WAIT_MS,
  MAX_IN_CALL,
  OUTCOME_MS,
  callAccess,
  lobbyChanged,
  notFound,
  roleOf,
  type CallsDeps,
} from "./admission.ts";
import { admitWaiting, waitingInOrder, type AttendanceStatus } from "./attendances.repository.ts";
import type { MeetingRow } from "../meetings/meetings.repository.ts";
import { can, type CallAction } from "./calls.permissions.ts";
import { reenter } from "./rejoin.service.ts";
import { IN_CALL_STATUSES, placesTaken, runningCall } from "./calls.repository.ts";

const FINAL: readonly AttendanceStatus[] = ["left", "denied", "removed", "timed_out", "turned_away"];
const inCall = (status: AttendanceStatus) => (IN_CALL_STATUSES as readonly string[]).includes(status);

export interface LobbyDecision {
  attendanceIds?: string[] | undefined;
  all?: boolean | undefined;
}

const seenSince = (deps: CallsDeps) => new Date(deps.now().getTime() - LOBBY_PRESENCE_MS);

/** The caller's own attendance, by ticket; 404 for anyone else's id. */
async function own(deps: CallsDeps, attendanceId: string, ticketHash: string): Promise<CallAttendance> {
  const attendance = await deps.attendances.byTicket(ticketHash);
  if (!attendance || attendance.id !== attendanceId) throw notFound();
  const finishedAgo = deps.now().getTime() - attendance.updatedAt.getTime();
  if (FINAL.includes(attendance.status) && finishedAgo > OUTCOME_MS) throw notFound();
  return attendance;
}

/** Someone in this call whose role allows `action`; counted against the in-call limit (S5). */
export async function actor(deps: CallsDeps, callId: string, ticketHash: string, action: CallAction) {
  const attendance = await deps.attendances.byTicket(ticketHash);
  if (!attendance || attendance.callId !== callId || !inCall(attendance.status)) throw notFound();
  const row = await deps.meetings.find(attendance.meetingId);
  if (!row || !can(roleOf(attendance, row), action)) throw notFound();
  const wait = await deps.limiter.take(RATE_RULES.callActions, ticketHash);
  if (wait !== undefined) throw new AppError(429, "TOO_MANY_ATTEMPTS", "Too many actions. Wait a moment.", wait);
  return { attendance, row };
}

/** Why a waiting person can no longer wait: guests switched off, or the meeting locked (AC-F02-37, 40). */
async function turnAwayReason(deps: CallsDeps, attendance: CallAttendance, row: MeetingRow) {
  if (attendance.participantGroup === "guest" && !row.allowGuests) return "guests_off" as const;
  const role = roleOf(attendance, row);
  if (role === "organizer" || role === "co_organizer") return undefined;
  return (await deps.calls.runningFor(row.meeting.id))?.locked ? ("locked" as const) : undefined;
}

async function stillWaiting(deps: CallsDeps, attendance: CallAttendance, row: MeetingRow): Promise<CallAttendance> {
  const reason = await turnAwayReason(deps, attendance, row);
  if (
    reason &&
    (await deps.attendances.move(attendance.id, ["waiting"], { status: "turned_away", leftReason: reason }))
  ) {
    return { ...attendance, status: "turned_away", leftReason: reason };
  }
  // Let in before, but the room closed before they connected: the join decision again (TC-F02-40).
  if (attendance.admittedAt) return reenter(deps, attendance);
  const now = deps.now();
  const waited = now.getTime() - (attendance.lobbyEnteredAt ?? now).getTime();
  if (waited >= LOBBY_WAIT_MS && (await deps.attendances.move(attendance.id, ["waiting"], { status: "timed_out" }))) {
    return { ...attendance, status: "timed_out" };
  }
  await deps.attendances.seen(attendance.id, now);
  return attendance;
}

async function status(deps: CallsDeps, attendanceId: string, ticketHash: string) {
  const wait = await deps.limiter.take(RATE_RULES.attendanceStatus, ticketHash);
  if (wait !== undefined) throw new AppError(429, "TOO_MANY_ATTEMPTS", "Too many requests. Wait a moment.", wait);
  let attendance = await own(deps, attendanceId, ticketHash);
  const row = await deps.meetings.find(attendance.meetingId);
  if (!row) throw notFound();
  if (attendance.status === "waiting") attendance = await stillWaiting(deps, attendance, row);
  const answer = {
    attendanceId: attendance.id,
    status: attendance.status,
    title: row.meeting.title,
    group: attendance.participantGroup,
  };
  if (inCall(attendance.status) && attendance.callId) {
    const call = await deps.calls.byId(attendance.callId);
    if (call && !call.endedAt) return { ...answer, call: await callAccess(deps, attendance, row, call) };
  }
  if (attendance.leftReason) Object.assign(answer, { leftReason: attendance.leftReason });
  if (attendance.status === "removed" && attendance.actedBy) {
    const remover = await deps.attendances.byId(attendance.actedBy);
    if (remover) return { ...answer, actedByName: remover.displayName };
  }
  return answer;
}

/** Leave the lobby, or the call (the app's Leave). */
async function leave(deps: CallsDeps, attendanceId: string, ticketHash: string): Promise<void> {
  const attendance = await own(deps, attendanceId, ticketHash);
  await deps.attendances.move(attendance.id, ["waiting", "admitted", "in_call"], {
    status: "left",
    leftReason: "leave",
    leftAt: deps.now(),
  });
  await lobbyChanged(deps, attendance.callId ?? (await deps.calls.runningFor(attendance.meetingId))?.id);
}

async function lobby(deps: CallsDeps, callId: string, ticketHash: string) {
  const { attendance } = await actor(deps, callId, ticketHash, "admit");
  const waiting = await waitingInOrder(deps.calls.reader, attendance.meetingId, seenSince(deps));
  return {
    waiting: waiting.map((person) => ({
      attendanceId: person.id,
      name: person.displayName,
      group: person.participantGroup,
      waitingSince: (person.lobbyEnteredAt ?? person.createdAt).toISOString(),
    })),
  };
}

/** Admits in arrival order up to the free places; the rest keep waiting (AC-F02-42, TC-F02-39). */
async function admit(deps: CallsDeps, callId: string, ticketHash: string, decision: LobbyDecision) {
  const { attendance } = await actor(deps, callId, ticketHash, "admit");
  const result = await deps.calls.locked(attendance.meetingId, async (tx) => {
    const running = await runningCall(tx, attendance.meetingId);
    if (running?.id !== callId) throw notFound();
    const free = Math.max(0, MAX_IN_CALL - (await placesTaken(tx, callId)));
    const wanted = (await waitingInOrder(tx, attendance.meetingId, seenSince(deps))).filter(
      (person) => decision.all === true || (decision.attendanceIds ?? []).includes(person.id),
    );
    const ids = wanted.slice(0, free).map((person) => person.id);
    const decided = await admitWaiting(tx, ids, { callId, actedBy: attendance.id, at: deps.now() });
    return { decided, didNotFit: wanted.length - ids.length };
  });
  await lobbyChanged(deps, callId);
  return result;
}

async function deny(deps: CallsDeps, callId: string, ticketHash: string, decision: LobbyDecision) {
  const { attendance } = await actor(deps, callId, ticketHash, "admit");
  const ids =
    decision.all === true
      ? (await waitingInOrder(deps.calls.reader, attendance.meetingId, seenSince(deps))).map((person) => person.id)
      : (decision.attendanceIds ?? []);
  const decided = await deps.attendances.deny(attendance.meetingId, ids, attendance.id);
  await lobbyChanged(deps, callId);
  return { decided, didNotFit: 0 };
}

export function createLobbyService(deps: CallsDeps) {
  return {
    status: (attendanceId: string, ticketHash: string) => status(deps, attendanceId, ticketHash),
    leave: (attendanceId: string, ticketHash: string) => leave(deps, attendanceId, ticketHash),
    lobby: (callId: string, ticketHash: string) => lobby(deps, callId, ticketHash),
    admit: (callId: string, ticketHash: string, decision: LobbyDecision) => admit(deps, callId, ticketHash, decision),
    deny: (callId: string, ticketHash: string, decision: LobbyDecision) => deny(deps, callId, ticketHash, decision),
  };
}

export type LobbyService = ReturnType<typeof createLobbyService>;
