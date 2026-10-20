// The meeting chat beside the videos (F03, approved "Chat" screen): the newest messages at the bottom,
// older ones loaded when scrolling up, the view kept still while reading older messages with a "New
// messages" button (AC-F03-08), messages being sent and "Not sent" with Retry (AC-F03-05). The message
// box here sends plain text; the rich box with formatting comes in T13.
import type { ChatMessageView, MessageDocument } from "@meetapp/contracts";
import { ChatComposer, ChatMessage, ChatPanel, SystemNote, type ChatComposerLabels } from "@meetapp/ui";
import type { TFunction } from "i18next";
import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { setReaction, type Chat, type Sending } from "../../features/meetings/chat/index.ts";
import type { Joined } from "../../features/meetings/index.ts";
import { openLink } from "./open-link.ts";

const NEAR_BOTTOM_PX = 40;
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function senderName(t: TFunction, message: ChatMessageView, visit: Joined): string {
  if (message.sender.attendanceId === visit.attendanceId) return t("meetings.chat.you");
  const { name, group } = message.sender;
  return group === "member" ? name : t(`meetings.call.${group}`, { name });
}

function noteText(t: TFunction, message: ChatMessageView): string {
  const system = message.system;
  if (!system) return "";
  if (system.event === "pinned") return t("meetings.chat.pinnedNote", { name: system.name });
  return t(`meetings.chat.modeNote.${system.mode ?? "on"}`, { name: system.name });
}

/** The first line of a message's text, for the pinned bar. */
function firstLineOf(message: ChatMessageView): string {
  const first = message.body?.blocks[0];
  if (first?.type === "codeBlock") return first.text.split("\n")[0] ?? "";
  if (first?.type !== "paragraph") return "…";
  return (first.content ?? []).map((part) => (part.type === "text" ? part.text : " ")).join("");
}

function copyCode(text: string) {
  void navigator.clipboard.writeText(text).catch(() => undefined);
}

function Message({ message, visit }: { message: ChatMessageView; visit: Joined }) {
  const { t } = useTranslation();
  if (message.kind === "system") return <SystemNote text={noteText(t, message)} />;
  const name = senderName(t, message, visit);
  const shown = time(message.createdAt);
  return (
    <ChatMessage
      id={message.id}
      name={name}
      own={message.sender.attendanceId === visit.attendanceId}
      time={message.editedAt ? t("meetings.chat.edited", { time: shown }) : shown}
      document={message.body}
      deletedText={message.deletedAt ? t("meetings.chat.deleted") : undefined}
      replyTo={
        message.replyTo
          ? {
              senderName: message.replyTo.senderName,
              firstLine: message.replyTo.deleted ? t("meetings.chat.deleted") : message.replyTo.firstLine,
              onShow: () => document.getElementById(`chat-message-${message.replyTo?.id ?? ""}`)?.focus(),
            }
          : undefined
      }
      reactions={message.reactions.map((reaction) => ({
        emoji: reaction.emoji,
        count: reaction.count,
        mine: reaction.mine,
        label: t("meetings.chat.reaction", {
          emoji: reaction.emoji,
          count: reaction.count,
          names: reaction.names.join(", "),
        }),
        onToggle: () => void setReaction(visit, message.id, reaction.emoji, !reaction.mine).catch(() => undefined),
      }))}
      onOpenLink={openLink}
      onCopyCode={copyCode}
      copyLabel={t("meetings.chat.copy")}
    />
  );
}

function Pending({ item, chat }: { item: Sending; chat: Chat }) {
  const { t } = useTranslation();
  return (
    <ChatMessage
      id={item.clientId}
      name={t("meetings.chat.you")}
      own
      time=""
      document={item.body}
      status={
        item.status === "sending"
          ? { kind: "sending", label: t("meetings.chat.sending") }
          : {
              kind: "failed",
              label: t("meetings.chat.notSent"),
              retryLabel: t("meetings.chat.retry"),
              onRetry: () => chat.retry(item.body, item.clientId),
            }
      }
      onOpenLink={openLink}
      onCopyCode={copyCode}
      copyLabel={t("meetings.chat.copy")}
    />
  );
}

const RECENT_KEY = "meetapp.chat.recentEmoji";
const MAX_RECENT = 8;

/** Recently used emoji, kept on this computer only (a per-viewer convenience). */
function useRecentEmoji() {
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
      return Array.isArray(saved)
        ? saved.filter((item): item is string => typeof item === "string").slice(0, MAX_RECENT)
        : [];
    } catch {
      return [];
    }
  });
  const used = (emoji: string) => {
    const next = [emoji, ...recent.filter((item) => item !== emoji)].slice(0, MAX_RECENT);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // Not saved: the list still works for this session.
    }
  };
  return { recent, used };
}

function Composer({ chat }: { chat: Chat }) {
  const { t } = useTranslation();
  const emoji = useRecentEmoji();
  const labels = Object.fromEntries(
    COMPOSER_KEYS.map((key) => [key, t(`meetings.chat.composer.${key}`)]),
  ) as unknown as ChatComposerLabels;
  return (
    <>
      {chat.state.tooFast ? (
        <p role="alert" className="m-0 rounded-md bg-warning-soft p-2.5 text-[13px] text-ink">
          {t("meetings.chat.tooFast")}
        </p>
      ) : null}
      <ChatComposer
        labels={labels}
        tooManyLabel={(over) => t("meetings.chat.tooMany", { count: over })}
        onSend={(body) => chat.send(body as MessageDocument)}
        emoji={{
          dataUrl: "/emojibase",
          recent: emoji.recent,
          labels: {
            search: t("meetings.chat.emojiSearch"),
            recent: t("meetings.chat.emojiRecent"),
            loading: t("meetings.chat.emojiLoading"),
            empty: t("meetings.chat.emojiEmpty"),
            skinTone: t("meetings.chat.skinTone"),
          },
        }}
        onEmojiUsed={emoji.used}
      />
    </>
  );
}

const COMPOSER_KEYS = [
  "placeholder",
  "send",
  "format",
  "emoji",
  "formatting",
  "bold",
  "italic",
  "underline",
  "strike",
  "bulletList",
  "orderedList",
  "quote",
  "link",
  "linkAddress",
  "applyLink",
  "code",
  "codeBlock",
] as const;

/** Keeps the newest message in view, unless the person is reading older ones (AC-F03-08). */
function useStickToBottom(count: number, chat: Chat) {
  const list = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  // How many messages there were when the person scrolled up; more than that means new ones arrived.
  const [countWhenLeft, setCountWhenLeft] = useState(count);
  const before = useRef<number | undefined>(undefined);
  useLayoutEffect(() => {
    const element = list.current;
    if (!element) return;
    if (before.current !== undefined) {
      // Older messages were added at the top: keep what the person was reading in place.
      element.scrollTop += element.scrollHeight - before.current;
      before.current = undefined;
    } else if (atBottom) element.scrollTop = element.scrollHeight;
  }, [count, atBottom]);
  const onScroll = () => {
    const element = list.current;
    if (!element) return;
    const bottom = element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_BOTTOM_PX;
    if (atBottom && !bottom) setCountWhenLeft(count);
    setAtBottom(bottom);
    if (element.scrollTop === 0 && chat.state.hasMore) {
      before.current = element.scrollHeight;
      void chat.loadOlder().catch(() => undefined);
    }
  };
  const toNewest = () => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
    setAtBottom(true);
  };
  return { list, onScroll, missed: !atBottom && count > countWhenLeft, toNewest };
}

/** The pinned bar: one pin at a time, "1 of 2", and the next pin (AC-F03-19). */
function usePinnedBar(pinned: ChatMessageView[]) {
  const { t } = useTranslation();
  const [turn, setTurn] = useState(0);
  const index = pinned.length > 0 ? turn % pinned.length : 0;
  const pin = pinned[index];
  if (!pin) return undefined;
  const several = pinned.length > 1;
  return {
    title: t("meetings.chat.pinned"),
    text: `${pin.sender.name}: ${firstLineOf(pin)}`,
    position: several ? t("meetings.chat.pinPosition", { index: index + 1, count: pinned.length }) : undefined,
    onShow: () => document.getElementById(`chat-message-${pin.id}`)?.focus(),
    next: several ? { label: t("meetings.chat.nextPin"), onNext: () => setTurn(index + 1) } : undefined,
  };
}

export function ChatArea({ chat, visit, onClose }: { chat: Chat; visit: Joined; onClose: () => void }) {
  const { t } = useTranslation();
  const { messages, sending, loaded, pinned } = chat.state;
  const scroll = useStickToBottom(messages.length + sending.length, chat);
  const pinBar = usePinnedBar(pinned);
  return (
    <ChatPanel
      title={t("meetings.chat.title")}
      closeLabel={t("meetings.chat.close")}
      onClose={onClose}
      listLabel={t("meetings.chat.messages")}
      listRef={scroll.list}
      onScroll={scroll.onScroll}
      pinned={pinBar}
      empty={
        loaded && messages.length === 0 && sending.length === 0
          ? { title: t("meetings.chat.emptyTitle"), hint: t("meetings.chat.emptyHint") }
          : undefined
      }
      messages={
        <>
          {messages.map((message) => (
            <Message key={message.id} message={message} visit={visit} />
          ))}
          {sending.map((item) => (
            <Pending key={item.clientId} item={item} chat={chat} />
          ))}
        </>
      }
      newMessages={scroll.missed ? { label: t("meetings.chat.newMessages"), onClick: scroll.toNewest } : undefined}
      composer={<Composer chat={chat} />}
    />
  );
}
