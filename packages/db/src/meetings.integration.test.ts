// Integration tests for the F02 tables (docs/specs/F02-meetings/design.md section 4): migration 0003
// runs on an F01 database with data in it, and the rules the database itself keeps: one running call per
// meeting, at most 10 co-organizers, one ticket per attendance, and secrets stored only as written by
// the backend (encrypted text and keyed hashes). Runs on its own empty databases.
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "./connection.ts";
import { runMigrations } from "./migrate.ts";
import { callAttendances, calls, meetingCoOrganizers } from "./schema.ts";
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

describe("migration 0003 on an F01 database with data", () => {
  it("TC-F02-05 [AC-F02-40] existing workspaces keep working and allow guests by default", SLOW, async () => {
    const older = await createTestDatabase();
    const folder = mkdtempSync(join(tmpdir(), "meetapp-migrations-"));
    try {
      // The migrations as they were before F02: the journal stops at 0002.
      const { db: early, close } = await migrateBefore(older.url, "0003", folder);
      const owner = randomUUID();
      await early.execute(
        sql`insert into "user" (id, name, email) values (${owner}, 'Example person', ${`p-${owner}@example.test`})`,
      );
      await early.execute(
        sql`insert into workspaces (name, kind, created_by) values ('Example team', 'company', ${owner})`,
      );
      await close();

      await runMigrations(older.url);
      const rows = await rowsOf<{ allow_guests: boolean }>(older.db, sql`select allow_guests from workspaces`);
      expect(rows).toEqual([{ allow_guests: true }]);
    } finally {
      rmSync(folder, { recursive: true, force: true });
      await older.drop();
    }
  });
});

describe("rules the database keeps for meetings", () => {
  it("TC-F02-05 [AC-F02-03] the link and passcode have only encrypted and keyed-hash columns", SLOW, async () => {
    const columns = await rowsOf<{ column_name: string }>(
      db,
      sql`select column_name from information_schema.columns where table_name = 'meetings'`,
    );
    const names = columns.map((column) => column.column_name);
    expect(names).toEqual(expect.arrayContaining(["link_lookup", "link_secret_enc", "passcode_check", "passcode_enc"]));
    expect(names).not.toContain("passcode");
    expect(names).not.toContain("link");
  });

  it("TC-F02-37 [AC-F02-42] only one running call per meeting", SLOW, async () => {
    const { meetingId, workspaceId } = await newMeeting(db);
    await db.insert(calls).values({ meetingId, workspaceId });
    await expect(db.insert(calls).values({ meetingId, workspaceId })).rejects.toThrow();
    await db.execute(sql`update calls set ended_at = now(), end_reason = 'last_left' where meeting_id = ${meetingId}`);
    await expect(db.insert(calls).values({ meetingId, workspaceId })).resolves.toBeDefined();
  });

  it("TC-F02-104 [AC-F02-36] at most 10 co-organizers, even when added at the same moment", SLOW, async () => {
    const { meetingId } = await newMeeting(db);
    const people = await Promise.all(Array.from({ length: 12 }, () => newUser(db)));
    const results = await Promise.allSettled(
      people.map((userId) => db.insert(meetingCoOrganizers).values({ meetingId, userId })),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(10);
    await expect(db.insert(meetingCoOrganizers).values({ meetingId, userId: await newUser(db) })).rejects.toThrow();
  });

  it("TC-F02-100 [AC-F02-49] a ticket fingerprint belongs to one attendance only", SLOW, async () => {
    const { meetingId, workspaceId } = await newMeeting(db);
    const row = {
      meetingId,
      workspaceId,
      displayName: "Guest person",
      participantGroup: "guest" as const,
      ticketHash: `ticket-${randomUUID()}`,
    };
    await db.insert(callAttendances).values(row);
    await expect(db.insert(callAttendances).values(row)).rejects.toThrow();
  });
});
