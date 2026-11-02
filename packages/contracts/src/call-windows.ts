// F16's small call windows (design.md 3.1, 3.2; D079): what a main MeetApp window reports to the
// desktop app, what a small window is told to show, and the button presses that come back. Shapes only:
// they never cross the network; the desktop app checks them itself (apps/desktop call-windows.ts).

export interface CallWindowsPerson {
  name: string;
  initials: string;
  /** A data:image/… picture prepared by the main window: the small windows load nothing themselves. */
  photo?: string;
}

export interface CallWindowsRing {
  callId: string;
  caller: CallWindowsPerson;
  kind: "video" | "audio";
  chatName?: string;
  /** The current call's or meeting's name when the person is busy (AC-F16-07). */
  busyIn?: string;
}

export interface CallWindowsCall {
  title: string;
  /** When the person joined (ms since 1970), for the timer. */
  joinedAt: number;
  people: number;
  phase: "lobby" | "calling" | "in-call" | "reconnecting";
  speaker: CallWindowsPerson & { hasVideo: boolean; sharing: boolean };
  mic: boolean;
  camera: boolean;
  hand: boolean;
  canUnmute: boolean;
  canShare: boolean;
}

export interface CallWindowsMissed {
  callId: string;
  from: string;
  chatName?: string;
  kind: "video" | "audio";
  conversationId: string;
  endedAt: number;
  /** The notification's words, translated by the main window (AC-F16-21, 23: names only). */
  text: { title: string; body: string; callBack: string };
}

/** What one main window reports (design.md 3.1). */
export interface CallWindowsState {
  rings: CallWindowsRing[];
  call: CallWindowsCall | null;
  missed: CallWindowsMissed[];
}

/** What a small window is told to show. */
export type CallWindowView = { kind: "ring"; ring: CallWindowsRing } | { kind: "mini"; call: CallWindowsCall };

/** A small window's button press (design.md 3.2). */
export type CallWindowAction =
  | { name: "accept"; callId: string; video: boolean }
  | { name: "decline" | "hide"; callId: string }
  | { name: "toggleMic" | "toggleCamera" | "share" | "toggleHand" | "leave" | "backToCall" };

/** Actions only the desktop app sends, from a missed-call notification (AC-F16-11). */
export type CallWindowsNotificationAction =
  { name: "openChat"; conversationId: string } | { name: "callBack"; conversationId: string; video: boolean };

/** Everything a main window may be asked to do. */
export type CallWindowsMainAction = CallWindowAction | CallWindowsNotificationAction;
