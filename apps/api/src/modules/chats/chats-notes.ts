// Notes in a chat such as "Aisha named the group Design" or "Aisha added Ben" (F14 AC-F14-14, 16–18):
// saved as system messages with their news, so every member's chat shows them in order.
import { randomUUID } from "node:crypto";
import type { ChatMessageView } from "@meetapp/contracts";
import type { ChatRepository } from "../chat/chat.repository.ts";
import type { LivePublisher } from "./chats-live.ts";

export type ChatNote = NonNullable<ChatMessageView["system"]>;

export async function saveNote(
  { chat, live }: { chat: ChatRepository; live: LivePublisher },
  conversation: { id: string; workspaceId: string },
  by: { id: string; name: string },
  note: Omit<ChatNote, "name">,
) {
  const saved = await chat.insertMessage(
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
  // The note goes out like a message; apps fetch it by id (F03's short news).
  if (saved.created)
    await live.news(conversation.id, { seq: saved.seq, type: "message_created", id: saved.message.id });
}
