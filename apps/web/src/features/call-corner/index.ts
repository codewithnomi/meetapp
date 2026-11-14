// F17 (design.md 3.3; AC-F17-21): whether the small call view is showing at the bottom right. The call
// host sets it; the app's frames read it to keep room below their content. On its own so that any screen
// can read it without depending on the calls.
import { create } from "zustand";

export const useCallCorner = create<{ taken: boolean; set: (taken: boolean) => void }>((set) => ({
  taken: false,
  set: (taken) => set({ taken }),
}));
