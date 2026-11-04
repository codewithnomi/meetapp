// F04 AC-10, 11: a meeting link clicked anywhere on the computer. The desktop preload passes only a checked
// meeting code; the app goes to "Join a meeting", and the form there looks the link up exactly as if it had
// been typed, so the pre-join screen or F02's own messages show. Nothing is joined by itself.
import { appMeetingLink } from "@meetapp/contracts/app-links";
import { useEffect, useRef } from "react";

type AppBridge = { app?: { onOpenMeeting?: (listener: (code: string) => void) => () => void } };

/** The newest link waiting for a Join a meeting form, and who to tell. */
let waiting: string | undefined;
const forms = new Set<() => void>();

/** Listens for links (desktop app only) and calls `onArrive` to show the Join a meeting form. */
export function useMeetingLinks(onArrive: () => void): void {
  const latest = useRef(onArrive);
  latest.current = onArrive;
  useEffect(() => {
    const bridge = (window as { meetapp?: AppBridge }).meetapp;
    return bridge?.app?.onOpenMeeting?.((code) => {
      waiting = appMeetingLink(code);
      latest.current();
      for (const form of forms) form();
    });
  }, []);
}

/** The Join a meeting form takes a waiting link (once), now and whenever a new one arrives. */
export function useOpenedLink(take: (link: string) => void): void {
  const latest = useRef(take);
  latest.current = take;
  useEffect(() => {
    const check = () => {
      if (!waiting) return;
      const link = waiting;
      waiting = undefined;
      latest.current(link);
    };
    forms.add(check);
    check();
    return () => {
      forms.delete(check);
    };
  }, []);
}
