// Integration tests for the F03 chat tables (docs/specs/F03-chat/design.md section 4): migration 0005
// runs on an F02 database with a meeting in it, and the rules the database itself keeps: at most 3
// pins per meeting, a message sent once per app-made id, and chat going with its meeting.
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "./connection.ts";
import { runMigrations } from "./migrate.ts";
import { callAttendances, chatMessages, chatPins, chatReactions, meetings } from "./schema.ts";
import { createTestDatabase, rowsOf, type TestDatabase } from "./test-database.ts";
import { migrateBefore, newMeeting } from "./test-fixtures.ts";

const SLOW = { timeout: 60_000 };
let testDb: TestDatabase | undefined;
let db: Database;

beforeAll(async () => {
  testDb = await createTestDatabase();
  db = testDb.db;
  await runMigrations(testDb.url);
}, 60_000);

afterAll(async () => {
  await testDb?.drop();
}, 60_000);

async function newAttendance(meetingId: string, workspaceId: string): Promise<string> {
  const [row] = await db
    .insert(callAttendances)
    .values({
      meetingId,
      workspaceId,
      displayName: "Example person",
      participantGroup: "member",
      status: "in_call",
      ticketHash: `ticket-${randomUUID()}`,
    })
    .returning();
  if (!row) throw new Error("no attendance row");
  return row.id;
}

async function newMessage(meetingId: string, workspaceId: string, senderAttendanceId: string, clientId = randomUUID()) {
  const [row] = await db
    .insert(chatMessages)
    .values({
      meetingId,
      workspaceId,
      senderAttendanceId,
      senderName: "Example person",
      senderGroup: "member",
      kind: "text",
      body: { v: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }] },
      plainText: "hello",
      clientId,
    })
    .returning();
  if (!row) throw new Error("no message row");
  return row.id;
}

describe("migration 0005 on an F02 database with data", () => {
  it("TC-F03-94 [AC-F03-35] [AC-F03-27] existing meetings get chat On and workspaces allow GIFs", SLOW, async () => {
    const older = await createTestDatabase();
    const folder = mkdtempSync(join(tmpdir(), "meetapp-migrations-"));
    try {
      const { db: early, close } = await migrateBefore(older.url, "0005", folder);
      // Raw SQL: the schema in the code already has the new columns, the older database doesn't.
      const owner = randomUUID();
      const meetingId = randomUUID();
      await early.execute(
        sql`insert into "user" (id, name, email) values (${owner}, 'Example person', ${`p-${owner}@example.test`})`,
      );
      await early.execute(sql`
        with w as (insert into workspaces (name, kind, created_by) values ('Example team', 'company', ${owner}) returning id)
        insert into meetings (id, workspace_id, organizer_id, kind, title, meeting_number, link_lookup, link_secret_enc,
          passcode_check, passcode_enc, key_version, expires_at)
        select ${meetingId}, w.id, ${owner}, 'link', 'Example meeting', '123456789012', 'lookup', 'v1.x', 'check',
          'v1.x', 1, now() + interval '60 days' from w`);
      await close();

      await runMigrations(older.url);
      const meetingRows = await rowsOf<{ chat_mode: string }>(
        older.db,
        sql`select chat_mode from meetings where id = ${meetingId}`,
      );
      expect(meetingRows).toEqual([{ chat_mode: "on" }]);
      const workspaceRows = await rowsOf<{ allow_gifs: boolean }>(older.db, sql`select allow_gifs from workspaces`);
      expect(workspaceRows).toEqual([{ allow_gifs: true }]);
    } finally {
      rmSync(folder, { recursive: true, force: true });
      await older.drop();
    }
  });
});

describe("rules the database keeps for chat", () => {
  it("TC-F03-35 [AC-F03-19] at most 3 pins per meeting, even when pinned at the same moment", SLOW, async () => {
    const { meetingId, workspaceId } = await newMeeting(db);
    const sender = await newAttendance(meetingId, workspaceId);
    const messages = await Promise.all(Array.from({ length: 5 }, () => newMessage(meetingId, workspaceId, sender)));
    const results = await Promise.allSettled(
      messages.map((messageId) => db.insert(chatPins).values({ meetingId, workspaceId, messageId })),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(3);
  });

  it("TC-F03-10 [AC-F03-05] the same app-made id from the same sender is stored once", SLOW, async () => {
    const { meetingId, workspaceId } = await newMeeting(db);
    const sender = await newAttendance(meetingId, workspaceId);
    const clientId = randomUUID();
    await newMessage(meetingId, workspaceId, sender, clientId);
    await expect(newMessage(meetingId, workspaceId, sender, clientId)).rejects.toThrow();
    const other = await newAttendance(meetingId, workspaceId);
    await expect(newMessage(meetingId, workspaceId, other, clientId)).resolves.toBeDefined();
  });

  it("TC-F03-73 [AC-F03-43] deleting a meeting deletes its messages, pins and reactions", SLOW, async () => {
    const { meetingId, workspaceId } = await newMeeting(db);
    const sender = await newAttendance(meetingId, workspaceId);
    const messageId = await newMessage(meetingId, workspaceId, sender);
    await db.insert(chatPins).values({ meetingId, workspaceId, messageId });
    await db
      .insert(chatReactions)
      .values({ workspaceId, messageId, attendanceId: sender, emoji: "👍", reactorName: "Example person" });

    await db.delete(meetings).where(eq(meetings.id, meetingId));
    for (const table of ["chat_messages", "chat_pins", "chat_reactions"]) {
      const rows = await rowsOf<{ n: number }>(
        db,
        sql`select count(*)::int as n from ${sql.identifier(table)} where workspace_id = ${workspaceId}`,
      );
      expect(rows, table).toEqual([{ n: 0 }]);
    }
  });
});
