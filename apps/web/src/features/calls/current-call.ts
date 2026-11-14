// F17 (design.md 3.2, 3.4): the call this window is in, wherever the person is in MeetApp: a chat call,
// a meeting, or a meeting's lobby, with the path that shows it full. Nothing once it has ended: an ended
// call's outcome waits in `useCallOutcome` for its banner, while the visit stays for Rejoin.
import { create } from "zustand";
import { useVisit, type Attendance } from "../meetings/index.ts";
import { useChatCall } from "./chat-call.ts";

export interface CurrentCall {
  kind: "meeting" | "chat";
  /** The chat a chat call belongs to: its row says "Call in progress". */
  conversationId?: string;
  title: string;
  fullPath: "/meeting/call" | "/meeting/lobby" | "/call";
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

const IN = new Set(["admitted", "in_call"]);

export function useCurrentCall(): CurrentCall | undefined {
  const visit = useVisit((state) => state.visit);
  const chat = useChatCall((state) => state.call);
  const ended = useCallOutcome((state) => state.outcome !== undefined);
  if (ended) return undefined;
  if (chat && (chat.phase === "ringing" || chat.phase === "in_call"))
    return { kind: "chat", conversationId: chat.conversationId, title: chat.title, fullPath: "/call" };
  if (visit?.status === "waiting") return { kind: "meeting", title: visit.title, fullPath: "/meeting/lobby" };
  if (visit && IN.has(visit.status)) return { kind: "meeting", title: visit.title, fullPath: "/meeting/call" };
  return undefined;
}
