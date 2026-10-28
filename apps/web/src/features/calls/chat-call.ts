// The chat call this window is in (F15 design 2): which chat, video or audio, whether this window
// started it, and where it stands while ringing. Kept in memory only, like F02's visit.
import { create } from "zustand";
import type { CallMedia } from "./call-types.ts";

type CallPhase = "ringing" | "in_call" | "declined" | "no_answer";

export interface ChatCall {
  callId: string;
  conversationId: string;
  media: CallMedia;
  /** The chat's name: the other person's name, or the group's. */
  title: string;
  oneToOne: boolean;
  phase: CallPhase;
}

interface ChatCallState {
  call: ChatCall | undefined;
  /** The call this window just left: the "another device" bar doesn't offer it back to this window. */
  left: string | undefined;
  /** The chat of the call just left: the Chat screen opens it once (back to the chat). */
  backTo: string | undefined;
  /** Reads `backTo` once and forgets it. */
  takeBackTo: () => string | undefined;
  begin: (call: ChatCall) => void;
  move: (phase: CallPhase) => void;
  end: () => void;
}

export const useChatCall = create<ChatCallState>((set, get) => ({
  call: undefined,
  left: undefined,
  backTo: undefined,
  takeBackTo: () => {
    const id = get().backTo;
    set({ backTo: undefined });
    return id;
  },
  begin: (call) => set({ call, left: undefined }),
  move: (phase) => set(({ call }) => (call ? { call: { ...call, phase } } : {})),
  // Ending twice (Cancel, then the "cancelled" news) changes nothing the second time.
  end: () => set(({ call }) => (call ? { call: undefined, left: call.callId, backTo: call.conversationId } : {})),
}));
