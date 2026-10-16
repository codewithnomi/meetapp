// The pre-join in the real app (F02 T13): TC-F02-19 devices (preview, meter, Test speakers, choices
// remembered, camera and mic off on entry), TC-F02-20 device problems (macOS status mocked in the page's
// bridge), TC-F02-21 guest name and Terms text. Needs the backend and Mailpit (`pnpm test`).
import { expect, test } from "@playwright/test";
import { FAKE_MEDIA, closeApp, freshProfile, launch, launchNewAccount } from "./desktop.ts";
import { controls, infoLink, joinAsGuest, meetNow } from "./meeting-steps.ts";

test.describe.configure({ timeout: 120_000 });
const API_URL = process.env["MEETAPP_E2E_API_URL"] ?? "";

test("TC-F02-19 [AC-F02-09] preview and meter work, Test speakers plays, devices off on entry and remembered", async () => {
  const profile = freshProfile();
  const me = await launchNewAccount(profile, undefined, FAKE_MEDIA);
  const { page } = me;
  await page.getByRole("button", { name: "Meetings" }).click();
  await page.getByRole("button", { name: "Meet now" }).click();
  const devices = page.getByRole("region", { name: "Your camera and sound" });
  await expect
    .poll(() => devices.locator("video").evaluate((v: HTMLVideoElement) => v.readyState >= 2 && v.videoWidth > 0))
    .toBe(true);
  // The fake microphone beeps; the meter moves above 0 at some point.
  await expect
    .poll(async () => Number(await devices.getByRole("meter").getAttribute("aria-valuenow")), { timeout: 15_000 })
    .toBeGreaterThan(0);
  await page.evaluate(() => {
    const w = window as unknown as { tones: number };
    w.tones = 0;
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...args) {
      w.tones++;
      return start.apply(this, args);
    };
  });
  await page.getByRole("button", { name: "Test speakers" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { tones: number }).tones)).toBeGreaterThan(0);
  // Pick another camera and microphone where the computer has more than one.
  for (const name of ["Camera", "Microphone", "Speakers"]) {
    const list = page.getByLabel(name, { exact: true });
    if ((await list.locator("option").count()) > 1) await list.selectOption({ index: 1 });
  }
  await page.getByRole("button", { name: "Turn camera off" }).click();
  await page.getByRole("button", { name: "Turn microphone off" }).click();
  await page.getByRole("button", { name: "Join now" }).click();
  await expect(controls(page)).toBeVisible({ timeout: 20_000 });
  await expect(controls(page).getByRole("button", { name: /^Unmute/ })).toBeVisible();
  await expect(controls(page).getByRole("button", { name: /^Turn camera on/ })).toBeVisible();
  await closeApp(me.app);

  // The next start remembers the choices.
  const again = await launch(profile, { VITE_API_URL: API_URL }, FAKE_MEDIA);
  await again.page.getByRole("button", { name: "Meetings" }).click();
  await again.page.getByRole("button", { name: "Meet now" }).click();
  await expect(again.page.getByRole("button", { name: "Turn camera on" })).toBeVisible();
  await expect(again.page.getByRole("button", { name: "Turn microphone on" })).toBeVisible();
});

const PROBLEMS = [
  ["missing", "No camera found", "No microphone found"],
  ["denied", "System Settings → Privacy & Security → Camera", "System Settings → Privacy & Security → Microphone"],
] as const;

for (const [kind, camera, microphone] of PROBLEMS) {
  test(`TC-F02-20 [AC-F02-10] a ${kind} camera and microphone are named with the fix, and Join now still works`, async () => {
    const me = await launchNewAccount(undefined, undefined, FAKE_MEDIA);
    await me.page.evaluate((how) => {
      const w = window as unknown as { meetapp: { media: object } };
      const status = how === "denied" ? "denied" : "granted";
      Object.assign(w.meetapp.media, {
        accessStatus: async () => ({ camera: status, microphone: status, screen: "granted" }),
      });
      if (how === "missing")
        navigator.mediaDevices.getUserMedia = async () => {
          throw new DOMException("none", "NotFoundError");
        };
    }, kind);
    await me.page.getByRole("button", { name: "Meetings" }).click();
    await me.page.getByRole("button", { name: "Meet now" }).click();
    await expect(me.page.getByText(camera, { exact: false })).toBeVisible();
    await expect(me.page.getByText(microphone, { exact: false })).toBeVisible();
    await me.page.getByRole("button", { name: "Join now" }).click();
    await expect(controls(me.page)).toBeVisible({ timeout: 20_000 });
  });
}

test("TC-F02-21 [AC-F02-11] a guest needs a name of 1 to 60 characters; the Terms sentence is plain text", async () => {
  const host = await launchNewAccount(undefined, undefined, FAKE_MEDIA);
  await meetNow(host.page);
  const link = await infoLink(host.page);
  const guest = await launch(undefined, { VITE_API_URL: API_URL }, FAKE_MEDIA);
  await guest.page.getByRole("link", { name: "Join a meeting" }).click();
  await guest.page.getByRole("radio", { name: "Link" }).click();
  await guest.page.getByLabel("Meeting link").fill(link);
  await guest.page.getByRole("button", { name: "Join", exact: true }).click();
  const terms = guest.page.getByText("By joining, you agree to the Terms and the Privacy Policy.");
  await expect(terms).toBeVisible();
  await expect(guest.page.getByRole("link", { name: /Terms|Privacy/ })).toHaveCount(0);
  for (const bad of ["", "a".repeat(61)]) {
    await guest.page.getByLabel("Your name").fill(bad);
    await guest.page.getByRole("button", { name: "Join now" }).click();
    await expect(guest.page.getByText("Type a name of 1 to 60 characters.")).toBeVisible();
    await expect(guest.page.getByText("Someone in the meeting will let you in soon.")).toHaveCount(0);
  }
  await joinAsGuest(guest.page, link, "a");
  await expect(guest.page.getByText("Someone in the meeting will let you in soon.")).toBeVisible();
});
