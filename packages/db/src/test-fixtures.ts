// Test-only rows shared by the database integration tests: a person, and a meeting in its own workspace.
import { randomUUID } from "node:crypto";
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDatabase, type Database } from "./connection.ts";
import { MIGRATIONS_FOLDER } from "./migrate.ts";
import { meetings, user, workspaceMembers, workspaces } from "./schema.ts";

export async function newUser(db: Database): Promise<string> {
  const id = randomUUID();
  await db.insert(user).values({ id, name: "Example person", email: `person-${id}@example.test` });
  return id;
}

export async function newMeeting(db: Database): Promise<{ meetingId: string; workspaceId: string }> {
  const owner = await newUser(db);
  const [workspace] = await db
    .insert(workspaces)
    .values({ name: "Example team", kind: "company", createdBy: owner })
    .returning();
  if (!workspace) throw new Error("no workspace row");
  await db.insert(workspaceMembers).values({ workspaceId: workspace.id, userId: owner, role: "owner" });
  const number = String(100_000_000_000 + Math.floor(Math.random() * 899_999_999_999));
  const [meeting] = await db
    .insert(meetings)
    .values({
      workspaceId: workspace.id,
      organizerId: owner,
      kind: "link",
      title: "Example meeting",
      meetingNumber: number,
      linkLookup: `lookup-${randomUUID()}`,
      linkSecretEnc: "v1.encrypted",
      passcodeCheck: `check-${randomUUID()}`,
      passcodeEnc: "v1.encrypted",
      keyVersion: 1,
      expiresAt: new Date(Date.now() + 60 * 86_400_000),
    })
    .returning();
  if (!meeting) throw new Error("no meeting row");
  return { meetingId: meeting.id, workspaceId: workspace.id };
}

/**
 * Runs only the migrations older than `tag` (copied into `folder` with a shortened journal), so a test
 * can add data the way an older version left it, then run the rest. The caller closes the connection.
 */
export async function migrateBefore(url: string, tag: string, folder: string) {
  cpSync(MIGRATIONS_FOLDER, folder, { recursive: true });
  const journalFile = join(folder, "meta/_journal.json");
  const journal = JSON.parse(readFileSync(journalFile, "utf8")) as { entries: { tag: string }[] };
  journal.entries = journal.entries.filter((entry) => entry.tag < tag);
  writeFileSync(journalFile, JSON.stringify(journal));
  const connection = createDatabase(url, { max: 1 });
  await migrate(connection.db, { migrationsFolder: folder });
  return connection;
}
