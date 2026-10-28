// Calls from chats (F15 design.md 3.1–3.3; AC-F15-01–04, 12, 14, 20, 26). A chat call is an F02 call
// without a meeting (D072): no link, passcode or lobby; everyone is equal and may send their own
// microphone, camera and screen. Membership and the chat's read-only rules (F14) are checked on every
// request; starting and joining hold the chat's row, so a chat has one running call and at most 20 people.
import type { CallAttendance } from "./attendances.repository.ts";
import type { Call, Executor } from "./calls.repository.ts";
import type { CallRing } from "./call-rings.repository.ts";
import { CHAT_CALL_LIMITS, type CallMedia } from "@meetapp/contracts";
import { AppError } from "../../plugins/errors.ts";
import { newTicket, ticketFingerprint } from "../../plugins/meeting-ticket.ts";
import { CALL_LIMIT_MS, notFound, type CallsDeps } from "./admission.ts";
import { takeCallUnits } from "./call-rate.ts";
import { insertAttendance } from "./attendances.repository.ts";
import {
  peopleCount,
  peopleIn,
  seatsOf,
  runningChatCall,
  startChatCall,
  type ChatCallsRepository,
} from "./chat-calls.repository.ts";

/** LiveKit's own cap: the 20-person rule counts people, so a few second windows still fit (design 3.1). */
const ROOM_CAP = 25;

/** The chat as the caller may use it now (F14's rules for sending; 404 or 403 `CHAT_READ_ONLY` otherwise). */
export interface ChatPlace {
  conversation: { id: string; workspaceId: string; kind: "direct" | "group"; name: string | null };
  me: { id: string; name: string; external: boolean; photoUrl: string | null };
  /** The call's name for the app: the group's name, or the other people's names. */
  title: string;
  members: { userId: string; name: string; state: string }[];
}

export interface ChatCallsDeps {
  calls: CallsDeps;
  chatCalls: ChatCallsRepository;
  place: (userId: string, conversationId: string) => Promise<ChatPlace>;
  /** Sends a new call's rings to the people rung (the ring service). */
  rang: (caller: ChatPlace, call: Call, rings: CallRing[]) => Promise<void>;
  /** Someone rung joined or started instead of pressing Accept: their rings and the caller's Calling stop. */
  answered: (userId: string, callId: string) => Promise<void>;
  /** Saves a note in the chat ("Sara started a call"), delivered like a message. */
  note: (place: ChatPlace, note: { event: "call_started"; callId: string; media: CallMedia }) => Promise<void>;
}

const full = () => new AppError(409, "CALL_FULL", "This call is full.");
const tooManySeats = () =>
  new AppError(
    409,
    "CALL_DEVICES",
    `You're already in this call on ${String(CHAT_CALL_LIMITS.seatsPerPerson)} devices.`,
  );
const ended = () => new AppError(409, "CALL_ENDED", "This call has ended.");

/** Who rings when a call starts: the other accepted members, nobody in a group of more than 20 (AC-F15-04). */
function whoToRing(place: ChatPlace): string[] {
  const accepted = place.members.filter((m) => m.state === "accepted");
  if (accepted.length > CHAT_CALL_LIMITS.people) return [];
  return accepted.filter((m) => m.userId !== place.me.id).map((m) => m.userId);
}

/** The room (made if needed, capped) and a pass for the person's own microphone, camera and screen. */
async function chatCallAccess(deps: CallsDeps, attendance: CallAttendance, call: Call) {
  const endsAt = new Date(call.startedAt.getTime() + CALL_LIMIT_MS).toISOString();
  await deps.livekit.ensureRoom(call.id, JSON.stringify({ chatCall: true, locked: false, endsAt }), ROOM_CAP);
  const pass = await deps.livekit.pass({
    room: call.id,
    identity: attendance.id,
    name: attendance.displayName,
    sources: ["camera", "microphone", "screen_share"],
    attributes: {
      role: "presenter",
      group: attendance.participantGroup,
      ...(attendance.userId ? { userId: attendance.userId } : {}),
    },
  });
  return { callId: call.id, serverUrl: deps.serverUrl, pass, role: "presenter" as const };
}

/** `replaces`: transfer to this device, the seat this one takes over (AC-F15-33). */
type SeatOptions = { replaces?: string | undefined };

function seatFor(
  deps: CallsDeps,
  place: ChatPlace,
  call: Call,
  { ticket, replaces }: SeatOptions & { ticket: string },
) {
  const now = deps.now();
  return {
    workspaceId: place.conversation.workspaceId,
    meetingId: null,
    conversationId: place.conversation.id,
    callId: call.id,
    userId: place.me.id,
    displayName: place.me.name,
    guestDeviceHash: null,
    participantGroup: place.me.external ? ("external" as const) : ("member" as const),
    roleOverride: null,
    status: "admitted" as const,
    ticketHash: ticketFingerprint(ticket),
    lobbyEnteredAt: null,
    lastSeenAt: now,
    admittedAt: now,
    joinedAt: null,
    leftAt: null,
    leftReason: null,
    // A transfer's new seat names the seat it replaces (transfer.service.ts).
    actedBy: replaces ?? null,
    lastEventAt: null,
    rejoinedAt: null,
  };
}

/** Takes a seat in the call, unless 20 other people are already in it (AC-F15-14). */
async function takeSeat(
  deps: ChatCallsDeps,
  tx: Executor,
  place: ChatPlace,
  { call, replaces }: SeatOptions & { call: Call },
) {
  const already = (await peopleIn(tx, call.id)).includes(place.me.id);
  if (!already && (await peopleCount(tx, call.id)) >= CHAT_CALL_LIMITS.people) throw full();
  // A person's own extra seats don't count toward the 20, so they are capped here (T-fix-5).
  if (already && (await seatsOf(tx, call.id, place.me.id)) >= CHAT_CALL_LIMITS.seatsPerPerson) throw tooManySeats();
  const ticket = newTicket();
  const attendance = await insertAttendance(tx, seatFor(deps.calls, place, call, { ticket, replaces }));
  const answered = await deps.chatCalls.answeredByJoining(tx, call.id, place.me.id, deps.calls.now());
  return { attendance, ticket, answered: answered.length > 0 };
}

async function answer(
  deps: ChatCallsDeps,
  place: ChatPlace,
  entry: { attendance: CallAttendance; call: Call; ticket: string },
) {
  return {
    attendanceId: entry.attendance.id,
    ticket: entry.ticket,
    status: entry.attendance.status,
    title: place.title,
    group: entry.attendance.participantGroup,
    call: await chatCallAccess(deps.calls, entry.attendance, entry.call),
  };
}

/** Starts the chat's call, or joins the running one without ringing anyone again (AC-F15-01, 03, 26). */
async function start(deps: ChatCallsDeps, userId: string, conversationId: string, media: CallMedia) {
  const place = await deps.place(userId, conversationId);
  await takeCallUnits(deps.calls.limiter, userId, 1);
  const entry = await deps.chatCalls.locked(conversationId, async (tx) => {
    const running = await runningChatCall(tx, conversationId);
    const call =
      running ?? (await startChatCall(tx, { conversationId, workspaceId: place.conversation.workspaceId, media }));
    const seat = await takeSeat(deps, tx, place, { call });
    const rings = running ? [] : await deps.chatCalls.ring(tx, call, whoToRing(place));
    return { ...seat, call, rings, started: !running };
  });
  if (entry.started) {
    await deps.calls.scheduler.schedule(entry.call);
    await deps.note(place, { event: "call_started", callId: entry.call.id, media });
    await deps.rang(place, entry.call, entry.rings);
  }
  if (entry.answered) await deps.answered(place.me.id, entry.call.id);
  // The caller waits on "Calling…" only while someone is rung (a running call is simply joined).
  return { ...(await answer(deps, place, entry)), ringing: entry.started && entry.rings.length > 0 };
}

/** Joins a chat's running call (**Join** in the chat, AC-F15-03, 15); membership checked now (AC-F15-20). */
async function join(deps: ChatCallsDeps, userId: string, callId: string, options: SeatOptions = {}) {
  const call = await deps.chatCalls.byId(callId);
  if (!call?.conversationId) throw notFound();
  // Membership first, so someone outside the chat learns nothing about its calls.
  const place = await deps.place(userId, call.conversationId);
  if (call.endedAt) throw ended();
  // Join, Accept and Transfer count toward the person's call limit, like starting (T-fix-5).
  await takeCallUnits(deps.calls.limiter, userId, 1);
  const entry = await deps.chatCalls.locked(call.conversationId, async (tx) => {
    const running = await runningChatCall(tx, call.conversationId ?? "");
    if (running?.id !== callId) throw ended();
    return { ...(await takeSeat(deps, tx, place, { call: running, replaces: options.replaces })), call: running };
  });
  // Joining while rung answers the ring, as Accept would (T-fix-9).
  if (entry.answered) await deps.answered(place.me.id, entry.call.id);
  return answer(deps, place, entry);
}

/** The chat's running call for **Join**, or none. */
async function running(deps: ChatCallsDeps, userId: string, conversationId: string) {
  // Only people who may call here see the running call (others get 404).
  const place = await deps.place(userId, conversationId);
  const call = await deps.chatCalls.running(conversationId);
  if (!call) return { call: null };
  // Whoever took the first seat started the call.
  const starter = await deps.chatCalls.starterOf(call.id);
  const [inCall, rings] = await Promise.all([deps.chatCalls.peopleIn(call.id), deps.chatCalls.latestRings(call.id)]);
  return {
    call: {
      callId: call.id,
      media: call.media ?? "video",
      startedAt: call.startedAt.toISOString(),
      startedBy: { userId: starter?.userId ?? "", name: starter?.name ?? "" },
      people: inCall.length,
      // The chat's other accepted members and where each stands, for Add people (AC-F15-13).
      members: place.members
        .filter((m) => m.state === "accepted" && m.userId !== userId)
        .map((m) => ({
          userId: m.userId,
          name: m.name,
          inCall: inCall.includes(m.userId),
          ring: rings.get(m.userId) ?? null,
        })),
    },
  };
}

export function createChatCallsService(deps: ChatCallsDeps) {
  return {
    start: (userId: string, conversationId: string, media: CallMedia) => start(deps, userId, conversationId, media),
    join: (userId: string, callId: string) => join(deps, userId, callId),
    /** A seat with options: transfer to this device (transfer.service.ts). */
    seat: (userId: string, callId: string, options: SeatOptions) => join(deps, userId, callId, options),
    running: (userId: string, conversationId: string) => running(deps, userId, conversationId),
  };
}

export type ChatCallsService = ReturnType<typeof createChatCallsService>;
