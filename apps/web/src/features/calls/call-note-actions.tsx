// What a call note in a chat can do (F15 AC-F15-15): Join the chat's running call, or Call back after a
// missed call. The chat screen provides it; meeting chats have no call notes, so there it is absent.
import { createContext, useContext } from "react";

export interface CallNoteActions {
  /** The chat's running call, if any: its "started a call" note offers Join. */
  runningCallId: string | undefined;
  join: (callId: string) => void;
  callBack: () => void;
}

const Context = createContext<CallNoteActions | undefined>(undefined);

export const CallNoteActionsProvider = Context.Provider;
export const useCallNoteActions = () => useContext(Context);
