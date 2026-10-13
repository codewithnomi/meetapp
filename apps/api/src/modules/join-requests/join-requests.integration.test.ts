// Asking to join and the owner's or an admin's decision (F01 T13; AC-F01-19, 20). Own database; needs
// the `pnpm dev` services (Mailpit is read for the emails).
import { workspaceMembers } from "@meetapp/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { invitationId, invite } from "../../test-support/invitations-setup.ts";
import {
  ask,
  decide,
  lookup,
  makeOld,
  membershipRows,
  requestRows,
  requestsOf,
  turnOn,
} from "../../test-support/join-setup.ts";
import { countEmails, readEmail, waitForEmail } from "../../test-support/mailpit.ts";
import { caller, errorCode, newPerson, seedWorkspace, type Call } from "../../test-support/workspaces-setup.ts";

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

async function setup() {
  const owner = await newPerson(t, "owner");
  const admin = await newPerson(t, "admin");
  const member = await newPerson(t, "member");
  const guest = await newPerson(t, "guest");
  const workspaceId = await seedWorkspace(
    t,
    [
      [owner, "owner"],
      [admin, "admin"],
      [member, "member"],
    ],
    "Acme",
  );
  const on = await turnOn(call, owner, workspaceId);
  return { owner, admin, member, guest, workspaceId, link: on.link ?? "", code: on.code ?? "" };
}

const pendingCounts = async (who: { token: string }, workspaceId: string) => {
  const me = await call(who.token, "GET", "/api/v1/me");
  const list = me.json<{ workspaces: { id: string; pendingRequests: number }[] }>().workspaces;
  return list.find((workspace) => workspace.id === workspaceId)?.pendingRequests;
};

describe("asking and deciding", () => {
  it("TC-F01-50 [AC-F01-19] lookup then request; a pending request shows up with counts and emails", SLOW, async () => {
    const { owner, admin, member, guest, workspaceId, link } = await setup();
    const found = await lookup(call, guest, link);
    expect(found.json()).toEqual({ name: "Acme", memberCount: 3, alreadyMember: false });
    const since = new Date();
    const sent = await ask(call, guest, link);
    expect(sent.statusCode).toBe(201);
    expect(sent.json()).toEqual({ status: "pending" });
    const [entry] = await requestsOf(call, owner, workspaceId);
    expect(entry).toMatchObject({ person: { email: guest.email }, via: "link", status: "pending" });
    expect(await pendingCounts(owner, workspaceId)).toBe(1);
    expect(await pendingCounts(admin, workspaceId)).toBe(1);
    expect(await pendingCounts(member, workspaceId)).toBe(0);
    for (const manager of [owner, admin]) {
      const mail = await waitForEmail(manager.email, { since, subject: /asked to join/i });
      expect((await readEmail(mail.ID)).Text).toContain(guest.email);
    }
    expect(await countEmails(member.email, since)).toBe(0);
  });

  it("TC-F01-50 [AC-F01-19] a second request while one waits is 409 and keeps one row", SLOW, async () => {
    const { guest, workspaceId, code } = await setup();
    expect((await ask(call, guest, code)).statusCode).toBe(201);
    const again = await ask(call, guest, code);
    expect(again.statusCode).toBe(409);
    expect(errorCode(again)).toBe("PENDING_REQUEST");
    expect(await requestRows(t, workspaceId, guest.id)).toHaveLength(1);
  });

  it("TC-F01-50 [AC-F01-19] approving adds the member and tells them; the count drops", SLOW, async () => {
    const { owner, admin, guest, workspaceId, code } = await setup();
    await ask(call, guest, code.toLowerCase());
    const [entry] = await requestsOf(call, admin, workspaceId);
    expect(entry?.via).toBe("code");
    const since = new Date();
    expect((await decide(call, admin, [workspaceId, entry?.id ?? ""], "approve")).statusCode).toBe(204);
    const [row] = await membershipRows(t, workspaceId, guest.id);
    expect(row?.role).toBe("member");
    const mail = await waitForEmail(guest.email, { since, subject: /you're in/i });
    expect(mail.Subject).toContain("Acme");
    expect(await pendingCounts(owner, workspaceId)).toBe(0);
    expect(await requestsOf(call, owner, workspaceId)).toHaveLength(0);
    expect((await call(guest.token, "GET", `/api/v1/workspaces/${workspaceId}/members`)).statusCode).toBe(200);
  });

  it("TC-F01-50 [AC-F01-19] rejecting adds nobody and tells the person", SLOW, async () => {
    const { owner, guest, workspaceId, link } = await setup();
    await ask(call, guest, link);
    const [entry] = await requestsOf(call, owner, workspaceId);
    const since = new Date();
    expect((await decide(call, owner, [workspaceId, entry?.id ?? ""], "reject")).statusCode).toBe(204);
    expect(await membershipRows(t, workspaceId, guest.id)).toHaveLength(0);
    await waitForEmail(guest.email, { since, subject: /not approved/i });
    expect((await call(guest.token, "GET", `/api/v1/workspaces/${workspaceId}/members`)).statusCode).toBe(404);
  });

  it("TC-F01-50 [AC-F01-19] a plain member cannot see or decide requests", SLOW, async () => {
    const { owner, member, guest, workspaceId, link } = await setup();
    await ask(call, guest, link);
    const [entry] = await requestsOf(call, owner, workspaceId);
    const list = await call(member.token, "GET", `/api/v1/workspaces/${workspaceId}/requests`);
    expect(list.statusCode).toBe(403);
    for (const verb of ["approve", "reject"] as const) {
      expect((await decide(call, member, [workspaceId, entry?.id ?? ""], verb)).statusCode).toBe(403);
    }
    expect(await membershipRows(t, workspaceId, guest.id)).toHaveLength(0);
  });
});

describe("expiry, removed people and races", () => {
  it(
    "TC-F01-51 [AC-F01-19] 13 days old is still pending; 15 days is expired and cannot be approved",
    SLOW,
    async () => {
      const { owner, guest, workspaceId, code } = await setup();
      await ask(call, guest, code);
      const [entry] = await requestsOf(call, owner, workspaceId);
      await makeOld(t, entry?.id ?? "", 13);
      expect((await requestsOf(call, owner, workspaceId))[0]?.status).toBe("pending");
      await makeOld(t, entry?.id ?? "", 15);
      expect((await requestsOf(call, owner, workspaceId))[0]?.status).toBe("expired");
      const late = await decide(call, owner, [workspaceId, entry?.id ?? ""], "approve");
      expect(late.statusCode).toBe(410);
      expect(errorCode(late)).toBe("REQUEST_EXPIRED");
      expect(await membershipRows(t, workspaceId, guest.id)).toHaveLength(0);
    },
  );

  it("TC-F01-51 [AC-F01-19] the daily job marks old ones expired; the person can ask again", SLOW, async () => {
    const { owner, guest, workspaceId, code } = await setup();
    const fresh = await newPerson(t, "fresh");
    await ask(call, guest, code);
    await ask(call, fresh, code);
    const entries = await requestsOf(call, owner, workspaceId);
    const old = entries.find((entry) => entry.person.id === guest.id);
    await makeOld(t, old?.id ?? "", 15);
    await t.accounts.joinRequests.expireOld();
    expect((await requestRows(t, workspaceId, guest.id))[0]?.status).toBe("expired");
    expect((await requestRows(t, workspaceId, fresh.id))[0]?.status).toBe("pending");
    expect((await ask(call, guest, code)).statusCode).toBe(201);
    expect(await requestRows(t, workspaceId, guest.id)).toHaveLength(2);
  });

  it("TC-F01-52 [AC-F01-19] someone removed earlier asks again and the request says so", SLOW, async () => {
    const { owner, member, workspaceId, code } = await setup();
    const removal = await call(owner.token, "DELETE", `/api/v1/workspaces/${workspaceId}/members/${member.id}`);
    expect(removal.statusCode).toBe(204);
    expect((await ask(call, member, code)).statusCode).toBe(201);
    const [entry] = await requestsOf(call, owner, workspaceId);
    expect(entry).toMatchObject({ person: { id: member.id }, removedEarlier: true });
  });

  it("TC-F01-52 [AC-F01-19] two admins approving at once: one 204, one 409, one membership", SLOW, async () => {
    const { owner, admin, guest, workspaceId, code } = await setup();
    await ask(call, guest, code);
    const [entry] = await requestsOf(call, owner, workspaceId);
    const results = await Promise.all([
      decide(call, owner, [workspaceId, entry?.id ?? ""], "approve"),
      decide(call, admin, [workspaceId, entry?.id ?? ""], "approve"),
    ]);
    expect(results.map((result) => result.statusCode).sort()).toEqual([204, 409]);
    const refused = results.find((result) => result.statusCode === 409);
    expect(refused && errorCode(refused)).toBe("ALREADY_DECIDED");
    expect(await membershipRows(t, workspaceId, guest.id)).toHaveLength(1);
  });

  it("TC-F01-52 [AC-F01-19] deciding twice later is 409 ALREADY_DECIDED", SLOW, async () => {
    const { owner, guest, workspaceId, code } = await setup();
    await ask(call, guest, code);
    const [entry] = await requestsOf(call, owner, workspaceId);
    await decide(call, owner, [workspaceId, entry?.id ?? ""], "reject");
    const second = await decide(call, owner, [workspaceId, entry?.id ?? ""], "approve");
    expect(second.statusCode).toBe(409);
    expect(errorCode(second)).toBe("ALREADY_DECIDED");
  });
});

describe("already a member", () => {
  it("TC-F01-54 [AC-F01-20] a member using the link or code gets alreadyMember and no request row", SLOW, async () => {
    const { member, workspaceId, link, code } = await setup();
    for (const typed of [link, code]) {
      const lookedUp = await lookup(call, member, typed);
      expect(lookedUp.json()).toMatchObject({ alreadyMember: true, workspaceId });
      const response = await ask(call, member, typed);
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "alreadyMember", workspaceId });
    }
    expect(await requestRows(t, workspaceId, member.id)).toHaveLength(0);
  });

  it("TC-F01-54 [AC-F01-20] accepting an invitation after joining keeps the role, one membership", SLOW, async () => {
    const { owner, guest, workspaceId } = await setup();
    const id = invitationId(await invite(call, owner, workspaceId, { email: guest.email, role: "admin" }));
    await t.database.db.insert(workspaceMembers).values({ workspaceId, userId: guest.id, role: "member" });
    const accepted = await call(guest.token, "POST", `/api/v1/invitations/${id}/accept`);
    expect(accepted.statusCode).toBe(200);
    const rows = await membershipRows(t, workspaceId, guest.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.role).toBe("member");
  });
});
