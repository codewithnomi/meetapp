// F16 T8: ring windows above other apps, in the real desktop app. Olivia calls; Mo's MeetApp is
// minimized, so a small ring window shows (TC-F16-03, 05, 07, 08, 09, 10, 11, 12, 13, 19, 45, 50; and the
// real-window side of TC-F16-51, 54). The small windows are the pages showing call-window.html.
import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { FAKE_MEDIA, closeApp, freshProfile, launchAs, launchNewAccount, type RunningApp } from "./desktop.ts";
import { afterCallEnds, controls } from "./meeting-steps.ts";
import { team, windowFor } from "./meeting-team.ts";
import { acceptInvitation, inviteByEmail, openScreen, switcher, switchTo } from "./workspace-steps.ts";

test.describe.configure({ timeout: 180_000 });

let windows: RunningApp[] = [];
test.afterEach(async () => {
  await Promise.all(windows.map((running) => closeApp(running.app)));
  windows = [];
});

const SMALL = "call-window.html";
const smallPages = (app: ElectronApplication) => app.windows().filter((page) => page.url().includes(SMALL));
const ringWindow = (page: Page) => page.getByRole("alertdialog", { name: /^Incoming (video|audio) call from / });
const incoming = (page: Page) => page.getByRole("alertdialog", { name: "Incoming call" });
const ringtone = (page: Page) => page.evaluate(() => document.body.dataset["ringtone"]);

/** Minimizes (true) or brings back (false) every main MeetApp window of this app. */
async function putAway(app: ElectronApplication, away: boolean): Promise<void> {
  await app.evaluate(
    ({ BrowserWindow }, [page, hide]) => {
      for (const window of BrowserWindow.getAllWindows()) {
        if (window.webContents.getURL().includes(page as string)) continue;
        if (hide) {
          window.minimize();
        } else {
          window.restore();
          window.show();
          window.focus();
        }
      }
    },
    [SMALL, away] as const,
  );
}

/** The small windows' state as Electron sees it: focused, on top, bounds. */
function smallState(app: ElectronApplication) {
  return app.evaluate(
    ({ BrowserWindow }, page) =>
      BrowserWindow.getAllWindows()
        .filter((w) => w.webContents.getURL().includes(page))
        .map((w) => ({ focused: w.isFocused(), onTop: w.isAlwaysOnTop(), bounds: w.getBounds() })),
    SMALL,
  );
}

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

/** Olivia with the chat to Mo open; Mo's window (two when asked) minimized. */
async function setup(options: { second?: boolean } = {}) {
  const { workspace, owner, member } = await team();
  const mo = await launchAs(member.email, freshProfile(), FAKE_MEDIA);
  const olivia = await windowFor(owner);
  windows.push(mo, olivia);
  const mo2 = options.second ? await launchAs(member.email, undefined, FAKE_MEDIA) : undefined;
  if (mo2) windows.push(mo2);
  await Promise.all([olivia, mo, ...(mo2 ? [mo2] : [])].map((w) => inWorkspace(w.page, workspace)));
  await chatWith(olivia.page, "Mo", /Mo Member/);
  await putAway(mo.app, true);
  if (mo2) await putAway(mo2.app, true);
  return { olivia, mo, mo2, owner, member, workspace };
}

async function firstSmall(app: ElectronApplication): Promise<Page> {
  await expect.poll(() => smallPages(app).length, { timeout: 5_000 }).toBeGreaterThan(0);
  const page = smallPages(app)[0] as Page;
  await expect(ringWindow(page)).toBeVisible();
  return page;
}

test("TC-F16-03 TC-F16-07 TC-F16-11 [AC-F16-01, AC-F16-02, AC-F16-03, AC-F16-05] a ring over other apps, unfocused; MeetApp in front hides it; Video opens the call", async () => {
  const { olivia, mo } = await setup();
  await olivia.page.getByRole("button", { name: "Video call" }).click();
  const small = await firstSmall(mo.app);
  await expect(ringWindow(small)).toContainText("Olivia Owner");
  await expect(ringWindow(small)).toContainText("Video call");
  for (const name of ["Accept with video", "Accept with audio", "Decline", /^Hide/])
    await expect(small.getByRole("button", { name })).toBeVisible();
  expect(await smallState(mo.app)).toEqual([expect.objectContaining({ focused: false, onTop: true })]);

  await putAway(mo.app, false);
  await expect.poll(() => smallPages(mo.app).length, { timeout: 5_000 }).toBe(0);
  await expect(incoming(mo.page)).toBeVisible();
  await expect.poll(() => ringtone(mo.page)).toBeDefined();

  await putAway(mo.app, true);
  const again = await firstSmall(mo.app);
  const pressed = Date.now();
  await again.getByRole("button", { name: "Accept with video" }).click();
  await expect(controls(mo.page)).toBeVisible({ timeout: 3_000 });
  expect(Date.now() - pressed).toBeLessThan(3_000);
  expect(
    await mo.app.evaluate(({ BrowserWindow }) => BrowserWindow.getFocusedWindow()?.webContents.getURL() ?? ""),
  ).not.toContain(SMALL);
  await expect(controls(olivia.page)).toBeVisible({ timeout: 20_000 });
  // End the call, so the next test starts without one (a one-to-one call ends for both).
  await controls(mo.page).getByRole("button", { name: "Leave", exact: true }).click();
  await afterCallEnds(olivia.page);
});

test("TC-F16-08 TC-F16-09 TC-F16-10 [AC-F16-04] × silences only this computer; Decline declines", async () => {
  const { olivia, mo } = await setup();
  await olivia.page.getByRole("button", { name: "Audio call" }).click();
  const small = await firstSmall(mo.app);
  await expect.poll(() => ringtone(mo.page)).toBeDefined();
  await small.getByRole("button", { name: /^Hide/ }).click();
  await expect.poll(() => smallPages(mo.app).length, { timeout: 5_000 }).toBe(0);
  await expect.poll(() => ringtone(mo.page)).toBeUndefined();
  await expect(incoming(mo.page)).toHaveCount(1);
  await expect(olivia.page.getByText(/^Calling /)).toBeVisible();
  await olivia.page.getByRole("button", { name: "Cancel" }).click();
  await expect(incoming(mo.page)).toHaveCount(0, { timeout: 10_000 });

  await olivia.page.getByRole("button", { name: "Audio call" }).click();
  const next = await firstSmall(mo.app);
  await next.getByRole("button", { name: "Decline" }).click();
  await expect.poll(() => smallPages(mo.app).length, { timeout: 5_000 }).toBe(0);
  await expect(olivia.page.getByText(/declined/i).first()).toBeVisible({ timeout: 10_000 });
});

test("TC-F16-12 TC-F16-13 [AC-F16-06] the ring window closes within 2 s when the caller cancels", async () => {
  const { olivia, mo } = await setup();
  await olivia.page.getByRole("button", { name: "Video call" }).click();
  await firstSmall(mo.app);
  await olivia.page.getByRole("button", { name: "Cancel" }).click();
  await expect.poll(() => smallPages(mo.app).length, { timeout: 2_000 }).toBe(0);
});

/** Tara joins Olivia's workspace (a sign-up and an invitation), so Mo can be called by two people. */
async function thirdMember(olivia: RunningApp, workspace: string): Promise<RunningApp> {
  const email = `e2e-${randomUUID()}@example.test`;
  await inviteByEmail(olivia.page, email);
  const tara = await launchNewAccount(freshProfile(), email, FAKE_MEDIA, "Tara Third");
  windows.push(tara);
  await acceptInvitation(tara.page, "Personal", workspace);
  await inWorkspace(tara.page, workspace);
  return tara;
}

test("TC-F16-19 [AC-F16-08, AC-F16-09] two callers stack without overlap, newest on top; one ending closes the gap", async () => {
  const { olivia, mo, workspace } = await setup();
  const tara = await thirdMember(olivia, workspace);
  await chatWith(tara.page, "Mo", /Mo Member/);
  await chatWith(olivia.page, "Mo", /Mo Member/);
  await olivia.page.getByRole("button", { name: "Audio call" }).click();
  await firstSmall(mo.app);
  await tara.page.getByRole("button", { name: "Audio call" }).click();
  await expect.poll(() => smallPages(mo.app).length, { timeout: 5_000 }).toBe(2);
  // One ringtone for both (AC-F16-08).
  await expect.poll(() => ringtone(mo.page)).toBeDefined();
  const [lower, upper] = (await smallState(mo.app)).map((s) => s.bounds).sort((x, y) => y.y - x.y);
  if (!lower || !upper) throw new Error("two ring windows expected");
  expect(upper.y + upper.height).toBeLessThanOrEqual(lower.y);
  await olivia.page.getByRole("button", { name: "Cancel" }).click();
  await expect.poll(() => smallPages(mo.app).length, { timeout: 5_000 }).toBe(1);
  await expect.poll(async () => (await smallState(mo.app))[0]?.bounds.y).toBe(lower.y);
  await tara.page.getByRole("button", { name: "Cancel" }).click();
});

test("TC-F16-45 [AC-F16-24] two MeetApp windows of Mo: one ring window", async () => {
  const { olivia, mo, mo2 } = await setup({ second: true });
  await olivia.page.getByRole("button", { name: "Video call" }).click();
  await firstSmall(mo.app);
  // Each app has its own main process; the rule is one ring window per call in each app.
  await firstSmall((mo2 as RunningApp).app);
  expect(smallPages(mo.app)).toHaveLength(1);
  expect(smallPages((mo2 as RunningApp).app)).toHaveLength(1);
  await olivia.page.getByRole("button", { name: "Cancel" }).click();
});

test("TC-F16-50 TC-F16-51 TC-F16-54 [AC-F16-21, AC-F16-22] keyboard and Escape; the small window is locked down", async () => {
  const { olivia, mo } = await setup();
  await olivia.page.getByRole("button", { name: "Audio call" }).click();
  const small = await firstSmall(mo.app);
  const page = await small.evaluate(() => ({
    meetapp: typeof (window as { meetapp?: unknown }).meetapp,
    bridge: Object.keys((window as { meetappCallWindow?: object }).meetappCallWindow ?? {}).sort(),
    require: typeof (window as { require?: unknown }).require,
    process: typeof (window as { process?: unknown }).process,
    cookies: document.cookie,
  }));
  expect(page).toEqual({
    meetapp: "undefined",
    bridge: ["act", "onFrame", "onState"],
    require: "undefined",
    process: "undefined",
    cookies: "",
  });
  const fetched = await small.evaluate(() =>
    fetch("http://127.0.0.1:3000/api/v1/me").then(
      () => "reached",
      () => "blocked",
    ),
  );
  expect(fetched).toBe("blocked");
  const before = mo.app.windows().length;
  await small.evaluate(() => {
    // Not https: refused outright (an https link would open the person's browser, as in the main window).
    window.open("http://example.com/");
    location.href = "http://example.com/";
  });
  await small.waitForTimeout(500);
  expect(mo.app.windows().length).toBe(before);
  expect(small.url()).toContain(SMALL);

  // The person moves to the ring window (it never takes focus by itself).
  await mo.app.evaluate(({ BrowserWindow }, page) => {
    BrowserWindow.getAllWindows()
      .find((w) => w.webContents.getURL().includes(page))
      ?.focus();
  }, SMALL);
  // macOS doesn't activate the app for a test, so the focused button is read from the page itself.
  const focused = () => small.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  await small.keyboard.press("Tab");
  expect(await focused()).toMatch(/^Hide/);
  await small.keyboard.press("Tab");
  expect(await focused()).toBe("Accept with video");
  await small.keyboard.press("Escape");
  await expect.poll(() => smallPages(mo.app).length, { timeout: 5_000 }).toBe(0);
  await expect(olivia.page.getByText(/declined/i).first()).toBeVisible({ timeout: 10_000 });
});
