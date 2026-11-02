// The meeting chat beside the videos (F03, approved "Chat" screen): the newest messages at the bottom,
// older ones loaded when scrolling up, the view kept still while reading older messages with a "New
// messages" button (AC-F03-08), the pinned bar, replying, editing, and deleting after a question.
// Read only when chat is off (the box gives way to a note, AC-F03-35) or after the meeting (AC-F03-42).
import type { ChatMessageView } from "@meetapp/contracts";
import { Button, ChatPanel, Dialog, Notice, Spinner, type ChatComposerProps } from "@meetapp/ui";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { deleteMessage, type Chat, type ChatPlace } from "../../features/meetings/chat/index.ts";
import { continuesGroup, firstLineOf, isOwn, time } from "./chat-texts.ts";
import type { Attachments } from "./chat-attachments.ts";
import { ComposerArea } from "./ChatComposerArea.tsx";
import { Message, Pending, type ChatRights, type ChatView } from "./ChatMessages.tsx";

const NEAR_BOTTOM_PX = 40;

/** Keeps the newest message in view, unless the person is reading older ones (AC-F03-08). */
function useStickToBottom(count: number, chat: Chat, onFailed: () => void) {
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
      void chat.loadOlder().catch(onFailed);
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

/** The messages could not be loaded: say so, with Retry. */
function LoadFailed({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <Notice tone="danger" action={{ label: t("meetings.chat.retry"), onClick: onRetry }}>
      {t("meetings.chat.loadFailed")}
    </Notice>
  );
}

/** Above the composer: the load failure with Retry, a spinner until the first page, then the page's footer. */
function noticeOf(
  chat: { state: { loadFailed: boolean }; reload: () => void },
  loaded: boolean,
  footer: ReactNode,
  loading: string,
) {
  if (chat.state.loadFailed) return <LoadFailed onRetry={chat.reload} />;
  if (!loaded) return <Spinner label={loading} />;
  return footer;
}

/** "Delete this message?" before anything is removed (AC-F03-10). */
function DeleteDialog({
  chat,
  message,
  onClose,
  onFailed,
}: {
  chat: Chat;
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
            // Shown as deleted at once, wherever the message is (also in a past meeting's chat, which gets no news).
            if (message) void deleteMessage(chat.place, message.id).then(() => chat.markDeleted(message.id), onFailed);
            onClose();
          }}
        >
          {t("meetings.chat.actions.delete")}
        </Button>
      </div>
    </Dialog>
  );
}

/** The message box's place and extras: files, chat off, and (F14) its words, mentions and typing. */
interface Writing {
  place: ChatPlace;
  attachments: Attachments;
  off: boolean;
  /** "Message Bilal Ahmed" instead of "Message everyone". */
  placeholder?: string;
  mentions?: ChatComposerProps["mentions"];
  onTyping?: () => void;
  /** F14: the box takes the focus when the chat opens. */
  focusOnOpen?: boolean;
}

export interface ChatAreaProps {
  chat: Chat;
  /** In a call: the message box, or "Chat is turned off" when `off`. Absent after the meeting. */
  writing?: Writing | undefined;
  /** F14: "… is typing" and "Seen", just above the message box. */
  footer?: ReactNode;
  /** Files are being dragged over the meeting window (AC-F03-29). */
  dropping: boolean;
  rights: ChatRights;
  /** The signed-in viewer's account (none for guests). */
  viewerUserId?: string | undefined;
  /** F14 Chat screen: the conversation header shown above the messages instead of the panel's title. */
  header?: ReactNode;
  /** The panel's title; "Chat" by default, the meeting's title after it. */
  title?: string | undefined;
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

type Interaction = ReturnType<typeof useInteraction>;

function AllMessages({ view }: { view: ChatView }) {
  const last = view.chat.state.messages.at(-1);
  // Messages being sent join the viewer's group when the last one is theirs, from this minute (AC-F03-48).
  const joinsLast =
    last !== undefined &&
    last.kind !== "system" &&
    isOwn(last, view.place.attendanceId, view.viewerUserId) &&
    time(last.createdAt) === time(new Date().toISOString());
  return (
    <>
      {view.chat.state.messages.map((message, index, all) => (
        <Message key={message.id} view={view} message={message} continued={continuesGroup(all[index - 1], message)} />
      ))}
      {view.chat.state.sending.map((item, index) => (
        <Pending key={item.clientId} item={item} chat={view.chat} continued={index > 0 || joinsLast} />
      ))}
    </>
  );
}

/** The message box, or the note that chat is off; nothing after the meeting. */
function Composer({ view, writing, act }: { view: ChatView; writing: ChatAreaProps["writing"]; act: Interaction }) {
  const { t } = useTranslation();
  if (!writing) return null;
  if (writing.off)
    return (
      <p role="status" className="m-0 rounded-md bg-surface-sunken p-3 text-center text-[13px] text-ink-muted">
        {t("meetings.chat.off")}
      </p>
    );
  return (
    <ComposerArea
      view={view}
      place={writing.place}
      placeholder={writing.placeholder}
      mentions={writing.mentions}
      onTyping={writing.onTyping}
      focusOnOpen={writing.focusOnOpen}
      attachments={writing.attachments}
      replyingTo={act.replyingTo}
      editing={act.editing}
      onDone={act.done}
    />
  );
}

export function ChatArea(props: ChatAreaProps) {
  const { chat, writing, dropping, rights, title, onClose, onFailed, viewerUserId } = props;
  const { t } = useTranslation();
  const { messages, sending, loaded, pinned } = chat.state;
  const scroll = useStickToBottom(messages.length + sending.length, chat, onFailed);
  const pinBar = usePinnedBar(pinned);
  const act = useInteraction();
  const readOnly = !writing || writing.off;
  const view: ChatView = { chat, place: chat.place, viewerUserId, rights, readOnly, onFailed, ...act.handlers };
  return (
    <>
      <ChatPanel
        title={title ?? t("meetings.chat.title")}
        header={props.header}
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
        messages={<AllMessages view={view} />}
        dropArea={
          dropping ? { title: t("meetings.chat.files.dropTitle"), hint: t("meetings.chat.files.dropHint") } : undefined
        }
        notice={noticeOf(chat, loaded, props.footer, t("meetings.chat.loading"))}
        newMessages={scroll.missed ? { label: t("meetings.chat.newMessages"), onClick: scroll.toNewest } : undefined}
        composer={<Composer view={view} writing={writing} act={act} />}
      />
      <DeleteDialog chat={chat} message={act.deleting} onClose={() => act.setDeleting(undefined)} onFailed={onFailed} />
    </>
  );
}
