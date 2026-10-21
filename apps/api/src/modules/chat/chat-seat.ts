// The person acting in a chat (F03 and F14): in a call (a join with a ticket) or in a one-to-one or
// group chat (an account). Message, reaction and reply rules are shared; each kind builds its own seat
// with its own rights checks, news delivery and reading window.
import type { ChatEvent } from "@meetapp/contracts";
import { broadcast, chatActor, personKey, type ChatDeps } from "./chat-access.ts";
import type { ChatAction } from "./chat.permissions.ts";
import type { Who } from "./chat-who.ts";

export interface ChatSeat {
  conversationId: string;
  workspaceId: string;
  meetingId: string | null;
  callId: string | null;
  who: Who;
  /** The account, when there is one (guests have none). */
  userId: string | null;
  name: string;
  group: "member" | "external" | "guest";
  /** Whose sending allowance this uses (an account, a guest's device). */
  limitKey: string;
  allowGifs: boolean;
  /** Chats: own messages can be edited and deleted any time; meetings: during the call only (F03). */
  ownAnyTime: boolean;
  /** Meeting organizers may delete anyone's message. */
  mayDeleteAny: () => Promise<boolean>;
  /** Files are allowed (guests send none in meetings). */
  mayAttach: () => Promise<boolean>;
  /** What may be read: messages from `from` (history choice) until `until`, news up to `untilSeq`
   * (left or removed, F14 AC-17, 18). */
  window: { from: Date | null; until: Date | null; untilSeq: number | null };
  deliver: (event: ChatEvent) => Promise<void>;
}

/** The viewer key for "mine": the join in meetings, the account in chats. */
export const viewerOf = (seat: ChatSeat) => seat.who.attendanceId ?? seat.who.userId ?? undefined;

/** The caller in this running call, as a seat; 404 or CHAT_OFF as F03's rights say. */
export async function meetingSeat(deps: ChatDeps, callId: string, ticketHash: string, action: ChatAction) {
  const { attendance, row, conversationId } = await chatActor(deps, callId, ticketHash, action);
  const can = (other: ChatAction) => () =>
    chatActor(deps, callId, ticketHash, other).then(
      () => true,
      () => false,
    );
  const seat: ChatSeat = {
    conversationId,
    workspaceId: row.meeting.workspaceId,
    meetingId: row.meeting.id,
    callId,
    who: { attendanceId: attendance.id, userId: null },
    userId: attendance.userId,
    name: attendance.displayName,
    group: attendance.participantGroup,
    limitKey: personKey(attendance),
    allowGifs: row.allowGifs,
    ownAnyTime: false,
    mayDeleteAny: can("deleteAny"),
    mayAttach: can("attach"),
    window: { from: null, until: null, untilSeq: null },
    deliver: (event) => broadcast(deps, callId, event),
  };
  return seat;
}

/** Where a new message belongs and who sent it, as kept in the record. */
export const seatSender = (seat: ChatSeat) => ({
  workspaceId: seat.workspaceId,
  meetingId: seat.meetingId,
  conversationId: seat.conversationId,
  callId: seat.callId,
  senderAttendanceId: seat.who.attendanceId,
  senderUserId: seat.userId,
  senderName: seat.name,
  senderGroup: seat.group,
});
