// Steps the F02 meeting tests share: Meet now, joining by link (signed in or as a guest), the link from
// Meeting info, the lobby, and a way to cut one window's call-server connection (without touching the
// other windows).
import { expect, type Page, type WebSocketRoute } from "@playwright/test";

export const controls = (page: Page) => page.getByRole("group", { name: "Meeting controls" });
export const tile = (page: Page, name: RegExp) => page.getByRole("figure", { name });
/** The meeting shortcuts' modifier keys: ⌘⇧ on a Mac, Ctrl+Shift elsewhere. */
export const SHORTCUT = process.platform === "darwin" ? "Meta+Shift" : "Control+Shift";
export const LINK = /\/m\/[\w-]{22}$/;
export const IN_CALL = { timeout: 20_000 };

/** Meetings, Meet now, Join now: inside the call as its organizer. */
export async function meetNow(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Meetings" }).click();
  await page.getByRole("button", { name: "Meet now" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /^Meeting with / })).toBeVisible();
  await page.getByRole("button", { name: "Join now" }).click();
  await expect(controls(page)).toBeVisible(IN_CALL);
}

/** Opens Meeting info in the call and reads the link. */
export async function infoLink(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Meeting info" }).click();
  return (await page.getByText(LINK).textContent()) ?? "";
}

/** Signed in: Meetings, the link tab, Join; stops on the pre-join screen. */
export async function findByLink(page: Page, link: string): Promise<void> {
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
  await page.getByRole("link", { name: "Join a meeting" }).click();
  await page.getByRole("radio", { name: "Link" }).click();
  await page.getByLabel("Meeting link").fill(link);
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Join now" }).click();
}

/** The organizer lets everybody in the lobby in. */
export async function admitAll(host: Page, name: string): Promise<void> {
  const lobby = host.getByRole("region", { name: "Lobby" });
  await expect(lobby).toContainText(name, { timeout: 15_000 });
  await lobby.getByRole("button", { name: "Admit all" }).click();
}

/** How many videos in the window are really playing a picture. */
export const playingVideos = (page: Page) =>
  page.evaluate(
    () => [...document.querySelectorAll("video")].filter((v) => v.readyState >= 2 && v.videoWidth > 0).length,
  );

/**
 * Lets a test cut the window's connection to the call server and bring it back. Set up before joining. The
 * call's signalling socket is closed and new ones are refused while cut, so the app goes through the real
 * reconnect path; media on the Mac's own network is not touched, and the other windows are unaffected.
 */
export async function lineControl(page: Page) {
  let isCut = false;
  const open: WebSocketRoute[] = [];
  await page.routeWebSocket(/\/rtc(\?|$)/, (ws) => {
    if (isCut) {
      void ws.close();
      return;
    }
    open.push(ws, ws.connectToServer());
  });
  return {
    cut: () => {
      isCut = true;
      for (const socket of open.splice(0)) void socket.close();
    },
    restore: () => {
      isCut = false;
    },
  };
}
