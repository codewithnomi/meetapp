// F04: what the desktop app asks of the screens. The menu-bar or tray menu opens Settings and sets the
// status (signed in), and a clicked meeting link opens Join a meeting, which looks it up. Signed in, a link
// during a call opens it too: the call keeps running (F17, AC-F17-11). A guest's call lives on its screen,
// so for guests the screen stays and the link waits until Join a meeting opens.
import { useLocation } from "react-router";
import { useMeetingLinks, useTrayCommands } from "../features/desktop-app/index.ts";
import { useStatusFromTray } from "../features/status/index.ts";

const BUSY_SCREENS = ["/call", "/meeting/call", "/meeting/lobby"];

/** `openSettings` is given only when signed in; then the tray's status choice is set too. */
export function useDesktopCommands({ openSettings, openJoin }: { openSettings?: () => void; openJoin: () => void }) {
  const { pathname } = useLocation();
  const busy = !openSettings && BUSY_SCREENS.includes(pathname);
  const setStatus = useStatusFromTray();
  useTrayCommands({ onSettings: () => openSettings?.(), onStatus: (status) => openSettings && setStatus(status) });
  useMeetingLinks(() => busy || openJoin());
}
