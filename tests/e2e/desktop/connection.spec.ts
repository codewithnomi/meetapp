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
  await a.page.getByRole("button", { name: "Meeting info" }).click();
  await a.page.getByRole("button", { name: "Meeting options" }).click();
  await a.page.getByRole("switch", { name: "Lock the meeting" }).click();
  await a.page.getByRole("button", { name: "Close", exact: true }).first().click();
  line.cut();
  await expect(b.page.getByText("Reconnecting…")).toBeVisible({ timeout: 30_000 });
  await b.page.waitForTimeout(20_000);
  line.restore();
  await expect(b.page.getByText("Reconnecting…")).toHaveCount(0, { timeout: 10_000 + 5_000 });
  await expect(controls(b.page)).toBeVisible();
  await expect(b.page.getByRole("button", { name: "More ways to leave" })).toBeVisible();
  await expect(b.page.getByRole("region", { name: "Lobby" })).toHaveCount(0);
  await expect(a.page.getByRole("figure")).toHaveCount(2);
});

test("TC-F02-59 [AC-F02-29] a drop over 30 s shows You've lost connection; the other window sees B leave; Rejoin brings B back", async () => {
  const { a, b, line } = await pair();
  line.cut();
  await expect(b.page.getByRole("heading", { name: "You've lost connection" })).toBeVisible({ timeout: 70_000 });
  await expect(a.page.getByRole("figure")).toHaveCount(1, { timeout: 60_000 });
  line.restore();
  // The backend learns of the drop from the call server a moment later; Rejoin is tried until it works.
  await expect(async () => {
    await b.page.getByRole("button", { name: "Rejoin" }).click({ timeout: 3_000 });
    await expect(controls(b.page)).toBeVisible({ timeout: 8_000 });
  }).toPass({ timeout: 60_000 });
  await expect(b.page.getByRole("button", { name: "More ways to leave" })).toBeVisible();
  await expect(a.page.getByRole("figure")).toHaveCount(2, { timeout: 20_000 });
});

test("TC-F02-61 [AC-F02-31] a camera that disappears is replaced by the default and the screen says so", async () => {
  const a = await launchNewAccount(undefined, undefined, FAKE_MEDIA);
  await a.page.getByRole("button", { name: "Meetings" }).click();
  await a.page.getByRole("button", { name: "Meet now" }).click();
  const camera = a.page.getByLabel("Camera", { exact: true });
  await expect(camera.locator("option").first()).toBeAttached();
  await camera.selectOption({ index: 0 });
  await a.page.getByRole("button", { name: "Join now" }).click();
  await expect(controls(a.page)).toBeVisible({ timeout: 20_000 });
  // Simulated unplug: the device list loses the camera in use and a devicechange fires (a real unplug is
  // not possible with Chromium's fake devices).
  await a.page.evaluate(() => {
    const gone = (JSON.parse(localStorage.getItem("meetapp.devices") ?? "{}") as { cameraId?: string }).cameraId;
    const real = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
    navigator.mediaDevices.enumerateDevices = async () => {
      const list = (await real()).filter((d) => !(d.kind === "videoinput" && d.deviceId === gone));
      return [
        ...list,
        { deviceId: "default", kind: "videoinput", label: "Default camera", groupId: "g" } as MediaDeviceInfo,
      ];
    };
    navigator.mediaDevices.dispatchEvent(new Event("devicechange"));
  });
  await expect(a.page.getByText(/ disconnected\.$/)).toBeVisible({ timeout: 3_000 });
  await expect(a.page.getByText(/^Now using /)).toBeVisible();
  await a.page.getByRole("button", { name: "More options" }).click();
  await expect(a.page.getByRole("combobox", { name: "Camera" })).toBeVisible();
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
  await b.page.getByRole("button", { name: "Leave" }).click();
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
    await route.continue();
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
