// F17 Browse during a call (AC-F17-01–06, 14, 19, 20): Mo, in Olivia's meeting, opens other screens from
// the side menu beside the call; the call keeps running (Olivia's window sees nothing change), the small
// call view shows at the bottom right with mute, camera and Leave, and one click brings the full call back.
// TC-F17-01, 02, 06, 09, 10, 14, 17, 18, 25, 34, 35, 36, 37, 39.
import { expect, test, type Page } from "@playwright/test";
import { chatWith, putAway } from "./call-window-steps.ts";
import { closeApp, type RunningApp } from "./desktop.ts";
import { SHORTCUT, admitAll, controls, playingVideos, tile } from "./meeting-steps.ts";
import { actOn, hostMeeting, joinWindow, knock, openPeople, team, windowFor } from "./meeting-team.ts";

test.describe.configure({ timeout: 240_000 });

let windows: RunningApp[] = [];
test.afterEach(async () => {
  await Promise.all(windows.map((running) => closeApp(running.app)));
  windows = [];
});

const menu = (page: Page) => page.getByRole("navigation", { name: "Main" });
const small = (page: Page) => page.getByRole("region", { name: /^Call: / });
const smallButton = (page: Page, name: string | RegExp) => small(page).getByRole("button", { name });

async function meeting() {
  const people = await team();
  const { host, link } = await hostMeeting(people);
  const mo = await joinWindow(people.member, link);
  windows.push(host, mo);
  await expect(tile(host.page, /^Mo Member/)).toBeVisible({ timeout: 20_000 });
  return { people, host, mo, link };
}

/** Olivia still sees Mo in the call, unmuted, with video playing. */
async function stillThere(host: Page) {
  await expect(tile(host, /^Mo Member/)).toBeVisible();
  await expect(tile(host, /^Mo Member, .*Muted/)).toHaveCount(0);
  await expect.poll(() => playingVideos(host), { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
}

test("TC-F17-01 TC-F17-02 TC-F17-09 [AC-F17-01, 02, 03] every screen opens during a call; the call goes on; back within 1 s", async () => {
  const { host, mo } = await meeting();
  for (const item of ["Home", "Chat", "Meetings", "People", "Settings"]) {
    await menu(mo.page)
      .getByRole("button", { name: new RegExp(`^${item}`) })
      .first()
      .click();
    await expect(small(mo.page)).toBeVisible();
    await expect(controls(mo.page)).toBeHidden();
    await stillThere(host.page);
    const began = Date.now();
    await smallButton(mo.page, /^Go back to the /).click();
    await expect(controls(mo.page)).toBeVisible();
    expect(Date.now() - began).toBeLessThan(1_000);
    await expect(small(mo.page)).toHaveCount(0);
  }
  // Olivia's window never showed Mo leaving.
  await expect(host.page.getByText("Mo Member left")).toHaveCount(0);
});

test("TC-F17-10 TC-F17-11 TC-F17-06 [AC-F17-02, 04] the small view's buttons and the shortcuts act on the call", async () => {
  const { host, mo } = await meeting();
  await openPeople(mo.page);
  await menu(mo.page).getByRole("button", { name: /^Chat/ }).first().click();
  await smallButton(mo.page, /^Mute/).click();
  await expect(tile(host.page, /^Mo Member, .*Muted/)).toBeVisible({ timeout: 5_000 });
  await expect(smallButton(mo.page, /^Unmute/)).toBeVisible({ timeout: 1_000 });
  // The mute shortcut works on the Chat screen too.
  await mo.page.keyboard.press(`${SHORTCUT}+M`);
  await expect(tile(host.page, /^Mo Member, .*Muted/)).toHaveCount(0, { timeout: 5_000 });
  await smallButton(mo.page, /^Turn camera off/).click();
  await expect(smallButton(mo.page, /^Turn camera on/)).toBeVisible({ timeout: 1_000 });
  // The full call shows the same state, with the panel it had open.
  await smallButton(mo.page, /^Go back to the /).click();
  await expect(controls(mo.page).getByRole("button", { name: /^Turn camera on/ })).toBeVisible();
  await expect(mo.page.getByRole("heading", { name: /^Participants \(/ })).toBeVisible();
});

test("TC-F17-14 [AC-F17-05] Leave in the small view leaves; Mo stays on Chat", async () => {
  const { host, mo } = await meeting();
  await menu(mo.page).getByRole("button", { name: /^Chat/ }).first().click();
  await smallButton(mo.page, /^Leave the /).click();
  await expect(tile(host.page, /^Mo Member/)).toHaveCount(0, { timeout: 10_000 });
  await expect(small(mo.page)).toHaveCount(0);
  await expect(mo.page.getByRole("heading", { level: 1, name: "Chat" })).toBeVisible();
});

test("TC-F17-17 [AC-F17-06] removed while on People: a banner on People, the small view gone", async () => {
  const { host, mo } = await meeting();
  await menu(mo.page)
    .getByRole("button", { name: /^People/ })
    .first()
    .click();
  await actOn(host.page, "Mo Member", "Remove from meeting");
  await expect(mo.page.getByText("You were removed from the meeting")).toBeVisible({ timeout: 10_000 });
  await expect(small(mo.page)).toHaveCount(0);
  await expect(mo.page.getByRole("heading", { level: 1, name: "People" })).toBeVisible();
});

test("TC-F17-34 TC-F17-35 TC-F17-36 [AC-F17-14, 19] behind other apps, the mini window shows; back to the call shows it full", async () => {
  const { host, mo } = await meeting();
  await menu(mo.page).getByRole("button", { name: /^Chat/ }).first().click();
  await putAway(mo.app, true);
  const mini = async () => {
    for (const page of mo.app.windows()) if (page.url().includes("call-window.html")) return page;
    return undefined;
  };
  await expect.poll(async () => Boolean(await mini()), { timeout: 5_000 }).toBe(true);
  await (await mini())?.getByRole("button", { name: "Back to the call window" }).click();
  await expect(controls(mo.page)).toBeVisible({ timeout: 5_000 });
  // Closing the window keeps the call (MeetApp stays in the menu bar).
  await mo.app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .sort((a, b) => a.id - b.id)[0]
      ?.close(),
  );
  await stillThere(host.page);
});

test("TC-F17-37 [AC-F17-20] a second window shows no small view", async () => {
  const { people, mo } = await meeting();
  const other = await windowFor(people.member);
  windows.push(other);
  await menu(mo.page).getByRole("button", { name: /^Chat/ }).first().click();
  await expect(small(mo.page)).toBeVisible();
  await other.page.getByRole("button", { name: /^Chat/ }).first().click();
  await expect(small(other.page)).toHaveCount(0);
});

test("TC-F17-18 [AC-F17-07] waiting in the lobby, Xena browses; once let in, the small view shows the call", async () => {
  const people = await team();
  const { host, link } = await hostMeeting(people);
  const xena = await knock(people.outsider, link);
  windows.push(host, xena);
  await menu(xena.page).getByRole("button", { name: /^Chat/ }).first().click();
  await expect(small(xena.page)).toContainText("Waiting to be let in…");
  await expect(smallButton(xena.page, /^Mute/)).toHaveCount(0);
  await admitAll(host.page, "Xena Outsider");
  await expect(smallButton(xena.page, /^(Mute|Unmute)/)).toBeVisible({ timeout: 20_000 });
  await expect(xena.page.getByRole("heading", { level: 1, name: "Chat" })).toBeVisible();
});

test("TC-F17-25 [AC-F17-09] a chat's call button during a meeting asks first", async () => {
  const { mo } = await meeting();
  await chatWith(mo.page, "Olivia", /Olivia Owner/);
  await mo.page.getByRole("button", { name: "Video call" }).click();
  const ask = mo.page.getByRole("dialog", { name: "Start something new?" });
  await expect(ask).toBeVisible();
  await expect(ask.getByRole("button", { name: "Leave call and start" })).toBeVisible();
  await ask.getByRole("button", { name: "Cancel" }).last().click();
  await expect(small(mo.page)).toBeVisible();
});

test("TC-F17-39 [AC-F17-21] at the smallest window the small view leaves the message box free", async () => {
  const { mo } = await meeting();
  await mo.app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .sort((a, b) => a.id - b.id)[0]
      ?.setSize(800, 600),
  );
  await chatWith(mo.page, "Olivia", /Olivia Owner/);
  const box = await mo.page.getByRole("textbox", { name: /^Message / }).boundingBox();
  const view = await small(mo.page).boundingBox();
  expect(box && view).toBeTruthy();
  if (box && view) {
    const overlaps =
      box.x < view.x + view.width &&
      view.x < box.x + box.width &&
      box.y < view.y + view.height &&
      view.y < box.y + box.height;
    expect(overlaps).toBe(false);
  }
});
