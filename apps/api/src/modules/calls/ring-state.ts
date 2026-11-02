// The ring state machine (F15 design 3.3, 3.4; TC-F15-17): only a ringing ring can change, and the first
// answer wins; accepted, declined, missed and cancelled are final.
export type RingState = "ringing" | "accepted" | "declined" | "missed" | "cancelled";
export type RingEvent = "accept" | "decline" | "cancel" | "timeout" | "ended";

const RESULT: Record<RingEvent, Exclude<RingState, "ringing">> = {
  accept: "accepted",
  decline: "declined",
  cancel: "cancelled",
  timeout: "missed",
  ended: "missed",
};

/** The state after `event`, or "over" when the ring was already answered or stopped. */
export function nextRingState(state: RingState, event: RingEvent): RingState | "over" {
  return state === "ringing" ? RESULT[event] : "over";
}
