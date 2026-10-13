// Last-used workspace and fallback (TC-F01-42, AC-F01-16). Own database; needs the `pnpm dev` services.
import { randomUUID } from "node:crypto";
import { user } from "@meetapp/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
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

interface Me {
  currentWorkspaceId: string | null;
  workspaces: { id: string; kind: string }[];
}
const me = async (who: Person) => (await call(who.token, "GET", "/api/v1/me")).json<Me>();
const personalOf = async (who: Person) => (await me(who)).workspaces.find((w) => w.kind === "personal")?.id;
const switchTo = (who: Person, workspaceId: string) =>
  call(who.token, "PUT", "/api/v1/me/last-workspace", { workspaceId });

describe("last-used workspace (TC-F01-42)", () => {
  it("TC-F01-42 [AC-F01-16] a workspace saved by switching is the one opened next", async () => {
    const owner = await newPerson(t, "lw-owner");
    const company = await seedWorkspace(t, [[owner, "owner"]]);
    expect((await switchTo(owner, company)).statusCode).toBe(204);
    expect((await me(owner)).currentWorkspaceId).toBe(company);
  });

  it("TC-F01-42 [AC-F01-16] a new account opens on Personal", async () => {
    const person = await newPerson(t, "lw-new");
    expect((await me(person)).currentWorkspaceId).toBe(await personalOf(person));
  });

  it("TC-F01-42 [AC-F01-16] after the person is removed from that workspace Personal opens", async () => {
    const owner = await newPerson(t, "lw-rm-owner");
    const member = await newPerson(t, "lw-rm-member");
    const company = await seedWorkspace(t, [
      [owner, "owner"],
      [member, "member"],
    ]);
    await switchTo(member, company);
    expect((await me(member)).currentWorkspaceId).toBe(company);
    const removed = await call(owner.token, "DELETE", `/api/v1/workspaces/${company}/members/${member.id}`);
    expect(removed.statusCode).toBe(204);
    expect((await me(member)).currentWorkspaceId).toBe(await personalOf(member));
  });

  it("TC-F01-42 [AC-F01-16] when the saved id points to a workspace that does not exist Personal opens", async () => {
    const person = await newPerson(t, "lw-gone");
    await t.database.db.update(user).set({ lastWorkspaceId: randomUUID() }).where(eq(user.id, person.id));
    expect((await me(person)).currentWorkspaceId).toBe(await personalOf(person));
  });

  it("TC-F01-42 [AC-F01-16] cannot save a workspace they are not in (404), and nothing changes", async () => {
    const outsider = await newPerson(t, "lw-out");
    const owner = await newPerson(t, "lw-other-owner");
    const company = await seedWorkspace(t, [[owner, "owner"]]);
    expect((await switchTo(outsider, company)).statusCode).toBe(404);
    expect((await me(outsider)).currentWorkspaceId).toBe(await personalOf(outsider));
  });

  it("TC-F01-42 [AC-F01-16] a random id is refused with 404", async () => {
    const person = await newPerson(t, "lw-random");
    expect((await switchTo(person, randomUUID())).statusCode).toBe(404);
  });
});
