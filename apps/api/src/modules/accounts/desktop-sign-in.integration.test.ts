// Google/Microsoft sign-in through the computer's browser (F01 T7, AC-F01-07, 08, 13): the normal path,
// cancelling, the 5-minute limit, attacks on the hand-off, linking to an existing account and refusing
// unverified emails. Runs on its own database against a local fake Google/Microsoft; needs `pnpm dev`.
import { sql } from "drizzle-orm";
import { rowsOf } from "@meetapp/db/testing";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  bearer,
  createUser,
  signIn,
  startAuthTestApp,
  testEmail,
  type AuthTestApp,
} from "../../test-support/auth-app.ts";
import {
  TestBrowser,
  exchange,
  initHandOff,
  pressOnPage,
  throughProvider,
} from "../../test-support/desktop-hand-off.ts";
import { startFakeProviders, type FakeProviders } from "../../test-support/fake-providers.ts";
import { MICROSOFT_CONSUMER_TENANT } from "./provider-profile.ts";

const SLOW = { timeout: 60_000 };
const PASSWORD = "correct horse battery";
const WORK_TENANT = "11111111-2222-3333-4444-555555555555";
let t: AuthTestApp;
let fake: FakeProviders;

beforeAll(async () => {
  fake = await startFakeProviders();
  t = await startAuthTestApp({ providers: ["google", "microsoft"] });
}, 60_000);

afterAll(async () => {
  await t.close();
  await fake.stop();
}, 60_000);

afterEach(() => {
  vi.useRealTimers();
});

const google = (email: string, extra: object = {}) => ({
  sub: `google-${email}`,
  email,
  email_verified: true,
  name: "Provider Person",
  ...extra,
});
const microsoft = (email: string, extra: object = {}) => ({
  sub: `ms-sub-${email}`,
  oid: `ms-${email}`,
  tid: WORK_TENANT,
  xms_edov: true,
  email,
  name: "Provider Person",
  ...extra,
});
const errorCode = (response: { json: <T>() => T }) => response.json<{ error: { code: string } }>().error.code;

async function query<T extends Record<string, unknown>>(statement: ReturnType<typeof sql>) {
  return rowsOf<T>(t.database.db, statement);
}
const usersWith = async (email: string) =>
  (await query<{ id: string }>(sql`select id from "user" where email = ${email.toLowerCase()}`)).map((row) => row.id);
const providerAccounts = async (userId: string) =>
  (await query<{ provider_id: string }>(sql`select provider_id from account where user_id = ${userId}`)).map(
    (row) => row.provider_id,
  );

/** The whole normal path; returns the app's answer and the browser that was used. */
async function signInThroughBrowser(provider: "google" | "microsoft", person: Record<string, unknown>) {
  const handOff = await initHandOff(t.app, provider);
  const browser = new TestBrowser();
  const page = await throughProvider({ app: t.app, fake }, browser, handOff.requestId, person);
  const pressed = await pressOnPage(t.app, browser, handOff.requestId, "continue");
  return { handOff, browser, page, pressed, answer: await exchange(t.app, handOff) };
}

describe("TC-F01-17 [AC-F01-07] browser hand-off, normal path", () => {
  it(
    "TC-F01-17 [AC-F01-07] same code on the page; pending until Continue; one new session; browser keeps none",
    SLOW,
    async () => {
      const email = testEmail("handoff");
      const handOff = await initHandOff(t.app, "google");
      expect(handOff.matchCode).toMatch(/^\d{4}$/);
      expect(handOff.startUrl).toMatch(new RegExp(`/api/v1/auth/desktop/start\\?request=${handOff.requestId}$`));
      expect((await exchange(t.app, handOff)).statusCode).toBe(202);

      const browser = new TestBrowser();
      const page = await throughProvider({ app: t.app, fake }, browser, handOff.requestId, google(email));
      expect(page.statusCode).toBe(200);
      expect(page.body).toContain(handOff.matchCode);
      expect(page.headers["cache-control"]).toBe("no-store");
      expect(page.headers["content-security-policy"]).toContain("default-src 'none'");
      const browserAfterReturn = await t.app.inject({ url: "/api/v1/me", headers: { cookie: browser.cookie } });
      expect(browserAfterReturn.statusCode).toBe(401);
      expect((await exchange(t.app, handOff)).statusCode).toBe(202);

      const pressed = await pressOnPage(t.app, browser, handOff.requestId, "continue");
      expect(pressed.body).toContain("You can close this tab");
      expect(pressed.headers["cache-control"]).toBe("no-store");
      const answer = await exchange(t.app, handOff);
      expect(answer.statusCode).toBe(200);
      expect(answer.json<{ user: { email: string } }>().user.email).toBe(email.toLowerCase());
      const token = String(answer.headers["set-auth-token"]);
      expect((await t.app.inject({ url: "/api/v1/me", headers: bearer(token) })).statusCode).toBe(200);

      expect((await exchange(t.app, handOff)).statusCode).toBe(404);
      const browserSession = await t.app.inject({ url: "/api/v1/me", headers: { cookie: browser.cookie } });
      expect(browserSession.statusCode).toBe(401);
    },
  );
});

describe("TC-F01-15 [AC-F01-07] [AC-F01-14] first sign-in with a provider creates the account", () => {
  it(
    "TC-F01-15 [AC-F01-07] a verified email, a personal workspace, a provider login, terms still to accept",
    SLOW,
    async () => {
      const email = testEmail("first");
      const { answer } = await signInThroughBrowser("google", google(email));
      const me = answer.json<{ user: { id: string; termsAccepted: boolean } }>();
      expect(me.user.termsAccepted).toBe(false);
      const [user] = await query<{ email_verified: boolean }>(
        sql`select email_verified from "user" where id = ${me.user.id}`,
      );
      expect(user?.email_verified).toBe(true);
      expect(await providerAccounts(me.user.id)).toEqual(["google"]);
      const personal = await query(
        sql`select 1 from workspaces w join workspace_members m on m.workspace_id = w.id where w.kind = 'personal' and m.user_id = ${me.user.id}`,
      );
      expect(personal).toHaveLength(1);
    },
  );
});

describe("TC-F01-18 [AC-F01-07] cancel and time-out", () => {
  it("TC-F01-18 [AC-F01-07] (a) Cancel in the browser: 410 and the new account is removed again", SLOW, async () => {
    const email = testEmail("cancel-page");
    const handOff = await initHandOff(t.app, "google");
    const browser = new TestBrowser();
    await throughProvider({ app: t.app, fake }, browser, handOff.requestId, google(email));
    expect(await usersWith(email)).toHaveLength(1);
    const pressed = await pressOnPage(t.app, browser, handOff.requestId, "cancel");
    expect(pressed.body).toContain("Sign-in was cancelled");
    const answer = await exchange(t.app, handOff);
    expect(answer.statusCode).toBe(410);
    expect(errorCode(answer)).toBe("SIGN_IN_CANCELLED");
    expect(await usersWith(email)).toHaveLength(0);
  });

  it("TC-F01-18 [AC-F01-07] (b) the provider refuses: 410 and nothing is created", SLOW, async () => {
    const handOff = await initHandOff(t.app, "google");
    const browser = new TestBrowser();
    const start = await t.app.inject({ url: `/api/v1/auth/desktop/start?request=${handOff.requestId}` });
    browser.keep(start);
    const state = new URL(String(start.headers.location)).searchParams.get("state") ?? "";
    const refused = await t.app.inject({
      url: `/api/auth/callback/google?error=access_denied&state=${state}`,
      headers: { cookie: browser.cookie },
    });
    browser.keep(refused);
    const back = new URL(String(refused.headers.location));
    const page = await t.app.inject({ url: back.pathname + back.search, headers: { cookie: browser.cookie } });
    expect(page.body).toContain("Sign-in was cancelled");
    expect(errorCode(await exchange(t.app, handOff))).toBe("SIGN_IN_CANCELLED");
  });

  it("TC-F01-18 [AC-F01-07] (c) the app cancels: the request and the new account are gone", SLOW, async () => {
    const email = testEmail("cancel-app");
    const handOff = await initHandOff(t.app, "google");
    const browser = new TestBrowser();
    await throughProvider({ app: t.app, fake }, browser, handOff.requestId, google(email));
    const cancelled = await t.app.inject({
      method: "POST",
      url: "/api/v1/auth/desktop/cancel",
      payload: { requestId: handOff.requestId, verifier: handOff.verifier },
    });
    expect(cancelled.statusCode).toBe(204);
    expect((await exchange(t.app, handOff)).statusCode).toBe(404);
    expect(await usersWith(email)).toHaveLength(0);
    expect((await pressOnPage(t.app, browser, handOff.requestId, "continue")).body).toContain("isn't valid");
  });

  it("TC-F01-18 [AC-F01-07] (d) after 5 minutes the sign-in is cancelled and its account removed", SLOW, async () => {
    const email = testEmail("timeout");
    const handOff = await initHandOff(t.app, "google");
    await throughProvider({ app: t.app, fake }, new TestBrowser(), handOff.requestId, google(email));
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 5 * 60 * 1_000 + 1_000);
    const answer = await exchange(t.app, handOff);
    expect(answer.statusCode).toBe(410);
    expect(await usersWith(email)).toHaveLength(0);
  });
});

describe("TC-F01-19 [AC-F01-07] [AC-F01-34] hand-off attacks fail", () => {
  it(
    "TC-F01-19 [AC-F01-34] (a) a wrong verifier deletes the request; (b) unknown ids look the same",
    SLOW,
    async () => {
      const handOff = await initHandOff(t.app, "google");
      const wrong = await exchange(t.app, { requestId: handOff.requestId, verifier: "x".repeat(43) });
      const unknown = await exchange(t.app, { requestId: crypto.randomUUID(), verifier: handOff.verifier });
      expect([wrong.statusCode, unknown.statusCode]).toEqual([404, 404]);
      expect(wrong.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
      expect(unknown.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
      expect((await exchange(t.app, handOff)).statusCode).toBe(404);
    },
  );

  it("TC-F01-19 [AC-F01-34] (c) the start link works only within 60 s, and only once", SLOW, async () => {
    const late = await initHandOff(t.app, "google");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 61_000);
    const tooLate = await t.app.inject({ url: `/api/v1/auth/desktop/start?request=${late.requestId}` });
    expect(tooLate.statusCode).toBe(400);
    vi.useRealTimers();

    const once = await initHandOff(t.app, "google");
    const url = `/api/v1/auth/desktop/start?request=${once.requestId}`;
    expect((await t.app.inject({ url })).statusCode).toBe(302);
    expect((await t.app.inject({ url })).statusCode).toBe(400);
  });

  it(
    "TC-F01-19 [AC-F01-34] (d, e) a browser without the cookie gets nowhere; neither does a POST without it",
    SLOW,
    async () => {
      const email = testEmail("no-cookie");
      const handOff = await initHandOff(t.app, "google");
      const victim = new TestBrowser();
      await throughProvider({ app: t.app, fake }, victim, handOff.requestId, google(email));
      const withoutBinding = victim.cookie
        .split("; ")
        .filter((cookie) => !cookie.startsWith("meetapp_desktop_sign_in="))
        .join("; ");
      const page = await t.app.inject({
        url: `/api/v1/auth/desktop/done?request=${handOff.requestId}`,
        headers: { cookie: withoutBinding },
      });
      expect(page.body).toContain("isn't valid");
      expect(page.body).not.toContain(handOff.matchCode);
      const post = await t.app.inject({
        method: "POST",
        url: "/api/v1/auth/desktop/done",
        payload: `request=${handOff.requestId}&action=continue`,
        headers: { cookie: withoutBinding, "content-type": "application/x-www-form-urlencoded" },
      });
      expect(post.body).toContain("isn't valid");
      expect((await exchange(t.app, handOff)).statusCode).toBe(202);
    },
  );

  it("TC-F01-19 [AC-F01-34] a return carrying an error leaves no session in the browser", SLOW, async () => {
    const email = testEmail("error-return");
    const handOff = await initHandOff(t.app, "google");
    const browser = new TestBrowser();
    const context = { app: t.app, fake, extraQuery: "&error=access_denied" };
    const page = await throughProvider(context, browser, handOff.requestId, google(email));
    expect(page.body).toContain("Sign-in was cancelled");
    expect((await t.app.inject({ url: "/api/v1/me", headers: { cookie: browser.cookie } })).statusCode).toBe(401);
    expect(errorCode(await exchange(t.app, handOff))).toBe("SIGN_IN_CANCELLED");
    expect(await usersWith(email)).toHaveLength(0);
  });

  it("TC-F01-19 [AC-F01-34] (f) a finished request can't be used again", SLOW, async () => {
    const { handOff, browser } = await signInThroughBrowser("google", google(testEmail("reuse")));
    expect((await exchange(t.app, handOff)).statusCode).toBe(404);
    expect((await pressOnPage(t.app, browser, handOff.requestId, "continue")).body).toContain("isn't valid");
    const start = await t.app.inject({ url: `/api/v1/auth/desktop/start?request=${handOff.requestId}` });
    expect(start.statusCode).toBe(400);
  });
});

describe("TC-F01-21 [AC-F01-08] a provider with an existing email enters the same account", () => {
  it("TC-F01-21 [AC-F01-08] same user, provider linked, password still works", SLOW, async () => {
    const email = testEmail("link");
    const userId = await createUser(t.auth, { email, password: PASSWORD });
    const { answer } = await signInThroughBrowser("microsoft", microsoft(email));
    expect(answer.statusCode).toBe(200);
    expect(answer.json<{ user: { id: string } }>().user.id).toBe(userId);
    expect(await usersWith(email)).toEqual([userId]);
    expect((await providerAccounts(userId)).sort()).toEqual(["credential", "microsoft"]);
    await expect(signIn(t.app, email, PASSWORD)).resolves.toBeTypeOf("string");
  });
});

describe("TC-F01-22 [AC-F01-08] unverified provider emails are refused", () => {
  const refusals: [string, "google" | "microsoft", (email: string) => Record<string, unknown>][] = [
    ["(a) Google email_verified false", "google", (email) => google(email, { email_verified: false })],
    ["(b) Microsoft work account without xms_edov", "microsoft", (email) => microsoft(email, { xms_edov: undefined })],
    ["(b) Microsoft work account with xms_edov false", "microsoft", (email) => microsoft(email, { xms_edov: false })],
    ["(d) no email at all", "google", (email) => google(email, { email: undefined })],
  ];

  it.each(refusals)(
    "TC-F01-22 [AC-F01-08] %s: refused, nothing created or linked",
    SLOW,
    async (_, provider, person) => {
      const existing = testEmail("unverified-existing");
      const userId = await createUser(t.auth, { email: existing, password: PASSWORD });
      for (const email of [existing, testEmail("unverified-new")]) {
        const { page, answer } = await signInThroughBrowser(provider, person(email));
        expect(page.body).toContain("isn't verified");
        expect(answer.statusCode).toBe(410);
        expect(errorCode(answer)).toBe("PROVIDER_EMAIL_UNVERIFIED");
      }
      expect(await providerAccounts(userId)).toEqual(["credential"]);
      expect(await usersWith(existing)).toEqual([userId]);
    },
  );

  it("TC-F01-22 [AC-F01-08] (c) a personal Microsoft account is accepted", SLOW, async () => {
    const email = testEmail("consumer");
    const person = microsoft(email, { tid: MICROSOFT_CONSUMER_TENANT, xms_edov: undefined });
    const { answer } = await signInThroughBrowser("microsoft", person);
    expect(answer.statusCode).toBe(200);
  });
});

describe("TC-F01-33 [AC-F01-13] provider sign-ins and the wrong-password lock", () => {
  it("TC-F01-33 [AC-F01-13] a locked email can't get in through Google either", SLOW, async () => {
    const email = testEmail("locked");
    await createUser(t.auth, { email, password: PASSWORD });
    for (let attempt = 0; attempt < 5; attempt++) {
      await t.app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        payload: { email, password: "not the password" },
        headers: { origin: "app://meetapp" },
      });
    }
    const { answer } = await signInThroughBrowser("google", google(email));
    expect(answer.statusCode).toBe(410);
    expect(errorCode(answer)).toBe("TOO_MANY_ATTEMPTS");
  });
});

describe("TC-F01-20 [AC-F01-07] provider buttons follow the settings", () => {
  const cases: [string, ("google" | "microsoft")[], { google: boolean; microsoft: boolean }][] = [
    ["(a) no keys", [], { google: false, microsoft: false }],
    ["(b) only Google", ["google"], { google: true, microsoft: false }],
  ];

  it.each(cases)("TC-F01-20 [AC-F01-07] %s", SLOW, async (_, providers, expected) => {
    const other = await startAuthTestApp({ providers });
    try {
      const listed = await other.app.inject({ url: "/api/v1/auth/providers" });
      expect(listed.json()).toEqual(expected);
      for (const provider of ["google", "microsoft"] as const) {
        const init = await other.app.inject({
          method: "POST",
          url: "/api/v1/auth/desktop/init",
          payload: { provider, challenge: "a".repeat(64) },
        });
        expect(init.statusCode).toBe(expected[provider] ? 200 : 404);
      }
      const social = await other.app.inject({
        method: "POST",
        url: "/api/auth/sign-in/social",
        payload: { provider: "google" },
      });
      expect(social.statusCode).toBe(404);
      const email = testEmail("no-providers");
      await createUser(other.auth, { email, password: PASSWORD });
      await expect(signIn(other.app, email, PASSWORD)).resolves.toBeTypeOf("string");
    } finally {
      await other.close();
    }
  });

  it("TC-F01-20 [AC-F01-07] (c) both", async () => {
    expect((await t.app.inject({ url: "/api/v1/auth/providers" })).json()).toEqual({ google: true, microsoft: true });
  });
});
