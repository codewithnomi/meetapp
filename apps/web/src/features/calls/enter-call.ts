// Entering a chat call after starting, joining, accepting or moving it (F15): the camera starts on for
// video and off for audio with the microphone on (AC-F15-01, 06), the join answer becomes the current
// visit so the call screen connects like F02's, and the chat call is remembered with its phase.
import { loadPrefs, savePrefs, useVisit, type Joined } from "../meetings/index.ts";
import { useChatCall, type ChatCall } from "./chat-call.ts";

export function useEnterCall(onEntered: () => void) {
  const startVisit = useVisit((state) => state.start);
  const begin = useChatCall((state) => state.begin);
  return (joined: Joined, call: ChatCall) => {
    savePrefs({ ...loadPrefs(), cameraOn: call.media === "video", microphoneOn: true });
    startVisit(joined);
    begin(call);
    onEntered();
  };
}
