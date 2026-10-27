// Whether the background effect turned itself off because the video got slow (AC-F15-31): shown once
// as a message; the effect stays off until the person chooses one again.
import { create } from "zustand";

interface SlowState {
  turnedOff: boolean;
  tell: () => void;
  clear: () => void;
}

export const useBackgroundSlow = create<SlowState>((set) => ({
  turnedOff: false,
  tell: () => set({ turnedOff: true }),
  clear: () => set({ turnedOff: false }),
}));
