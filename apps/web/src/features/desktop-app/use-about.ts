// F04 AC-50: Settings → About: the desktop app's version, and whether updates are on (off until MeetApp
// goes online), from the desktop bridge.
import { useEffect, useState } from "react";

export interface About {
  version: string;
  updates: boolean;
}
type AppBridge = { app?: { about?: () => Promise<About> } };

export function useAbout(): About | undefined {
  const [about, setAbout] = useState<About>();
  useEffect(() => {
    let live = true;
    void (window as { meetapp?: AppBridge }).meetapp?.app
      ?.about?.()
      .then((value) => live && setAbout(value))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return about;
}
