// The incoming call on every screen of the app (F15 AC-F15-05, 06, 10, 32; design 2.3 and 3.4). Rings
// come from the live line; the chosen ringtone plays (a third as loud during another call). Accepting
// leaves the current call or meeting first, then accepts and opens the call; declining stops the ring
// in every window. A ring nobody answers disappears when it expires.
import type { RingMessage } from "@meetapp/contracts";
import { IncomingCall, Notice } from "@meetapp/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLiveLine } from "../chats/index.ts";
import type { ApiError } from "../api/index.ts";
import { leaveMeeting, loadPrefs, savePrefs, useVisit, type Joined } from "../meetings/index.ts";
import { acceptCall, declineCall, ringSettings } from "./calls-api.ts";
import { useChatCall } from "./chat-call.ts";
import type { CallMedia } from "./call-types.ts";
import { useIncomingCalls } from "./incoming-calls.ts";
import { playRingtone } from "./ringtones.ts";

const RING_SETTINGS = ["ring-settings"];

/** Keeps the ring list in step with the live line and drops rings that expired. */
function useRings() {
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
function useRingtone(ringing: boolean, quiet: boolean) {
  const settings = useQuery({ queryKey: RING_SETTINGS, queryFn: ringSettings, staleTime: 60_000 });
  const ringtone = settings.data?.ringtone ?? 1;
  const volume = settings.data?.ringVolume ?? 70;
  useEffect(() => {
    if (!ringing || typeof AudioContext === "undefined") return;
    const stop = playRingtone(() => new AudioContext(), { ringtone, volume, quiet });
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
function useAnswer(onAccepted: () => void) {
  const remove = useIncomingCalls((state) => state.remove);
  const visit = useVisit((state) => state.visit);
  const startVisit = useVisit((state) => state.start);
  const endVisit = useVisit((state) => state.end);
  const begin = useChatCall((state) => state.begin);
  const endCall = useChatCall((state) => state.end);
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
      savePrefs({ ...loadPrefs(), cameraOn: media === "video", microphoneOn: true });
      startVisit(joined);
      begin({
        callId: ring.callId,
        conversationId: ring.conversationId,
        media,
        title: ring.groupName ?? ring.from.name,
        oneToOne: ring.groupName === null,
        phase: "in_call",
      });
      onAccepted();
    },
    // A ring that is over (answered elsewhere, ended) goes; otherwise it stays, to try again.
    onError: (error, { ring }) => {
      if (error.code === "RING_OVER" || error.code === "NOT_FOUND") remove(ring.callId);
    },
  });
  const decline = (ring: RingMessage) => {
    remove(ring.callId);
    void declineCall(ring.callId).catch(() => undefined);
  };
  return { accept, decline, busyIn: visit?.title };
}

export function IncomingCalls({ onAccepted }: { onAccepted: () => void }) {
  const { t } = useTranslation();
  const rings = useRings();
  const { accept, decline, busyIn } = useAnswer(onAccepted);
  useRingtone(rings.length > 0, busyIn !== undefined);
  if (rings.length === 0 && !accept.isError) return null;
  const leave = busyIn === undefined ? "" : "leave_";
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3" aria-live="assertive">
      {accept.isError ? <Notice tone="danger">{t("calls.failed.join")}</Notice> : null}
      {rings.map((ring) => (
        <IncomingCall
          key={ring.callId}
          label={t("calls.incoming.label")}
          callerName={ring.from.name}
          photoUrl={ring.from.photoUrl}
          subtitle={[t(`calls.incoming.${ring.media}`), ring.groupName].filter(Boolean).join(" · ")}
          busyNote={busyIn === undefined ? undefined : t("calls.incoming.busy", { title: busyIn })}
          video={{
            label: t(`calls.incoming.${leave}acceptVideo`),
            short: t("calls.incoming.videoShort"),
            onClick: () => accept.mutate({ ring, media: "video" }),
          }}
          audio={{
            label: t(`calls.incoming.${leave}acceptAudio`),
            short: t("calls.incoming.audioShort"),
            onClick: () => accept.mutate({ ring, media: "audio" }),
          }}
          decline={{
            label: t("calls.incoming.decline"),
            short: t("calls.incoming.decline"),
            onClick: () => decline(ring),
          }}
        />
      ))}
    </div>
  );
}
