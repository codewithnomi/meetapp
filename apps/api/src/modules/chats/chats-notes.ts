// Notes in a chat such as "Aisha named the group Design" or "Aisha added Ben" (F14 AC-F14-14, 16–18):
// saved as system messages with their news, so every member's chat shows them in order.
import { randomUUID } from "node:crypto";
import type { ChatMessageView } from "@meetapp/contracts";
import type { ChatRepository } from "../chat/chat.repository.ts";

export type ChatNote = NonNullable<ChatMessageView["system"]>;

export function saveNote(
  chat: ChatRepository,
  conversation: { id: string; workspaceId: string },
  by: { id: string; name: string },
  note: Omit<ChatNote, "name">,
) {
  return chat.insertMessage(
    {
      workspaceId: conversation.workspaceId,
      conversationId: conversation.id,
      senderAttendanceId: null,
      senderUserId: by.id,
      senderName: by.name,
      senderGroup: "member",
      kind: "system",
      system: { ...note, name: by.name },
      clientId: randomUUID(),
    },
    "message_created",
  );
}
