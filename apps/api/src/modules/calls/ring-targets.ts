// Where rings go (F15 design 3.8, D075): the backend owns ringing and sends each ring and its stop to the
// person's "ring targets". Today one target, the live line (every open desktop window); the mobile app
// (F11) adds push notifications behind the same interface, without changing how ringing works.
import type { LineServerMessage, RingMessage } from "@meetapp/contracts";

export type RingStopReason = "accepted" | "declined" | "cancelled" | "missed" | "ended";

export interface RingTarget {
  ring: (userId: string, ring: RingMessage) => Promise<void>;
  stop: (userId: string, callId: string, reason: RingStopReason) => Promise<void>;
}

/** Every open window of the person, through F14's live line (D064). */
export function liveLineTarget(live: {
  toPerson: (userId: string, message: LineServerMessage) => Promise<void>;
}): RingTarget {
  return {
    ring: (userId, ring) => live.toPerson(userId, ring),
    stop: (userId, callId, reason) => live.toPerson(userId, { t: "ring_stop", callId, reason }),
  };
}

/** Sends to every target; one that fails never stops the others (TC-F15-45). */
export function allTargets(targets: RingTarget[]): RingTarget {
  return {
    ring: async (userId, ring) => {
      await Promise.allSettled(targets.map((target) => target.ring(userId, ring)));
    },
    stop: async (userId, callId, reason) => {
      await Promise.allSettled(targets.map((target) => target.stop(userId, callId, reason)));
    },
  };
}
