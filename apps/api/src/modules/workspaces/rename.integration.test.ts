// Renaming a workspace (TC-F01-62, AC-F01-24) through the real route: the owner and admins may, with
// 2–60 characters after trimming; a member is refused; the next /me of every member shows the new
// name (the app asks every 30 seconds, so within a minute). Own database; needs the `pnpm dev` services.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import {
  caller,
  errorCode,
  newPerson,
  seedWorkspace,
  type Call,
  type Person,
} from "../../test-support/workspaces-setup.ts";

let t: AuthTestApp;
let call: Call;
beforeAll(async () => {
  t = await startAuthTestApp();
  call = caller(t);
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

const rename = (who: Person, workspaceId: string, name: string) =>
  call(who.token, "PATCH", `/api/v1/workspaces/${workspaceId}`, { name });
const nameSeenBy = async (who: Person, workspaceId: string) =>
  (await call(who.token, "GET", "/api/v1/me"))
    .json<{ workspaces: { id: string; name: string }[] }>()
    .workspaces.find((workspace) => workspace.id === workspaceId)?.name;

describe("rename a workspace", () => {
  it("TC-F01-62 [AC-F01-24] the owner and an admin rename it (trimmed); every member's next /me shows the name", async () => {
    const [owner, admin, member] = await Promise.all([
      newPerson(t, "rename-owner"),
      newPerson(t, "rename-admin"),
      newPerson(t, "rename-member"),
    ]);
    const workspaceId = await seedWorkspace(
      t,
      [
        [owner, "owner"],
        [admin, "admin"],
        [member, "member"],
      ],
      "Old name",
    );
    expect((await rename(owner, workspaceId, "  Owner's name  ")).statusCode).toBe(204);
    expect(await nameSeenBy(member, workspaceId)).toBe("Owner's name");
    expect((await rename(admin, workspaceId, "Admin's name")).statusCode).toBe(204);
    for (const who of [owner, admin, member]) expect(await nameSeenBy(who, workspaceId)).toBe("Admin's name");
  });

  it("TC-F01-62 [AC-F01-24, AC-F01-32] a member is refused (403); 1 or 61 characters are refused (400); nothing changes", async () => {
    const [owner, member] = await Promise.all([newPerson(t, "rename-o2"), newPerson(t, "rename-m2")]);
    const workspaceId = await seedWorkspace(
      t,
      [
        [owner, "owner"],
        [member, "member"],
      ],
      "Kept name",
    );
    const byMember = await rename(member, workspaceId, "Hijacked");
    expect(byMember.statusCode).toBe(403);
    expect(errorCode(byMember)).toBe("FORBIDDEN");
    for (const name of ["X", "  Y  ", "z".repeat(61)]) {
      const refused = await rename(owner, workspaceId, name);
      expect(refused.statusCode, name).toBe(400);
    }
    expect((await rename(owner, workspaceId, "z".repeat(60))).statusCode).toBe(204);
    expect(await nameSeenBy(member, workspaceId)).toBe("z".repeat(60));
  });
});
