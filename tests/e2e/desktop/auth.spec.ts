// The page can't reach the sign-in token (F01 T8, AC-F01-34): TC-F01-84. A real account is created
// through `window.meetapp.auth` (the code comes from the fake inbox); then the token main keeps is looked
// for everywhere the page can see. Needs the backend and Mailpit, so it runs from `pnpm test`.
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { closeApp, freshProfile, launch } from "./desktop.ts";

const API_URL = process.env["MEETAPP_E2E_API_URL"];
const MAILPIT_URL = process.env["MEETAPP_E2E_MAILPIT_URL"];
const PASSWORD = "correct horse battery";

interface AuthBridge {
  startSignUp: (form: object) => Promise<{ ok: boolean; signupId?: string }>;
  finishSignUp: (signupId: string, code: string) => Promise<Record<string, unknown>>;
  signOut: () => Promise<unknown>;
}
type PageWindow = Window & { meetapp: { auth: AuthBridge } };

/** The newest 6-digit code sent to `email`, from Mailpit. */
async function codeFor(email: string): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const query = encodeURIComponent(`to:"${email}"`);
    const found = (await (await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}`)).json()) as {
      messages: { Subject: string }[];
    };
    const code = found.messages.map((message) => /\b(\d{6})\b/.exec(message.Subject)?.[1]).find(Boolean);
    if (code) return code;
    await new Promise((done) => setTimeout(done, 200));
  }
  throw new Error(`no code email to ${email}`);
}

/** The token main keeps, read and decrypted inside main; undefined when it lives only in memory. */
function storedToken(app: ElectronApplication, profile: string): Promise<string | undefined> {
  return app.evaluate(
    ({ safeStorage }, file) => {
      const fs = process.getBuiltinModule("node:fs");
      return fs.existsSync(file) ? safeStorage.decryptString(fs.readFileSync(file)) : undefined;
    },
    join(profile, "auth-token"),
  );
}

/** Everything the page itself can read: its storages, cookies, databases and window properties. */
function pageVisible(page: Page): Promise<string> {
  return page.evaluate(async () =>
    JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
      cookie: document.cookie,
      databases: await indexedDB.databases(),
      windowKeys: Object.keys(window),
    }),
  );
}

const pageFetch = (page: Page, url: string, method = "GET") =>
  page.evaluate(
    async ([address, verb]) => {
      try {
        const response = await fetch(address, {
          method: verb,
          headers: { "content-type": "application/json" },
          body: verb === "POST" ? "{}" : null,
        });
        return response.status;
      } catch {
        return "blocked";
      }
    },
    [url, method] as const,
  );

test("TC-F01-84 [AC-F01-34] the page never sees the token; main adds it; token routes are cancelled", async () => {
  test.skip(!API_URL || !MAILPIT_URL, "needs the backend and Mailpit; runs from `pnpm test`");
  const profile = freshProfile();
  const { app, page } = await launch(profile, { VITE_API_URL: API_URL ?? "" });
  const seen: string[] = [];
  page.on("response", (response) => {
    seen.push(JSON.stringify(response.headers()));
    response.text().then(
      (body) => seen.push(body),
      () => undefined,
    );
  });

  const email = `e2e-${randomUUID()}@example.test`;
  const started = await page.evaluate(
    ([address, password]) =>
      (window as unknown as PageWindow).meetapp.auth.startSignUp({
        email: address,
        name: "E2E Person",
        password,
        termsAccepted: true,
      }),
    [email, PASSWORD] as const,
  );
  expect(started).toMatchObject({ ok: true });
  const code = await codeFor(email);
  const finished = await page.evaluate(
    ([id, value]) => (window as unknown as PageWindow).meetapp.auth.finishSignUp(id, value),
    [started.signupId ?? "", code] as const,
  );
  expect(Object.keys(finished).sort()).toEqual(["ok", "user"]);
  expect(finished).toMatchObject({ ok: true, user: { email } });

  // Main adds the token to the page's own requests to the backend.
  expect(await pageFetch(page, `${API_URL}/api/v1/me`)).toBe(200);
  // Routes that hand out a token are cancelled before they leave the computer.
  for (const path of [
    "/api/auth/sign-in/email",
    "/api/v1/auth/sign-up/verify",
    "/api/v1/auth/desktop/exchange",
    "/api/v1/me/password",
  ]) {
    expect(await pageFetch(page, `${API_URL}${path}`, "POST"), path).toBe("blocked");
  }

  const token = await storedToken(app, profile);
  const everything = [...seen, await pageVisible(page), JSON.stringify(finished)].join("\n");
  expect(everything).not.toContain("set-auth-token");
  if (token !== undefined) {
    expect(everything).not.toContain(token);
    expect(everything).not.toContain(decodeURIComponent(token).split(".")[0]);
  }

  await page.evaluate(() => (window as unknown as PageWindow).meetapp.auth.signOut());
  expect(await pageFetch(page, `${API_URL}/api/v1/me`)).toBe(401);
  expect(await storedToken(app, profile)).toBeUndefined();
  await closeApp(app);
});

test("TC-F01-84 [AC-F01-34] an embedded frame gets no bridge", async () => {
  const { app, page } = await launch();
  const inFrame = await page.evaluate(async () => {
    const frame = document.createElement("iframe");
    document.body.append(frame);
    await new Promise((done) => setTimeout(done, 100));
    return typeof (frame.contentWindow as unknown as { meetapp?: unknown } | null)?.meetapp;
  });
  expect(inFrame).toBe("undefined");
  await closeApp(app);
});
