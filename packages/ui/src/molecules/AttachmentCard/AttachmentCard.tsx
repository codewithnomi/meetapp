// AttachmentCard (molecule): a file in a chat message (F03 AC-F03-28, approved screen "Chat"). A picture
// shows its preview and opens larger; any other file shows its name, kind and size with Download. When
// a preview can't be shown, the name and Download are shown instead. Links come from the page.
import { useState } from "react";
import { Button } from "../../atoms/Button/index.ts";
import { Icon } from "../../atoms/Icon/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

export interface AttachmentCardProps {
  fileName: string;
  /** "PDF · 1.4 MB" (translated, made by the page). */
  details: string;
  /** A short-lived preview link for pictures; left out for other files. */
  previewUrl?: string | undefined;
  /** "Picture: chart.png, open larger" (translated). */
  previewLabel?: string | undefined;
  onOpenPreview?: (() => void) | undefined;
  /** "Download" (translated). */
  downloadLabel: string;
  onDownload: () => void;
}

export function AttachmentCard(props: AttachmentCardProps) {
  const { fileName, details, previewUrl, previewLabel, onOpenPreview, downloadLabel, onDownload } = props;
  const [broken, setBroken] = useState(false);
  if (previewUrl && !broken) {
    return (
      <button
        type="button"
        aria-label={previewLabel ?? fileName}
        onClick={onOpenPreview}
        className={cx(
          "max-w-60 cursor-zoom-in overflow-hidden rounded-md border border-line bg-surface-sunken p-0",
          FOCUS_RING,
        )}
      >
        <img src={previewUrl} alt="" className="block max-h-45 w-full object-cover" onError={() => setBroken(true)} />
      </button>
    );
  }
  return (
    <div className="flex max-w-80 items-center gap-2.5 rounded-md border border-line bg-surface px-3 py-2.5 text-ink">
      <Icon name="file" size={28} className="text-ink-muted" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-semibold">{fileName}</span>
        <span className="text-[12px] text-ink-muted">{details}</span>
      </span>
      <Button variant="ghost" size="sm" onClick={onDownload}>
        {downloadLabel}
      </Button>
    </div>
  );
}
