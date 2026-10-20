// PinnedBar (molecule): the pinned messages at the top of the chat panel (F03 AC-F03-19), one at a time
// with "1 of 2"; pressing it goes to the message, the arrow shows the next pin. Words arrive translated.
import { Icon } from "../../atoms/Icon/index.ts";
import { IconButton } from "../../atoms/IconButton/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

export interface PinnedBarProps {
  /** "Pinned" (translated). */
  title: string;
  /** "Bilal Ahmed: Release checklist for Thursday". */
  text: string;
  /** "1 of 2"; left out when only one is pinned. */
  position?: string | undefined;
  onShow: () => void;
  /** Shown with more than one pin. */
  next?: { label: string; onNext: () => void } | undefined;
}

export function PinnedBar({ title, text, position, onShow, next }: PinnedBarProps) {
  return (
    <div className="flex items-center gap-1 rounded-md bg-surface-sunken pr-1 text-[13px] text-ink">
      <button
        type="button"
        onClick={onShow}
        className={cx(
          "flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md border-0 bg-transparent px-3 py-2 text-left text-ink",
          FOCUS_RING,
        )}
      >
        <Icon name="pin" size={16} />
        <span className="min-w-0 flex-1 truncate">
          <strong>{title}</strong> · {text}
        </span>
        {position ? <span className="text-[12px] text-ink-muted">{position}</span> : null}
      </button>
      {next ? (
        <IconButton icon="chevron-down" label={next.label} variant="ghost" size="sm" onClick={next.onNext} />
      ) : null}
    </div>
  );
}
