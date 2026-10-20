// ChatMessage (organism): one message in the meeting chat, as in the approved "Chat" screen (F03): the
// sender's picture or initials, name and time, then the message, any reply quote, files, GIF or poll
// (passed in as `extras`), and the reactions. Own messages sit on the right. States: "Edited",
// "This message was deleted", sending, and "Not sent" with Retry (AC-F03-05, 10). A message that only
// continues the same person's group (same minute) shows no name, time or picture, as a connected bubble;
// a message of only 1–3 emoji shows them larger without a bubble (AC-F03-47, 48). Words arrive as props.
import type { ReactNode } from "react";
import { Avatar } from "../../atoms/Avatar/index.ts";
import { Button } from "../../atoms/Button/index.ts";
import { ReactionChip, type ReactionChipProps } from "../../atoms/ReactionChip/index.ts";
import { MessageBody, type RichDocument } from "../../molecules/MessageBody/index.ts";
import { ReplyQuote, type ReplyQuoteProps } from "../../molecules/ReplyQuote/index.ts";
import { cx } from "../../lib/cx.ts";
import { emojiOnly } from "../../lib/rich-document.ts";

export interface ChatMessageProps {
  /** Used to scroll to this message ("chat-message-<id>"). */
  id: string;
  /** As shown: "Bilal Ahmed", "Mei Lin (External)", "You". */
  name: string;
  photoUrl?: string | null | undefined;
  /** "10:41", or "10:43 · Edited". */
  time: string;
  own?: boolean;
  /** Continues the same person's messages from the same minute: no name, time or picture (AC-F03-48). */
  continued?: boolean;
  document?: RichDocument | null | undefined;
  /** The deleted text ("This message was deleted"), when the message was deleted. */
  deletedText?: string | undefined;
  replyTo?: Omit<ReplyQuoteProps, "composing"> | undefined;
  /** Files, a GIF, a sticker or a poll, drawn by their own components. */
  extras?: ReactNode;
  /** Without `onToggle` (read-only chat) the chips only show the reactions. */
  reactions?: (Omit<ReactionChipProps, "onClick"> & { onToggle?: (() => void) | undefined })[];
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
  if (document && !replyTo && emojiOnly(document)) {
    return (
      <>
        <MessageBody document={document} onOpenLink={onOpenLink} onCopyCode={onCopyCode} copyLabel={copyLabel} big />
        {extras}
      </>
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
        <ReactionChip key={chip.emoji} {...chip} onClick={onToggle} disabled={!onToggle} />
      ))}
    </div>
  );
}

/** The picture, or the same width left empty under a group's first message. */
function Picture({ name, photoUrl, continued }: Pick<ChatMessageProps, "name" | "photoUrl" | "continued">) {
  if (continued) return <span aria-hidden="true" className="w-8 shrink-0" />;
  return <Avatar name={name} size="sm" {...(photoUrl ? { src: photoUrl } : {})} />;
}

export function ChatMessage(props: ChatMessageProps) {
  const { id, name, photoUrl, time, own = false, continued = false, reactions = [], actions, status } = props;
  return (
    <article
      id={`chat-message-${id}`}
      aria-label={`${name}, ${time}`}
      className={cx(
        "group relative flex max-w-full min-w-0 items-start gap-2",
        own && "flex-row-reverse self-end",
        continued && "-mt-2.5",
      )}
      tabIndex={-1}
    >
      {own ? null : <Picture name={name} photoUrl={photoUrl} continued={continued} />}
      <div className={cx("flex min-w-0 flex-col gap-1", own && "items-end")}>
        {continued ? null : (
          <div className="flex items-baseline gap-2 text-[12px] leading-4">
            <span className="font-semibold text-ink">{name}</span>
            <span className="text-ink-muted">{time}</span>
          </div>
        )}
        <Content {...props} />
        <Reactions reactions={reactions} />
        {status ? <Status status={status} /> : null}
      </div>
      {actions ? (
        <div
          className={cx(
            // Above the message and inside the panel: from the right edge for own messages, after the
            // picture for others', so a short message never pushes the bar out of view.
            "pointer-events-none absolute -top-9 z-10 opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100",
            own ? "right-0" : "left-10",
          )}
        >
          {actions}
        </div>
      ) : null}
    </article>
  );
}
