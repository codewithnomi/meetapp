// TC-F02-88 [AC-F02-44]: the meeting flow with the keyboard only (Tab, Enter, Esc and the shortcuts);
// the focused control always shows the focus ring, and a dialog hands the focus back when it closes.
// Needs the backend and Mailpit (`pnpm test`). The first sign-in uses the test bridge (no mouse either).
import { expect, test, type Locator, type Page } from "@playwright/test";
import { FAKE_MEDIA, launch, launchNewAccount } from "./desktop.ts";
import { LINK, SHORTCUT, controls, joinAsGuest } from "./meeting-steps.ts";

test.describe.configure({ timeout: 180_000 });

async function tabTo(page: Page, target: Locator) {
  for (let presses = 0; presses < 60; presses++) {
    if (await target.evaluate((e) => e === document.activeElement)) {
      expect(await target.evaluate((e) => e.matches(":focus-visible"))).toBe(true);
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error(`Tab never reached ${String(target)}`);
}

const press = async (page: Page, target: Locator) => {
  await tabTo(page, target);
  await page.keyboard.press("Enter");
};

test("TC-F02-88 [AC-F02-44] create, join, shortcuts, panels, admit and leave work with the keyboard; dialogs return focus", async () => {
  const me = await launchNewAccount(undefined, undefined, FAKE_MEDIA);
  const { page } = me;
  await page.getByRole("button", { name: "Meetings" }).focus();
  await page.keyboard.press("Enter");

  // A dialog opens with Enter, closes with Esc and gives the focus back.
  const getLink = page.getByRole("button", { name: "Get link" });
  await press(page, getLink);
  const dialog = page.getByRole("dialog", { name: "Your meeting link is ready" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  // Soft: pressing Enter on the button makes it "loading" (disabled), which drops the focus, so the dialog
  // has nowhere to give it back (see the report). The share dialog below proves the hand-back itself.
  await expect.soft(getLink).toBeFocused();

  await press(page, page.getByRole("button", { name: "Meet now" }));
  await expect(page.getByRole("heading", { level: 1, name: /^Meeting with / })).toBeFocused();
  await press(page, page.getByRole("button", { name: "Join now" }));
  await expect(controls(page)).toBeVisible({ timeout: 20_000 });

  await page.keyboard.press(`${SHORTCUT}+M`);
  await expect(controls(page).getByRole("button", { name: /^Unmute/ })).toBeVisible();
  await page.keyboard.press(`${SHORTCUT}+M`);
  await expect(controls(page).getByRole("button", { name: /^Mute/ })).toBeVisible();
  await page.keyboard.press(`${SHORTCUT}+O`);
  await expect(controls(page).getByRole("button", { name: /^Turn camera on/ })).toBeVisible();
  await page.keyboard.press(`${SHORTCUT}+K`);
  await expect(controls(page).getByRole("button", { name: /^Lower your hand/ })).toBeVisible();

  // A side panel moves the focus to its title; Esc closes it and the focus goes back to the opener.
  const people = page.getByRole("button", { name: /^Participants, / });
  await press(page, people);
  await expect(page.getByRole("heading", { name: /^Participants \(/ })).toBeFocused();
  // A short moment: an Esc pressed in the same instant the panel opened was seen to be ignored.
  await page.waitForTimeout(500);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: /^Participants \(/ })).toBeHidden();
  await expect(people).toBeFocused();
  await press(page, people);
  await expect(page.getByRole("heading", { name: /^Participants \(/ })).toBeVisible();
  // The share dialog should give the focus back to its button when Esc closes it.
  const share = controls(page).getByRole("button", { name: "Share screen" });
  await press(page, share);
  await expect(page.getByRole("dialog", { name: "Choose what to share" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Choose what to share" })).toBeHidden();
  // Soft: focus lands on the page body instead of the button (see the report).
  await expect.soft(share).toBeFocused();

  await press(page, page.getByRole("button", { name: "Close participants" }));
  await press(page, page.getByRole("button", { name: "Meeting info" }));
  const link = (await page.getByText(LINK).textContent()) ?? "";
  await press(page, page.getByRole("button", { name: "Close meeting info" }));

  // A guest waits; the organizer admits with the keyboard.
  const guest = await launch(undefined, { VITE_API_URL: process.env["MEETAPP_E2E_API_URL"] ?? "" }, FAKE_MEDIA);
  await joinAsGuest(guest.page, link);
  const lobby = page.getByRole("region", { name: "Lobby" });
  await expect(lobby).toContainText("Leo Guest", { timeout: 15_000 });
  await press(page, lobby.getByRole("button", { name: "Admit all" }));
  await expect(controls(guest.page)).toBeVisible({ timeout: 20_000 });

  await press(page, controls(page).getByRole("button", { name: "Leave", exact: true }));
  await expect(page.getByRole("heading", { level: 1, name: "Meetings" })).toBeVisible();
});
