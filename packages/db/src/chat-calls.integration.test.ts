// Integration tests for calls from chats (docs/specs/F15-calls/design.md 3.1 and 4, D072): migration 0009
// runs on an F14 database with meeting calls and loses nothing, and the rules the database keeps: a call
// belongs to exactly one meeting or chat, and a chat has one running call at a time.
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "./connection.ts";
import { runMigrations } from "./migrate.ts";
import { callRings, calls, conversations } from "./schema.ts";
import { createTestDatabase, rowsOf, type TestDatabase } from "./test-database.ts";
import { migrateBefore, newMeeting, newUser } from "./test-fixtures.ts";

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

async function newChat() {
  const meeting = await newMeeting(db);
  const [chat] = await db
    .insert(conversations)
    .values({ workspaceId: meeting.workspaceId, kind: "group", name: "Release team" })
    .returning();
  if (!chat) throw new Error("no chat");
  return { ...meeting, conversationId: chat.id };
}

describe("migration 0009 on an F14 database with meeting calls", () => {
  it("TC-F15-79 [AC-F15-12] meeting calls keep their meeting; settings default; nothing lost", SLOW, async () => {
    const older = await createTestDatabase();
    const folder = mkdtempSync(join(tmpdir(), "meetapp-migrations-"));
    try {
      const { db: early, close } = await migrateBefore(older.url, "0009", folder);
      // Raw SQL: the schema in the code already has the new columns, the older database doesn't.
      const owner = randomUUID();
      const meetingId = randomUUID();
      const callId = randomUUID();
      await early.execute(
        sql`insert into "user" (id, name, email) values (${owner}, 'Example person', ${`p-${owner}@example.test`})`,
      );
      await early.execute(sql`
        with w as (insert into workspaces (name, kind, created_by) values ('Example team', 'company', ${owner}) returning id)
        insert into meetings (id, workspace_id, organizer_id, kind, title, meeting_number, link_lookup, link_secret_enc,
          passcode_check, passcode_enc, key_version, expires_at)
        select ${meetingId}, w.id, ${owner}, 'link', 'Example meeting', '123456789019', 'lookup-0009', 'v1.x', 'check',
          'v1.x', 1, now() + interval '60 days' from w`);
      await early.execute(
        sql`insert into calls (id, workspace_id, meeting_id) select ${callId}, workspace_id, id from meetings where id = ${meetingId}`,
      );
      await early.execute(sql`
        insert into call_attendances (meeting_id, call_id, workspace_id, display_name, participant_group, status, ticket_hash)
        select ${meetingId}, ${callId}, workspace_id, 'Example person', 'member', 'in_call', 'ticket-0009'
        from meetings where id = ${meetingId}`);
      await close();

      await runMigrations(older.url);
      expect(await rowsOf(older.db, sql`select meeting_id, conversation_id, media from calls`)).toEqual([
        { meeting_id: meetingId, conversation_id: null, media: null },
      ]);
      expect(await rowsOf(older.db, sql`select meeting_id, conversation_id from call_attendances`)).toEqual([
        { meeting_id: meetingId, conversation_id: null },
      ]);
      expect(await rowsOf(older.db, sql`select ringtone, ring_volume from "user"`)).toEqual([
        { ringtone: 1, ring_volume: 70 },
      ]);
    } finally {
      rmSync(folder, { recursive: true, force: true });
      await older.drop();
    }
  });
});

describe("rules the database keeps for chat calls", () => {
  it("TC-F15-75 [AC-F15-20] a call belongs to exactly one meeting or chat", SLOW, async () => {
    const chat = await newChat();
    await expect(
      db
        .insert(calls)
        .values({ workspaceId: chat.workspaceId, meetingId: chat.meetingId, conversationId: chat.conversationId }),
    ).rejects.toThrow();
    await expect(db.insert(calls).values({ workspaceId: chat.workspaceId })).rejects.toThrow();
    await db
      .insert(calls)
      .values({ workspaceId: chat.workspaceId, conversationId: chat.conversationId, media: "video" });
  });

  it("TC-F15-75 [AC-F15-26] a chat has one running call; an ended one doesn't count", SLOW, async () => {
    const chat = await newChat();
    const [first] = await db
      .insert(calls)
      .values({ workspaceId: chat.workspaceId, conversationId: chat.conversationId, media: "audio" })
      .returning();
    await expect(
      db.insert(calls).values({ workspaceId: chat.workspaceId, conversationId: chat.conversationId, media: "video" }),
    ).rejects.toThrow();
    await db.execute(sql`update calls set ended_at = now() where id = ${first?.id ?? ""}`);
    await db
      .insert(calls)
      .values({ workspaceId: chat.workspaceId, conversationId: chat.conversationId, media: "video" });
  });

  it("TC-F15-75 [AC-F15-28] rings go with their call; a ring starts as ringing", SLOW, async () => {
    const chat = await newChat();
    const person = await newUser(db);
    const [call] = await db
      .insert(calls)
      .values({ workspaceId: chat.workspaceId, conversationId: chat.conversationId, media: "video" })
      .returning();
    const [ring] = await db
      .insert(callRings)
      .values({ workspaceId: chat.workspaceId, callId: call?.id ?? "", userId: person })
      .returning();
    expect(ring?.state).toBe("ringing");
    await db.execute(sql`delete from conversations where id = ${chat.conversationId}`);
    expect(await rowsOf(db, sql`select id from call_rings where id = ${ring?.id ?? ""}`)).toEqual([]);
  });
});
