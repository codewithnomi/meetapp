// The calls ringing for this person right now (F15 design 3.3): added by the live line's `ring`, gone on
// `ring_stop` or when the ring expires, so every window starts and stops together. Newest on top.
import type { RingMessage } from "@meetapp/contracts";
import { create } from "zustand";

interface IncomingState {
  rings: RingMessage[];
  add: (ring: RingMessage) => void;
  remove: (callId: string) => void;
}

export const useIncomingCalls = create<IncomingState>((set) => ({
  rings: [],
  add: (ring) => set(({ rings }) => ({ rings: [ring, ...rings.filter((r) => r.callId !== ring.callId)] })),
  remove: (callId) => set(({ rings }) => ({ rings: rings.filter((r) => r.callId !== callId) })),
}));
