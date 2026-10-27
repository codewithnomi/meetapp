// F15 T14: being called in the real desktop app. Olivia calls; Mo has one or two windows (TC-F15-09
// incoming call on every window, 11 behind other screens, 12 accept with video and audio, 25 called
// during a meeting: quiet tone and button names, 54 the chosen ringtone). The ringtone itself is read from
// `document.body.dataset.ringtone` / `ringVolume`, which the app sets while ringing.
import { expect, test, type Page } from "@playwright/test";
import { API_URL, FAKE_MEDIA, closeApp, freshProfile, launchAs, storedToken, type RunningApp } from "./desktop.ts";
import { controls } from "./meeting-steps.ts";
import { hostMeeting, joinWindow, team, windowFor } from "./meeting-team.ts";
import { openScreen, switcher, switchTo } from "./workspace-steps.ts";

test.describe.configure({ timeout: 180_000 });

let windows: RunningApp[] = [];
test.afterEach(async () => {
  await Promise.all(windows.map((running) => closeApp(running.app)));
  windows = [];
});

async function inWorkspace(page: Page, workspace: string) {
  await expect(page.getByRole("button", { name: /^Switch workspace: / })).toBeVisible();
  if (await switcher(page, workspace).isVisible()) return;
  await switchTo(page, "Personal", workspace);
}

async function chatWith(page: Page, query: string, name: RegExp) {
  await openScreen(page, "Chat");
  await page.getByRole("button", { name: "New chat" }).first().click();
  await page.getByRole("combobox", { name: "To:" }).fill(query);
  await page.getByRole("option", { name }).click();
  await page.getByRole("button", { name: "Start chat" }).click();
}

/** Olivia with the chat to Mo open, and Mo's first window (and a second one when asked). */
async function setup(options: { second?: boolean; ringtone?: { ringtone: number; ringVolume: number } } = {}) {
  const { workspace, owner, member } = await team();
  const profile = freshProfile();
  const mo1 = await launchAs(member.email, profile, FAKE_MEDIA);
  const olivia = await windowFor(owner);
  windows.push(mo1, olivia);
  if (options.ringtone) {
    const token = await storedToken(mo1.app, profile);
    const saved = await fetch(`${API_URL ?? ""}/api/v1/me/settings`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token ?? ""}`, "content-type": "application/json", origin: "app://meetapp" },
      body: JSON.stringify(options.ringtone),
    });
    expect(saved.status).toBe(204);
    await mo1.page.reload();
  }
  const mo2 = options.second ? await launchAs(member.email, undefined, FAKE_MEDIA) : undefined;
  if (mo2) windows.push(mo2);
  const mine = [mo1, ...(mo2 ? [mo2] : [])];
  await Promise.all([olivia, ...mine].map((w) => inWorkspace(w.page, workspace)));
  await chatWith(olivia.page, "Mo", /Mo Member/);
  return { olivia, mo1, mo2, mine, owner, member, workspace };
}

const incoming = (page: Page) => page.getByRole("alertdialog", { name: "Incoming call" });
const ringtone = (page: Page) => page.evaluate(() => ({ ...document.body.dataset }));

test("TC-F15-09 [AC-F15-05] both windows of the called person show the incoming call with its three buttons", async () => {
  const { olivia, mo1, mo2 } = await setup({ second: true });
  await mo1.page.getByRole("button", { name: "Settings", exact: true }).click();
  await olivia.page.getByRole("button", { name: "Video call" }).click();
  for (const page of [mo1.page, (mo2 as RunningApp).page]) {
    const window = incoming(page);
    await expect(window).toBeVisible({ timeout: 5_000 });
    await expect(window).toContainText("Olivia Owner");
    await expect(window).toContainText("Video call");
    await expect(window.getByRole("button", { name: "Accept with video" })).toBeVisible();
    await expect(window.getByRole("button", { name: "Accept with audio" })).toBeVisible();
    await expect(window.getByRole("button", { name: "Decline" })).toBeVisible();
    await expect.poll(async () => (await ringtone(page))["ringtone"]).toBeDefined();
  }
  await olivia.page.getByRole("button", { name: "Cancel" }).click();
  await expect(incoming(mo1.page)).toHaveCount(0, { timeout: 10_000 });
});

test("TC-F15-11 [AC-F15-05] the incoming call shows on a screen other than Chats and stops when the caller cancels", async () => {
  const { olivia, mo1 } = await setup();
  await openScreen(mo1.page, "People");
  await olivia.page.getByRole("button", { name: "Audio call" }).click();
  await expect(incoming(mo1.page)).toBeVisible({ timeout: 5_000 });
  await expect(incoming(mo1.page)).toContainText("Audio call");
  await expect.poll(async () => (await ringtone(mo1.page))["ringtone"]).toBeDefined();
  await olivia.page.getByRole("button", { name: "Cancel" }).click();
  await expect(incoming(mo1.page)).toHaveCount(0, { timeout: 10_000 });
  await expect.poll(async () => (await ringtone(mo1.page))["ringtone"]).toBeUndefined();
});

test("TC-F15-12 [AC-F15-06] Accept with video and Accept with audio put Mo in the call; the other window stops ringing", async () => {
  const { olivia, mo1, mo2 } = await setup({ second: true });
  const other = (mo2 as RunningApp).page;
  await olivia.page.getByRole("button", { name: "Video call" }).click();
  await incoming(mo1.page).getByRole("button", { name: "Accept with video" }).click();
  await expect(controls(mo1.page)).toBeVisible({ timeout: 20_000 });
  await expect(mo1.page).toHaveURL(/\/call/);
  await expect(mo1.page.getByRole("button", { name: /^Turn camera off/ })).toBeVisible();
  await expect(incoming(other)).toHaveCount(0, { timeout: 5_000 });
  await expect(controls(olivia.page)).toBeVisible({ timeout: 20_000 });
  await mo1.page
    .getByRole("group", { name: "Meeting controls" })
    .getByRole("button", { name: "Leave", exact: true })
    .click();
  await olivia.page
    .getByRole("group", { name: "Meeting controls" })
    .getByRole("button", { name: "Leave", exact: true })
    .click();

  await chatWith(olivia.page, "Mo", /Mo Member/);
  await olivia.page.getByRole("button", { name: "Audio call" }).click();
  await incoming(other).getByRole("button", { name: "Accept with audio" }).click();
  await expect(controls(other)).toBeVisible({ timeout: 20_000 });
  await expect(other.getByRole("button", { name: /^Turn camera on/ })).toBeVisible();
  await expect(other.getByRole("button", { name: /^Mute/ })).toBeVisible();
});

test("TC-F15-25 [AC-F15-10] called in a meeting: quiet tone, 'Leave current call and accept' buttons, accepting leaves the meeting", async () => {
  const { workspace, owner, member } = await team();
  const { host, link } = await hostMeeting({ workspace, owner, member, outsider: owner });
  windows.push(host);
  // Mo is in Olivia's meeting; a second Olivia window calls Mo from the chat.
  const moInMeeting = await joinWindow(member, link);
  windows.push(moInMeeting);
  const caller = await windowFor(owner);
  windows.push(caller);
  await inWorkspace(caller.page, workspace);
  await chatWith(caller.page, "Mo", /Mo Member/);
  await caller.page.getByRole("button", { name: "Video call" }).click();

  const window = incoming(moInMeeting.page);
  await expect(window).toBeVisible({ timeout: 10_000 });
  await expect(window).toContainText(/You're in .*\. Accepting leaves it\./);
  await expect(window.getByRole("button", { name: "Leave current call and accept with video" })).toBeVisible();
  await expect(window.getByRole("button", { name: "Leave current call and accept with audio" })).toBeVisible();
  await expect(window.getByRole("button", { name: /Hold/i })).toHaveCount(0);
  const tone = await ringtone(moInMeeting.page);
  expect(Number(tone["ringVolume"])).toBeLessThanOrEqual(Math.ceil(70 / 3) + 1);

  await window.getByRole("button", { name: "Leave current call and accept with video" }).click();
  await expect(moInMeeting.page).toHaveURL(/\/call/, { timeout: 20_000 });
  await expect(controls(moInMeeting.page)).toBeVisible({ timeout: 20_000 });
  await expect(incoming(moInMeeting.page)).toHaveCount(0);
});

test("TC-F15-54 [AC-F15-32, AC-F15-05] the chosen ringtone and volume are used in every window", async () => {
  const { olivia, mine } = await setup({ second: true, ringtone: { ringtone: 4, ringVolume: 50 } });
  await olivia.page.getByRole("button", { name: "Video call" }).click();
  for (const { page } of mine) {
    await expect(incoming(page)).toBeVisible({ timeout: 5_000 });
    await expect.poll(async () => (await ringtone(page))["ringtone"]).toBe("4");
    expect((await ringtone(page))["ringVolume"]).toBe("50");
  }
  await olivia.page.getByRole("button", { name: "Cancel" }).click();
});
