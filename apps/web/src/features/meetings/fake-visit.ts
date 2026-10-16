// Test helper (tests only) for the meeting screens: a visit like the one joining answers, a stand-in for
// the browser's camera and microphone list (jsdom has none), and a request that never gets an answer
// (to look at the loading state).
import { vi } from "vitest";
import type { Joined } from "./visit.ts";

export const VISIT: Joined = {
  attendanceId: "00000000-0000-4000-8000-0000000000a1",
  status: "waiting",
  title: "Budget review",
  group: "member",
  ticket: "ticket-1",
};

/** A request that is never answered: the screen stays in its loading state. */
export const never = () => new Promise<Response>(() => undefined);

/** No camera, no microphone, no devices: the pre-join and lobby then show their problem notes, not errors. */
export function stubNoDevices() {
  const missing = Object.assign(new Error("none"), { name: "NotFoundError" });
  vi.stubGlobal("AudioContext", vi.fn());
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockRejectedValue(missing),
      enumerateDevices: vi.fn().mockResolvedValue([]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
}
