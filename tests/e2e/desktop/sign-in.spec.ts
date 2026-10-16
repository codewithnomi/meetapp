// The sign-in screens in the real desktop window, against the real backend and fake inbox (F01 T9):
// TC-F01-01 create an account with the emailed code; TC-F01-14 sign out, sign in with the password,
// then with a code. Needs the backend and Mailpit, so it runs from `pnpm test`.
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { closeApp, codeFor, launch } from "./desktop.ts";

const API_URL = process.env["MEETAPP_E2E_API_URL"];
const MAILPIT_URL = process.env["MEETAPP_E2E_MAILPIT_URL"];
const PASSWORD = "correct horse battery";

const title = (page: Page, name: string) => page.getByRole("heading", { level: 1, name });

async function typeCode(page: Page, email: string, since: Date) {
  const code = await codeFor(email, since);
  await page.getByRole("textbox", { name: "Digit 1 of 6" }).fill(code);
  await page.getByRole("button", { name: "Confirm" }).click();
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(title(page, "Sign in to MeetApp")).toBeVisible();
}

async function emailStep(page: Page, email: string) {
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("button", { name: "Continue with email" }).click();
  await expect(title(page, "Enter your password")).toBeVisible();
}

test("TC-F01-01 [AC-F01-01] [AC-F01-04] TC-F01-14 [AC-F01-05] [AC-F01-06] create an account, sign out, sign in with the password and with a code", async () => {
  test.skip(!API_URL || !MAILPIT_URL, "needs the backend and Mailpit; runs from `pnpm test`");
  test.setTimeout(90_000);
  const { app, page } = await launch(undefined, { VITE_API_URL: API_URL ?? "" });
  const email = `e2e-${randomUUID()}@example.test`;
  await expect(title(page, "Sign in to MeetApp")).toBeVisible();

  // Create an account (TC-F01-01).
  await page.getByRole("link", { name: "Create an account" }).click();
  // Wait for the new screen: Sign in has an "Email" box too.
  await expect(title(page, "Create your account")).toBeVisible();
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("textbox", { name: "Your name" }).fill("E2E Person");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("checkbox").check();
  let since = new Date();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(title(page, "Confirm your email")).toBeVisible();
  await typeCode(page, email, since);
  await expect(title(page, "Personal")).toBeVisible();

  // Password sign-in; a wrong one first (TC-F01-14).
  await signOut(page);
  await emailStep(page, email);
  await page.getByLabel("Password").fill("not the password at all");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toContainText("Email or password is wrong");
  await page.getByLabel("Password").fill(PASSWORD);
  // AC-F01-05: the right password reaches the home screen within 3 seconds.
  const started = Date.now();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(title(page, "Personal")).toBeVisible();
  expect(Date.now() - started).toBeLessThan(3_000);

  // Code sign-in (TC-F01-14).
  await signOut(page);
  await emailStep(page, email);
  since = new Date();
  await page.getByRole("button", { name: "Email me a code instead" }).click();
  await expect(title(page, "Sign in with a code")).toBeVisible();
  await typeCode(page, email, since);
  await expect(title(page, "Personal")).toBeVisible();
  await closeApp(app);
});
