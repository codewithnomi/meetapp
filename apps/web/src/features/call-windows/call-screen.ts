// What the call screen shares with F16's mini call window (design.md 3.1, 3.2): the call as the screen
// shows it, and the screen's own button handlers, so a press in the mini window does exactly what the
// same button does (AC-F16-16). Set by the call screen while it is open; empty otherwise.
import type { CallWindowsCall } from "@meetapp/contracts";
import { create } from "zustand";

export interface CallScreenControls {
  toggleMic: () => void;
  toggleCamera: () => void;
  share: () => void;
  toggleHand: () => void;
  leave: () => void;
}

interface CallScreenState {
  call: CallWindowsCall | null;
  controls: CallScreenControls | null;
  publish: (call: CallWindowsCall, controls: CallScreenControls) => void;
  clear: () => void;
}

export const useCallScreen = create<CallScreenState>((set) => ({
  call: null,
  controls: null,
  publish: (call, controls) => set({ call, controls }),
  clear: () => set({ call: null, controls: null }),
}));
