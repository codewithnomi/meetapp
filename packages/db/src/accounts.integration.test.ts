// Integration tests for the F01 tables (docs/specs/F01-accounts/design.md section 7): the rules the
// database itself enforces, so no code path can break them. Runs on its own empty database.
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, type Database } from "./connection.ts";
import { runMigrations } from "./migrate.ts";
import { invitations, joinRequests, session, user, workspaceMembers, workspaces } from "./schema.ts";
import { createTestDatabase, rowsOf, type TestDatabase } from "./test-database.ts";

const SLOW = { timeout: 60_000 };
let testDb: TestDatabase | undefined;
let db: Database;

async function newUser(label: string): Promise<string> {
  const id = randomUUID();
  await db.insert(user).values({ id, name: label, email: `${label}-${id}@example.test` });
  return id;
}

async function newCompany(owner: string): Promise<string> {
  const [row] = await db
    .insert(workspaces)
    .values({ name: "Example team", kind: "company", createdBy: owner })
    .returning();
  if (!row) throw new Error("no workspace row");
  await db.insert(workspaceMembers).values({ workspaceId: row.id, userId: owner, role: "owner" });
  return row.id;
}

async function owners(workspaceId: string): Promise<string[]> {
  const rows = await rowsOf<{ user_id: string }>(
    db,
    sql`select user_id from workspace_members where workspace_id = ${workspaceId} and role = 'owner'`,
  );
  return rows.map((row) => row.user_id);
}

/** A hand-over as the service will do it: only if `from` is still the owner (one transaction). */
function handOver(target: Database, workspaceId: string, from: string, to: string) {
  return target.transaction(async (tx) => {
    const demoted = await tx.execute(
      sql`update workspace_members set role = 'admin', updated_at = now()
          where workspace_id = ${workspaceId} and user_id = ${from} and role = 'owner'`,
    );
    if (demoted.rowCount !== 1) throw new Error("not the owner any more");
    await tx.execute(
      sql`update workspace_members set role = 'owner', updated_at = now()
          where workspace_id = ${workspaceId} and user_id = ${to}`,
    );
  });
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  db = testDb.db;
  await runMigrations(testDb.url);
}, 60_000);

afterAll(async () => {
  await testDb?.drop();
}, 60_000);

describe("TC-F01-59 [AC-F01-21] [AC-F01-22] exactly one owner, enforced by the database", () => {
  it("TC-F01-59 [AC-F01-22] a second owner can't be inserted or promoted", SLOW, async () => {
    const owner = await newUser("owner");
    const other = await newUser("other");
    const workspaceId = await newCompany(owner);
    await expect(db.insert(workspaceMembers).values({ workspaceId, userId: other, role: "owner" })).rejects.toThrow();
    await db.insert(workspaceMembers).values({ workspaceId, userId: other, role: "member" });
    await expect(
      db.execute(
        sql`update workspace_members set role = 'owner' where workspace_id = ${workspaceId} and user_id = ${other}`,
      ),
    ).rejects.toThrow();
    expect(await owners(workspaceId)).toEqual([owner]);
  });

  it("TC-F01-59 [AC-F01-22] two hand-overs at the same time leave exactly one owner", SLOW, async () => {
    const owner = await newUser("owner");
    const first = await newUser("first");
    const second = await newUser("second");
    const workspaceId = await newCompany(owner);
    await db.insert(workspaceMembers).values([
      { workspaceId, userId: first, role: "admin" },
      { workspaceId, userId: second, role: "admin" },
    ]);
    const other = createDatabase(testDb?.url ?? "", { max: 1 });
    try {
      const results = await Promise.allSettled([
        handOver(db, workspaceId, owner, first),
        handOver(other.db, workspaceId, owner, second),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    } finally {
      await other.close();
    }
    const now = await owners(workspaceId);
    expect(now).toHaveLength(1);
    expect([first, second]).toContain(now[0]);
  });
});

describe("TC-F01-37 [AC-F01-14] one personal workspace per user (database rule)", () => {
  it(
    "TC-F01-37 [AC-F01-14] a second personal workspace for the same user is refused; company ones are not limited here",
    SLOW,
    async () => {
      const someone = await newUser("someone");
      await db.insert(workspaces).values({ name: "Personal", kind: "personal", createdBy: someone });
      await expect(
        db.insert(workspaces).values({ name: "Personal", kind: "personal", createdBy: someone }),
      ).rejects.toThrow();
      await newCompany(someone);
      await newCompany(someone);
    },
  );
});

describe("TC-F01-59 [AC-F01-17] [AC-F01-19] pending invitations and requests are unique", () => {
  it(
    "TC-F01-59 [AC-F01-17] one pending invitation per workspace and email; a cancelled one allows a new one",
    SLOW,
    async () => {
      const owner = await newUser("owner");
      const workspaceId = await newCompany(owner);
      const invite = (status: "pending" | "cancelled") => ({
        workspaceId,
        email: "new.person@example.test",
        role: "member" as const,
        tokenHash: randomUUID(),
        invitedBy: owner,
        status,
        expiresAt: new Date(Date.now() + 7 * 24 * 3_600_000),
      });
      await db.insert(invitations).values(invite("pending"));
      await expect(db.insert(invitations).values(invite("pending"))).rejects.toThrow();
      await db.execute(sql`update invitations set status = 'cancelled' where workspace_id = ${workspaceId}`);
      await expect(db.insert(invitations).values(invite("pending"))).resolves.toBeDefined();
    },
  );

  it("TC-F01-59 [AC-F01-17] an invitation can never make someone the owner", SLOW, async () => {
    const owner = await newUser("owner");
    const workspaceId = await newCompany(owner);
    await expect(
      db.execute(sql`insert into invitations (workspace_id, email, role, token_hash, invited_by, status, expires_at)
                     values (${workspaceId}, 'x@example.test', 'owner', ${randomUUID()}, ${owner}, 'pending', now())`),
    ).rejects.toThrow();
  });

  it("TC-F01-59 [AC-F01-19] one pending join request per workspace and person", SLOW, async () => {
    const owner = await newUser("owner");
    const asker = await newUser("asker");
    const workspaceId = await newCompany(owner);
    await db.insert(joinRequests).values({ workspaceId, userId: asker, via: "code", status: "pending" });
    await expect(
      db.insert(joinRequests).values({ workspaceId, userId: asker, via: "link", status: "pending" }),
    ).rejects.toThrow();
  });

  it("TC-F01-59 [AC-F01-21] a person is in a workspace at most once", SLOW, async () => {
    const owner = await newUser("owner");
    const workspaceId = await newCompany(owner);
    await expect(db.insert(workspaceMembers).values({ workspaceId, userId: owner, role: "member" })).rejects.toThrow();
  });
});

describe("TC-F01-59 [AC-F01-12] accounts and sessions", () => {
  it("TC-F01-59 [AC-F01-12] email addresses are unique and a user's sessions go with the user", SLOW, async () => {
    const id = randomUUID();
    await db.insert(user).values({ id, name: "Twin", email: "twin@example.test" });
    await expect(
      db.insert(user).values({ id: randomUUID(), name: "Twin", email: "twin@example.test" }),
    ).rejects.toThrow();
    await db.insert(session).values({ id: randomUUID(), userId: id, token: randomUUID(), expiresAt: new Date() });
    await db.execute(sql`delete from "user" where id = ${id}`);
    const left = await rowsOf<{ count: number }>(
      db,
      sql`select count(*)::int as count from session where user_id = ${id}`,
    );
    expect(left[0]?.count).toBe(0);
  });
});
