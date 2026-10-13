// The invited person's side (F01 T12; AC-F01-18, 35): list, accept, decline, the wrong person, and the
// public web page. Own database; needs the `pnpm dev` services.
import { user, workspaceMembers } from "@meetapp/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, testEmail, type AuthTestApp } from "../../test-support/auth-app.ts";
import { expire, invite, invitationId, setUserName, tokenFromEmail } from "../../test-support/invitations-setup.ts";
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

interface Mine {
  id: string;
  workspace: { id: string; name: string };
  inviterName: string | null;
  role: string;
}
const mine = async (who: Person) =>
  (await call(who.token, "GET", "/api/v1/me/invitations")).json<{ invitations: Mine[] }>().invitations;
const act = (who: Person, id: string, verb: "accept" | "decline") =>
  call(who.token, "POST", `/api/v1/invitations/${id}/${verb}`);
const rolesIn = async (workspaceId: string) =>
  Object.fromEntries(
    (await t.database.db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId))).map(
      (row) => [row.userId, row.role],
    ),
  );

async function setup(name = "Team") {
  const o = await newPerson(t, "owner");
  const a = await newPerson(t, "admin");
  const g = await newPerson(t, "guest");
  const workspaceId = await seedWorkspace(
    t,
    [
      [o, "owner"],
      [a, "admin"],
    ],
    name,
  );
  const send = async (role: "admin" | "member" = "member", sender = o) =>
    invitationId(await invite(call, sender, workspaceId, { email: g.email, role: role }));
  return { owner: o, admin: a, guest: g, workspaceId, send };
}

describe("my invitations, accept and decline", () => {
  it(
    "TC-F01-45 [AC-F01-18] the list shows workspace and inviter; accepting joins with the invited role",
    SLOW,
    async () => {
      const { guest, workspaceId, send } = await setup("Acme");
      const id = await send("admin");
      const [entry] = await mine(guest);
      expect(entry).toMatchObject({
        id,
        workspace: { id: workspaceId, name: "Acme" },
        inviterName: "Test Person",
        role: "admin",
      });
      const accepted = await act(guest, id, "accept");
      expect(accepted.statusCode).toBe(200);
      expect(accepted.json()).toMatchObject({
        workspace: { id: workspaceId, name: "Acme", kind: "company", role: "admin" },
        switchTo: workspaceId,
      });
      expect((await rolesIn(workspaceId))[guest.id]).toBe("admin");
      expect(await mine(guest)).toHaveLength(0);
      expect((await act(guest, id, "accept")).statusCode).toBe(410);
    },
  );

  it("TC-F01-45 [AC-F01-18] a declined invitation leaves the list and answers 410", SLOW, async () => {
    const { guest, workspaceId, send } = await setup();
    const id = await send();
    expect((await act(guest, id, "decline")).statusCode).toBe(204);
    expect(await mine(guest)).toHaveLength(0);
    expect(errorCode(await act(guest, id, "accept"))).toBe("INVITATION_GONE");
    expect((await act(guest, id, "decline")).statusCode).toBe(410);
    expect(await rolesIn(workspaceId)).not.toHaveProperty(guest.id);
  });

  it(
    "TC-F01-45 [AC-F01-18] cancelled, replaced and expired invitations are not listed and answer 410",
    SLOW,
    async () => {
      const { owner, guest, workspaceId, send } = await setup();
      const cancelled = await send();
      await call(owner.token, "DELETE", `/api/v1/workspaces/${workspaceId}/invitations/${cancelled}`);
      const replaced = await send();
      const current = await send();
      expect(await mine(guest)).toHaveLength(1);
      await expire(t, current);
      expect(await mine(guest)).toHaveLength(0);
      for (const id of [cancelled, replaced, current]) {
        const answer = await act(guest, id, "accept");
        expect([answer.statusCode, errorCode(answer)]).toEqual([410, "INVITATION_GONE"]);
      }
      expect(await rolesIn(workspaceId)).not.toHaveProperty(guest.id);
    },
  );

  it(
    "TC-F01-45 [AC-F01-18] an admin invitation whose sender is no longer owner or admin joins as member",
    SLOW,
    async () => {
      const { admin, guest, workspaceId, send } = await setup();
      const id = await send("admin", admin);
      await t.database.db.update(workspaceMembers).set({ role: "member" }).where(eq(workspaceMembers.userId, admin.id));
      const accepted = await act(guest, id, "accept");
      expect(accepted.json<{ workspace: { role: string } }>().workspace.role).toBe("member");
      expect((await rolesIn(workspaceId))[guest.id]).toBe("member");
    },
  );
});

describe("only the invited email", () => {
  it(
    "TC-F01-46 [AC-F01-18] another signed-in user can't see, accept or decline it; nothing is added",
    SLOW,
    async () => {
      const { guest, workspaceId, send } = await setup();
      const id = await send();
      const stranger = await newPerson(t, "stranger");
      expect(await mine(stranger)).toEqual([]);
      expect((await act(stranger, id, "accept")).statusCode).toBe(404);
      expect((await act(stranger, id, "decline")).statusCode).toBe(404);
      expect(await rolesIn(workspaceId)).not.toHaveProperty(stranger.id);
      expect(await mine(guest)).toHaveLength(1);
    },
  );

  it("TC-F01-46 [AC-F01-18] an account whose email is not verified can't see or accept it", SLOW, async () => {
    const { guest, workspaceId, send } = await setup();
    const id = await send();
    await t.database.db.update(user).set({ emailVerified: false }).where(eq(user.id, guest.id));
    expect(await mine(guest)).toEqual([]);
    expect((await act(guest, id, "accept")).statusCode).toBe(404);
    expect(await rolesIn(workspaceId)).not.toHaveProperty(guest.id);
  });

  it("TC-F01-46 [AC-F01-18] the routes need a signed-in user", SLOW, async () => {
    const { send } = await setup();
    const id = await send();
    const headers = { origin: "app://meetapp" };
    const answers = await Promise.all([
      t.app.inject({ method: "GET", url: "/api/v1/me/invitations", headers }),
      t.app.inject({ method: "POST", url: `/api/v1/invitations/${id}/accept`, headers }),
    ]);
    expect(answers.map((a) => a.statusCode)).toEqual([401, 401]);
  });
});

describe("the web page", () => {
  const open = (token: string) => t.app.inject({ method: "GET", url: `/invite/${token}` });

  it(
    "TC-F01-47 [AC-F01-18] a valid link shows names and the masked email, with safe headers and no forms",
    SLOW,
    async () => {
      const { guest, send } = await setup("Acme Ltd");
      await send();
      const response = await open(await tokenFromEmail(guest.email, new Date(0)));
      expect(response.statusCode).toBe(200);
      expect(response.body).toContain("Acme Ltd");
      expect(response.body).toContain("Test Person");
      expect(response.body).toContain(`${guest.email.slice(0, 1)}***@example.test`);
      expect(response.body).not.toContain(guest.email);
      expect(response.body).not.toMatch(/<form|<input|<script/i);
      expect(response.headers["cache-control"]).toContain("no-store");
      expect(response.headers["referrer-policy"]).toBe("no-referrer");
      expect(response.headers["x-robots-tag"]).toContain("noindex");
      const csp = String(response.headers["content-security-policy"]);
      expect(csp).not.toContain("unsafe-inline");
      expect(csp).not.toMatch(/script-src[^;]*(https?:|\*|'self')/);
    },
  );

  it("TC-F01-47 [AC-F01-35] names are escaped on the page", SLOW, async () => {
    const hostile = "<img src=x onerror=alert(1)>";
    const { owner, guest, send } = await setup(hostile);
    await setUserName(t, owner.id, hostile);
    await send();
    const response = await open(await tokenFromEmail(guest.email, new Date(0)));
    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain(hostile);
    expect(response.body).not.toContain("<img");
  });

  it(
    "TC-F01-47 [AC-F01-18] cancelled, expired, replaced and random links all answer 404 with the same body",
    SLOW,
    async () => {
      const { owner, workspaceId } = await setup();
      const linkFor = async (label: string) => {
        const email = testEmail(label);
        const id = invitationId(await invite(call, owner, workspaceId, { email: email }));
        return { id, email, token: await tokenFromEmail(email, new Date(0)) };
      };
      const cancelled = await linkFor("cancelled");
      await call(owner.token, "DELETE", `/api/v1/workspaces/${workspaceId}/invitations/${cancelled.id}`);
      const expired = await linkFor("expired");
      await expire(t, expired.id);
      const replaced = await linkFor("replaced");
      await invite(call, owner, workspaceId, { email: replaced.email });
      const tokens = [cancelled.token, expired.token, replaced.token, "random-token-123", "a".repeat(43)];
      const answers = await Promise.all(tokens.map((token) => open(token)));
      expect(answers.map((r) => r.statusCode)).toEqual([404, 404, 404, 404, 404]);
      expect(new Set(answers.map((r) => r.body)).size).toBe(1);
      expect(answers[0]?.body).toContain("no longer valid");
      expect(answers[0]?.headers["cache-control"]).toContain("no-store");
    },
  );
});
