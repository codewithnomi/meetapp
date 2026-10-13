// TC-F01-81 (AC-F01-33), security: every kind of secret, sent through every sign-in, account and
// workspace route (with success, a validation error and a server error), never shows up in a log line
// or an error answer. Error codes stay readable. Own database; needs the `pnpm dev` services.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bearer, startAuthTestApp, type AuthTestApp } from "../test-support/auth-app.ts";
import { captureLogs, type CapturedLogs } from "../test-support/fake-env.ts";
import { newPerson, type Person } from "../test-support/workspaces-setup.ts";

const MARK = {
  password: "zzPw-password-7f3a91",
  newPassword: "zzPw-newpassword-7f3a92",
  currentPassword: "zzPw-current-7f3a93",
  code: "ZQ7XK9",
  otp: "zzOtp-7f3a94",
  verifier: "zzVerifier-7f3a95-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  bearer: "zzBearer-7f3a96",
  invitation: "zzInvite7f3a97tokenAAAAAAAAAAAAAAAAAAAA",
  join: "ZZJOIN7F3A",
  providerCode: "zzProviderCode-7f3a98",
  state: "zzState-7f3a99",
  request: "7f3a9a00-0000-4000-8000-00000000beef",
};

let t: AuthTestApp;
let logs: CapturedLogs;
let person: Person;
const answers: string[] = [];

beforeAll(async () => {
  logs = captureLogs();
  t = await startAuthTestApp({ logs: logs.stream });
  person = await newPerson(t, "logs");
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

type Method = "GET" | "POST";
async function send(method: Method, url: string, payload?: object, token?: string) {
  const answer = await t.app.inject({
    method,
    url,
    ...(payload ? { payload } : {}),
    headers: { origin: "app://meetapp", ...(token ? bearer(token) : {}) },
  });
  answers.push(answer.body);
  return answer;
}

async function sendEverySecret() {
  const email = `logs-${randomUUID()}@example.test`;
  await send("POST", "/api/v1/auth/sign-up", { email, name: "Log Test", password: MARK.password, termsAccepted: true });
  await send("POST", "/api/v1/auth/sign-up", { email: "not-an-email", password: MARK.password });
  await send("POST", "/api/v1/auth/sign-up/verify", { signupId: randomUUID(), code: MARK.code });
  await send("POST", "/api/auth/sign-in/email", { email: person.email, password: MARK.password });
  await send("POST", "/api/auth/sign-in/email-otp", { email: person.email, otp: MARK.otp });
  await send(
    "POST",
    "/api/v1/me/password",
    { currentPassword: MARK.currentPassword, newPassword: MARK.newPassword },
    person.token,
  );
  await send("POST", "/api/v1/auth/reset-password", {
    email: person.email,
    code: MARK.code,
    newPassword: MARK.newPassword,
  });
  await send("POST", "/api/v1/auth/desktop/exchange", { requestId: MARK.request, verifier: MARK.verifier });
  await send("GET", `/api/v1/auth/desktop/start?request=${MARK.request}`);
  await send("GET", `/invite/${MARK.invitation}`);
  await send("POST", "/api/v1/join/lookup", { linkOrCode: MARK.join }, person.token);
  await send("GET", `/api/auth/callback/google?code=${MARK.providerCode}&state=${MARK.state}`);
  await send("GET", "/api/v1/me", undefined, MARK.bearer);
  await send("GET", "/api/v1/me", undefined, person.token);
  await send("POST", "/__test__/error", { password: MARK.password, code: MARK.code });
}

describe("TC-F01-81 secrets in logs", () => {
  it("TC-F01-81 [AC-F01-33] no log line or error answer holds any secret, the session token or a request body", async () => {
    await sendEverySecret();
    await new Promise((settle) => setTimeout(settle, 200));
    const text = logs.text();
    expect(logs.lines().length).toBeGreaterThan(20);
    for (const [kind, marker] of Object.entries(MARK)) {
      expect(text.includes(marker), `${kind} in the logs`).toBe(false);
      for (const body of answers) expect(body.includes(marker), `${kind} in an answer`).toBe(false);
    }
    expect(text.includes(person.token)).toBe(false);
    expect(text).toContain("/invite/REDACTED");
    expect(text).toContain("request=REDACTED");
  });

  it("TC-F01-81 [AC-F01-33] error codes are still readable in the answers", () => {
    expect(answers.join("\n")).toMatch(/"code":"(BAD_REQUEST|CODE_INVALID|CODE_EXPIRED|PASSWORD_WRONG)"/);
    expect(answers.join("\n")).toContain('"code":"UNAUTHORIZED"');
  });
});
