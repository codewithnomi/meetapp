// TC-F01-33 (AC-F01-13, S5), security: wrong passwords are also limited per network address, across
// all emails (password spraying: a few tries at each of many accounts). 100 in 15 minutes; the 101st
// is refused even for an email never tried before. Own app and counters; needs the `pnpm dev` services.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, testEmail, type AuthTestApp } from "../test-support/auth-app.ts";

let t: AuthTestApp;
beforeAll(async () => {
  t = await startAuthTestApp();
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

const signIn = (email: string) =>
  t.app.inject({
    method: "POST",
    url: "/api/auth/sign-in/email",
    payload: { email, password: "not the password" },
    headers: { origin: "app://meetapp" },
  });

describe("TC-F01-33 password spraying", () => {
  it(
    "TC-F01-33 [AC-F01-13] after 100 wrong passwords from one address, any email is refused for a while",
    { timeout: 180_000 },
    async () => {
      for (let attempt = 0; attempt < 100; attempt++) {
        expect((await signIn(testEmail(`spray-${String(attempt)}`))).statusCode).toBe(401);
      }
      const refused = await signIn(testEmail("spray-new"));
      expect(refused.statusCode).toBe(429);
      expect(refused.json()).toMatchObject({ error: { code: "TOO_MANY_ATTEMPTS" } });
    },
  );
});
