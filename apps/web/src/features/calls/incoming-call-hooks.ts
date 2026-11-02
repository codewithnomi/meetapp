// The incoming call's workings (F15 AC-F15-05, 06, 10, 32): the rings from the live line, the ringtone,
// and answering. IncomingCalls.tsx only draws them.
import type { RingMessage } from "@meetapp/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import type { ApiError } from "../api/index.ts";
import { useLiveLine } from "../chats/index.ts";
import { leaveMeeting, useVisit, type Joined } from "../meetings/index.ts";
import { CALL_KEYS } from "./call-keys.ts";
import { acceptCall, declineCall, ringSettings } from "./calls-api.ts";
import type { CallMedia } from "./call-types.ts";
import { useChatCall } from "./chat-call.ts";
import { useEnterCall } from "./enter-call.ts";
import { useIncomingCalls } from "./incoming-calls.ts";
import { playRingtone } from "./ringtones.ts";

/** Keeps the ring list in step with the live line and drops rings that expired. */
export function useRings() {
  const { rings, add, remove } = useIncomingCalls();
  useLiveLine(
    useCallback(
      (message) => {
        if (message.t === "ring") add(message);
        if (message.t === "ring_stop") remove(message.callId);
      },
      [add, remove],
    ),
  );
  useEffect(() => {
    const timers = rings.map((ring) =>
      setTimeout(() => remove(ring.callId), Math.max(0, Date.parse(ring.expiresAt) - Date.now())),
    );
    return () => timers.forEach(clearTimeout);
  }, [rings, remove]);
  return rings;
}

/** Plays the person's ringtone while something rings (AC-F15-32); the page's data marks it for tests. */
export function useRingtone(ringing: boolean, quiet: boolean) {
  const settings = useQuery({ queryKey: CALL_KEYS.ringSettings, queryFn: ringSettings, staleTime: 60_000 });
  const ringtone = settings.data?.ringtone ?? 1;
  const volume = settings.data?.ringVolume ?? 70;
  useEffect(() => {
    if (!ringing || typeof AudioContext === "undefined") return;
    const stop = playRingtone(() => new AudioContext(), { ringtone, volume, quiet });
    // Marked on the page so the desktop tests can check which tone plays and how loud (TC-F15-54).
    document.body.dataset.ringtone = String(ringtone);
    document.body.dataset.ringVolume = String(Math.round(quiet ? volume / 3 : volume));
    return () => {
      stop();
      delete document.body.dataset.ringtone;
      delete document.body.dataset.ringVolume;
    };
  }, [ringing, quiet, ringtone, volume]);
}

/** Accept: leave the current call or meeting first (AC-F15-10), then join this one as video or audio. */
export function useAnswer(onAccepted: () => void) {
  const remove = useIncomingCalls((state) => state.remove);
  const visit = useVisit((state) => state.visit);
  const endVisit = useVisit((state) => state.end);
  const endCall = useChatCall((state) => state.end);
  const enter = useEnterCall(onAccepted);
  const accept = useMutation<Joined, ApiError, { ring: RingMessage; media: CallMedia }>({
    // Accept first; only once the new call has taken the person is the current call or meeting left, so a
    // failed accept never drops them from it (T-fix-3).
    mutationFn: async ({ ring, media }: { ring: RingMessage; media: CallMedia }) => {
      const joined = await acceptCall(ring.callId, media);
      if (visit) {
        await leaveMeeting(visit);
        endCall();
        endVisit();
      }
      return joined;
    },
    onSuccess: (joined, { ring, media }) => {
      remove(ring.callId);
      enter(joined, {
        callId: ring.callId,
        conversationId: ring.conversationId,
        media,
        title: ring.groupName ?? ring.from.name,
        oneToOne: ring.groupName === null,
        phase: "in_call",
      });
    },
    // A ring that is over (answered elsewhere, ended) goes; otherwise it stays, to try again.
    onError: (error, { ring }) => {
      if (["RING_OVER", "NOT_FOUND", "CALL_ENDED"].includes(error.code)) remove(ring.callId);
    },
  });
  const decline = (ring: RingMessage) => {
    remove(ring.callId);
    // The ring is already gone here; if the backend misses the decline, the ring ends at 30 s anyway.
    void declineCall(ring.callId).catch(() => undefined);
  };
  return { accept, decline, busyIn: visit?.title };
}
