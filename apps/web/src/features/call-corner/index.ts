// F17 (design.md 3.3, 3.6): what any screen may know about the current call without depending on the
// calls: whether the small call view is up (the app's frames keep room below it, AC-F17-21), whether a
// call runs, and its Leave (signing out leaves first, AC-F17-16). The call host keeps it up to date.
import { create } from "zustand";

interface CallCornerState {
  taken: boolean;
  inCall: boolean;
  leave: (() => void) | undefined;
  set: (taken: boolean) => void;
  setCall: (inCall: boolean, leave: (() => void) | undefined) => void;
}

export const useCallCorner = create<CallCornerState>((set) => ({
  taken: false,
  inCall: false,
  leave: undefined,
  set: (taken) => set({ taken }),
  setCall: (inCall, leave) => set({ inCall, leave }),
}));

const LEAVE_WAIT_MS = 5_000;
const CHECK_MS = 100;

/** Leaves the current call; resolves true once it is over, false if it isn't after 5 s. */
export async function leaveCurrentCall(): Promise<boolean> {
  useCallCorner.getState().leave?.();
  for (let waited = 0; waited < LEAVE_WAIT_MS; waited += CHECK_MS) {
    if (!useCallCorner.getState().inCall) return true;
    await new Promise((done) => setTimeout(done, CHECK_MS));
  }
  return !useCallCorner.getState().inCall;
}
