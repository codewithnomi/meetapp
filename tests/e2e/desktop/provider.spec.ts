// Google/Microsoft sign-in in the real desktop app (F01 T10, AC-F01-07): TC-F01-23. The test backend's
// Microsoft sign-in points at a local fake provider started here (tools/test.ts sets the address). The
// test plays the computer's browser: it opens the link the app wanted to open, signs in at the fake
// provider, checks the page shows the app's code, and presses Continue.
import { randomUUID } from "node:crypto";
import { expect, request, test, type APIRequestContext, type ElectronApplication, type Page } from "@playwright/test";
import { Events, OAuth2Server } from "oauth2-mock-server";
import { closeApp, freshProfile, launch } from "./desktop.ts";

const API_URL = process.env["MEETAPP_E2E_API_URL"];
const PROVIDER_PORT = Number(process.env["MEETAPP_E2E_FAKE_PROVIDER_PORT"] ?? 0);
const WORK_TENANT = "11111111-2222-3333-4444-555555555555";

let provider: OAuth2Server | undefined;
let person: Record<string, unknown> = {};

test.beforeAll(async () => {
  if (!API_URL || !PROVIDER_PORT) return;
  // Microsoft's own paths, so the backend's Microsoft sign-in works against it unchanged.
  provider = new OAuth2Server(undefined, undefined, {
    endpoints: { authorize: "/common/oauth2/v2.0/authorize", token: "/common/oauth2/v2.0/token" },
  });
  await provider.issuer.keys.generate("RS256");
  await provider.start(PROVIDER_PORT, "127.0.0.1");
  provider.service.on(Events.BeforeTokenSigning, (token: { payload: Record<string, unknown> }) => {
    Object.assign(token.payload, person);
  });
});

test.afterAll(async () => {
  await provider?.stop();
});

/** Instead of really opening the browser, main records the link it would open. */
async function recordOpenedLinks(app: ElectronApplication): Promise<() => Promise<string[]>> {
  await app.evaluate(({ shell }) => {
    const opened: string[] = [];
    (globalThis as { opened?: string[] }).opened = opened;
    shell.openExternal = async (url: string) => void opened.push(url);
  });
  return () => app.evaluate(() => (globalThis as { opened?: string[] }).opened ?? []);
}

/** One step of the browser trip, without following redirects (the provider's `iss` is dropped, as Microsoft's "common" sends none). */
async function step(browser: APIRequestContext, url: string): Promise<string> {
  const answer = await browser.get(url, { maxRedirects: 0 });
  const next = new URL(answer.headers()["location"] ?? "", url);
  next.searchParams.delete("iss");
  return next.href;
}

/** The browser: start link → fake Microsoft → back to the backend → the confirm page. */
async function browserSignIn(browser: APIRequestContext, startUrl: string): Promise<string> {
  const atProvider = await step(browser, startUrl);
  const backAtBackend = await step(browser, atProvider);
  const donePage = await step(browser, backAtBackend);
  return (await browser.get(donePage)).text();
}

const title = (page: Page, name: string) => page.getByRole("heading", { level: 1, name });

test("TC-F01-23 [AC-F01-07] Continue with Microsoft: same code in the app and the browser; signed in, Terms, then home", async () => {
  test.skip(!API_URL || !PROVIDER_PORT, "needs the backend with the fake provider; runs from `pnpm test`");
  const email = `e2e-ms-${randomUUID()}@example.test`;
  person = {
    sub: `sub-${email}`,
    oid: `oid-${email}`,
    tid: WORK_TENANT,
    xms_edov: true,
    email,
    name: "Provider Person",
  };
  const { app, page } = await launch(freshProfile(), { VITE_API_URL: API_URL ?? "" });
  const opened = await recordOpenedLinks(app);

  await page.getByRole("button", { name: "Continue with Microsoft" }).click();
  await expect(title(page, "Finish signing in in your browser")).toBeVisible();
  const code = await page.getByLabel("Code").textContent();
  expect(code).toMatch(/^\d{4}$/);
  await expect.poll(opened).toHaveLength(1);
  const [startUrl = ""] = await opened();

  const browser = await request.newContext();
  const confirmPage = await browserSignIn(browser, startUrl);
  expect(confirmPage).toContain(code ?? "-");
  const requestId = new URL(startUrl).searchParams.get("request") ?? "";
  const started = Date.now();
  const pressed = await browser.post(`${API_URL}/api/v1/auth/desktop/done`, {
    form: { request: requestId, action: "continue" },
  });
  expect(await pressed.text()).toContain("You can close this tab");

  // A first Google/Microsoft sign-in accepts the terms first (AC-F01-07).
  await expect(title(page, "Before you start")).toBeVisible({ timeout: 5_000 });
  expect(Date.now() - started).toBeLessThan(5_000);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(title(page, "MeetApp")).toBeVisible();
  await browser.dispose();
  await closeApp(app);
});

test("TC-F01-23 [AC-F01-07] Cancel in the app returns to Sign in with 'Sign-in was cancelled'", async () => {
  test.skip(!API_URL || !PROVIDER_PORT, "needs the backend with the fake provider; runs from `pnpm test`");
  const { app, page } = await launch(freshProfile(), { VITE_API_URL: API_URL ?? "" });
  await recordOpenedLinks(app);
  await page.getByRole("button", { name: "Continue with Microsoft" }).click();
  await expect(title(page, "Finish signing in in your browser")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(title(page, "Sign in to MeetApp")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Sign-in was cancelled.");
  await closeApp(app);
});
