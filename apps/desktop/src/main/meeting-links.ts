// Meeting links (F04 design.md 3.2, AC-F04-10, 11): `meetapp://m/<code>` from a click anywhere on the
// computer. Only an exact link (contracts' readAppMeetingLink) gets through, as a bare code; anything else
// only brings MeetApp to the front. A link is kept until the screens say they are listening, so a link that
// starts MeetApp, or arrives before sign-in has loaded, isn't lost. A link never joins anything by itself.
import { ipcMain, type BrowserWindow } from "electron";
import { fromAppPage } from "./auth-bridge.ts";
import { MEETING_LINK_CHANNEL, readAppMeetingLink } from "./links.ts";

export interface MeetingLinks {
  /** A link from open-url, a second start or the first start's arguments. */
  arrived: (raw: string) => void;
  /** A link waits to be shown (a start with one shows the window, AC-08). */
  waiting: () => boolean;
  watch: (window: BrowserWindow) => void;
}

export function createMeetingLinks(appUrl: string, showWindow: () => BrowserWindow | undefined): MeetingLinks {
  let pending: string | undefined;
  const listening = new Set<number>();
  const flush = () => {
    const window = showWindow();
    if (!pending || !window || window.isDestroyed() || !listening.has(window.webContents.id)) return;
    window.webContents.send(MEETING_LINK_CHANNEL, pending);
    pending = undefined;
  };
  ipcMain.on(MEETING_LINK_CHANNEL, (event) => {
    if (!fromAppPage(event, appUrl)) return;
    listening.add(event.sender.id);
    if (pending) flush();
  });
  return {
    arrived(raw) {
      pending = readAppMeetingLink(raw) ?? pending;
      // Shows the window either way: a wrong link only brings MeetApp to the front.
      if (pending) flush();
      else showWindow();
    },
    waiting: () => pending !== undefined,
    watch(window) {
      const id = window.webContents.id;
      // A reloaded page listens again once it has loaded.
      window.webContents.on("did-start-navigation", (details) => {
        if (details.isMainFrame && !details.isSameDocument) listening.delete(id);
      });
    },
  };
}
