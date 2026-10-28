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
  begin: (call: ChatCall) => void;
  move: (phase: CallPhase) => void;
  end: () => void;
}

export const useChatCall = create<ChatCallState>((set) => ({
  call: undefined,
  begin: (call) => set({ call }),
  move: (phase) => set(({ call }) => (call ? { call: { ...call, phase } } : {})),
  end: () => set({ call: undefined }),
}));
