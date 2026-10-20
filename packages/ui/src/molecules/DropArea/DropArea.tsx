// DropArea (molecule): shown over the chat while files are dragged over the meeting window (F03
// AC-F03-29, approved screen "Chat: drop files"). It only draws; the meeting page decides when it shows,
// using `trackDrag` so leaving a child element doesn't make it flicker.
import { Icon } from "../../atoms/Icon/index.ts";

export interface DropAreaProps {
  /** "Drop files to share in chat". */
  title: string;
  /** "Pictures, PDF, text, CSV, Word, Excel, PowerPoint · up to 25 MB each". */
  hint: string;
}

export function DropArea({ title, hint }: DropAreaProps) {
  return (
    <div
      role="status"
      className="pointer-events-none absolute inset-2.5 z-10 flex flex-col items-center justify-center gap-2.5 rounded-lg border-2 border-dashed border-accent bg-accent-soft p-4 text-center text-ink"
    >
      <Icon name="upload" size={40} className="text-accent-text" />
      <strong className="text-[16px]">{title}</strong>
      <span className="text-[13px] text-ink-muted">{hint}</span>
    </div>
  );
}

/**
 * Counts drag enters and leaves, so moving over child elements doesn't hide the area (TC-F03-54).
 * Returns whether files are being dragged over the window after each event.
 */
export function trackDrag() {
  let depth = 0;
  return {
    enter: (hasFiles: boolean) => (hasFiles ? ++depth > 0 : depth > 0),
    leave: () => (depth = Math.max(0, depth - 1)) > 0,
    drop: () => (depth = 0) > 0,
  };
}
