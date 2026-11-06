// Status (F14 AC-F14-26, design 3.8), worked out from a person's open live lines and calls, as in
// Teams: In a call while in a call; Available after a key or mouse action in the last 5 minutes;
// Away when idle for 5 minutes or the computer is locked; Offline 30 seconds after the last line
// closed (a short grace for reconnects).
import type { ManualStatus, Status } from "@meetapp/contracts";

const ACTIVE_FOR_MS = 5 * 60 * 1000;
export const OFFLINE_GRACE_MS = 30 * 1000;
/** A line that hasn't been heard from for this long is gone (its server stopped without closing it): the
 * app pings every 30 seconds, so two missed pings. */
const LINE_LOST_MS = 75 * 1000;

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
  /** F04: a status set by hand and when it runs out (null = until changed). */
  manual?: { status: ManualStatus; until: Date | null } | null;
}

/** A hand-set status that hasn't run out, else null. */
export function manualOf(presence: Pick<Presence, "manual">, now: number): ManualStatus | null {
  const manual = presence.manual;
  if (!manual || (manual.until && manual.until.getTime() <= now)) return null;
  return manual.status;
}

/** F04 design 3.3: hand-set Busy/Do not disturb/Be right back/Away, then In a call, then hand-set
 * Available, then automatic. Signed out (offline) stays Offline, as in Teams. */
export function statusOf(presence: Presence, now: number): Status {
  const automatic = automaticOf(presence, now);
  const manual = manualOf(presence, now);
  if (automatic === "offline" || manual === null) return automatic;
  if (manual !== "available") return manual;
  return presence.inCall ? "in_call" : "available";
}

function automaticOf(presence: Presence, now: number): Status {
  if (presence.inCall) return "in_call";
  const open = presence.lines.filter((line) => now - line.seenAt < LINE_LOST_MS);
  if (open.some((line) => !line.locked && now - line.activeAt < ACTIVE_FOR_MS)) return "available";
  if (open.length > 0) return "away";
  if (presence.closedAt !== null && now - presence.closedAt < OFFLINE_GRACE_MS) return "away";
  return "offline";
}
