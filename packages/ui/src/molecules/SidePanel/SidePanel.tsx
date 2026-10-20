// SidePanel (molecule): the frame of a panel beside the meeting stage, as in the approved "Meeting"
// screens (Participants, Meeting info, Device settings): a raised surface with `radius-lg`, the panel's
// title as a heading, and a Close button. The content is the caller's. All words arrive as props.
// Keyboard (AC-F02-44): opening moves focus to the title, Escape closes, and closing returns focus to
// where it was (usually the control-bar button that opened it).
import { useEffect, useId, useRef, type ReactNode } from "react";
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

/** Focus moves to `target` while the panel is open and goes back to the earlier element afterwards. */
function useFocusInAndBack(target: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    target.current?.focus();
    return () => {
      if (before?.isConnected) before.focus();
    };
  }, [target]);
}

/** Escape pressed while focus is inside the panel closes it. */
function useEscape(panel: React.RefObject<HTMLElement | null>, onClose: () => void) {
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  });
  useEffect(() => {
    const element = panel.current;
    if (!element) return undefined;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      latest.current();
    };
    element.addEventListener("keydown", onKey);
    return () => element.removeEventListener("keydown", onKey);
  }, [panel]);
}

export function SidePanel({ title, closeLabel, onClose, children, className }: SidePanelProps) {
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLElement>(null);
  useFocusInAndBack(heading);
  useEscape(panel, onClose);
  return (
    <aside
      ref={panel}
      aria-labelledby={headingId}
      className={cx(
        "box-border flex max-w-full flex-[0_0_380px] flex-col gap-3 self-start overflow-y-auto rounded-lg max-h-full bg-surface p-4 text-ink",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={headingId} ref={heading} tabIndex={-1} className="m-0 text-[17px] leading-6 font-semibold outline-none">
          {title}
        </h2>
        <IconButton icon="close" variant="ghost" size="sm" label={closeLabel} onClick={onClose} />
      </div>
      {children}
    </aside>
  );
}
