// The call and what the person can do in it (F02 design.md sections 3.5–3.8): the room, the server's
// messages, the lobby, devices and connection, the hand, reactions, shortcuts, leaving, and what happened
// after an unexpected disconnect.
import type { ChatEvent } from "@meetapp/contracts";
import { chatAnnouncement } from "./chat-texts.ts";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../../features/api/index.ts";
import {
  can,
  endMeeting,
  leaveMeeting,
  loadPrefs,
  raiseHand,
  useMeetingRoom,
  useMeetingShortcuts,
  useVisit,
  type Attendance,
  type Joined,
  type Reaction,
} from "../../features/meetings/index.ts";
import { callPlace, useChat, type Chat } from "../../features/meetings/chat/index.ts";
import { useCallEvents, usePeopleAnnouncements } from "./call-events.ts";
import { useConnectionCare } from "./connection.ts";
import { useLobby } from "./lobby.ts";

export interface MeetingPageProps {
  onLeft: () => void;
  onOutcome: (outcome: Attendance) => void;
}

/**
 * After an unexpected disconnect the backend says why (removed, ended). If it still counts the person
 * as inside (it hears of the drop a little later), or can't be reached, the connection was lost.
 */
async function outcomeOf(visit: Joined): Promise<Attendance> {
  const lost = { ...visit, status: "left" as const, leftReason: "dropped" as const };
  const answer = await apiRequest<Attendance>(`/api/v1/attendances/${visit.attendanceId}`, {
    headers: { "x-meeting-ticket": visit.ticket },
  }).catch(() => lost);
  return answer.status === "admitted" || answer.status === "in_call" ? lost : answer;
}

/**
 * Meeting chat in the call (F03): the room's handlers are read once at connect, so they reach the chat
 * through a ref; news is announced while the panel is closed (AC-F03-45).
 */
function useCallChat(visit: Joined, announce: (kind: string, text: string) => void) {
  const chatRef = useRef<Chat>(undefined as unknown as Chat);
  const place = useMemo(() => callPlace(visit), [visit]);
  const chat = (chatRef.current = useChat(place));
  const { t } = useTranslation();
  const latestT = useRef(t);
  latestT.current = t;
  const onChat = (event: ChatEvent) => {
    const heard = chatAnnouncement(latestT.current, event, visit.attendanceId, chatRef.current.state.open);
    if (heard) announce(`chat-${event.message?.id ?? ""}`, heard);
    chatRef.current.onEvent(event);
  };
  return { chat, chatRef, onChat };
}

/** The call and what the person can do in it: devices, hand, sharing, shortcuts, leaving. */
export function useCall(visit: Joined, { onLeft, onOutcome }: MeetingPageProps) {
  const [prefs, setPrefs] = useState(loadPrefs);
  const leaving = useRef(false);
  const [stopSharing, lobbyRefresh] = [useRef(() => undefined as unknown), useRef(() => undefined as unknown)];
  const events = useCallEvents({
    shareReplaced: () => stopSharing.current(),
    lobbyChanged: () => lobbyRefresh.current(),
  });
  const end = useVisit((state) => state.end);
  const { chat, chatRef, onChat } = useCallChat(visit, events.announcer.announce);
  const finish = (go: () => void) => (end(), go());
  const room = useMeetingRoom(visit, prefs, {
    onReaction: events.showReaction,
    onControl: events.onControl,
    onChat,
    onReconnected: () => void chatRef.current.catchUp().catch(() => undefined),
    onDisconnected: () => {
      if (leaving.current) return;
      // A lost connection keeps the visit, so Rejoin can use its ticket (AC-F02-29).
      void outcomeOf(visit).then((outcome) =>
        outcome.leftReason === "dropped" ? onOutcome(outcome) : finish(() => onOutcome(outcome)),
      );
    },
  });
  usePeopleAnnouncements(room.people, events.announcer.announce);
  const me = room.people.find((p) => p.isYou);
  const lobby = useLobby(visit, can(me?.role, "admit"), events.announcer.announce);
  // The server's messages reach the newest share and lobby functions (set after each render).
  useEffect(() => {
    stopSharing.current = room.stopShare;
    lobbyRefresh.current = lobby.refresh;
  });
  const actions = {
    microphone: () => void room.setMicrophone(!(me?.micOn ?? false)).catch(() => undefined),
    camera: () => void room.setCamera(!(me?.cameraOn ?? false)).catch(() => undefined),
    hand: () => void raiseHand(visit, !me?.handRaisedAt).catch(() => undefined),
    react: (reaction: Reaction) =>
      void room.sendReaction(reaction).then(() => events.showReaction(visit.attendanceId, reaction)),
    leave: () => {
      leaving.current = true;
      void leaveMeeting(visit).then(() => finish(onLeft));
    },
    end: () => void endMeeting(visit).catch(() => undefined),
  };
  useMeetingShortcuts((shortcut) => actions[shortcut]());
  const care = useConnectionCare(room.room, visit, leaving);
  return { room, me, events, actions, lobby, prefs, setPrefs, care, chat };
}

export type CallState = ReturnType<typeof useCall> & { visit: Joined };
