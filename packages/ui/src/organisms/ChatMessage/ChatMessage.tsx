// ChatMessage (organism): one message in the meeting chat, as in the approved "Chat" screen (F03): the
// sender's picture or initials, name and time, then the message, any reply quote, files, GIF or poll
// (passed in as `extras`), and the reactions. Own messages sit on the right. States: "Edited",
// "This message was deleted", sending, and "Not sent" with Retry (AC-F03-05, 10). Words arrive as props.
import type { ReactNode } from "react";
import { Avatar } from "../../atoms/Avatar/index.ts";
import { Button } from "../../atoms/Button/index.ts";
import { ReactionChip, type ReactionChipProps } from "../../atoms/ReactionChip/index.ts";
import { MessageBody, type RichDocument } from "../../molecules/MessageBody/index.ts";
import { ReplyQuote, type ReplyQuoteProps } from "../../molecules/ReplyQuote/index.ts";
import { cx } from "../../lib/cx.ts";

export interface ChatMessageProps {
  /** Used to scroll to this message ("chat-message-<id>"). */
  id: string;
  /** As shown: "Bilal Ahmed", "Mei Lin (External)", "You". */
  name: string;
  photoUrl?: string | null | undefined;
  /** "10:41", or "10:43 · Edited". */
  time: string;
  own?: boolean;
  document?: RichDocument | null | undefined;
  /** The deleted text ("This message was deleted"), when the message was deleted. */
  deletedText?: string | undefined;
  replyTo?: Omit<ReplyQuoteProps, "composing"> | undefined;
  /** Files, a GIF, a sticker or a poll, drawn by their own components. */
  extras?: ReactNode;
  reactions?: (Omit<ReactionChipProps, "onClick"> & { onToggle: () => void })[];
  /** The pointing/keyboard toolbar (reply, react, more). */
  actions?: ReactNode;
  status?:
    { kind: "sending"; label: string } | { kind: "failed"; label: string; retryLabel: string; onRetry: () => void };
  onOpenLink: (href: string) => void;
  onCopyCode: (text: string) => void;
  copyLabel: string;
}

function Status({ status }: { status: NonNullable<ChatMessageProps["status"]> }) {
  if (status.kind === "sending") return <span className="text-[12px] text-ink-muted">{status.label}</span>;
  return (
    <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-danger">
      {status.label}
      <Button variant="ghost" size="sm" onClick={status.onRetry}>
        {status.retryLabel}
      </Button>
    </span>
  );
}

/** The message itself: deleted text, or the bubble (reply quote and text) and any extras. */
function Content(props: ChatMessageProps) {
  const { own = false, document, deletedText, replyTo, extras, onOpenLink, onCopyCode, copyLabel } = props;
  if (deletedText) {
    return (
      <div className="rounded-md border border-dashed border-line-strong px-3 py-2 text-[14px] text-ink-muted italic">
        {deletedText}
      </div>
    );
  }
  const bubble = own
    ? "rounded-[var(--radius-md)_4px_var(--radius-md)_var(--radius-md)] bg-accent-soft"
    : "rounded-[4px_var(--radius-md)_var(--radius-md)_var(--radius-md)] bg-surface-sunken";
  return (
    <>
      {document || replyTo ? (
        <div className={cx("max-w-90 min-w-0 px-3 py-2 text-ink", bubble)}>
          {replyTo ? <ReplyQuote {...replyTo} /> : null}
          {document ? (
            <MessageBody document={document} onOpenLink={onOpenLink} onCopyCode={onCopyCode} copyLabel={copyLabel} />
          ) : null}
        </div>
      ) : null}
      {extras}
    </>
  );
}

function Reactions({ reactions }: { reactions: NonNullable<ChatMessageProps["reactions"]> }) {
  if (reactions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {reactions.map(({ onToggle, ...chip }) => (
        <ReactionChip key={chip.emoji} {...chip} onClick={onToggle} />
      ))}
    </div>
  );
}

export function ChatMessage(props: ChatMessageProps) {
  const { id, name, photoUrl, time, own = false, reactions = [], actions, status } = props;
  const photo = photoUrl ? { src: photoUrl } : {};
  return (
    <article
      id={`chat-message-${id}`}
      aria-label={`${name}, ${time}`}
      className={cx("group relative flex max-w-full items-start gap-2", own && "flex-row-reverse self-end")}
      tabIndex={-1}
    >
      {own ? null : <Avatar name={name} size="sm" {...photo} />}
      <div className={cx("flex min-w-0 flex-col gap-1", own && "items-end")}>
        <div className="flex items-baseline gap-2 text-[12px] leading-4">
          <span className="font-semibold text-ink">{name}</span>
          <span className="text-ink-muted">{time}</span>
        </div>
        <Content {...props} />
        <Reactions reactions={reactions} />
        {status ? <Status status={status} /> : null}
      </div>
      {actions ? (
        <div
          className={cx(
            "absolute -top-4 z-10 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
            own ? "left-0" : "right-0",
          )}
        >
          {actions}
        </div>
      ) : null}
    </article>
  );
}
