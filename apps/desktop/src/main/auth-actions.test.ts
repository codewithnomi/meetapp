// TC-F01-84 (AC-F01-34), the main-process part: sign-in answers carry the user, never the token; the
// token is kept by main and sent as a bearer token; sign-out forgets it even when the backend can't be
// reached; input from the page is checked before anything is sent.
import { describe, expect, it } from "vitest";
import { createAuthActions, isValidCall } from "./auth-actions.ts";
import { createAuthClient } from "./auth-client.ts";
import type { TokenStore } from "./auth-token.ts";

const TOKEN = "secret-session-token.signature";
const USER = { id: "u1", name: "Pat", email: "pat@example.test", termsAccepted: true, theme: null, accent: null };

function memoryTokens(): TokenStore {
  let token: string | undefined;
  return { get: () => token, set: (value) => (token = value), clear: () => (token = undefined) };
}

interface Seen {
  path: string;
  authorization: string | null;
  origin: string | null;
}

/** A fake backend: sign-ins answer with a token header; /me answers only to that token. */
function fakeBackend(options: { down?: boolean; signInStatus?: number } = {}) {
  const seen: Seen[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    if (options.down) throw new TypeError("fetch failed");
    const path = new URL(String(input)).pathname;
    const headers = new Headers(init?.headers);
    seen.push({ path, authorization: headers.get("authorization"), origin: headers.get("origin") });
    if (path === "/api/v1/me") {
      const ok = headers.get("authorization") === `Bearer ${TOKEN}`;
      return Response.json(ok ? { user: USER } : { error: { code: "UNAUTHORIZED" } }, { status: ok ? 200 : 401 });
    }
    if (path === "/api/auth/sign-in/email" && options.signInStatus === 401) {
      return Response.json(
        { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" },
        { status: 401 },
      );
    }
    if (path === "/api/v1/auth/sign-out-everywhere") return new Response(null, { status: 204 });
    return Response.json({ token: TOKEN, user: { image: "x" } }, { headers: { "set-auth-token": TOKEN } });
  }) as typeof fetch;
  return { seen, fetchImpl };
}

function setUp(options: Parameters<typeof fakeBackend>[0] = {}) {
  const tokens = memoryTokens();
  const backend = fakeBackend(options);
  const actions = createAuthActions(createAuthClient("http://api.test", tokens, backend.fetchImpl), tokens);
  return { tokens, actions, seen: backend.seen };
}

describe("TC-F01-84 [AC-F01-34] the token stays in the main process", () => {
  it("TC-F01-84 [AC-F01-34] a sign-in answers with the user only; main keeps the token and sends it as bearer", async () => {
    const { tokens, actions, seen } = setUp();
    const answer = await actions.signInWithPassword("pat@example.test", "a password");
    expect(answer).toEqual({ ok: true, user: USER });
    expect(JSON.stringify(answer)).not.toContain(TOKEN);
    expect(tokens.get()).toBe(TOKEN);
    expect(seen.at(-1)).toEqual({ path: "/api/v1/me", authorization: `Bearer ${TOKEN}`, origin: "app://meetapp" });
  });

  it("TC-F01-84 [AC-F01-34] a refused sign-in gives the error code and keeps nothing", async () => {
    const { tokens, actions } = setUp({ signInStatus: 401 });
    expect(await actions.signInWithPassword("pat@example.test", "wrong")).toEqual({
      ok: false,
      code: "INVALID_EMAIL_OR_PASSWORD",
      message: "Invalid email or password",
    });
    expect(tokens.get()).toBeUndefined();
  });

  it("TC-F01-84 [AC-F01-34] a token the backend no longer accepts is forgotten (status → SIGNED_OUT)", async () => {
    const { tokens, actions } = setUp();
    tokens.set("revoked-token");
    expect(await actions.status()).toEqual({ ok: false, code: "SIGNED_OUT" });
    expect(tokens.get()).toBeUndefined();
  });

  it("TC-F01-84 [AC-F01-34] no network: a clear code, and the token is kept for later", async () => {
    const { tokens, actions } = setUp({ down: true });
    tokens.set(TOKEN);
    expect(await actions.status()).toEqual({ ok: false, code: "NETWORK_ERROR" });
    expect(tokens.get()).toBe(TOKEN);
  });

  it("TC-F01-84 [AC-F01-12] sign-out and sign-out-everywhere forget the token, even offline", async () => {
    for (const action of ["signOut", "signOutEverywhere"] as const) {
      const { tokens, actions } = setUp({ down: true });
      tokens.set(TOKEN);
      await actions[action]();
      expect(tokens.get()).toBeUndefined();
    }
    const online = setUp();
    online.tokens.set(TOKEN);
    expect(await online.actions.signOutEverywhere()).toEqual({ ok: true });
  });

  it("TC-F01-84 [AC-F01-34] only known actions with short text or flat objects are accepted from the page", () => {
    expect(isValidCall("signInWithPassword", ["a@example.test", "password"])).toBe(true);
    expect(isValidCall("startSignUp", [{ email: "a@example.test", termsAccepted: true }])).toBe(true);
    expect(isValidCall("readTokenFile", [])).toBe(false);
    expect(isValidCall("toString", [])).toBe(false);
    expect(isValidCall("signInWithPassword", ["x".repeat(1_001), "p"])).toBe(false);
    expect(isValidCall("startSignUp", [{ nested: { deep: true } }])).toBe(false);
    expect(isValidCall("status", "not a list")).toBe(false);
  });
});
