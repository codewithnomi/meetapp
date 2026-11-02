// F16's small call window (design.md section 2; approved canvas board "Calls while MeetApp isn't in
// front"): a RingWindow for an incoming call or a MiniCallWindow during a call, from what the desktop
// app sends. Every press goes back to it; the main MeetApp window does the work.
import type { CallWindowsCall, CallWindowsRing } from "@meetapp/contracts";
import type { TFunction } from "i18next";
import { MiniCallWindow, RingWindow } from "@meetapp/ui";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { act, useFrameCanvas, useSmallWindowView } from "../../features/call-windows/index.ts";
import { useElapsed } from "../../features/meetings/index.ts";

function Ring({ ring }: { ring: CallWindowsRing }) {
  const { t } = useTranslation();
  const busy = ring.busyIn !== undefined;
  const kind = t(ring.kind === "video" ? "calls.incoming.video" : "calls.incoming.audio");
  const answer = (video: boolean) => ({
    label: t(
      busy
        ? video
          ? "calls.incoming.leave_acceptVideo"
          : "calls.incoming.leave_acceptAudio"
        : video
          ? "calls.incoming.acceptVideo"
          : "calls.incoming.acceptAudio",
    ),
    short: t(video ? "calls.incoming.videoShort" : "calls.incoming.audioShort"),
    onClick: () => act({ name: "accept", callId: ring.callId, video }),
  });
  return (
    <RingWindow
      label={t(ring.kind === "video" ? "calls.windows.ringLabel_video" : "calls.windows.ringLabel_audio", {
        name: ring.caller.name,
      })}
      callerName={ring.caller.name}
      photoUrl={ring.caller.photo}
      subtitle={ring.chatName ? `${kind} · ${ring.chatName}` : kind}
      busyNote={busy ? t("calls.incoming.busy", { title: ring.busyIn }) : undefined}
      video={answer(true)}
      audio={answer(false)}
      decline={{
        label: t("calls.incoming.decline"),
        short: t("calls.incoming.decline"),
        onClick: () => act({ name: "decline", callId: ring.callId }),
      }}
      hide={{ label: t("calls.windows.hide"), onClick: () => act({ name: "hide", callId: ring.callId }) }}
    />
  );
}

function caption(call: CallWindowsCall, t: TFunction): string {
  if (call.phase === "reconnecting") return t("calls.windows.reconnecting");
  if (call.phase === "lobby") return t("calls.windows.lobby");
  if (call.phase === "calling") return t("calls.windows.calling", { name: call.title });
  return t(call.speaker.sharing ? "calls.windows.sharing" : "calls.windows.speaking", { name: call.speaker.name });
}

/** The speaker's live video, drawn from the main window's pictures (named in the caption, so hidden here). */
function LiveVideo() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useFrameCanvas(canvas, true);
  return <canvas ref={canvas} aria-hidden="true" />;
}

function Mini({ call }: { call: CallWindowsCall }) {
  const { t } = useTranslation();
  const time = useElapsed(call.joinedAt);
  const live = call.speaker.hasVideo || call.speaker.sharing;
  const inCall = call.phase === "in-call";
  const details = { lobby: t("calls.windows.lobbyDetails"), calling: t("calls.windows.callingDetails") }[
    call.phase as "lobby" | "calling"
  ];
  return (
    <MiniCallWindow
      label={t("calls.windows.miniLabel", { title: call.title })}
      title={call.title}
      details={details ?? t("calls.windows.details", { time, count: call.people })}
      speakerName={call.speaker.name}
      speakerPhoto={call.speaker.photo}
      video={live ? <LiveVideo /> : undefined}
      caption={caption(call, t)}
      controls={inCall}
      controlsLabel={t("calls.windows.controls")}
      mic={{
        label: t(
          call.canUnmute || call.mic
            ? call.mic
              ? "calls.windows.mute"
              : "calls.windows.unmute"
            : "calls.windows.micLocked",
        ),
        on: call.mic,
        disabled: !call.mic && !call.canUnmute,
        onClick: () => act({ name: "toggleMic" }),
      }}
      camera={{
        label: t(call.camera ? "calls.windows.cameraOff" : "calls.windows.cameraOn"),
        on: call.camera,
        onClick: () => act({ name: "toggleCamera" }),
      }}
      share={{ label: t("calls.windows.share"), disabled: !call.canShare, onClick: () => act({ name: "share" }) }}
      hand={{
        label: t(call.hand ? "calls.windows.lowerHand" : "calls.windows.raiseHand"),
        on: call.hand,
        onClick: () => act({ name: "toggleHand" }),
      }}
      leave={{
        label: t(call.phase === "calling" ? "calls.windows.cancel" : "calls.windows.leave"),
        onClick: () => act({ name: "leave" }),
      }}
      back={{ label: t("calls.windows.back"), onClick: () => act({ name: "backToCall" }) }}
    />
  );
}

export function CallWindowPage() {
  const view = useSmallWindowView();
  if (!view) return null;
  return view.kind === "ring" ? <Ring ring={view.ring} /> : <Mini call={view.call} />;
}
