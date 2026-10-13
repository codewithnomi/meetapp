// Example people for local development (F01 design.md "Seed data", AC-F01-30): an owner, an admin and a
// member of the company workspace "Example team", and one person whose request to join it is waiting.
// Every email ends in @example.test (a domain reserved for tests); there is no real personal data. All
// of them sign in with the published local test password (docs/runbooks/local-development.md).
import { eq, inArray } from "drizzle-orm";
import type { Database } from "./connection.ts";
import { account, joinRequests, user, workspaceMembers, workspaces } from "./schema.ts";

export const SEED_PASSWORD = "meetapp-dev-password";
/** SEED_PASSWORD hashed by Better Auth's own hasher (scrypt), so Better Auth accepts it at sign-in. */
const SEED_PASSWORD_HASH =
  "d2770ec1c0edb3d4e2bb9876ffa480e8:c3ba076a597a807e5f8d7546c683a269d1b253340d32ae253e313cb6af90382762122d6386421c8a806d2cccd58a590c05f8601b853f5af7a7b17ad204fa3409";

export const SEED_TEAM = "Example team";
export const SEED_PEOPLE = [
  { email: "owner@example.test", name: "Example Owner", role: "owner" },
  { email: "admin@example.test", name: "Example Admin", role: "admin" },
  { email: "member@example.test", name: "Example Member", role: "member" },
  { email: "asker@example.test", name: "Example Asker", role: null },
] as const;
const SEED_EMAILS = SEED_PEOPLE.map((person) => person.email);

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** The user, their password login and their personal workspace. Returns the new user's id. */
async function addPerson(tx: Tx, person: (typeof SEED_PEOPLE)[number], at: Date): Promise<string> {
  const [created] = await tx
    .insert(user)
    .values({
      email: person.email,
      name: person.name,
      emailVerified: true,
      termsVersion: "seed",
      termsAcceptedAt: at,
      ageConfirmedAt: at,
    })
    .returning({ id: user.id });
  if (!created) throw new Error(`seed user ${person.email} was not created`);
  await tx
    .insert(account)
    .values({ userId: created.id, providerId: "credential", accountId: created.id, password: SEED_PASSWORD_HASH });
  const [personal] = await tx
    .insert(workspaces)
    .values({ name: person.name, kind: "personal", createdBy: created.id })
    .returning({ id: workspaces.id });
  if (personal)
    await tx.insert(workspaceMembers).values({ workspaceId: personal.id, userId: created.id, role: "owner" });
  return created.id;
}

/** "Example team" with its owner, admin and member, and the asker's waiting request. */
async function addTeam(tx: Tx, ids: Map<string, string>): Promise<void> {
  const ownerId = ids.get("owner@example.test") ?? "";
  const [team] = await tx
    .insert(workspaces)
    .values({ name: SEED_TEAM, kind: "company", createdBy: ownerId })
    .returning({ id: workspaces.id });
  if (!team) throw new Error("seed workspace was not created");
  const members = SEED_PEOPLE.flatMap((person) =>
    person.role === null ? [] : [{ workspaceId: team.id, userId: ids.get(person.email) ?? "", role: person.role }],
  );
  await tx.insert(workspaceMembers).values(members);
  await tx
    .insert(joinRequests)
    .values({ workspaceId: team.id, userId: ids.get("asker@example.test") ?? "", via: "code" });
}

/** Adds the example people and team once; returns how many records were added (0 the second time). */
export function seedPeople(db: Database, at: Date = new Date()): Promise<number> {
  return db.transaction(async (tx) => {
    const existing = await tx.select({ id: user.id }).from(user).where(inArray(user.email, SEED_EMAILS));
    if (existing.length > 0) return 0;
    const ids = new Map<string, string>();
    for (const person of SEED_PEOPLE) ids.set(person.email, await addPerson(tx, person, at));
    await addTeam(tx, ids);
    // Per person: user, login, personal workspace and membership; then the team, 3 members, 1 request.
    return SEED_PEOPLE.length * 4 + 1 + 3 + 1;
  });
}

/** Removes the example people, their workspaces and everything that hangs on them; nothing else. */
export function clearPeople(db: Database): Promise<number> {
  return db.transaction(async (tx) => {
    const people = await tx.select({ id: user.id }).from(user).where(inArray(user.email, SEED_EMAILS));
    if (people.length === 0) return 0;
    const ids = people.map((person) => person.id);
    const spaces = await tx
      .delete(workspaces)
      .where(inArray(workspaces.createdBy, ids))
      .returning({ id: workspaces.id });
    for (const id of ids) await tx.delete(user).where(eq(user.id, id));
    return people.length + spaces.length;
  });
}
