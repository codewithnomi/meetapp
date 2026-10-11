// Passwords and signing out everywhere (F01 T6, AC-F01-09, 10, 12): reset with an emailed code, change
// with the current password or a code, and signing out every device. After each, every other session is
// refused at once. Runs on its own database with real emails in Mailpit; needs the `pnpm dev` services.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { issueSession } from "../../plugins/auth.ts";
import {
  bearer,
  createUser,
  signIn,
  startAuthTestApp,
  testEmail,
  type AuthTestApp,
} from "../../test-support/auth-app.ts";
import { countEmails, latestCode, waitForEmail } from "../../test-support/mailpit.ts";

const PASSWORD = "correct horse battery";
const NEW_PASSWORD = "purple elephant marching";
const SLOW = { timeout: 90_000 };
const ORIGIN = { origin: "app://meetapp" };
let t: AuthTestApp;

beforeAll(async () => {
  t = await startAuthTestApp();
}, 60_000);

afterAll(async () => {
  await t.close();
}, 60_000);

const post = (url: string, payload: object, headers: Record<string, string> = {}) =>
  t.app.inject({ method: "POST", url, payload, headers: { ...ORIGIN, ...headers } });
const me = async (token: string) =>
  (await t.app.inject({ method: "GET", url: "/api/v1/me", headers: bearer(token) })).statusCode;
const requestResetCode = (email: string) => post("/api/auth/email-otp/request-password-reset", { email });
const reset = (email: string, code: string, newPassword: string) =>
  post("/api/v1/auth/reset-password", { email, code, newPassword });
const changePassword = (token: string, body: object) => post("/api/v1/me/password", body, bearer(token));
const errorCode = (response: { json: <T>() => T }) => response.json<{ error: { code: string } }>().error.code;

async function signInStatus(email: string, password: string): Promise<number> {
  return (await post("/api/auth/sign-in/email", { email, password })).statusCode;
}

/** Asks for a reset code and returns it from the inbox. */
async function resetCode(email: string): Promise<string> {
  const since = new Date(Date.now() - 1_000);
  expect((await requestResetCode(email)).statusCode).toBe(200);
  return latestCode(email, since);
}

describe("TC-F01-26 [AC-F01-09] forgot password", () => {
  it("TC-F01-26 [AC-F01-09] the same answer for every email; only real accounts get a code", SLOW, async () => {
    const withPassword = testEmail("forgot");
    const providerOnly = testEmail("forgot-provider");
    const unknown = testEmail("forgot-unknown");
    await createUser(t.auth, { email: withPassword, password: PASSWORD });
    await createUser(t.auth, { email: providerOnly });
    const since = new Date(Date.now() - 1_000);
    const answers = await Promise.all([withPassword, providerOnly, unknown].map(requestResetCode));
    expect(answers.map((answer) => answer.statusCode)).toEqual([200, 200, 200]);
    expect(new Set(answers.map((answer) => answer.body)).size).toBe(1);
    await waitForEmail(withPassword, { since, subject: /code/i });
    await waitForEmail(providerOnly, { since, subject: /code/i });
    expect(await countEmails(unknown, since)).toBe(0);
  });

  it(
    "TC-F01-26 [AC-F01-09] the right code and a new password sign in here and sign out every other device",
    SLOW,
    async () => {
      const email = testEmail("forgot-reset");
      await createUser(t.auth, { email, password: PASSWORD });
      const [first, second] = [await signIn(t.app, email, PASSWORD), await signIn(t.app, email, PASSWORD)];
      const code = await resetCode(email);

      const weak = await reset(email, code, "password123");
      expect(weak.statusCode).toBe(400);
      expect(errorCode(weak)).toBe("PASSWORD_WEAK");
      expect(errorCode(await reset(email, code === "000000" ? "000001" : "000000", NEW_PASSWORD))).toBe("CODE_INVALID");

      const done = await reset(email, code, NEW_PASSWORD);
      expect(done.statusCode).toBe(200);
      expect(done.json<{ user: { email: string } }>().user.email).toBe(email);
      const token = done.headers["set-auth-token"];
      expect(typeof token).toBe("string");
      expect(await me(token as string)).toBe(200);
      expect([await me(first), await me(second)]).toEqual([401, 401]);
      expect(await signInStatus(email, PASSWORD)).toBe(401);
      expect(await signInStatus(email, NEW_PASSWORD)).toBe(200);
    },
  );

  it("TC-F01-26 [AC-F01-09] a code can't be used twice", SLOW, async () => {
    const email = testEmail("forgot-twice");
    await createUser(t.auth, { email, password: PASSWORD });
    const code = await resetCode(email);
    expect((await reset(email, code, NEW_PASSWORD)).statusCode).toBe(200);
    const again = await reset(email, code, "another fine password");
    expect(again.statusCode).toBe(400);
    expect(errorCode(again)).toBe("CODE_INVALID");
  });

  it("TC-F01-26 [AC-F01-09] a Google/Microsoft-only account can set a password and then use it", SLOW, async () => {
    const email = testEmail("forgot-provider-set");
    await createUser(t.auth, { email });
    expect((await reset(email, await resetCode(email), NEW_PASSWORD)).statusCode).toBe(200);
    expect(await signInStatus(email, NEW_PASSWORD)).toBe(200);
  });
});

describe("TC-F01-27 [AC-F01-10] change password", () => {
  it("TC-F01-27 [AC-F01-10] the right current password changes it and signs out the other device", SLOW, async () => {
    const email = testEmail("change");
    await createUser(t.auth, { email, password: PASSWORD });
    const [here, other] = [await signIn(t.app, email, PASSWORD), await signIn(t.app, email, PASSWORD)];

    const weak = await changePassword(here, { currentPassword: PASSWORD, newPassword: "password123" });
    expect(weak.statusCode).toBe(400);
    expect(errorCode(weak)).toBe("PASSWORD_WEAK");

    const changed = await changePassword(here, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD });
    expect(changed.statusCode).toBe(200);
    const token = changed.headers["set-auth-token"];
    expect(typeof token).toBe("string");
    expect(await me(token as string)).toBe(200);
    expect(await me(other)).toBe(401);
    expect(await signInStatus(email, PASSWORD)).toBe(401);
    expect(await signInStatus(email, NEW_PASSWORD)).toBe(200);
  });

  it(
    "TC-F01-27 [AC-F01-10] a wrong current password answers 400 PASSWORD_WRONG and keeps everyone signed in",
    SLOW,
    async () => {
      const email = testEmail("change-wrong");
      await createUser(t.auth, { email, password: PASSWORD });
      const [here, other] = [await signIn(t.app, email, PASSWORD), await signIn(t.app, email, PASSWORD)];
      const wrong = await changePassword(here, { currentPassword: "not my password", newPassword: NEW_PASSWORD });
      expect(wrong.statusCode).toBe(400);
      expect(errorCode(wrong)).toBe("PASSWORD_WRONG");
      expect([await me(here), await me(other)]).toEqual([200, 200]);
      expect(await signInStatus(email, PASSWORD)).toBe(200);
    },
  );

  it("TC-F01-27 [AC-F01-10] an account without a password sets one with an emailed code", SLOW, async () => {
    const email = testEmail("change-provider");
    const userId = await createUser(t.auth, { email });
    const here = await issueSession(t.auth, userId);
    const noPassword = await changePassword(here, { currentPassword: "anything at all", newPassword: NEW_PASSWORD });
    expect(errorCode(noPassword)).toBe("PASSWORD_WRONG");

    const changed = await changePassword(here, { code: await resetCode(email), newPassword: NEW_PASSWORD });
    expect(changed.statusCode).toBe(200);
    expect(typeof changed.headers["set-auth-token"]).toBe("string");
    expect(await signInStatus(email, NEW_PASSWORD)).toBe(200);
  });

  it("TC-F01-27 [AC-F01-10] the body needs exactly one of the current password or a code", async () => {
    const email = testEmail("change-shape");
    await createUser(t.auth, { email, password: PASSWORD });
    const here = await signIn(t.app, email, PASSWORD);
    const both = { currentPassword: PASSWORD, code: "123456", newPassword: NEW_PASSWORD };
    expect((await changePassword(here, both)).statusCode).toBe(400);
    expect((await changePassword(here, { newPassword: NEW_PASSWORD })).statusCode).toBe(400);
    expect(
      (await post("/api/v1/me/password", { currentPassword: PASSWORD, newPassword: NEW_PASSWORD })).statusCode,
    ).toBe(401);
  });
});

describe("TC-F01-31 [AC-F01-12] sign out everywhere", () => {
  it(
    "TC-F01-31 [AC-F01-12] sign-out ends only its own session; sign-out-everywhere ends them all at once",
    SLOW,
    async () => {
      const email = testEmail("everywhere");
      const someoneElse = testEmail("everywhere-other");
      await createUser(t.auth, { email, password: PASSWORD });
      await createUser(t.auth, { email: someoneElse, password: PASSWORD });
      const sessions = [];
      for (let device = 0; device < 3; device++) sessions.push(await signIn(t.app, email, PASSWORD));
      const [first, second, third] = sessions as [string, string, string];
      const theirs = await signIn(t.app, someoneElse, PASSWORD);

      expect((await post("/api/auth/sign-out", {}, bearer(second))).statusCode).toBe(200);
      expect([await me(first), await me(second), await me(third)]).toEqual([200, 401, 200]);

      expect((await post("/api/v1/auth/sign-out-everywhere", {}, bearer(first))).statusCode).toBe(204);
      expect([await me(first), await me(third)]).toEqual([401, 401]);
      expect(await me(theirs)).toBe(200);
      expect((await post("/api/v1/auth/sign-out-everywhere", {})).statusCode).toBe(401);
    },
  );
});
