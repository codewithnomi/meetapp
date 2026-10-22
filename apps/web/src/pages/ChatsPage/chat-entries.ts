// What a chat list row shows (AC-F14-01, 02, 10, 12, 26): the time, the last line ("You: …", "<name>: …"
// or the request's state), and the whole row's name for screen readers.
import type { ChatListEntry } from "@meetapp/ui";
import type { TFunction } from "i18next";
import { timeLabel, type ChatItem } from "../../features/chats/index.ts";

function lastLineOf(t: TFunction, item: ChatItem): string | undefined {
  const other = item.people[0]?.name ?? item.title;
  if (item.request === "waiting") return t("chats.waiting", { name: other });
  if (item.request === "not_accepted") return t("chats.notAccepted", { name: other });
  const last = item.lastMessage;
  if (!last) return undefined;
  if (last.own) return t("chats.you", { text: last.firstLine });
  return item.kind === "direct" ? last.firstLine : t("chats.from", { name: last.senderName, text: last.firstLine });
}

export function entryOf(
  t: TFunction,
  item: ChatItem,
  context: { now: Date; locale: string; current: boolean; onSelect: () => void },
): ChatListEntry {
  const time = item.lastMessage ? timeLabel(new Date(item.lastMessage.at), context.now, context.locale) : undefined;
  const lastLine = lastLineOf(t, item);
  const status = item.status ? { value: item.status, label: t(`chats.status.${item.status}`) } : null;
  const details = [
    item.unread > 0 ? t("chats.unread", { count: item.unread }) : undefined,
    status?.label,
    item.muted ? t("chats.muted") : undefined,
    time,
    lastLine,
  ].filter(Boolean);
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    photoUrl: item.people[0]?.photoUrl ?? null,
    status,
    lastLine,
    time,
    unread: item.unread,
    muted: item.muted,
    mutedLabel: t("chats.muted"),
    current: context.current,
    label: t("chats.rowLabel", { title: item.title, details: details.join(", ") }),
    onSelect: context.onSelect,
  };
}
