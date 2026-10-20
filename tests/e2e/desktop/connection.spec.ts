// Connection and devices in the real app (F02 T16): TC-F02-55 weak line, 56 short drop, 59 long drop with
// Rejoin, 61 a device unplugged, 62 Leave, closed window and crashed app, 91 backend unreachable.
// Cuts are made per window: the call's signalling socket is closed and refused (lineControl); weak
// numbers and unplugging are simulated in the page. Needs the backend and Mailpit (`pnpm test`).
import { expect, test, type Page } from "@playwright/test";
import { FAKE_MEDIA, closeApp, launchAs, launchNewAccount } from "./desktop.ts";
import { controls, infoLink, joinByLink, lineControl, meetNow, tile } from "./meeting-steps.ts";

test.describe.configure({ timeout: 240_000 });

/** Window A (organizer) in a meeting and window B (same account) inside it, B with a cuttable line. */
async function pair() {
  const a = await launchNewAccount(undefined, undefined, FAKE_MEDIA);
  await meetNow(a.page);
  const link = await infoLink(a.page);
  const b = await launchAs(a.email, undefined, FAKE_MEDIA);
  const line = await lineControl(b.page);
  await joinByLink(b.page, link);
  await expect(a.page.getByRole("figure")).toHaveCount(2, { timeout: 20_000 });
  return { a, b, line, link };
}

test("TC-F02-55 [AC-F02-28] a bad line shows the weak-connection notice on the own tile and in Device settings only", async () => {
  const { a, b } = await pair();
  // Simulated: the far side reports 10% loss and 400 ms for what B sends (a packet-loss tool can't be
  // aimed at one window on a Mac). The app's rule is unit-tested in weak-connection.test.ts (TC-F02-54).
  await b.page.evaluate(() => {
    const real = RTCRtpSender.prototype.getStats;
    RTCRtpSender.prototype.getStats = async function () {
      const report = new Map(await real.call(this));
      report.set("bad", { type: "remote-inbound-rtp", fractionLost: 0.1, roundTripTime: 0.4 });
      return report as unknown as RTCStatsReport;
    };
  });
  await expect(tile(b.page, /\(you\).*Weak connection/)).toBeVisible({ timeout: 15_000 });
  await b.page.getByRole("button", { name: "More options" }).click();
  await expect(b.page.getByText("Your connection is weak.")).toBeVisible();
  await expect(tile(a.page, /Weak connection/)).toHaveCount(0);
  await expect(a.page.getByText("Your connection is weak.")).toHaveCount(0);
});

test("TC-F02-56 [AC-F02-29] a short drop reconnects within 10 s of the restore, in the same meeting and role, though locked", async () => {
  const { a, b, line } = await pair();
  // Meeting info is already open in A (pair() read the link from it).
  await a.page.getByRole("button", { name: "Meeting options" }).click();
  await a.page.getByRole("switch", { name: "Lock the meeting" }).click();
  await a.page.getByRole("button", { name: "Close", exact: true }).first().click();
  await line.cut();
  await expect.poll(() => line.openSockets(), { timeout: 5_000 }).toBe(0);
  // 20 s without the call server's signalling (media is not touched, so the window shows no notice; the
  // app keeps trying and does not give up before 30 s).
  await b.page.waitForTimeout(20_000);
  await expect(b.page.getByRole("heading", { name: "You've lost connection" })).toHaveCount(0);
  await line.restore();
  // Reconnected by itself within 10 s of the network coming back.
  await expect.poll(() => line.openSockets(), { timeout: 10_000 }).toBeGreaterThan(0);
  await expect(controls(b.page)).toBeVisible();
  await expect(b.page.getByRole("button", { name: "More ways to leave" })).toBeVisible();
  await expect(b.page.getByRole("region", { name: "Lobby" })).toHaveCount(0);
  await expect(a.page.getByRole("figure")).toHaveCount(2);
});

test("TC-F02-59 [AC-F02-29] a drop over 30 s shows You've lost connection; the other window sees B leave; Rejoin brings B back", async () => {
  const { a, b, line } = await pair();
  await line.cut();
  await expect(b.page.getByRole("heading", { name: "You've lost connection" })).toBeVisible({ timeout: 70_000 });
  await expect(a.page.getByRole("figure")).toHaveCount(1, { timeout: 60_000 });
  await line.restore();
  // The backend learns of the drop from the call server a moment later; Rejoin is tried until it works.
  await expect(async () => {
    await b.page.getByRole("button", { name: "Rejoin" }).click({ timeout: 3_000 });
    await expect(controls(b.page)).toBeVisible({ timeout: 8_000 });
  }).toPass({ timeout: 60_000 });
  await expect(b.page.getByRole("button", { name: "More ways to leave" })).toBeVisible();
  await expect(a.page.getByRole("figure")).toHaveCount(2, { timeout: 20_000 });
});

/**
 * Chromium's fake devices can't be unplugged, so the page's device list is wrapped: a spare camera is
 * listed first (so the camera in use is not the first one, the case the call library leaves alone), and
 * `hide(label)` removes a device and fires `devicechange`, as an unplug does.
 */
async function unpluggable(page: Page): Promise<(label: string) => Promise<void>> {
  await page.addInitScript(() => {
    const w = window as unknown as { hidden: Set<string> };
    w.hidden = new Set();
    const real = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
    navigator.mediaDevices.enumerateDevices = async () => {
      const spare = { deviceId: "spare-cam", kind: "videoinput", label: "Spare camera", groupId: "s" };
      const list = (await real()).filter((d) => !w.hidden.has(d.label));
      return [spare as MediaDeviceInfo, ...list];
    };
  });
  await page.reload();
  return async (label) => {
    await page.evaluate((name) => {
      (window as unknown as { hidden: Set<string> }).hidden.add(name);
      navigator.mediaDevices.dispatchEvent(new Event("devicechange"));
    }, label);
  };
}

test("TC-F02-61 [AC-F02-31] each device in use that disappears is replaced within 2 s and the screen says which one", async () => {
  const a = await launchNewAccount(undefined, undefined, FAKE_MEDIA);
  const unplug = await unpluggable(a.page);
  await a.page.getByRole("button", { name: "Meetings" }).click();
  await a.page.getByRole("button", { name: "Meet now" }).click();
  // Speakers first, then microphone, then camera; each is announced once.
  const chosen = [
    ["Speakers", "Fake Audio Output 1"],
    ["Microphone", "Fake Audio Input 1"],
    ["Camera", "fake_device_0"],
  ] as const;
  for (const [list, label] of chosen) {
    const select = a.page.getByLabel(list, { exact: true });
    await expect(select.locator("option", { hasText: label })).toBeAttached({ timeout: 15_000 });
    await select.selectOption({ label });
  }
  await a.page.getByRole("button", { name: "Join now" }).click();
  await expect(controls(a.page)).toBeVisible({ timeout: 20_000 });
  for (const [, label] of chosen) {
    await unplug(label);
    // Soft, so a failure for one device still lets the others be checked.
    await expect.soft(a.page.getByText(`${label} disconnected.`)).toBeVisible({ timeout: 2_000 });
    await expect.soft(a.page.getByText(/^Now using /)).toBeVisible();
    await a.page
      .getByRole("button", { name: "OK", exact: true })
      .click({ timeout: 2_000 })
      .catch(() => undefined);
  }
  // The devices can be changed in Device settings at any time.
  await a.page.getByRole("button", { name: "More options" }).click();
  for (const list of ["Camera", "Microphone", "Speakers"])
    await expect(a.page.getByRole("combobox", { name: list })).toBeEnabled();
});

const figures = (page: Page) => page.getByRole("figure");

test("TC-F02-62 [AC-F02-32] Leave and a closed window show at once; a crashed app within 30 s; the meeting goes on", async () => {
  const a = await launchNewAccount(undefined, undefined, FAKE_MEDIA);
  await meetNow(a.page);
  const link = await infoLink(a.page);
  const b = await launchAs(a.email, undefined, FAKE_MEDIA);
  const c = await launchAs(a.email, undefined, FAKE_MEDIA);
  const d = await launchAs(a.email, undefined, FAKE_MEDIA);
  for (const w of [b, c, d]) await joinByLink(w.page, link);
  await expect(figures(a.page)).toHaveCount(4, { timeout: 30_000 });
  await controls(b.page).getByRole("button", { name: "Leave", exact: true }).click();
  await expect(figures(a.page)).toHaveCount(3, { timeout: 5_000 });
  await closeApp(c.app);
  await expect(figures(a.page)).toHaveCount(2, { timeout: 10_000 });
  const pid = d.app.process().pid;
  if (pid) process.kill(pid, "SIGKILL");
  await expect(figures(a.page)).toHaveCount(1, { timeout: 30_000 });
  await expect(controls(a.page)).toBeVisible();
});

test("TC-F02-91 [AC-F02-46] an unreachable or slow backend shows Can't reach MeetApp with Retry, and Retry never makes two meetings", async () => {
  const me = await launchNewAccount(undefined, undefined, FAKE_MEDIA);
  const keys: string[] = [];
  await me.page.route("**/api/v1/workspaces/*/meetings", async (route) => {
    keys.push(route.request().headers()["idempotency-key"] ?? "");
    if (keys.length === 1) await new Promise((done) => setTimeout(done, 11_000));
    // The app gave up on the slow request after 10 s (and the window may be closed by now): nothing to pass on.
    await route.continue().catch(() => undefined);
  });
  await me.page.getByRole("button", { name: "Meetings" }).click();
  await me.page.getByRole("button", { name: "Meet now" }).click();
  await expect(me.page.getByText("Can't reach MeetApp. Check your connection.")).toBeVisible({ timeout: 15_000 });
  await me.page.getByRole("button", { name: "Retry" }).click();
  await expect(me.page.getByRole("heading", { level: 1, name: /^Meeting with / })).toBeVisible();
  expect(keys.length).toBe(2);
  expect(keys[0]).not.toBe("");
  expect(keys[1]).toBe(keys[0]);
  await me.page.unroute("**/api/v1/workspaces/*/meetings");

  // Looking up and joining while the backend can't be reached.
  await me.page.route("**/api/v1/meeting-lookups", (route) => route.abort());
  await me.page.getByRole("button", { name: "Cancel" }).click();
  await me.page.getByRole("radio", { name: "Link" }).click();
  await me.page.getByLabel("Meeting link").fill("https://x.test/m/aaaaaaaaaaaaaaaaaaaaaa");
  await me.page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(me.page.getByText("Can't reach MeetApp. Check your connection.")).toBeVisible();
  await expect(me.page.getByRole("button", { name: "Retry" })).toBeVisible();
});
