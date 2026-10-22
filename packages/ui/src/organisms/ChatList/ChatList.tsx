// ChatList (organism): the left column of the Chat screen on the approved canvas (F14Chat, AC-F14-01–06,
// 10): "Chat" with New chat, search, the filter chips (All · Unread · Chats · Meeting chats), the Chat
// requests link with its count, pinned chats first, then the rest; "No chats yet" when there are none.
import { useId } from "react";
import { Button } from "../../atoms/Button/index.ts";
import { Icon } from "../../atoms/Icon/index.ts";
import { IconButton } from "../../atoms/IconButton/index.ts";
import { Input } from "../../atoms/Input/index.ts";
import { ChatListItem, type ChatListItemProps } from "../../molecules/ChatListItem/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

export interface ChatListEntry extends ChatListItemProps {
  id: string;
}

export interface ChatListProps {
  heading: string;
  newChatLabel: string;
  onNewChat: () => void;
  searchLabel: string;
  query: string;
  onQueryChange: (query: string) => void;
  /** The chips' group name: "Show". */
  filtersLabel: string;
  filters: { id: string; label: string }[];
  filter: string;
  onFilter: (id: string) => void;
  /** Hidden when there are none. */
  requests?: { label: string; count: number; onOpen: () => void } | undefined;
  pinnedLabel: string;
  /** The list's name: "Chats". */
  listLabel: string;
  pinned: ChatListEntry[];
  others: ChatListEntry[];
  /** Shown when there is no chat at all. */
  empty: { title: string; actionLabel: string };
}

function Rows({ entries, label }: { entries: ChatListEntry[]; label: string }) {
  return (
    <ul aria-label={label} className="m-0 flex list-none flex-col gap-0.5 p-0">
      {entries.map(({ id, ...item }) => (
        <li key={id}>
          <ChatListItem {...item} />
        </li>
      ))}
    </ul>
  );
}

/** The heading with New chat, search, the filter chips and the requests link. */
function Top({ props, headingId, searchId }: { props: ChatListProps; headingId: string; searchId: string }) {
  return (
    <>
      <div className="flex items-center gap-1 px-1.5">
        <h1 id={headingId} className="m-0 flex-1 text-[22px] leading-7 font-bold">
          {props.heading}
        </h1>
        <IconButton icon="edit" label={props.newChatLabel} variant="ghost" onClick={props.onNewChat} />
      </div>
      <div className="px-1.5">
        <Input
          id={searchId}
          icon="search"
          aria-label={props.searchLabel}
          placeholder={props.searchLabel}
          value={props.query}
          onChange={(event) => {
            props.onQueryChange(event.target.value);
          }}
        />
      </div>
      <Filters props={props} />
      {props.requests && props.requests.count > 0 ? <RequestsLink {...props.requests} /> : null}
    </>
  );
}

function Filters({ props }: { props: ChatListProps }) {
  return (
    <div role="group" aria-label={props.filtersLabel} className="flex flex-wrap gap-1.5 px-1.5">
      {props.filters.map((filter) => {
        const on = filter.id === props.filter;
        return (
          <button
            key={filter.id}
            type="button"
            aria-pressed={on}
            onClick={() => {
              props.onFilter(filter.id);
            }}
            className={cx(
              "h-7.5 rounded-full border px-3 text-[13px]",
              on
                ? "border-accent bg-accent-soft font-semibold text-accent-text"
                : "border-line-strong bg-surface text-ink",
              FOCUS_RING,
            )}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}

function RequestsLink({ label, count, onOpen }: NonNullable<ChatListProps["requests"]>) {
  return (
    <button
      type="button"
      aria-label={`${label} ${String(count)}`}
      onClick={onOpen}
      className={cx(
        "mx-1.5 flex items-center gap-2.5 rounded-md bg-accent-soft px-3 py-2.5 text-left text-[14px] font-semibold text-accent-text",
        FOCUS_RING,
      )}
    >
      <Icon name="mail" size={18} />
      <span className="flex-1">{label}</span>
      <span>{count}</span>
    </button>
  );
}

function Empty({ props }: { props: ChatListProps }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <p className="m-0 text-[15px] font-semibold">{props.empty.title}</p>
      <Button variant="secondary" onClick={props.onNewChat}>
        {props.empty.actionLabel}
      </Button>
    </div>
  );
}

function Lists({ props }: { props: ChatListProps }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto">
      {props.pinned.length > 0 ? (
        <>
          <span className="px-2.5 pt-1 text-[12px] font-semibold text-ink-muted">{props.pinnedLabel}</span>
          <Rows entries={props.pinned} label={props.pinnedLabel} />
        </>
      ) : null}
      <Rows entries={props.others} label={props.listLabel} />
    </div>
  );
}

export function ChatList(props: ChatListProps) {
  const headingId = useId();
  const searchId = useId();
  const none = props.pinned.length === 0 && props.others.length === 0;
  return (
    <section
      aria-labelledby={headingId}
      className="box-border flex h-full flex-col gap-3 border-r border-line bg-surface px-3 py-5 text-ink"
    >
      <Top props={props} headingId={headingId} searchId={searchId} />
      {none ? <Empty props={props} /> : <Lists props={props} />}
    </section>
  );
}
