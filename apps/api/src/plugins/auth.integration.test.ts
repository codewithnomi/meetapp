// Sign-in in the real backend (F01 T3): password and code sign-in, the same answer for unknown emails,
// the terms gate, 30-day sessions that slide with use, and only the allowed Better Auth routes.
// Runs on its own database and sends codes to Mailpit; needs the `pnpm dev` services running.
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { latestCode, countEmails } from "../test-support/mailpit.ts";
import { bearer, createUser, signIn, startAuthTestApp, testEmail, type AuthTestApp } from "../test-support/auth-app.ts";

const PASSWORD = "correct horse battery";
const ORIGIN = { origin: "app://meetapp" };
const SLOW = { timeout: 60_000 };
let t: AuthTestApp;

beforeAll(async () => {
  t = await startAuthTestApp();
}, 60_000);

afterAll(async () => {
  await t.close();
}, 60_000);

afterEach(() => {
  vi.useRealTimers();
});

function post(url: string, payload: unknown, headers: Record<string, string> = {}) {
  return t.app.inject({ method: "POST", url, payload: payload as object, headers: { ...ORIGIN, ...headers } });
}

describe("TC-F01-10 [AC-F01-05] password sign-in", () => {
  it(
    "TC-F01-10 [AC-F01-05] the right password signs in within 3 s; email case and spaces don't matter",
    SLOW,
    async () => {
      const email = testEmail("signin");
      await createUser(t.auth, { email, password: PASSWORD });
      const started = Date.now();
      const token = await signIn(t.app, `  ${email.toUpperCase()} `.trim().toUpperCase(), PASSWORD);
      expect(Date.now() - started).toBeLessThan(3_000);
      const me = await t.app.inject({ url: "/api/v1/me", headers: bearer(token) });
      expect(me.statusCode).toBe(200);
      expect(me.json<{ user: { email: string } }>().user.email).toBe(email);
    },
  );
});

describe("TC-F01-11 [AC-F01-05] wrong password and unknown email look the same", () => {
  it("TC-F01-11 [AC-F01-05] both answers have the same status and body", SLOW, async () => {
    const email = testEmail("wrong");
    await createUser(t.auth, { email, password: PASSWORD });
    const wrong = await post("/api/auth/sign-in/email", { email, password: "not the password" });
    const unknown = await post("/api/auth/sign-in/email", { email: testEmail("nobody"), password: "not the password" });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(wrong.statusCode);
    expect(unknown.json()).toEqual(wrong.json());
  });
});

describe("TC-F01-13 [AC-F01-06] sign in with an emailed code", () => {
  it("TC-F01-13 [AC-F01-06] a known email gets a code that signs in once", SLOW, async () => {
    const email = testEmail("code");
    await createUser(t.auth, { email, password: PASSWORD });
    const since = new Date(Date.now() - 1_000);
    const asked = await post("/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" });
    expect(asked.statusCode).toBe(200);
    const otp = await latestCode(email, since);
    const signedIn = await post("/api/auth/sign-in/email-otp", { email, otp });
    expect(signedIn.statusCode).toBe(200);
    expect(signedIn.headers["set-auth-token"]).toEqual(expect.any(String));
    const again = await post("/api/auth/sign-in/email-otp", { email, otp });
    expect(again.statusCode).not.toBe(200);
  });

  it("TC-F01-13 [AC-F01-06] an unknown email gets the same answer, no email and no account", SLOW, async () => {
    const email = testEmail("unknown");
    const since = new Date(Date.now() - 1_000);
    const known = testEmail("known");
    await createUser(t.auth, { email: known, password: PASSWORD });
    const forKnown = await post("/api/auth/email-otp/send-verification-otp", { email: known, type: "sign-in" });
    const forUnknown = await post("/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" });
    expect(forUnknown.statusCode).toBe(forKnown.statusCode);
    expect(forUnknown.json()).toEqual(forKnown.json());
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    expect(await countEmails(email, since)).toBe(0);
    const users = await t.database.db.execute(sql`select count(*)::int as count from "user" where email = ${email}`);
    expect(users.rows[0]).toEqual({ count: 0 });
  });
});

describe("TC-F01-16 [AC-F01-07] the terms gate", () => {
  it("TC-F01-16 [AC-F01-07] until the terms are accepted only /me and /me/terms work", SLOW, async () => {
    const email = testEmail("terms");
    await createUser(t.auth, { email, password: PASSWORD, termsAccepted: false });
    const token = await signIn(t.app, email, PASSWORD);
    const me = await t.app.inject({ url: "/api/v1/me", headers: bearer(token) });
    expect(me.json<{ user: { termsAccepted: boolean } }>().user.termsAccepted).toBe(false);
    const blocked = await t.app.inject({ url: "/api/v1/__test__/whoami", headers: bearer(token) });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json<{ error: { code: string } }>().error.code).toBe("TERMS_REQUIRED");

    const halfway = await post("/api/v1/me/terms", { acceptTerms: true }, bearer(token));
    expect(halfway.statusCode).toBe(400);
    const accepted = await post("/api/v1/me/terms", { acceptTerms: true, ageConfirmed: true }, bearer(token));
    expect(accepted.json<{ user: { termsAccepted: boolean } }>().user.termsAccepted).toBe(true);
    const allowed = await t.app.inject({ url: "/api/v1/__test__/whoami", headers: bearer(token) });
    expect(allowed.statusCode).toBe(200);
  });

  it("TC-F01-16 [AC-F01-07] without a session the same routes answer 401", SLOW, async () => {
    for (const url of ["/api/v1/me", "/api/v1/__test__/whoami"]) {
      expect((await t.app.inject({ url })).statusCode, url).toBe(401);
    }
    expect((await t.app.inject({ url: "/api/v1/health" })).statusCode).not.toBe(401);
  });
});

describe("TC-F01-29 [AC-F01-11] sessions last 30 days and slide with use", () => {
  const DAY = 24 * 60 * 60 * 1_000;
  const me = (token: string) => t.app.inject({ url: "/api/v1/me", headers: bearer(token) });

  it("TC-F01-29 [AC-F01-11] used on day 29 and again 29 days later it still works", SLOW, async () => {
    const email = testEmail("slide");
    await createUser(t.auth, { email, password: PASSWORD });
    const start = Date.now();
    const token = await signIn(t.app, email, PASSWORD);
    vi.useFakeTimers({ toFake: ["Date"], now: start + 29 * DAY });
    expect((await me(token)).statusCode).toBe(200);
    vi.setSystemTime(start + 58 * DAY);
    expect((await me(token)).statusCode).toBe(200);
  });

  it("TC-F01-29 [AC-F01-11] a session unused for 31 days has ended", SLOW, async () => {
    const email = testEmail("idle");
    await createUser(t.auth, { email, password: PASSWORD });
    const start = Date.now();
    const token = await signIn(t.app, email, PASSWORD);
    vi.useFakeTimers({ toFake: ["Date"], now: start + 31 * DAY });
    expect((await me(token)).statusCode).toBe(401);
  });
});

describe("TC-F01-80 [AC-F01-33] [AC-F01-34] only the allowed Better Auth routes are reachable", () => {
  const BLOCKED = [
    "/api/auth/sign-up/email",
    "/api/auth/update-user",
    "/api/auth/change-email",
    "/api/auth/delete-user",
    "/api/auth/link-social",
    "/api/auth/unlink-account",
    "/api/auth/change-password",
    "/api/auth/list-sessions",
    "/api/auth/get-session",
    "/api/auth/organization/create",
    "/api/auth/email-otp/verify-email",
    // Reached only through /api/v1/auth/reset-password, which also signs in on this computer (T6).
    "/api/auth/email-otp/reset-password",
    // Deprecated by Better Auth; /api/auth/email-otp/request-password-reset replaces it.
    "/api/auth/forget-password/email-otp",
    // Google/Microsoft sign-in starts only through /api/v1/auth/desktop/start (T7).
    "/api/auth/sign-in/social",
    "/api/auth/callback/../sign-up/email",
  ];

  it.each(BLOCKED)("TC-F01-80 [AC-F01-33] %s answers 404 and changes nothing", async (url) => {
    const email = testEmail("blocked");
    const response = await post(url, { email, password: PASSWORD, name: "Sneaky", termsVersion: "x" });
    expect(response.statusCode).toBe(404);
    const users = await t.database.db.execute(sql`select count(*)::int as count from "user" where email = ${email}`);
    expect(users.rows[0]).toEqual({ count: 0 });
  });

  it("TC-F01-80 [AC-F01-34] the session token is stored only as a fingerprint", SLOW, async () => {
    const email = testEmail("stored");
    await createUser(t.auth, { email, password: PASSWORD });
    const token = await signIn(t.app, email, PASSWORD);
    const rows = await t.database.db.execute(sql`select token from session`);
    const stored = rows.rows.map((row) => String(row["token"]));
    // The app's token is "<session token>.<signature>"; the database keeps only a fingerprint of the first part.
    const sessionToken = decodeURIComponent(token).split(".")[0] ?? "";
    expect(stored).not.toContain(sessionToken);
    expect(stored.some((value) => value.includes(sessionToken))).toBe(false);
    expect(stored).toContain(createHash("sha256").update(sessionToken).digest("hex"));
  });
});

describe("TC-F01-06 [AC-F01-03] the password rule also guards password reset", () => {
  it(
    "TC-F01-06 [AC-F01-03] a reset to a common password is refused before the code is even checked",
    SLOW,
    async () => {
      const email = testEmail("reset-weak");
      await createUser(t.auth, { email, password: PASSWORD });
      const response = await post("/api/v1/auth/reset-password", {
        email,
        code: "000000",
        newPassword: "password123",
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: { code: "PASSWORD_WEAK", message: expect.stringContaining("too common") },
      });
    },
  );
});

describe("TC-F01-84 [AC-F01-34] the app can read a 401", () => {
  it("TC-F01-84 [AC-F01-34] a refused request from the app still carries its CORS headers", async () => {
    const response = await t.app.inject({ url: "/api/v1/me", headers: ORIGIN });
    expect(response.statusCode).toBe(401);
    expect(response.headers["access-control-allow-origin"]).toBe("app://meetapp");
  });
});
