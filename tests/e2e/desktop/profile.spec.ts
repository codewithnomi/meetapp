// Profile and look in the real desktop app (F01 T16): TC-F01-68 a new name and photo show at once in
// the person's own window, in a teammate's People screen within a minute, and in the person's other
// window; an oversize file shows the exact rule. TC-F01-69 the look follows the account to another
// computer, a new account starts with the computer's look, and sign-out keeps the last look. Needs the
// backend and Mailpit, so it runs from `pnpm test`.
import { request, expect, test, type Page } from "@playwright/test";
import { closeApp, freshProfile, htmlData, launch, launchAs, launchNewAccount, storedToken } from "./desktop.ts";
import { acceptInvitation, createWorkspace, inviteByEmail, openScreen, title } from "./workspace-steps.ts";

const WITHIN_A_MINUTE = { timeout: 65_000 };
/** A 1×1 PNG. */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const TOO_BIG = Buffer.concat([TINY_PNG, Buffer.alloc(5 * 1024 * 1024)]);
const RULE = "Use a JPEG, PNG or WebP image up to 5 MB.";

async function openProfile(page: Page) {
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(title(page, "Settings")).toBeVisible();
}

const choosePhoto = (page: Page, buffer: Buffer) =>
  page.locator('input[type="file"]').setInputFiles({ name: "me.png", mimeType: "image/png", buffer });

/** A photo that really loaded (the main process added the sign-in token to its request). */
const loadedPhoto = (page: Page, scope = page.locator("main")) =>
  expect(scope.locator("img").first()).toHaveJSProperty("naturalWidth", 512, WITHIN_A_MINUTE);

test("TC-F01-68 [AC-F01-25] name and photo show at once here, to a teammate within a minute, and in another window", async () => {
  test.setTimeout(240_000);
  const u = await launchNewAccount();
  await createWorkspace(u.page, "Personal", "Photo Co");
  const v = await launchNewAccount();
  await inviteByEmail(u.page, v.email);
  await acceptInvitation(v.page, "Personal", "Photo Co");
  const third = await launchAs(u.email);

  await openProfile(u.page);
  await choosePhoto(u.page, TOO_BIG);
  await expect(u.page.getByRole("alert")).toHaveText(RULE);
  await u.page.getByRole("textbox", { name: "Your name" }).fill("Uma Photo");
  await u.page.getByRole("button", { name: "Save name" }).click();
  await expect(u.page.getByText("Name saved.")).toBeVisible();
  await choosePhoto(u.page, TINY_PNG);
  await loadedPhoto(u.page);

  await openScreen(v.page, "People");
  const uRow = v.page.getByRole("row", { name: /Uma Photo/ });
  await expect(uRow).toBeVisible(WITHIN_A_MINUTE);
  await loadedPhoto(v.page, uRow);
  await expect(v.page.getByRole("row", { name: new RegExp(v.email) })).toContainText("EP");

  await openProfile(third.page);
  await expect(third.page.getByRole("textbox", { name: "Your name" })).toHaveValue("Uma Photo");
  await loadedPhoto(third.page);
});

/** Sets this computer's look before anyone signs in (as a user would in a fresh app). */
async function computerLook(profile: string, theme: string, accent: string) {
  const { app, page } = await launch(profile);
  await page.evaluate(
    ([t, a]) => window.localStorage.setItem("meetapp.appearance", JSON.stringify({ theme: t, accent: a })),
    [theme, accent] as const,
  );
  await closeApp(app);
}

async function chooseLook(page: Page, theme: string, accent: string) {
  await openProfile(page);
  await page.getByRole("button", { name: "Appearance" }).click();
  await page.getByRole("radio", { name: theme }).click();
  await page.getByRole("radio", { name: accent, exact: true }).click();
}

test("TC-F01-69 [AC-F01-26] the look follows the account; a new account takes the computer's; sign-out keeps the last", async () => {
  test.setTimeout(180_000);
  const a = await launchNewAccount();
  await chooseLook(a.page, "Dark", "Green");
  await expect.poll(() => htmlData(a.page)).toMatchObject({ theme: "dark", accent: "green" });
  await a.page.waitForTimeout(1_000);
  await closeApp(a.app);

  const computerB = freshProfile();
  await computerLook(computerB, "light", "blue");
  const b = await launchAs(a.email, computerB);
  await expect(title(b.page, "Personal")).toBeVisible();
  await expect.poll(() => htmlData(b.page)).toMatchObject({ theme: "dark", accent: "green" });
  await openProfile(b.page);
  await b.page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(b.page.getByRole("heading", { level: 1, name: /Sign in/ })).toBeVisible();
  expect(await htmlData(b.page)).toMatchObject({ theme: "dark", accent: "green" });
  await closeApp(b.app);

  const computerC = freshProfile();
  await computerLook(computerC, "light", "blue");
  const c = await launchNewAccount(computerC);
  const token = await storedToken(c.app, computerC);
  test.skip(token === undefined, "this computer can't encrypt the token (no keyring)");
  const api = await request.newContext({
    baseURL: process.env["MEETAPP_E2E_API_URL"] ?? "",
    extraHTTPHeaders: { authorization: `Bearer ${token ?? ""}`, origin: "app://meetapp" },
  });
  const me = (await (await api.get("/api/v1/me")).json()) as { user: { theme: string; accent: string } };
  expect(me.user).toMatchObject({ theme: "light", accent: "blue" });
  await api.dispose();
});
