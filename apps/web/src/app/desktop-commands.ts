// F04: what the desktop app asks of the screens. The menu-bar or tray menu opens Settings and sets the
// status (signed in), and a clicked meeting link opens Join a meeting, which looks it up. During a
// call or in the lobby the screen stays (leaving it would end the call); the link waits until Meetings opens.
import { useLocation } from "react-router";
import { useMeetingLinks, useTrayCommands } from "../features/desktop-app/index.ts";
import { useStatusFromTray } from "../features/status/index.ts";

const BUSY_SCREENS = ["/call", "/meeting/call", "/meeting/lobby"];

/** `openSettings` is given only when signed in; then the tray's status choice is set too. */
export function useDesktopCommands({ openSettings, openJoin }: { openSettings?: () => void; openJoin: () => void }) {
  const { pathname } = useLocation();
  const busy = BUSY_SCREENS.includes(pathname);
  const setStatus = useStatusFromTray();
  useTrayCommands({ onSettings: () => openSettings?.(), onStatus: (status) => openSettings && setStatus(status) });
  useMeetingLinks(() => busy || openJoin());
}
