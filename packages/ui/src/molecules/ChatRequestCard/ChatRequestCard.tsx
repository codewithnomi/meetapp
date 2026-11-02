// ChatRequestCard (molecule): a chat request from someone outside the person's workspaces, as on the
// approved canvas (F14Requests, AC-F14-10, 11, 13): who it is, their email and "(External)", Preview
// messages, Accept, and Delete with a confirmation that offers "Also block". All words arrive as props.
import { useId, useState } from "react";
import { Avatar } from "../../atoms/Avatar/index.ts";
import { Button } from "../../atoms/Button/index.ts";

export interface RequestPreviewMessage {
  id: string;
  senderName: string;
  text: string;
  /** Already formatted: "09:31". */
  time: string;
}

export interface ChatRequestCardProps {
  name: string;
  photoUrl?: string | null | undefined;
  /** "(External)". */
  externalLabel?: string | undefined;
  /** "daniel.cho@fabrikam.com wants to chat with you". */
  intro: string;
  /** Shown after Preview; `undefined` until then. */
  preview?: RequestPreviewMessage[] | undefined;
  previewLabel: string;
  /** The preview's name for screen readers: "Preview of messages". */
  previewListLabel: string;
  onPreview: () => void;
  /** What Accept and Delete do. */
  explanation: string;
  acceptLabel: string;
  deleteLabel: string;
  onAccept: () => void;
  confirm: { title: string; alsoBlockLabel: string; cancelLabel: string; deleteLabel: string };
  /** `block`: also block the sender (AC-F14-13). */
  onDelete: (block: boolean) => void;
}

function Preview({ messages, label }: { messages: RequestPreviewMessage[]; label: string }) {
  return (
    <div role="log" aria-label={label} className="flex flex-col gap-2.5 rounded-md bg-surface-sunken p-4">
      {messages.map((message) => (
        <div key={message.id} className="flex gap-2.5">
          <Avatar name={message.senderName} size="sm" />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex gap-2 text-[12px]">
              <span className="font-semibold text-ink">{message.senderName}</span>
              <span className="text-ink-muted">{message.time}</span>
            </span>
            <span className="rounded-md bg-surface px-3 py-2 text-[14px] break-words">{message.text}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Confirm({ props, onCancel }: { props: ChatRequestCardProps; onCancel: () => void }) {
  const titleId = useId();
  const [block, setBlock] = useState(false);
  const { confirm } = props;
  return (
    <div
      role="dialog"
      aria-labelledby={titleId}
      className="flex max-w-110 flex-col gap-3 rounded-xl border border-line bg-surface-raised p-5 shadow-2"
    >
      <h3 id={titleId} className="m-0 text-[17px]">
        {confirm.title}
      </h3>
      <label className="flex items-center gap-2.5 text-[14px]">
        <input
          type="checkbox"
          checked={block}
          onChange={(event) => {
            setBlock(event.target.checked);
          }}
          className="size-4.5 accent-[var(--accent)]"
        />
        {confirm.alsoBlockLabel}
      </label>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          {confirm.cancelLabel}
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            props.onDelete(block);
          }}
        >
          {confirm.deleteLabel}
        </Button>
      </div>
    </div>
  );
}

export function ChatRequestCard(props: ChatRequestCardProps) {
  const headingId = useId();
  const [deleting, setDeleting] = useState(false);
  return (
    <section
      aria-labelledby={headingId}
      className="box-border flex flex-col gap-3.5 rounded-lg border border-line bg-surface p-6 text-ink"
    >
      <div className="flex items-center gap-3">
        <Avatar name={props.name} size="xl" {...(props.photoUrl ? { src: props.photoUrl } : {})} />
        <span className="flex flex-1 flex-col">
          <h2 id={headingId} className="m-0 text-[18px] leading-6 font-[650]">
            {props.name}{" "}
            {props.externalLabel ? (
              <span className="text-[12px] font-semibold text-ink-muted">{props.externalLabel}</span>
            ) : null}
          </h2>
          <span className="text-[13px] text-ink-muted">{props.intro}</span>
        </span>
      </div>
      {props.preview ? (
        <Preview messages={props.preview} label={props.previewListLabel} />
      ) : (
        <Button variant="secondary" className="self-start" onClick={props.onPreview}>
          {props.previewLabel}
        </Button>
      )}
      <p className="m-0 text-[14px] text-ink-muted">{props.explanation}</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={props.onAccept}>{props.acceptLabel}</Button>
        <Button
          variant="secondary"
          onClick={() => {
            setDeleting(true);
          }}
        >
          {props.deleteLabel}
        </Button>
      </div>
      {deleting ? (
        <Confirm
          props={props}
          onCancel={() => {
            setDeleting(false);
          }}
        />
      ) : null}
    </section>
  );
}
