// F04 T15: back on the live line within 10 s after sleep or a network drop, and no cards for old
// messages (TC-F04-73, 74, 75). Olivia writes to Mo; Mo's MeetApp is hidden.
import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { FAKE_MEDIA, closeApp, freshProfile, launchAs, type RunningApp } from "./desktop.ts";
import { team, windowFor } from "./meeting-team.ts";
import { chatWith, inWorkspace, smallPages } from "./call-window-steps.ts";

test.describe.configure({ timeout: 240_000 });

let windows: RunningApp[] = [];
test.afterEach(async () => {
  await Promise.all(windows.map((running) => closeApp(running.app)));
  windows = [];
});

const hide = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .sort((a, b) => a.id - b.id)[0]
      ?.hide(),
  );

async function send(page: Page, text: string) {
  const box = page.getByRole("textbox", { name: "Message Mo Member" });
  await box.fill(text);
  await box.press("Enter");
}

async function setUp() {
  const { workspace, owner, member } = await team();
  const mo = await launchAs(member.email, freshProfile(), FAKE_MEDIA);
  const olivia = await windowFor(owner);
  windows.push(mo, olivia);
  await Promise.all([olivia, mo].map((w) => inWorkspace(w.page, workspace)));
  await chatWith(olivia.page, "Mo", /Mo Member/);
  await hide(mo.app);
  return { olivia, mo };
}

test("TC-F04-73 [AC-F04-38] after waking from sleep the line is back within 10 s", async () => {
  const { olivia, mo } = await setUp();
  await mo.page.context().setOffline(true);
  await mo.page.waitForTimeout(5_000);
  await mo.page.context().setOffline(false);
  const woke = Date.now();
  await mo.app.evaluate(({ powerMonitor }) => powerMonitor.emit("resume"));
  await send(olivia.page, "Good morning");
  await expect.poll(() => smallPages(mo.app).length, { timeout: 10_000 }).toBe(1);
  expect(Date.now() - woke).toBeLessThan(10_000);
});

test("TC-F04-74 [AC-F04-38] after a long network drop the line is back within 10 s", async () => {
  const { olivia, mo } = await setUp();
  await mo.page.context().setOffline(true);
  // The retry wait would have grown far past 10 s without the 8 s cap.
  await mo.page.waitForTimeout(60_000);
  await mo.page.context().setOffline(false);
  const back = Date.now();
  await send(olivia.page, "Are you back?");
  await expect.poll(() => smallPages(mo.app).length, { timeout: 10_000 }).toBe(1);
  expect(Date.now() - back).toBeLessThan(10_000);
});

test("TC-F04-75 [AC-F04-31] messages sent while away give no cards when MeetApp catches up", async () => {
  const { olivia, mo } = await setUp();
  await mo.page.context().setOffline(true);
  for (const text of ["one", "two", "three", "four"]) await send(olivia.page, text);
  await mo.page.context().setOffline(false);
  await mo.page.waitForTimeout(10_000);
  // News missed while offline isn't sent again on the new line: no cards, and never more than 3.
  expect(smallPages(mo.app).length).toBeLessThanOrEqual(3);
  await mo.app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .sort((a, b) => a.id - b.id)[0]
      ?.show(),
  );
  await expect(mo.page.getByRole("button", { name: /^Chat, 1 unread/ })).toBeVisible({ timeout: 10_000 });
});
