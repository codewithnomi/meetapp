// The chat open on the Chat screen (F04 design 3.4): a new message there gives no card while the window
// is in front. The Chat screen sets it; a hidden, minimised or unfocused window counts as not in front.
import { create } from "zustand";
import { windowInFront } from "./front.ts";

export const useShownChat = create<{ id: string | undefined; set: (id: string | undefined) => void }>((set) => ({
  id: undefined,
  set: (id) => set({ id }),
}));

/** The chat shown in this window if the window is in front, else undefined. */
export function chatInFront(): string | undefined {
  return windowInFront() ? useShownChat.getState().id : undefined;
}
