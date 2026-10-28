// A call from a chat (F15 design 2; approved canvas "Calling: ringing, declined, no answer"). While it rings
// the starter sees the Calling screen with their own preview and Cancel; when someone accepts, the live
// line says so and the screen becomes F02's call screen; if the call is declined or not answered, the
// outcome shows with Call again and Back to chat. Someone who joined goes straight into the call.
import { Avatar, Button, CallingScreen, Notice } from "@meetapp/ui";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router";
import { cancelRing, runningCall, useChatCall, useStartCall, type ChatCall } from "../../features/calls/index.ts";
import { useLiveLine } from "../../features/chats/index.ts";
import {
  LocalVideo,
  leaveMeeting,
  loadPrefs,
  problemKey,
  useLocalDevice,
  useVisit,
  type Joined,
} from "../../features/meetings/index.ts";
import { MeetingPage, type MeetingPageProps } from "../MeetingPage/index.ts";

export interface ChatCallPageProps extends Omit<MeetingPageProps, "onLeft"> {
  /** Back to the chat the call belongs to. */
  onBackToChat: (conversationId: string) => void;
}

/** The live line moves the Calling screen on: accepted, declined, not answered, or cancelled elsewhere. */
const RECHECK_MS = 5_000;

function useRingOutcome(call: ChatCall, onCancelled: () => void) {
  const move = useChatCall((state) => state.move);
  // A message can be lost while the line reconnects, so the call itself is also checked: every 5 seconds
  // while it rings and right after a reconnect (AC-F15-19: ringing never gets stuck).
  const check = useCallback(() => {
    if (useChatCall.getState().call?.phase !== "ringing") return;
    void runningCall(call.conversationId)
      .then(({ call: running }) => {
        if (!running || running.callId !== call.callId) move("no_answer");
        else if (running.people >= 2) move("in_call");
      })
      .catch(() => undefined);
  }, [call.conversationId, call.callId, move]);
  useEffect(() => {
    const timer = setInterval(check, RECHECK_MS);
    return () => clearInterval(timer);
  }, [check]);
  useLiveLine(
    useCallback(
      (message) => {
        if (message.t === "connected") return check();
        if (message.t !== "ring_stop" || message.callId !== call.callId) return;
        if (message.reason === "accepted") move("in_call");
        else if (message.reason === "declined") move("declined");
        else if (message.reason === "missed") move("no_answer");
        else onCancelled();
      },
      [call.callId, move, onCancelled, check],
    ),
  );
}

function Preview({ call }: { call: ChatCall }) {
  const { t } = useTranslation();
  const [prefs] = useState(loadPrefs);
  const camera = useLocalDevice("camera", prefs.cameraId, call.media === "video" && call.phase === "ringing");
  if (camera.problem) return <Notice tone="neutral">{t(problemKey("camera", camera.problem))}</Notice>;
  // While the camera starts, a frame of the same size keeps the screen from jumping.
  if (!camera.stream) {
    return call.media === "video" ? (
      <div aria-hidden="true" className="aspect-video w-full rounded-lg bg-stage-scrim" />
    ) : null;
  }
  return (
    <figure className="m-0 flex flex-col gap-2">
      <LocalVideo stream={camera.stream} />
      <figcaption className="text-[13px] opacity-85">{t("calls.calling.preview")}</figcaption>
    </figure>
  );
}

/** After "declined" or "No answer": Call again, or back to the chat. */
function AfterRinging({ audio, onAgain, onBack }: { audio: boolean; onAgain: () => void; onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <Button icon={audio ? "phone" : "camera"} onClick={onAgain}>
        {t("calls.calling.callAgain")}
      </Button>
      <Button variant="secondary" icon="chat" onClick={onBack}>
        {t("calls.calling.backToChat")}
      </Button>
    </>
  );
}

function Calling({ call, visit, onBack }: { call: ChatCall; visit: Joined; onBack: (conversationId: string) => void }) {
  const { t } = useTranslation();
  const end = useChatCall((state) => state.end);
  const endVisit = useVisit((state) => state.end);
  const leave = useCallback(() => {
    void leaveMeeting(visit);
    // The call is forgotten first (the Chat screen then opens its chat), then back to the chat.
    end();
    endVisit();
    onBack(call.conversationId);
  }, [visit, end, endVisit, onBack, call.conversationId]);
  useRingOutcome(call, leave);
  const again = useStartCall(
    { conversationId: call.conversationId, title: call.title, oneToOne: call.oneToOne },
    () => undefined,
  );
  const ringing = call.phase === "ringing";
  const name = call.title;
  const cancel = () => {
    void cancelRing(call.callId).catch(() => undefined);
    leave();
  };
  const outcome = call.phase === "declined" ? "declined" : "noAnswer";
  return (
    <CallingScreen
      heading={t(call.media === "video" ? "calls.calling.heading_video" : "calls.calling.heading_audio", { name })}
      picture={<Avatar name={name} size="xl" />}
      ringing={ringing}
      title={ringing ? t("calls.calling.title", { name }) : t(`calls.calling.${outcome}Title`, { name })}
      line={ringing ? t("calls.calling.line") : t(`calls.calling.${outcome}Line`, { name })}
      preview={ringing ? <Preview call={call} /> : undefined}
      actions={
        ringing ? undefined : (
          <AfterRinging audio={call.media === "audio"} onAgain={() => again.mutate(call.media)} onBack={leave} />
        )
      }
      controls={
        <div className="flex justify-center">
          <Button variant="danger" icon="leave" onClick={ringing ? cancel : leave}>
            {ringing ? t("calls.calling.cancel") : t("calls.calling.close")}
          </Button>
        </div>
      }
    />
  );
}

export function ChatCallPage({ onBackToChat, onOutcome }: ChatCallPageProps) {
  const call = useChatCall((state) => state.call);
  const end = useChatCall((state) => state.end);
  const visit = useVisit((state) => state.visit);
  if (!call || !visit?.call) return <Navigate to="/chat" replace />;
  // Leaving from inside the call goes back to its chat, and this window forgets the call.
  const left = () => (end(), onBackToChat(call.conversationId));
  if (call.phase === "in_call") return <MeetingPage onLeft={left} onOutcome={onOutcome} />;
  return <Calling call={call} visit={visit} onBack={onBackToChat} />;
}
