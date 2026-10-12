// TC-F01-23 (AC-F01-07), the main-process part: Google/Microsoft sign-in sends only the SHA-256 of the
// secret verifier, opens the start link, waits for the browser, keeps the token, and stops on Cancel,
// on the browser's answer, or after 5 minutes.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createAuthClient } from "./auth-client.ts";
import type { TokenStore } from "./auth-token.ts";
import { createProviderSignIn } from "./provider-sign-in.ts";

const TOKEN = "desktop-session.signature";
const USER = { id: "u1", email: "pat@example.test" };

function memoryTokens(): TokenStore {
  let token: string | undefined;
  return { get: () => token, set: (value) => (token = value), clear: () => (token = undefined) };
}

/** A fake backend: `exchangeAnswers` are given in turn (the last one repeats). */
function fakeBackend(exchangeAnswers: (() => Response)[]) {
  const seen: { path: string; body: Record<string, string> }[] = [];
  let turn = 0;
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    const body = (init?.body ? JSON.parse(String(init.body)) : {}) as Record<string, string>;
    seen.push({ path, body });
    if (path.endsWith("/init")) {
      return Response.json({
        requestId: "r-1",
        matchCode: "4821",
        startUrl: "http://127.0.0.1:3010/start?request=r-1",
      });
    }
    if (path.endsWith("/exchange"))
      return (exchangeAnswers[Math.min(turn++, exchangeAnswers.length - 1)] ?? (() => new Response()))();
    if (path === "/api/v1/me") return Response.json({ user: USER });
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  return { seen, fetchImpl };
}

const pending = () => Response.json({ status: "pending" }, { status: 202 });
const done = () => Response.json({ user: USER }, { headers: { "set-auth-token": TOKEN } });

function setUp(answers: (() => Response)[], options: { open?: boolean; clock?: { now: number } } = {}) {
  const tokens = memoryTokens();
  const backend = fakeBackend(answers);
  const opened: string[] = [];
  const clock = options.clock ?? { now: 0 };
  const signIn = createProviderSignIn({
    client: createAuthClient("http://api.test", tokens, backend.fetchImpl),
    tokens,
    openInBrowser: async (url) => (opened.push(url), options.open ?? true),
    now: () => clock.now,
    wait: async (ms) => void (clock.now += ms),
  });
  return { signIn, tokens, opened, seen: backend.seen, clock };
}

describe("TC-F01-23 [AC-F01-07] Google/Microsoft sign-in from the desktop", () => {
  it("TC-F01-23 [AC-F01-07] sends only the verifier's SHA-256, opens the start link, waits, keeps the token", async () => {
    const { signIn, tokens, opened, seen } = setUp([pending, pending, done]);
    expect(await signIn.start("google")).toEqual({ ok: true, matchCode: "4821" });
    expect(opened).toEqual(["http://127.0.0.1:3010/start?request=r-1"]);
    expect(await signIn.finish()).toEqual({ ok: true, user: USER });
    expect(tokens.get()).toBe(TOKEN);
    const init = seen.find((call) => call.path.endsWith("/init"));
    const exchange = seen.find((call) => call.path.endsWith("/exchange"));
    expect(init?.body["challenge"]).toBe(
      createHash("sha256")
        .update(exchange?.body["verifier"] ?? "")
        .digest("hex"),
    );
    expect(JSON.stringify(init)).not.toContain(exchange?.body["verifier"] ?? "-");
    expect(seen.filter((call) => call.path.endsWith("/exchange"))).toHaveLength(3);
  });

  it("TC-F01-18 [AC-F01-07] the browser's answer comes through: cancelled, or an unverified email", async () => {
    const cancelled = setUp([() => Response.json({ error: { code: "SIGN_IN_CANCELLED" } }, { status: 410 })]);
    await cancelled.signIn.start("microsoft");
    expect(await cancelled.signIn.finish()).toMatchObject({ ok: false, code: "SIGN_IN_CANCELLED" });
    const unverified = setUp([() => Response.json({ error: { code: "PROVIDER_EMAIL_UNVERIFIED" } }, { status: 410 })]);
    await unverified.signIn.start("microsoft");
    expect(await unverified.signIn.finish()).toMatchObject({ ok: false, code: "PROVIDER_EMAIL_UNVERIFIED" });
    expect(unverified.tokens.get()).toBeUndefined();
  });

  it("TC-F01-18 [AC-F01-07] Cancel in the app tells the backend and ends the wait", async () => {
    const { signIn, seen } = setUp([pending]);
    await signIn.start("google");
    const waiting = signIn.finish();
    await signIn.cancel();
    expect(await waiting).toMatchObject({ ok: false, code: "SIGN_IN_CANCELLED" });
    expect(seen.some((call) => call.path.endsWith("/cancel"))).toBe(true);
  });

  it("TC-F01-18 [AC-F01-07] after 5 minutes the app gives up and cancels", async () => {
    const { signIn, seen, clock } = setUp([pending]);
    await signIn.start("google");
    const result = await signIn.finish();
    expect(result).toMatchObject({ ok: false, code: "SIGN_IN_CANCELLED" });
    expect(clock.now).toBeGreaterThan(5 * 60 * 1_000);
    expect(seen.some((call) => call.path.endsWith("/cancel"))).toBe(true);
  });

  it("TC-F01-19 [AC-F01-07] a start link main may not open stops the sign-in", async () => {
    const { signIn } = setUp([done], { open: false });
    expect(await signIn.start("google")).toMatchObject({ ok: false, code: "SIGN_IN_CANCELLED" });
    expect(await signIn.finish()).toMatchObject({ ok: false, code: "SIGN_IN_CANCELLED" });
  });
});
