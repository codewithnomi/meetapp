// Finding people for New chat and inviting people without MeetApp (F14 design.md 2.2, 5; AC-F14-07, 08,
// 31; D063): name suggestions come from the open workspace only, an exact email finds one account and is
// limited, and the "Join me on MeetApp" email goes out only when asked for, 20 a day.
import { user, workspaceMembers, workspaces } from "@meetapp/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, testEmail, type AuthTestApp } from "../../test-support/auth-app.ts";
import { countEmails, waitForEmail } from "../../test-support/mailpit.ts";
import { caller, newPerson, seedWorkspace, type Call, type Person } from "../../test-support/workspaces-setup.ts";

let t: AuthTestApp;
let call: Call;
beforeAll(async () => {
  t = await startAuthTestApp();
  call = caller(t);
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

interface Found {
  people: { userId: string; name: string; photoUrl: string | null; external: boolean }[];
  noAccount: boolean;
}

const find = (person: Person, workspaceId: string, q: string) =>
  call(person.token, "GET", `/api/v1/workspaces/${workspaceId}/people?q=${encodeURIComponent(q)}`);
const found = async (person: Person, workspaceId: string, q: string) =>
  (await find(person, workspaceId, q)).json<Found>();

async function named(label: string, name: string) {
  const person = await newPerson(t, label);
  await t.database.db.update(user).set({ name }).where(eq(user.id, person.id));
  return person;
}

async function personalOf(person: Person) {
  const [row] = await t.database.db
    .insert(workspaces)
    .values({ name: "Personal", kind: "personal", createdBy: person.id })
    .returning({ id: workspaces.id });
  if (!row) throw new Error("no personal workspace");
  await t.database.db.insert(workspaceMembers).values({ workspaceId: row.id, userId: person.id, role: "owner" });
  return row.id;
}

describe("finding people", { timeout: 60_000 }, () => {
  it("TC-F14-11 [AC-F14-07] a name finds the workspace's members only; outsiders and other workspaces never appear", async () => {
    const m1 = await named("p-m1", "Maya First");
    const m2 = await named("p-m2", "Desmond Second");
    const m3 = await named("p-m3", "Destiny Third");
    const outsider = await named("p-e1", "Desiree Outside");
    const w1 = await seedWorkspace(t, [
      [m1, "owner"],
      [m2, "member"],
      [m3, "member"],
    ]);
    await seedWorkspace(t, [[outsider, "owner"]]);

    const des = await found(m1, w1, "des");
    expect(des.people.map((p) => p.name).sort()).toEqual(["Desmond Second", "Destiny Third"]);
    expect(des.people.every((p) => !p.external)).toBe(true);
    expect((await found(m1, w1, "desmond")).people.map((p) => p.userId)).toEqual([m2.id]);
    expect((await found(m1, w1, "maya")).people).toEqual([]); // not yourself
    // The job title is not shown: F01 accounts have no title (tests.md note).
    const answer = await find(outsider, w1, "des");
    expect(answer.statusCode).toBe(404);
  });

  it("TC-F14-14 [AC-F14-08, AC-F14-31] partial emails find nothing; an exact email finds that one account; 30 a minute", async () => {
    const m1 = await named("p-s1", "Searcher One");
    const other = await named("p-s2", "Exact Match");
    const w1 = await seedWorkspace(t, [[m1, "owner"]]);
    const domain = other.email.split("@")[1] ?? "";

    for (const partial of [other.email.slice(0, 4), `@${domain}`, "a*"]) {
      expect((await found(m1, w1, partial)).people).toEqual([]);
    }
    const exact = await found(m1, w1, other.email.toUpperCase());
    expect(exact).toEqual({
      people: [{ userId: other.id, name: "Exact Match", photoUrl: null, external: true, status: null }],
      noAccount: false,
    });
    expect(JSON.stringify(exact)).not.toContain("@");

    // One exact lookup used above; 29 more fill the minute, the next is refused.
    for (let i = 0; i < 29; i += 1) expect((await find(m1, w1, other.email)).statusCode).toBe(200);
    const refused = await find(m1, w1, other.email);
    expect(refused.statusCode).toBe(429);
    // Name searches are not counted against the email limit.
    expect((await find(m1, w1, "exact")).statusCode).toBe(200);
  });
});

describe("inviting people without an account", { timeout: 60_000 }, () => {
  it("TC-F14-13 [AC-F14-08] the lookup sends nothing; the Personal invite sends one email; the 21st in a day is refused", async () => {
    const m1 = await named("p-i1", "Inviting Person");
    const w1 = await seedWorkspace(t, [[m1, "owner"]]);
    await personalOf(m1);
    const nobody = testEmail("p-nobody");
    const since = new Date();

    expect(await found(m1, w1, nobody)).toEqual({ people: [], noAccount: true });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await countEmails(nobody, since)).toBe(0);

    const sent = await call(m1.token, "POST", "/api/v1/me/invitations", { email: nobody });
    expect(sent.statusCode).toBe(204);
    const email = await waitForEmail(nobody, { since });
    expect(email.Subject).toMatch(/Inviting Person/);

    for (let i = 0; i < 19; i += 1) {
      const more = await call(m1.token, "POST", "/api/v1/me/invitations", { email: testEmail("p-more") });
      expect(more.statusCode).toBe(204);
    }
    const refused = await call(m1.token, "POST", "/api/v1/me/invitations", { email: testEmail("p-late") });
    expect(refused.statusCode).toBe(429);
  });
});
