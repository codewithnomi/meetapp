// MessageActions (molecule): the small bar shown when pointing at a message or moving to it with Tab
// (F03, approved screen "Chat: message menu"): four quick reactions, More reactions, Reply, and the More
// menu (Edit, Copy text, Pin for everyone, Delete), holding only what the viewer may do. Words arrive as props.
import { ActionMenu, type MenuAction } from "../../atoms/ActionMenu/index.ts";
import { IconButton } from "../../atoms/IconButton/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

export interface MessageActionsProps {
  /** Names the bar: "Actions for Bilal Ahmed's message". */
  label: string;
  quickReactions: { emoji: string; label: string; onReact: () => void }[];
  moreReactions?: { label: string; onClick: () => void } | undefined;
  reply?: { label: string; onReply: () => void } | undefined;
  /** Edit, Copy text, Pin, Delete: only those allowed. */
  more: MenuAction[];
  moreLabel: string;
}

export function MessageActions({ label, quickReactions, moreReactions, reply, more, moreLabel }: MessageActionsProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center gap-0.5 rounded-full border border-line bg-surface-raised p-1 shadow-2"
    >
      {quickReactions.map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
          aria-label={reaction.label}
          title={reaction.label}
          onClick={reaction.onReact}
          className={cx(
            "grid size-8 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-[18px] hover:bg-surface-sunken",
            FOCUS_RING,
          )}
        >
          {reaction.emoji}
        </button>
      ))}
      {moreReactions ? (
        <IconButton icon="plus" label={moreReactions.label} variant="ghost" size="sm" onClick={moreReactions.onClick} />
      ) : null}
      {reply ? (
        <>
          <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-line" />
          <IconButton icon="reply" label={reply.label} variant="ghost" size="sm" onClick={reply.onReply} />
        </>
      ) : null}
      {more.length > 0 ? <ActionMenu actions={more} label={moreLabel} /> : null}
    </div>
  );
}
