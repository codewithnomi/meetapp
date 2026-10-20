// The chat as the app holds it (F03 design.md 3.3, 3.4): messages by id in time order, the ones being
// sent, the pinned ones, the news number seen last, and unread messages while the panel is closed.
// A pure reducer, so the rules are tested without a screen.
import type { ChatEvent, ChatMessageView, MessageDocument } from "@meetapp/contracts";

/** What a message carries: text (with files), a GIF, or a sticker (design 3.2). */
export interface Outgoing {
  body?: MessageDocument | undefined;
  attachmentIds?: string[] | undefined;
  gif?: ChatMessageView["gif"] | undefined;
  sticker?: ChatMessageView["sticker"] | undefined;
}

export interface Sending {
  clientId: string;
  content: Outgoing;
  replyToId?: string | undefined;
  status: "sending" | "failed";
}

export interface ChatState {
  messages: ChatMessageView[];
  pinned: ChatMessageView[];
  sending: Sending[];
  hasMore: boolean;
  loaded: boolean;
  /** The highest news number applied; news after a gap is caught up (design 3.4). */
  lastSeq: number;
  unread: number;
  open: boolean;
  /** The last send was refused for sending too fast (AC-F03-06). */
  tooFast: boolean;
  /** Each poll's version, raised by poll_changed news, so the poll is fetched again (AC-F03-22). */
  pollVersions: Record<string, number>;
}

export const emptyChat: ChatState = {
  messages: [],
  pinned: [],
  sending: [],
  hasMore: false,
  loaded: false,
  lastSeq: 0,
  unread: 0,
  open: false,
  tooFast: false,
  pollVersions: {},
};

export type ChatAction =
  | {
      type: "page";
      messages: ChatMessageView[];
      hasMore: boolean;
      pinned?: ChatMessageView[] | undefined;
      older: boolean;
    }
  | { type: "event"; event: ChatEvent; mine: boolean }
  | { type: "sending"; item: Sending }
  | { type: "sent"; clientId: string; message: ChatMessageView }
  | { type: "failed"; clientId: string; tooFast: boolean }
  | { type: "open"; open: boolean };

const order = (a: ChatMessageView, b: ChatMessageView) =>
  a.createdAt === b.createdAt ? (a.id < b.id ? -1 : 1) : a.createdAt < b.createdAt ? -1 : 1;

/** Adds or replaces messages by id, keeping time order: nothing shows twice (AC-F03-02). */
function merge(list: ChatMessageView[], incoming: ChatMessageView[]): ChatMessageView[] {
  const byId = new Map(list.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort(order);
}

function applyEvent(state: ChatState, event: ChatEvent, mine: boolean): ChatState {
  const lastSeq = Math.max(state.lastSeq, event.seq);
  if (event.type === "poll_changed" && event.pollId) {
    return { ...state, lastSeq, pollVersions: { ...state.pollVersions, [event.pollId]: event.version ?? event.seq } };
  }
  const message = event.message;
  if (!message) return { ...state, lastSeq };
  const isNew = event.type === "message_created" && !state.messages.some((m) => m.id === message.id);
  const pinned =
    event.type === "pins_changed"
      ? state.pinned.some((p) => p.id === message.id)
        ? state.pinned.filter((p) => p.id !== message.id)
        : [...state.pinned, message]
      : state.pinned.map((p) => (p.id === message.id ? message : p));
  return {
    ...state,
    lastSeq,
    // The server's copy can arrive before the "sent" answer: the "sending" copy goes at once.
    sending: state.sending.filter((item) => item.clientId !== message.clientId),
    messages: merge(state.messages, [message]),
    pinned: message.deletedAt ? pinned.filter((p) => p.id !== message.id) : pinned,
    unread: isNew && !state.open && !mine && message.kind !== "system" ? state.unread + 1 : state.unread,
  };
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "page":
      return {
        ...state,
        messages: merge(state.messages, action.messages),
        hasMore: action.older || !state.loaded ? action.hasMore : state.hasMore,
        pinned: action.pinned ?? state.pinned,
        loaded: true,
      };
    case "event":
      return applyEvent(state, action.event, action.mine);
    case "sending":
      return {
        ...state,
        tooFast: false,
        sending: [...state.sending.filter((s) => s.clientId !== action.item.clientId), action.item],
      };
    case "sent":
      return {
        ...state,
        sending: state.sending.filter((s) => s.clientId !== action.clientId),
        messages: merge(state.messages, [action.message]),
      };
    case "failed":
      return {
        ...state,
        tooFast: action.tooFast,
        sending: state.sending.map((s) => (s.clientId === action.clientId ? { ...s, status: "failed" } : s)),
      };
    case "open":
      return { ...state, open: action.open, unread: action.open ? 0 : state.unread };
  }
}

/** True when news skipped numbers, so the app asks for what it missed (design 3.4). */
export const missedNews = (state: ChatState, event: ChatEvent) =>
  state.loaded && state.lastSeq > 0 && event.seq > state.lastSeq + 1;
