// F04 T6: meeting links clicked on the computer (TC-F04-25, 28, 31, 34). The test hands a link to the
// running app the way the system does: `open-url` (Mac) or a second start's arguments (Windows).
import { expect, test, type ElectronApplication } from "@playwright/test";
import { closeApp, type RunningApp } from "./desktop.ts";
import { controls } from "./meeting-steps.ts";
import { hostMeeting, team, windowFor } from "./meeting-team.ts";

test.describe.configure({ timeout: 180_000 });

let windows: RunningApp[] = [];
test.afterEach(async () => {
  await Promise.all(windows.map((running) => closeApp(running.app)));
  windows = [];
});

/** The link as the Mac delivers a click (`open-url`) or as Windows does (a second start's arguments). */
const deliver = (app: ElectronApplication, link: string, how: "mac" | "windows") =>
  app.evaluate(
    ({ app: electron }, [url, way]) => {
      if (way === "mac") electron.emit("open-url", { preventDefault: () => undefined }, url);
      else electron.emit("second-instance", {}, ["MeetApp.exe", url], process.cwd());
    },
    [link, how] as const,
  );

const hide = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.hide());
const visible = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible() ?? false);

test("TC-F04-25 TC-F04-34 [AC-F04-10, AC-F04-12] a copied link opens the pre-join on the hidden app within 3 s, both ways, joining nothing", async () => {
  const people = await team();
  const { host, link } = await hostMeeting(people);
  windows.push(host);
  expect(link).toMatch(/^meetapp:\/\/m\/[\w-]{22}$/);
  const member = await windowFor(people.member);
  windows.push(member);
  for (const how of ["mac", "windows"] as const) {
    await hide(member.app);
    const sent = Date.now();
    await deliver(member.app, link, how);
    await expect(member.page.getByRole("button", { name: "Join now" })).toBeVisible({ timeout: 3_000 });
    expect(Date.now() - sent).toBeLessThan(3_000);
    expect(await visible(member.app)).toBe(true);
    await member.page.getByRole("button", { name: "Meetings" }).click();
  }
  // Nothing was joined: the organizer is still alone.
  await expect(host.page.getByRole("figure")).toHaveCount(1);
});

test("TC-F04-31 [AC-F04-11] other meetapp:// addresses only bring MeetApp to the front", async () => {
  const people = await team();
  const member = await windowFor(people.member);
  windows.push(member);
  const before = member.page.url();
  for (const link of [
    "meetapp://settings",
    "meetapp://call/1",
    "meetapp://m/x/../admin",
    `meetapp://m/${"a".repeat(10_000)}`,
  ]) {
    await hide(member.app);
    await deliver(member.app, link, "mac");
    await expect.poll(() => visible(member.app)).toBe(true);
  }
  expect(member.page.url()).toBe(before);
  await expect(member.page.getByRole("button", { name: "Join now" })).toHaveCount(0);
});

test("TC-F04-28 [AC-F04-10] a link during a call keeps the call; Meetings then opens that meeting's pre-join", async () => {
  const people = await team();
  const first = await hostMeeting(people);
  windows.push(first.host);
  const second = await hostMeeting({ ...people, owner: people.member });
  windows.push(second.host);
  await deliver(second.host.app, first.link, "mac");
  await expect.poll(() => visible(second.host.app)).toBe(true);
  await expect(controls(second.host.page)).toBeVisible();
  await expect(second.host.page.getByRole("button", { name: "Join now" })).toHaveCount(0);
});
