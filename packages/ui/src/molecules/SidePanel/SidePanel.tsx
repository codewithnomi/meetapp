// SidePanel (molecule): the frame of a panel beside the meeting stage, as in the approved "Meeting"
// screens (Participants, Meeting info, Device settings): a raised surface with `radius-lg`, the panel's
// title as a heading, and a Close button. The content is the caller's. All words arrive as props.
import { useId, type ReactNode } from "react";
import { IconButton } from "../../atoms/IconButton/index.ts";
import { cx } from "../../lib/cx.ts";

export interface SidePanelProps {
  /** Already translated: "Participants (23)", "Meeting info". */
  title: string;
  /** "Close participants". */
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function SidePanel({ title, closeLabel, onClose, children, className }: SidePanelProps) {
  const headingId = useId();
  return (
    <aside
      aria-labelledby={headingId}
      className={cx(
        "box-border flex max-w-95 min-w-0 flex-[1_1_320px] flex-col gap-3 self-start overflow-y-auto rounded-lg max-h-full bg-surface p-4 text-ink",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={headingId} className="m-0 text-[17px] leading-6 font-semibold">
          {title}
        </h2>
        <IconButton icon="close" variant="ghost" size="sm" label={closeLabel} onClick={onClose} />
      </div>
      {children}
    </aside>
  );
}
