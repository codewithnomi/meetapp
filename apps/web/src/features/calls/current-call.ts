// F17 (design.md 3.2, 3.4): the call this window is in, wherever the person is in MeetApp: a chat call,
// a meeting, or a meeting's lobby, with the path that shows it full. Nothing once it has ended: an ended
// call's outcome waits in `useCallOutcome` for its banner, while the visit stays for Rejoin.
import { create } from "zustand";
import { useVisit, type Attendance, type Joined } from "../meetings/index.ts";
import { useChatCall, type ChatCall } from "./chat-call.ts";

export interface CurrentCall {
  kind: "meeting" | "chat";
  /** The chat a chat call belongs to: its row says "Call in progress". */
  conversationId?: string;
  title: string;
  fullPath: "/meeting/call" | "/meeting/lobby" | "/call";
  /** False for a chat call that was declined or not answered: its screen shows, but no call runs. */
  live: boolean;
}

interface CallOutcomeState {
  /** How the call ended while the person was on another screen; shown as a banner (AC-F17-06). */
  outcome: Attendance | undefined;
  set: (outcome: Attendance) => void;
  clear: () => void;
}

export const useCallOutcome = create<CallOutcomeState>((set) => ({
  outcome: undefined,
  set: (outcome) => set({ outcome }),
  clear: () => set({ outcome: undefined }),
}));

const IN_CALL_STATUSES = new Set(["admitted", "in_call"]);

/** The current call from the stores' values (also read outside React, e.g. while waiting to leave). */
function currentCallOf(
  visit: Joined | undefined,
  chat: ChatCall | undefined,
  outcome: Attendance | undefined,
): CurrentCall | undefined {
  // An ended call's outcome hides only that call, never a newer one (verify, bug H1).
  if (outcome && visit && outcome.attendanceId === visit.attendanceId) return undefined;
  if (chat) {
    // Declined or unanswered: the Calling screen still shows, but the person is in no call (bug H3).
    const live = chat.phase === "ringing" || chat.phase === "in_call";
    return { kind: "chat", conversationId: chat.conversationId, title: chat.title, fullPath: "/call", live };
  }
  if (visit?.status === "waiting")
    return { kind: "meeting", title: visit.title, fullPath: "/meeting/lobby", live: true };
  if (visit && IN_CALL_STATUSES.has(visit.status))
    return { kind: "meeting", title: visit.title, fullPath: "/meeting/call", live: true };
  return undefined;
}

/** True while this window is really in a call (ringing, waiting or in it), read now (outside React). */
export function inCallNow(): boolean {
  const call = currentCallOf(useVisit.getState().visit, useChatCall.getState().call, useCallOutcome.getState().outcome);
  return call?.live ?? false;
}

export function useCurrentCall(): CurrentCall | undefined {
  const visit = useVisit((state) => state.visit);
  const chat = useChatCall((state) => state.call);
  const outcome = useCallOutcome((state) => state.outcome);
  return currentCallOf(visit, chat, outcome);
}
