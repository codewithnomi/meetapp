// Company workspaces and the personal one (F01 T11; AC-F01-14, 15): creating, names, the 20-workspace
// limit, double submit and the personal workspace's rules. Own database; needs the `pnpm dev` services.
import { workspaces } from "@meetapp/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bearer, startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import {
  caller,
  errorCode,
  newPerson,
  seedWorkspace,
  type Call,
  type Person,
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

const create = (who: Person, name: string, key?: string) =>
  t.app.inject({
    method: "POST",
    url: "/api/v1/workspaces",
    payload: { name },
    headers: { origin: "app://meetapp", ...bearer(who.token), ...(key ? { "idempotency-key": key } : {}) },
  });
const mine = async (who: Person) =>
  (await call(who.token, "GET", "/api/v1/me")).json<{ workspaces: { id: string; name: string; kind: string }[] }>()
    .workspaces;
const ownedCompany = async (who: Person) =>
  (await t.database.db.select().from(workspaces).where(eq(workspaces.createdBy, who.id))).filter(
    (row) => row.kind === "company",
  );

/** Gives the person 'count' company workspaces they own, straight in the database. */
async function ownMany(who: Person, count: number) {
  for (let i = 0; i < count; i++) await seedWorkspace(t, [[who, "owner"]], `Own ${String(i)}`);
}

async function personalOf(who: Person): Promise<string> {
  const found = (await mine(who)).find((item) => item.kind === "personal");
  if (!found) throw new Error("no personal workspace");
  return found.id;
}

describe("creating a company workspace", () => {
  it("TC-F01-39 [AC-F01-15] names of 1 and 61 characters are refused, 2 and 60 work", SLOW, async () => {
    const me = await newPerson(t, "names");
    expect((await create(me, "A")).statusCode).toBe(400);
    expect((await create(me, "x".repeat(61))).statusCode).toBe(400);
    expect((await create(me, "AB")).statusCode).toBe(201);
    expect((await create(me, "y".repeat(60))).statusCode).toBe(201);
  });

  it("TC-F01-39 [AC-F01-15] two 'Same' workspaces, creator is owner, switchTo, listed in /me", SLOW, async () => {
    const me = await newPerson(t, "same");
    const first = (await create(me, "Same")).json<{ workspace: { id: string; role: string }; switchTo: string }>();
    const second = (await create(me, "Same")).json<{ workspace: { id: string; role: string }; switchTo: string }>();
    expect(first.workspace.id).not.toBe(second.workspace.id);
    expect([first.workspace.role, second.workspace.role]).toEqual(["owner", "owner"]);
    expect(first.switchTo).toBe(first.workspace.id);
    const listed = await mine(me);
    expect(listed[0]?.kind).toBe("personal");
    expect(listed.map((item) => item.id)).toEqual(expect.arrayContaining([first.workspace.id, second.workspace.id]));
  });
});

describe("the limit and double submit", () => {
  it("TC-F01-40 [AC-F01-15] the 20th works, the 21st is refused WORKSPACE_LIMIT", SLOW, async () => {
    const me = await newPerson(t, "limit");
    await ownMany(me, 19);
    expect((await create(me, "Twentieth")).statusCode).toBe(201);
    const refused = await create(me, "Twenty one");
    expect([refused.statusCode, errorCode(refused)]).toEqual([409, "WORKSPACE_LIMIT"]);
  });

  it("TC-F01-40 [AC-F01-29] the same Idempotency-Key twice creates one workspace", SLOW, async () => {
    const me = await newPerson(t, "idem");
    const first = await create(me, "Once", "key-12345678");
    const again = await create(me, "Once", "key-12345678");
    expect([first.statusCode, again.statusCode]).toEqual([201, 201]);
    expect(again.json()).toEqual(first.json());
    expect(await ownedCompany(me)).toHaveLength(1);
  });

  it("TC-F01-40 [AC-F01-29] the same key in parallel gives identical bodies and one workspace", SLOW, async () => {
    const me = await newPerson(t, "parallel");
    const results = await Promise.all([1, 2, 3].map(() => create(me, "Race", "race-key-1234")));
    const bodies = results.map((result) => result.json());
    expect(new Set(results.map((result) => result.statusCode))).toEqual(new Set([201]));
    expect(bodies[1]).toEqual(bodies[0]);
    expect(bodies[2]).toEqual(bodies[0]);
    expect(await ownedCompany(me)).toHaveLength(1);
  });

  const transfer = (who: Person, workspaceId: string, to: Person) =>
    call(who.token, "POST", `/api/v1/workspaces/${workspaceId}/transfer`, { userId: to.id, confirm: true });

  it("TC-F01-40 [AC-F01-15] a hand-over to someone at the limit is refused WORKSPACE_LIMIT", SLOW, async () => {
    const [full, giver] = [await newPerson(t, "full"), await newPerson(t, "giver")];
    await ownMany(full, 20);
    const shared = await seedWorkspace(t, [
      [giver, "owner"],
      [full, "admin"],
    ]);
    const blocked = await transfer(giver, shared, full);
    expect([blocked.statusCode, errorCode(blocked)]).toEqual([409, "WORKSPACE_LIMIT"]);
  });

  it("TC-F01-40 [AC-F01-15] handing a workspace over frees a place for the old owner", SLOW, async () => {
    const [giver, taker] = [await newPerson(t, "giver2"), await newPerson(t, "taker")];
    await ownMany(giver, 19);
    const shared = await seedWorkspace(t, [
      [giver, "owner"],
      [taker, "member"],
    ]);
    expect((await create(giver, "No room")).statusCode).toBe(409);
    expect((await transfer(giver, shared, taker)).statusCode).toBe(204);
    expect((await create(giver, "Room again")).statusCode).toBe(201);
  });
});

describe("the personal workspace", () => {
  it(
    "TC-F01-38 [AC-F01-14] rename, leave, hand over, role change and removal are 409 and change nothing",
    SLOW,
    async () => {
      const me = await newPerson(t, "personal");
      const other = await newPerson(t, "personal-other");
      const base = `/api/v1/workspaces/${await personalOf(me)}`;
      const answers = [
        await call(me.token, "PATCH", base, { name: "Renamed" }),
        await call(me.token, "POST", `${base}/leave`),
        await call(me.token, "POST", `${base}/transfer`, { userId: other.id, confirm: true }),
        await call(me.token, "PATCH", `${base}/members/${me.id}`, { role: "member" }),
        await call(me.token, "DELETE", `${base}/members/${me.id}`),
      ];
      expect(answers.map((a) => [a.statusCode, errorCode(a)])).toEqual(Array(5).fill([409, "PERSONAL_WORKSPACE"]));
      const after = (await mine(me)).find((item) => item.kind === "personal");
      expect(after?.name).toBe("Personal");
      expect((await call(me.token, "GET", `${base}/members`)).json<{ members: unknown[] }>().members).toHaveLength(1);
    },
  );

  it("TC-F01-38 [AC-F01-14] an outsider gets 404 on someone's personal workspace", SLOW, async () => {
    const me = await newPerson(t, "owner-p");
    const outsider = await newPerson(t, "outsider-p");
    const base = `/api/v1/workspaces/${await personalOf(me)}`;
    const answers = [
      await call(outsider.token, "GET", `${base}/members`),
      await call(outsider.token, "POST", `${base}/leave`),
      await call(outsider.token, "PATCH", base, { name: "Mine now" }),
    ];
    expect(answers.map((a) => a.statusCode)).toEqual([404, 404, 404]);
  });

  it("TC-F01-38 [AC-F01-14] the database refuses a second personal workspace for one user", SLOW, async () => {
    const me = await newPerson(t, "twice");
    await personalOf(me);
    const second = t.database.db.insert(workspaces).values({ name: "Personal", kind: "personal", createdBy: me.id });
    await expect(second).rejects.toThrow();
  });

  it.todo("TC-F01-38 [AC-F01-14] invitations to a personal workspace are 409 PERSONAL_WORKSPACE (T12)");
  it.todo("TC-F01-38 [AC-F01-14] join link, code and join requests on a personal workspace are refused (T13)");
});
