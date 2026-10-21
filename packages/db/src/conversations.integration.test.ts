// Integration tests for the F14 chat tables (docs/specs/F14-chats/design.md section 4, D065): migration
// 0006 runs on an F03 database with chat in it and loses nothing, and the rules the database keeps: one
// conversation per meeting and one direct chat per pair of people in a workspace.
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "./connection.ts";
import { runMigrations } from "./migrate.ts";
import { conversations } from "./schema.ts";
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

describe("migration 0006 on an F03 database with chat", () => {
  it(
    "TC-F14-77 TC-F14-78 [AC-F14-28] meeting chat stays as it was; new columns start empty; settings default on",
    SLOW,
    async () => {
      const older = await createTestDatabase();
      const folder = mkdtempSync(join(tmpdir(), "meetapp-migrations-"));
      try {
        const { db: early, close } = await migrateBefore(older.url, "0006", folder);
        // Raw SQL: the schema in the code already has the new columns, the older database doesn't.
        const owner = randomUUID();
        const meetingId = randomUUID();
        const attendance = randomUUID();
        await early.execute(
          sql`insert into "user" (id, name, email) values (${owner}, 'Example person', ${`p-${owner}@example.test`})`,
        );
        await early.execute(sql`
        with w as (insert into workspaces (name, kind, created_by) values ('Example team', 'company', ${owner}) returning id)
        insert into meetings (id, workspace_id, organizer_id, kind, title, meeting_number, link_lookup, link_secret_enc,
          passcode_check, passcode_enc, key_version, expires_at)
        select ${meetingId}, w.id, ${owner}, 'link', 'Example meeting', '123456789013', 'lookup', 'v1.x', 'check',
          'v1.x', 1, now() + interval '60 days' from w`);
        await early.execute(sql`
        insert into call_attendances (id, meeting_id, workspace_id, display_name, participant_group, status, ticket_hash)
        select ${attendance}, ${meetingId}, workspace_id, 'Example person', 'member', 'in_call', 'ticket-0006'
        from meetings where id = ${meetingId}`);
        await early.execute(sql`
        insert into chat_messages (meeting_id, workspace_id, sender_attendance_id, sender_name, sender_group, kind,
          plain_text, client_id)
        select ${meetingId}, workspace_id, ${attendance}, 'Example person', 'member', 'text', 'kept', gen_random_uuid()
        from meetings where id = ${meetingId}`);
        await close();

        await runMigrations(older.url);
        const messages = await rowsOf<{ plain_text: string; meeting_id: string; conversation_id: string | null }>(
          older.db,
          sql`select plain_text, meeting_id, conversation_id from chat_messages`,
        );
        // Nothing lost or moved; the conversation is filled by the separate fill step (T3).
        expect(messages).toEqual([{ plain_text: "kept", meeting_id: meetingId, conversation_id: null }]);
        expect(await rowsOf(older.db, sql`select allow_outside_chat from workspaces`)).toEqual([
          { allow_outside_chat: true },
        ]);
        expect(await rowsOf(older.db, sql`select read_receipts from "user"`)).toEqual([{ read_receipts: true }]);
      } finally {
        rmSync(folder, { recursive: true, force: true });
        await older.drop();
      }
    },
  );
});

describe("rules the database keeps for conversations", () => {
  it("TC-F14-77 [AC-F14-28] a meeting has at most one conversation", SLOW, async () => {
    const meeting = await newMeeting(db);
    await db
      .insert(conversations)
      .values({ workspaceId: meeting.workspaceId, kind: "meeting", meetingId: meeting.meetingId });
    await expect(
      db
        .insert(conversations)
        .values({ workspaceId: meeting.workspaceId, kind: "meeting", meetingId: meeting.meetingId }),
    ).rejects.toThrow();
  });

  it("TC-F14-15 [AC-F14-09] a pair of people has one direct chat per workspace", SLOW, async () => {
    const meeting = await newMeeting(db);
    const key = `${randomUUID()}:${randomUUID()}`;
    await db.insert(conversations).values({ workspaceId: meeting.workspaceId, kind: "direct", directKey: key });
    await expect(
      db.insert(conversations).values({ workspaceId: meeting.workspaceId, kind: "direct", directKey: key }),
    ).rejects.toThrow();
  });
});
