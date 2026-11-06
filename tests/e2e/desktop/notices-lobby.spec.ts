// F04 T14: lobby cards (TC-F04-45 lobby part, 62). Olivia hosts a meeting with her window behind other
// apps; a guest waits in the lobby.
import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { closeApp, type RunningApp } from "./desktop.ts";
import { controls } from "./meeting-steps.ts";
import { guestWindow, hostMeeting, team } from "./meeting-team.ts";
import { smallPages } from "./call-window-steps.ts";

test.describe.configure({ timeout: 180_000 });

let windows: RunningApp[] = [];
test.afterEach(async () => {
  await Promise.all(windows.map((running) => closeApp(running.app)));
  windows = [];
});

const hide = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.hide());
const visible = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible() ?? false);
const lobbyCard = (app: ElectronApplication) => smallPages(app).find((page) => !page.isClosed()) as Page | undefined;

async function guestWaiting() {
  const { host, link } = await hostMeeting(await team());
  windows.push(host);
  await hide(host.app);
  const guest = await guestWindow(link, "Lee Guest");
  windows.push(guest);
  return { host, guest };
}

test("TC-F04-62 [AC-F04-34] Admit on the card lets the guest in without bringing MeetApp forward", async () => {
  const { host, guest } = await guestWaiting();
  await expect.poll(() => smallPages(host.app).length, { timeout: 15_000 }).toBe(1);
  const card = lobbyCard(host.app) as Page;
  await expect(card.getByText("Lee Guest")).toBeVisible();
  await expect(card.getByText("Guest", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Admit" }).click();
  await expect(controls(guest.page)).toBeVisible({ timeout: 20_000 });
  expect(await visible(host.app)).toBe(false);
  await expect.poll(() => smallPages(host.app).length).toBe(0);
});

test("TC-F04-62 [AC-F04-34] View lobby brings the meeting forward with the people list", async () => {
  const { host } = await guestWaiting();
  await expect.poll(() => smallPages(host.app).length, { timeout: 15_000 }).toBe(1);
  await (lobbyCard(host.app) as Page).getByRole("button", { name: "View lobby" }).click();
  await expect.poll(() => visible(host.app)).toBe(true);
  await expect(host.page.getByText("Lee Guest").first()).toBeVisible({ timeout: 5_000 });
});

test("TC-F04-45 [AC-F04-22] Do not disturb: no lobby card; the guest still shows in the list", async () => {
  const people = await team();
  const { host, link } = await hostMeeting(people);
  windows.push(host);
  await host.page.getByRole("button", { name: /^Your account: / }).click();
  await host.page.getByRole("menuitem", { name: /Available|In a call/ }).click();
  await host.page.getByRole("menuitemradio", { name: "Do not disturb" }).click();
  await hide(host.app);
  windows.push(await guestWindow(link, "Lee Guest"));
  await host.page.waitForTimeout(5_000);
  expect(smallPages(host.app)).toHaveLength(0);
  await host.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.show());
  await expect(host.page.getByText(/1 person waiting|Lee Guest/).first()).toBeVisible({ timeout: 15_000 });
});
