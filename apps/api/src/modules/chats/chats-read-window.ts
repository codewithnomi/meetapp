// What one person may read of a conversation, as a database condition (F14 AC-F14-17, AC-F14-18), and
// how far they have read (AC-F14-02, 24).
import { type Database, chatEvents, chatMessages, conversationReads } from "@meetapp/db";
import { and, eq, gte, lte, or, sql } from "drizzle-orm";

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

/** The newest news number of a conversation, and the newest message time up to news `seq`. */
async function readPoint(db: Database, conversationId: string, seq: number) {
  const [newest] = await db
    .select({ seq: sql<number>`coalesce(max(${chatEvents.seq}), 0)::int` })
    .from(chatEvents)
    .where(eq(chatEvents.conversationId, conversationId));
  const last = newest?.seq ?? 0;
  const upTo = Math.min(seq, last);
  // All seen: up to the newest message. Otherwise up to the newest message whose news came by `seq`.
  const [row] =
    upTo >= last
      ? await db
          .select({ at: sql<string | null>`max(${chatMessages.createdAt})::text` })
          .from(chatMessages)
          .where(eq(chatMessages.conversationId, conversationId))
      : await db
          .select({ at: sql<string | null>`max(${chatMessages.createdAt})::text` })
          .from(chatEvents)
          .innerJoin(chatMessages, sql`${chatMessages.id} = (${chatEvents.payload} ->> 'id')::uuid`)
          .where(
            and(
              eq(chatEvents.conversationId, conversationId),
              eq(chatEvents.type, "message_created"),
              lte(chatEvents.seq, upTo),
            ),
          );
  // Kept as the database wrote it: a JavaScript date would drop the microseconds.
  return { seq: upTo, at: row?.at ?? null };
}

/**
 * The person's "read up to here" mark by news number, never past the chat's newest and never moving back
 * (AC-F14-02, 24). The time kept is the newest message that number covers, so a message that arrived
 * after it stays unread (the request's own time would have marked it read). A number older than all kept
 * news (a day) changes only the number.
 */
export async function markRead(
  db: Database,
  mark: { conversationId: string; workspaceId: string; userId: string; seq: number },
) {
  const now = new Date();
  const point = await readPoint(db, mark.conversationId, mark.seq);
  const { seq } = point;
  const at = point.at === null ? null : sql`${point.at}::timestamptz`;
  await db
    .insert(conversationReads)
    .values({ ...mark, lastReadSeq: seq, lastReadAt: at })
    .onConflictDoUpdate({
      target: [conversationReads.conversationId, conversationReads.userId],
      set: {
        lastReadSeq: sql`greatest(${conversationReads.lastReadSeq}, ${seq})`,
        // greatest() skips a missing time, so an older mark's time stays.
        lastReadAt: sql`greatest(${conversationReads.lastReadAt}, ${at})`,
        updatedAt: now,
      },
    });
}

/** F15: a "Missed call" note for this person: the only call note that counts as unread (AC-F15-15). */
export const missedCallFor = (userId: string) =>
  sql`(${chatMessages.kind} = 'system' and ${chatMessages.system} ->> 'event' = 'call_missed' and ${chatMessages.system} ->> 'forUserId' = ${userId})`;

/** F15: call notes the list may show as a chat's last line for this person (AC-F15-04, 15). */
export const callNoteFor = (userId: string) =>
  or(
    sql`(${chatMessages.kind} = 'system' and ${chatMessages.system} ->> 'event' in ('call_started', 'call_ended'))`,
    missedCallFor(userId),
  );
