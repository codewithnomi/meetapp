// FileChip (atom): a file waiting in the message box (F03 AC-F03-28, 29, approved screen "Chat: drop
// files"): its name and size, a progress text while it uploads, "Upload failed" with Retry, and a
// button to remove it. Words arrive as props.
import { Spinner } from "../Spinner/index.ts";
import { IconButton } from "../IconButton/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

export interface FileChipProps {
  /** "plan.pdf · 1.4 MB" or "screen.png · 62%". */
  text: string;
  state: "uploading" | "ready" | "failed";
  /** "Uploading screen.png" (spoken with the spinner). */
  uploadingLabel?: string | undefined;
  /** "Upload failed" and "Retry" when the upload stopped (AC-F03-05). */
  failed?: { label: string; retryLabel: string; onRetry: () => void } | undefined;
  removeLabel: string;
  onRemove: () => void;
}

export function FileChip({ text, state, uploadingLabel, failed, removeLabel, onRemove }: FileChipProps) {
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center gap-2 rounded-full border bg-surface py-1 pr-1 pl-3 text-[13px] text-ink",
        state === "failed" ? "border-danger" : "border-line",
      )}
    >
      {state === "uploading" ? <Spinner size={14} label={uploadingLabel ?? text} /> : null}
      <span className="min-w-0 truncate">{text}</span>
      {state === "failed" && failed ? (
        <>
          <span className="font-semibold text-danger">{failed.label}</span>
          <button
            type="button"
            onClick={failed.onRetry}
            className={cx(
              "cursor-pointer rounded-full border-0 bg-transparent px-1 font-semibold text-accent-text",
              FOCUS_RING,
            )}
          >
            {failed.retryLabel}
          </button>
        </>
      ) : null}
      <IconButton icon="close" label={removeLabel} variant="ghost" size="sm" onClick={onRemove} />
    </span>
  );
}
