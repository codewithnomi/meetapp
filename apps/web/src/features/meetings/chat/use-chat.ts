// The meeting chat for one person in a call (F03 design.md 3.2–3.4): loads the newest page and older
// pages, applies the server's news, catches up after a reconnect or a gap, and sends messages with an
// id made here, so a retry never makes a copy (AC-F03-05). "Not sent" after the 10-second limit.
import type { ChatEvent, ChatMessageView, MessageDocument } from "@meetapp/contracts";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { ApiError } from "../../api/index.ts";
import type { Joined } from "../visit.ts";
import { eventsAfter, messagesPage, oneMessage, sendMessage } from "./chat-api.ts";
import { chatReducer, emptyChat, missedNews, type ChatAction, type ChatState } from "./chat-state.ts";

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
  const apply = (message?: ChatMessageView) =>
    dispatch({
      type: "event",
      event: { ...event, ...(message ? { message } : {}) },
      mine: (message ?? event.message)?.sender.attendanceId === visit.attendanceId,
    });
  // News too big for one packet carries only the id (design 3.4).
  if (!event.message && event.id && event.type !== "poll_changed") {
    void oneMessage(visit, event.id)
      .then(apply)
      .catch(() => undefined);
  } else apply();
}

export function useChat(visit: Joined) {
  const [state, dispatch] = useReducer(chatReducer, emptyChat);
  const latest = useRef<ChatState>(state);
  latest.current = state;

  const loadNewest = useCallback(async () => {
    const page = await messagesPage(visit);
    dispatch({ type: "page", messages: page.messages, hasMore: page.hasMore, pinned: page.pinned, older: false });
  }, [visit]);

  const catchUp = useCallback(() => catchUpOn(visit, latest, dispatch, loadNewest), [visit, loadNewest]);

  useEffect(() => {
    void loadNewest().catch(() => undefined);
  }, [loadNewest]);

  const onEvent = useCallback(
    (event: ChatEvent) => applyNews({ visit, latest, dispatch, catchUp }, event),
    [visit, catchUp],
  );

  const send = useCallback(
    (body: MessageDocument, clientId: string = crypto.randomUUID()) => {
      dispatch({ type: "sending", item: { clientId, body, status: "sending" } });
      void sendMessage(visit, { clientId, body })
        .then((message) => dispatch({ type: "sent", clientId, message }))
        .catch((error: unknown) =>
          dispatch({ type: "failed", clientId, tooFast: error instanceof ApiError && error.code === "CHAT_TOO_FAST" }),
        );
    },
    [visit],
  );

  const loadOlder = useCallback(async () => {
    const oldest = latest.current.messages[0];
    if (!oldest || !latest.current.hasMore) return;
    const page = await messagesPage(visit, oldest.cursor);
    dispatch({ type: "page", messages: page.messages, hasMore: page.hasMore, older: true });
  }, [visit]);

  const setOpen = useCallback((open: boolean) => dispatch({ type: "open", open }), []);
  return { state, onEvent, send, retry: send, loadOlder, catchUp, setOpen };
}

export type Chat = ReturnType<typeof useChat>;
