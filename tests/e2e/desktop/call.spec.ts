// The first real call (F02 T14): two app windows signed in to the same account (two participants, as in
// Teams, AC-F02-13) meet: Meet now in one, the link from Meeting info in the other. Each sees and hears
// the other (Chromium's stand-in camera and microphone), mute and a raised hand reach the other window,
// sharing goes through our picker, and End meeting tells the other window. TC-F02-42, 43, 44 (path), 47 (hand), 89 (shortcut).
import { expect, test, type Page } from "@playwright/test";
import { FAKE_MEDIA, launch, launchAs, launchNewAccount } from "./desktop.ts";
import { joinByLink, meetNow, playingVideos, tile } from "./meeting-steps.ts";

test.describe.configure({ timeout: 180_000 });

/** macOS asks before the first screen capture; a test can't answer, so sharing is checked only once allowed. */
const screenAllowed = (page: Page) =>
  page.evaluate(async () => {
    const media = (window as { meetapp?: { media?: { accessStatus: () => Promise<{ screen: string }> } } }).meetapp
      ?.media;
    return (await media?.accessStatus())?.screen === "granted";
  });

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

  // Sharing through our picker (where the system allows screen capture): the button turns into Stop sharing.
  if (process.platform !== "darwin" || (await screenAllowed(first.page))) {
    await first.page.getByRole("button", { name: "Share screen" }).click();
    await first.page.getByRole("radiogroup", { name: "Screens" }).getByRole("radio").first().click();
    await first.page.getByRole("button", { name: "Share", exact: true }).click();
    await expect(first.page.getByRole("button", { name: "Stop sharing" })).toBeVisible({ timeout: 15_000 });
  }

  // Device settings from More: noise suppression on by default, and it can be switched off (AC-F02-30).
  await first.page.getByRole("button", { name: "More options" }).click();
  const noise = first.page.getByRole("switch", { name: "Noise suppression" });
  await expect(noise).toBeChecked();
  await noise.click();
  await expect(noise).not.toBeChecked();
  await expect(first.page.getByRole("combobox", { name: "Microphone" })).toBeVisible();

  // End meeting, after confirming: the other window is told.
  await first.page.getByRole("button", { name: "More ways to leave" }).click();
  await first.page.getByRole("menuitem", { name: "End meeting" }).click();
  await first.page.getByRole("dialog").getByRole("button", { name: "End meeting" }).click();
  await expect(second.page.getByRole("heading", { name: "The meeting has ended" })).toBeVisible({ timeout: 15_000 });
});

async function joinAsGuest(page: Page, link: string): Promise<void> {
  await page.getByRole("link", { name: "Join a meeting" }).click();
  await page.getByRole("radio", { name: "Link" }).click();
  await page.getByLabel("Meeting link").fill(link);
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await page.getByLabel("Your name").fill("Leo Guest");
  await page.getByRole("button", { name: "Join now" }).click();
}

test("TC-F02-32 [AC-F02-15] [AC-F02-33] [AC-F02-35] a guest waits, is let in, muted and removed by the organizer", async () => {
  const host = await launchNewAccount(undefined, undefined, FAKE_MEDIA);
  await meetNow(host.page);
  await host.page.getByRole("button", { name: "Meeting info" }).click();
  const link = (await host.page.getByText(/\/m\/[\w-]{22}$/).textContent()) ?? "";

  const guest = await launch(undefined, { VITE_API_URL: process.env["MEETAPP_E2E_API_URL"] ?? "" }, FAKE_MEDIA);
  await joinAsGuest(guest.page, link);
  await expect(guest.page.getByText("Someone in the meeting will let you in soon.")).toBeVisible();
  // The lobby bar names the guest; nothing about the meeting's people reaches the guest.
  const lobby = host.page.getByRole("region", { name: "Lobby" });
  await expect(lobby).toContainText("Leo Guest (Guest)", { timeout: 15_000 });
  await lobby.getByRole("button", { name: "Admit all" }).click();
  await expect(guest.page.getByRole("group", { name: "Meeting controls" })).toBeVisible({ timeout: 20_000 });

  await host.page.getByRole("button", { name: /^Participants, / }).click();
  const menu = host.page.getByRole("button", { name: "Actions for Leo Guest (Guest)" });
  await menu.click();
  await host.page.getByRole("menuitem", { name: "Mute" }).click();
  await expect(guest.page.getByText(/muted you$/)).toBeVisible({ timeout: 10_000 });

  await menu.click();
  await host.page.getByRole("menuitem", { name: "Remove from meeting" }).click();
  await expect(guest.page.getByRole("heading", { name: "You were removed from the meeting" })).toBeVisible({
    timeout: 15_000,
  });
});
