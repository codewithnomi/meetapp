// RequestRow (molecule): one line of a list that waits for a decision, as on the approved "Requests and
// invitations" and "Join a workspace" canvases: a person's photo or a workspace's initial (or an icon),
// a name, a detail line, an optional warning badge and the buttons. Each button is described by the
// row's name, so a screen reader hears "Approve, Zara Iqbal". All words arrive as props.
import { useId } from "react";
import { Avatar } from "../../atoms/Avatar/index.ts";
import { Badge } from "../../atoms/Badge/index.ts";
import { Button, type ButtonVariant } from "../../atoms/Button/index.ts";
import { Icon, type IconName } from "../../atoms/Icon/index.ts";
import { cx } from "../../lib/cx.ts";

export interface RowAction {
  /** Already translated, verb first: "Approve", "Send again". */
  label: string;
  onClick: () => void;
  variant?: ButtonVariant;
}

/** A person (photo or initials), a workspace (its first letter on a tile) or an icon. */
export type RowLeading =
  | { person: string; photoUrl?: string | undefined }
  | { workspace: string; tone?: "accent" | "neutral" }
  | { icon: IconName };

export interface RequestRowProps {
  leading: RowLeading;
  title: string;
  detail: string;
  /** A warning shown beside the name, e.g. "Removed earlier". */
  badge?: string | undefined;
  actions: RowAction[];
  /** While a decision is being sent, the buttons can't be pressed. */
  busy?: boolean;
  /** "lg" is the bigger card of the Join screen. */
  size?: "md" | "lg";
  className?: string;
}

function Leading({ leading, size }: { leading: RowLeading; size: "md" | "lg" }) {
  if ("person" in leading) {
    return (
      <Avatar
        name={leading.person}
        size={size === "lg" ? "lg" : "md"}
        {...(leading.photoUrl ? { src: leading.photoUrl } : {})}
      />
    );
  }
  const box = size === "lg" ? "size-12 text-[20px]" : "size-10 text-[16px]";
  if ("icon" in leading) {
    return (
      <span aria-hidden="true" className={cx("grid flex-none place-items-center rounded-full bg-surface-sunken", box)}>
        <Icon name={leading.icon} size={18} />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cx(
        "grid flex-none place-items-center rounded-full font-bold",
        box,
        leading.tone === "accent" ? "bg-accent-soft text-accent-text" : "bg-surface-sunken text-ink",
      )}
    >
      {leading.workspace.trim().charAt(0).toUpperCase()}
    </span>
  );
}

export function RequestRow({
  leading,
  title,
  detail,
  badge,
  actions,
  busy = false,
  size = "md",
  className,
}: RequestRowProps) {
  const titleId = useId();
  return (
    <div className={cx("flex flex-wrap items-center gap-x-4 gap-y-3", size === "lg" ? "p-5" : "px-5 py-4", className)}>
      <Leading leading={leading} size={size} />
      <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
        <span id={titleId} className={cx("break-words", size === "lg" ? "font-[650]" : "font-semibold")}>
          {title}
        </span>
        <span className="text-[13px] text-ink-muted">{detail}</span>
      </div>
      {badge ? <Badge tone="warning">{badge}</Badge> : null}
      {actions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant ?? "primary"}
              size={size === "lg" ? "md" : "sm"}
              disabled={busy}
              aria-describedby={titleId}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
