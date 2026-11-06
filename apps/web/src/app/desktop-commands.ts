// F04: what the desktop app asks of the screens. The menu-bar or tray menu opens Settings (the status
// choice is handled from T8 on), and a clicked meeting link opens Join a meeting, which looks it up. During a
// call or in the lobby the screen stays (leaving it would end the call); the link waits until Meetings opens.
import { useLocation } from "react-router";
import { useMeetingLinks, useTrayCommands } from "../features/desktop-app/index.ts";

const BUSY_SCREENS = ["/call", "/meeting/call", "/meeting/lobby"];

export function useDesktopCommands({ openSettings, openJoin }: { openSettings?: () => void; openJoin: () => void }) {
  const { pathname } = useLocation();
  const busy = BUSY_SCREENS.includes(pathname);
  useTrayCommands({ onSettings: () => openSettings?.() });
  useMeetingLinks(() => busy || openJoin());
}
