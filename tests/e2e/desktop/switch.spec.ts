// F17 moving around during a call (AC-F17-09, 15): Meet now asks first ("Starting this leaves it"), and
// 20 quick switches between the full call and other screens never stop the call or its sound.
// TC-F17-24, 38.
import { expect, test, type Page } from "@playwright/test";
import { closeApp, type RunningApp } from "./desktop.ts";
import { controls, tile } from "./meeting-steps.ts";
import { hostMeeting, joinWindow, team } from "./meeting-team.ts";

test.describe.configure({ timeout: 300_000 });

let windows: RunningApp[] = [];
test.afterEach(async () => {
  await Promise.all(windows.map((running) => closeApp(running.app)));
  windows = [];
});

const menu = (page: Page) => page.getByRole("navigation", { name: "Main" });
const small = (page: Page) => page.getByRole("region", { name: /^Call: / });

/** In Olivia's window: the longest time Mo's sound did not move on, watched every 50 ms from now. */
async function watchSound(page: Page): Promise<void> {
  await page.evaluate(() => {
    const state = { last: performance.now(), longest: 0, at: 0 };
    (window as unknown as { soundGap: typeof state }).soundGap = state;
    setInterval(() => {
      const now = performance.now();
      const played = [...document.querySelectorAll("audio")].reduce((sum, a) => sum + a.currentTime, 0);
      if (played > state.at) {
        state.longest = Math.max(state.longest, now - state.last);
        state.last = now;
        state.at = played;
      }
    }, 50);
  });
}
const longestGap = (page: Page) =>
  page.evaluate(() => {
    const state = (window as unknown as { soundGap: { last: number; longest: number } }).soundGap;
    return Math.max(state.longest, performance.now() - state.last);
  });

test("TC-F17-38 [AC-F17-15] 20 switches in a row: each under 1 s, the call never drops, no sound gap over 500 ms", async () => {
  const people = await team();
  const { host, link } = await hostMeeting(people);
  const mo = await joinWindow(people.member, link);
  windows.push(host, mo);
  await expect(tile(host.page, /^Mo Member/)).toBeVisible({ timeout: 20_000 });
  await watchSound(host.page);
  for (let round = 0; round < 10; round++) {
    let began = Date.now();
    await menu(mo.page).getByRole("button", { name: /^Chat/ }).first().click();
    await expect(small(mo.page)).toBeVisible();
    expect(Date.now() - began).toBeLessThan(1_000);
    began = Date.now();
    await small(mo.page)
      .getByRole("button", { name: /^Go back to the / })
      .click();
    await expect(controls(mo.page)).toBeVisible();
    expect(Date.now() - began).toBeLessThan(1_000);
  }
  expect(await longestGap(host.page)).toBeLessThan(500);
  await expect(tile(host.page, /^Mo Member/)).toBeVisible();
});

test("TC-F17-24 [AC-F17-09] Meet now during a call asks first; Cancel keeps the call; Leave call and start leaves then starts", async () => {
  const people = await team();
  const { host, link } = await hostMeeting(people);
  const mo = await joinWindow(people.member, link);
  windows.push(host, mo);
  await menu(mo.page)
    .getByRole("button", { name: /^Meetings/ })
    .first()
    .click();
  await expect(mo.page.getByText(/^You're in /)).toBeVisible();
  await mo.page.getByRole("button", { name: "Meet now" }).click();
  const ask = mo.page.getByRole("dialog", { name: "Start something new?" });
  await expect(ask).toContainText(/You're in .+\. Starting this leaves it\./);
  await ask.getByRole("button", { name: "Cancel" }).last().click();
  await expect(tile(host.page, /^Mo Member/)).toBeVisible();
  await mo.page.getByRole("button", { name: "Meet now" }).click();
  await mo.page.getByRole("button", { name: "Leave call and start" }).click();
  await expect(tile(host.page, /^Mo Member/)).toHaveCount(0, { timeout: 10_000 });
  // The new meeting's pre-join; joining it starts Mo's own meeting.
  await mo.page.getByRole("button", { name: "Join now" }).click();
  await expect(controls(mo.page)).toBeVisible({ timeout: 20_000 });
});
