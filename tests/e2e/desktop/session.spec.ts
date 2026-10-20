// Staying signed in and signing out in the real desktop app (F01 T10, AC-F01-11, 12): TC-F01-30 a restart
// keeps the person signed in, and a revoked session shows Sign in; TC-F01-32 Sign out and Sign out
// everywhere with two app windows. Needs the backend, so it runs from `pnpm test`.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { closeApp, freshProfile, launch, launchSignedIn, storedToken } from "./desktop.ts";

const API_URL = process.env["MEETAPP_E2E_API_URL"];
const title = (page: Page, name: string) => page.getByRole("heading", { level: 1, name });

async function openSettings(page: Page) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(title(page, "Settings")).toBeVisible();
}

test("TC-F01-30 [AC-F01-11] a restart keeps the person signed in; a revoked session shows Sign in", async () => {
  const profile = freshProfile();
  const first = await launchSignedIn(profile);
  const token = await storedToken(first.app, profile);
  test.skip(token === undefined, "this computer can't encrypt the token (no keyring), so it is kept in memory only");
  await closeApp(first.app);

  const again = await launch(profile, { VITE_API_URL: API_URL ?? "" });
  await expect(title(again.page, "Personal")).toBeVisible();
  await closeApp(again.app);

  // The session ends on the server (e.g. Sign out everywhere on another computer).
  const ended = await fetch(`${API_URL ?? ""}/api/v1/auth/sign-out-everywhere`, {
    method: "POST",
    headers: { authorization: `Bearer ${token ?? ""}`, "content-type": "application/json", origin: "app://meetapp" },
    body: "{}",
  });
  expect(ended.status).toBe(204);
  const third = await launch(profile, { VITE_API_URL: API_URL ?? "" });
  await expect(title(third.page, "Sign in to MeetApp")).toBeVisible();
  expect(existsSync(join(profile, "auth-token"))).toBe(false);
  await closeApp(third.app);
});

test("TC-F01-32 [AC-F01-12] Sign out ends only this window; Sign out everywhere reaches the other within 1 minute", async () => {
  test.setTimeout(120_000);
  const a = await launchSignedIn(freshProfile());
  const b = await launchSignedIn(freshProfile());

  await openSettings(a.page);
  await a.page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(title(a.page, "Sign in to MeetApp")).toBeVisible();
  await b.page.reload();
  await expect(title(b.page, "Personal")).toBeVisible();
  await closeApp(a.app);

  const again = await launchSignedIn(freshProfile());
  await openSettings(again.page);
  await again.page.getByRole("button", { name: "Sign out everywhere" }).click();
  await expect(title(again.page, "Sign in to MeetApp")).toBeVisible();
  // Window B notices on its next check (every 30 seconds), without a reload.
  await expect(title(b.page, "Sign in to MeetApp")).toBeVisible({ timeout: 60_000 });
  await closeApp(again.app);
  await closeApp(b.app);
});
