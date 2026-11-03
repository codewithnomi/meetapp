// The calls ringing for this person right now (F15 design 3.3): added by the live line's `ring`, gone on
// `ring_stop` or when the ring expires, so every window starts and stops together. Newest on top.
import type { RingMessage } from "@meetapp/contracts";
import { create } from "zustand";

interface IncomingState {
  rings: RingMessage[];
  /** Rings silenced with the ring window's × (F16 AC-F16-04): still shown here, without the tone. */
  silenced: string[];
  add: (ring: RingMessage) => void;
  remove: (callId: string) => void;
  silence: (callId: string) => void;
}

export const useIncomingCalls = create<IncomingState>((set) => ({
  rings: [],
  silenced: [],
  add: (ring) => set(({ rings }) => ({ rings: [ring, ...rings.filter((r) => r.callId !== ring.callId)] })),
  remove: (callId) =>
    set(({ rings, silenced }) => ({
      rings: rings.filter((r) => r.callId !== callId),
      silenced: silenced.filter((id) => id !== callId),
    })),
  silence: (callId) => set(({ silenced }) => ({ silenced: [...new Set([...silenced, callId])] })),
}));
