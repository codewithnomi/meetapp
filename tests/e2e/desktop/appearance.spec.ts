// Theme and accent in the real window (AC-F00-08, 09, 10): TC-F00-16, 17, 19, 20, 21.
import { expect, test, type Page } from "@playwright/test";
import { closeApp, freshProfile, htmlData, launch, launchSignedIn, resolvedColor } from "./desktop.ts";

const SWITCH_MS = 1000;
/** The 8 accents (design tokens) with the names the Settings screen shows. */
const ACCENTS = [
  ["sky", "Sky blue"],
  ["blue", "Blue"],
  ["purple", "Purple"],
  ["pink", "Pink"],
  ["red", "Red"],
  ["orange", "Orange"],
  ["green", "Green"],
  ["teal", "Teal"],
] as const;

async function openSettings(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
}

/** Waits until the choice is saved in the profile, so closing the app right after can't lose it. */
async function saved(page: Page, field: "theme" | "accent", value: string): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("meetapp.appearance")), { timeout: SWITCH_MS })
    .toContain(`"${field}":"${value}"`);
}

const background = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test("TC-F00-16 [AC-F00-08] Dark applies at once without a reload and is remembered after a restart", async () => {
  const profile = freshProfile();
  const first = await launchSignedIn(profile);
  await openSettings(first.page);
  await first.page.evaluate(() => ((window as { marker?: number }).marker = 1));
  const lightBackground = await background(first.page);

  await first.page.getByRole("radio", { name: "Dark" }).click();
  await expect.poll(() => htmlData(first.page), { timeout: SWITCH_MS }).toMatchObject({ theme: "dark" });
  expect(await background(first.page)).not.toBe(lightBackground);
  expect(await background(first.page)).toBe(await resolvedColor(first.page, "var(--bg)"));
  expect(await first.page.evaluate(() => (window as { marker?: number }).marker)).toBe(1);
  await saved(first.page, "theme", "dark");
  await closeApp(first.app);

  const again = await launch(profile);
  expect(await htmlData(again.page)).toMatchObject({ theme: "dark" });
  await closeApp(again.app);
});

test("TC-F00-17 [AC-F00-08] a saved dark theme is set before the screen is drawn", async () => {
  const profile = freshProfile();
  const first = await launchSignedIn(profile);
  await openSettings(first.page);
  await first.page.getByRole("radio", { name: "Dark" }).click();
  await saved(first.page, "theme", "dark");
  await closeApp(first.app);

  const again = await launch(profile);
  await again.page.context().addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const root = document.getElementById("root");
      (window as { atStart?: object }).atStart = {
        theme: document.documentElement.dataset["theme"],
        drawn: (root?.childElementCount ?? 0) > 0,
      };
    });
  });
  await again.page.reload();
  await expect
    .poll(() => again.page.evaluate(() => (window as { atStart?: object }).atStart))
    .toEqual({
      theme: "dark",
      drawn: false,
    });
  await closeApp(again.app);
});

test("TC-F00-19 [AC-F00-09] 'Same as my computer' follows the computer; 'Light' does not", async () => {
  const { app, page } = await launchSignedIn();
  await expect(page.getByRole("heading", { level: 1, name: "MeetApp" })).toBeVisible();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => htmlData(page), { timeout: SWITCH_MS }).toMatchObject({ theme: "dark" });
  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => htmlData(page), { timeout: SWITCH_MS }).toMatchObject({ theme: "light" });
  expect(await background(page)).toBe(await resolvedColor(page, "var(--bg)"));

  await openSettings(page);
  await page.getByRole("radio", { name: "Light" }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(SWITCH_MS);
  expect(await htmlData(page)).toMatchObject({ theme: "light" });
  await closeApp(app);
});

test("TC-F00-20 [AC-F00-10] each of the 8 accents applies at once and the last one is remembered", async () => {
  const profile = freshProfile();
  const first = await launchSignedIn(profile);
  await openSettings(first.page);
  // A fixed theme: if the Mac switched light/dark mid-test, the expected colors would go stale.
  await first.page.getByRole("radio", { name: "Light" }).click();
  await expect.poll(() => htmlData(first.page), { timeout: SWITCH_MS }).toMatchObject({ theme: "light" });
  const button = first.page.getByRole("button", { name: "Start meeting" });
  for (const [accent, name] of ACCENTS) {
    await first.page.getByRole("radio", { name, exact: true }).click();
    await expect.poll(() => htmlData(first.page), { timeout: SWITCH_MS }).toMatchObject({ accent });
    const accentColor = await resolvedColor(first.page, "var(--accent)");
    await expect(button).toHaveCSS("background-color", accentColor);
    await expect(first.page.getByRole("button", { name: "Copy invite link" })).toHaveCSS(
      "color",
      await resolvedColor(first.page, "var(--accent-text)"),
    );
  }
  await saved(first.page, "accent", "teal");
  await closeApp(first.app);

  const again = await launch(profile);
  expect(await htmlData(again.page)).toMatchObject({ accent: "teal" });
  await closeApp(again.app);
});

test("TC-F00-21 [AC-F00-10] a new user gets sky blue, with dark text on the main button", async () => {
  const { app, page } = await launchSignedIn();
  expect(await htmlData(page)).toMatchObject({ accent: "sky" });
  await openSettings(page);
  const onAccent = await resolvedColor(page, "var(--on-accent)");
  await expect(page.getByRole("button", { name: "Start meeting" })).toHaveCSS("color", onAccent);
  // Dark text: the average of its red, green and blue parts is well below the middle (white would be 255).
  const channels = (onAccent.match(/\d+/g) ?? []).slice(0, 3).map(Number);
  expect(channels.reduce((sum, value) => sum + value, 0) / 3).toBeLessThan(128);
  await closeApp(app);
});
