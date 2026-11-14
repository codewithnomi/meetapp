// What the call screen shares with F16's mini call window (design.md 3.1, 3.2): the call as the screen
// shows it, and the screen's own button handlers, so a press in the mini window does exactly what the
// same button does (AC-F16-16). Set by the call screen while it is open; empty otherwise. F17's small call
// view reads the same store, plus the speaker's live track, whether Leave has choices, and own sharing.
import type { CallWindowsCall } from "@meetapp/contracts";
import type { VideoTrack } from "livekit-client";
import { create } from "zustand";

interface CallScreenControls {
  toggleMic: () => void;
  toggleCamera: () => void;
  share: () => void;
  toggleHand: () => void;
  leave: () => void;
}

/** F17 (design.md 3.3): what only the small call view inside the main window needs. */
export interface CallScreenExtras {
  /** The speaker's camera or shared screen as a LiveKit track: attached to a visible element, it keeps
   * arriving while the full call is hidden (adaptive stream). None when neither is on. */
  video?: VideoTrack | undefined;
  /** Organizers may end the meeting from the full call's Leave menu, so Leave shows the full call. */
  leaveChoices?: boolean;
  /** The person shares their own screen ("You're sharing"). */
  sharing?: boolean;
}

interface CallScreenState {
  call: CallWindowsCall | null;
  controls: CallScreenControls | null;
  extras: CallScreenExtras;
  publish: (call: CallWindowsCall, controls: CallScreenControls, extras?: CallScreenExtras) => void;
  clear: () => void;
}

export const useCallScreen = create<CallScreenState>((set) => ({
  call: null,
  controls: null,
  extras: {},
  publish: (call, controls, extras = {}) => set({ call, controls, extras }),
  clear: () => set({ call: null, controls: null, extras: {} }),
}));
