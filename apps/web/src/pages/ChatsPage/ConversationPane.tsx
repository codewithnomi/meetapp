// One open chat on the Chat screen (approved canvas F14Chat, AC-F14-19–21, 28, 29): the header with name,
// status and calls, then the messages and composer shared with meeting chat. News arrives on the live
// line; after a reconnect it catches up from its last news number; what is seen is marked read. A meeting
// chat opens read-only with F03's after-meeting rules.
import { ConversationHeader, Notice, SeenMark, TypingIndicator, type MenuAction } from "@meetapp/ui";
import type { TFunction } from "i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  blockPerson,
  markRead,
  setMine,
  useLiveLine,
  useMembers,
  usePolling,
  useSeen,
  useTyping,
  type ChatItem,
} from "../../features/chats/index.ts";
import { conversationPlace, useChat, usePastChat } from "../../features/meetings/chat/index.ts";
import { ChatArea, useAttachments } from "../MeetingPage/index.ts";

const READ_EVERY_MS = 2000;
/** A read mark that failed is sent again after this long, while the chat is open. */
const READ_RETRY_MS = 5000;

type Choice = { pinned?: boolean; muted?: boolean; hidden?: boolean };

/** More: pin, mute, hide; group details; and Block for someone outside one's workspaces (AC-F14-05, 13, 35). */
function actionsOf(
  t: TFunction,
  item: ChatItem,
  on: { change: (choice: Choice) => void; onDetails: () => void; block: () => void },
): MenuAction[] {
  if (item.kind === "meeting") return [];
  const actions: MenuAction[] = [
    {
      id: "pin",
      label: t(item.pinned ? "chats.actions.unpin" : "chats.actions.pin"),
      onSelect: () => on.change({ pinned: !item.pinned }),
    },
    {
      id: "mute",
      label: t(item.muted ? "chats.actions.unmute" : "chats.actions.mute"),
      onSelect: () => on.change({ muted: !item.muted }),
    },
    { id: "hide", label: t("chats.actions.hide"), onSelect: () => on.change({ hidden: true }) },
  ];
  if (item.kind === "group") actions.push({ id: "details", label: t("chats.actions.details"), onSelect: on.onDetails });
  if (item.kind === "direct" && item.people[0]?.external) {
    actions.push({
      id: "block",
      label: t("chats.actions.block", { name: item.title }),
      danger: true,
      onSelect: on.block,
    });
  }
  return actions;
}

function Header({ item, onDetails }: { item: ChatItem; onDetails: () => void }) {
  const { t } = useTranslation();
  const queries = useQueryClient();
  const refresh = () => queries.invalidateQueries({ queryKey: ["chats"] });
  const change = (choice: Choice) => void setMine(item.id, choice).then(refresh);
  const block = () => void blockPerson(item.people[0]?.userId ?? "").then(refresh);
  const status = item.status ? { value: item.status, label: t(`chats.status.${item.status}`) } : null;
  const subtitle = item.kind === "group" ? t("chats.people", { count: item.people.length + 1 }) : status?.label;
  return (
    <>
      <ConversationHeader
        kind={item.kind}
        title={item.title}
        photoUrl={item.people[0]?.photoUrl ?? null}
        status={item.kind === "direct" ? status : null}
        subtitle={subtitle}
        // Calls from chat arrive with F15.
        calls={{
          videoLabel: t("chats.calls.video"),
          audioLabel: t("chats.calls.audio"),
          onVideo: () => undefined,
          onAudio: () => undefined,
          disabled: true,
        }}
        moreLabel={t("chats.more")}
        actions={actionsOf(t, item, { change, onDetails, block })}
      />
      {item.readOnlyReason ? (
        <div className="px-6 pt-3">
          <Notice tone="neutral">{t(`chats.readOnly.${item.readOnlyReason}`)}</Notice>
        </div>
      ) : null}
    </>
  );
}

const CHAT_POLL_MS = 10_000;

/** While news can't arrive on the line, the open chat catches up every 10 seconds (TC-F14-44). */
function useCatchUpWhilePolling(catchUp: () => Promise<void>) {
  const polling = usePolling();
  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(() => void catchUp().catch(() => undefined), CHAT_POLL_MS);
    return () => clearInterval(timer);
  }, [polling, catchUp]);
}

/** Marks the newest news as read, at most every 2 seconds; a failed mark is retried (design 3.5, AC-F14-02, 24). */
function useReadMark(conversationId: string, lastSeq: number) {
  const queries = useQueryClient();
  const sent = useRef({ seq: -1, at: 0 });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (lastSeq <= sent.current.seq) return;
    const wait = Math.max(0, sent.current.at + READ_EVERY_MS - Date.now());
    const timer = setTimeout(() => {
      const before = sent.current.seq;
      sent.current = { seq: lastSeq, at: Date.now() };
      // The list's bold and the side menu's count follow at once (AC-F14-02).
      void markRead(conversationId, lastSeq)
        .then(() => queries.invalidateQueries({ queryKey: ["chats"] }))
        .catch(() => {
          // Not marked: try again in 5 seconds, or sooner with newer news.
          sent.current = { seq: before, at: Date.now() + READ_RETRY_MS - READ_EVERY_MS };
          setAttempt((n) => n + 1);
        });
    }, wait);
    return () => clearTimeout(timer);
  }, [conversationId, lastSeq, queries, attempt]);
}

/** @mentions: the chat's people, by name (AC-F14-22). */
function useMentions(conversationId: string, userId: string) {
  const { t } = useTranslation();
  const members = useMembers(conversationId).data?.people ?? [];
  return {
    listLabel: t("chats.mentionsLabel"),
    search: (query: string) =>
      members
        .filter((m) => m.userId !== userId && m.name.toLowerCase().includes(query.toLowerCase()))
        .map((m) => ({ id: m.userId, name: m.name })),
  };
}

interface PaneProps {
  item: ChatItem;
  userId: string;
  onFailed: () => void;
  onDetails: () => void;
}

/** "… is typing" and "Seen" above the message box (AC-F14-23, 24). */
function Footer({ typing, seen, kind }: { typing: string[]; seen: { name: string }[] | null; kind: ChatItem["kind"] }) {
  const { t } = useTranslation();
  const names = typing.join(t("chats.and"));
  return (
    <div className="flex items-center gap-3 px-1">
      <div className="min-w-0 flex-1">
        <TypingIndicator text={typing.length > 0 ? t("chats.typing", { count: typing.length, names }) : ""} />
      </div>
      {seen ? (
        <SeenMark
          label={t("chats.seen")}
          seenBy={kind === "group" ? t("chats.seenBy", { names: seen.map((p) => p.name).join(", ") }) : undefined}
        />
      ) : null}
    </div>
  );
}

function LiveConversation({ item, userId, onFailed, onDetails }: PaneProps) {
  const { t } = useTranslation();
  const place = useMemo(() => conversationPlace(item.id, userId), [item.id, userId]);
  const chat = useChat(place);
  const { onEvent, catchUp, setOpen } = chat;
  useEffect(() => setOpen(true), [setOpen]);
  useLiveLine(
    useCallback(
      (message) => {
        if (message.t === "news" && message.conversationId === item.id) onEvent(message.event);
        if (message.t === "connected") void catchUp().catch(() => undefined);
      },
      [item.id, onEvent, catchUp],
    ),
  );
  useReadMark(item.id, chat.state.lastSeq);
  useCatchUpWhilePolling(catchUp);
  const typing = useTyping(item.id, userId);
  const seen = useSeen(item.id, chat.state.messages, userId);
  const mentions = useMentions(item.id, userId);
  const attachments = useAttachments(place);
  const writable = !item.readOnly;
  return (
    <ChatArea
      chat={chat}
      header={<Header item={item} onDetails={onDetails} />}
      footer={<Footer typing={typing.names} seen={seen.people} kind={item.kind} />}
      viewerUserId={userId}
      writing={
        writable
          ? {
              place,
              attachments,
              off: false,
              placeholder: t("chats.messageTo", { name: item.title }),
              mentions,
              onTyping: typing.onTyping,
              focusOnOpen: true,
            }
          : undefined
      }
      dropping={false}
      rights={{ moderate: false, createPoll: writable, attach: writable }}
      title={item.title}
      onClose={() => undefined}
      onFailed={onFailed}
    />
  );
}

function MeetingConversation({ item, onFailed }: { item: ChatItem; onFailed: () => void }) {
  const chat = usePastChat(item.meetingId ?? "");
  return (
    <ChatArea
      chat={chat}
      header={<Header item={item} onDetails={() => undefined} />}
      dropping={false}
      rights={{ moderate: false, createPoll: false, attach: false }}
      title={item.title}
      onClose={() => undefined}
      onFailed={onFailed}
    />
  );
}

export function ConversationPane(props: PaneProps) {
  // A new chat starts its own state (and line listening) when another one is opened.
  return props.item.kind === "meeting" ? (
    <MeetingConversation key={props.item.id} item={props.item} onFailed={props.onFailed} />
  ) : (
    <LiveConversation key={props.item.id} {...props} />
  );
}
