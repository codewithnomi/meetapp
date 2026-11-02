// The lobby and the Calling screen share their state with F16's mini call window (AC-F16-14): it shows
// "Waiting to be let in…" or "Calling …", and its Leave (or Cancel) runs the screen's own button.
import { useEffect, useRef } from "react";
import { useCallScreen } from "./call-screen.ts";
import { waitingCall } from "./report.ts";

const none = () => undefined;

export function usePublishWaiting(phase: "lobby" | "calling" | undefined, title: string, leave: () => void): void {
  const publish = useCallScreen((state) => state.publish);
  const clear = useCallScreen((state) => state.clear);
  const latest = useRef(leave);
  latest.current = leave;
  useEffect(() => {
    if (!phase) return;
    publish(waitingCall(phase, title), {
      toggleMic: none,
      toggleCamera: none,
      share: none,
      toggleHand: none,
      leave: () => latest.current(),
    });
    return clear;
  }, [phase, title, publish, clear]);
}
