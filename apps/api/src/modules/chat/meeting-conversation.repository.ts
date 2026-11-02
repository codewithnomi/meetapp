// A meeting chat's conversation (F14 D065): every meeting chat row now also points at its meeting's
// conversation. Database access only.
import { type Executor, conversations } from "@meetapp/db";
import { eq } from "drizzle-orm";

/** Where a meeting chat row lives: its workspace, meeting and (since F14, D065) its conversation. */
export interface ChatPlace {
  workspaceId: string;
  meetingId: string | null;
  conversationId?: string | null;
}

/** A meeting chat row always has its meeting; only F14's other chats have none. */
export function meetingOf(row: { meetingId: string | null }): string {
  if (!row.meetingId) throw new Error("not a meeting chat");
  return row.meetingId;
}

/** The meeting's conversation, made on first need (F14 D065; safe to run any number of times). */
export async function meetingConversation(executor: Executor, workspaceId: string, meetingId: string): Promise<string> {
  await executor
    .insert(conversations)
    .values({ workspaceId, kind: "meeting", meetingId })
    .onConflictDoNothing({ target: conversations.meetingId });
  const [row] = await executor
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.meetingId, meetingId));
  if (!row) throw new Error("no conversation for the meeting");
  return row.id;
}
