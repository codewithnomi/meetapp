// ChatListItem (molecule): one chat in the chat list of the approved canvas (F14Chat, AC-F14-01, 02):
// the picture (a person with their status dot, a group's initials, or a calendar for a meeting chat),
// the name, the time of the last message, its first line ("You: …" for one's own), and the unread
// count. Unread chats are bold. All words arrive as props, already translated.
import { Avatar } from "../../atoms/Avatar/index.ts";
import { Icon } from "../../atoms/Icon/index.ts";
import { StatusDot, type ChatStatus } from "../../atoms/StatusDot/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

export interface ChatListItemProps {
  kind: "direct" | "group" | "meeting";
  /** The other person, the group's name or its members' names, or the meeting's title. */
  title: string;
  photoUrl?: string | null | undefined;
  /** A one-to-one chat's status, when the viewer may see it. */
  status?: { value: ChatStatus; label: string } | null | undefined;
  /** "You: Thanks", "Bilal: Did QA finish…", or a note such as "Waiting for Mei to accept". */
  lastLine?: string | undefined;
  /** Already formatted: "10:14", "Mon", "3 Oct". */
  time?: string | undefined;
  unread: number;
  muted?: boolean;
  /** Shown when muted; read as part of the row's name. */
  mutedLabel?: string | undefined;
  current?: boolean;
  /** The whole row's name for screen readers: "Bilal Ahmed, 2 unread, Available, 10:14 Did QA finish…". */
  label: string;
  onSelect: () => void;
}

function Picture({ kind, title, photoUrl, status }: Pick<ChatListItemProps, "kind" | "title" | "photoUrl" | "status">) {
  if (kind === "meeting") {
    return (
      <span
        aria-hidden="true"
        className="grid size-9 flex-none place-items-center rounded-full bg-accent-soft text-accent-text"
      >
        <Icon name="calendar" size={18} />
      </span>
    );
  }
  return (
    <span className="relative flex-none" aria-hidden="true">
      <Avatar name={title} size="md" {...(photoUrl ? { src: photoUrl } : {})} />
      {status ? <StatusDot status={status.value} label={status.label} placed /> : null}
    </span>
  );
}

export function ChatListItem(props: ChatListItemProps) {
  const { kind, title, photoUrl, status, lastLine, time, unread, muted = false, mutedLabel, current = false } = props;
  const bold = unread > 0;
  return (
    <button
      type="button"
      aria-current={current ? "true" : undefined}
      aria-label={props.label}
      onClick={props.onSelect}
      className={cx(
        "flex min-h-15.5 w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-ink",
        current ? "bg-accent-soft" : "hover:bg-surface-sunken",
        FOCUS_RING,
      )}
    >
      <Picture kind={kind} title={title} photoUrl={photoUrl} status={status} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex gap-2">
          <span className={cx("min-w-0 flex-1 truncate", bold ? "font-bold" : "font-medium")}>{title}</span>
          {time ? <span className="text-[12px] text-ink-muted">{time}</span> : null}
        </span>
        <span className="flex items-center gap-2">
          <span className={cx("min-w-0 flex-1 truncate text-[13px]", bold ? "font-bold text-ink" : "text-ink-muted")}>
            {lastLine}
          </span>
          {muted ? (
            <span className="text-ink-muted" title={mutedLabel}>
              <Icon name="muted" size={14} />
            </span>
          ) : null}
          {unread > 0 ? (
            <span className="box-border grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[12px] font-bold text-on-accent">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}
