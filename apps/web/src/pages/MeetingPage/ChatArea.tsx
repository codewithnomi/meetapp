// The meeting chat beside the videos (F03, approved "Chat" screen): the newest messages at the bottom,
// older ones loaded when scrolling up, the view kept still while reading older messages with a "New
// messages" button (AC-F03-08), the pinned bar, replying, editing, and deleting after a question.
import type { ChatMessageView } from "@meetapp/contracts";
import { Button, ChatPanel, Dialog } from "@meetapp/ui";
import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { deleteMessage, type Chat } from "../../features/meetings/chat/index.ts";
import type { Joined } from "../../features/meetings/index.ts";
import { firstLineOf } from "./chat-texts.ts";
import { ComposerArea } from "./ChatComposerArea.tsx";
import { Message, Pending, type ChatRights, type ChatView } from "./ChatMessages.tsx";

const NEAR_BOTTOM_PX = 40;

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

/** "Delete this message?" before anything is removed (AC-F03-10). */
function DeleteDialog({
  visit,
  message,
  onClose,
  onFailed,
}: {
  visit: Joined;
  message: ChatMessageView | undefined;
  onClose: () => void;
  onFailed: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog
      open={message !== undefined}
      onOpenChange={(open) => !open && onClose()}
      title={t("meetings.chat.deleteTitle")}
      description={t("meetings.chat.deleteBody")}
      closeLabel={t("meetings.chat.cancel")}
    >
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          {t("meetings.chat.cancel")}
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            if (message) void deleteMessage(visit, message.id).catch(onFailed);
            onClose();
          }}
        >
          {t("meetings.chat.actions.delete")}
        </Button>
      </div>
    </Dialog>
  );
}

export interface ChatAreaProps {
  chat: Chat;
  visit: Joined;
  rights: ChatRights;
  onClose: () => void;
  onFailed: () => void;
}

/** Who is being replied to, edited or asked about deleting. */
function useInteraction() {
  const [replyingTo, setReplyingTo] = useState<ChatMessageView>();
  const [editing, setEditing] = useState<ChatMessageView>();
  const [deleting, setDeleting] = useState<ChatMessageView>();
  const done = () => (setReplyingTo(undefined), setEditing(undefined));
  const handlers = {
    onReply: (message: ChatMessageView) => (setEditing(undefined), setReplyingTo(message)),
    onEdit: (message: ChatMessageView) => (setReplyingTo(undefined), setEditing(message)),
    onDelete: setDeleting,
  };
  return { replyingTo, editing, deleting, setDeleting, done, handlers };
}

export function ChatArea({ chat, visit, rights, onClose, onFailed }: ChatAreaProps) {
  const { t } = useTranslation();
  const { messages, sending, loaded, pinned } = chat.state;
  const scroll = useStickToBottom(messages.length + sending.length, chat);
  const pinBar = usePinnedBar(pinned);
  const act = useInteraction();
  const view: ChatView = { chat, visit, rights, onFailed, ...act.handlers };
  return (
    <>
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
              <Message key={message.id} view={view} message={message} />
            ))}
            {sending.map((item) => (
              <Pending key={item.clientId} item={item} chat={chat} />
            ))}
          </>
        }
        newMessages={scroll.missed ? { label: t("meetings.chat.newMessages"), onClick: scroll.toNewest } : undefined}
        composer={<ComposerArea view={view} replyingTo={act.replyingTo} editing={act.editing} onDone={act.done} />}
      />
      <DeleteDialog
        visit={visit}
        message={act.deleting}
        onClose={() => act.setDeleting(undefined)}
        onFailed={onFailed}
      />
    </>
  );
}
