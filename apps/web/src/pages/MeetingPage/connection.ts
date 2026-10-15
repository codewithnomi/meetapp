// Looking after the connection and devices during the call (AC-F02-28, 31, 32): the own line's quality,
// a device that was unplugged, and telling the backend when the window closes so others see the person
// leave at once.
import type { Room } from "livekit-client";
import { useEffect, useState, type RefObject } from "react";
import {
  leaveMeeting,
  useDeviceChanges,
  useOwnLineWeak,
  type DeviceGone,
  type Joined,
} from "../../features/meetings/index.ts";

export function useConnectionCare(room: Room | undefined, visit: Joined, leaving: RefObject<boolean>) {
  const ownWeak = useOwnLineWeak(room);
  const [gone, setGone] = useState<DeviceGone>();
  useDeviceChanges(room, setGone);
  useEffect(() => {
    const closing = () => {
      if (!leaving.current) void leaveMeeting(visit, true);
    };
    window.addEventListener("pagehide", closing);
    return () => window.removeEventListener("pagehide", closing);
  }, [visit, leaving]);
  return { ownWeak, gone, clearGone: () => setGone(undefined) };
}
