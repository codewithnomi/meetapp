// F17 (design.md 3.3, 3.6): what any screen may know about the current call without depending on the
// calls: whether the small call view is up (the app's frames keep room below it, AC-F17-21), and one way
// to leave the call and wait until it is over (leave first, AC-F17-09, 12; sign out, AC-F17-16). The call
// host registers how to tell "in a call" and how to leave, from the calls' own stores, once.
import { create } from "zustand";

interface CurrentCallAccess {
  inCall: () => boolean;
  leave: () => void;
}

interface CallCornerState {
  taken: boolean;
  set: (taken: boolean) => void;
  access: CurrentCallAccess | undefined;
  register: (access: CurrentCallAccess | undefined) => void;
}

export const useCallCorner = create<CallCornerState>((set) => ({
  taken: false,
  set: (taken) => set({ taken }),
  access: undefined,
  register: (access) => set({ access }),
}));

const LEAVE_WAIT_MS = 5_000;
const CHECK_MS = 100;

/** True while this window is in a call, read now (outside React). */
export const inCallNow = (): boolean => useCallCorner.getState().access?.inCall() ?? false;

/** Leaves the current call; resolves true once it is over, false if it still isn't after 5 s. */
export async function leaveAndWait(): Promise<boolean> {
  useCallCorner.getState().access?.leave();
  for (let waited = 0; waited < LEAVE_WAIT_MS; waited += CHECK_MS) {
    if (!inCallNow()) return true;
    await new Promise((done) => setTimeout(done, CHECK_MS));
  }
  return !inCallNow();
}
