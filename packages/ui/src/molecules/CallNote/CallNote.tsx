// CallNote (molecule): a call's note in the chat (F15 AC-F15-15, approved canvas "Calls from chat"): "Sara
// started a call · 03:12 · 2 people" with Join while it runs, "Call ended · 1h 05m · Sara, Omar and you",
// and "Missed call from Omar · 17:42" with Call back. The words arrive translated.
import { Button } from "../../atoms/Button/index.ts";
import { Icon } from "../../atoms/Icon/index.ts";
import { cx } from "../../lib/cx.ts";

export interface CallNoteProps {
  kind: "running" | "ended" | "missed";
  /** "Sara Malik started a call", "Call ended", "Missed call from Omar Farooq". */
  text: string;
  /** "03:12 · 2 people", "1h 05m · Sara, Omar and you", "17:42". */
  detail?: string | undefined;
  /** Join (running) or Call back (missed); none for an ended call. */
  action?: { label: string; onClick: () => void } | undefined;
}

export function CallNote({ kind, text, detail, action }: CallNoteProps) {
  return (
    <div
      role={kind === "running" ? "status" : undefined}
      className={cx(
        "flex max-w-130 flex-wrap items-center justify-center gap-2.5 self-center rounded-md border px-3.5 py-2.5 text-[13px] leading-4.5",
        kind === "running" ? "border-accent bg-accent-soft" : "border-line bg-surface",
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "grid size-7.5 place-items-center rounded-full",
          kind === "missed" ? "bg-danger-soft text-danger" : "bg-surface-sunken text-ink",
        )}
      >
        <Icon name={kind === "missed" ? "phone-missed" : kind === "running" ? "camera" : "phone"} size={16} />
      </span>
      <span className="text-ink">
        <strong>{text}</strong>
        {detail ? <span className="tabular-nums"> · {detail}</span> : null}
      </span>
      {action ? (
        <Button variant={kind === "running" ? "primary" : "secondary"} size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
