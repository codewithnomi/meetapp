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
  app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .sort((a, b) => a.id - b.id)[0]
      ?.hide(),
  );
const visible = (app: ElectronApplication) =>
  app.evaluate(
    ({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .sort((a, b) => a.id - b.id)[0]
        ?.isVisible() ?? false,
  );

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
    await member.page.getByRole("button", { name: "Cancel" }).click();
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

// F17 replaced AC-F04-10's waiting: a link during a call opens that meeting's pre-join at once, the call
// running on in the small call view; Cancel goes back untouched, Leave call and join leaves first.
test("TC-F04-28 TC-F17-27 TC-F17-30 TC-F17-32 TC-F17-31 [AC-F04-10, AC-F17-11, 12] a link during a call opens its pre-join; Cancel keeps the call; Leave call and join moves", async () => {
  const people = await team();
  const first = await hostMeeting(people);
  windows.push(first.host);
  const second = await hostMeeting({ ...people, owner: people.member });
  windows.push(second.host);
  const mo = second.host.page;
  const sent = Date.now();
  await deliver(second.host.app, first.link, "mac");
  await expect(mo.getByText(/^You're in .+\. Joining this meeting leaves it\.$/)).toBeVisible({ timeout: 3_000 });
  expect(Date.now() - sent).toBeLessThan(3_000);
  await expect(mo.getByRole("region", { name: /^Call: / })).toBeVisible();
  // TC-F17-30: the preview shares the camera with the call, or says the camera is busy with it.
  await expect(
    mo
      .getByText(/^Camera in use by your current call/)
      .or(mo.getByRole("main").locator("video"))
      .first(),
  ).toBeVisible({ timeout: 10_000 });
  // Cancel: back where Mo was; the call never stopped.
  await mo.getByRole("button", { name: "Cancel" }).click();
  await expect(controls(mo)).toBeVisible();
  // Again, and this time leave and join Olivia's meeting.
  await deliver(second.host.app, first.link, "mac");
  await mo.getByRole("button", { name: "Leave call and join" }).click();
  await expect(controls(mo)).toBeVisible({ timeout: 20_000 });
  await expect(first.host.page.getByRole("figure", { name: /^Mo Member/ })).toBeVisible({ timeout: 20_000 });
  await expect(mo.getByRole("region", { name: /^Call: / })).toHaveCount(0);
});

test("TC-F17-48 [AC-F04-11, AC-F17-11] a bad link during a call changes nothing", async () => {
  const people = await team();
  const { host } = await hostMeeting(people);
  windows.push(host);
  await deliver(host.app, "meetapp://m/x/../admin", "mac");
  await expect(controls(host.page)).toBeVisible();
  await expect(host.page.getByRole("button", { name: "Leave call and join" })).toHaveCount(0);
});
