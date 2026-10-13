// Sending invitations (F01 T12; AC-F01-17): the role rules, replacing, cancelling and the daily limit,
// through the real routes and the fake inbox. Own database; needs the `pnpm dev` services.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, testEmail, type AuthTestApp } from "../../test-support/auth-app.ts";
import {
  invitationId,
  invite,
  statusOf,
  tokenFromEmail,
  type SentInvitation,
} from "../../test-support/invitations-setup.ts";
import { countEmails } from "../../test-support/mailpit.ts";
import {
  caller,
  errorCode,
  newPerson,
  seedWorkspace,
  type Call,
  type Person,
} from "../../test-support/workspaces-setup.ts";

const SLOW = { timeout: 120_000 };
let t: AuthTestApp;
let call: Call;

beforeAll(async () => {
  t = await startAuthTestApp();
  call = caller(t);
}, 60_000);

afterAll(async () => {
  await t.close();
}, 60_000);

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const pending = async (who: Person, workspaceId: string) =>
  (await call(who.token, "GET", `/api/v1/workspaces/${workspaceId}/invitations`)).json<{
    invitations: SentInvitation[];
  }>().invitations;

async function team() {
  const people = {
    owner: await newPerson(t, "owner"),
    admin: await newPerson(t, "admin"),
    member: await newPerson(t, "member"),
    other: await newPerson(t, "other"),
  };
  const workspaceId = await seedWorkspace(t, [
    [people.owner, "owner"],
    [people.admin, "admin"],
    [people.member, "member"],
    [people.other, "member"],
  ]);
  return { ...people, workspaceId };
}

describe("who may invite", () => {
  it("TC-F01-43 [AC-F01-17] a member inviting as admin gets 403; every role may invite as member", SLOW, async () => {
    const { owner, admin, member, workspaceId } = await team();
    const refused = await invite(call, member, workspaceId, { email: testEmail("x"), role: "admin" });
    expect(refused.statusCode).toBe(403);
    for (const [who, role] of [
      [owner, "admin"],
      [admin, "admin"],
      [owner, "member"],
      [admin, "member"],
      [member, "member"],
    ] as const) {
      const email = testEmail("ok");
      const since = new Date();
      const response = await invite(call, who, workspaceId, { email: email, role: role });
      expect(response.statusCode).toBe(201);
      expect(response.json<{ invitation: SentInvitation }>().invitation.role).toBe(role);
      await tokenFromEmail(email, since);
    }
  });

  it("TC-F01-43 [AC-F01-17] emails are trimmed and lower-cased; the role defaults to member", SLOW, async () => {
    const { owner, workspaceId } = await team();
    const email = testEmail("Mixed");
    const response = await call(owner.token, "POST", `/api/v1/workspaces/${workspaceId}/invitations`, {
      email: `  ${email.toUpperCase()} `,
    });
    const body = response.json<{ invitation: SentInvitation }>().invitation;
    expect(body.email).toBe(email.toLowerCase());
    expect(body.role).toBe("member");
    expect(Date.parse(body.expiresAt) - Date.now()).toBeGreaterThan(6.9 * 86_400_000);
  });

  it("TC-F01-43 [AC-F01-17] an existing member is refused with ALREADY_MEMBER and no email is sent", SLOW, async () => {
    const { owner, member, workspaceId } = await team();
    const since = new Date();
    const response = await invite(call, owner, workspaceId, { email: member.email.toUpperCase() });
    expect(response.statusCode).toBe(409);
    expect(errorCode(response)).toBe("ALREADY_MEMBER");
    expect(response.json<{ error: { message: string } }>().error.message).toBe(`${member.email} is already a member`);
    await pause(1_500);
    expect(await countEmails(member.email, since)).toBe(0);
  });

  it("TC-F01-43 [AC-F01-17] a bad address is refused and a non-member gets 404", SLOW, async () => {
    const { owner, workspaceId } = await team();
    const outsider = await newPerson(t, "outsider");
    expect((await invite(call, owner, workspaceId, { email: "not-an-email" })).statusCode).toBe(400);
    expect((await invite(call, outsider, workspaceId, { email: testEmail("y") })).statusCode).toBe(404);
  });
});

describe("replacing and cancelling", () => {
  it(
    "TC-F01-43 [AC-F01-17] inviting the same address again replaces the old one and its link stops",
    SLOW,
    async () => {
      const { owner, workspaceId } = await team();
      const email = testEmail("x");
      const first = await invite(call, owner, workspaceId, { email: email });
      const oldToken = await tokenFromEmail(email, new Date(0));
      const since = new Date();
      const again = await invite(call, owner, workspaceId, { email: ` ${email.toUpperCase()}` });
      expect(again.statusCode).toBe(201);
      const newToken = await tokenFromEmail(email, since);
      expect(newToken).not.toBe(oldToken);
      expect(await statusOf(t, invitationId(first))).toBe("replaced");
      expect((await pending(owner, workspaceId)).map((row) => row.email)).toEqual([email]);
      expect((await t.app.inject({ method: "GET", url: `/invite/${oldToken}` })).statusCode).toBe(404);
      expect((await t.app.inject({ method: "GET", url: `/invite/${newToken}` })).statusCode).toBe(200);
    },
  );

  it(
    "TC-F01-43 [AC-F01-17] the pending list: owner and admin see all, a member sees only their own",
    SLOW,
    async () => {
      const { owner, admin, member, other, workspaceId } = await team();
      await invite(call, owner, workspaceId, { email: testEmail("a") });
      await invite(call, member, workspaceId, { email: testEmail("b") });
      await invite(call, other, workspaceId, { email: testEmail("c") });
      expect(await pending(owner, workspaceId)).toHaveLength(3);
      expect(await pending(admin, workspaceId)).toHaveLength(3);
      const own = await pending(member, workspaceId);
      expect(own).toHaveLength(1);
      expect(own[0]?.invitedBy?.id).toBe(member.id);
    },
  );

  it("TC-F01-43 [AC-F01-17] the owner, an admin and the sender may cancel; another member gets 403", SLOW, async () => {
    const { owner, admin, member, other, workspaceId } = await team();
    const cancel = (who: Person, id: string) =>
      call(who.token, "DELETE", `/api/v1/workspaces/${workspaceId}/invitations/${id}`);
    const sent = async (who: Person) => invitationId(await invite(call, who, workspaceId, { email: testEmail("z") }));
    const byMember = await sent(member);
    expect((await cancel(other, byMember)).statusCode).toBe(403);
    expect(await statusOf(t, byMember)).toBe("pending");
    expect((await cancel(member, byMember)).statusCode).toBe(204);
    expect(await statusOf(t, byMember)).toBe("cancelled");
    expect((await cancel(owner, await sent(member))).statusCode).toBe(204);
    expect((await cancel(admin, await sent(owner))).statusCode).toBe(204);
    expect((await cancel(owner, byMember)).statusCode).toBe(404);
    expect(await pending(owner, workspaceId)).toHaveLength(0);
  });

  it("TC-F01-43 [AC-F01-17] sending again gives a new link and email, and the old link stops", SLOW, async () => {
    const { owner, member, workspaceId } = await team();
    const email = testEmail("again");
    const id = invitationId(await invite(call, member, workspaceId, { email: email }));
    const oldToken = await tokenFromEmail(email, new Date(0));
    const since = new Date();
    const resend = (who: Person) =>
      call(who.token, "POST", `/api/v1/workspaces/${workspaceId}/invitations/${id}/resend`);
    expect((await resend(owner)).statusCode).toBe(201);
    const newToken = await tokenFromEmail(email, since);
    expect(newToken).not.toBe(oldToken);
    expect((await t.app.inject({ method: "GET", url: `/invite/${oldToken}` })).statusCode).toBe(404);
    expect(await pending(owner, workspaceId)).toHaveLength(1);
  });
});

describe("the daily limit", () => {
  it("TC-F01-44 [AC-F01-17] the 51st invitation email in a day is refused, others are not affected", SLOW, async () => {
    const { owner, admin, workspaceId } = await team();
    const second = await seedWorkspace(t, [[owner, "owner"]], "Second");
    const targets = Array.from({ length: 50 }, (_, i) => [i < 25 ? workspaceId : second, testEmail("bulk")] as const);
    for (let start = 0; start < targets.length; start += 10) {
      const batch = await Promise.all(
        targets.slice(start, start + 10).map(([id, email]) => invite(call, owner, id, { email: email })),
      );
      expect(batch.map((response) => response.statusCode)).toEqual(Array<number>(batch.length).fill(201));
    }
    const email = testEmail("fifty-first");
    const since = new Date();
    const refused = await invite(call, owner, workspaceId, { email: email });
    expect(refused.statusCode).toBe(429);
    expect(errorCode(refused)).toBe("TOO_MANY_ATTEMPTS");
    expect(refused.json<{ error: { message: string } }>().error.message).toBe(
      "Invite limit reached, try again tomorrow.",
    );
    expect((await invite(call, admin, workspaceId, { email: testEmail("fine") })).statusCode).toBe(201);
    await pause(1_500);
    expect(await countEmails(email, since)).toBe(0);
  });
});
