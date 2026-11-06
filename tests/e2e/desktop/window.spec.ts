// F04 T16: the window comes back where it was, start-up is quick, a call runs on hidden, and nothing
// secret is written to disk (TC-F04-77, 78, 79, 93).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type ElectronApplication } from "@playwright/test";
import { closeApp, freshProfile, launch, launchAs, type RunningApp } from "./desktop.ts";
import { controls } from "./meeting-steps.ts";
import { hostMeeting, joinWindow, team } from "./meeting-team.ts";

let windows: RunningApp[] = [];
test.afterEach(async () => {
  await Promise.all(windows.map((running) => closeApp(running.app)));
  windows = [];
});

const bounds = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getBounds());

test("TC-F04-77 [AC-F04-40] hidden and shown, then restarted: the same size and place", async () => {
  const profile = freshProfile();
  const first = await launch(profile);
  await first.app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.setBounds({ x: 60, y: 80, width: 1000, height: 700 }),
  );
  const placed = await bounds(first.app);
  await first.app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    window?.hide();
    window?.show();
  });
  expect(await bounds(first.app)).toEqual(placed);
  // Saved 500 ms after the last change.
  await first.page.waitForTimeout(1_000);
  await closeApp(first.app);
  const again = await launch(profile);
  windows.push(again);
  expect(await bounds(again.app)).toEqual(placed);
});

test("TC-F04-78 [AC-F04-41] a signed-in start shows the app within 3 s, five times", async () => {
  const { member } = await team();
  const profile = freshProfile();
  await closeApp((await launchAs(member.email, profile)).app);
  const times: number[] = [];
  for (let run = 0; run < 5; run++) {
    const running = await launch(profile);
    await expect(running.page.getByRole("button", { name: /^Your account: / })).toBeVisible({ timeout: 10_000 });
    const took = await running.app.evaluate(() => Date.now() - (process.getCreationTime() ?? Date.now()));
    times.push(took);
    await closeApp(running.app);
  }
  times.sort((a, b) => a - b);
  test.info().annotations.push({ type: "start-up ms", description: `${times.join(", ")}; median ${String(times[2])}` });
  expect(Math.max(...times)).toBeLessThan(3_000);
});

test("TC-F04-79 [AC-F04-42] a call runs on for 10 minutes with the window behind, minimised and hidden", async () => {
  test.setTimeout(15 * 60_000);
  const people = await team();
  const { host, link } = await hostMeeting(people);
  const member = await joinWindow(people.member, link);
  windows.push(host, member);
  await expect(controls(member.page)).toBeVisible();
  const frames = () =>
    host.page.evaluate(() =>
      [...document.querySelectorAll("video")].reduce((sum, v) => sum + v.getVideoPlaybackQuality().totalVideoFrames, 0),
    );
  const phases = [
    (app: ElectronApplication) => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.blur()),
    (app: ElectronApplication) => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.minimize()),
    (app: ElectronApplication) => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.hide()),
  ];
  let last = await frames();
  for (const phase of phases) {
    await phase(member.app);
    for (let minute = 0; minute < 3; minute++) {
      await host.page.waitForTimeout(60_000);
      const now = await frames();
      expect(now, "Mo's video keeps arriving").toBeGreaterThan(last);
      last = now;
    }
  }
  await expect(controls(member.page)).toBeAttached();
});

/** Every file under the profile, as text. */
function filesOf(folder: string): { path: string; text: string }[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    const stat = statSync(path);
    if (stat.isDirectory()) return /Cache|GPUCache|Code Cache|blob_storage/.test(name) ? [] : filesOf(path);
    return stat.size < 5_000_000 ? [{ path, text: readFileSync(path).toString("latin1") }] : [];
  });
}

test("TC-F04-93 [AC-F04-40] the profile holds no passwords, tokens or message text", async () => {
  const { member } = await team();
  const profile = freshProfile();
  const mo = await launchAs(member.email, profile);
  windows.push(mo);
  await mo.app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.setBounds({ x: 40, y: 60, width: 900, height: 700 }),
  );
  await mo.page.waitForTimeout(1_000);
  const token = await mo.app.evaluate(() => process.env["MEETAPP_E2E_PASSWORD"] ?? "");
  const ours = ["window-state.json", "app-state.json", "call-windows.json", "login-item.json"];
  for (const file of filesOf(profile).filter((f) => ours.some((name) => f.path.endsWith(name)))) {
    expect(file.text).not.toMatch(/password|token|secret|Bearer/i);
    if (token) expect(file.text).not.toContain(token);
    expect(Object.keys(JSON.parse(file.text) as object).every((key) => /^[a-zA-Z]+$/.test(key))).toBe(true);
  }
  const state = JSON.parse(readFileSync(join(profile, "window-state.json"), "utf8")) as object;
  expect(Object.keys(state).sort()).toEqual(["displayId", "height", "maximized", "width", "x", "y"]);
});
