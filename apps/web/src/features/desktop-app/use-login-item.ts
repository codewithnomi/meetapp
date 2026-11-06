// F04 AC-09: "Start MeetApp when I log in" (Settings → General), through the desktop bridge. Shows the real
// state: after a change, the answer from the computer is what the switch shows.
import { useCallback, useEffect, useState } from "react";

type LoginItemBridge = { get: () => Promise<boolean>; set: (on: boolean) => Promise<boolean> };
type AppBridge = { app?: { loginItem?: LoginItemBridge } };

const bridge = (): LoginItemBridge | undefined => (window as { meetapp?: AppBridge }).meetapp?.app?.loginItem;

/** Only the desktop app can start at login. */
export const canStartAtLogin = (): boolean => bridge() !== undefined;

export function useLoginItem(): { on: boolean | undefined; failed: boolean; change: (on: boolean) => void } {
  const [on, setOn] = useState<boolean>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    bridge()
      ?.get()
      .then((value) => live && setOn(value))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);
  const change = useCallback((next: boolean) => {
    setFailed(false);
    bridge()
      ?.set(next)
      .then(setOn)
      .catch(() => setFailed(true));
  }, []);
  return { on, failed, change };
}
