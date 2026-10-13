// `pnpm seed` and `pnpm seed:clear` with the example people (TC-F01-74; AC-F01-30, completes AC-F00-45):
// the first run adds the people, "Example team" with an owner, admin and member, and one waiting
// request; the second adds nothing; the people sign in with the published test password; clearing
// removes them and leaves everyone else alone. Own database; needs the `pnpm dev` services.
import {
  SEED_PASSWORD,
  SEED_PEOPLE,
  SEED_TEAM,
  clearSeed,
  joinRequests,
  seedDatabase,
  user,
  workspaceMembers,
  workspaces,
} from "@meetapp/db";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signIn, startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { caller, newPerson, seedWorkspace } from "../../test-support/workspaces-setup.ts";

const SLOW = { timeout: 60_000 };
let t: AuthTestApp;
beforeAll(async () => {
  t = await startAuthTestApp();
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

const emails = SEED_PEOPLE.map((person) => person.email);
const seededUsers = () => t.database.db.select().from(user).where(inArray(user.email, emails));

async function teamRoles() {
  const db = t.database.db;
  const [team] = await db.select().from(workspaces).where(eq(workspaces.name, SEED_TEAM));
  if (!team) return undefined;
  const members = await db
    .select({ email: user.email, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(user, eq(user.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, team.id));
  const requests = await db
    .select({ email: user.email, status: joinRequests.status })
    .from(joinRequests)
    .innerJoin(user, eq(user.id, joinRequests.userId))
    .where(eq(joinRequests.workspaceId, team.id));
  return { kind: team.kind, members, requests };
}

describe("seed and clear", () => {
  it("TC-F01-74 [AC-F01-30] the first run adds the people and the team; the second adds nothing", SLOW, async () => {
    expect(await seedDatabase(t.database.db)).toBeGreaterThan(0);
    expect(await seedDatabase(t.database.db)).toBe(0);
    const people = await seededUsers();
    expect(people.map((person) => person.email).sort()).toEqual([...emails].sort());
    for (const person of people) expect(person.email).toMatch(/@example\.test$/);
    const team = await teamRoles();
    expect(team?.kind).toBe("company");
    expect(team?.members).toEqual(
      expect.arrayContaining([
        { email: "owner@example.test", role: "owner" },
        { email: "admin@example.test", role: "admin" },
        { email: "member@example.test", role: "member" },
      ]),
    );
    expect(team?.members).toHaveLength(3);
    expect(team?.requests).toEqual([{ email: "asker@example.test", status: "pending" }]);
  });

  it("TC-F01-74 [AC-F01-30] an example person signs in with the test password and sees the team", SLOW, async () => {
    await seedDatabase(t.database.db);
    const token = await signIn(t.app, "owner@example.test", SEED_PASSWORD);
    const me = (await caller(t)(token, "GET", "/api/v1/me")).json<{
      workspaces: { name: string; kind: string; role: string; pendingRequests: number }[];
    }>();
    expect(me.workspaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "personal" }),
        expect.objectContaining({ name: SEED_TEAM, role: "owner", pendingRequests: 1 }),
      ]),
    );
  });

  it("TC-F01-74 [AC-F01-30, AC-F00-45] clearing removes only the example records", SLOW, async () => {
    await seedDatabase(t.database.db);
    const own = await newPerson(t, "own");
    const ownTeam = await seedWorkspace(t, [[own, "owner"]], "Real team");
    expect(await clearSeed(t.database.db)).toBeGreaterThan(0);
    expect(await seededUsers()).toHaveLength(0);
    expect(await teamRoles()).toBeUndefined();
    expect(await t.database.db.select().from(user).where(eq(user.id, own.id))).toHaveLength(1);
    expect(await t.database.db.select().from(workspaces).where(eq(workspaces.id, ownTeam))).toHaveLength(1);
    expect(await clearSeed(t.database.db)).toBe(0);
  });
});
