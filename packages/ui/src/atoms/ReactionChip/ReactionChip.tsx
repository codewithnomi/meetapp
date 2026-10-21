// ReactionChip (atom): one emoji reaction under a chat message with its count (F03 AC-F03-13). Pressing
// it adds or takes back the viewer's own reaction; `mine` shows it is theirs, in words for screen
// readers too ("Thumbs up, 3 people, including you" arrives as `label`). As in Teams, the count shows
// only when more than one person reacted.
import type { ButtonHTMLAttributes } from "react";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

export interface ReactionChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> {
  emoji: string;
  count: number;
  mine: boolean;
  /** Translated: the emoji's name, how many, and the names of who reacted. */
  label: string;
}

export function ReactionChip({ emoji, count, mine, label, className, ...rest }: ReactionChipProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={mine}
      title={label}
      className={cx(
        "inline-flex h-8 min-w-8 cursor-pointer items-center justify-center gap-1 rounded-full border px-2 text-[12px] font-semibold disabled:cursor-default",
        mine ? "border-2 border-accent bg-accent-soft text-accent-text" : "border-line bg-surface text-ink shadow-1",
        FOCUS_RING,
        className,
      )}
      {...rest}
    >
      <span aria-hidden="true" className="text-[16px] leading-none">
        {emoji}
      </span>
      {count > 1 ? count : null}
    </button>
  );
}
