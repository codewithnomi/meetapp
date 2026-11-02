// The main window's side of F16's small windows (design.md 3.1, 3.2, 3.7): reports the rings, the current
// call and missed calls to the desktop app, and carries out what comes back with the same code the app's
// own buttons run. Outside the desktop app there is no bridge and nothing happens.
import type { CallWindowsMainAction, CallWindowsMissed, RingMessage } from "@meetapp/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAnswer, useChatCall, useEnterCall, useIncomingCalls, startCall } from "../calls/index.ts";
import { useLiveLine } from "../chats/index.ts";
import { useVisit } from "../meetings/index.ts";
import { useCallScreen } from "./call-screen.ts";
import { usePhotos } from "./photos.ts";
import { buildReport, missedCall } from "./report.ts";

interface MainBridge {
  report: (state: unknown) => void;
  onAction: (listener: (action: unknown) => void) => () => void;
}

/** Call-state reports are sent at most this often; ring changes go at once (design.md 3.1). */
export const REPORT_EVERY_MS = 200;

export function mainBridge(): MainBridge | undefined {
  return (window as { meetapp?: { callWindows?: MainBridge } }).meetapp?.callWindows;
}

/** Rings that end unanswered ("missed", or the call ended first) become missed calls, once each. */
function useMissedCalls(rings: RingMessage[]) {
  const { t } = useTranslation();
  const known = useRef(new Map<string, RingMessage>());
  for (const ring of rings) known.current.set(ring.callId, ring);
  const [missed, setMissed] = useState<CallWindowsMissed[]>([]);
  /** The latest missed call per chat, for Call back's "Calling …" title. */
  const byChat = useRef(new Map<string, CallWindowsMissed>());
  useLiveLine(
    useCallback(
      (message) => {
        if (message.t !== "ring_stop") return;
        const ring = known.current.get(message.callId);
        known.current.delete(message.callId);
        if (!ring || (message.reason !== "missed" && message.reason !== "ended")) return;
        const entry = missedCall(ring, Date.now(), t);
        byChat.current.set(entry.conversationId, entry);
        setMissed((list) => [...list, entry].slice(-20));
      },
      [t],
    ),
  );
  return { missed, byChat: byChat.current, reported: () => setMissed([]) };
}

/** Sends the report when anything changes: rings at once, call changes at most every 200 ms. */
function useReport(bridge: MainBridge | undefined, rings: RingMessage[], missed: ReturnType<typeof useMissedCalls>) {
  const busyIn = useVisit((state) => state.visit?.title);
  const call = useCallScreen((state) => state.call);
  const photos = usePhotos(rings.map((ring) => ring.from.photoUrl));
  const lastRings = useRef<RingMessage[]>(rings);
  const lastPhotos = useRef(photos);
  useEffect(() => {
    if (!bridge) return;
    const send = () => {
      bridge.report(buildReport({ rings, busyIn, call, missed: missed.missed, photos }));
      if (missed.missed.length > 0) missed.reported();
    };
    const ringsChanged = lastRings.current !== rings || missed.missed.length > 0 || photos !== lastPhotos.current;
    lastPhotos.current = photos;
    lastRings.current = rings;
    if (ringsChanged) return send();
    const timer = setTimeout(send, REPORT_EVERY_MS);
    return () => clearTimeout(timer);
  }, [bridge, rings, busyIn, call, missed, photos]);
}

/** Call back from a notification: as the chat's call button; if it can't start, the chat opens. */
function useCallBack(onEntered: () => void, openChat: (id: string) => void) {
  const enter = useEnterCall(onEntered);
  return (conversationId: string, video: boolean, title: string, oneToOne: boolean) => {
    const media = video ? "video" : "audio";
    startCall(conversationId, media)
      .then((joined) =>
        enter(joined, {
          callId: joined.call?.callId ?? "",
          conversationId,
          media,
          title,
          oneToOne,
          phase: joined.ringing ? "ringing" : "in_call",
        }),
      )
      .catch(() => openChat(conversationId));
  };
}

export interface CallWindowsRoutes {
  /** Opens the call screen after accepting. */
  toCall: () => void;
  /** Opens the Chat screen (the chat to show is already chosen). */
  toChat: () => void;
}

/** Mounted once in the signed-in app, next to the in-app incoming calls. */
export function useCallWindows({ toCall, toChat }: CallWindowsRoutes): void {
  const bridge = mainBridge();
  const rings = useIncomingCalls((state) => state.rings);
  const silence = useIncomingCalls((state) => state.silence);
  const missed = useMissedCalls(rings);
  useReport(bridge, rings, missed);
  const { accept, decline } = useAnswer(toCall);
  const chooseChat = useChatCall((state) => state.openChat);
  const openChat = (id: string) => (chooseChat(id), toChat());
  const callBack = useCallBack(toCall, openChat);
  const run = useRef<(action: CallWindowsMainAction) => void>(() => undefined);
  run.current = (action) => {
    const ring = "callId" in action ? rings.find((r) => r.callId === action.callId) : undefined;
    const screen = useCallScreen.getState();
    if (action.name === "accept" && ring) accept.mutate({ ring, media: action.video ? "video" : "audio" });
    else if (action.name === "decline" && ring) decline(ring);
    else if (action.name === "hide" && ring) silence(ring.callId);
    else if (action.name === "openChat") openChat(action.conversationId);
    else if (action.name === "callBack") {
      const last = missed.byChat.get(action.conversationId);
      callBack(action.conversationId, action.video, last?.chatName ?? last?.from ?? "", !last?.chatName);
    } else if (action.name === "toggleMic" && screen.call && (screen.call.mic || screen.call.canUnmute))
      screen.controls?.toggleMic();
    else if (action.name !== "toggleMic" && action.name !== "backToCall" && !("callId" in action))
      screen.controls?.[action.name]();
  };
  useEffect(() => bridge?.onAction((action) => run.current(action as CallWindowsMainAction)), [bridge]);
}
