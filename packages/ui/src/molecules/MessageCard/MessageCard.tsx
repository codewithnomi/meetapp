// MessageCard (molecule): one message from the approved "Messages" screen ("When something stops you"):
// an icon in a tone circle, a title, one or two sentences, and up to two buttons. Used for the ends of a
// visit (denied, removed, ended, expired …), for warnings in the meeting ("ends in 10 minutes") and for
// notices ("Omar Farooq muted you"). `live` makes screen readers read it when it appears. All words
// arrive as props.
import { Button, type ButtonVariant } from "../../atoms/Button/index.ts";
import { Icon, type IconName } from "../../atoms/Icon/index.ts";
import { cx } from "../../lib/cx.ts";

export type MessageTone = "neutral" | "warning" | "danger";

export interface MessageAction {
  /** Verb first: "Back to home", "Rejoin", "End meeting". */
  label: string;
  onClick: () => void;
}

export interface MessageCardProps {
  icon: IconName;
  tone: MessageTone;
  title: string;
  body: string;
  primary?: (MessageAction & { variant?: Extract<ButtonVariant, "primary" | "danger"> }) | undefined;
  secondary?: MessageAction | undefined;
  /** "polite" for notices, "assertive" for something that ends the visit. */
  live?: "polite" | "assertive";
  /** The page's main message is its h1; a card among others uses h2 (the default). */
  headingLevel?: 1 | 2;
  className?: string;
}

const TONES: Record<MessageTone, string> = {
  neutral: "bg-surface-sunken text-ink",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function MessageCard(props: MessageCardProps) {
  const { icon, tone, title, body, primary, secondary, live, headingLevel = 2, className } = props;
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const liveProps = live ? { role: live === "assertive" ? "alert" : "status", "aria-live": live } : {};
  return (
    <section
      {...liveProps}
      className={cx("flex flex-col gap-3 rounded-lg border border-line bg-surface p-5 text-ink", className)}
    >
      <span className={cx("inline-grid size-10 place-items-center rounded-full", TONES[tone])}>
        <Icon name={icon} />
      </span>
      <Heading className="m-0 text-[16px] leading-5.5 font-[650]">{title}</Heading>
      <p className="m-0 text-[13px] leading-4.5 text-ink-muted">{body}</p>
      {primary || secondary ? (
        <div className="mt-auto flex flex-wrap gap-2">
          {secondary ? (
            <Button variant="ghost" size="sm" onClick={secondary.onClick}>
              {secondary.label}
            </Button>
          ) : null}
          {primary ? (
            <Button variant={primary.variant ?? "primary"} size="sm" onClick={primary.onClick}>
              {primary.label}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
