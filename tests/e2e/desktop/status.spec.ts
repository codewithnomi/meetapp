// F04 T8: the status menu on the person's picture (TC-F04-43, 44). Olivia has a chat with Mo open and
// reads Mo's status from the chat's header.
import { expect, test, type Page } from "@playwright/test";
import { closeApp, type RunningApp } from "./desktop.ts";
import { controls, meetNow } from "./meeting-steps.ts";
import { team, windowFor } from "./meeting-team.ts";
import { chatWith, inWorkspace } from "./call-window-steps.ts";

test.describe.configure({ timeout: 180_000 });

let windows: RunningApp[] = [];
test.afterEach(async () => {
  await Promise.all(windows.map((running) => closeApp(running.app)));
  windows = [];
});

/** Picks a status (and for how long) from the picture menu at the top right. */
async function pick(page: Page, status: string | null, duration?: string) {
  await page.getByRole("button", { name: /^Your account: / }).click();
  await page.getByRole("menuitem", { name: /Available|Busy|Do not disturb|Be right back|Away|In a call/ }).click();
  // A duration is chosen first (it closes the menu), then the status, which keeps it.
  if (duration) {
    await page.getByRole("menuitemradio", { name: duration }).click();
    await pick(page, status);
  } else if (status) await page.getByRole("menuitemradio", { name: status }).click();
  else await page.getByRole("menuitem", { name: "Reset status" }).click();
}

const header = (page: Page) => page.getByRole("banner").or(page.locator("header")).first();

async function oliviaWatchingMo() {
  const people = await team();
  const olivia = await windowFor(people.owner);
  const mo = await windowFor(people.member);
  windows.push(olivia, mo);
  await Promise.all([olivia, mo].map((w) => inWorkspace(w.page, people.workspace)));
  await chatWith(olivia.page, "Mo", /Mo Member/);
  return { people, olivia, mo };
}

test("TC-F04-44 [AC-F04-20, AC-F04-21] Do not disturb for 30 minutes, then Reset, both seen within 5 s", async () => {
  const { olivia, mo } = await oliviaWatchingMo();
  await pick(mo.page, "Do not disturb", "30 minutes");
  await expect(header(olivia.page).getByRole("img", { name: "Do not disturb" })).toBeVisible({ timeout: 5_000 });
  await pick(mo.page, null);
  await expect(header(olivia.page).getByRole("img", { name: "Available" })).toBeVisible({ timeout: 5_000 });
});

test("TC-F04-43 [AC-F04-23] in a call Mo shows In a call, unless Mo set Busy", async () => {
  const { olivia, mo } = await oliviaWatchingMo();
  await meetNow(mo.page);
  await expect(controls(mo.page)).toBeVisible();
  await expect(header(olivia.page).getByRole("img", { name: "In a call" })).toBeVisible({ timeout: 10_000 });
  await pick(mo.page, "Busy");
  await expect(header(olivia.page).getByRole("img", { name: "Busy" })).toBeVisible({ timeout: 5_000 });
  await pick(mo.page, null);
  await controls(mo.page).getByRole("button", { name: "Leave", exact: true }).click();
  await expect(header(olivia.page).getByRole("img", { name: "Available" })).toBeVisible({ timeout: 10_000 });
});
