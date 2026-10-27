// Controls inside a call (F02 design.md section 3.6; AC-F02-23, 33–38). Every control checks the caller's
// meeting role (calls.permissions.ts) and the target's; the backend then tells the call server, so a
// changed app can't skip the rules. Changes to roles or options reach everyone's rights at once.
import type { CallAttendance } from "./attendances.repository.ts";
import { detailsOf } from "../meetings/meetings.service.ts";
import { notFound, roleOf, roomMetadata, type CallsDeps } from "./admission.ts";
import { endForEveryone } from "./call-events.repository.ts";
import { canActOn, publishSources } from "./calls.permissions.ts";
import { actor, ownSeat } from "./lobby.service.ts";

const present = (attendance: CallAttendance | undefined, callId: string) =>
  attendance?.callId === callId && (attendance.status === "admitted" || attendance.status === "in_call");

/** The caller (with the right) and the person they act on, both in this call; 404 otherwise. */
async function caller(
  deps: CallsDeps,
  callId: string,
  ticketHash: string,
  target: { id: string; action: "mute" | "remove" | "setRole" },
) {
  const { attendance, row } = await actor(deps, callId, ticketHash, target.action);
  const other = await deps.attendances.byId(target.id);
  if (!other || !present(other, callId)) throw notFound();
  if (!canActOn(roleOf(attendance, row), target.action, roleOf(other, row))) throw notFound();
  return { attendance, row, other };
}

/** The call server is told; a person who hasn't connected yet simply isn't there to change. */
const quietly = (work: Promise<unknown>) => work.then(() => undefined).catch(() => undefined);

/** New rights and role for everyone in the running call of a meeting (AC-F02-34, 36). */
export async function refreshCall(deps: CallsDeps, meetingId: string): Promise<void> {
  const call = await deps.calls.runningFor(meetingId);
  const row = await deps.meetings.find(meetingId);
  if (!call || !row) return;
  await quietly(deps.livekit.setRoomMetadata(call.id, roomMetadata(row, call)));
  for (const person of await deps.attendances.presentIn(call.id)) {
    const role = roleOf(person, row);
    await quietly(deps.livekit.setRights(call.id, person.id, publishSources(role, row.meeting)));
    await quietly(deps.livekit.setAttributes(call.id, person.id, { role }));
  }
}

async function muteOne(deps: CallsDeps, callId: string, target: string, by: string): Promise<void> {
  const muted = await deps.livekit.muteMicrophone(callId, target).catch(() => false);
  if (muted) await quietly(deps.livekit.sendControl(callId, { type: "muted_by", by }, [target]));
}

/** End meeting for everyone, the lobby included (AC-F02-38). */
async function endMeeting(deps: CallsDeps, callId: string, ticketHash: string): Promise<void> {
  const { row } = await actor(deps, callId, ticketHash, "end");
  if (await endForEveryone(deps.calls.reader, { id: callId, meetingId: row.meeting.id }, deps.now())) {
    await quietly(deps.livekit.deleteRoom(callId));
  }
}

export function createControlsService(deps: CallsDeps) {
  const handAt = (raised: boolean) => ({ handRaisedAt: raised ? deps.now().toISOString() : "" });
  return {
    hand: async (callId: string, ticketHash: string, raised: boolean) => {
      const attendance = await ownSeat(deps, callId, ticketHash);
      await quietly(deps.livekit.setAttributes(callId, attendance.id, handAt(raised)));
    },
    lowerHand: async (callId: string, ticketHash: string, targetId: string) => {
      const { other } = await caller(deps, callId, ticketHash, { id: targetId, action: "mute" });
      await quietly(deps.livekit.setAttributes(callId, other.id, handAt(false)));
    },
    mute: async (callId: string, ticketHash: string, targetId: string) => {
      const { attendance, other } = await caller(deps, callId, ticketHash, { id: targetId, action: "mute" });
      await muteOne(deps, callId, other.id, attendance.displayName);
    },
    /** Everyone except the person who pressed it (AC-F02-33). */
    muteAll: async (callId: string, ticketHash: string) => {
      const { attendance } = await actor(deps, callId, ticketHash, "mute");
      for (const person of await deps.attendances.presentIn(callId)) {
        if (person.id !== attendance.id) await muteOne(deps, callId, person.id, attendance.displayName);
      }
    },
    remove: async (callId: string, ticketHash: string, targetId: string) => {
      const { attendance, other } = await caller(deps, callId, ticketHash, { id: targetId, action: "remove" });
      const change = {
        status: "removed" as const,
        leftReason: "removed" as const,
        actedBy: attendance.id,
        leftAt: deps.now(),
      };
      if (await deps.attendances.move(other.id, ["admitted", "in_call"], change)) {
        await quietly(deps.livekit.remove(callId, other.id));
      }
    },
    setRole: async (callId: string, ticketHash: string, targetId: string, role: "presenter" | "attendee") => {
      const { other, row } = await caller(deps, callId, ticketHash, { id: targetId, action: "setRole" });
      await deps.attendances.setRoleOverride(other.id, role);
      await refreshCall(deps, row.meeting.id);
    },
    lock: async (callId: string, ticketHash: string, locked: boolean) => {
      const { row } = await actor(deps, callId, ticketHash, "options");
      await deps.calls.setLocked(callId, locked);
      await refreshCall(deps, row.meeting.id);
    },
    end: (callId: string, ticketHash: string) => endMeeting(deps, callId, ticketHash),
    /** Meeting info (AC-F02-01): link, ID and passcode, for anyone in the call. */
    info: async (callId: string, ticketHash: string) =>
      detailsOf((await actor(deps, callId, ticketHash, "talk")).row, deps.secrets),
  };
}

export type ControlsService = ReturnType<typeof createControlsService>;
