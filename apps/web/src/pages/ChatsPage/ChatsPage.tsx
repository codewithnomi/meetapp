// The Chat screen (approved canvas F14Chat, AC-F14-01–09, 28): the chat list on the left and the open
// chat (or New chat) on the right, as in Teams. The list follows the live line's news.
import { ChatList, Notice, type ChatListEntry, type ChatListProps } from "@meetapp/ui";
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../../features/auth/index.ts";
import { useChatList, type ChatFilter, type ChatItem } from "../../features/chats/index.ts";
import { WorkspaceShell, useCurrentWorkspace, type AppScreen } from "../../features/workspaces/index.ts";
import { entryOf } from "./chat-entries.ts";
import { ConversationPane } from "./ConversationPane.tsx";
import { NewChatPane } from "./NewChatPane.tsx";

const FILTERS: ChatFilter[] = ["all", "unread", "chats", "meetings"];
/** The right side shows New chat instead of a chat. */
const NEW_CHAT = "new";

export interface ChatsPageProps {
  onNavigate: (screen: AppScreen) => void;
}

function Placeholder() {
  const { t } = useTranslation();
  return (
    <main className="grid h-full place-items-center p-6 text-center text-ink">
      <div className="flex flex-col gap-1">
        <h1 tabIndex={-1} className="m-0 text-[17px] font-semibold outline-none">
          {t("chats.pick.title")}
        </h1>
        <p className="m-0 text-[14px] text-ink-muted">{t("chats.pick.hint")}</p>
      </div>
    </main>
  );
}

interface ListInput {
  items: ChatItem[];
  entry: (item: ChatItem) => ChatListEntry;
  filter: ChatFilter;
  setFilter: (filter: ChatFilter) => void;
  query: string;
  setQuery: (query: string) => void;
  onNew: () => void;
}

/** The chat list's words, filters and rows: pinned first (AC-F14-01, 03, 05, 06). */
function listProps(t: TFunction, input: ListInput): ChatListProps {
  return {
    heading: t("chats.heading"),
    newChatLabel: t("chats.newChat"),
    onNewChat: input.onNew,
    searchLabel: t("chats.search"),
    query: input.query,
    onQueryChange: input.setQuery,
    filtersLabel: t("chats.filters.label"),
    filters: FILTERS.map((id) => ({ id, label: t(`chats.filters.${id}`) })),
    filter: input.filter,
    onFilter: (id) => input.setFilter(id as ChatFilter),
    pinnedLabel: t("chats.pinned"),
    listLabel: t("chats.list"),
    pinned: input.items.filter((item) => item.pinned).map(input.entry),
    others: input.items.filter((item) => !item.pinned).map(input.entry),
    empty: { title: t("chats.empty.title"), actionLabel: t("chats.empty.action") },
  };
}

export function ChatsPage({ onNavigate }: ChatsPageProps) {
  const { t, i18n } = useTranslation();
  const userId = useSession().data?.id ?? "";
  const [filter, setFilter] = useState<ChatFilter>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string>();
  const [failed, setFailed] = useState(false);
  const { current } = useCurrentWorkspace();
  const list = useChatList(current?.id, filter, query).data;
  const items = list?.conversations ?? [];
  const now = new Date();
  const entry = (item: ChatItem) =>
    entryOf(t, item, { now, locale: i18n.language, current: item.id === open, onSelect: () => setOpen(item.id) });
  const openItem = items.find((item) => item.id === open);
  return (
    <WorkspaceShell screen="chat" onNavigate={onNavigate}>
      <div className="grid h-screen min-h-0 grid-cols-1 md:grid-cols-[360px_1fr]">
        <ChatList
          {...listProps(t, { items, entry, filter, setFilter, query, setQuery, onNew: () => setOpen(NEW_CHAT) })}
        />
        <div className="flex min-h-0 min-w-0 flex-col">
          {failed ? (
            <Notice tone="danger" action={{ label: t("workspaces.notices.dismiss"), onClick: () => setFailed(false) }}>
              {t("chats.failed")}
            </Notice>
          ) : null}
          {open === NEW_CHAT ? (
            <NewChatPane onStarted={(id) => setOpen(id)} onCancel={() => setOpen(undefined)} />
          ) : openItem ? (
            <ConversationPane item={openItem} userId={userId} onFailed={() => setFailed(true)} />
          ) : (
            <Placeholder />
          )}
        </div>
      </div>
    </WorkspaceShell>
  );
}
