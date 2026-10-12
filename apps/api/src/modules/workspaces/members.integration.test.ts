// Members, roles, hand-over and leaving (F01 T11; AC-F01-21, 22, 23): the role table through the real
// routes, the all-or-nothing hand-over, and access that ends at once. Own database; needs `pnpm dev`.
import { memberRemovals, workspaceMembers } from "@meetapp/db";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import {
  caller,
  errorCode,
  newPerson,
  seedWorkspace,
  type Call,
  type Person,
  type Role,
} from "../../test-support/workspaces-setup.ts";

const SLOW = { timeout: 90_000 };
let t: AuthTestApp;
let call: Call;

beforeAll(async () => {
  t = await startAuthTestApp();
  call = caller(t);
}, 60_000);

afterAll(async () => {
  await t.close();
}, 60_000);

interface MembersBody {
  members: { userId: string; name: string; email: string; role: Role; joinedAt: string; photoUrl: string | null }[];
  yourActions: string[];
}
const list = async (who: Person, workspaceId: string) =>
  call(who.token, "GET", `/api/v1/workspaces/${workspaceId}/members`);
const rolesIn = async (workspaceId: string) =>
  Object.fromEntries(
    (await t.database.db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId))).map(
      (row) => [row.userId, row.role],
    ),
  );

async function team(...roles: Role[]) {
  const people = await Promise.all(roles.map((role, i) => newPerson(t, `${role}${String(i)}`)));
  const workspaceId = await seedWorkspace(
    t,
    people.map((person, i) => [person, roles[i] ?? "member"]),
  );
  return { people, workspaceId };
}

describe("the member list", () => {
  it(
    "TC-F01-55 [AC-F01-21] everyone sees name, email, role, joinedAt and photo of all; actions follow the role",
    SLOW,
    async () => {
      const { people, workspaceId } = await team("owner", "admin", "member");
      const [owner, admin, member] = people as [Person, Person, Person];
      const bodies = await Promise.all(
        [owner, admin, member].map(async (who) => (await list(who, workspaceId)).json<MembersBody>()),
      );
      for (const body of bodies) {
        expect(body.members).toHaveLength(3);
        for (const entry of body.members) {
          expect(entry.name).toBeTruthy();
          expect(entry.email).toContain("@");
          expect(new Date(entry.joinedAt).toISOString()).toBe(entry.joinedAt);
          expect(entry.photoUrl).toBeNull();
        }
      }
      const [forOwner, forAdmin, forMember] = bodies.map((body) => body.yourActions) as [string[], string[], string[]];
      const hidden = [
        "rename",
        "promoteMember",
        "removeMember",
        "demoteAdmin",
        "removeAdmin",
        "transfer",
        "manageJoinLink",
        "decideRequests",
        "inviteAdmin",
      ];
      for (const action of hidden) expect(forMember).not.toContain(action);
      expect(forAdmin).toContain("promoteMember");
      expect(forAdmin).not.toContain("demoteAdmin");
      expect(forAdmin).not.toContain("transfer");
      expect(forOwner).toContain("transfer");
      expect(forOwner).not.toContain("leave");
    },
  );
});

describe("roles and removal", () => {
  it("TC-F01-57 [AC-F01-21] the role table decides, the owner is untouched, removals are recorded", SLOW, async () => {
    const { people, workspaceId } = await team("owner", "admin", "admin", "member", "member");
    const [o, a1, a2, m1, m2] = people as [Person, Person, Person, Person, Person];
    const base = `/api/v1/workspaces/${workspaceId}/members`;
    const role = (who: Person, target: Person, to: string) =>
      call(who.token, "PATCH", `${base}/${target.id}`, { role: to });
    const remove = (who: Person, target: Person) => call(who.token, "DELETE", `${base}/${target.id}`);
    const status = async (pending: ReturnType<Call>) => (await pending).statusCode;
    expect(await status(role(a1, m1, "admin"))).toBe(204);
    expect(await status(role(a1, a2, "member"))).toBe(403);
    expect(await status(remove(a1, a2))).toBe(403);
    expect(await status(role(o, a2, "member"))).toBe(204);
    expect(await status(remove(a1, m2))).toBe(204);
    expect(await status(remove(a1, o))).toBe(403);
    expect(await status(role(a1, o, "member"))).toBe(403);
    expect(await status(remove(o, m1))).toBe(204);
    const removals = await t.database.db
      .select()
      .from(memberRemovals)
      .where(eq(memberRemovals.workspaceId, workspaceId));
    expect(removals.map((row) => [row.userId, row.removedBy])).toEqual(
      expect.arrayContaining([
        [m2.id, a1.id],
        [m1.id, o.id],
      ]),
    );
    expect((await rolesIn(workspaceId))[o.id]).toBe("owner");
  });

  it(
    "TC-F01-57 [AC-F01-21] a member cannot make themselves admin; unknown or malformed targets are 404",
    SLOW,
    async () => {
      const { people, workspaceId } = await team("owner", "member");
      const [o, m] = people as [Person, Person];
      const base = `/api/v1/workspaces/${workspaceId}/members`;
      expect((await call(m.token, "PATCH", `${base}/${m.id}`, { role: "admin" })).statusCode).toBe(403);
      const outsider = await newPerson(t, "not-in");
      expect((await call(o.token, "PATCH", `${base}/${outsider.id}`, { role: "admin" })).statusCode).toBe(404);
      expect((await call(o.token, "DELETE", `${base}/not-a-uuid`)).statusCode).toBe(404);
      expect((await rolesIn(workspaceId))[m.id]).toBe("member");
    },
  );
});

describe("handing over ownership", () => {
  const handOver = (who: Person, workspaceId: string, body: object) =>
    call(who.token, "POST", `/api/v1/workspaces/${workspaceId}/transfer`, body);

  it(
    "TC-F01-58 [AC-F01-22] the owner hands over; the old owner then gets 403; admins 403; non-member 404; no confirm 400",
    SLOW,
    async () => {
      const { people, workspaceId } = await team("owner", "admin", "member");
      const [o, a, m] = people as [Person, Person, Person];
      const outsider = await newPerson(t, "outsider-t");
      expect((await handOver(o, workspaceId, { userId: a.id })).statusCode).toBe(400);
      expect((await handOver(o, workspaceId, { userId: outsider.id, confirm: true })).statusCode).toBe(404);
      expect((await handOver(o, workspaceId, { userId: a.id, confirm: true })).statusCode).toBe(204);
      expect(await rolesIn(workspaceId)).toEqual({ [a.id]: "owner", [o.id]: "admin", [m.id]: "member" });
      expect((await handOver(o, workspaceId, { userId: m.id, confirm: true })).statusCode).toBe(403);
      expect((await handOver(m, workspaceId, { userId: m.id, confirm: true })).statusCode).toBe(403);
    },
  );

  it("TC-F01-58 [AC-F01-22] a failure half-way leaves the roles unchanged and one owner", SLOW, async () => {
    const { people, workspaceId } = await team("owner", "admin");
    const [o, a] = people as [Person, Person];
    const db = t.database.db;
    await db.execute(
      sql.raw(
        `create function fail_owner() returns trigger language plpgsql as $$ begin raise exception 'forced'; end $$`,
      ),
    );
    await db.execute(
      sql.raw(
        `create trigger fail_owner_trigger before update on workspace_members for each row when (NEW.role = 'owner' and NEW.user_id = '${a.id}') execute function fail_owner()`,
      ),
    );
    try {
      expect((await handOver(o, workspaceId, { userId: a.id, confirm: true })).statusCode).toBe(500);
    } finally {
      await db.execute(sql.raw("drop trigger fail_owner_trigger on workspace_members"));
      await db.execute(sql.raw("drop function fail_owner()"));
    }
    expect(await rolesIn(workspaceId)).toEqual({ [o.id]: "owner", [a.id]: "admin" });
  });
});

describe("leaving and being removed", () => {
  it("TC-F01-60 [AC-F01-23] leaving and removal cut access at once; the owner must hand over first", SLOW, async () => {
    const { people, workspaceId } = await team("owner", "admin", "member");
    const [o, a, m] = people as [Person, Person, Person];
    const base = `/api/v1/workspaces/${workspaceId}`;
    expect((await list(m, workspaceId)).statusCode).toBe(200);
    expect((await call(m.token, "POST", `${base}/leave`)).statusCode).toBe(204);
    expect((await list(m, workspaceId)).statusCode).toBe(404);
    expect((await call(o.token, "DELETE", `${base}/members/${a.id}`)).statusCode).toBe(204);
    expect((await list(a, workspaceId)).statusCode).toBe(404);
    const owner = await call(o.token, "POST", `${base}/leave`);
    expect([owner.statusCode, errorCode(owner)]).toEqual([409, "OWNER_MUST_TRANSFER"]);
    const listed = (await call(m.token, "GET", "/api/v1/me")).json<{ workspaces: { id: string }[] }>().workspaces;
    expect(listed.map((item) => item.id)).not.toContain(workspaceId);
    expect(await rolesIn(workspaceId)).toEqual({ [o.id]: "owner" });
  });
});

describe("outsiders", () => {
  it("TC-F01-38 [AC-F01-21] an outsider gets 404 on every workspace route; a malformed id too", SLOW, async () => {
    const { people, workspaceId } = await team("owner", "member");
    const [o] = people as [Person];
    const outsider = await newPerson(t, "outsider-all");
    const base = `/api/v1/workspaces/${workspaceId}`;
    const attempts: [Parameters<Call>[1], string, object?][] = [
      ["PATCH", base, { name: "Taken" }],
      ["GET", `${base}/members`],
      ["PATCH", `${base}/members/${o.id}`, { role: "member" }],
      ["DELETE", `${base}/members/${o.id}`],
      ["POST", `${base}/leave`],
      ["POST", `${base}/transfer`, { userId: outsider.id, confirm: true }],
      ["GET", "/api/v1/workspaces/not-a-uuid/members"],
    ];
    for (const [method, url, body] of attempts) {
      expect((await call(outsider.token, method, url, body)).statusCode, `${method} ${url}`).toBe(404);
    }
    expect(await rolesIn(workspaceId)).toHaveProperty(o.id, "owner");
  });
});
