// Status (F14 AC-F14-26, design 3.8), worked out from a person's open live lines and calls, as in
// Teams: In a meeting while in a call; Available after a key or mouse action in the last 5 minutes;
// Away when idle for 5 minutes or the computer is locked; Offline 30 seconds after the last line
// closed (a short grace for reconnects).
import type { Status } from "@meetapp/contracts";

const ACTIVE_FOR_MS = 5 * 60 * 1000;
export const OFFLINE_GRACE_MS = 30 * 1000;
/** A line that hasn't been heard from for this long is gone (its server stopped without closing it). */
const LINE_LOST_MS = 3 * 60 * 1000;

export interface LinePresence {
  activeAt: number;
  locked: boolean;
  seenAt: number;
}

export interface Presence {
  lines: LinePresence[];
  /** When the last line closed. */
  closedAt: number | null;
  inCall: boolean;
}

export function statusOf(presence: Presence, now: number): Status {
  if (presence.inCall) return "in_meeting";
  const open = presence.lines.filter((line) => now - line.seenAt < LINE_LOST_MS);
  if (open.some((line) => !line.locked && now - line.activeAt < ACTIVE_FOR_MS)) return "available";
  if (open.length > 0) return "away";
  if (presence.closedAt !== null && now - presence.closedAt < OFFLINE_GRACE_MS) return "away";
  return "offline";
}
