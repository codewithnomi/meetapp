// Steps the F02 meeting tests share: Meet now, joining by link (signed in or as a guest), the link from
// Meeting info, the lobby, and a way to cut one window's call-server connection (without touching the
// other windows).
import { expect, type ElectronApplication, type Locator, type Page } from "@playwright/test";

export const controls = (page: Page) => page.getByRole("group", { name: "Meeting controls" });
export const tile = (page: Page, name: RegExp) => page.getByRole("figure", { name });
/** The meeting shortcuts' modifier keys: ⌘⇧ on a Mac, Ctrl+Shift elsewhere. */
export const SHORTCUT = process.platform === "darwin" ? "Meta+Shift" : "Control+Shift";
export const LINK = /\/m\/[\w-]{22}$/;
const IN_CALL = { timeout: 20_000 };

/** Meetings, Meet now, Join now: inside the call as its organizer. */
export async function meetNow(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Meetings" }).click();
  await page.getByRole("button", { name: "Meet now" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /^Meeting with / })).toBeVisible();
  await pace();
  await page.getByRole("button", { name: "Join now" }).click();
  await expect(controls(page)).toBeVisible(IN_CALL);
}

/** Opens Meeting info in the call and reads the link. */
export async function infoLink(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Meeting info" }).click();
  return (await page.getByText(LINK).textContent()) ?? "";
}

const attempts: number[] = [];
/**
 * The backend allows 10 joins a minute from one address, and all test windows share this computer's.
 * Called before each join: waits when this run already made 6 in the last minute (a join can fail and be tried again).
 */
export async function pace(): Promise<void> {
  for (;;) {
    const now = Date.now();
    while (attempts.length > 0 && now - (attempts[0] ?? now) > 60_000) attempts.shift();
    if (attempts.length < 6) break;
    await new Promise((done) => setTimeout(done, (attempts[0] ?? now) + 60_100 - now));
  }
  attempts.push(Date.now());
}

/** Signed in: Meetings, the link tab, Join; stops on the pre-join screen. */
export async function findByLink(page: Page, link: string): Promise<void> {
  await pace();
  await page.getByRole("button", { name: "Meetings" }).click();
  await page.getByRole("radio", { name: "Link" }).click();
  await page.getByLabel("Meeting link").fill(link);
  await page.getByRole("button", { name: "Join", exact: true }).click();
}

export async function joinByLink(page: Page, link: string): Promise<void> {
  await findByLink(page, link);
  await page.getByRole("button", { name: "Join now" }).click();
  await expect(controls(page)).toBeVisible(IN_CALL);
}

/** Signed out: Join a meeting on the sign-in screen, the link, a name; presses Join now. */
export async function joinAsGuest(page: Page, link: string, name = "Leo Guest"): Promise<void> {
  await pace();
  await page.getByRole("link", { name: "Join a meeting" }).click();
  await page.getByRole("radio", { name: "Link" }).click();
  await page.getByLabel("Meeting link").fill(link);
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Join now" }).click();
}

/** The organizer lets everybody in the lobby in. */
export async function admitAll(host: Page, name: string): Promise<void> {
  const lobby = host.getByRole("region", { name: "Lobby", exact: true });
  await expect(lobby).toContainText(name, { timeout: 15_000 });
  await lobby.getByRole("button", { name: "Admit all" }).click();
}

/** How many videos in the window are really playing a picture. */
export const playingVideos = (page: Page) =>
  page.evaluate(
    () => [...document.querySelectorAll("video")].filter((v) => v.readyState >= 2 && v.videoWidth > 0).length,
  );

/**
 * Lets a test cut the window's connection to the call server and bring it back. The page's WebSocket is
 * wrapped (Playwright can't intercept sockets in Electron windows): open call sockets are closed and new
 * ones are sent to a closed port while cut, so the app goes through the real reconnect path; media on the
 * Mac's own network is not touched, and the other windows are unaffected. Set up before joining; reloads
 * the page so the wrapper is in place before the app starts.
 */
export async function lineControl(page: Page) {
  await page.addInitScript(() => {
    const Real = window.WebSocket;
    const line = { cut: false, open: new Set<WebSocket>() };
    (window as unknown as { line: typeof line }).line = line;
    window.WebSocket = new Proxy(Real, {
      construct(target, args: ConstructorParameters<typeof WebSocket>) {
        const call = /\/rtc(\/v\d+)?(\?|$)/.test(String(args[0]));
        const refused = call && line.cut;
        const socket = Reflect.construct(target, refused ? ["ws://127.0.0.1:9/"] : args) as WebSocket;
        if (call && !refused) {
          line.open.add(socket);
          socket.addEventListener("close", () => line.open.delete(socket));
        }
        return socket;
      },
    });
  });
  await page.reload();
  type Line = { cut: boolean; open: Set<WebSocket> };
  return {
    cut: () =>
      page.evaluate(() => {
        const line = (window as unknown as { line: Line }).line;
        line.cut = true;
        for (const socket of line.open) socket.close(4000, "cut");
      }),
    restore: () =>
      page.evaluate(() => {
        (window as unknown as { line: Line }).line.cut = false;
      }),
    /** How many call connections the window has open right now. */
    openSockets: () => page.evaluate(() => (window as unknown as { line: Line }).line.open.size),
  };
}

/** The highest value a meter shows within `ms` milliseconds, ending early once it moved (watched in the page, so short beeps count). */
export function meterPeak(meter: Locator, ms: number): Promise<number> {
  return meter.evaluate(
    (element, duration) =>
      new Promise<number>((done) => {
        let peak = 0;
        const read = () => {
          peak = Math.max(peak, Number(element.getAttribute("aria-valuenow")));
          if (peak > 0) finish();
        };
        const finish = () => {
          watcher.disconnect();
          done(peak);
        };
        const watcher = new MutationObserver(read);
        watcher.observe(element, { attributes: true });
        read();
        setTimeout(finish, duration);
      }),
    ms,
  );
}

/**
 * Makes the computer say camera and microphone are `status` ("granted", "denied") to this window, by
 * wrapping the media handler inside the app's main process (the page can't change its own bridge).
 */
export async function fakeAccessStatus(app: ElectronApplication, status: string): Promise<void> {
  await app.evaluate(({ ipcMain }, answer) => {
    type Handlers = Map<string, (event: unknown, name: string, args: unknown[]) => unknown>;
    const handlers = (ipcMain as unknown as { _invokeHandlers: Handlers })._invokeHandlers;
    const real = handlers.get("meetapp:media");
    if (!real) throw new Error("media handler not found");
    handlers.set("meetapp:media", (event, name, args) =>
      name === "accessStatus" ? { camera: answer, microphone: answer, screen: "granted" } : real(event, name, args),
    );
  }, status);
}

/** macOS asks before the first screen capture and a test can't answer, so sharing is checked only once allowed. */
export const screenAllowed = (page: Page) =>
  page.evaluate(async () => {
    const media = (window as { meetapp?: { media?: { accessStatus: () => Promise<{ screen: string }> } } }).meetapp
      ?.media;
    return (await media?.accessStatus())?.screen === "granted";
  });
