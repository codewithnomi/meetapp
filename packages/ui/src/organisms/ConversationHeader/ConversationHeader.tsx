// ConversationHeader (organism): the top of an open chat on the approved canvas (F14Chat): the picture
// with its status dot, the name with its status in words, Video call and Audio call (F15: off with the
// reason as their tooltip in a read-only chat; replaced by Join while the chat's call runs; a spinner
// while starting), and More (pin, mute, hide, group details). A read-only chat's note sits below it (the page's job).
import { useId } from "react";
import { ActionMenu, type MenuAction } from "../../atoms/ActionMenu/index.ts";
import { Avatar } from "../../atoms/Avatar/index.ts";
import { Button } from "../../atoms/Button/index.ts";
import { Icon } from "../../atoms/Icon/index.ts";
import { StatusDot, type ChatStatus } from "../../atoms/StatusDot/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

export interface ConversationHeaderProps {
  kind: "direct" | "group" | "meeting";
  title: string;
  photoUrl?: string | null | undefined;
  status?: { value: ChatStatus; label: string } | null | undefined;
  /** Under the name: the status word, "6 people", or the meeting's time. */
  subtitle?: string | undefined;
  calls: {
    videoLabel: string;
    audioLabel: string;
    onVideo: () => void;
    onAudio: () => void;
    disabled?: boolean;
    /** Why calls are off (read-only chat): the buttons' tooltip (AC-F15-02). */
    disabledReason?: string | undefined;
    /** While starting: the buttons can't be pressed again (AC-F15-18). */
    pending?: boolean | undefined;
    /** While the chat's call runs: Join instead of the two buttons (AC-F15-03). */
    join?: { label: string; onJoin: () => void } | undefined;
  };
  moreLabel: string;
  actions: MenuAction[];
}

function CallButton({
  icon,
  label,
  onClick,
  disabled,
  reason,
}: {
  icon: "camera" | "phone";
  label: string;
  onClick: () => void;
  disabled: boolean;
  reason?: string | undefined;
}) {
  const reasonId = useId();
  // Off buttons stay focusable (aria-disabled) so keyboard and screen-reader users still hear why.
  return (
    <>
      <button
        type="button"
        aria-label={label}
        aria-disabled={disabled || undefined}
        aria-describedby={disabled && reason ? reasonId : undefined}
        title={reason ?? label}
        onClick={disabled ? undefined : onClick}
        className={cx(
          "grid size-10 place-items-center rounded-full border border-line-strong bg-surface text-ink aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
          FOCUS_RING,
        )}
      >
        <Icon name={icon} size={18} />
      </button>
      {disabled && reason ? (
        <span id={reasonId} className="sr-only">
          {reason}
        </span>
      ) : null}
    </>
  );
}

function CallButtons({ calls }: { calls: ConversationHeaderProps["calls"] }) {
  if (calls.join) {
    return (
      <Button icon="camera" onClick={calls.join.onJoin}>
        {calls.join.label}
      </Button>
    );
  }
  const off = (calls.disabled ?? false) || (calls.pending ?? false);
  return (
    <>
      <CallButton
        icon="camera"
        label={calls.videoLabel}
        onClick={calls.onVideo}
        disabled={off}
        reason={calls.disabledReason}
      />
      <CallButton
        icon="phone"
        label={calls.audioLabel}
        onClick={calls.onAudio}
        disabled={off}
        reason={calls.disabledReason}
      />
    </>
  );
}

export function ConversationHeader(props: ConversationHeaderProps) {
  const headingId = useId();
  const { calls } = props;
  return (
    <header
      aria-labelledby={headingId}
      className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-6 py-3.5 text-ink"
    >
      {props.kind === "meeting" ? (
        <span
          aria-hidden="true"
          className="grid size-9 place-items-center rounded-full bg-accent-soft text-accent-text"
        >
          <Icon name="calendar" size={18} />
        </span>
      ) : (
        <span className="relative flex-none">
          <Avatar name={props.title} size="md" {...(props.photoUrl ? { src: props.photoUrl } : {})} />
          {props.status ? <StatusDot status={props.status.value} label={props.status.label} placed /> : null}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <h2 id={headingId} className="m-0 truncate text-[17px] leading-5.5 font-[650]">
          {props.title}
        </h2>
        {props.subtitle ? <span className="text-[12px] text-ink-muted">{props.subtitle}</span> : null}
      </span>
      <CallButtons calls={calls} />
      {props.actions.length > 0 ? <ActionMenu actions={props.actions} label={props.moreLabel} /> : null}
    </header>
  );
}
