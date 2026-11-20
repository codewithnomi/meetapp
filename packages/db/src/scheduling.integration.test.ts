// Integration tests for the F13 tables (docs/specs/F13-scheduling/design.md "Data stored"): migrations
// 0011–0012 run on a database that already holds F02 meetings, and the rules the database itself keeps:
// the `scheduled` kind, an invitee is a member or an email (never both), at most 250 invitees per meeting.
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "./connection.ts";
import { runMigrations } from "./migrate.ts";
import { meetingInvitees, meetings, meetingSchedules } from "./schema.ts";
import { createTestDatabase, type TestDatabase } from "./test-database.ts";
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

const email = (meetingId: string, workspaceId: string) => ({
  meetingId,
  workspaceId,
  emailEnc: "v1.encrypted",
  emailLookup: `lookup-${randomUUID()}`,
  keyVersion: 1,
});

describe("migrations 0011–0012 on a database with meetings", () => {
  it("[AC-F13-13] existing meetings keep working and a meeting can become scheduled", SLOW, async () => {
    const older = await createTestDatabase();
    const folder = mkdtempSync(join(tmpdir(), "meetapp-migrations-"));
    try {
      const { close } = await migrateBefore(older.url, "0011", folder);
      const { meetingId, workspaceId } = await newMeeting(older.db);
      await close();
      await runMigrations(older.url);
      const [before] = await older.db.select().from(meetings).where(eq(meetings.id, meetingId));
      expect(before?.kind).toBe("link");
      await older.db.update(meetings).set({ kind: "scheduled" }).where(eq(meetings.id, meetingId));
      await older.db.insert(meetingSchedules).values({
        meetingId,
        workspaceId,
        startsAt: new Date("2026-12-01T09:00:00Z"),
        endsAt: new Date("2026-12-01T09:30:00Z"),
        timeZone: "Europe/London",
      });
      const [schedule] = await older.db
        .select()
        .from(meetingSchedules)
        .where(eq(meetingSchedules.meetingId, meetingId));
      expect(schedule).toMatchObject({ allDay: false, rrule: null, sequence: 0, description: "" });
    } finally {
      await older.drop();
      rmSync(folder, { recursive: true, force: true });
    }
  });
});

describe("rules the database keeps", () => {
  it("[AC-F13-08] an invitee is a member or an email, never both or neither", async () => {
    const { meetingId, workspaceId } = await newMeeting(db);
    const member = await newUser(db);
    await db.insert(meetingInvitees).values({ meetingId, workspaceId, userId: member });
    await db.insert(meetingInvitees).values(email(meetingId, workspaceId));
    await expect(db.insert(meetingInvitees).values({ meetingId, workspaceId })).rejects.toThrow();
    await expect(
      db.insert(meetingInvitees).values({ ...email(meetingId, workspaceId), userId: await newUser(db) }),
    ).rejects.toThrow();
  });

  it("[AC-F13-08] the same person or email is invited once", async () => {
    const { meetingId, workspaceId } = await newMeeting(db);
    const member = await newUser(db);
    await db.insert(meetingInvitees).values({ meetingId, workspaceId, userId: member });
    await expect(db.insert(meetingInvitees).values({ meetingId, workspaceId, userId: member })).rejects.toThrow();
  });

  it("[AC-F13-08] at most 250 invitees per meeting", SLOW, async () => {
    const { meetingId, workspaceId } = await newMeeting(db);
    await db.insert(meetingInvitees).values(Array.from({ length: 250 }, () => email(meetingId, workspaceId)));
    await expect(db.insert(meetingInvitees).values(email(meetingId, workspaceId))).rejects.toMatchObject({
      cause: { message: expect.stringMatching(/at most 250 invitees/) },
    });
    const [row] = await db
      .execute<{ n: number }>(sql`select count(*)::int as n from meeting_invitees where meeting_id = ${meetingId}`)
      .then((r) => r.rows);
    expect(row?.n).toBe(250);
  });
});
