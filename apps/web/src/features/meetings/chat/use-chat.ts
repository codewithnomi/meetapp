// The meeting chat for one person in a call (F03 design.md 3.2–3.4): loads the newest page and older
// pages, applies the server's news, catches up after a reconnect or a gap, and sends messages with an
// id made here, so a retry never makes a copy (AC-F03-05). "Not sent" after the 10-second limit.
import type { ChatEvent, ChatMessageView } from "@meetapp/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { ApiError } from "../../api/index.ts";
import type { Joined } from "../visit.ts";
import {
  callPlace,
  eventsAfter,
  messagesPage,
  oneMessage,
  pastPlace,
  recentMeetingChats,
  sendMessage,
  type ChatPlace,
} from "./chat-api.ts";
import {
  asSeenBy,
  chatReducer,
  emptyChat,
  missedNews,
  type ChatAction,
  type ChatState,
  type Outgoing,
} from "./chat-state.ts";

const MAX_CATCH_UP = 50;

/** What happened while this app missed news: changed messages fetched one by one, or the newest page. */
async function catchUpOn(
  visit: Joined,
  latest: { current: ChatState },
  dispatch: (action: ChatAction) => void,
  loadNewest: () => Promise<void>,
) {
  const since = latest.current.lastSeq;
  const missed = await eventsAfter(visit, since).catch(() => undefined);
  if (!missed || missed.gap || since === 0) return loadNewest();
  const ids = [...new Set(missed.events.flatMap((event) => (event.id ? [event.id] : [])))].slice(0, MAX_CATCH_UP);
  const messages = await Promise.all(ids.map((id) => oneMessage(visit, id).catch(() => undefined)));
  for (const event of missed.events) {
    const message = messages[ids.indexOf(event.id ?? "")] ?? undefined;
    const mine = message?.sender.attendanceId === visit.attendanceId;
    dispatch({ type: "event", event: { ...event, ...(message ? { message } : {}) }, mine });
  }
}

interface NewsContext {
  visit: Joined;
  latest: { current: ChatState };
  dispatch: (action: ChatAction) => void;
  catchUp: () => Promise<void>;
}

/** One piece of news from the server; a gap means news was missed, so the app catches up first. */
function applyNews({ visit, latest, dispatch, catchUp }: NewsContext, event: ChatEvent): void {
  if (missedNews(latest.current, event)) {
    void catchUp().catch(() => undefined);
    return;
  }
  const apply = (fetched?: ChatMessageView) => {
    const message = fetched ?? (event.message ? asSeenBy(event.message, visit.attendanceId) : undefined);
    dispatch({
      type: "event",
      event: { ...event, ...(message ? { message } : {}) },
      mine: message?.sender.attendanceId === visit.attendanceId,
    });
  };
  // News too big for one packet carries only the id (design 3.4).
  if (!event.message && event.id && event.type !== "poll_changed") {
    void oneMessage(visit, event.id)
      .then(apply)
      .catch(() => undefined);
  } else apply();
}

/** The newest page (loaded at the start) and older pages, from a call or a past meeting. */
function usePages(place: ChatPlace, initial: ChatState) {
  const [state, dispatch] = useReducer(chatReducer, initial);
  const latest = useRef<ChatState>(state);
  latest.current = state;

  const loadNewest = useCallback(async () => {
    const page = await messagesPage(place);
    dispatch({
      type: "page",
      messages: page.messages,
      hasMore: page.hasMore,
      pinned: page.pinned,
      older: false,
      lastSeq: page.lastSeq,
    });
  }, [place]);

  // A failed first load is shown with Retry; later reloads keep what is on screen.
  const reload = useCallback(() => void loadNewest().catch(() => dispatch({ type: "loadFailed" })), [loadNewest]);
  useEffect(reload, [reload]);

  const loadOlder = useCallback(async () => {
    const oldest = latest.current.messages[0];
    if (!oldest || !latest.current.hasMore) return;
    const page = await messagesPage(place, oldest.cursor);
    dispatch({ type: "page", messages: page.messages, hasMore: page.hasMore, older: true });
  }, [place]);
  return { state, dispatch, latest, loadNewest, loadOlder, reload };
}

/** Pages keep these in the query cache; they go when the call screen closes (AC-F03-40, 41). */
const CALL_CHAT_QUERIES = ["chat-preview", "chat-poll"];

/** Leaving, being removed or the call ending forgets file links, previews and polls held in memory. */
function useForgetOnLeave() {
  const queries = useQueryClient();
  useEffect(
    () => () => {
      for (const key of CALL_CHAT_QUERIES) queries.removeQueries({ queryKey: [key] });
    },
    [queries],
  );
}

export function useChat(visit: Joined) {
  useForgetOnLeave();
  const place = useMemo(() => callPlace(visit), [visit]);
  const { state, dispatch, latest, loadNewest, loadOlder, reload } = usePages(place, emptyChat);

  const catchUp = useCallback(
    () => catchUpOn(visit, latest, dispatch, loadNewest),
    [visit, latest, dispatch, loadNewest],
  );

  const onEvent = useCallback(
    (event: ChatEvent) => applyNews({ visit, latest, dispatch, catchUp }, event),
    [visit, latest, dispatch, catchUp],
  );

  const send = useCallback(
    (content: Outgoing, clientId: string = crypto.randomUUID(), replyToId?: string) => {
      dispatch({
        type: "sending",
        item: { clientId, content, status: "sending", ...(replyToId ? { replyToId } : {}) },
      });
      void sendMessage(visit, { clientId, ...content, ...(replyToId ? { replyToId } : {}) })
        .then((message) => dispatch({ type: "sent", clientId, message }))
        .catch((error: unknown) =>
          dispatch({ type: "failed", clientId, tooFast: error instanceof ApiError && error.code === "CHAT_TOO_FAST" }),
        );
    },
    [visit, dispatch],
  );

  const setOpen = useCallback((open: boolean) => dispatch({ type: "open", open }), [dispatch]);
  const markDeleted = useCallback((id: string) => dispatch({ type: "deleted", id }), [dispatch]);
  return { place, state, onEvent, send, retry: send, loadOlder, catchUp, setOpen, reload, markDeleted };
}

export type Chat = ReturnType<typeof useChat>;

const nothing = () => undefined;
const openChat: ChatState = { ...emptyChat, open: true };

/** A past meeting's chat, read-only (AC-F03-42): pages only, nothing live; "catch up" reloads the newest. */
export function usePastChat(meetingId: string): Chat {
  const place = useMemo(() => pastPlace(meetingId), [meetingId]);
  const { state, dispatch, loadNewest, loadOlder, reload } = usePages(place, openChat);
  const markDeleted = (id: string) => dispatch({ type: "deleted", id });
  return {
    place,
    state,
    onEvent: nothing,
    send: nothing,
    retry: nothing,
    loadOlder,
    catchUp: loadNewest,
    setOpen: nothing,
    reload,
    markDeleted,
  };
}

/** Past meetings whose chat the viewer may open, for the meetings list (AC-F03-42). */
export const useRecentMeetingChats = () => useQuery({ queryKey: ["meeting-chats"], queryFn: recentMeetingChats });
