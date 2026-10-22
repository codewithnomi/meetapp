// One open chat on the Chat screen (approved canvas F14Chat, AC-F14-19–21, 28, 29): the header with name,
// status and calls, then the messages and composer shared with meeting chat. News arrives on the live
// line; after a reconnect it catches up from its last news number; what is seen is marked read. A meeting
// chat opens read-only with F03's after-meeting rules.
import { ConversationHeader, Notice } from "@meetapp/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { markRead, setMine, useLiveLine, type ChatItem } from "../../features/chats/index.ts";
import { conversationPlace, useChat, usePastChat } from "../../features/meetings/chat/index.ts";
import { ChatArea, useAttachments } from "../MeetingPage/index.ts";

const READ_EVERY_MS = 2000;

function Header({ item }: { item: ChatItem }) {
  const { t } = useTranslation();
  const queries = useQueryClient();
  const change = (choice: { pinned?: boolean; muted?: boolean; hidden?: boolean }) =>
    void setMine(item.id, choice).then(() => queries.invalidateQueries({ queryKey: ["chats"] }));
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
        actions={
          item.kind === "meeting"
            ? []
            : [
                {
                  id: "pin",
                  label: t(item.pinned ? "chats.actions.unpin" : "chats.actions.pin"),
                  onSelect: () => change({ pinned: !item.pinned }),
                },
                {
                  id: "mute",
                  label: t(item.muted ? "chats.actions.unmute" : "chats.actions.mute"),
                  onSelect: () => change({ muted: !item.muted }),
                },
                { id: "hide", label: t("chats.actions.hide"), onSelect: () => change({ hidden: true }) },
              ]
        }
      />
      {item.readOnlyReason ? (
        <div className="px-6 pt-3">
          <Notice tone="neutral">{t(`chats.readOnly.${item.readOnlyReason}`)}</Notice>
        </div>
      ) : null}
    </>
  );
}

/** Marks the newest news as read, at most every 2 seconds (design 3.5, AC-F14-02, 24). */
function useReadMark(conversationId: string, lastSeq: number) {
  const queries = useQueryClient();
  const sent = useRef({ seq: -1, at: 0 });
  useEffect(() => {
    if (lastSeq <= sent.current.seq) return;
    const wait = Math.max(0, sent.current.at + READ_EVERY_MS - Date.now());
    const timer = setTimeout(() => {
      sent.current = { seq: lastSeq, at: Date.now() };
      // The list's bold and the side menu's count follow at once (AC-F14-02).
      void markRead(conversationId, lastSeq)
        .then(() => queries.invalidateQueries({ queryKey: ["chats"] }))
        .catch(() => undefined);
    }, wait);
    return () => clearTimeout(timer);
  }, [conversationId, lastSeq, queries]);
}

function LiveConversation({ item, userId, onFailed }: { item: ChatItem; userId: string; onFailed: () => void }) {
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
  const attachments = useAttachments(place);
  const writable = !item.readOnly;
  return (
    <ChatArea
      chat={chat}
      header={<Header item={item} />}
      viewerUserId={userId}
      writing={
        writable
          ? { place, attachments, off: false, placeholder: t("chats.messageTo", { name: item.title }) }
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
      header={<Header item={item} />}
      dropping={false}
      rights={{ moderate: false, createPoll: false, attach: false }}
      title={item.title}
      onClose={() => undefined}
      onFailed={onFailed}
    />
  );
}

export function ConversationPane(props: { item: ChatItem; userId: string; onFailed: () => void }) {
  // A new chat starts its own state (and line listening) when another one is opened.
  return props.item.kind === "meeting" ? (
    <MeetingConversation key={props.item.id} item={props.item} onFailed={props.onFailed} />
  ) : (
    <LiveConversation key={props.item.id} {...props} />
  );
}
