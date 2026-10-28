// The Chat screen (approved canvas F14Chat, AC-F14-01–09, 28): the chat list on the left and the open
// chat (or New chat) on the right, as in Teams. The list follows the live line's news.
import { ChatList, Notice, type ChatListEntry, type ChatListProps } from "@meetapp/ui";
import type { TFunction } from "i18next";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../../features/auth/index.ts";
import { useChatCall } from "../../features/calls/index.ts";
import { useChatList, useChatRequests, type ChatFilter, type ChatItem } from "../../features/chats/index.ts";
import { WorkspaceShell, useCurrentWorkspace, type AppScreen } from "../../features/workspaces/index.ts";
import { entryOf } from "./chat-entries.ts";
import { openChatOf } from "./open-chat.ts";
import { LoadState, showsLoadState } from "./LoadState.tsx";
import { ConversationPane } from "./ConversationPane.tsx";
import { GroupPane } from "./GroupPane.tsx";
import { NewChatPane } from "./NewChatPane.tsx";
import { RequestsPane } from "./RequestsPane.tsx";

const FILTERS: ChatFilter[] = ["all", "unread", "chats", "meetings"];
/** The right side shows New chat instead of a chat. */
const NEW_CHAT = "new";
const REQUESTS = "requests";
/** Group details open beside the list: "details:<conversation id>". */
const DETAILS = "details:";

export interface ChatsPageProps {
  onNavigate: (screen: AppScreen) => void;
}

function Placeholder() {
  const { t } = useTranslation();
  return (
    <main className="grid h-full place-items-center p-6 text-center text-ink">
      <div className="flex flex-col gap-1">
        <h2 tabIndex={-1} className="m-0 text-[17px] font-semibold outline-none">
          {t("chats.pick.title")}
        </h2>
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
  requests: { count: number; onOpen: () => void };
  /** Loading or failed: shown instead of the rows. */
  state: ReactNode;
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
    requests: { label: t("chats.requests"), ...input.requests },
    pinnedLabel: t("chats.pinned"),
    listLabel: t("chats.list"),
    pinned: input.items.filter((item) => item.pinned).map(input.entry),
    others: input.items.filter((item) => !item.pinned).map(input.entry),
    empty: { title: t("chats.empty.title"), actionLabel: t("chats.empty.action") },
    state: input.state,
  };
}

interface RightPaneProps {
  open: string | undefined;
  setOpen: (open: string | undefined) => void;
  /** Opens a chat just started or accepted, clearing the list's filter and search so it is listed. */
  showNew: (id: string) => void;
  items: ChatItem[];
  /** Every chat, unfiltered: the open one stays open when the filter or search hides it. */
  all: ChatItem[] | undefined;
  userId: string;
}

/** The right side: New chat, Chat requests, a group's details, the open chat, or "Choose a chat". */
function RightPane({ open, setOpen, items, all, userId, showNew }: RightPaneProps) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const detailsOf = open?.startsWith(DETAILS) ? open.slice(DETAILS.length) : undefined;
  const openItem = openChatOf(detailsOf ?? open, all, items);
  let pane: ReactNode = <Placeholder />;
  if (open === NEW_CHAT) pane = <NewChatPane onStarted={showNew} onCancel={() => setOpen(undefined)} />;
  else if (open === REQUESTS) pane = <RequestsPane onAccepted={showNew} />;
  else if (openItem && detailsOf)
    pane = (
      <GroupPane
        item={openItem}
        userId={userId}
        onClose={() => setOpen(openItem.id)}
        onLeft={() => setOpen(undefined)}
      />
    );
  else if (openItem)
    pane = (
      <ConversationPane
        item={openItem}
        userId={userId}
        onFailed={() => setFailed(true)}
        onDetails={() => setOpen(`${DETAILS}${openItem.id}`)}
      />
    );
  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      {failed ? (
        <Notice tone="danger" action={{ label: t("workspaces.notices.dismiss"), onClick: () => setFailed(false) }}>
          {t("chats.failed")}
        </Notice>
      ) : null}
      {pane}
    </div>
  );
}

/**
 * The open chat. Coming back from a call opens that call's chat, whether this screen appeared before or
 * after the call was left.
 */
function useOpenAfterCall() {
  // Read while drawing, cleared only once shown: React may draw a screen more than once before showing it.
  const [open, setOpen] = useState<string | undefined>(() => useChatCall.getState().backTo);
  useEffect(() => {
    useChatCall.getState().takeBackTo();
    return useChatCall.subscribe((state) => {
      const id = state.backTo && state.takeBackTo();
      if (id) setOpen(id);
    });
  }, []);
  return [open, setOpen] as const;
}

export function ChatsPage({ onNavigate }: ChatsPageProps) {
  const { t, i18n } = useTranslation();
  const userId = useSession().data?.id ?? "";
  const [filter, setFilter] = useState<ChatFilter>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useOpenAfterCall();
  const { current } = useCurrentWorkspace();
  const list = useChatList(current?.id, filter, query);
  const items = list.data?.conversations ?? [];
  // The same list the side menu's badge reads, so usually no extra request.
  const all = useChatList(current?.id, "all", "").data?.conversations;
  const now = new Date();
  const entry = (item: ChatItem) =>
    entryOf(t, item, { now, locale: i18n.language, current: item.id === open, onSelect: () => setOpen(item.id) });
  const requestCount = useChatRequests().data?.requests.length ?? 0;
  // As in Teams: a chat just started or accepted opens with every chat listed again (AC-F14-30, TC-F14-60).
  const showNew = (id: string) => {
    setFilter("all");
    setQuery("");
    setOpen(id);
  };
  return (
    <WorkspaceShell screen="chat" onNavigate={onNavigate}>
      <div className="grid h-screen min-h-0 grid-cols-1 md:grid-cols-[360px_1fr]">
        <ChatList
          {...listProps(t, {
            items,
            entry,
            filter,
            setFilter,
            query,
            setQuery,
            onNew: () => setOpen(NEW_CHAT),
            requests: { count: requestCount, onOpen: () => setOpen(REQUESTS) },
            state: showsLoadState(list) ? <LoadState query={list} loadingLabel={t("chats.load.chats")} /> : null,
          })}
        />
        <RightPane open={open} setOpen={setOpen} items={items} all={all} userId={userId} showNew={showNew} />
      </div>
    </WorkspaceShell>
  );
}
