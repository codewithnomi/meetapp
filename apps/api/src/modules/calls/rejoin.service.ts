// Coming back (F02 design.md sections 3.4 and 3.8; AC-F02-29). Rejoin after a dropped connection makes a
// new attendance with the old role, under the normal rules (lock, removal, lobby): once, within 30
// minutes, and counted against the join limit. Someone let in whose room closed before they connected
// gets the join decision again on their next ask.
import type { CallAttendance } from "./attendances.repository.ts";
import { AppError } from "../../plugins/errors.ts";
import { newTicket, ticketFingerprint } from "../../plugins/meeting-ticket.ts";
import { RATE_RULES } from "../../plugins/rate-limit.ts";
import { isUsable } from "../meetings/meetings.service.ts";
import { OUTCOME_MS, notFound, type CallsDeps } from "./admission.ts";
import { afterEntry, decide, entryFor } from "./join.service.ts";
import { moveAttendance } from "./attendances.repository.ts";
import { startCall } from "./calls.repository.ts";

/** A waiting person who had been let in into a call that closed: in again if the rules allow, else waiting. */
export async function reenter(deps: CallsDeps, attendance: CallAttendance): Promise<CallAttendance> {
  const row = await deps.meetings.find(attendance.meetingId);
  if (!row || !isUsable(row, deps.now())) return attendance;
  const entry = await deps.calls.locked(row.meeting.id, async (tx) => {
    const { running, enters, now } = await entryFor(deps, tx, row, attendance).catch(() => ({
      running: undefined,
      enters: false,
      now: deps.now(),
    }));
    if (!enters) {
      await moveAttendance(tx, attendance.id, ["waiting"], { status: "waiting", admittedAt: null });
      return undefined;
    }
    const call = running ?? (await startCall(tx, row.meeting));
    const moved = await moveAttendance(tx, attendance.id, ["waiting"], {
      status: "admitted",
      callId: call.id,
      admittedAt: now,
    });
    return moved ? { call, started: !running } : undefined;
  });
  if (!entry) return { ...attendance, admittedAt: null };
  const admitted = { ...attendance, status: "admitted" as const, callId: entry.call.id };
  await afterEntry(deps, row, { attendance: admitted, call: entry.call, started: entry.started });
  return admitted;
}

/** A new attendance for the same person, with the old role, and a new ticket. */
function freshFrom(deps: CallsDeps, old: CallAttendance, ticket: string) {
  return {
    workspaceId: old.workspaceId,
    meetingId: old.meetingId,
    userId: old.userId,
    displayName: old.displayName,
    guestDeviceHash: old.guestDeviceHash,
    participantGroup: old.participantGroup,
    roleOverride: old.roleOverride,
    ticketHash: ticketFingerprint(ticket),
    lobbyEnteredAt: null,
    lastSeenAt: deps.now(),
    admittedAt: null,
    joinedAt: null,
    leftAt: null,
    leftReason: null,
    actedBy: null,
    lastEventAt: null,
    rejoinedAt: null,
  };
}

/**
 * The attendance that may rejoin: dropped within 30 minutes, or let in but never connected (the call
 * couldn't connect); the latter counts as dropped from now on.
 */
async function droppedOne(deps: CallsDeps, attendanceId: string, ticketHash: string) {
  const old = await deps.attendances.byTicket(ticketHash);
  if (!old || old.id !== attendanceId) throw notFound();
  if (old.status === "admitted" && !old.joinedAt) {
    await deps.events.dropped(old.id, deps.now());
    return (await deps.attendances.byId(old.id)) ?? old;
  }
  const leftAgo = deps.now().getTime() - (old.leftAt?.getTime() ?? 0);
  if (old.status !== "left" || old.leftReason !== "dropped" || leftAgo > OUTCOME_MS) throw notFound();
  return old;
}

async function rejoin(deps: CallsDeps, attendanceId: string, ticketHash: string, address: string) {
  const old = await droppedOne(deps, attendanceId, ticketHash);
  const wait = await deps.limiter.take(RATE_RULES.meetingJoinsPerAddress, address);
  if (wait !== undefined) throw new AppError(429, "TOO_MANY_ATTEMPTS", "Too many tries. Wait a minute.", wait);
  // Once per attendance: the first Rejoin marks it; one that can't be completed gives it back.
  if (!(await deps.attendances.markRejoined(old.id, deps.now()))) throw notFound();
  return enter(deps, old).catch(async (error: unknown) => {
    await deps.attendances.unmarkRejoined(old.id);
    throw error;
  });
}

async function enter(deps: CallsDeps, old: CallAttendance) {
  const row = await deps.meetings.find(old.meetingId);
  if (!row) throw notFound();
  if (!isUsable(row, deps.now())) throw new AppError(410, "MEETING_EXPIRED", "This meeting has expired.");
  const ticket = newTicket();
  const entry = await decide(deps, { row, group: old.participantGroup, base: freshFrom(deps, old, ticket), ticket });
  const answer = {
    attendanceId: entry.attendance.id,
    ticket,
    status: entry.attendance.status,
    title: row.meeting.title,
    group: old.participantGroup,
  };
  if (entry.attendance.status !== "admitted" || !entry.call) return answer;
  const call = entry.call;
  return {
    ...answer,
    call: await afterEntry(deps, row, { attendance: entry.attendance, call, started: entry.started }),
  };
}

export function createRejoinService(deps: CallsDeps) {
  return {
    rejoin: (attendanceId: string, ticketHash: string, address: string) =>
      rejoin(deps, attendanceId, ticketHash, address),
  };
}

export type RejoinService = ReturnType<typeof createRejoinService>;
