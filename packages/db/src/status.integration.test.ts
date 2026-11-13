// Integration test for F04's status and notification columns (docs/specs/F04-desktop-app/design.md 4):
// migration 0010 only adds columns to "user"; older accounts keep everything and start automatic, with
// every notification on.
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { runMigrations } from "./migrate.ts";
import { createTestDatabase, rowsOf } from "./test-database.ts";
import { migrateBefore } from "./test-fixtures.ts";

const SLOW = { timeout: 60_000 };

describe("migration 0010 on an F16 database", () => {
  it("TC-F04-69 [AC-F04-20, AC-F04-36] only adds columns; old users keep their data", SLOW, async () => {
    const older = await createTestDatabase();
    const folder = mkdtempSync(join(tmpdir(), "meetapp-migrations-"));
    try {
      const { db: early, close } = await migrateBefore(older.url, "0010", folder);
      const id = randomUUID();
      // Raw SQL: the schema in the code already has the new columns, the older database doesn't.
      await early.execute(
        sql`insert into "user" (id, name, email, ringtone) values (${id}, 'Example person', ${`p-${id}@example.test`}, 3)`,
      );
      const before = await rowsOf(
        early,
        sql`select column_name from information_schema.columns where table_name = 'user'`,
      );
      await close();

      await runMigrations(older.url);
      const after = await rowsOf(
        older.db,
        sql`select column_name from information_schema.columns where table_name = 'user'`,
      );
      const added = after
        .map((row) => row["column_name"])
        .filter((name) => !before.some((old) => old["column_name"] === name));
      expect(added.sort()).toEqual([
        "manual_status",
        "manual_status_until",
        "notify_lobby",
        "notify_mentions",
        "notify_messages",
        "notify_preview",
        "notify_sound",
      ]);
      expect(after).toHaveLength(before.length + added.length);
      expect(
        await rowsOf(
          older.db,
          sql`select name, ringtone, manual_status, manual_status_until, notify_messages, notify_mentions, notify_lobby,
            notify_sound, notify_preview from "user"`,
        ),
      ).toEqual([
        {
          name: "Example person",
          ringtone: 3,
          manual_status: null,
          manual_status_until: null,
          notify_messages: true,
          notify_mentions: true,
          notify_lobby: true,
          notify_sound: true,
          notify_preview: true,
        },
      ]);
    } finally {
      rmSync(folder, { recursive: true, force: true });
      await older.drop();
    }
  });
});
