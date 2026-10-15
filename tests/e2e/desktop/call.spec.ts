// The first real call (F02 T14): two app windows signed in to the same account (two participants, as in
// Teams, AC-F02-13) meet: Meet now in one, the link from Meeting info in the other. Each sees and hears
// the other (Chromium's stand-in camera and microphone), mute and a raised hand reach the other window,
// and Leave takes the person out. TC-F02-42, 43, 44 (path), 47 (hand), 89 (shortcut).
import { expect, test, type Page } from "@playwright/test";
import { FAKE_MEDIA, launchAs, launchNewAccount } from "./desktop.ts";

test.describe.configure({ timeout: 180_000 });

async function meetNow(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Meetings" }).click();
  await page.getByRole("button", { name: "Meet now" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /^Meeting with / })).toBeVisible();
  await page.getByRole("button", { name: "Join now" }).click();
  await expect(page.getByRole("group", { name: "Meeting controls" })).toBeVisible({ timeout: 20_000 });
}

async function joinByLink(page: Page, link: string): Promise<void> {
  await page.getByRole("button", { name: "Meetings" }).click();
  await page.getByRole("radio", { name: "Link" }).click();
  await page.getByLabel("Meeting link").fill(link);
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await page.getByRole("button", { name: "Join now" }).click();
  await expect(page.getByRole("group", { name: "Meeting controls" })).toBeVisible({ timeout: 20_000 });
}

/** How many videos in the window are really playing a picture. */
const playingVideos = (page: Page) =>
  page.evaluate(
    () => [...document.querySelectorAll("video")].filter((v) => v.readyState >= 2 && v.videoWidth > 0).length,
  );

const tile = (page: Page, name: RegExp) => page.getByRole("figure", { name });

test("TC-F02-42 [AC-F02-12] [AC-F02-13] [AC-F02-22] [AC-F02-23] two windows meet, see each other, and see mute and a hand", async () => {
  const first = await launchNewAccount(undefined, undefined, FAKE_MEDIA);
  await meetNow(first.page);
  await first.page.getByRole("button", { name: "Meeting info" }).click();
  const link = (await first.page.getByText(/\/m\/[\w-]{22}$/).textContent()) ?? "";
  expect(link).toMatch(/\/m\//);

  const second = await launchAs(first.email, undefined, FAKE_MEDIA);
  await joinByLink(second.page, link);

  for (const { page } of [first, second]) {
    await expect(page.getByRole("figure")).toHaveCount(2, { timeout: 20_000 });
    await expect.poll(() => playingVideos(page), { timeout: 20_000 }).toBe(2);
  }

  // Mute with the shortcut in the first window; the second sees it within a few seconds.
  await first.page.keyboard.press(process.platform === "darwin" ? "Meta+Shift+M" : "Control+Shift+M");
  await expect(tile(second.page, /^E2E Person, .*Muted/)).toBeVisible({ timeout: 5_000 });

  await second.page.getByRole("button", { name: /^Raise your hand/ }).click();
  await expect(tile(first.page, /^E2E Person, .*Hand raised/)).toBeVisible({ timeout: 5_000 });

  await second.page.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(first.page.getByRole("figure")).toHaveCount(1, { timeout: 30_000 });
});
