// ReplyQuote (molecule): the short quote at the top of a reply (F03 AC-F03-14): who wrote the original
// and its first line. Pressing it scrolls to the original. In the message box it shows "Replying to …"
// with a cancel button instead.
import { IconButton } from "../../atoms/IconButton/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

export interface ReplyQuoteProps {
  senderName: string;
  /** The original's first line, or "This message was deleted" (translated). */
  firstLine: string;
  /** In a sent message: go to the original. */
  onShow?: (() => void) | undefined;
  /** In the message box: "Replying to Bilal Ahmed" and a cancel button labelled `cancelLabel`. */
  composing?: { title: string; cancelLabel: string; onCancel: () => void } | undefined;
}

export function ReplyQuote({ senderName, firstLine, onShow, composing }: ReplyQuoteProps) {
  if (composing) {
    return (
      <div className="flex items-center gap-2 rounded-xs border-l-3 border-accent bg-surface-sunken px-2.5 py-1.5 text-[12px]">
        <span className="flex min-w-0 flex-1 flex-col">
          <strong className="text-ink">{composing.title}</strong>
          <span className="truncate text-ink-muted">{firstLine}</span>
        </span>
        <IconButton icon="close" label={composing.cancelLabel} variant="ghost" size="sm" onClick={composing.onCancel} />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onShow}
      className={cx(
        "mb-1.5 flex w-full cursor-pointer flex-col rounded-xs border-0 border-l-3 border-line-strong bg-surface px-2 py-1 text-left text-[12px] leading-4",
        FOCUS_RING,
      )}
    >
      <strong className="text-ink">{senderName}</strong>
      <span className="truncate text-ink-muted">{firstLine}</span>
    </button>
  );
}
