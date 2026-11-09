// F04 T8: the status menu on the person's picture (TC-F04-43, 44). Olivia has a chat with Mo open and
// reads Mo's status from the chat's header.
import { expect, test, type Page } from "@playwright/test";
import { closeApp, type RunningApp } from "./desktop.ts";
import { controls, meetNow } from "./meeting-steps.ts";
import { team, windowFor } from "./meeting-team.ts";
import { chatWith, inWorkspace } from "./call-window-steps.ts";
import { pickStatus, statusFromMenuBar } from "./status-steps.ts";

test.describe.configure({ timeout: 180_000 });

let windows: RunningApp[] = [];
test.afterEach(async () => {
  await Promise.all(windows.map((running) => closeApp(running.app)));
  windows = [];
});

const CALL_CHECK_MS = 40_000;

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
  await pickStatus(mo.page, "Do not disturb", "30 minutes");
  await expect(header(olivia.page).getByRole("img", { name: "Do not disturb" })).toBeVisible({ timeout: 5_000 });
  await pickStatus(mo.page, null);
  await expect(header(olivia.page).getByRole("img", { name: "Available" })).toBeVisible({ timeout: 5_000 });
});

test("TC-F04-43 [AC-F04-23] in a call Mo shows In a call, unless Mo set Busy", async () => {
  const { olivia, mo } = await oliviaWatchingMo();
  await meetNow(mo.page);
  await expect(controls(mo.page)).toBeVisible();
  // Calls are noticed by the server's status check every 30 seconds (F14 design).
  await expect(header(olivia.page).getByRole("img", { name: "In a call" })).toBeVisible({ timeout: CALL_CHECK_MS });
  // The meeting fills the screen, so the status is set from the menu-bar menu (AC-F04-05), as main sends it.
  await statusFromMenuBar(mo, "busy");
  await expect(header(olivia.page).getByRole("img", { name: "Busy" })).toBeVisible({ timeout: 5_000 });
  await statusFromMenuBar(mo, "available");
  await controls(mo.page).getByRole("button", { name: "Leave", exact: true }).click();
  await expect(header(olivia.page).getByRole("img", { name: "Available" })).toBeVisible({ timeout: CALL_CHECK_MS });
});
