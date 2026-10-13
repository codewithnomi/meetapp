// TC-F01-83 (AC-F01-33), security: after sign-up with a code, a code sign-in, a session, an invitation
// and a join link, the raw database tables and Redis hold no plain secret: passwords are scrypt hashes,
// email codes and invitation and session tokens are hashes, the join secret is encrypted (with a key
// version) and found through a keyed hash; provider tokens are encrypted by configuration. Own
// database; needs the `pnpm dev` services.
import { createHash, randomUUID } from "node:crypto";
import { account, invitations, session, user, verification, workspaces } from "@meetapp/db";
import { eq } from "drizzle-orm";
import { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, testEmail, type AuthTestApp } from "../test-support/auth-app.ts";
import { localConfig } from "../test-support/integration.ts";
import { tokenFromEmail } from "../test-support/invitations-setup.ts";
import { latestCode } from "../test-support/mailpit.ts";
import { caller, newPerson, seedWorkspace, type Call } from "../test-support/workspaces-setup.ts";

const SLOW = { timeout: 90_000 };
const PASSWORD = `zzAtRest-${randomUUID()}`;
const SCRYPT = /^[0-9a-f]{32}:[0-9a-f]{128}$/;
const SHA256 = /^[0-9a-f]{64}$/;
let t: AuthTestApp;
let call: Call;
let redis: Redis;

beforeAll(async () => {
  t = await startAuthTestApp();
  call = caller(t);
  const config = localConfig();
  redis = new Redis({ host: config.REDIS_HOST, port: config.REDIS_PORT, lazyConnect: true });
  await redis.connect();
}, 60_000);
afterAll(async () => {
  redis.disconnect();
  await t.close();
}, 60_000);

const post = (url: string, payload: object) =>
  t.app.inject({ method: "POST", url, payload, headers: { origin: "app://meetapp" } });
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

describe("TC-F01-83 secrets at rest", () => {
  it(
    "TC-F01-83 [AC-F01-33] sign-up: the waiting record holds no code or password; the account a scrypt hash; the session a fingerprint",
    SLOW,
    async () => {
      const email = testEmail("at-rest");
      const since = new Date();
      const started = await post("/api/v1/auth/sign-up", {
        email,
        name: "At Rest",
        password: PASSWORD,
        termsAccepted: true,
      });
      const { signupId } = started.json<{ signupId: string }>();
      const code = await latestCode(email, since);
      const waiting = (await redis.get(`signup:${signupId}`)) ?? "";
      expect(waiting).not.toBe("");
      expect(waiting).not.toContain(PASSWORD);
      expect(waiting).not.toContain(`"${code}"`);

      const verified = await post("/api/v1/auth/sign-up/verify", { signupId, code });
      expect(verified.statusCode).toBe(200);
      const token = String(verified.headers["set-auth-token"] ?? "");
      const [person] = await t.database.db.select().from(user).where(eq(user.email, email));
      const logins = await t.database.db
        .select()
        .from(account)
        .where(eq(account.userId, person?.id ?? ""));
      expect(logins[0]?.password).toMatch(SCRYPT);
      expect(JSON.stringify([person, logins])).not.toContain(PASSWORD);
      const sessions = await t.database.db
        .select()
        .from(session)
        .where(eq(session.userId, person?.id ?? ""));
      expect(sessions.length).toBeGreaterThan(0);
      for (const row of sessions) expect(row.token).toMatch(SHA256);
      expect(token).not.toBe("");
      expect(JSON.stringify(sessions)).not.toContain(token);
    },
  );

  it("TC-F01-83 [AC-F01-33] a code sign-in stores only a hash of the code", SLOW, async () => {
    const person = await newPerson(t, "otp");
    const since = new Date();
    await post("/api/auth/email-otp/send-verification-otp", { email: person.email, type: "sign-in" });
    const code = await latestCode(person.email, since);
    const rows = await t.database.db.select().from(verification);
    expect(rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(rows)).not.toContain(code);
  });

  it(
    "TC-F01-83 [AC-F01-33] invitation tokens are SHA-256 hashes; the join secret is encrypted and looked up by keyed hash",
    SLOW,
    async () => {
      const owner = await newPerson(t, "rest-owner");
      const workspaceId = await seedWorkspace(t, [[owner, "owner"]]);
      const invitee = testEmail("rest-invitee");
      const since = new Date();
      await call(owner.token, "POST", `/api/v1/workspaces/${workspaceId}/invitations`, { email: invitee });
      const invitationToken = await tokenFromEmail(invitee, since);
      const [invitation] = await t.database.db
        .select()
        .from(invitations)
        .where(eq(invitations.workspaceId, workspaceId));
      expect(invitation?.tokenHash).toBe(sha256(invitationToken));
      expect(JSON.stringify(invitation)).not.toContain(invitationToken);

      const link = (
        await call(owner.token, "PUT", `/api/v1/workspaces/${workspaceId}/join-link`, { enabled: true })
      ).json<{ link: string; code: string }>();
      const [row] = await t.database.db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
      const linkToken = link.link.split("/join/")[1] ?? "";
      expect(JSON.stringify(row)).not.toContain(link.code);
      expect(JSON.stringify(row)).not.toContain(linkToken);
      expect(row?.joinKeyVersion).toBe(1);
      expect(row?.joinLookupHmac).toMatch(SHA256);
      expect(row?.joinLinkHmac).toMatch(SHA256);
    },
  );

  it("TC-F01-83 [AC-F01-33] Google and Microsoft tokens are stored encrypted (S8)", () => {
    expect(t.auth.options.account?.encryptOAuthTokens).toBe(true);
  });
});
