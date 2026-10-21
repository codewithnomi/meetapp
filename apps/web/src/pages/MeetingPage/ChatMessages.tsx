// The messages in the meeting chat (F03, approved "Chat" screens): each with its actions (react,
// reply, and the More menu with Edit, Copy text, Pin and Delete for those allowed), polls drawn as
// poll cards, and messages being sent with "Not sent" and Retry.
import type { ChatMessageView } from "@meetapp/contracts";
import { ChatMessage, EmojiPicker, MessageActions, SystemNote, type MenuAction } from "@meetapp/ui";
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useEmojiSettings } from "./chat-emoji.ts";
import { setPinned, setReaction, type Chat, type Sending } from "../../features/meetings/chat/index.ts";
import type { ChatView } from "./chat-view.ts";
import { PollMessage } from "./ChatPoll.tsx";

export type { ChatRights, ChatView } from "./chat-view.ts";
import { allTextOf, copyText, isOwn, noteText, senderName, time } from "./chat-texts.ts";
import { MessageExtras } from "./ChatExtras.tsx";
import { openLink } from "./open-link.ts";

const QUICK = [
  ["👍", "thumbsUp"],
  ["❤️", "heart"],
  ["😂", "laugh"],
  ["😮", "surprised"],
] as const;

/** The invisible "show as emoji" mark (FE0F) aside, the server keeps it on some emoji. */
const sameEmoji = (a: string, b: string) => a.replaceAll("\uFE0F", "") === b.replaceAll("\uFE0F", "");

/** One reaction per person (D061): another emoji replaces it, the same one takes it back. */
function reactWith(view: ChatView, message: ChatMessageView, emoji: string) {
  const mine = message.reactions.some((reaction) => reaction.mine && sameEmoji(reaction.emoji, emoji));
  void setReaction(view.place, message.id, emoji, !mine).catch(view.onFailed);
}

function moreActions(t: TFunction, view: ChatView, message: ChatMessageView, ownMessage: boolean): MenuAction[] {
  const pinned = view.chat.state.pinned.some((p) => p.id === message.id);
  const pin = () => void setPinned(view.place, message.id, !pinned).catch(view.onFailed);
  const writing = !view.readOnly;
  // Own messages from an earlier call of this meeting are shown as own but can't be changed (server rule).
  const own = ownMessage && message.callId === view.place.callId;
  return [
    ...(writing && own && message.kind === "text"
      ? [{ id: "edit", label: t("meetings.chat.actions.edit"), onSelect: () => view.onEdit(message) }]
      : []),
    ...(message.body
      ? [{ id: "copy", label: t("meetings.chat.actions.copy"), onSelect: () => copyText(allTextOf(message)) }]
      : []),
    ...(writing && view.rights.moderate
      ? [{ id: "pin", label: t(pinned ? "meetings.chat.actions.unpin" : "meetings.chat.actions.pin"), onSelect: pin }]
      : []),
    ...((writing && own) || view.rights.moderate
      ? [
          {
            id: "delete",
            label: t("meetings.chat.actions.delete"),
            danger: true,
            onSelect: () => view.onDelete(message),
          },
        ]
      : []),
  ];
}

function Actions({
  view,
  message,
  name,
  own,
  onMoreReactions,
}: {
  view: ChatView;
  message: ChatMessageView;
  name: string;
  own: boolean;
  onMoreReactions: () => void;
}) {
  const { t } = useTranslation();
  const react = (emoji: string) => () => reactWith(view, message, emoji);
  const more = moreActions(t, view, message, own);
  if (view.readOnly) {
    return more.length > 0 ? (
      <MessageActions
        label={t("meetings.chat.actions.label", { name })}
        quickReactions={[]}
        moreLabel={t("meetings.chat.actions.more")}
        more={more}
      />
    ) : null;
  }
  return (
    <MessageActions
      label={t("meetings.chat.actions.label", { name })}
      quickReactions={QUICK.map(([emoji, key]) => ({
        emoji,
        label: t(`meetings.chat.actions.react.${key}`),
        onReact: react(emoji),
      }))}
      moreReactions={{ label: t("meetings.chat.actions.moreReactions"), onClick: onMoreReactions }}
      reply={{ label: t("meetings.chat.actions.reply"), onReply: () => view.onReply(message) }}
      moreLabel={t("meetings.chat.actions.more")}
      more={more}
    />
  );
}

/** The reactions under a message; read-only chat only shows them. */
function reactionChips(t: TFunction, view: ChatView, message: ChatMessageView) {
  return message.reactions.map((reaction) => ({
    emoji: reaction.emoji,
    count: reaction.count,
    mine: reaction.mine,
    label: t("meetings.chat.reaction", {
      emoji: reaction.emoji,
      count: reaction.count,
      names: reaction.names.join(", "),
    }),
    onToggle: view.readOnly
      ? undefined
      : () => void setReaction(view.place, message.id, reaction.emoji, !reaction.mine).catch(view.onFailed),
  }));
}

interface MessageProps {
  view: ChatView;
  message: ChatMessageView;
  /** Continues the same person's group from the same minute (AC-F03-48). */
  continued?: boolean;
}

export function Message(props: MessageProps) {
  const { t } = useTranslation();
  if (props.message.kind === "system") return <SystemNote text={noteText(t, props.message)} />;
  return <PersonMessage {...props} />;
}

/** "Add reaction" and "More reactions" open the full emoji picker under the message. */
function useReactionPicker(view: ChatView, message: ChatMessageView) {
  const { t } = useTranslation();
  const emoji = useEmojiSettings();
  const [open, setOpen] = useState(false);
  const pick = (chosen: string) => {
    setOpen(false);
    emoji.used(chosen);
    reactWith(view, message, chosen);
  };
  return {
    open: () => setOpen(true),
    add: view.readOnly
      ? undefined
      : { label: t("meetings.chat.actions.addReaction"), onClick: () => setOpen((o) => !o) },
    picker: open && !view.readOnly ? <EmojiPicker {...emoji.settings} onPick={pick} /> : undefined,
  };
}

function PersonMessage({ view, message, continued = false }: MessageProps) {
  const { t } = useTranslation();
  const reacting = useReactionPicker(view, message);
  const name = senderName(t, message, view.place.attendanceId, view.viewerUserId);
  const own = isOwn(message, view.place.attendanceId, view.viewerUserId);
  const shown = time(message.createdAt);
  return (
    <ChatMessage
      id={message.id}
      name={name}
      own={own}
      continued={continued}
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
      extras={
        message.pollId && !message.deletedAt ? (
          <PollMessage view={view} pollId={message.pollId} />
        ) : (
          <MessageExtras place={view.place} message={message} onFailed={view.onFailed} />
        )
      }
      reactions={reactionChips(t, view, message)}
      actions={
        message.deletedAt ? undefined : (
          <Actions view={view} message={message} name={name} own={own} onMoreReactions={reacting.open} />
        )
      }
      addReaction={reacting.add}
      picker={reacting.picker}
      onOpenLink={openLink}
      onCopyCode={copyText}
      copyLabel={t("meetings.chat.copy")}
    />
  );
}

export function Pending({ item, chat, continued }: { item: Sending; chat: Chat; continued: boolean }) {
  const { t } = useTranslation();
  return (
    <ChatMessage
      id={item.clientId}
      name={t("meetings.chat.you")}
      own
      continued={continued}
      time=""
      document={item.content.body}
      status={
        item.status === "sending"
          ? { kind: "sending", label: t("meetings.chat.sending") }
          : {
              kind: "failed",
              label: t("meetings.chat.notSent"),
              retryLabel: t("meetings.chat.retry"),
              onRetry: () => chat.retry(item.content, item.clientId, item.replyToId),
            }
      }
      onOpenLink={openLink}
      onCopyCode={copyText}
      copyLabel={t("meetings.chat.copy")}
    />
  );
}
