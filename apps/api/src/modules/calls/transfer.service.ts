// Other devices and transfer (F15 design 3.8; AC-F15-33, D075). Each device in a call has its own seat.
// "Transfer to this device" gives the new device a seat that names the seat it replaces; when the call
// server reports the new seat connected, the old one leaves. If the new device never connects, nothing
// changes: the old seat stays. Built desktop-to-desktop now; the phone app (F11) uses the same steps.
import type { CallAttendance } from "@meetapp/db";
import { notFound, type CallsDeps } from "./admission.ts";
import type { ChatCallsRepository } from "./chat-calls.repository.ts";
import type { ChatCallsService, ChatPlace } from "./chat-calls.service.ts";

/** A transfer the new device finishes within this time; later, the old seat simply stays. */
const TRANSFER_MS = 30 * 1000;

export interface TransferDeps {
  calls: CallsDeps;
  chatCalls: ChatCallsRepository;
  place: (userId: string, conversationId: string) => Promise<ChatPlace>;
  join: ChatCallsService["seat"];
}

const present = (seat: CallAttendance | undefined, callId: string, userId: string) =>
  seat?.callId === callId && seat.userId === userId && (seat.status === "admitted" || seat.status === "in_call");

/** The person's running chat calls and their seats, for "You're in a call on another device". */
async function active(deps: TransferDeps, userId: string) {
  const result = [];
  for (const call of await deps.chatCalls.runningCallsOf(userId)) {
    const seats = (await deps.calls.attendances.presentIn(call.id)).filter((seat) => seat.userId === userId);
    if (seats.length === 0 || !call.conversationId) continue;
    const place = await deps.place(userId, call.conversationId).catch(() => undefined);
    if (!place) continue;
    result.push({
      callId: call.id,
      conversationId: call.conversationId,
      meetingId: null,
      title: place.title,
      media: call.media ?? "video",
      seats: seats.map((seat) => ({
        attendanceId: seat.id,
        joinedAt: (seat.joinedAt ?? seat.admittedAt ?? seat.createdAt).toISOString(),
      })),
    });
  }
  return { calls: result };
}

/** A seat for this device that replaces `fromAttendanceId` once it connects. */
async function transfer(deps: TransferDeps, userId: string, callId: string, fromAttendanceId: string) {
  const from = await deps.calls.attendances.byId(fromAttendanceId);
  if (!present(from, callId, userId)) throw notFound();
  return deps.join(userId, callId, { replaces: fromAttendanceId });
}

/** The call server reported a seat connected: if it replaces another of the same person's, that one goes. */
async function joined(deps: TransferDeps, attendanceId: string) {
  const seat = await deps.calls.attendances.byId(attendanceId);
  const oldId = seat?.actedBy;
  if (!seat?.callId || !seat.userId || !oldId) return;
  const recent = deps.calls.now().getTime() - (seat.admittedAt ?? seat.createdAt).getTime() <= TRANSFER_MS;
  const old = await deps.calls.attendances.byId(oldId);
  if (!recent || !present(old, seat.callId, seat.userId)) return;
  const change = { status: "left" as const, leftReason: "leave" as const, leftAt: deps.calls.now() };
  if (await deps.calls.attendances.move(oldId, ["admitted", "in_call"], change)) {
    await deps.calls.livekit.remove(seat.callId, oldId).catch(() => undefined);
  }
}

export function createTransferService(deps: TransferDeps) {
  return {
    active: (userId: string) => active(deps, userId),
    transfer: (userId: string, callId: string, fromAttendanceId: string) =>
      transfer(deps, userId, callId, fromAttendanceId),
    joined: (attendanceId: string) => joined(deps, attendanceId),
  };
}

export type TransferService = ReturnType<typeof createTransferService>;
