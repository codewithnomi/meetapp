// F04 T10: MeetApp's notification cards as real windows (TC-F04-50, 88, 90). A card is sent the way the
// screens will send it (`window.meetapp.notices.show`); the card windows show call-window.html.
import { expect, test, type ElectronApplication } from "@playwright/test";
import { closeApp, launch, type RunningApp } from "./desktop.ts";
import { SMALL, smallPages } from "./call-window-steps.ts";

let windows: RunningApp[] = [];
test.afterEach(async () => {
  await Promise.all(windows.map((running) => closeApp(running.app)));
  windows = [];
});

const card = { id: "c1", kind: "message", title: "Sara Malik", detail: "Release team", text: "Hello", close: "Close" };

const cardState = (app: ElectronApplication) =>
  app.evaluate(
    ({ BrowserWindow }, page) =>
      BrowserWindow.getAllWindows()
        .filter((w) => w.webContents.getURL().includes(page))
        .map((w) => ({ visible: w.isVisible(), focused: w.isFocused(), onTop: w.isAlwaysOnTop() })),
    SMALL,
  );

test("TC-F04-50 TC-F04-88 [AC-F04-30] a card shows above other apps without the keyboard, in a locked-down window", async () => {
  const running = await launch();
  windows.push(running);
  // Another window has the keyboard (the main window is hidden, as when another app is in front).
  await running.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.hide());
  await running.page.evaluate((value) => {
    (window as unknown as { meetapp: { notices: { show: (c: unknown) => void } } }).meetapp.notices.show(value);
  }, card);
  await expect.poll(() => cardState(running.app)).toEqual([{ visible: true, focused: false, onTop: true }]);

  const small = smallPages(running.app)[0];
  if (!small) throw new Error("no card window");
  const inside = await small.evaluate(() => ({
    meetapp: typeof (window as { meetapp?: unknown }).meetapp,
    bridge: Object.keys((window as { meetappCallWindow?: object }).meetappCallWindow ?? {}).sort(),
    require: typeof (window as { require?: unknown }).require,
    process: typeof (window as { process?: unknown }).process,
  }));
  expect(inside).toEqual({
    meetapp: "undefined",
    bridge: ["act", "onFrame", "onState"],
    require: "undefined",
    process: "undefined",
  });
  const before = running.app.windows().length;
  await small.evaluate(() => {
    window.open("http://example.com/");
    location.href = "http://example.com/";
  });
  await small.waitForTimeout(500);
  expect(running.app.windows().length).toBe(before);
  expect(small.url()).toContain(SMALL);
});

test("TC-F04-90 [AC-F04-30] a card's choice can't be faked by the main window; × closes it", async () => {
  const running = await launch();
  windows.push(running);
  await running.page.evaluate((value) => {
    (window as unknown as { meetapp: { notices: { show: (c: unknown) => void } } }).meetapp.notices.show(value);
  }, card);
  await expect.poll(() => smallPages(running.app).length).toBe(1);
  // The main window pressing a card's button (on the small windows' channel) is ignored.
  await running.app.evaluate(({ ipcMain, BrowserWindow }) => {
    const main = BrowserWindow.getAllWindows()[0];
    ipcMain.emit("meetapp:call-window", { sender: main?.webContents }, { name: "notice", choice: "close" });
  });
  await running.page.waitForTimeout(300);
  expect(smallPages(running.app)).toHaveLength(1);
  await smallPages(running.app)[0]?.evaluate(() =>
    (window as unknown as { meetappCallWindow: { act: (a: unknown) => void } }).meetappCallWindow.act({
      name: "notice",
      choice: "close",
    }),
  );
  await expect.poll(() => smallPages(running.app).length).toBe(0);
});
