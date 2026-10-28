// Starting or joining a chat's call (F15 AC-F15-01, 03, 18, 27): the camera starts on for video and off
// for audio, the microphone on; the answer becomes the current visit, so the call screen connects like
// F02's. A starter waits on the Calling screen; someone joining goes straight into the call.
import { useMutation } from "@tanstack/react-query";
import type { ApiError } from "../api/index.ts";
import { loadPrefs, savePrefs, useVisit, type Joined } from "../meetings/index.ts";
import { joinCall, startCall } from "./calls-api.ts";
import { useChatCall } from "./chat-call.ts";
import type { CallMedia } from "./call-types.ts";

export interface CallTarget {
  conversationId: string;
  title: string;
  oneToOne: boolean;
}

function useEnter(onEntered: () => void) {
  const startVisit = useVisit((state) => state.start);
  const begin = useChatCall((state) => state.begin);
  return (joined: Joined, target: CallTarget, media: CallMedia, ringing: boolean) => {
    savePrefs({ ...loadPrefs(), cameraOn: media === "video", microphoneOn: true });
    startVisit(joined);
    begin({ ...target, callId: joined.call?.callId ?? "", media, phase: ringing ? "ringing" : "in_call" });
    onEntered();
  };
}

/** Video call / Audio call in a chat: start, or join the call already running there (no ring). */
export function useStartCall(target: CallTarget, onEntered: () => void) {
  const enter = useEnter(onEntered);
  return useMutation<Joined & { ringing: boolean }, ApiError, CallMedia>({
    mutationFn: (media) => startCall(target.conversationId, media),
    // A new call rings; a call already running (or a group too big to ring) is simply joined (AC-F15-03).
    onSuccess: (joined, media) => enter(joined, target, media, joined.ringing),
  });
}

/** **Join** in the chat header or note. */
export function useJoinCall(target: CallTarget, onEntered: () => void) {
  const enter = useEnter(onEntered);
  return useMutation<Joined, ApiError, { callId: string; media: CallMedia }>({
    mutationFn: ({ callId }) => joinCall(callId),
    onSuccess: (joined, { media }) => enter(joined, target, media, false),
  });
}
