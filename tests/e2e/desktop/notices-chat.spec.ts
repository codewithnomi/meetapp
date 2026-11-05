// F04 T12: cards for new messages and mentions, end to end (TC-F04-10, 54, 57, 59, 95, and the switches of
// TC-F04-67). Olivia writes to Mo; Mo's MeetApp is hidden, as when another app is in front.
import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { FAKE_MEDIA, closeApp, freshProfile, launchAs, type RunningApp } from "./desktop.ts";
import { team, windowFor } from "./meeting-team.ts";
import { chatWith, inWorkspace, smallPages } from "./call-window-steps.ts";

test.describe.configure({ timeout: 180_000 });

let windows: RunningApp[] = [];
test.afterEach(async () => {
  await Promise.all(windows.map((running) => closeApp(running.app)));
  windows = [];
});

const hide = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.hide());
const cards = (app: ElectronApplication) => smallPages(app);
const chimes = (page: Page) => page.evaluate(() => Number(document.body.dataset["chimes"] ?? "0"));

async function send(page: Page, text: string) {
  const box = page.getByRole("textbox", { name: "Message Mo Member" });
  await box.fill(text);
  await box.press("Enter");
}

async function oliviaWritesToMo() {
  const { workspace, owner, member } = await team();
  const mo = await launchAs(member.email, freshProfile(), FAKE_MEDIA);
  const olivia = await windowFor(owner);
  windows.push(mo, olivia);
  await Promise.all([olivia, mo].map((w) => inWorkspace(w.page, workspace)));
  await chatWith(olivia.page, "Mo", /Mo Member/);
  await hide(mo.app);
  return { olivia, mo };
}

test("TC-F04-54 [AC-F04-31] a message gives a card with name and text; clicking it opens the chat", async () => {
  const { olivia, mo } = await oliviaWritesToMo();
  await send(olivia.page, "Can you look at the release notes?");
  await expect.poll(() => cards(mo.app).length, { timeout: 10_000 }).toBe(1);
  const card = cards(mo.app)[0] as Page;
  await expect(card.getByText("Olivia Owner")).toBeVisible();
  await expect(card.getByText("Can you look at the release notes?")).toBeVisible();
  await card.getByRole("button", { name: "Open the chat with Olivia Owner" }).click();
  await expect(mo.page.getByRole("textbox", { name: "Message Olivia Owner" })).toBeVisible({ timeout: 5_000 });
  await expect.poll(() => cards(mo.app).length).toBe(0);
});

test("TC-F04-57 [AC-F04-32] three quick messages give one card, '3 new messages', and one chime", async () => {
  const { olivia, mo } = await oliviaWritesToMo();
  for (const text of ["One", "Two", "Three"]) await send(olivia.page, text);
  await expect.poll(() => cards(mo.app).length, { timeout: 10_000 }).toBe(1);
  await expect((cards(mo.app)[0] as Page).getByText(/3 new messages/)).toBeVisible({ timeout: 5_000 });
  expect(cards(mo.app)).toHaveLength(1);
  expect(await chimes(mo.page)).toBe(1);
});

test("TC-F04-67 [AC-F04-36] chat messages off: no card; preview off: 'New message', no text", async () => {
  const { olivia, mo } = await oliviaWritesToMo();
  // Through the real page: Settings → Notifications.
  await mo.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.show());
  await mo.page.getByRole("button", { name: "Settings" }).first().click();
  await mo.page.getByRole("button", { name: "Notifications" }).click();
  await mo.page.getByRole("switch", { name: "Show message preview" }).click();
  await hide(mo.app);
  await send(olivia.page, "secret plans");
  await expect.poll(() => cards(mo.app).length, { timeout: 10_000 }).toBe(1);
  const card = cards(mo.app)[0] as Page;
  await expect(card.getByText("New message")).toBeVisible();
  expect(await card.content()).not.toContain("secret plans");
  await card.getByRole("button", { name: "Close" }).click();

  await mo.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.show());
  await mo.page.getByRole("switch", { name: "Chat messages" }).click();
  await hide(mo.app);
  await send(olivia.page, "anyone there?");
  await mo.page.waitForTimeout(3_000);
  expect(cards(mo.app)).toHaveLength(0);
});

test("TC-F04-10 [AC-F04-04] the first close shows 'still running' once", async () => {
  const mo = await launchAs((await team()).member.email, freshProfile(), FAKE_MEDIA);
  windows.push(mo);
  const close = () => mo.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close());
  await close();
  await expect.poll(() => cards(mo.app).length, { timeout: 5_000 }).toBe(1);
  const card = cards(mo.app)[0] as Page;
  await expect(card.getByText("MeetApp is still running")).toBeVisible();
  await expect(card.getByText(process.platform === "win32" ? /notification area/ : /menu bar/)).toBeVisible();
  await card.getByRole("button", { name: "Close" }).click();
  await mo.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.show());
  await close();
  await mo.page.waitForTimeout(1_500);
  expect(cards(mo.app)).toHaveLength(0);
});

test("TC-F04-95 [AC-F04-30] signing out takes the cards away and no new ones come", async () => {
  const { olivia, mo } = await oliviaWritesToMo();
  await send(olivia.page, "Before you go");
  await expect.poll(() => cards(mo.app).length, { timeout: 10_000 }).toBe(1);
  await mo.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.show());
  await mo.page.getByRole("button", { name: /^Your account: / }).click();
  await mo.page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect.poll(() => cards(mo.app).length, { timeout: 5_000 }).toBe(0);
  await send(olivia.page, "Still there?");
  await mo.page.waitForTimeout(3_000);
  expect(cards(mo.app)).toHaveLength(0);
});

/** Mo sets Do not disturb from the picture menu, until changed. */
async function moQuiet(mo: RunningApp) {
  await mo.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.show());
  await mo.page.getByRole("button", { name: /^Your account: / }).click();
  await mo.page.getByRole("menuitem", { name: /Available|In a call/ }).click();
  await mo.page.getByRole("menuitemradio", { name: "Do not disturb" }).click();
  await expect(mo.page.getByRole("button", { name: /Do not disturb$/ })).toBeVisible();
  await hide(mo.app);
}

test("TC-F04-45 [AC-F04-22] Do not disturb: no card for a message or a mention; unread still counts", async () => {
  const { olivia, mo } = await oliviaWritesToMo();
  await moQuiet(mo);
  await send(olivia.page, "Quiet please");
  await mo.page.waitForTimeout(3_000);
  expect(cards(mo.app)).toHaveLength(0);
  await mo.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.show());
  await expect(mo.page.getByRole("button", { name: /^Chat, 1 unread/ })).toBeVisible({ timeout: 5_000 });
});

test("TC-F04-46 [AC-F04-22] Do not disturb: a call still rings, and the missed call is noted", async () => {
  const { olivia, mo } = await oliviaWritesToMo();
  await moQuiet(mo);
  await olivia.page.getByRole("button", { name: "Audio call" }).click();
  await expect.poll(() => cards(mo.app).length, { timeout: 10_000 }).toBe(1);
  await expect((cards(mo.app)[0] as Page).getByRole("dialog", { name: /^Incoming audio call from / })).toBeVisible();
  // Not answered: it stops after 30 seconds and the chat says so.
  await expect.poll(() => cards(mo.app).length, { timeout: 45_000 }).toBe(0);
  await expect(olivia.page.getByText(/Missed call|No answer/i).first()).toBeVisible({ timeout: 10_000 });
});
