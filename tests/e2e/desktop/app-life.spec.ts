// F04 T3: closing hides MeetApp, Quit asks during a call, one copy per profile, and a ring with the window
// hidden opens the call (TC-F04-06, 07, 09, 14, 15, 18). The native question is answered by replacing
// Electron's dialog inside the tested app, so no real dialog waits for a click.
import { expect, test, type ElectronApplication } from "@playwright/test";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { FAKE_MEDIA, closeApp, freshProfile, launch, launchAs, type RunningApp } from "./desktop.ts";
import { afterCallEnds, controls } from "./meeting-steps.ts";
import { team, windowFor } from "./meeting-team.ts";
import { chatWith, firstSmall, inWorkspace } from "./call-window-steps.ts";

test.describe.configure({ timeout: 180_000 });

const DESKTOP = fileURLToPath(new URL("../../../apps/desktop", import.meta.url));
const electronBinary = createRequire(`${DESKTOP}/package.json`)("electron") as string;

let windows: RunningApp[] = [];
test.afterEach(async () => {
  await Promise.all(windows.map((running) => closeApp(running.app)));
  windows = [];
});

/** The main window's state as Electron sees it. */
const mainState = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find((w) => !w.webContents.getURL().includes("call-window"));
    return { visible: window?.isVisible() ?? false, focused: window?.isFocused() ?? false };
  });

/** Closes every main window as the ✕ button would. */
const closeWindows = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => {
    for (const window of BrowserWindow.getAllWindows())
      if (!window.webContents.getURL().includes("call-window")) window.close();
  });

/** Answers MeetApp's next question with the button at `index` (0 Quit, 1 Cancel) and counts the questions. */
const answerQuestions = (app: ElectronApplication, index: number) =>
  app.evaluate(({ dialog }, answer) => {
    const seen = globalThis as { questions?: string[] };
    seen.questions = [];
    dialog.showMessageBoxSync = ((...args: unknown[]) => {
      const options = args.at(-1) as { message: string };
      seen.questions?.push(options.message);
      return answer;
    }) as typeof dialog.showMessageBoxSync;
  }, index);

const questions = (app: ElectronApplication) =>
  app.evaluate(() => (globalThis as { questions?: string[] }).questions ?? []);

/** Asks the app to quit and waits until its process has ended (or `ms` passed). */
async function quitAndWait(app: ElectronApplication, ms = 10_000): Promise<boolean> {
  const child = app.process();
  const ended = new Promise<boolean>((done) => child.once("exit", () => done(true)));
  await app.evaluate(({ app: electron }) => electron.quit()).catch(() => undefined);
  return Promise.race([ended, new Promise<boolean>((done) => setTimeout(() => done(false), ms))]);
}

test("TC-F04-06 [AC-F04-02] a second start with the same profile brings the first window forward and ends", async () => {
  const profile = freshProfile();
  const first = await launch(profile);
  windows.push(first);
  await first.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.minimize());
  const env: Record<string, string> = { ...(process.env as Record<string, string>), MEETAPP_USER_DATA_DIR: profile };
  delete env["ELECTRON_RUN_AS_NODE"];
  const second = spawn(electronBinary, [DESKTOP], { cwd: DESKTOP, env, stdio: "ignore" });
  const code = await new Promise<number | null>((done) => second.once("exit", done));
  expect(code).toBe(0);
  await expect.poll(() => mainState(first.app)).toEqual({ visible: true, focused: true });
});

test("TC-F04-07 [AC-F04-02] copies with different profiles run side by side", async () => {
  const one = await launch(freshProfile());
  const two = await launch(freshProfile());
  windows.push(one, two);
  expect((await mainState(one.app)).visible).toBe(true);
  expect((await mainState(two.app)).visible).toBe(true);
});

test("TC-F04-14 [AC-F04-06] closing hides MeetApp; Quit with no call ends it without a question", async () => {
  const running = await launch();
  windows.push(running);
  await answerQuestions(running.app, 1);
  await closeWindows(running.app);
  await expect.poll(() => mainState(running.app)).toEqual({ visible: false, focused: false });
  expect(running.app.process().exitCode).toBeNull();
  expect(await quitAndWait(running.app)).toBe(true);
});

/** Olivia with the chat to Mo open; Mo's MeetApp window closed with ✕ (hidden). */
async function moClosed() {
  const { workspace, owner, member } = await team();
  const mo = await launchAs(member.email, freshProfile(), FAKE_MEDIA);
  const olivia = await windowFor(owner);
  windows.push(mo, olivia);
  await Promise.all([olivia, mo].map((w) => inWorkspace(w.page, workspace)));
  await chatWith(olivia.page, "Mo", /Mo Member/);
  await closeWindows(mo.app);
  await expect.poll(() => mainState(mo.app)).toEqual({ visible: false, focused: false });
  return { olivia, mo };
}

test("TC-F04-09 TC-F04-18 [AC-F04-04, AC-F04-07] with the window closed a ring still shows, and Video opens the call within 3 s", async () => {
  const { olivia, mo } = await moClosed();
  await olivia.page.getByRole("button", { name: "Video call" }).click();
  const small = await firstSmall(mo.app);
  const pressed = Date.now();
  await small.getByRole("button", { name: "Accept with video" }).click();
  await expect(controls(mo.page)).toBeVisible({ timeout: 3_000 });
  expect(Date.now() - pressed).toBeLessThan(3_000);
  expect((await mainState(mo.app)).visible).toBe(true);
  await controls(mo.page).getByRole("button", { name: "Leave", exact: true }).click();
  await afterCallEnds(olivia.page);
});

test("TC-F04-15 [AC-F04-06] Quit during a call asks; Cancel keeps the call, Quit leaves it and ends MeetApp", async () => {
  const { olivia, mo } = await moClosed();
  await olivia.page.getByRole("button", { name: "Video call" }).click();
  await (await firstSmall(mo.app)).getByRole("button", { name: "Accept with video" }).click();
  await expect(controls(mo.page)).toBeVisible({ timeout: 5_000 });
  await expect(controls(olivia.page)).toBeVisible({ timeout: 20_000 });

  await answerQuestions(mo.app, 1);
  expect(await quitAndWait(mo.app, 2_000)).toBe(false);
  expect(await questions(mo.app)).toEqual(["Quit MeetApp? You'll leave the call."]);
  await expect(controls(mo.page)).toBeVisible();

  await answerQuestions(mo.app, 0);
  expect(await quitAndWait(mo.app)).toBe(true);
  await afterCallEnds(olivia.page);
});
