// Rate limits on the real sign-in routes (F01 T4, AC-F01-13, security rule S5): wrong passwords and
// code emails per email, the same refusal for emails with and without an account, and answer times
// that don't reveal whether an account exists. Needs the `pnpm dev` services running.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createUser, startAuthTestApp, testEmail, type AuthTestApp } from "../test-support/auth-app.ts";
import { countEmails } from "../test-support/mailpit.ts";

const PASSWORD = "correct horse battery";
const SLOW = { timeout: 120_000 };
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

function post(url: string, payload: object) {
  return t.app.inject({ method: "POST", url, payload, headers: { origin: "app://meetapp" } });
}
const signIn = (email: string, password: string) => post("/api/auth/sign-in/email", { email, password });
const askCode = (email: string) => post("/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" });
const askReset = (email: string) => post("/api/auth/email-otp/request-password-reset", { email });

interface Refusal {
  status: number;
  code: string;
  retryAfterSeconds: number;
}

function refusalOf(response: Awaited<ReturnType<typeof post>>): Refusal {
  const body = response.json<{ error: { code: string; retryAfterSeconds: number } }>();
  return { status: response.statusCode, code: body.error.code, retryAfterSeconds: body.error.retryAfterSeconds };
}

describe("TC-F01-33 [AC-F01-13] wrong passwords per email", () => {
  it(
    "TC-F01-33 [AC-F01-13] after 5 wrong passwords even the right one waits; after 15 minutes it works",
    SLOW,
    async () => {
      const email = testEmail("lockout");
      await createUser(t.auth, { email, password: PASSWORD });
      for (let attempt = 1; attempt <= 5; attempt++)
        expect((await signIn(email, "wrong password!")).statusCode).toBe(401);
      const sixth = await signIn(email, "wrong password!");
      expect(sixth.statusCode).toBe(429);
      expect(sixth.headers["retry-after"]).toEqual(expect.any(String));
      expect(sixth.json<{ error: { message: string } }>().error.message).toMatch(
        /Too many attempts, try again in \d+ minutes?\./,
      );
      expect((await signIn(email, PASSWORD)).statusCode).toBe(429);
      vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 15 * 60 * 1_000 });
      const after = await signIn(email, PASSWORD);
      expect(after.statusCode, after.body).toBe(200);
    },
  );
});

describe("TC-F01-34 [AC-F01-13] code emails per address", () => {
  it(
    "TC-F01-34 [AC-F01-13] 5 code emails (sign-in and reset mixed) are sent; the 6th request is refused",
    SLOW,
    async () => {
      const email = testEmail("codes");
      await createUser(t.auth, { email, password: PASSWORD });
      const since = new Date(Date.now() - 1_000);
      for (const ask of [askCode, askReset, askCode, askReset, askCode])
        expect((await ask(email)).statusCode).toBe(200);
      expect((await askReset(email)).statusCode).toBe(429);
      expect((await askCode(testEmail("someone-else"))).statusCode).toBe(200);
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      expect(await countEmails(email, since)).toBe(5);
    },
  );
});

describe("TC-F01-35 [AC-F01-13] limits look the same for unknown emails", () => {
  it("TC-F01-35 [AC-F01-13] known and unknown emails get identical refusals", SLOW, async () => {
    const known = testEmail("known");
    const unknown = testEmail("unknown");
    await createUser(t.auth, { email: known, password: PASSWORD });
    const refusals: Refusal[] = [];
    for (const email of [known, unknown]) {
      for (let attempt = 1; attempt <= 5; attempt++) await signIn(email, "wrong password!");
      refusals.push(refusalOf(await signIn(email, "wrong password!")));
      for (let request = 1; request <= 5; request++) await askCode(email);
      refusals.push(refusalOf(await askCode(email)));
    }
    const [knownPassword, knownCode, unknownPassword, unknownCode] = refusals;
    for (const [a, b] of [
      [knownPassword, unknownPassword],
      [knownCode, unknownCode],
    ] as const) {
      expect(a?.status).toBe(429);
      expect(b?.code).toBe(a?.code);
      expect(b?.status).toBe(a?.status);
      expect(Math.abs((a?.retryAfterSeconds ?? 0) - (b?.retryAfterSeconds ?? 0))).toBeLessThanOrEqual(1);
    }
  });
});

describe("TC-F01-12 [AC-F01-05] [AC-F01-13] timing does not reveal whether an email has an account", () => {
  const RUNS = 30;
  const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
  /** Medians must be within 150 ms or 30 %, whichever is larger. */
  const expectClose = (a: number, b: number, label: string) => {
    const margin = Math.max(150, 0.3 * Math.max(a, b));
    expect(Math.abs(a - b), `${label}: ${a.toFixed(0)} ms vs ${b.toFixed(0)} ms`).toBeLessThanOrEqual(margin);
  };
  async function timed(call: () => Promise<unknown>): Promise<number> {
    const started = performance.now();
    await call();
    return performance.now() - started;
  }

  it(
    "TC-F01-12 [AC-F01-05] wrong-password sign-ins, code requests and reset requests take as long either way",
    SLOW,
    async () => {
      // A fresh email per call, so no limit is reached: this measures the real work.
      const knownEmails = await Promise.all(
        Array.from({ length: RUNS }, async () => {
          const email = testEmail("timing-known");
          await createUser(t.auth, { email, password: PASSWORD });
          return email;
        }),
      );
      const results = { password: [[], []], code: [[], []], reset: [[], []] } as Record<string, [number[], number[]]>;
      for (const [index, known] of knownEmails.entries()) {
        const unknown = testEmail(`timing-unknown-${String(index)}`);
        for (const [slot, email] of [known, unknown].entries()) {
          results["password"]?.[slot]?.push(await timed(() => signIn(email, "wrong password!")));
          results["code"]?.[slot]?.push(await timed(() => askCode(email)));
          results["reset"]?.[slot]?.push(await timed(() => askReset(email)));
        }
      }
      expect(Object.keys(results)).toEqual(["password", "code", "reset"]);
      for (const [label, [knownTimes, unknownTimes]] of Object.entries(results)) {
        expectClose(median(knownTimes), median(unknownTimes), label);
      }
    },
  );
});
