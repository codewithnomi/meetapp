// F16's small call window (design.md section 2; approved canvas board "Calls while MeetApp isn't in
// front"): a RingWindow for an incoming call or a MiniCallWindow during a call, from what the desktop
// app sends. Every press goes back to it; the main MeetApp window does the work.
import type { CallWindowsCall, CallWindowsRing, NoticeCard as Card } from "@meetapp/contracts";
import type { TFunction } from "i18next";
import { MiniCallWindow, NoticeCard, RingWindow } from "@meetapp/ui";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  act,
  callCaption,
  micAndCamera,
  useFrameCanvas,
  useSmallWindowView,
} from "../../features/call-windows/index.ts";
import { shortcutText, useElapsed } from "../../features/meetings/index.ts";

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

/** The speaker's live video, drawn from the main window's pictures (named in the caption, so hidden here). */
function LiveVideo() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useFrameCanvas(canvas, true);
  return <canvas ref={canvas} aria-hidden="true" />;
}

/** The four toggles; a disabled one says why (AC-F16-16, 21). */
function toggles(call: CallWindowsCall, t: TFunction) {
  return {
    ...micAndCamera(call, t, { mic: () => act({ name: "toggleMic" }), camera: () => act({ name: "toggleCamera" }) }),
    share: {
      // A disabled button says why (AC-F16-21).
      label: t(call.canShare ? "calls.windows.share" : "calls.windows.shareLocked"),
      disabled: !call.canShare,
      onClick: () => act({ name: "share" }),
    },
    hand: {
      label: t(call.hand ? "calls.windows.lowerHand" : "calls.windows.raiseHand", { keys: shortcutText("K") }),
      on: call.hand,
      onClick: () => act({ name: "toggleHand" }),
    },
  };
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
      caption={callCaption(call, t)}
      captionIsStatus={call.phase !== "in-call"}
      controls={inCall}
      controlsLabel={t("calls.windows.controls")}
      {...toggles(call, t)}
      leave={{
        label: t(call.phase === "calling" ? "calls.windows.cancel" : "calls.windows.leave"),
        onClick: () => act({ name: "leave" }),
      }}
      back={{ label: t("calls.windows.back"), onClick: () => act({ name: "backToCall" }) }}
      hide={{ label: t("calls.windows.hideMini"), onClick: () => act({ name: "hideMini" }) }}
    />
  );
}

/** F04: a notification card; its buttons go back to the window that sent it (AC-F04-30). */
function Notice({ card }: { card: Card }) {
  const { t } = useTranslation();
  const choose = (choice: "open" | "admit" | "viewLobby" | "close") => () => act({ name: "notice", choice });
  const opens = card.kind === "message" || card.kind === "mention";
  return (
    <NoticeCard
      kind={card.kind}
      title={card.title}
      detail={card.detail}
      text={card.text}
      tag={card.tag}
      person={card.person}
      open={opens ? { label: t("notices.open", { name: card.title }), onClick: choose("open") } : undefined}
      admit={card.admit ? { label: card.admit, onClick: choose("admit") } : undefined}
      viewLobby={card.viewLobby ? { label: card.viewLobby, onClick: choose("viewLobby") } : undefined}
      close={{ label: card.close, onClick: choose("close") }}
      onHover={(on) => act({ name: "noticeHover", on })}
    />
  );
}

export function CallWindowPage() {
  const view = useSmallWindowView();
  if (!view) return null;
  if (view.kind === "ring") return <Ring ring={view.ring} />;
  if (view.kind === "notice") return <Notice card={view.card} />;
  return <Mini call={view.call} />;
}
