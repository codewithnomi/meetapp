// What the chat's messages need to know about the viewer and the chat (F03): where requests go, their
// rights, and whether the chat is read only. Shared by the message, poll and composer parts.
import type { ChatMessageView } from "@meetapp/contracts";
import type { Chat, ChatPlace } from "../../features/meetings/chat/index.ts";

/** What the viewer may do in the chat, from their meeting role (the server checks again). */
export interface ChatRights {
  moderate: boolean;
  createPoll: boolean;
  /** Everyone in the call but guests (AC-F03-33). */
  attach: boolean;
}

export interface ChatView {
  chat: Chat;
  place: ChatPlace;
  rights: ChatRights;
  /** The signed-in viewer's account, so messages from an earlier join count as their own. */
  viewerUserId?: string | undefined;
  /** Chat is off, or the meeting has ended: read only; organizers may still remove messages (AC-F03-35, 42). */
  readOnly: boolean;
  onReply: (message: ChatMessageView) => void;
  onEdit: (message: ChatMessageView) => void;
  onDelete: (message: ChatMessageView) => void;
  onFailed: () => void;
}
