// ChatPanel (organism): the meeting chat beside the videos, as in the approved "Chat" screen (F03): the
// pinned bar, the messages (oldest at the top), "No messages yet", the "New messages" button when the
// person has scrolled up, a note such as "Chat is turned off", the message box, and the drop area while
// files are dragged in. The page passes the messages (ChatMessage, SystemNote) and the message box.
// New messages are announced to screen readers through the log (AC-F03-45). Words arrive as props.
import type { ReactNode, Ref, UIEvent } from "react";
import { Button } from "../../atoms/Button/index.ts";
import { DropArea, type DropAreaProps } from "../../molecules/DropArea/index.ts";
import { PinnedBar, type PinnedBarProps } from "../../molecules/PinnedBar/index.ts";
import { SidePanel } from "../../molecules/SidePanel/index.ts";

export interface ChatPanelProps {
  /** "Chat". */
  title: string;
  /** "Close chat". */
  closeLabel: string;
  onClose: () => void;
  pinned?: PinnedBarProps | undefined;
  /** Messages and notes, oldest first. */
  messages: ReactNode;
  /** "No messages yet" with its hint, shown when there are none (AC-F03-09). */
  empty?: { title: string; hint: string } | undefined;
  /** Older messages are loading (shown at the top). */
  loadingOlder?: string | undefined;
  /** "Messages" (the list's name for screen readers). */
  listLabel: string;
  /** Shown while the person reads older messages and new ones arrived (AC-F03-08). */
  newMessages?: { label: string; onClick: () => void } | undefined;
  /** "Chat is turned off for this meeting." and similar, shown instead of or above the message box. */
  notice?: ReactNode;
  composer?: ReactNode;
  dropArea?: DropAreaProps | undefined;
  /** The scrolling list, so the page can keep the view still and load older messages. */
  listRef?: Ref<HTMLDivElement> | undefined;
  onScroll?: ((event: UIEvent<HTMLDivElement>) => void) | undefined;
}

export function ChatPanel(props: ChatPanelProps) {
  const { title, closeLabel, onClose, pinned, messages, empty, loadingOlder, listLabel } = props;
  const { newMessages, notice, composer, dropArea, listRef, onScroll } = props;
  return (
    <SidePanel title={title} closeLabel={closeLabel} onClose={onClose} className="relative min-h-0">
      {pinned ? <PinnedBar {...pinned} /> : null}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={listRef}
          role="log"
          aria-label={listLabel}
          aria-live="polite"
          aria-relevant="additions"
          onScroll={onScroll}
          className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-x-hidden overflow-y-auto pt-10"
        >
          {loadingOlder ? <p className="m-0 self-center text-[12px] text-ink-muted">{loadingOlder}</p> : null}
          {empty ? (
            <div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-ink">
              <strong>{empty.title}</strong>
              <span className="text-[13px] text-ink-muted">{empty.hint}</span>
            </div>
          ) : (
            messages
          )}
        </div>
        {newMessages ? (
          <Button
            size="sm"
            className="absolute bottom-2 left-1/2 -translate-x-1/2 shadow-2"
            onClick={newMessages.onClick}
          >
            {newMessages.label}
          </Button>
        ) : null}
      </div>
      {notice}
      {composer}
      {dropArea ? <DropArea {...dropArea} /> : null}
    </SidePanel>
  );
}
