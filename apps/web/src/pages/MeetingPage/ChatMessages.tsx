// The messages in the meeting chat (F03, approved "Chat" screens): each with its actions (react,
// reply, and the More menu with Edit, Copy text, Pin and Delete for those allowed), polls drawn as
// poll cards, and messages being sent with "Not sent" and Retry.
import type { ChatMessageView, PollView } from "@meetapp/contracts";
import { ChatMessage, MessageActions, PollCard, SystemNote, type MenuAction } from "@meetapp/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  closePoll,
  pollOf,
  setPinned,
  setReaction,
  votePoll,
  type Chat,
  type Sending,
} from "../../features/meetings/chat/index.ts";
import type { Joined } from "../../features/meetings/index.ts";
import { allTextOf, copyText, noteText, senderName, time } from "./chat-texts.ts";
import { openLink } from "./open-link.ts";

const QUICK = [
  ["👍", "thumbsUp"],
  ["❤️", "heart"],
  ["😂", "laugh"],
  ["😮", "surprised"],
] as const;

/** What the viewer may do in the chat, from their meeting role (the server checks again). */
export interface ChatRights {
  moderate: boolean;
  createPoll: boolean;
}

export interface ChatView {
  chat: Chat;
  visit: Joined;
  rights: ChatRights;
  onReply: (message: ChatMessageView) => void;
  onEdit: (message: ChatMessageView) => void;
  onDelete: (message: ChatMessageView) => void;
  onFailed: () => void;
}

function moreActions(t: TFunction, view: ChatView, message: ChatMessageView, own: boolean): MenuAction[] {
  const pinned = view.chat.state.pinned.some((p) => p.id === message.id);
  const pin = () => void setPinned(view.visit, message.id, !pinned).catch(view.onFailed);
  return [
    ...(own && message.kind === "text"
      ? [{ id: "edit", label: t("meetings.chat.actions.edit"), onSelect: () => view.onEdit(message) }]
      : []),
    ...(message.body
      ? [{ id: "copy", label: t("meetings.chat.actions.copy"), onSelect: () => copyText(allTextOf(message)) }]
      : []),
    ...(view.rights.moderate
      ? [{ id: "pin", label: t(pinned ? "meetings.chat.actions.unpin" : "meetings.chat.actions.pin"), onSelect: pin }]
      : []),
    ...(own || view.rights.moderate
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
}: {
  view: ChatView;
  message: ChatMessageView;
  name: string;
  own: boolean;
}) {
  const { t } = useTranslation();
  const react = (emoji: string) => () => void setReaction(view.visit, message.id, emoji, true).catch(view.onFailed);
  return (
    <MessageActions
      label={t("meetings.chat.actions.label", { name })}
      quickReactions={QUICK.map(([emoji, key]) => ({
        emoji,
        label: t(`meetings.chat.actions.react.${key}`),
        onReact: react(emoji),
      }))}
      reply={{ label: t("meetings.chat.actions.reply"), onReply: () => view.onReply(message) }}
      moreLabel={t("meetings.chat.actions.more")}
      more={moreActions(t, view, message, own)}
    />
  );
}

/** A poll in the chat: fetched for this viewer (results only after voting), again after poll news. */
function PollMessage({ view, pollId }: { view: ChatView; pollId: string }) {
  const { t } = useTranslation();
  const queries = useQueryClient();
  const version = view.chat.state.pollVersions[pollId] ?? 0;
  const key = ["chat-poll", pollId, version];
  const poll = useQuery<PollView>({ queryKey: key, queryFn: () => pollOf(view.visit, pollId) });
  if (!poll.data) return null;
  const p = poll.data;
  const vote = (optionIds: string[]) =>
    void votePoll(view.visit, pollId, optionIds).then((next) => queries.setQueryData(key, next), view.onFailed);
  const kind = t(p.multiple ? "meetings.chat.poll.several" : "meetings.chat.poll.one");
  const names = t(p.anonymous ? "meetings.chat.poll.anonymous" : "meetings.chat.poll.named");
  return (
    <PollCard
      question={p.question}
      about={t("meetings.chat.poll.about", { name: p.creatorName, kind, names })}
      options={p.options}
      multiple={p.multiple}
      chosen={p.yourChoice}
      results={
        p.results
          ? {
              summary: t("meetings.chat.poll.voters", { count: p.results.voters }),
              options: p.results.options.map((o) => ({
                ...o,
                label: t("meetings.chat.poll.result", { percent: o.percent, votes: o.votes }),
              })),
            }
          : undefined
      }
      hint={t("meetings.chat.poll.voteToSee")}
      closedLabel={p.closed ? t("meetings.chat.poll.closed") : undefined}
      onVote={vote}
      close={
        view.rights.moderate
          ? {
              label: t("meetings.chat.poll.close"),
              onClose: () => void closePoll(view.visit, pollId).catch(view.onFailed),
            }
          : undefined
      }
    />
  );
}

export function Message({ view, message }: { view: ChatView; message: ChatMessageView }) {
  const { t } = useTranslation();
  if (message.kind === "system") return <SystemNote text={noteText(t, message)} />;
  const name = senderName(t, message, view.visit);
  const own = message.sender.attendanceId === view.visit.attendanceId;
  const shown = time(message.createdAt);
  return (
    <ChatMessage
      id={message.id}
      name={name}
      own={own}
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
      extras={message.pollId && !message.deletedAt ? <PollMessage view={view} pollId={message.pollId} /> : undefined}
      reactions={message.reactions.map((reaction) => ({
        emoji: reaction.emoji,
        count: reaction.count,
        mine: reaction.mine,
        label: t("meetings.chat.reaction", {
          emoji: reaction.emoji,
          count: reaction.count,
          names: reaction.names.join(", "),
        }),
        onToggle: () => void setReaction(view.visit, message.id, reaction.emoji, !reaction.mine).catch(view.onFailed),
      }))}
      actions={message.deletedAt ? undefined : <Actions view={view} message={message} name={name} own={own} />}
      onOpenLink={openLink}
      onCopyCode={copyText}
      copyLabel={t("meetings.chat.copy")}
    />
  );
}

export function Pending({ item, chat }: { item: Sending; chat: Chat }) {
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
              onRetry: () => chat.retry(item.body, item.clientId, item.replyToId),
            }
      }
      onOpenLink={openLink}
      onCopyCode={copyText}
      copyLabel={t("meetings.chat.copy")}
    />
  );
}
