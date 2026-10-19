// What the stage shows and what the control bar does, with several windows (F02 T17): speaker view and
// pin (TC-F02-43), the speaking highlight (44), mic and camera seen by others (45), screen sharing (49)
// and noise suppression (60). Needs the backend and Mailpit (`pnpm test`).
import { expect, test, type Page } from "@playwright/test";
import { controls, joinByLink, screenAllowed, SHORTCUT, tile } from "./meeting-steps.ts";
import {
  largestTile,
  microphoneConstraints,
  onsetsIn,
  recordMicrophones,
  speakingSeen,
  watchSpeaking,
} from "./meeting-probes.ts";
import {
  actOn,
  guestWindow,
  hostMeeting,
  joinWindow,
  openOptions,
  saveOptions,
  team,
  windowFor,
  type Person,
} from "./meeting-team.ts";

test.describe.configure({ timeout: 240_000 });

const GUS = "Gus Guest (Guest)";
const button = (page: Page, name: RegExp | string) => controls(page).getByRole("button", { name });

/** A window that records its microphone, already inside the meeting. */
async function probed(person: Person, link: string) {
  const running = await windowFor(person);
  await recordMicrophones(running.page);
  await running.page.reload();
  await joinByLink(running.page, link);
  return running;
}

test("TC-F02-43 [AC-F02-20] speaker view shows the speaker large, a pin shows the pinned person, and a pin is only for its owner", async () => {
  const who = await team();
  const { host, link } = await hostMeeting(who);
  const mo = await joinWindow(who.member, link);
  const gus = await guestWindow(link, "Gus Guest", host.page);
  // Only Mo makes sound: the stand-in microphone of the guest is muted.
  await button(gus.page, /^Mute \(/).click();
  await host.page.getByRole("radio", { name: "Speaker" }).click();
  await expect.poll(() => largestTile(host.page), { timeout: 20_000 }).toMatch(/^Mo Member, /);

  await actOn(host.page, GUS, "Pin for me");
  await expect
    .poll(() => largestTile(host.page), { timeout: 10_000 })
    .toMatch(/^Gus Guest \(Guest\), .*Pinned for you/);
  for (const other of [mo, gus]) {
    await expect(other.page.getByRole("radio", { name: "Gallery" })).toBeChecked();
    await expect(tile(other.page, /Pinned for you/)).toHaveCount(0);
  }
  // In Gallery the pin stays, and Unpin takes it away.
  await host.page.getByRole("radio", { name: "Gallery" }).click();
  await expect(tile(host.page, /^Gus Guest \(Guest\), .*Pinned for you/)).toBeVisible();
  await host.page.getByRole("button", { name: "Unpin" }).click();
  await expect(tile(host.page, /Pinned for you/)).toHaveCount(0);
});

test("TC-F02-44 [AC-F02-21] a speaker's tile gets the ring, the word Speaking and ', speaking' in its name; the announcements are spaced", async () => {
  const who = await team();
  const { host, link } = await hostMeeting(who);
  const mo = await probed(who.member, link);
  await watchSpeaking(host.page, "Mo Member");
  await expect(tile(host.page, /^Mo Member, .*, speaking$/i)).toBeVisible({ timeout: 20_000 });
  const speaking = tile(host.page, /^Mo Member, .*, speaking$/i);
  await expect(speaking.locator("[data-speaking-ring]")).toHaveCount(1);
  await expect(speaking.getByText("Speaking", { exact: true })).toBeVisible();
  await host.page.waitForTimeout(14_000);

  // How long after the sound began did the other window show it? (Timings are measured, not polled.)
  const { starts, announced } = await speakingSeen(host.page);
  const onsets = await onsetsIn(mo.page);
  const delays = starts.map((start) => start - Math.max(...onsets.filter((onset) => onset <= start), 0));
  test.info().annotations.push({
    type: "measured",
    description: `speaking shown ${String(delays.length)} times; delay after the sound (ms): ${delays.join(", ")}`,
  });
  expect(delays.length).toBeGreaterThan(0);
  expect(Math.max(...delays)).toBeLessThanOrEqual(500);
  expect(announced.length).toBeGreaterThan(0);
  const gaps = announced.slice(1).map((entry, index) => entry.at - (announced[index]?.at ?? 0));
  test.info().annotations.push({
    type: "measured",
    description: `announcements ${String(announced.length)}, gaps (ms): ${gaps.join(", ")}`,
  });
  for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(1_900);
});

test("TC-F02-45 [AC-F02-22] mute and camera changes reach the other window within a second; the shortcuts work only in the meeting", async () => {
  const who = await team();
  const { host, link } = await hostMeeting(who);
  const mo = await windowFor(who.member);
  // On the pre-join screen the shortcut does nothing.
  await mo.page.getByRole("button", { name: "Meetings" }).click();
  await mo.page.getByRole("radio", { name: "Link" }).click();
  await mo.page.getByLabel("Meeting link").fill(link);
  await mo.page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(mo.page.getByRole("button", { name: "Turn microphone off" })).toBeVisible();
  await mo.page.keyboard.press(`${SHORTCUT}+M`);
  await expect(mo.page.getByRole("button", { name: "Turn microphone off" })).toBeVisible();
  await mo.page.getByRole("button", { name: "Join now" }).click();
  await expect(controls(mo.page)).toBeVisible({ timeout: 20_000 });
  const moTile = tile(host.page, /^Mo Member, /);
  await expect(moTile.locator("video")).toHaveCount(1, { timeout: 15_000 });

  await button(mo.page, /^Mute \(/).click();
  await expect(tile(host.page, /^Mo Member, .*Muted/)).toBeVisible({ timeout: 1_000 });
  await mo.page.keyboard.press(`${SHORTCUT}+M`);
  await expect(tile(host.page, /^Mo Member, .*Muted/)).toHaveCount(0, { timeout: 1_000 });
  await button(mo.page, /^Turn camera off/).click();
  await expect(moTile.locator("video")).toHaveCount(0, { timeout: 1_000 });
  await mo.page.keyboard.press(`${SHORTCUT}+O`);
  await expect(moTile.locator("video")).toHaveCount(1, { timeout: 1_000 });
  // Not system-wide: the app registers no global shortcut.
  const registered = await mo.app.evaluate(({ globalShortcut }) =>
    ["CommandOrControl+Shift+M", "CommandOrControl+Shift+O", "CommandOrControl+Shift+K"].map((key) =>
      globalShortcut.isRegistered(key),
    ),
  );
  expect(registered).toEqual([false, false, false]);
});

/** The size of the picture in the sharer's tile, as the other window receives it (camera or screen). */
const pictureOf = (page: Page) =>
  tile(page, /^Olivia Owner, /)
    .first()
    .locator("video")
    .evaluate((v: HTMLVideoElement) => `${String(v.videoWidth)}x${String(v.videoHeight)}`);

/** Picks the first screen in our picker and presses Share. */
async function shareFirstScreen(page: Page) {
  await button(page, "Share screen").click();
  await page.getByRole("radiogroup", { name: "Screens" }).getByRole("radio").first().click();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(button(page, "Stop sharing")).toBeVisible({ timeout: 15_000 });
}

test("TC-F02-49 [AC-F02-25] only presenters have Share; a share shows on the other windows and another presenter's share replaces it", async () => {
  const who = await team();
  const { host: a, link } = await hostMeeting(who);
  const dialog = await openOptions(a.page);
  await dialog.getByRole("combobox", { name: "Who can present?" }).selectOption("organizers");
  await dialog.getByRole("searchbox", { name: "Add a person from this workspace" }).fill("Mo");
  await dialog.getByRole("button", { name: "Add Mo Member as co-organizer" }).click();
  await saveOptions(a.page, dialog);
  const d = await joinWindow(who.member, link);
  const b = await guestWindow(link, "Gus Guest", a.page);
  const c = await windowFor(who.owner);
  await joinByLink(c.page, link);
  await expect(button(b.page, "Only presenters can share")).toBeVisible();
  await expect(button(b.page, "Share screen")).toHaveCount(0);
  for (const presenter of [a, d]) await expect(button(presenter.page, "Share screen")).toBeVisible();
  test.skip(
    !(await screenAllowed(a.page)),
    "the computer has not allowed screen capture for MeetApp; rights checked only",
  );

  await expect(controls(c.page)).toBeVisible();
  const before = await pictureOf(c.page);
  await shareFirstScreen(a.page);
  await expect.poll(() => pictureOf(c.page), { timeout: 2_000 }).not.toBe(before);
  await shareFirstScreen(d.page);
  await expect(a.page.getByText("Your share ended")).toBeVisible({ timeout: 10_000 });
  await expect(button(a.page, "Share screen")).toBeVisible();
});

test("TC-F02-60 [AC-F02-30] noise suppression is on by default and the switch in Device settings turns it off and on", async () => {
  const who = await team();
  const { host, link } = await hostMeeting(who);
  const mo = await probed(who.member, link);
  await expect(controls(host.page)).toBeVisible();
  await expect.poll(async () => (await microphoneConstraints(mo.page))?.noiseSuppression).toBe(true);
  await button(mo.page, "More options").click();
  const noise = mo.page.getByRole("switch", { name: "Noise suppression" });
  await expect(noise).toBeChecked();
  await noise.click();
  await expect(noise).not.toBeChecked();
  await expect.poll(async () => (await microphoneConstraints(mo.page))?.noiseSuppression).toBe(false);
  await noise.click();
  await expect(noise).toBeChecked();
  await expect.poll(async () => (await microphoneConstraints(mo.page))?.noiseSuppression).toBe(true);
});
