// The part of a conversation one person may read, as a database condition (F14 AC-F14-17, AC-F14-18).
import { chatMessages } from "@meetapp/db";
import { and, eq, gte, lte, or } from "drizzle-orm";

/** What one person may read of a conversation: from their history choice until they left (AC-F14-18). */
export interface ReadWindow {
  conversationId: string;
  from: Date | null;
  until: Date | null;
}

/** Messages inside any of these windows. */
export function inWindows(windows: ReadWindow[]) {
  return or(
    ...windows.map((w) =>
      and(
        eq(chatMessages.conversationId, w.conversationId),
        w.from ? gte(chatMessages.createdAt, w.from) : undefined,
        w.until ? lte(chatMessages.createdAt, w.until) : undefined,
      ),
    ),
  );
}
